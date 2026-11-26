import os
import sys
from pathlib import Path

os.environ.setdefault("SERA_NO_LLM", "1")      # tests never call a paid model
os.environ.setdefault("SERA_STEP_DELAY", "0")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
