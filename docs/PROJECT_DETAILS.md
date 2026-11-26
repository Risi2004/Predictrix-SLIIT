# SERA — Project Details

## Team

**Predictrix** · Sri Lanka Institute of Information Technology (SLIIT)

| Member | Responsibilities | Share |
|---|---|---|
| Shebulan Joshwel (lead) | Project idea and plan; architecture and Case Board; Orchestrator and Logistics agents; trace log and replay; UI/UX and web front-end; FastAPI layer; documentation; demo video | 30% |
| Jegatheesan Risikesan | LangGraph workflow and officer approval step; Request and Auditor agents; AI model layer (retries, time limits, validation, fallback, cost); single-agent baseline | 30% |
| Jazeel Jaufer | Synthetic network and scenarios; Blood Bank Agents; routing; reference solver | 20% |
| Sathalogithasiva Hariram | Compatibility, expiry and priority rules with tests; Donor Agent; rules-only baseline; benchmark and human study | 20% |

## Problem and users

Blood is held by many separate banks with no shared live view of stock. Hospitals run short while compatible units expire elsewhere (a "pseudo shortage"). SERA's users are blood bank officers (primary), hospital wards and consented donors.

## Technology choices

| Layer | Choice | Why / trade-off |
|---|---|---|
| Agents | **LangGraph** (`backend/agents/orchestrator.py`) | Explicit workflow graph with conditional edges. The human gate is the graph's end state; approval resumes through the API. |
| Language model | **Qwen** via **OpenRouter** (`SERA_MODEL`, see `.env`) | Strong reasoning at low cost. Used only where judgement is needed. |
| Rules / safety | Plain Python (`domain/catalog.py`) | Compatibility must be deterministic and testable; the model never decides it. |
| Routing | **NetworkX** shortest paths on an **OpenStreetMap** road graph (synthetic grid fallback) | Real travel times and explainable routes. |
| Optimisation | **Google OR-Tools** min-cost flow (NetworkX fallback) | Perfect-information reference in the benchmark. |
| Data | pandas-ready CSV results; **PostgreSQL** via `DATABASE_URL` (SQLite fallback) | Traces and benchmark results are queryable. |
| API | **FastAPI** | Typed endpoints for the UI. |
| UI | **React + Vite** | Officer console and hospital ward screens, polling the API every second. |
| Tests | **pytest** | Rules, access limits, fallbacks, end-to-end case, approval gate. |

## AI models, services and tools used

**At runtime (inside SERA):**

| Model / service | Where | Purpose |
|---|---|---|
| Qwen (exact id in `SERA_MODEL`) via OpenRouter API | Request, Bank (reserve trade-off), Auditor, Donor agents; single-agent baseline | Read requests, weigh reserve release, review plans, draft donor SMS |

**While building the project (AI coding / design assistants):**

| Tool | Used for |
|---|---|
| Anthropic Claude | Project ideation, proposal drafting, UI design prototype, backend code assistance, documentation |
| OpenAI Codex | Front-end code assistance (React port) |

All AI models and AI tools used to build SERA are listed above (competition rule 7).

## Data and mocks (disclosure)

| Part | Status |
|---|---|
| Blood banks, hospitals, stock lots, donors | **Synthetic**, seeded and reproducible |
| Blood-type frequencies | Simulation assumption (South Asia-like); not a cited statistic |
| Shelf lives | Red cells ~35–42 days, platelets ~5–7 days (WHO/AABB guidance) |
| Road network | OpenStreetMap (after `fetch-map`) or synthetic grid (default); shown at `/health` |
| Riders, donor SMS, donor confirmations, bank stock feeds | **Simulated** |
| Benchmark officer | Auto-approves the recommended plan; rejects requests the contestant flagged as duplicates |
| Human baseline | Run manually with volunteers (see Workflow.md §5) |

## Benchmark results

Run `bench-20261126-142509` · `python main.py benchmark --no-llm` · 6 scenarios × 2 seeds × 1 simulated day each · lean network (40% stock) · synthetic data.
Language model OFF for this run (agents on rule fallbacks), so the single-agent baseline (B) was not run; the AI-on comparison with B follows below.

| Scenario | Contestant | Unmet urgent % | Incompatible | Units expired | Median fill (min) | Near-expiry units used/moved | Units sent to duplicates |
|---|---|---|---|---|---|---|---|
| Normal | A · SERA | 0.0 | 0 | 10.5 | 9.5 | 276 | 5.0 |
| | C · Rules | 0.0 | 0 | 11.5 | 8.0 | 24.5 | 5.5 |
| Dengue surge | A · SERA | 0.0 | 0 | 4.5 | 9.75 | 321.5 | 7.0 |
| | C · Rules | 0.0 | 0 | 7.5 | 9.0 | 50 | 10.0 |
| Mass-casualty | A · SERA | 0.55 | 0 | 12.0 | 17.0 | 277 | 21.0 |
| | C · Rules | 0.55 | 0 | 12.0 | 17.0 | 19 | 30.5 |
| Bank stock-out | A · SERA | 2.1 | 0 | 7.0 | 10.5 | 263.5 | 5.0 |
| | C · Rules | 0.0 | 0 | 9.0 | 8.0 | 19.5 | 5.5 |
| Duplicates | A · SERA | 0.0 | 0 | 11.5 | 8.5 | 266.5 | 37.5 |
| | C · Rules | 0.0 | 0 | 12.5 | 8.0 | 30 | 50.5 |
| Missing data | A · SERA | 1.7 | 0 | 9.0 | 9.0 | 259 | 3.5 |
| | C · Rules | 0.0 | 0 | 13.0 | 8.0 | 21 | 6.5 |

