"""Execution trace: one JSON line per agent step (actor, decision, evidence, model, cost, time).

Written to project/outputs/traces/<run_id>.jsonl and to the database (storage.py).
`python main.py replay --run <run_id> --case R-0193` prints a case step by step.
"""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone

from .config import OUTPUT_DIR


class Tracer:
    def __init__(self, run_id: str | None = None, persist: bool = True):
        self.run_id = run_id or datetime.now().strftime("run-%Y%m%d-%H%M%S")
        self.dir = OUTPUT_DIR / "traces"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.path = self.dir / f"{self.run_id}.jsonl"
        self._lock = threading.Lock()
        self.persist = persist
        self.events: list[dict] = []

    def emit(self, actor: str, event: str, case_id: str | None = None, sim_minute: int | None = None,
             payload=None, model=None, tokens_in=0, tokens_out=0, cost_usd=0.0, latency_ms=0, fallback=False):
        e = {"run_id": self.run_id, "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
             "sim_minute": sim_minute, "case_id": case_id, "actor": actor, "event": event, "payload": payload,
             "model": model, "tokens_in": tokens_in, "tokens_out": tokens_out, "cost_usd": round(cost_usd, 6),
             "latency_ms": latency_ms, "fallback": fallback}
        with self._lock:
            self.events.append(e)
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(e, default=str) + "\n")
        if self.persist:
            try:
                from .storage import store
                store().add_trace(e)
            except Exception as exc:  # tracing must never break the case
                print(f"[trace] db write failed: {exc}")
        return e


class Timer:
    def __enter__(self):
        self.t0 = time.perf_counter()
        return self

    def __exit__(self, *a):
        self.ms = int((time.perf_counter() - self.t0) * 1000)


def replay(run_id: str, case_id: str | None = None) -> list[dict]:
    path = OUTPUT_DIR / "traces" / f"{run_id}.jsonl"
    rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    return [r for r in rows if case_id is None or r.get("case_id") == case_id]
