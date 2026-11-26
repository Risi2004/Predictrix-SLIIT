"""Language-model client (OpenRouter, OpenAI-compatible API).

Reliability rules applied to EVERY call:
  * time limit (SERA_LLM_TIMEOUT) and retries with back-off (SERA_LLM_RETRIES)
  * the reply must be a JSON object containing the required keys, otherwise it is rejected
  * on any failure the caller receives None and uses its rule-based fallback (logged)
  * tokens, cost and latency are recorded in the trace and the live metrics
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request

from .. import config


class LLM:
    def __init__(self, tracer, stats: dict | None = None, enabled: bool | None = None):
        self.tracer = tracer
        self.stats = stats if stats is not None else {}
        self.enabled = (bool(config.OPENROUTER_API_KEY) and not config.LLM_DISABLED) if enabled is None else enabled

    def _post(self, body: dict) -> dict:
        req = urllib.request.Request(
            config.OPENROUTER_URL, data=json.dumps(body).encode(), method="POST",
            headers={"Authorization": f"Bearer {config.OPENROUTER_API_KEY}", "Content-Type": "application/json",
                     "HTTP-Referer": "https://github.com/Risi2004/Predictrix-SLIIT", "X-Title": "SERA"})
        with urllib.request.urlopen(req, timeout=config.LLM_TIMEOUT_S) as resp:
            return json.loads(resp.read().decode())

    @staticmethod
    def _extract_json(text: str) -> dict | None:
        text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()
        m = re.search(r"\{.*\}", text, flags=re.S)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None

    def json(self, agent: str, system: str, user: str, required: list[str], case_id=None, sim_minute=None,
             small: bool = False, max_tokens: int = 500) -> dict | None:
        model = config.MODEL_SMALL if small else config.MODEL
        if not self.enabled:
            self.tracer.emit(agent, "llm.skipped", case_id, sim_minute, {"reason": "LLM disabled or no API key"}, model, fallback=True)
            self.stats["fallbacks"] = self.stats.get("fallbacks", 0) + 1
            return None
        body = {"model": model, "temperature": 0.1, "max_tokens": max(max_tokens, 1500), "reasoning": {"effort": "low", "exclude": True}, "provider": {"require_parameters": True}, "usage": {"include": True},
                "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": system + "\nReply with ONE JSON object only."},
                             {"role": "user", "content": user}]}
        last_err = None
        for attempt in range(config.LLM_RETRIES + 1):
            t0 = time.perf_counter()
            try:
                data = self._post(body)
                ms = int((time.perf_counter() - t0) * 1000)
                usage = data.get("usage") or {}
                content = data["choices"][0]["message"].get("content") or ""
                obj = self._extract_json(content)
                tin, tout = int(usage.get("prompt_tokens", 0)), int(usage.get("completion_tokens", 0))
                cost = float(usage.get("cost", 0) or 0)
                self.stats["llmCalls"] = self.stats.get("llmCalls", 0) + 1
                self.stats["tokens"] = self.stats.get("tokens", 0) + tin + tout
                self.stats["costUsd"] = round(self.stats.get("costUsd", 0.0) + cost, 6)
                if obj is None or any(k not in obj for k in required):
                    last_err = f"invalid output (needs {required})"
                    self.tracer.emit(agent, "llm.invalid", case_id, sim_minute, {"attempt": attempt, "content": content[:300]},
                                     model, tin, tout, cost, ms)
                    body["messages"].append({"role": "user", "content": f"Invalid. Return JSON with keys {required}."})
                    continue
                self.tracer.emit(agent, "llm.ok", case_id, sim_minute, {"attempt": attempt, "output": obj}, model, tin, tout, cost, ms)
                return obj
            except (urllib.error.URLError, TimeoutError, KeyError, ValueError, OSError) as exc:
                last_err = str(exc)
                self.tracer.emit(agent, "llm.error", case_id, sim_minute, {"attempt": attempt, "error": last_err[:300]}, model,
                                 latency_ms=int((time.perf_counter() - t0) * 1000))
                time.sleep(min(4, 0.8 * (2 ** attempt)))
        self.stats["fallbacks"] = self.stats.get("fallbacks", 0) + 1
        self.tracer.emit(agent, "llm.fallback", case_id, sim_minute, {"error": last_err}, model, fallback=True)
        return None
