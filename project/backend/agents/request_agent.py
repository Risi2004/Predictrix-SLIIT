"""Request Agent — turns a ward's free-text message into a clear, structured need."""
from __future__ import annotations

import re

from ..domain.catalog import COMP, TYPES

FIELDS = ("type", "comp", "units", "urg", "pat")

SYSTEM = (
    "You are the Request Agent in a blood-supply coordination system. Read a hospital ward's message and "
    "extract the need. Keys: type (one of O+,O-,A+,A-,B+,B-,AB+,AB- or null), comp ('RBC' for red cells/blood, "
    "'PLT' for platelets, or null), units (integer or null), urg ('Critical','Urgent' or 'Routine'), "
    "pat ('Child','Adult' or 'Maternity'), confidence (0-1), missing (list of fields you could not find). "
    "Never guess a blood type that is not written."
)


def rule_parse(msg: str) -> dict:
    """Deterministic fallback parser (also used to cross-check the model)."""
    s, f = (msg or "").lower(), {}
    t = re.search(r"\b(ab|a|b|o)\s*(\+|-|−|pos(?:itive)?|neg(?:ative)?|ve\+|ve-)", msg or "", re.I)
    if t:
        sign = "+" if re.match(r"\+|pos|ve\+", t.group(2), re.I) else "-"
        f["type"] = t.group(1).upper() + sign
    u = re.search(r"(\d+)\s*(units?|bags?|pints?|packs?)", s) or re.search(r"\bx\s*(\d+)\b", s) or re.search(r"need\s*(\d+)", s)
    if u:
        f["units"] = min(12, int(u.group(1)))
    if re.search(r"platelet|\bplt\b", s):
        f["comp"] = "PLT"
    elif re.search(r"red cell|rbc|blood|packed|bags?", s):
        f["comp"] = "RBC"
    if re.search(r"critical|now|immediately|stat\b|dropping|bleeding|emergency|asap", s):
        f["urg"] = "Critical" if not re.search(r"asap", s) else "Urgent"
    elif re.search(r"urgent|within the hour|soon", s):
        f["urg"] = "Urgent"
    elif re.search(r"routine|tomorrow|planned|scheduled", s):
        f["urg"] = "Routine"
    if re.search(r"child|year|baby|infant|paediatric|pediatric|kid", s):
        f["pat"] = "Child"
    elif re.search(r"mother|pregnan|deliver|maternity|postpartum", s):
        f["pat"] = "Maternity"
    elif re.search(r"adult|man|woman|patient", s):
        f["pat"] = "Adult"
    return f


class RequestAgent:
    name = "Request Agent"

    def __init__(self, llm, board):
        self.llm, self.board = llm, board

    def parse(self, msg: str, case_id=None, sim_minute=None) -> tuple[dict, float, bool]:
        """Returns (fields, confidence, used_fallback)."""
        out = self.llm.json(self.name, SYSTEM, f"Message: {msg}", ["type", "comp", "units", "urg", "pat"],
                            case_id, sim_minute, small=True, max_tokens=250)
        if out:
            f = {}
            if out.get("type") in TYPES:
                f["type"] = out["type"]
            if out.get("comp") in COMP:
                f["comp"] = out["comp"]
            try:
                if out.get("units") is not None and 0 < int(out["units"]) <= 20:
                    f["units"] = int(out["units"])
            except (TypeError, ValueError):
                pass
            if out.get("urg") in ("Critical", "Urgent", "Routine"):
                f["urg"] = out["urg"]
            if out.get("pat") in ("Child", "Adult", "Maternity"):
                f["pat"] = out["pat"]
            # guard: the model may not invent a blood type that the text does not contain
            rp = rule_parse(msg)
            if "type" in f and "type" not in rp and not re.search(re.escape(f["type"][:-1]), msg or "", re.I):
                f.pop("type")
            try:
                conf = float(out.get("confidence", 0.8))
            except (TypeError, ValueError):
                conf = 0.6
            return f, max(0.0, min(1.0, conf)), False
        f = rule_parse(msg)
        return f, 0.55 + 0.08 * len(f), True

    def run(self, req: dict, world) -> None:
        unstated = set(req.get("unstated", []))
        given = {k: req.get(k) for k in FIELDS if k not in unstated and req.get(k) not in (None, "", 0)}
        parsed, conf, fb = ({}, 1.0, False)
        if req.get("msg"):
            parsed, conf, fb = self.parse(req["msg"], req["id"], world.clock)
        mismatches = [k for k in ("type", "comp") if k in given and k in parsed and given[k] != parsed[k]]
        need = {**parsed, **given}                     # the ward's form fields win over parsing
        missing = [k for k in FIELDS if not need.get(k)]
        if missing and "type" not in missing:
            pass
        defaults = {"comp": "RBC", "units": 1, "urg": "Urgent", "pat": "Adult"}
        with world.lock:
            for k in missing:
                if k in defaults:
                    need[k] = defaults[k]
            for k in FIELDS:
                if need.get(k):
                    req[k] = need[k]
            req["confidence"] = round(conf if not missing else conf * 0.7, 2)
            for k in mismatches:
                req.setdefault("checks", []).append({"k": "warn", "t": f"Message says {parsed[k]} but the form says {given[k]} ({k}); please confirm"})
            if missing:
                req.setdefault("checks", []).append({"k": "warn", "t": "Ward to confirm: " + ", ".join(missing) + " not stated, assumed defaults"})
        text = (f"Read the request: {req['units']} × {req['type'] or '?'} {COMP[req['comp']].lower()}, {req['urg'].lower()}"
                f" (confidence {req['confidence']:.2f}{', rule parser' if fb else ''}).")
        self.board.post(req, self.name, "need", {k: req.get(k) for k in FIELDS}, evidence=req.get("msg", "")[:200],
                        confidence=req["confidence"], log_text=text)
