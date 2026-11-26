import pytest

from backend.agents.bank_agent import AccessDenied
from backend.agents.orchestrator import Orchestrator
from backend.agents.request_agent import rule_parse
from backend.domain.catalog import compatible_types
from backend.domain.world import World
from backend.trace import Tracer


def make():
    w = World(seed=7)
    o = Orchestrator(w, Tracer("test", persist=False))
    return w, o


def test_bank_agent_cannot_read_other_banks():
    w, o = make()
    agent = o.bank_agents["b1"]
    assert agent.read_stock("b1", "RBC", "O+") is w.lots("b1", "RBC", "O+")
    with pytest.raises(AccessDenied):
        agent.read_stock("b2", "RBC", "O+")


def test_rule_parser_reads_messy_messages():
    f = rule_parse("Child 7y, platelets dropping fast, need 2 units O pos now")
    assert f == {"type": "O+", "units": 2, "comp": "PLT", "urg": "Critical", "pat": "Child"}
    assert rule_parse("pls send 3 bags B neg asap")["type"] == "B-"


def test_case_runs_end_to_end_and_reaches_the_officer():
    w, o = make()
    r = w.new_request({"hosp": "h1", "type": "O+", "comp": "RBC", "units": 2, "urg": "Critical", "pat": "Child",
                       "msg": "Child bleeding, need 2 units O+ now"})
    o.run_case(r["id"])
    assert r["status"] == "awaiting"
    assert r["plan"]["options"]
    agents = {e["agent"].split(" ·")[0] for e in r["board"]}
    assert {"Orchestrator", "Request Agent", "Bank Agent", "Logistics Agent", "Auditor Agent"} <= agents
    assert all(opt["dt"] in compatible_types("RBC", "O+") for opt in r["plan"]["options"])


def test_nothing_moves_without_officer_approval():
    w, o = make()
    r = w.new_request({"hosp": "h2", "type": "A+", "comp": "RBC", "units": 2, "urg": "Urgent", "pat": "Adult"})
    o.run_case(r["id"])
    before = len(w.deliveries)
    assert r["status"] == "awaiting" and len(w.deliveries) == before
    assert w.approve(r["id"]) == "dispatched"
    assert len(w.deliveries) == before + 1


def test_no_stock_goes_to_donor_agent():
    w, o = make()
    for b in w.stock:
        for lots in w.stock[b]["PLT"].values():
            for l in lots:
                l["u"] = 0
    r = w.new_request({"hosp": "h1", "type": "AB-", "comp": "PLT", "units": 2, "urg": "Critical", "pat": "Child"})
    o.run_case(r["id"])
    assert r["plan"]["options"] == [] and r["donorPlan"]["contact"] > 0
    assert w.approve(r["id"]) == "donors"


def test_duplicate_is_flagged():
    w, o = make()
    f = {"hosp": "h3", "type": "O-", "comp": "RBC", "units": 3, "urg": "Urgent", "pat": "Adult", "bed": "Bed 9"}
    a = w.new_request(dict(f)); o.run_case(a["id"])
    b = w.new_request(dict(f)); o.run_case(b["id"])
    assert b.get("dupOf") == a["id"]


def test_model_failure_falls_back_to_rules():
    w, o = make()
    o.llm.enabled = True
    from backend import config
    config.OPENROUTER_URL = "http://127.0.0.1:9/unreachable"
    config.LLM_RETRIES, config.LLM_TIMEOUT_S = 0, 1
    r = w.new_request({"hosp": "h1", "msg": "need 2 units A neg red cells urgently"})
    o.run_case(r["id"])
    assert r["type"] == "A-" and r["status"] == "awaiting"
    assert w.stats["fallbacks"] >= 1
