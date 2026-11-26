"""SERA API (FastAPI). The React UI reads /api/state and sends officer / ward actions here."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import config
from .agents.orchestrator import HAVE_LANGGRAPH
from .domain.catalog import REGISTRY, TYPES
from .domain.roads import route_source
from .service import SeraService

svc: SeraService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global svc
    svc = SeraService()
    svc.start()
    yield
    svc.stop()


app = FastAPI(title="SERA — blood network coordination (Predictrix)", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


def W():
    return svc.world


class RequestIn(BaseModel):
    hosp: str = "h1"
    type: str | None = None
    comp: str | None = None
    units: int | None = Field(default=None, ge=1, le=12)
    urg: str | None = None
    pat: str | None = None
    msg: str = ""
    source: str = "Ward form"


class ParseIn(BaseModel):
    msg: str


class RejectIn(BaseModel):
    reason: str = "Not needed any more"


class ChoiceIn(BaseModel):
    index: int


class CampaignIn(BaseModel):
    type: str
    units: int = Field(ge=1, le=20)


class ScenarioIn(BaseModel):
    scenario: str


@app.get("/health")
def health():
    return {"status": "ok", "langgraph": HAVE_LANGGRAPH, "llm": svc.orch.llm.enabled, "model": config.MODEL,
            "roads": route_source(), "storage": __import__("backend.storage", fromlist=["store"]).store().kind,
            "trace": str(svc.tracer.path)}


@app.get("/api/state")
def state(since: int = 0):
    return W().snapshot(since)


@app.post("/api/requests")
def create_request(body: RequestIn):
    if body.type is not None and body.type not in TYPES:
        raise HTTPException(400, "Unknown blood type")
    r = svc.submit(body.model_dump(exclude={"source"}), body.source)
    return {"id": r["id"]}


@app.post("/api/parse")
def parse(body: ParseIn):
    fields, conf, fallback = svc.orch.request_agent.parse(body.msg)
    return {"fields": fields, "confidence": conf, "fallback": fallback}


def _ok(result, msg="Not possible in the current state"):
    if not result:
        raise HTTPException(409, msg)
    return {"ok": True}


@app.post("/api/cases/{rid}/approve")
def approve(rid: str):
    with W().lock:
        result = W().approve(rid)
    if result == "stale":
        svc.submit_existing(rid)
    if result == "invalid":
        raise HTTPException(409, "Case is not awaiting approval")
    return {"result": result}


@app.post("/api/cases/{rid}/reject")
def reject(rid: str, body: RejectIn):
    with W().lock:
        return _ok(W().reject(rid, body.reason))


@app.post("/api/cases/{rid}/choose")
def choose(rid: str, body: ChoiceIn):
    with W().lock:
        W().choose(rid, body.index)
    return {"ok": True}


@app.post("/api/moves/{mid}/approve")
def approve_move(mid: str):
    with W().lock:
        return _ok(W().approve_move(mid))


@app.post("/api/moves/{mid}/dismiss")
def dismiss_move(mid: str):
    with W().lock:
        return _ok(W().dismiss_move(mid))


@app.post("/api/campaigns")
def prepare_campaign(body: CampaignIn):
    if body.type not in TYPES:
        raise HTTPException(400, "Unknown blood type")
    w = W()
    with w.lock:
        have = w.net_total("RBC", body.type)
        warn = (f"The network already holds {have} units of {body.type}. Calling donors may be unnecessary."
                if have >= body.units * 3 else None)
        c = w.start_campaign(body.type, "RBC", body.units, min(REGISTRY[body.type], body.units * 4), pending=True, warn=warn)
        w.event("", "Donor call prepared", "Review and approve it to start contacting donors.")
    return {"id": c["id"], "warn": warn}


@app.post("/api/campaigns/{cid}/approve")
def approve_campaign(cid: str):
    with W().lock:
        return _ok(W().approve_campaign(cid))


@app.post("/api/campaigns/{cid}/cancel")
def cancel_campaign(cid: str):
    with W().lock:
        return _ok(W().cancel_campaign(cid))


@app.post("/api/sim/scenario")
def scenario(body: ScenarioIn):
    svc.set_scenario(body.scenario)
    return {"ok": True}


@app.post("/api/sim/live")
def toggle_live():
    with W().lock:
        W().live = not W().live
        return {"live": W().live}


@app.get("/api/trace")
def trace(case_id: str | None = None, limit: int = 200):
    ev = [e for e in svc.tracer.events if case_id is None or e["case_id"] == case_id]
    return ev[-limit:]


@app.get("/api/benchmark/latest")
def benchmark_latest():
    path = config.OUTPUT_DIR / "benchmark" / "latest.json"
    if not path.exists():
        raise HTTPException(404, "No benchmark run yet: python main.py benchmark")
    import json
    return json.loads(path.read_text(encoding="utf-8"))
