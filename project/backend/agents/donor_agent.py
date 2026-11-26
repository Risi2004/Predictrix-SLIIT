"""Donor Agent — last resort. Only acts when no bank can cover a need.

Chooses how many eligible, consented donors to contact (about 4 per unit, capped by the
registry) and drafts the message. The officer must approve before anyone is contacted.
All donor data is synthetic.
"""
from __future__ import annotations

from ..domain.catalog import COMP, REGISTRY, hosp


class DonorAgent:
    name = "Donor Agent"

    def __init__(self, llm, board):
        self.llm, self.board = llm, board

    def run(self, req: dict, world) -> dict:
        contact = min(REGISTRY.get(req["type"], 0), req["units"] * 4)
        draft = self.llm.json(
            self.name, "You write short, kind SMS messages asking eligible blood donors to come in. No medical details, no patient names.",
            f"Ask {req['type']} donors to donate {COMP[req['comp']].lower()} today at Central blood bank for a patient at "
            f"{hosp(req['hosp'])['name']}. Keys: sms (max 300 characters).",
            ["sms"], req["id"], world.clock, small=True, max_tokens=150)
        sms = (draft or {}).get("sms") or (f"SERA: {req['type']} donors are urgently needed today at Central blood bank. "
                                            "If you are well and eligible, please come in. Reply STOP to opt out.")
        plan = {"contact": contact, "message": sms[:300]}
        req["donorPlan"] = plan
        self.board.post(req, self.name, "proposal", plan, "no bank can cover the need from stock", 0.85,
                        log_text=f"Proposes calling {contact} eligible {req['type']} donors nearby.")
        return plan
