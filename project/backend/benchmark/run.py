"""Benchmark: SERA (multi-agent) vs single agent vs rules-only vs perfect-information reference.

Every contestant gets the SAME simulated network and the SAME request stream (seeded).
The benchmark officer approves the recommended plan automatically and rejects requests the
contestant itself flagged as duplicates (logged). Results are computed by code from the run,
never typed by hand: outputs/benchmark/<run_id>/results.csv and summary.md.

Human baseline: coordinators fill benchmark/human_template.csv (see docs/Workflow.md);
if outputs/benchmark/human_results.csv exists it is added to the summary.
"""
from __future__ import annotations

import copy
import csv
import json
import random
import statistics
import time
from datetime import datetime
from pathlib import Path

import networkx as nx

from ..agents.llm import LLM
from ..agents.orchestrator import Orchestrator
from ..config import OUTPUT_DIR
from ..domain.catalog import BANKS, COMP, HOSP, TYPES, bank, compatible_types
from ..domain.roads import travel
from ..domain.world import World
from ..trace import Tracer

SCENARIOS = {  # name: (mean minutes between requests, horizon minutes) — one simulated day each
    "normal": (30, 1440), "dengue": (16, 1440), "accident": (14, 1440),
    "stockout": (26, 1440), "duplicates": (24, 1440), "missing": (26, 1440),
}
STOCK_SCALE = 0.4   # benchmark networks run lean so that choices matter (shortages and expiry happen)
URGENT = ("Critical", "Urgent")


# ----------------------------------------------------------------------------- world + stream
def make_world(scenario: str, seed: int) -> World:
    w = World(seed=seed, scenario=scenario)
    for b in BANKS:
        for c in ("RBC", "PLT"):
            for lots in w.stock[b["id"]][c].values():
                for l in lots:
                    l["u"] = int(l["u"] * STOCK_SCALE + 0.5)
    w.compute_moves()
    if scenario == "stockout":
        for c in ("RBC", "PLT"):
            for lots in w.stock["b1"][c].values():
                for l in lots:
                    l["u"] = 0
    if scenario == "missing":
        w.offline_banks = {"b5"}
    return w


def make_stream(scenario: str, seed: int) -> list[tuple[int, dict]]:
    gap, horizon = SCENARIOS[scenario]
    gen = World(seed=seed * 7 + 1, scenario=scenario)   # same generator code as the live system
    rng = random.Random(seed)
    out, t = [], 0
    while t < horizon:
        t += max(1, int(rng.expovariate(1 / gap)))
        f = gen.generate_request_fields()
        if scenario == "missing" and rng.random() < 0.35:
            for k in ("comp", "units"):
                f.pop(k, None)
        out.append((t, f))
        gen.requests.insert(0, {"id": f"G{len(out)}", **{k: f.get(k) for k in ("hosp", "type", "comp", "units", "urg", "pat", "bed")},
                                "status": "awaiting", "created": t})
    return out


# ----------------------------------------------------------------------------- contestants
class Contestant:
    name = "?"

    def __init__(self, world: World, tracer: Tracer, llm_enabled: bool):
        self.w, self.tracer, self.llm_enabled = world, tracer, llm_enabled

    def plan(self, req: dict):
        raise NotImplementedError


class MultiAgent(Contestant):
    name = "A · SERA multi-agent"
    uses_transfers = True

    def __init__(self, *a):
        super().__init__(*a)
        self.o = Orchestrator(self.w, self.tracer, LLM(self.tracer, self.w.stats, enabled=None if self.llm_enabled else False))

    def plan(self, req):
        self.o.run_case(req["id"])


class RulesOnly(Contestant):
    name = "C · Rules only"

    def plan(self, req):
        req.update({k: v for k, v in {"comp": req.get("comp") or "RBC", "units": req.get("units") or 1}.items()})
        best = None
        for b in BANKS:
            for dt in compatible_types(req["comp"], req["type"]):
                avail = self.w.total(b["id"], req["comp"], dt)
                if avail >= req["units"]:
                    eta = travel(b["id"], req["hosp"])
                    key = (eta, dt != req["type"])
                    if best is None or key < best[0]:
                        best = (key, {"bank": b["id"], "dt": dt, "eta": eta, "soon": 999, "avail": avail})
        req["plan"] = {"options": [best[1]] if best else [], "offering": 1 if best else 0}
        req["status"] = "awaiting"
        if not best:
            req["donorPlan"] = {"contact": req["units"] * 4}


