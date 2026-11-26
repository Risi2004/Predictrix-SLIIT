"""Settings, read from environment variables / project/.env (never commit .env)."""
from __future__ import annotations

import os
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_DIR / "outputs"


def _load_dotenv():
    env = PROJECT_DIR / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = os.getenv("OPENROUTER_URL", "https://openrouter.ai/api/v1/chat/completions")
MODEL = os.getenv("SERA_MODEL", "qwen/qwen3.8-27b")             # main reasoning model (see .env.example)
MODEL_SMALL = os.getenv("SERA_MODEL_SMALL", MODEL)              # routine steps
LLM_TIMEOUT_S = float(os.getenv("SERA_LLM_TIMEOUT", "25"))
LLM_RETRIES = int(os.getenv("SERA_LLM_RETRIES", "2"))
LLM_DISABLED = os.getenv("SERA_NO_LLM", "0") == "1"
DATABASE_URL = os.getenv("DATABASE_URL", "")                    # postgresql://user:pass@localhost:5432/sera
STEP_DELAY_S = float(os.getenv("SERA_STEP_DELAY", "0.7"))       # visible pacing of agent steps in the UI
REAL_CLOCK = os.getenv("SERA_REAL_CLOCK", "0") == "1"          # 1 = clock shows your PC's time and runs in real time
TICK_SECONDS = 60.0 if REAL_CLOCK else float(os.getenv("SERA_TICK_SECONDS", "1.3"))  # seconds per simulated minute
AUTO_FEED = os.getenv("SERA_AUTO_FEED", "1") == "1"            # 0 = no automatic hospital requests (only real ones)
CORS_ORIGINS = os.getenv("SERA_CORS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
