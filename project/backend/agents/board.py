"""The Case Board: the shared state agents use to communicate.

Agents never call each other. Each posts structured entries (need, offer,
decline, route, check, proposal) with evidence and a confidence score to the
case's board, and reads what the others posted. Every post is also traced.
"""
from __future__ import annotations


class CaseBoard:
    def __init__(self, world, tracer):
        self.world = world
        self.tracer = tracer

    def post(self, req: dict, agent: str, kind: str, data: dict, evidence: str = "", confidence: float | None = None,
             log_text: str | None = None, model=None):
        entry = {"t": self.world.clock, "agent": agent, "kind": kind, "data": data,
                 "evidence": evidence, "confidence": confidence}
        with self.world.lock:
            req.setdefault("board", []).append(entry)
            if log_text:
                self.world.add_log(req, agent, log_text)
        self.tracer.emit(agent, f"board.{kind}", req["id"], self.world.clock,
                         {"data": data, "evidence": evidence, "confidence": confidence}, model)
        return entry

    @staticmethod
    def read(req: dict, kind: str | None = None, agent: str | None = None) -> list[dict]:
        return [e for e in req.get("board", []) if (kind is None or e["kind"] == kind) and (agent is None or e["agent"] == agent)]
