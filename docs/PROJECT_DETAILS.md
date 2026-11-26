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

Run `python main.py benchmark` and copy the tables from `project/outputs/benchmark/<run>/summary.md` here, with sample sizes, model version and any failures.

## Limitations

- Simulated data shows potential, not proven real-world impact.
- The human baseline is small and mostly non-expert.
- Platelet transfers between banks are not modelled.
- Clinical decisions stay with clinicians; SERA coordinates supply only.
