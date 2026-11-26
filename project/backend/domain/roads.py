"""Road network and travel times (NetworkX).

If `project/data/colombo_roads.graphml` exists (created once with
`python main.py fetch-map`, which downloads Colombo's real road network from
OpenStreetMap via osmnx), travel times come from shortest paths on that graph.
Otherwise a synthetic street grid over the demo map is used (disclosed in README).
"""
from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path

import networkx as nx

from .catalog import BANKS, HOSP, site

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
OSM_FILE = DATA_DIR / "colombo_roads.graphml"
CITY_SPEED_KMH = 22.0      # average urban rider speed incl. traffic
HANDLING_MIN = 2           # pick-up / hand-over time
SITES = [*BANKS, *HOSP]


def _haversine_m(a, b) -> float:
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _osm_minutes() -> dict | None:
    if not OSM_FILE.exists():
        return None
    g = nx.read_graphml(OSM_FILE)
    nodes = [(n, float(d["y"]), float(d["x"])) for n, d in g.nodes(data=True) if "x" in d and "y" in d]

    def nearest(lat, lon):
        return min(nodes, key=lambda t: (t[1] - lat) ** 2 + (t[2] - lon) ** 2)[0]

    for u, v, d in g.edges(data=True):
        d["w"] = float(d.get("length", 50))
    snapped = {s["id"]: nearest(s["lat"], s["lon"]) for s in SITES}
    out = {}
    for s in SITES:
        dist = nx.single_source_dijkstra_path_length(g.to_undirected(), snapped[s["id"]], weight="w")
        for t in SITES:
            meters = dist.get(snapped[t["id"]])
            if meters is None:  # disconnected snap -> straight-line estimate
                meters = 1.4 * _haversine_m((s["lat"], s["lon"]), (t["lat"], t["lon"]))
            out[(s["id"], t["id"])] = meters
    return {k: max(4, round(m / 1000 / CITY_SPEED_KMH * 60) + HANDLING_MIN) for k, m in out.items()}


def _synthetic_graph() -> nx.Graph:
    """Street grid over the 600x370 demo map; arterials (every 3rd line) are faster."""
    g = nx.Graph()
    step = 40
    xs, ys = range(0, 641, step), range(0, 401, step)
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            if x + step <= 640:
                fast = j % 3 == 0
                g.add_edge((x, y), (x + step, y), w=step / (26 if fast else 17))
            if y + step <= 400:
                fast = i % 3 == 0
                g.add_edge((x, y), (x, y + step), w=step / (26 if fast else 17))
    for s in SITES:
        sx, sy = s["x"], s["y"]
        grid = [n for n in g.nodes if isinstance(n, tuple)]
        corners = sorted(grid, key=lambda n: (n[0] - sx) ** 2 + (n[1] - sy) ** 2)[:2]
        for c in corners:
            g.add_edge(s["id"], c, w=math.hypot(c[0] - sx, c[1] - sy) / 15)
    return g


@lru_cache(maxsize=1)
def travel_table() -> tuple[str, dict]:
    osm = _osm_minutes()
    if osm:
        return "openstreetmap", osm
    g = _synthetic_graph()
    out = {}
    for s in SITES:
        dist = nx.single_source_dijkstra_path_length(g, s["id"], weight="w")
        for t in SITES:
            out[(s["id"], t["id"])] = max(4, round(dist[t["id"]]) + HANDLING_MIN)
    return "synthetic-grid", out


def travel(a: str, b: str) -> int:
    """Minutes by rider between two site ids."""
    if a == b:
        return 0
    return travel_table()[1][(a, b)]


def route_source() -> str:
    return travel_table()[0]


def fetch_osm_map() -> Path:
    """Download Colombo's drivable road network (needs `pip install osmnx` + internet)."""
    import osmnx as ox  # optional dependency
    lats = [s["lat"] for s in SITES]
    lons = [s["lon"] for s in SITES]
    pad = 0.01
    bbox = (min(lons) - pad, min(lats) - pad, max(lons) + pad, max(lats) + pad)  # (west, south, east, north)
    g = ox.graph_from_bbox(bbox, network_type="drive")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ox.save_graphml(g, OSM_FILE)
    travel_table.cache_clear()
    return OSM_FILE


def describe() -> str:
    return f"{route_source()} ({len(SITES)} sites)"


if __name__ == "__main__":
    print(describe())
    print({k: v for k, v in list(travel_table()[1].items())[:5]}, site("b1")["name"])
