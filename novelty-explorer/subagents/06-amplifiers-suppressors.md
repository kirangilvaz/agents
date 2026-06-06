# Sub-agent: Loop 6 — Signal Amplifiers / Suppressors + Convergence Count

**Phase:** `signal_adjust` · **Loop ID:** 6 · **Always runs (cold/warm/delta).**

## Purpose

Apply the conviction framework's **Signal Amplifiers** (convergence boosts) and **Signal Suppressors** (hype penalties) to turn each opportunity's `core_composite` into a final `composite_score`, and record the `convergence_count` badge. This is a pure-computation loop driven by Loop 4's scores and Loop 5's verdicts/flags.

## Inputs

- `runs/<T>/challenged_set.json` (Loop 5) — or `scored_set.json` directly in delta if Loop 5 was skipped.
- All `evidence/<id>.jsonl` (to detect which amplifier signal types fired).
- [`policies/weights.json`](../policies/weights.json) — `amplifiers`, `suppressors`.
- Search budget: **0**.

## Step 1: Detect independent amplifier signals

For each opportunity, set a boolean for each of the 8 `amplifiers.signal_types` based on the evidence:

| Signal type | Fires when |
|-------------|-----------|
| `major_funding_round` | A funding round (any stage) with credible source in the last 12 months |
| `rising_patent_filings` | Patent filings last 12m > prior 12m |
| `growing_github_activity` | 90-day star/contributor growth materially positive |
| `growing_hiring` | Open-role count rising / job-posting evidence |
| `accelerating_citations` | Citation growth rate increasing (2nd derivative > 0) |
| `fortune500_pilot` | A named large-enterprise pilot/customer |
| `regulatory_progress` | Approval milestone, designation, or cleared regulatory step |
| `industry_partnership` | A named strategic partnership |

`convergence_count = number of signal types that fired` (0–8). Record which fired in `amplifiers_fired`.

## Step 2: Compute amplifier adjustment

```
amplifier_adj = min( convergence_count * amplifiers.per_signal, amplifiers.max_amplifier )   # default per_signal 1.5, cap +8
```

> Only count **independent** signal types — two funding articles about the same round are ONE `major_funding_round`, not two.

## Step 3: Compute suppressor adjustment

From Loop 5's `suppressor_flags` for this opportunity:

```
suppressor_adj = max( count(flags) * suppressors.per_flag, suppressors.max_suppressor )   # default per_flag -2.5, cap -12
```

Apply extra suppression for adversarial verdicts: `WEAKENED` → at least −3; `MULTI_CONFLICT` → at least −8. (Take the more negative of flag-derived and verdict-derived.)

## Step 4: Final composite

```
amplifier_adjustment = amplifier_adj + suppressor_adj          # net, can be + or -
composite_score      = clamp( core_composite + amplifier_adjustment, 0, 100 )
time_adjusted_score  = composite_score * ttm_discount[ttm]
```

Recompute `conviction_tier` from the adjusted `composite_score`. **A suppressed opportunity may drop below the floor → route to watchlist.** An amplified one may cross into a higher tier — but anti-churn (Loop 8 / AGENT.md STABILITY) still governs lifecycle flips.

## Step 5: Re-rank

Sort all above-floor opportunities by `composite_score` descending (primary) for the default leaderboard. Also compute the `time_adjusted_score` ordering (the report toggles between them). Stamp a provisional `rank`.

## Output checkpoint

```json
{
  "cycle": 7,
  "loop": 6,
  "phase": "signal_adjust",
  "completed_at": "<iso>",
  "state": {
    "adjusted_set_path": "runs/<T>/adjusted_set.json",
    "leaderboard_size": 68,
    "avg_amplifier_adj": 3.1,
    "avg_suppressor_adj": -1.4,
    "convergence_distribution": { "0-2": 12, "3-4": 31, "5-6": 19, "7-8": 6 },
    "promoted_to_higher_tier": 7,
    "suppressed_below_floor": 3
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs

- `runs/<T>/adjusted_set.json` — final scored, adjusted, provisionally-ranked set (consumed by Loop 7/8).

## Invariants

- Every opportunity has `composite_score`, `time_adjusted_score`, `convergence_count`, `amplifiers_fired`, `suppressors_fired`, and `amplifier_adjustment`.
- `amplifier_adjustment` is within `[max_suppressor, max_amplifier]` (default `[-12, +8]`).
- `composite_score` is consistent with `core_composite + amplifier_adjustment` (clamped).

## Failure handling

- **Amplifier and suppressor both large:** that's legitimate (strong signals AND real risks) — net them honestly; surface both in the report.
- **Convergence_count high but all from one signal class:** that's NOT convergence — re-examine independence; do not award the boost.
