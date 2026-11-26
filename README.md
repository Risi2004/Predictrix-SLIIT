# SERA — Every unit, where it's needed

**Team Predictrix · SLIIT · Innodata AI Catalyst '26 (University track)**

SERA is a multi-agent AI system that coordinates blood across separate blood banks. It reads each hospital request, finds compatible units across the network, prefers units that would otherwise expire, plans the delivery, checks the plan independently, and calls donors only as a last resort. **A human Blood Bank Officer approves every action.**

> All hospitals, blood banks, donors and stock in this project are **synthetic** (a simulated demo region in Colombo). No real patient or donor data is used.

---

## Architecture

![SERA agent architecture](docs/architecture.png)

| Agent | What it decides | Data it can see |
|---|---|---|
| **Orchestrator** | Opens a case, runs the workflow (LangGraph), runs a second negotiation round when no bank can cover an urgent need, enforces deadlines | Case Board |
| **Request Agent** | Turns a ward's free-text message into type / component / units / urgency / patient, with a confidence score; flags conflicts with the form | The request |
| **Blood Bank Agents ×8** | One per bank: keeps a safety reserve, offers near-expiry units first, declines or counter-offers, weighs releasing reserve for critical cases | **Its own stock only** (enforced and tested) |
| **Logistics Agent** | Ranks offers by urgency, expiry and travel time on the road graph; proposes transfers of near-expiry stock | Offers, road network |
| **Auditor Agent** | Re-checks compatibility, flags duplicates and inflated requests, raises priority for children / maternity / critical, adds a model review | Case Board, request history |
| **Donor Agent** | Only when stock can't cover a need: how many eligible donors to contact, drafts the message | Consented (synthetic) registry |
| **Blood Bank Officer (human)** | Approves, edits or rejects every dispatch, transfer and donor call | Everything |

Agents never call each other directly. They post structured entries (need, offer, decline, counter-offer, route, check, proposal), each with evidence and a confidence score, to a shared **Case Board**. Every step is written to a trace log.

**Rules where rules work, AI where judgement is needed.** Blood-type compatibility, expiry, routing and optimisation are deterministic code. The language model reads free text, weighs reserve trade-offs, reviews plans and drafts donor messages. If the model fails or times out, a rule-based fallback keeps the case moving, and the fallback is logged.

## Repository layout

```
project/
  main.py                 entry point: serve | simulate | benchmark | replay | fetch-map | test
  requirements.txt
  .env.example
  backend/
    app.py                FastAPI API used by the React UI
    service.py            live clock, scenario feed, runs each case
    config.py · storage.py (PostgreSQL / SQLite) · trace.py (JSONL traces + replay)
    domain/               catalog (types, compatibility), roads (NetworkX / OpenStreetMap), world (simulation)
    agents/               orchestrator, request, bank, logistics, auditor, donor, board, llm
    benchmark/            run.py (A/B/C/reference), human_template.csv
  frontend/               React + Vite UI (officer console and hospital ward)
  tests/                  pytest
docs/
  Proposal.docx · Workflow.md · PROJECT_DETAILS.md · architecture.png
```

## Setup (Windows, macOS or Linux)

Requirements: **Python 3.11+**, **Node.js 20+**, an **OpenRouter API key**.

```bash
# 1. backend
cd project
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # macOS/Linux: cp .env.example .env
#   then open .env and paste OPENROUTER_API_KEY (and the exact SERA_MODEL id)
python main.py test              # 12 tests should pass
python main.py serve             # API on http://localhost:8000  (check http://localhost:8000/health)

# 2. frontend (second terminal)
cd project/frontend
npm install
npm run dev                      # open http://localhost:5173
```

Sign in as **Blood Bank Officer** to see the command centre, or as **Hospital ward** to send a request. New requests also arrive automatically. Change the scenario from the top bar.

**Optional:**
- `python main.py fetch-map` (after `pip install osmnx`) downloads Colombo's real road network from OpenStreetMap. Without it, a synthetic street grid is used (shown in `/health`).
- `DATABASE_URL=postgresql://user:pass@localhost:5432/sera` stores traces and benchmark results in PostgreSQL. Without it, a local SQLite file is used.
- `SERA_NO_LLM=1` runs every agent on its rule fallback, with no API calls.

## Benchmark

```bash
python main.py benchmark                         # 6 scenarios × 2 seeds; A, B, C + reference
python main.py benchmark --seeds 5 --repeats 3   # full protocol from the proposal
python main.py benchmark --no-llm                # quick run without API calls (B is skipped)
```

| Contestant | Description |
|---|---|
| **A · SERA** | The full multi-agent system |
| **B · Single agent** | One language-model agent, same model, data and tools, no role split, no independent audit |
| **C · Rules only** | Nearest compatible bank first, no AI |
| **D · Humans** | Coordinators using the UI without AI suggestions (`backend/benchmark/human_template.csv`) |
| **★ Reference** | Min-cost-flow solver (OR-Tools) with perfect information: best possible travel time |

Scenarios: normal day, dengue surge, mass-casualty accident, bank stock-out, inflated or duplicate requests, missing or late data. Each runs one simulated day on a lean network (40% stock) so that choices matter.

Metrics: unmet urgent requests %, incompatible matches (must be 0), units expired, median minutes to fill urgent requests, near-expiry units used, fairness gap between hospitals, unnecessary donor calls, duplicates caught, false duplicate flags, units sent to duplicates, AI cost, fallbacks.

Results go to `project/outputs/benchmark/<run>/results.csv` and `summary.md`, and appear on the **Reports** screen. Nothing is typed by hand.

## Evidence of agent interaction

- **Activity log** screen and each case's **Case record**
- `project/outputs/traces/<run>.jsonl`: one line per agent step (actor, event, payload, model, tokens, cost, latency, fallback)
- `python main.py replay --run <run_id> --case R-0193`

## Disclosures

- **Synthetic data:** network, stock, requests and donors are simulated (seeded, reproducible). Blood-type frequencies are a simulation assumption. Shelf lives follow WHO/AABB guidance.
- **Simulated parts:** riders, donor SMS and confirmations, and bank stock feeds are simulated. The benchmark officer auto-approves the recommended plan.
- **Platelet transfers** between banks are not simulated (they need agitated, temperature-controlled transport).
- See `docs/PROJECT_DETAILS.md` for all models and AI tools used.

## Team and contributions

**Team Predictrix** · Sri Lanka Institute of Information Technology (SLIIT)

| Member | Contributions | Share |
|---|---|---|
| **Shebulan Joshwel** (team lead) | Project idea and plan; system architecture and Case Board; Orchestrator and Logistics agents; trace log and replay; UI/UX design and React front-end; FastAPI layer; documentation; demo video | 30% |
| **Jegatheesan Risikesan** | LangGraph workflow and officer approval step; Request and Auditor agents; AI model layer (retries, time limits, validation, fallback, cost tracking); single-agent baseline | 30% |
| **Jazeel Jaufer** | Synthetic blood network and scenarios; Blood Bank Agents; routing on the road graph; OR-Tools reference solver | 20% |
| **Sathalogithasiva Hariram** | Blood-type compatibility, expiry and priority rules with tests; Donor Agent; rules-only baseline; benchmark and human study | 20% |
