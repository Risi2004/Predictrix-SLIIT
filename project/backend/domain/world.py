"""The simulated blood network (synthetic demo region).

`World` is the single source of truth: stock lots per bank, requests (cases),
deliveries, donor calls, transfer suggestions, the activity log and live metrics.
Agents read and write it through the Case Board; the React UI reads it via the API.
"""
from __future__ import annotations

import copy
import random
import threading
from typing import Callable

from .catalog import BANKS, COMP, HOSP, REGISTRY, TYPES, WEIGHTS, bank, compatible_types, hosp
from .roads import travel

CLOSED = ("delivered", "rejected")


class World:
    def __init__(self, seed: int = 20261120, scenario: str = "normal", seed_cases: bool = True):
        self.rng = random.Random(seed)
        self.lock = threading.RLock()
        self.clock = 130                      # minutes since midnight (02:10)
        self.live = True
        self.scenario = scenario
        self.stock: dict = {}
        self.requests: list[dict] = []        # newest first (UI order)
        self.deliveries: list[dict] = []
        self.campaigns: list[dict] = []
        self.moves: list[dict] = []
        self.dismissed: set[int] = set()
        self.log: list[dict] = []
        self.events: list[dict] = []
        self.event_seq = 0
        self.seq, self.dseq, self.cseq, self.lot_seq = 189, 40, 11, 0
        self.offline_banks: set[str] = set()  # used by the missing/late data scenario
        self.on_replan: Callable[[dict], None] | None = None
        self.stats = {"received": 0, "approvals": [], "delivered": 0, "deliveryMins": [], "nearSaved": 0,
                      "expired": 0, "incompat": 0, "donorCalls": 0, "unneeded": 0, "dupes": 0, "rejected": 0,
                      "llmCalls": 0, "fallbacks": 0, "tokens": 0, "costUsd": 0.0}
        self._seed_stock()
        self.compute_moves()

    # ------------------------------------------------------------------ stock
    def _seed_stock(self):
        r = self.rng
        for b in BANKS:
            self.stock[b["id"]] = {"RBC": {}, "PLT": {}}
            for t in TYPES:
                for c in ("RBC", "PLT"):
                    base = (150 if c == "RBC" else 30) * b["size"]
                    n = round(base * WEIGHTS[t] * (0.55 + r.random() * 0.9))
                    lots = []
                    while n > 0:
                        u = min(n, 2 + int(r.random() * 7))
                        n -= u
                        lots.append(self._lot(u, 20 + r.random() * 880 if c == "RBC" else 8 + r.random() * 110))
                    self.stock[b["id"]][c][t] = lots
        self.stock["b7"]["PLT"]["O+"].append(self._lot(3, 19))
        for l in self.stock["b2"]["PLT"]["O+"]:
            l["exp"] = max(l["exp"], 90)

    def _lot(self, u, exp):
        self.lot_seq += 1
        return {"id": self.lot_seq, "u": int(u), "exp": float(exp)}

    def lots(self, b, c, t):
        return self.stock.get(b, {}).get(c, {}).get(t, [])

    def total(self, b, c, t):
        return sum(l["u"] for l in self.lots(b, c, t))

    def net_total(self, c, t):
        return sum(self.total(b["id"], c, t) for b in BANKS)

    def all_lots(self):
        for b in BANKS:
            for c in ("RBC", "PLT"):
                for t in TYPES:
                    for l in self.lots(b["id"], c, t):
                        if l["u"] > 0:
                            yield b["id"], c, t, l

    # -------------------------------------------------------------- logging
    def add_log(self, req: dict | None, actor: str, text: str, t: int | None = None):
        t = self.clock if t is None else t
        self.log.insert(0, {"t": t, "actor": actor, "text": text, "ref": req["id"] if req else None})
        if req is not None:
            req["timeline"].append({"t": t, "actor": actor, "text": text})

    def event(self, kind: str, title: str, text: str, role: str = "officer"):
        self.event_seq += 1
        self.events.append({"id": self.event_seq, "kind": kind, "title": title, "text": text, "role": role})
        self.events = self.events[-60:]

    # ------------------------------------------------------------- requests
    def get(self, rid: str) -> dict | None:
        return next((r for r in self.requests if r["id"] == rid), None)

    def open_requests(self):
        return [r for r in self.requests if r["status"] not in CLOSED]

    def new_request(self, f: dict, source: str = "Ward message", created: int | None = None) -> dict:
        self.seq += 1
        r = {"id": f"R-{self.seq:04d}", "hosp": f.get("hosp", "h1"), "type": f.get("type"), "comp": f.get("comp", "RBC"),
             "units": int(f.get("units") or 0), "urg": f.get("urg", "Urgent"), "pat": f.get("pat", "Adult"),
             "msg": f.get("msg", ""), "source": source, "created": self.clock if created is None else created,
             "status": "received", "timeline": [], "plan": {"options": [], "offering": 0}, "checks": [], "choice": 0,
             "board": [], "confidence": None, "bed": f.get("bed"), "_truthDup": bool(f.get("_dup")),
             "unstated": [k for k in ("type", "comp", "units", "urg", "pat") if not f.get(k)]}
        if not r["units"]:
            r["units"] = 1
        self.requests.insert(0, r)
        self.stats["received"] += 1
        return r

    def choose(self, rid: str, idx: int):
        r = self.get(rid)
        if r and r["status"] == "awaiting" and 0 <= idx < len(r["plan"]["options"]):
            r["choice"] = idx

    def reject(self, rid: str, reason: str) -> bool:
        r = self.get(rid)
        if not r or r["status"] != "awaiting":
            return False
        r["status"] = "rejected"
        self.stats["rejected"] += 1
        self.add_log(r, "Officer", f"Rejected: {reason}.")
        self.event("", f"Request closed · {r['id']}", reason, "all")
        return True

    def approve(self, rid: str, approver: str = "Officer") -> str:
        """Officer approval gate. Returns 'dispatched', 'donors', 'stale' or 'invalid'."""
        r = self.get(rid)
        if not r or r["status"] != "awaiting":
            return "invalid"
        if not r["plan"]["options"]:
            dp = r.get("donorPlan") or {}
            contact = dp.get("contact", min(REGISTRY[r["type"]], r["units"] * 4))
            self.start_campaign(r["type"], r["comp"], r["units"], contact, req=r["id"], message=dp.get("message"))
            r["status"] = "donors"
            self.add_log(r, approver, f"Approved a donor call for {r['type']}.")
            return "donors"
        o = r["plan"]["options"][r["choice"]] if r["choice"] < len(r["plan"]["options"]) else r["plan"]["options"][0]
        src = sorted([l for l in self.lots(o["bank"], r["comp"], o["dt"]) if l["u"] > 0], key=lambda l: l["exp"])
        if sum(l["u"] for l in src) < r["units"]:
            self.event("", "Stock changed", f"The plan for {r['id']} is being refreshed.", "officer")
            return "stale"
        if o["dt"] not in compatible_types(r["comp"], r["type"]):   # hard safety rule
            self.stats["incompat"] += 1
            self.add_log(r, "Auditor Agent", "Blocked: plan failed the compatibility rule.")
            return "invalid"
        need = r["units"]
        for l in src:
            if need <= 0:
                break
            take = min(l["u"], need)
            l["u"] -= take
            need -= take
            if l["exp"] < 72:
                self.stats["nearSaved"] += take
        self.stats["approvals"].append(self.clock - r["created"])
        self.dseq += 1
        d = {"id": f"D-{self.dseq:03d}", "req": r["id"], "from": o["bank"], "toKind": "h", "to": r["hosp"],
             "units": r["units"], "type": o["dt"], "comp": r["comp"], "eta": o["eta"], "left": o["eta"],
             "rider": f"Rider {1 + int(self.rng.random() * 6)}", "start": self.clock}
        self.deliveries.insert(0, d)
        r.update(delivery=d["id"], status="enroute", source_bank=o["bank"])
        self.add_log(r, approver, f"Approved {r['units']} × {o['dt']} from {bank(o['bank'])['name']}.")
        self.add_log(r, "Logistics Agent", f"{d['rider']} dispatched. Arrives in {o['eta']} min.")
        self.event("ok", f"Dispatched · {r['id']}", f"{d['rider']} is on the way from {bank(o['bank'])['name']}. ETA {o['eta']} min.", "all")
        self.compute_moves()
        return "dispatched"

    # ------------------------------------------------------ transfers/moves
    def compute_moves(self):
        out = []
        for b in BANKS:
            for t in TYPES:
                for l in self.lots(b["id"], "RBC", t):
                    if l["u"] < 2 or l["exp"] > 96 or l["id"] in self.dismissed:
                        continue
                    best = None
                    for c in BANKS:
                        if c["id"] == b["id"]:
                            continue
                        tot = self.total(c["id"], "RBC", t)
                        if tot < 14 and (best is None or tot < best[1]):
                            best = (c["id"], tot)
                    if best:
                        out.append({"id": f"M{l['id']}", "lot": l, "from": b["id"], "to": best[0], "type": t,
                                    "units": l["u"], "exp": l["exp"], "tot": best[1]})
        self.moves = sorted(out, key=lambda m: m["exp"])[:5]

    def approve_move(self, mid: str) -> bool:
        m = next((x for x in self.moves if x["id"] == mid), None)
        if not m or m["lot"]["u"] < 1:
            return False
        units, exp = m["lot"]["u"], m["lot"]["exp"]
        m["lot"]["u"] = 0
        eta = travel(m["from"], m["to"])
        self.dseq += 1
        self.deliveries.insert(0, {"id": f"D-{self.dseq:03d}", "req": None, "from": m["from"], "toKind": "b", "to": m["to"],
                                   "units": units, "type": m["type"], "comp": "RBC", "eta": eta, "left": eta,
                                   "rider": f"Rider {1 + int(self.rng.random() * 6)}", "start": self.clock,
                                   "lot": {"u": units, "exp": exp}})
        self.stats["nearSaved"] += units
        self.add_log(None, "Officer", f"Approved moving {units} × {m['type']} from {bank(m['from'])['name']} to {bank(m['to'])['name']} before they expire.")
        self.event("ok", "Transfer approved", f"{units} × {m['type']} heading to {bank(m['to'])['name']}. ETA {eta} min.")
        self.compute_moves()
        return True

    def dismiss_move(self, mid: str) -> bool:
        m = next((x for x in self.moves if x["id"] == mid), None)
        if not m:
            return False
        self.dismissed.add(m["lot"]["id"])
        self.add_log(None, "Officer", f"Dismissed a suggested move of {m['units']} × {m['type']}.")
        self.compute_moves()
        return True

    # ------------------------------------------------------------- donors
    def start_campaign(self, typ, comp, units, contact, req=None, pending=False, warn=None, message=None) -> dict:
        self.cseq += 1
        c = {"id": f"C-{self.cseq:03d}", "type": typ, "comp": comp or "RBC", "units": int(units), "contact": int(contact),
             "confirmed": 0, "status": "awaiting" if pending else "calling", "req": req, "created": self.clock,
             "warn": warn, "message": message}
        self.campaigns.insert(0, c)
        if pending:
            self.add_log(None, "Donor Agent", f"Prepared donor call {c['id']} for {typ}. Waiting for approval.")
        else:
            self.stats["donorCalls"] += 1
            self.add_log(None, "Donor Agent", f"Contacting {c['contact']} eligible {typ} donors ({c['id']}).")
            self.event("ok", "Donor call started", f"{c['contact']} {typ} donors are being contacted.")
        return c

    def approve_campaign(self, cid: str) -> bool:
        c = next((x for x in self.campaigns if x["id"] == cid), None)
        if not c or c["status"] != "awaiting":
            return False
        c["status"] = "calling"
        self.stats["donorCalls"] += 1
        if c.get("warn"):
            self.stats["unneeded"] += 1
        self.add_log(None, "Officer", f"Approved donor call {c['id']}.")
        self.add_log(None, "Donor Agent", f"Contacting {c['contact']} eligible {c['type']} donors.")
        self.event("ok", "Donor call started", f"{c['contact']} {c['type']} donors are being contacted.")
        return True

    def cancel_campaign(self, cid: str) -> bool:
        c = next((x for x in self.campaigns if x["id"] == cid), None)
        if not c:
            return False
        self.campaigns.remove(c)
        self.add_log(None, "Officer", f"Cancelled donor call {c['id']}.")
        return True

    # --------------------------------------------------------------- clock
    def tick(self):
        self.clock += 1
        for b in BANKS:
            for c in ("RBC", "PLT"):
                for t in TYPES:
                    keep = []
                    for l in self.lots(b["id"], c, t):
                        l["exp"] -= 1 / 60
                        if l["exp"] <= 0 and l["u"] > 0:
                            self.stats["expired"] += l["u"]
                            self.add_log(None, "Bank Agents", f"{l['u']} × {t} {COMP[c].lower()} expired at {b['name']}.")
                            l["u"] = 0
                        if l["u"] > 0 or l["exp"] > 0:
                            keep.append(l)
                    self.stock[b["id"]][c][t] = keep
        for d in self.deliveries:
            if d["left"] <= 0:
                continue
            d["left"] -= 1
            if d["left"] > 0:
                continue
            if d["toKind"] == "h":
                r = self.get(d["req"])
                if r:
                    r.update(status="delivered", deliveredAt=self.clock)
                    self.stats["delivered"] += 1
                    self.stats["deliveryMins"].append(d["eta"])
                    self.add_log(r, "Logistics Agent", f"{d['units']} × {d['type']} delivered to {hosp(d['to'])['short']}.")
                    self.event("ok", f"Delivered · {r['id']}", f"{d['units']} units reached {hosp(d['to'])['name']}.", "all")
            else:
                self.lots(d["to"], "RBC", d["type"]).append(self._lot(d["lot"]["u"], d["lot"]["exp"]))
                self.add_log(None, "Logistics Agent", f"{d['units']} × {d['type']} arrived at {bank(d['to'])['name']}.")
                self.compute_moves()
        for c in self.campaigns:
            if c["status"] != "calling":
                continue
            if self.rng.random() < 0.5:
                c["confirmed"] += 1
            if c["confirmed"] >= c["units"]:
                c["status"] = "complete"
                self.lots("b1", c["comp"], c["type"]).append(self._lot(c["units"], 840 if c["comp"] == "RBC" else 120))
                self.add_log(None, "Donor Agent", f"{c['units']} {c['type']} donors confirmed and collected at Central ({c['id']}).")
                self.event("ok", "Donors came through", f"{c['units']} units of {c['type']} added at Central.")
                r = self.get(c["req"]) if c["req"] else None
                if r and r["status"] == "donors":
                    r["donorPlan"] = None
                    if self.on_replan:
                        self.on_replan(r)
        if self.clock % 30 == 0:
            self.compute_moves()

    # ------------------------------------------------------ scenario feed
    def generate_request_fields(self) -> dict:
        r, sc = self.rng, self.scenario
        open_reqs = self.open_requests()
        if open_reqs and r.random() < (0.3 if sc == "duplicates" else 0.1):
            o = open_reqs[int(r.random() * len(open_reqs))]
            f = {k: o.get(k) for k in ("hosp", "type", "comp", "units", "urg", "pat", "bed")}
            f["_dup"] = True
        else:
            x, acc, typ = r.random(), 0.0, "O+"
            for t in TYPES:
                acc += WEIGHTS[t]
                if x < acc:
                    typ = t
                    break
            h = HOSP[int(r.random() * len(HOSP))]
            comp = "PLT" if r.random() < (0.7 if sc == "dengue" else 0.25) else "RBC"
            urg = "Critical" if r.random() < (0.2 if sc in ("normal", "stockout", "duplicates", "missing") else 0.5) else ("Urgent" if r.random() < 0.5 else "Routine")
            pat = "Child" if h["id"] == "h1" else "Maternity" if h["id"] == "h2" else ("Child" if r.random() < 0.2 else "Adult")
            f = {"hosp": h["id"], "type": typ, "comp": comp, "units": 1 + int(r.random() * (2 if comp == "PLT" else 4)), "urg": urg, "pat": pat}
            if sc == "accident" and r.random() < 0.75:
                f = {"hosp": "h3", "type": "O-" if r.random() < 0.5 else "O+", "comp": "RBC", "units": 2 + int(r.random() * 4), "urg": "Critical", "pat": "Adult"}
            if sc == "duplicates" and r.random() < 0.25:
                f["units"] = 8 + int(r.random() * 4)
                f["urg"] = "Routine"
        f.setdefault("bed", f"Bed {1 + int(r.random() * 400)}")
        when = "needs it now" if f["urg"] == "Critical" else "needed within the hour" if f["urg"] == "Urgent" else "for tomorrow morning"
        who = "Child" if f["pat"] == "Child" else "Mother after delivery" if f["pat"] == "Maternity" else "Patient"
        comp_word = "platelets" if f["comp"] == "PLT" else "red cells"
        f["msg"] = f"{f['bed']}: {who}, {when}. {f['units']} units {f['type']} {comp_word}."
        if sc == "missing" and r.random() < 0.35:   # messy / incomplete messages
            f["msg"] = r.choice([f"{who} {when}, need {f['type'].replace('+', ' pos').replace('-', ' neg')} {comp_word} x{f['units']}",
                                 f"pls send {f['units']} bags {f['type']} asap",
                                 f"{who}, {comp_word} needed, group {f['type']}"])
        return f

    # ------------------------------------------------------------ snapshot
    def snapshot(self, since: int = 0) -> dict:
        with self.lock:
            moves = [dict(m, lot=dict(m["lot"])) for m in self.moves]
            return copy.deepcopy({
                "clock": self.clock, "live": self.live, "scenario": self.scenario, "stock": self.stock,
                "requests": self.requests, "deliveries": self.deliveries, "campaigns": self.campaigns,
                "moves": moves, "log": self.log[:300], "stats": self.stats, "seq": self.seq,
                "events": [e for e in self.events if e["id"] > since], "eventSeq": self.event_seq,
            })
