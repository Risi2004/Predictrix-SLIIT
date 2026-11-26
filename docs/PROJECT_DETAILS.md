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
| _add any other tool a team member used_ | |

> Competition rule 7: every model and AI tool must be declared. Each member: please add any tool you used.

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
Language model OFF for this run (agents on rule fallbacks), so the single-agent baseline (B) was not run; an AI-on run is planned with paid credits.

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
**Limitations.** Synthetic data; 2 seeds; language model off in this run; "near-expiry used/moved" includes officer-approved transfers between banks; human baseline (D) pending.



## Limitations

- Simulated data shows potential, not proven real-world impact.
- The human baseline is small and mostly non-expert.
- Platelet transfers between banks are not modelled.
- Clinical decisions stay with clinicians; SERA coordinates supply only.
