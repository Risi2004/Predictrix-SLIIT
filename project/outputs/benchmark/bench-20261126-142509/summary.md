# Benchmark bench-20261126-142509

Seeds per scenario: 2 · repeats: 1 · language model: OFF (rule fallbacks; B not run)
All data is synthetic. Lower is better except near_expiry_used (higher = less waste).

## accident

| contestant | unmet_urgent_pct | incompatible | units_expired | median_fill_min | near_expiry_used | fairness_gap_pct | unneeded_donor_calls | duplicates_caught | false_duplicate_flags | duplicate_units_sent | cost_usd | fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A · SERA multi-agent | 0.55 | 0.0 | 12.0 | 17.0 | 277.0 | 10.0 | 31.5 | 3.0 | 0.0 | 21.0 | 0.0 | 431.0 |
| C · Rules only | 0.55 | 0.0 | 12.0 | 17.0 | 19.0 | 0.65 | 32.0 | 0.0 | 0.0 | 30.5 | 0.0 | 0.0 |
| ★ Reference (perfect information) | — | 0.0 | — | 14.0 | — | — | — | — | — | — | 0.0 | 0.0 |

## dengue

| contestant | unmet_urgent_pct | incompatible | units_expired | median_fill_min | near_expiry_used | fairness_gap_pct | unneeded_donor_calls | duplicates_caught | false_duplicate_flags | duplicate_units_sent | cost_usd | fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A · SERA multi-agent | 0.0 | 0.0 | 4.5 | 9.75 | 321.5 | 0.0 | 13.5 | 2.5 | 0.0 | 7.0 | 0.0 | 313.5 |
| C · Rules only | 0.0 | 0.0 | 7.5 | 9.0 | 50.0 | 0.0 | 9.0 | 0.0 | 0.0 | 10.0 | 0.0 | 0.0 |
| ★ Reference (perfect information) | — | 0.0 | — | 8.0 | — | — | — | — | — | — | 0.0 | 0.0 |

## duplicates

| contestant | unmet_urgent_pct | incompatible | units_expired | median_fill_min | near_expiry_used | fairness_gap_pct | unneeded_donor_calls | duplicates_caught | false_duplicate_flags | duplicate_units_sent | cost_usd | fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A · SERA multi-agent | 0.0 | 0.0 | 11.5 | 8.5 | 266.5 | 0.0 | 5.0 | 4.0 | 0.0 | 37.5 | 0.0 | 184.5 |
| C · Rules only | 0.0 | 0.0 | 12.5 | 8.0 | 30.0 | 0.0 | 4.5 | 0.0 | 0.0 | 50.5 | 0.0 | 0.0 |
| ★ Reference (perfect information) | — | 0.0 | — | 8.0 | — | — | — | — | — | — | 0.0 | 0.0 |

## missing

| contestant | unmet_urgent_pct | incompatible | units_expired | median_fill_min | near_expiry_used | fairness_gap_pct | unneeded_donor_calls | duplicates_caught | false_duplicate_flags | duplicate_units_sent | cost_usd | fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A · SERA multi-agent | 1.7 | 0.0 | 9.0 | 9.0 | 259.0 | 6.25 | 2.5 | 1.5 | 0.0 | 3.5 | 0.0 | 133.5 |
| C · Rules only | 0.0 | 0.0 | 13.0 | 8.0 | 21.0 | 0.0 | 0.0 | 0.0 | 0.0 | 6.5 | 0.0 | 0.0 |
| ★ Reference (perfect information) | — | 0.0 | — | 8.0 | — | — | — | — | — | — | 0.0 | 0.0 |

## normal

| contestant | unmet_urgent_pct | incompatible | units_expired | median_fill_min | near_expiry_used | fairness_gap_pct | unneeded_donor_calls | duplicates_caught | false_duplicate_flags | duplicate_units_sent | cost_usd | fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A · SERA multi-agent | 0.0 | 0.0 | 10.5 | 9.5 | 276.0 | 0.0 | 3.0 | 0.5 | 0.0 | 5.0 | 0.0 | 133.0 |
| C · Rules only | 0.0 | 0.0 | 11.5 | 8.0 | 24.5 | 0.0 | 2.5 | 0.0 | 0.0 | 5.5 | 0.0 | 0.0 |
| ★ Reference (perfect information) | — | 0.0 | — | 8.0 | — | — | — | — | — | — | 0.0 | 0.0 |

## stockout

| contestant | unmet_urgent_pct | incompatible | units_expired | median_fill_min | near_expiry_used | fairness_gap_pct | unneeded_donor_calls | duplicates_caught | false_duplicate_flags | duplicate_units_sent | cost_usd | fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A · SERA multi-agent | 2.1 | 0.0 | 7.0 | 10.5 | 263.5 | 7.15 | 4.5 | 0.5 | 0.0 | 5.0 | 0.0 | 156.5 |
| C · Rules only | 0.0 | 0.0 | 9.0 | 8.0 | 19.5 | 0.0 | 2.5 | 0.0 | 0.0 | 5.5 | 0.0 | 0.0 |
| ★ Reference (perfect information) | — | 0.0 | — | 8.0 | — | — | — | — | — | — | 0.0 | 0.0 |

## D · Human coordinators

Not yet recorded: fill backend/benchmark/human_template.csv and save it as outputs/benchmark/human_results.csv.