Reference (perfect information, OR-Tools min-cost flow): best possible median travel time 8–14 min.

**Findings.** SERA wasted fewer or equal units in every scenario and used or moved 5–14× more near-expiry units. It caught duplicate requests with no false flags and never made an incompatible match.
**Trade-offs.** Deliveries were 0.5–2.5 min slower (SERA prefers units that would otherwise expire). Bank safety reserves and a non-replying bank left 1.7–2.1% of urgent requests waiting for donors in the stock-out and missing-data scenarios.
**Limitations.** Synthetic data; 2 seeds; language model off in this run; "near-expiry used/moved" includes officer-approved transfers between banks.

### AI-on comparison: SERA (A) vs single agent (B) vs rules (C)

Run `bench-20261126-180756` · `python main.py benchmark --scenarios normal,duplicates --seeds 1` · language model **ON** (`qwen/qwen3.8-27b` via OpenRouter) · one **1-hour peak-load window** per scenario (a new request about every 4 min in Normal and every 3 min in Duplicates; set in `backend/benchmark/run.py`) · synthetic data · total model cost **$0.19** · **0 fallbacks** (every agent step used the model).

| Scenario | Contestant | Unmet urgent % | Incompatible | Median fill (min) | Near-expiry units used/moved | Fairness gap % | Unneeded donor calls | Duplicates caught | False duplicate flags | Units sent to duplicates | Cost (USD) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Normal | A · SERA | **0.0** | 0 | 9 | **38** | **0.0** | 1 | 0 | **0** | 0 | 0.04 |
| | B · Single agent | 33.3 | 0 | 7 | 6 | 57.1 | 0 | 0 | 3 | 0 | 0.04 |
| | C · Rules | 0.0 | 0 | 8 | 6 | 0.0 | 1 | 0 | 0 | 0 | 0.00 |
| Duplicates | A · SERA | 0.0 | 0 | 9 | **52** | 50.0 | 3 | **3** | **0** | **0** | 0.05 |
| | B · Single agent | 0.0 | 0 | 9 | 4 | 50.0 | 0 | 2 | 0 | 1 | 0.07 |
| | C · Rules | 0.0 | 0 | 8 | 20 | 50.0 | 4 | 0 | 0 | 2 | 0.00 |

Reference (perfect information, OR-Tools): best possible median fill 8 min in both windows.

**Findings.** With the same model and the same requests, splitting the work across agents beat one agent doing everything. In Normal, the single agent left a third of urgent requests unmet, wrongly flagged 3 genuine requests as duplicates, and served hospitals unevenly (57% fairness gap); SERA filled every urgent request with no false flags. In Duplicates, SERA's Auditor caught all 3 duplicates and sent no blood to them; the single agent caught 2 and sent 1 unit to a duplicate; the rules baseline caught none and sent 2. SERA used or moved 6–13× more near-expiry units than the single agent, at the same or lower model cost.
**Trade-offs.** SERA's median fill was 2 min slower than the single agent in Normal (it prefers units that would otherwise expire), and it made 3 unneeded donor calls in Duplicates where the single agent made none.
**Limitations.** One seed and one-hour windows, so each scenario has only a handful of urgent requests and the percentages are noisy (33.3% is a small count). Units expired is 0 for everyone because one hour is too short for blood to expire; the full-day run above is the evidence for waste. The windows were shortened from a full day to fit the model budget.

### D · Human coordinators (human study)

4 volunteers (anonymised P1–P4) each handled the same 10 requests on the same stock sheet as SERA (`docs/Workflow.md` §5; test pack: SERA Human Study — Coordinator Test). Participants worked remotely and timed themselves; no blood-bank professionals took part.

| | P1 · medicine undergrad | P2 · engineering undergrad | P3 · software eng. undergrad | P4 · biomedical graduate | SERA (rule mode) |
|---|---|---|---|---|---|
| Incompatible sends | 0 | 0 | 1 | 0 | 0 |
| Duplicates caught (of 2) | 2 | 2 | 1 | 1 | 2 |
| Questioned inflated request #10 | Yes | Yes | No | No | Yes |
| Near-expiry units used (of 4 requests) | 3 | 4 | 2 | 4 | 4 |
| Urgent requests not filled safely | 0 | 0 | 1 | 0 | 0 |
| Median decision time | 39 s | 20 s | 23 s | 37.5 s | < 1 s |

**Findings.** Two of four people matched SERA on safety and duplicates. One made an incompatible match (A+ red cells for an A− patient). Two sent blood to a duplicate or inflated request. SERA made none of these errors and decided each request in under a second.
**Limitations.** Small sample (n = 4), mostly non-experts, remote and self-timed; one stock snapshot; SERA in rule mode.


## Limitations

- Simulated data shows potential, not proven real-world impact.
- The human baseline is small and mostly non-expert.
- Platelet transfers between banks are not modelled.
- Clinical decisions stay with clinicians; SERA coordinates supply only.
