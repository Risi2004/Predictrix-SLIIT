# SERA — Workflow

## 1. One request, end to end

```
Ward message / form ─► Orchestrator opens case (deadline: Critical 4 min · Urgent 15 · Routine 60)
   │
   ├─► Request Agent      free text → {type, component, units, urgency, patient} + confidence
   │                      (language model; rule parser fallback; flags form/message conflicts)
   │
   ├─► Blood Bank Agents  8 agents in parallel, each reading ONLY its own stock:
   │                      offer · decline (reserve) · counter-offer (partial) · release reserve (critical, model-weighed)
   │      └─ round 2 ─►   if no full offer for an urgent/critical need, Orchestrator asks banks to reconsider
   │
   ├─► Logistics Agent    rank offers: urgency × travel time, exact type first, near-expiry first, protect O−
   │                      → up to 3 options with ETA (road graph)
   │
   ├─► Auditor Agent      compatibility re-check (removes unsafe options) · duplicate · inflated · priority
   │                      + model review of the plan (advice only)
   │
   ├─► Donor Agent        only if no option: how many donors to contact + SMS draft
   │
   └─► HUMAN GATE         Officer approves / edits (chooses another option) / rejects with a reason
                          → rider dispatched · donors called · case logged
```

Every arrow writes a **Case Board** entry (agent, kind, data, evidence, confidence) and a **trace** line.

## 2. Background processes

- **Clock:** 1 simulated minute every 1.3 s. Units age and expire, riders move, donors confirm.
- **Scenario feed:** new ward requests arrive according to the selected scenario.
- **Transfers:** every 30 minutes the network looks for near-expiry red cells at one bank that another bank lacks, and suggests a transfer for the officer to approve.
- **Donor calls:** confirmations arrive over time. When enough donors confirm, units are added at Central and the waiting case is re-planned automatically.

## 3. Reliability

| Risk | What SERA does |
|---|---|
| Model slow or down | 25 s time limit, 2 retries with back-off, then rule fallback (logged as `llm.fallback`) |
| Model returns bad output | Reply must be a JSON object with the required keys; otherwise re-asked, then fallback |
| Model invents a blood type | Request Agent drops any type not present in the message |
| Unsafe plan | Compatibility is code; Auditor removes incompatible options; approval re-checks again |
| Bank does not reply (missing/late data) | Its agent posts a timeout; the case continues with the other banks |
| Stock changed before approval | Approval detects it and re-plans the case |
| Crash inside a case | The case is handed to the officer with a warning instead of hanging |

## 4. Security & privacy

- Each Blood Bank Agent can read only its own stock (`BankAgent.read_stock` raises `AccessDenied` otherwise; tested).
- API keys live in `project/.env` (git-ignored); `.env.example` has no secrets.
- No real personal data. Donor records are synthetic counts; donor messages contain no patient details.

## 5. Human study (contestant D)

1. Recruit 4 volunteers (ideally 2 medical or nursing students).
2. Give a 10-minute briefing on blood types, compatibility and the screens.
3. Set `SERA_NO_LLM=1`. Each volunteer then coordinates a 30-minute scenario using the Inventory and Deliveries screens only, choosing banks themselves, while a team member times decisions.
4. Record results in `project/backend/benchmark/human_template.csv` and save it as `project/outputs/benchmark/human_results.csv`. The next benchmark summary includes it.
5. Report the sample size and the participants' backgrounds openly.

## 6. Commands

| Command | Purpose |
|---|---|
| `python main.py serve` | API + agents for the UI |
| `python main.py simulate --minutes 60 --scenario dengue` | Headless run that prints the log |
| `python main.py benchmark` | Runs the benchmark |
| `python main.py replay --run <id> --case <R-xxxx>` | Replays one case from its trace |
| `python main.py test` | Runs the test suite |
