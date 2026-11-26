"""Orchestrator Agent — runs every case through the agent workflow (LangGraph).

    open → read (Request) → source (Bank Agents ×N, in parallel) → route (Logistics)
         → audit (Auditor) → [no stock? → donors (Donor)] → gate (officer approval)

The graph stops at the human gate: nothing moves until the Blood Bank Officer approves
via the API (World.approve). If LangGraph is not installed, the same nodes run in order.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from typing import TypedDict

from ..domain.catalog import BANKS, COMP, TYPES, hosp
from .auditor_agent import AuditorAgent
from .bank_agent import BankAgent
from .board import CaseBoard
from .donor_agent import DonorAgent
from .llm import LLM
from .logistics_agent import LogisticsAgent
from .request_agent import RequestAgent

try:
    from langgraph.graph import END, StateGraph
    HAVE_LANGGRAPH = True
except Exception:  # pragma: no cover
    HAVE_LANGGRAPH, END, StateGraph = False, "__end__", None

DEADLINE_MIN = {"Critical": 4, "Urgent": 15, "Routine": 60}


class CaseState(TypedDict, total=False):
    case_id: str
    next: str


class Orchestrator:
    name = "Orchestrator"

    def __init__(self, world, tracer, llm: LLM | None = None, step_delay: float = 0.0):
        self.world, self.tracer, self.step_delay = world, tracer, step_delay
        self.llm = llm or LLM(tracer, world.stats)
        self.board = CaseBoard(world, tracer)
        self.request_agent = RequestAgent(self.llm, self.board)
        self.bank_agents = {b["id"]: BankAgent(b["id"], world, self.llm, self.board) for b in BANKS}
        self.logistics = LogisticsAgent(self.board)
        self.auditor = AuditorAgent(self.llm, self.board)
        self.donor = DonorAgent(self.llm, self.board)
        self.pool = ThreadPoolExecutor(max_workers=len(BANKS))
        self.graph = self._build_graph() if HAVE_LANGGRAPH else None

    # ------------------------------------------------------------ helpers
    def _req(self, s: CaseState) -> dict:
        return self.world.get(s["case_id"])

    def _status(self, req, status):
        with self.world.lock:
            req["status"] = status
        if self.step_delay:
            time.sleep(self.step_delay)

    # -------------------------------------------------------------- nodes
    def n_open(self, s):
        req = self._req(s)
        self._status(req, "received")
        self.board.post(req, self.name, "open", {"deadline_min": DEADLINE_MIN.get(req["urg"], 15)}, "new request",
                        1.0, log_text=f"Opened case {req['id']} for {hosp(req['hosp'])['short']}.")
        return {"next": "read"}

    def n_read(self, s):
        req = self._req(s)
        self._status(req, "matching")
        self.request_agent.run(req, self.world)
        if req.get("type") not in TYPES:
            with self.world.lock:
                req["status"] = "rejected"
                self.world.add_log(req, self.name, "Returned to the ward: blood type not stated. Please resend.")
                self.world.event("crit", f"Need the blood type · {req['id']}", "Please resend the request with the blood type.", "hospital")
            return {"next": "end"}
        return {"next": "source"}

    def n_source(self, s):
        req = self._req(s)
        self._status(req, "sourcing")
        futures = [self.pool.submit(a.decide, req) for a in self.bank_agents.values()]
        offers = [o for f in futures for o in f.result()]
        if not any(o["avail"] >= req["units"] for o in offers) and req["urg"] in ("Critical", "Urgent"):
            # second round: no bank could cover it — ask every bank to reconsider its reserve
            self.board.post(req, self.name, "escalate", {"round": 2}, "no full offer in round 1", 1.0,
                            log_text="No full offer; asking banks to reconsider their reserves (round 2).")
            futures = [self.pool.submit(a.decide, req, True) for a in self.bank_agents.values()]
            offers = [o for f in futures for o in f.result()]
        req["_offers"] = offers
        counters = len(self.board.read(req, "counter_offer"))
        late = len(self.board.read(req, "timeout"))
        text = f"{len({o['bank'] for o in offers})} of 8 banks can offer compatible units"
        text += f"; {counters} counter-offer{'s' if counters != 1 else ''}" if counters else ""
        text += f"; {late} bank{'s' if late != 1 else ''} did not reply" if late else ""
        with self.world.lock:
            self.world.add_log(req, "Bank Agents", text + ".")
        return {"next": "route"}

    def n_route(self, s):
        req = self._req(s)
        self._status(req, "routing")
        req["plan"] = self.logistics.run(req, req.pop("_offers", []))
        return {"next": "audit"}

    def n_audit(self, s):
        req = self._req(s)
        self._status(req, "checking")
        self.auditor.run(req, self.world)
        return {"next": "gate" if req["plan"]["options"] else "donors"}

    def n_donors(self, s):
        req = self._req(s)
        self.donor.run(req, self.world)
        return {"next": "gate"}

    def n_gate(self, s):
        req = self._req(s)
        took = self.world.clock - req["created"]
        limit = DEADLINE_MIN.get(req["urg"], 15)
        with self.world.lock:
            req["status"], req["choice"] = "awaiting", 0
            req["planMinutes"] = took
            if req["plan"]["options"]:
                self.world.add_log(req, self.name, "Plan sent to the officer for approval.")
            if took > limit:
                self.world.add_log(req, self.name, f"Deadline missed: plan took {took} min (limit {limit}).")
            self.world.event("crit" if req["urg"] == "Critical" else "", f"Needs your approval · {req['id']}",
                             f"{req['units']} × {req['type']} {COMP[req['comp']].lower()} for {hosp(req['hosp'])['short']}", "officer")
        self.tracer.emit(self.name, "gate.awaiting_officer", req["id"], self.world.clock,
                         {"options": len(req["plan"]["options"]), "plan_minutes": took, "deadline": limit})
        return {"next": "end"}

    # -------------------------------------------------------------- graph
    def _build_graph(self):
        g = StateGraph(CaseState)
        for name in ("open", "read", "source", "route", "audit", "donors", "gate"):
            g.add_node(name, getattr(self, f"n_{name}"))
        g.set_entry_point("open")
        route = lambda s: s["next"]
        g.add_conditional_edges("open", route, {"read": "read"})
        g.add_conditional_edges("read", route, {"source": "source", "end": END})
        g.add_conditional_edges("source", route, {"route": "route"})
        g.add_conditional_edges("route", route, {"audit": "audit"})
        g.add_conditional_edges("audit", route, {"gate": "gate", "donors": "donors"})
        g.add_conditional_edges("donors", route, {"gate": "gate"})
        g.add_conditional_edges("gate", route, {"end": END})
        return g.compile()

    def run_case(self, case_id: str):
        state: CaseState = {"case_id": case_id, "next": "open"}
        try:
            if self.graph is not None:
                self.graph.invoke(state)
            else:
                order = {"open": self.n_open, "read": self.n_read, "source": self.n_source, "route": self.n_route,
                         "audit": self.n_audit, "donors": self.n_donors, "gate": self.n_gate}
                step = "open"
                while step in order:
                    step = order[step]({"case_id": case_id})["next"]
        except Exception as exc:  # a crashed case must never hang: hand it to the officer
            req = self.world.get(case_id)
            self.tracer.emit(self.name, "case.error", case_id, self.world.clock, {"error": repr(exc)})
            if req and req["status"] not in ("awaiting", "rejected", "delivered"):
                with self.world.lock:
                    req["status"] = "awaiting"
                    req.setdefault("checks", []).append({"k": "warn", "t": "Automatic planning failed; review manually"})
                    self.world.add_log(req, self.name, "Automatic planning failed; sent to the officer.")
        return self.world.get(case_id)