class SingleAgent(Contestant):
    """One language-model agent with the same data and tools, no split of roles, no Case Board."""
    name = "B · Single agent"

    def __init__(self, *a):
        super().__init__(*a)
        self.llm = LLM(self.tracer, self.w.stats, enabled=None if self.llm_enabled else False)

    def plan(self, req):
        lines = []
        for b in BANKS:
            for dt in TYPES:
                for comp in ("RBC", "PLT"):
                    usable = [l for l in self.w.lots(b["id"], comp, dt) if l["u"] > 0]
                    if usable:
                        lines.append(f"{b['id']} {b['name']} {comp} {dt}: {sum(l['u'] for l in usable)} units, soonest expiry "
                                     f"{min(l['exp'] for l in usable):.0f} h, {travel(b['id'], req['hosp'])} min away")
        open_reqs = [f"{r['id']} {r['hosp']} {r['type']} {r['comp']} x{r['units']}" for r in self.w.open_requests() if r is not req][:15]
        out = self.llm.json(
            "Single Agent", "You coordinate blood supply for a whole city on your own.",
            f"Ward message: '{req.get('msg','')}'. Structured fields (may be incomplete): type={req.get('type')} comp={req.get('comp')} "
            f"units={req.get('units')} urgency={req.get('urg')} patient={req.get('pat')} hospital={req['hosp']}.\n"
            f"Open requests: {open_reqs}\nStock:\n" + "\n".join(lines) +
            "\nChoose ONE bank and donor blood type. Keys: comp ('RBC'/'PLT'), units (int), bank (bank id or null), "
            "donor_type, duplicate (true if this repeats an open request), call_donors (true if no stock).",
            ["bank", "donor_type", "duplicate"], req["id"], self.w.clock, max_tokens=300)
        req["comp"] = req.get("comp") or (out or {}).get("comp") or "RBC"
        req["units"] = req.get("units") or int((out or {}).get("units") or 1)
        req["status"] = "awaiting"
        req["plan"] = {"options": [], "offering": 0}
        if out is None:
            req["checks"] = [{"k": "warn", "t": "single agent unavailable"}]
            return
        if out.get("duplicate"):
            req["checks"] = [{"k": "warn", "t": "duplicate (single agent)"}]
            req["dupOf"] = "?"
        b, dt = out.get("bank"), out.get("donor_type")
        if b in {x["id"] for x in BANKS} and dt in TYPES:
            # no independent auditor: an incompatible choice is executed and counted
            req["plan"] = {"options": [{"bank": b, "dt": dt, "eta": travel(b, req["hosp"]), "soon": 999, "avail": 0}], "offering": 1}
            if dt not in compatible_types(req["comp"], req["type"]):
                self.w.stats["incompat"] += 1
                req["_incompatible"] = True
        else:
            req["donorPlan"] = {"contact": req["units"] * 4}


# ----------------------------------------------------------------------------- run one
def run_one(cls, scenario: str, seed: int, tracer: Tracer, llm_enabled: bool) -> dict:
    w = make_world(scenario, seed)
    stream = make_stream(scenario, seed)
    start = w.clock
    c = cls(w, tracer, llm_enabled)
    pending = list(stream)
    donor_calls_unneeded = 0
    replan = []
    w.on_replan = lambda r: replan.append(r["id"])
    t0 = time.perf_counter()
    gap, horizon = SCENARIOS[scenario]
    for minute in range(horizon + 90):
        if minute % 60 == 0:   # the officer reviews suggested transfers once an hour
            for m in list(w.moves):
                if hasattr(c, "uses_transfers") and c.uses_transfers:
                    w.approve_move(m["id"])
        while pending and pending[0][0] <= minute:
            _, f = pending.pop(0)
            r = w.new_request(dict(f), "Ward message")
            c.plan(r)
            replan_ids, replan[:] = list(replan), []
            for rid in [r["id"], *replan_ids]:
                req = w.get(rid)
                if rid != r["id"]:
                    c.plan(req)
                if req["status"] != "awaiting":
                    continue
                if req.get("dupOf"):
                    w.reject(rid, "duplicate flagged by contestant")
                    continue
                if not req["plan"]["options"]:
                    usable = sum(w.total(b["id"], req["comp"], dt) for b in BANKS for dt in compatible_types(req["comp"], req["type"]))
                    if usable >= req["units"]:
                        donor_calls_unneeded += 1
                if req.get("_incompatible"):
                    o = req["plan"]["options"][0]
                    lots = [l for l in w.lots(o["bank"], req["comp"], o["dt"]) if l["u"] > 0]
                    if sum(l["u"] for l in lots) >= req["units"]:
                        req["status"] = "rejected"   # harmful plan blocked at the bedside check; counted as incompatible + unmet
                        continue
                res = w.approve(rid, approver="Benchmark officer")
                if res == "stale":
                    c.plan(req)
                    w.approve(rid, approver="Benchmark officer")
        w.tick()
    reqs = list(reversed(w.requests))
    urgent = [r for r in reqs if r["urg"] in URGENT and not r.get("_truthDup")]
    unmet = [r for r in urgent if r["status"] != "delivered"]
    fill = [r["deliveredAt"] - r["created"] for r in urgent if r["status"] == "delivered"]
    by_h = {}
    for r in reqs:
        if r.get("_truthDup"):
            continue
        by_h.setdefault(r["hosp"], []).append(r["status"] == "delivered")
    rates = [sum(v) / len(v) for v in by_h.values() if v]
    return {
        "requests": len(reqs), "urgent": len(urgent),
        "unmet_urgent_pct": round(100 * len(unmet) / max(1, len(urgent)), 1),
        "incompatible": w.stats["incompat"],
        "units_expired": w.stats["expired"],
        "median_fill_min": statistics.median(fill) if fill else None,
        "near_expiry_used": w.stats["nearSaved"],
        "fairness_gap_pct": round(100 * (max(rates) - min(rates)), 1) if rates else None,
        "donor_calls": w.stats["donorCalls"], "unneeded_donor_calls": donor_calls_unneeded,
        "true_duplicates": sum(1 for r in reqs if r.get("_truthDup")),
        "duplicates_caught": sum(1 for r in reqs if r.get("dupOf") and r.get("_truthDup")),
        "false_duplicate_flags": sum(1 for r in reqs if r.get("dupOf") and not r.get("_truthDup")),
        "duplicate_units_sent": sum(r["units"] for r in reqs if r.get("_truthDup") and r["status"] in ("enroute", "delivered")),
        "llm_calls": w.stats.get("llmCalls", 0), "tokens": w.stats.get("tokens", 0),
        "cost_usd": round(w.stats.get("costUsd", 0.0), 5), "fallbacks": w.stats.get("fallbacks", 0),
        "wall_seconds": round(time.perf_counter() - t0, 1),
    }


