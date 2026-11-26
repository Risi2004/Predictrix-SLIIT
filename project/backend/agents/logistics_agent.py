"""Logistics Agent — chooses between bank offers and plans the route (NetworkX road graph).

Ranking (deterministic, explainable): urgency-weighted travel time, exact type before
compatible type, near-expiry units first (so they are used, not wasted), and O- protected
for O- patients. Up to three ranked options (one per bank) go to the officer.
"""
from __future__ import annotations

from ..domain.catalog import bank, fmt_h, hosp


def score(o: dict, req: dict) -> float:
    s = (2 if req["urg"] == "Critical" else 1) * o["eta"] + (0 if o["dt"] == req["type"] else 10)
    s -= 20 if o["soon"] < 24 else 10 if o["soon"] < 72 else 0
    if req["comp"] == "RBC" and o["dt"] == "O-" and req["type"] != "O-":
        s += 18
    if o.get("kind") == "reserve":
        s += 6
    return s


def reason(o: dict, req: dict) -> str:
    p = ["Exact match" if o["dt"] == req["type"] else f"Compatible {o['dt']}"]
    if o["soon"] < 72:
        p.append(f"units expire in {fmt_h(o['soon'])}, so they get used")
    if o.get("kind") == "reserve":
        p.append("bank released reserve stock")
    p.append(f"{o['eta']} min away")
    return " · ".join(p)


class LogisticsAgent:
    name = "Logistics Agent"

    def __init__(self, board):
        self.board = board

    def run(self, req: dict, offers: list[dict]) -> dict:
        ranked = sorted(offers, key=lambda o: score(o, req))
        seen, top = set(), []
        for o in ranked:
            if o["bank"] in seen:
                continue
            seen.add(o["bank"])
            top.append({**o, "score": round(score(o, req), 1), "reason": reason(o, req)})
            if len(top) == 3:
                break
        plan = {"options": top, "offering": len({o["bank"] for o in offers})}
        if top:
            o = top[0]
            text = f"Best route: {bank(o['bank'])['name']} → {hosp(req['hosp'])['short']}, {o['eta']} min."
        else:
            text = "No bank can cover the full request."
        self.board.post(req, self.name, "route", {"options": [{k: v for k, v in o.items() if k in ('bank', 'dt', 'eta', 'score')} for o in top]},
                        "ranked by urgency, expiry and travel time", 0.95 if top else 0.5, log_text=text)
        return plan
