"""SERA — single entry point.

  python main.py serve                 # start the API + agents (then: cd frontend && npm run dev)
  python main.py simulate --minutes 60 # run the live system headless and print the activity log
  python main.py benchmark             # A vs B vs C vs reference on all 6 scenarios
  python main.py replay --run <run_id> [--case R-0193]
  python main.py fetch-map             # one-time: download Colombo roads from OpenStreetMap (needs osmnx)
  python main.py test                  # run the test suite
"""
from __future__ import annotations

import argparse
from pathlib import Path
import sys
import time


def main(argv=None):
    p = argparse.ArgumentParser(description="SERA blood network coordination (Predictrix)")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("serve"); s.add_argument("--host", default="127.0.0.1"); s.add_argument("--port", type=int, default=8000)
    s = sub.add_parser("simulate"); s.add_argument("--minutes", type=int, default=60); s.add_argument("--scenario", default="normal")
    b = sub.add_parser("benchmark")
    b.add_argument("--scenarios", default="all", help="comma list or 'all'")
    b.add_argument("--seeds", type=int, default=2); b.add_argument("--repeats", type=int, default=1)
    b.add_argument("--contestants", default="ABC"); b.add_argument("--no-llm", action="store_true")
    r = sub.add_parser("replay"); r.add_argument("--run", required=True); r.add_argument("--case")
    sub.add_parser("fetch-map"); sub.add_parser("test")
    a = p.parse_args(argv)

    if a.cmd == "serve":
        import uvicorn
        uvicorn.run("backend.app:app", host=a.host, port=a.port, reload=False)
    elif a.cmd == "simulate":
        from backend import config
        config.TICK_SECONDS = 0.05
        from backend.service import SeraService
        svc = SeraService(step_delay=0)
        svc.set_scenario(a.scenario)
        svc.start()
        target = svc.world.clock + a.minutes
        while svc.world.clock < target:
            time.sleep(0.2)
        svc.stop()
        for e in reversed(svc.world.log[:80]):
            print(f"{e['t']//60:02d}:{e['t']%60:02d}  {e['actor']:<26} {e['text']}")
        print("\nstats:", svc.world.stats, "\ntrace:", svc.tracer.path)
    elif a.cmd == "benchmark":
        from backend.benchmark.run import SCENARIOS, run_benchmark
        scen = list(SCENARIOS) if a.scenarios == "all" else a.scenarios.split(",")
        out = run_benchmark(scen, a.seeds, a.repeats, a.contestants.upper(), llm_enabled=not a.no_llm)
        print(f"\nResults: {out / 'results.csv'}\nSummary: {out / 'summary.md'}")
    elif a.cmd == "replay":
        from backend.trace import replay
        for e in replay(a.run, a.case):
            print(f"[{e['sim_minute']}] {e['actor']:<26} {e['event']:<22} {str(e['payload'])[:110]}")
    elif a.cmd == "fetch-map":
        from backend.domain.roads import fetch_osm_map
        print("Saved", fetch_osm_map())
    elif a.cmd == "test":
        import pytest
        sys.exit(pytest.main(["-q", str(Path(__file__).resolve().parent / "tests")]))


if __name__ == "__main__":
    main()
