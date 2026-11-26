"""Auditor Agent — independently checks plans it did not create.

Rule checks (deterministic): compatibility re-check of every option, duplicate requests,
inflated requests, priority (child / maternity / critical), no-stock.
Model review: a second opinion on the request and plan (plausibility, risks), recorded as advice only.
"""
from __future__ import annotations

from ..domain.catalog import COMP, bank, compatible_types


class AuditorAgent:
    name = "Auditor Agent"

    def __init__(self, llm, board):
        self.llm, self.board = llm, board

    def run(self, req: dict, world) -> list[dict]:
        checks = [c for c in req.get("checks", []) if c["k"] == "warn"]  # keep Request Agent warnings
        valid = [o for o in req["plan"]["options"] if o["dt"] in compatible_types(req["comp"], req["type"])]
        removed = len(req["plan"]["options"]) - len(valid)
        if removed:
            world.stats["incompat"] += removed
            checks.append({"k": "warn", "t": f"Removed {removed} option(s) that failed the compatibility rule"})
        req["plan"]["options"] = valid
        checks.insert(0, {"k": "ok", "t": "Blood types checked against the compatibility rules"})
        def same_patient(r):
            if req.get("bed") and r.get("bed"):
                return r["bed"] == req["bed"] and r["units"] == req["units"]
            return r["units"] == req["units"] and (r.get("msg") or "") == (req.get("msg") or "")
        dup = next((r for r in world.requests if r is not req and r["hosp"] == req["hosp"] and r["type"] == req["type"]
                    and r["comp"] == req["comp"] and r["status"] not in ("rejected",) and same_patient(r)
                    and 0 <= req["created"] - r["created"] < 120), None)
        if dup:
            checks.append({"k": "warn", "t": f"Possible duplicate of {dup['id']} from the same ward"})
            req["dupOf"] = dup["id"]
            world.stats["dupes"] += 1
        if req["units"] > 6 and req["urg"] != "Critical":
            checks.append({"k": "warn", "t": "Larger than this ward usually asks for"})
        if req["pat"] in ("Child", "Maternity") or req["urg"] == "Critical":
            why = "child patient" if req["pat"] == "Child" else "maternity case" if req["pat"] == "Maternity" else "critical case"
            checks.append({"k": "info", "t": f"Priority raised: {why}"})
        if not valid:
            checks.append({"k": "warn", "t": "No bank can cover this from stock"})

        top = valid[0] if valid else None
        review = self.llm.json(
            self.name,
            "You audit blood-supply plans. Point out real risks only (e.g. implausible quantity, urgency mismatch, "
            "wrong component for the condition described). Keys: risk ('low','medium','high'), concerns (list of short strings, may be empty).",
            f"Request: {req['units']} x {req['type']} {COMP[req['comp']]}, urgency {req['urg']}, patient {req['pat']}. "
            f"Ward message: '{req.get('msg','')}'. Proposed: "
            + (f"{top['dt']} from {bank(top['bank'])['name']}, ETA {top['eta']} min, units expiring in {top['soon']} h." if top else "no stock; donor call."),
            ["risk", "concerns"], req["id"], world.clock, max_tokens=250)
        if review:
            for c in (review.get("concerns") or [])[:2]:
                checks.append({"k": "warn" if review.get("risk") == "high" else "info", "t": f"AI review: {str(c)[:120]}"})
        warns = sum(1 for c in checks if c["k"] == "warn")
        text = f"{warns} issue{'s' if warns != 1 else ''} flagged for the officer." if warns else "All checks passed."
        req["checks"] = checks
        self.board.post(req, self.name, "check", {"checks": checks, "risk": (review or {}).get("risk")},
                        "rules + model review" if review else "rules (model review unavailable)", 0.9, log_text=text)
        return checks
