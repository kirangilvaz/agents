# Sub-agent: Loop 7 — Iterative Refinement (Convergence Controller)

**Phase:** `refinement` · **Loop ID:** 7 · **Runs in cold/warm only.** Issues 0 searches of its own.

## Purpose

Drive conviction to convergence. Loop 7 re-runs the tight cycle **Loops 4 → 5 → 6** until the leaderboard stabilizes and every leaderboard opportunity is well-evidenced and adversarially survived. This is what makes the report trustworthy rather than a confident one-shot guess.

## Inputs

- `runs/<T>/adjusted_set.json` (Loop 6 output of the current pass).
- The prior pass's adjusted set (to measure swap % and conviction delta).
- [`policies/convergence.json`](../policies/convergence.json).
- Search budget: **0** of its own (the re-dispatched Loops 4–6 draw from their own per-loop budgets; the total is bounded by `per_cycle_total_cap`).

## Convergence check

After each pass, evaluate:

```
converged = (
  pass >= min_passes (default 3)
  AND leaderboard_swap_pct < max_swap_pct (default 0.10)
  AND |avg_conviction_delta vs prior pass| < max_conviction_delta (default 2)
  AND every leaderboard opportunity has adversarial.passes >= require_adversarial_passes (default 2)
  AND every leaderboard opportunity has independent_source_count >= min_sources (default 3)
  AND no opportunity has max_dim_share > max_single_signal_share (default 0.40)
)
```

- **`leaderboard_swap_pct`** = (entries added + removed across the floor since last pass) / leaderboard_size.
- **`avg_conviction_delta`** = mean absolute change in `composite_score` across opportunities present in both passes.

## Control flow

```
pass = 1
loop:
  run Loops 4 -> 5 -> 6
  evaluate converged
  if converged: stop (stopped_reason = "converged")
  if pass >= max_passes (default 8): stop (stopped_reason = "max_passes_reached")
  if search_budget exhausted: stop (stopped_reason = "budget_exhausted")
  if consecutive_no_change_passes >= 2: stop (stopped_reason = "stable")
  pass += 1
```

Each pass should **target the weakest spots**: opportunities near a tier boundary, those with < `min_sources`, those flagged `single_signal_dominant`, and those with a non-CONFIRMED latest verdict. Well-settled high-conviction names need not be re-challenged every pass (but must have ≥2 lifetime adversarial passes).

## Output checkpoint

```json
{
  "cycle": 7,
  "loop": 7,
  "phase": "refinement",
  "completed_at": "<iso>",
  "state": {
    "passes_run": 4,
    "converged": true,
    "stopped_reason": "converged",
    "final_avg_conviction_delta": 1.2,
    "final_swap_pct": 0.04,
    "leaderboard_size": 66,
    "per_pass": [
      { "pass": 1, "leaderboard": 71, "avg_composite": 73.1, "swaps": 71 },
      { "pass": 2, "leaderboard": 69, "avg_composite": 74.8, "swaps": 9 },
      { "pass": 3, "leaderboard": 67, "avg_composite": 75.6, "swaps": 4 },
      { "pass": 4, "leaderboard": 66, "avg_composite": 75.9, "swaps": 2 }
    ]
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs

- `runs/<T>/final_set.json` — the converged, ranked leaderboard (consumed by Loop 8).

## Invariants

- `passes_run >= min_passes` unless stopped by budget/error.
- At convergence, every leaderboard opportunity satisfies the adversarial + source-count gates.

## Failure handling

- **Never converges (oscillating):** check `source_reliability` for a noisy source dragging scores; stop at `max_passes` and ship with `stopped_reason = "max_passes_reached"`. Surface in metrics.
- **Budget exhausted:** ship the best-so-far leaderboard; the report notes it did not fully converge.