def reference(scenario: str, seed: int) -> dict:
    """Perfect information (knows every request in advance): min-cost flow over the whole horizon.
    A theoretical bound used to normalise scores; it ignores timing and expiry during the run."""
    w = make_world(scenario, seed)
    stream = make_stream(scenario, seed)
    g = nx.DiGraph()
    supply = 0
    for b in BANKS:
        for comp in ("RBC", "PLT"):
            for dt in TYPES:
                u = w.total(b["id"], comp, dt)
                if u:
                    g.add_edge("S", (b["id"], comp, dt), capacity=u, weight=0)
                    supply += u
    demand = 0
    for i, (_, f) in enumerate(stream):
        comp, units = f.get("comp") or "RBC", f.get("units") or 1
        pen = 1000 if f["urg"] in URGENT else 300
        g.add_edge(("r", i), "T", capacity=units, weight=0)
        g.add_edge("S", ("r", i), capacity=units, weight=pen)   # unmet = dummy supply at a penalty
        demand += units
        for b in BANKS:
            for dt in compatible_types(comp, f["type"]):
                if g.has_node((b["id"], comp, dt)):
                    g.add_edge((b["id"], comp, dt), ("r", i), capacity=units, weight=travel(b["id"], f["hosp"]) + (0 if dt == f["type"] else 5))
    flow = _min_cost_flow(g, demand)
    urgent = [i for i, (_, f) in enumerate(stream) if f["urg"] in URGENT]
    unmet = [i for i in urgent if flow["S"].get(("r", i), 0) > 0]
    times = []
    for i in urgent:
        if i in unmet:
            continue
        f = stream[i][1]
        etas = [travel(n[0], f["hosp"]) for n, d in flow.items() if isinstance(n, tuple) and len(n) == 3 and d.get(("r", i), 0) > 0]
        if etas:
            times.append(max(etas))
    # Only the travel-time bound is comparable (the solver cannot call donors), so other metrics are left blank.
    return {"requests": len(stream), "urgent": len(urgent), "unmet_urgent_pct": None,
            "incompatible": 0, "units_expired": None, "median_fill_min": statistics.median(times) if times else None,
            "near_expiry_used": None, "fairness_gap_pct": None, "donor_calls": None, "unneeded_donor_calls": None,
            "true_duplicates": None, "duplicates_caught": None, "false_duplicate_flags": None, "duplicate_units_sent": None,
            "llm_calls": 0, "tokens": 0, "cost_usd": 0, "fallbacks": 0, "wall_seconds": 0}


