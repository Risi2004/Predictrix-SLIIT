# Benchmark bench-20261126-180756

Seeds per scenario: 1 · repeats: 1 · language model: on
All data is synthetic. Lower is better except near_expiry_used (higher = less waste).

## duplicates

| contestant | unmet_urgent_pct | incompatible | units_expired | median_fill_min | near_expiry_used | fairness_gap_pct | unneeded_donor_calls | duplicates_caught | false_duplicate_flags | duplicate_units_sent | cost_usd | fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A · SERA multi-agent | 0.0 | 0.0 | 0.0 | 9.0 | 52.0 | 50.0 | 3.0 | 3.0 | 0.0 | 0.0 | 0.05 | 0.0 |
| B · Single agent | 0.0 | 0.0 | 0.0 | 9.0 | 4.0 | 50.0 | 0.0 | 2.0 | 0.0 | 1.0 | 0.07 | 0.0 |
| C · Rules only | 0.0 | 0.0 | 0.0 | 8.0 | 20.0 | 50.0 | 4.0 | 0.0 | 0.0 | 2.0 | 0.0 | 0.0 |
| ★ Reference (perfect information) | — | 0.0 | — | 8.0 | — | — | — | — | — | — | 0.0 | 0.0 |

## normal

| contestant | unmet_urgent_pct | incompatible | units_expired | median_fill_min | near_expiry_used | fairness_gap_pct | unneeded_donor_calls | duplicates_caught | false_duplicate_flags | duplicate_units_sent | cost_usd | fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A · SERA multi-agent | 0.0 | 0.0 | 0.0 | 9.0 | 38.0 | 0.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.04 | 0.0 |
| B · Single agent | 33.3 | 0.0 | 0.0 | 7.0 | 6.0 | 57.1 | 0.0 | 0.0 | 3.0 | 0.0 | 0.04 | 0.0 |
| C · Rules only | 0.0 | 0.0 | 0.0 | 8.0 | 6.0 | 0.0 | 1.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |
| ★ Reference (perfect information) | — | 0.0 | — | 8.0 | — | — | — | — | — | — | 0.0 | 0.0 |

## D · Human coordinators

participant,background,scenario,requests_handled,urgent_requests,unmet_urgent,incompatible_matches,median_minutes_to_decide,units_sent_from_near_expiry,donor_calls,unneeded_donor_calls,duplicates_caught,notes
P1,medicine undergraduate,human-study-10,10,6,0,0,0.65,3/4 requests,0,0,2/2,questioned inflated request #10; remote; self-timed
P2,engineering undergraduate (2nd year),human-study-10,10,6,0,0,0.33,4/4 requests,0,0,2/2,questioned inflated request #10; split #5 across two banks; remote; self-timed
P3,software engineering undergraduate (no clinical background),human-study-10,10,6,1,1,0.38,2/4 requests,1,1,1/2,sent A+ to an A- patient (#5); re-sent duplicate #4; called donors for inflated #10; remote; self-timed
P4,biomedical science graduate,human-study-10,10,6,0,0,0.63,4/4 requests,0,0,1/2,sent duplicate #9; sent 10 units for inflated #10; remote; self-timed
SERA,rule mode (same stock and requests),human-study-10,10,6,0,0,<0.02,4/4 requests,0,0,2/2,flagged inflated #10 for ward confirmation

