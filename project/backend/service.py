"""Runs the live system: world clock, scenario request feed and the agent workflow per case."""
from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor

from . import config
from .agents.orchestrator import Orchestrator
from .domain.catalog import BANKS
from .domain.world import World
from .trace import Tracer

FEED_SECONDS = {"normal": 30, "dengue": 16, "accident": 10, "stockout": 25, "duplicates": 20, "missing": 22}


class SeraService:
    def __init__(self, seed: int = 20261120, step_delay: float | None = None, seed_cases: bool = True):
        self.world = World(seed=seed)
        self.tracer = Tracer()
        self.orch = Orchestrator(self.world, self.tracer, step_delay=config.STEP_DELAY_S if step_delay is None else step_delay)
        self.world.on_replan = lambda r: self.submit_existing(r["id"])
        self.cases = ThreadPoolExecutor(max_workers=4)
        self._stop = threading.Event()
        self._next_feed = time.time() + FEED_SECONDS["normal"]
        self.feed_enabled = config.AUTO_FEED
        if seed_cases:
            self._seed_cases()
        if config.REAL_CLOCK:
            self._sync_clock()

    # ------------------------------------------------------------ seeding
    def _seed_cases(self):
        """Same starting picture as the design prototype: one delivered, one en route, two waiting."""
        w, o = self.world, Orchestrator(self.world, self.tracer, step_delay=0)
        o.llm.enabled = False  # seed instantly with the rule paths (logged as fallbacks)
        r0 = w.new_request({"hosp": "h4", "type": "B+", "comp": "RBC", "units": 4, "urg": "Routine", "pat": "Adult",
                            "msg": "Planned surgery tomorrow 8am. 4 units B+."}, created=w.clock - 70)
        o.run_case(r0["id"])
        if w.approve(r0["id"]) == "dispatched":
            d = w.deliveries[0]
            for _ in range(d["left"]):
                d["left"] -= 1
            r0.update(status="delivered", deliveredAt=w.clock - 55)
            w.stats["delivered"] += 1
            w.stats["deliveryMins"].append(d["eta"])
            w.add_log(r0, "Logistics Agent", "Delivered to City General.", w.clock - 55)
        r1 = w.new_request({"hosp": "h3", "type": "A+", "comp": "RBC", "units": 2, "urg": "Urgent", "pat": "Adult",
                            "msg": "Road accident patient stable, need 2 A+ within the hour."}, created=w.clock - 14)
        o.run_case(r1["id"])
        if w.approve(r1["id"]) == "dispatched":
            w.deliveries[0]["left"] = max(1, int(w.deliveries[0]["eta"] * 0.6))
        for f, ago in (({"hosp": "h2", "type": "O-", "comp": "RBC", "units": 3, "urg": "Urgent", "pat": "Maternity",
                         "msg": "Postpartum bleeding, mother stable for now. 3 units O- please."}, 4),
                       ({"hosp": "h1", "type": "O+", "comp": "PLT", "units": 2, "urg": "Critical", "pat": "Child",
                         "msg": "Child, 7 years, severe dengue, platelets dropping fast. Need 2 units O+."}, 0)):
            r = w.new_request(f, created=w.clock - ago)
            o.run_case(r["id"])
        w.events.clear()
        w.stats.update(llmCalls=0, fallbacks=0, tokens=0, costUsd=0.0)  # seeding uses rule paths; don't count it

    def _sync_clock(self):
        """Shift the simulated clock (and all past timestamps) so 'now' equals the PC's local time."""
        from datetime import datetime
        now = datetime.now()
        shift = (now.hour * 60 + now.minute) - self.world.clock
        w = self.world
        w.clock += shift
        for r in w.requests:
            r["created"] += shift
            if r.get("deliveredAt") is not None:
                r["deliveredAt"] += shift
            for t in r["timeline"]:
                t["t"] += shift
        for e in w.log:
            e["t"] += shift
        for d in w.deliveries:
            d["start"] += shift
        for c in w.campaigns:
            c["created"] += shift

    # ------------------------------------------------------------- intake
    def submit(self, fields: dict, source: str) -> dict:
        with self.world.lock:
            r = self.world.new_request(fields, source)
            if source == "Ward form":
                self.world.add_log(r, "Hospital", "Ward 4B sent the request.")
        self.cases.submit(self.orch.run_case, r["id"])
        return r

    def submit_existing(self, rid: str):
        self.cases.submit(self.orch.run_case, rid)

    def set_scenario(self, scenario: str):
        with self.world.lock:
            self.world.scenario = scenario
            self.world.offline_banks = {"b5"} if scenario == "missing" else set()
            if scenario == "stockout":
                for c in ("RBC", "PLT"):
                    for t, lots in self.world.stock["b1"][c].items():
                        for l in lots:
                            l["u"] = 0
                self.world.add_log(None, "Bank Agents", "Central reports a stock-out (scenario).")
            self._next_feed = time.time() + 3
        self.tracer.emit("System", "scenario.changed", payload={"scenario": scenario})

    # --------------------------------------------------------------- loop
    def _loop(self):
        while not self._stop.is_set():
            time.sleep(config.TICK_SECONDS)
            if not self.world.live:
                continue
            with self.world.lock:
                self.world.tick()
            if self.feed_enabled and time.time() >= self._next_feed:
                self._next_feed = time.time() + FEED_SECONDS.get(self.world.scenario, 30)
                with self.world.lock:
                    f = self.world.generate_request_fields()
                if self.world.scenario == "missing" and self.world.rng.random() < 0.35:
                    for k in ("comp", "units"):
                        f.pop(k, None)   # incomplete structured fields: the Request Agent must read the message
                self.submit(f, "Ward message")

    def start(self):
        threading.Thread(target=self._loop, daemon=True, name="sera-clock").start()

    def stop(self):
        self._stop.set()


def bank_names():
    return {b["id"]: b["name"] for b in BANKS}