def _min_cost_flow(g: nx.DiGraph, demand: int) -> dict:
    """Google OR-Tools min-cost flow when installed (as in the proposal); NetworkX otherwise."""
    try:
        from ortools.graph.python import min_cost_flow
        idx = {n: i for i, n in enumerate(g.nodes)}
        mcf = min_cost_flow.SimpleMinCostFlow()
        arcs = []
        for u, v, d in g.edges(data=True):
            arcs.append((u, v, mcf.add_arc_with_capacity_and_unit_cost(idx[u], idx[v], int(d["capacity"]), int(d["weight"]))))
        for n in g.nodes:
            mcf.set_node_supply(idx[n], demand if n == "S" else -demand if n == "T" else 0)
        if mcf.solve() != mcf.OPTIMAL:
            raise RuntimeError("OR-Tools found no optimal flow")
        flow = {}
        for u, v, a in arcs:
            flow.setdefault(u, {})[v] = mcf.flow(a)
        return flow
    except ImportError:
        g.nodes["S"]["demand"] = -demand
        g.nodes["T"]["demand"] = demand
        return nx.min_cost_flow(g)


CONTESTANTS = {"A": MultiAgent, "B": SingleAgent, "C": RulesOnly}


def run_benchmark(scenarios=None, seeds=2, repeats=1, contestants="ABC", llm_enabled=True) -> Path:
    run_id = datetime.now().strftime("bench-%Y%m%d-%H%M%S")
    out_dir = OUTPUT_DIR / "benchmark" / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    tracer = Tracer(run_id, persist=True)
    rows = []
    llm_live = LLM(tracer).enabled and llm_enabled
    for sc in scenarios or list(SCENARIOS):
        for seed in range(1, seeds + 1):
            ref = reference(sc, seed)
            rows.append({"contestant": "★ Reference (perfect information)", "scenario": sc, "seed": seed, "repeat": 0, **ref})
            for rep in range(repeats):
                for key in contestants:
                    if key == "B" and not llm_live:
                        continue   # the single agent IS a language model; without one there is nothing to test
                    m = run_one(CONTESTANTS[key], sc, seed, tracer, llm_live)
                    rows.append({"contestant": CONTESTANTS[key].name, "scenario": sc, "seed": seed, "repeat": rep, **m})
                    print(f"{sc:<11} seed {seed} rep {rep} {CONTESTANTS[key].name:<22} unmet {m['unmet_urgent_pct']:>5}%  "
                          f"expired {m['units_expired']:>3}  incompatible {m['incompatible']}  cost ${m['cost_usd']}")
    for r in rows:
        try:
            from ..storage import store
            store().add_result(run_id, r["contestant"], r["scenario"], r["seed"], r["repeat"], r)
        except Exception:
            pass
    with (out_dir / "results.csv").open("w", newline="", encoding="utf-8") as fh:
        wr = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        wr.writeheader()
        wr.writerows(rows)
    (out_dir / "summary.md").write_text(summarise(rows, run_id, seeds, repeats, llm_live), encoding="utf-8")
    (OUTPUT_DIR / "benchmark" / "latest.json").write_text(json.dumps({"run_id": run_id, "rows": rows}, default=str), encoding="utf-8")
    return out_dir


def _mean(vals):
    vals = [v for v in vals if isinstance(v, (int, float))]
    return round(sum(vals) / len(vals), 2) if vals else "—"


def summarise(rows, run_id, seeds, repeats, llm_live) -> str:
    metrics = ["unmet_urgent_pct", "incompatible", "units_expired", "median_fill_min", "near_expiry_used",
               "fairness_gap_pct", "unneeded_donor_calls", "duplicates_caught", "false_duplicate_flags",
               "duplicate_units_sent", "cost_usd", "fallbacks"]
    names = sorted({r["contestant"] for r in rows})
    md = [f"# Benchmark {run_id}", "",
          f"Seeds per scenario: {seeds} · repeats: {repeats} · language model: {'on' if llm_live else 'OFF (rule fallbacks; B not run)'}",
          "All data is synthetic. Lower is better except near_expiry_used (higher = less waste).", ""]
    for sc in sorted({r["scenario"] for r in rows}):
        md += [f"## {sc}", "", "| contestant | " + " | ".join(metrics) + " |", "|---" * (len(metrics) + 1) + "|"]
        for n in names:
            sel = [r for r in rows if r["scenario"] == sc and r["contestant"] == n]
            if sel:
                md.append(f"| {n} | " + " | ".join(str(_mean([r[m] for r in sel])) for m in metrics) + " |")
        md.append("")
    human = OUTPUT_DIR / "benchmark" / "human_results.csv"
    if human.exists():
        md += ["## D · Human coordinators", "", human.read_text(encoding="utf-8"), ""]
    else:
        md += ["## D · Human coordinators", "", "Not yet recorded: fill backend/benchmark/human_template.csv and save it as "
               "outputs/benchmark/human_results.csv.", ""]
    return "\n".join(md)
