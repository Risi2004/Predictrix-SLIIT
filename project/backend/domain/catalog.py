"""Static catalogue for the simulated SERA demo region.

All banks, hospitals, donors and stock in this project are SYNTHETIC (demo region).
Shelf lives follow WHO/AABB guidance (red cells 35-42 days, platelets 5-7 days).
"""
from __future__ import annotations

TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]

# Red cells: recipient -> acceptable donor types
COMPAT_RBC = {
    "O-": ["O-"],
    "O+": ["O+", "O-"],
    "A-": ["A-", "O-"],
    "A+": ["A+", "A-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "AB+": TYPES[:],
}
# Platelets: ABO-identical first line; RhD-negative recipients get RhD-negative units.
COMPAT_PLT = {
    "O-": ["O-"], "O+": ["O+", "O-"],
    "A-": ["A-"], "A+": ["A+", "A-"],
    "B-": ["B-"], "B+": ["B+", "B-"],
    "AB-": ["AB-"], "AB+": ["AB+", "AB-"],
}


def compatible_types(comp: str, recipient: str) -> list[str]:
    """Deterministic compatibility rule. The LLM never decides this."""
    table = COMPAT_PLT if comp == "PLT" else COMPAT_RBC
    return list(table.get(recipient, [recipient]))


def is_compatible(comp: str, recipient: str, donor: str) -> bool:
    return donor in compatible_types(comp, recipient)


# Simulation assumption (South Asian-like distribution); not a cited statistic.
WEIGHTS = {"O+": .34, "A+": .22, "B+": .26, "AB+": .07, "O-": .03, "A-": .02, "B-": .04, "AB-": .02}
COMP = {"RBC": "Red cells", "PLT": "Platelets"}

# x/y are the UI map coordinates; lat/lon place each site in Colombo for the road graph.
BANKS = [
    {"id": "b1", "name": "Central",    "x": 300, "y": 190, "size": 1.5,  "lat": 6.9175, "lon": 79.8650},
    {"id": "b2", "name": "Northgate",  "x": 255, "y": 58,  "size": 1.0,  "lat": 6.9530, "lon": 79.8590},
    {"id": "b3", "name": "Lakeside",   "x": 88,  "y": 108, "size": 0.9,  "lat": 6.9320, "lon": 79.8460},
    {"id": "b4", "name": "Harbour",    "x": 525, "y": 305, "size": 1.0,  "lat": 6.8860, "lon": 79.8890},
    {"id": "b5", "name": "Eastfield",  "x": 545, "y": 140, "size": 0.9,  "lat": 6.9290, "lon": 79.8960},
    {"id": "b6", "name": "Westhill",   "x": 76,  "y": 275, "size": 0.8,  "lat": 6.8920, "lon": 79.8530},
    {"id": "b7", "name": "Riverside",  "x": 440, "y": 76,  "size": 1.0,  "lat": 6.9480, "lon": 79.8800},
    {"id": "b8", "name": "Southpoint", "x": 300, "y": 342, "size": 0.42, "lat": 6.8700, "lon": 79.8680},
]
HOSP = [
    {"id": "h1", "name": "Northside Children's",   "short": "Northside",    "x": 196, "y": 122, "lat": 6.9380, "lon": 79.8560},
    {"id": "h2", "name": "Harbour Maternity",      "short": "Harbour Mat.", "x": 455, "y": 334, "lat": 6.8790, "lon": 79.8830},
    {"id": "h3", "name": "Eastgate Trauma",        "short": "Eastgate",     "x": 572, "y": 222, "lat": 6.9080, "lon": 79.9000},
    {"id": "h4", "name": "City General",           "short": "City General", "x": 368, "y": 238, "lat": 6.9050, "lon": 79.8720},
    {"id": "h5", "name": "Lakeview Cancer Centre", "short": "Lakeview",     "x": 132, "y": 196, "lat": 6.9140, "lon": 79.8500},
    {"id": "h6", "name": "St. Mary's",             "short": "St. Mary's",   "x": 196, "y": 318, "lat": 6.8760, "lon": 79.8580},
]
REGISTRY = {"O+": 1240, "A+": 812, "B+": 930, "AB+": 214, "O-": 96, "A-": 61, "B-": 118, "AB-": 22}

_BANK = {b["id"]: b for b in BANKS}
_HOSP = {h["id"]: h for h in HOSP}


def bank(bid: str) -> dict:
    return _BANK.get(bid, {"id": bid, "name": bid, "x": 0, "y": 0})


def hosp(hid: str) -> dict:
    return _HOSP.get(hid, {"id": hid, "name": hid, "short": hid, "x": 0, "y": 0})


def site(sid: str) -> dict:
    return _BANK.get(sid) or _HOSP.get(sid) or {"id": sid}


def fmt_h(h: float) -> str:
    return f"{max(1, round(h))} h" if h < 48 else f"{round(h / 24)} days"
