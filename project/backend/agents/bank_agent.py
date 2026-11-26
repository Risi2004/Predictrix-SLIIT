"""Blood Bank Agents — one per bank. Each sees ONLY its own bank's stock.

Each agent makes its own decision for every request:
  * keeps a SAFETY RESERVE for its own area (scaled by bank size and blood-type frequency);
  * offers near-expiry units first (they would otherwise be wasted, so they never count toward the reserve);
  * declines with a reason, or COUNTER-OFFERS fewer units when it can only spare part of the need;
  * when a CRITICAL request would breach its reserve, it weighs the trade-off (language model, rule fallback);
  * in a second round (no bank could cover an URGENT request) the Orchestrator asks again and banks reconsider.
"""
from __future__ import annotations

from ..domain.catalog import WEIGHTS, bank, compatible_types
from ..domain.roads import travel


class AccessDenied(PermissionError):
    pass


class BankAgent:
    def __init__(self, bank_id: str, world, llm, board):
        self.bank_id = bank_id
        self.name = f"Bank Agent · {bank(bank_id)['name']}"
        self._world, self.llm, self.board = world, llm, board

    # ---- least privilege: the only stock this agent can ever read is its own
    def _my_stock(self, comp: str, dtype: str) -> list[dict]:
        return self._world.lots(self.bank_id, comp, dtype)

    def read_stock(self, bank_id: str, comp: str, dtype: str) -> list[dict]:
        if bank_id != self.bank_id:
            raise AccessDenied(f"{self.name} may not read {bank_id}'s stock")
        return self._my_stock(comp, dtype)

    def reserve(self, comp: str, dtype: str) -> int:
        size = bank(self.bank_id)["size"]
        if comp == "RBC":
            return max(1, round(6 * size * WEIGHTS[dtype] / 0.34))
        return 1 if WEIGHTS[dtype] >= 0.2 else 0

    def decide(self, req: dict, escalate: bool = False) -> list[dict]:
        """Return offers (possibly empty). Each offer: bank, dt, avail, eta, soon, kind, note."""
        if self.bank_id in self._world.offline_banks:
            self.board.post(req, self.name, "timeout", {"bank": self.bank_id}, "stock feed late; no reply in time", 0.0)
            return []
        eta = travel(self.bank_id, req["hosp"])
        offers = []
        for dt in compatible_types(req["comp"], req["type"]):
            usable = [l for l in self._my_stock(req["comp"], dt) if l["u"] > 0 and l["exp"] * 60 > eta + 90]
            avail = sum(l["u"] for l in usable)
            if not avail:
                continue
            near = sum(l["u"] for l in usable if l["exp"] < 72)
            spare = max(near, avail - self.reserve(req["comp"], dt))
            soon = min(l["exp"] for l in usable)
            base = {"bank": self.bank_id, "dt": dt, "eta": eta, "soon": round(soon, 1)}
            if spare >= req["units"]:
                offers.append({**base, "avail": avail, "kind": "full", "note": "within spare stock"})
            elif avail >= req["units"] and (req["urg"] == "Critical" or (escalate and req["urg"] == "Urgent")):
                ok, why = self._critical_tradeoff(req, dt, avail, spare)
                if ok:
                    offers.append({**base, "avail": avail, "kind": "reserve", "note": why})
                else:
                    self.board.post(req, self.name, "decline", {**base, "avail": avail}, why, 0.7)
            elif spare > 0:
                self.board.post(req, self.name, "counter_offer", {**base, "avail": spare},
                                f"can spare {spare} of {req['units']} without breaching its reserve", 0.8)
            else:
                self.board.post(req, self.name, "decline", {**base, "avail": avail},
                                f"holding {avail} {dt} as its safety reserve", 0.8)
        for o in offers:
            self.board.post(req, self.name, "offer", o, o["note"], 0.9)
        return offers

    def _critical_tradeoff(self, req, dt, avail, spare) -> tuple[bool, str]:
        reserve = self.reserve(req["comp"], dt)
        prompt = (f"You manage {bank(self.bank_id)['name']} blood bank. A CRITICAL request needs {req['units']} units of "
                  f"{dt} {'platelets' if req['comp']=='PLT' else 'red cells'} for a {req['pat'].lower()} patient. You hold "
                  f"{avail}; your safety reserve for local emergencies is {reserve}; giving them leaves {avail-req['units']}. "
                  "Decide whether to release reserve stock. Keys: release (true/false), reason (one short sentence).")
        out = self.llm.json(self.name, "You are a blood bank agent protecting both this patient and your own area.",
                            prompt, ["release", "reason"], req["id"], self._world.clock, small=True, max_tokens=150)
        if out is not None:
            return bool(out.get("release")), str(out.get("reason", ""))[:160] or "reserve released for a critical case"
        # rule fallback: critical child/maternity always; other critical only if reserve stays >= 1
        ok = req["pat"] in ("Child", "Maternity") or req["urg"] == "Critical" or (avail - req["units"]) >= 1
        return ok, ("reserve released: critical " + req["pat"].lower() + " case (rule)") if ok else "would empty the bank (rule)"
