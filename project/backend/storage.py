"""Persistence for trace events, closed cases and benchmark results.

Uses PostgreSQL when DATABASE_URL is set (psycopg 3); otherwise a local SQLite
file at project/outputs/sera.db so the project runs with zero setup.
"""
from __future__ import annotations

import json
import sqlite3
import threading

from .config import DATABASE_URL, OUTPUT_DIR

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS trace_events (
        run_id TEXT, ts TEXT, sim_minute INTEGER, case_id TEXT, actor TEXT, event TEXT,
        payload TEXT, model TEXT, tokens_in INTEGER, tokens_out INTEGER, cost_usd REAL,
        latency_ms INTEGER, fallback INTEGER)""",
    """CREATE TABLE IF NOT EXISTS benchmark_results (
        run_id TEXT, contestant TEXT, scenario TEXT, seed INTEGER, repeat INTEGER, metrics TEXT)""",
]


class Store:
    def __init__(self):
        self._lock = threading.Lock()
        self.kind = "sqlite"
        if DATABASE_URL.startswith("postgres"):
            try:
                import psycopg  # type: ignore
                self.conn = psycopg.connect(DATABASE_URL, autocommit=True)
                self.kind, self.ph = "postgresql", "%s"
            except Exception as exc:  # fall back but say so
                print(f"[storage] PostgreSQL unavailable ({exc}); using SQLite.")
        if self.kind == "sqlite":
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            self.conn = sqlite3.connect(OUTPUT_DIR / "sera.db", check_same_thread=False, isolation_level=None)
            self.ph = "?"
        for stmt in SCHEMA:
            self._exec(stmt)

    def _exec(self, sql, params=()):
        with self._lock:
            cur = self.conn.cursor()
            cur.execute(sql, params)
            return cur

    def add_trace(self, e: dict):
        cols = ["run_id", "ts", "sim_minute", "case_id", "actor", "event", "payload", "model",
                "tokens_in", "tokens_out", "cost_usd", "latency_ms", "fallback"]
        row = [e.get(c) for c in cols]
        row[6] = json.dumps(e.get("payload"), default=str)
        row[12] = int(bool(e.get("fallback")))
        self._exec(f"INSERT INTO trace_events ({','.join(cols)}) VALUES ({','.join([self.ph] * len(cols))})", row)

    def add_result(self, run_id, contestant, scenario, seed, repeat, metrics: dict):
        self._exec(f"INSERT INTO benchmark_results VALUES ({','.join([self.ph] * 6)})",
                   (run_id, contestant, scenario, seed, repeat, json.dumps(metrics)))


_store = None


def store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store
