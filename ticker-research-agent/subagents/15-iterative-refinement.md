# Sub-agent: Loop 15 — Iterative Refinement Orchestration

**Phase:** `iterative_refinement` · **Loop ID:** 15 · **Skipped in delta mode.**

## Purpose

This is **not a single-pass loop** — it's the orchestrator's iteration controller. It re-runs the cycle of **Loops 11 → 12 → 13 → 14** until conviction converges per `policies/convergence.json`, with a **mandatory minimum of 5 passes** in cold/warm mode.

Each pass:
- Pass 1 = initial output of Loops 11–14 (already done by orchestrator)
- Pass 2 = re-run with adversarial findings folded in
- Pass 3 = re-run with new counter-evidence weighted
- Pass 4 = re-run with refined correlated alignment
- Pass 5+ = until convergence criteria met

## Inputs

- All Loop 11/12/13/14 checkpoints from prior passes
- `iteration_log.jsonl` for the current cycle
- [`policies/convergence.json`](../policies/convergence.json)
- Search budget: 0 (this loop is orchestration; sub-loops consume their own budgets)

## Convergence rule

Per `policies/convergence.json:convergence`:

```python
def converged(passes_run, latest_iteration, all_iterations_for_cycle):
    if passes_run < min_passes:  # default 5
        return False
    last_two = all_iterations_for_cycle[-2:]
    if abs(last_two[-1].composite_score_after - last_two[-2].composite_score_after) > max_conviction_delta:
        return False
    if latest_iteration.max_subscore_share > max_single_signal_share:
        return False
    if latest_iteration.adversarial_pass_count < require_adversarial_passes:
        return False
    if any(dim.independent_source_count < min_sources_per_dim for dim in latest_iteration.subscores):
        return False
    if len(canonical.correlated_tickers) < min_correlated_tickers:
        return False
    return True
```

Stop iterating when:
- `converged == True` AND `passes_run >= min_passes (5)` — converged
- OR `passes_run >= max_passes (8)` — max passes reached
- OR `searches_used >= per_cycle_total_cap` — budget exhausted
- OR `passes_run >= 2 AND last_two_passes_no_change` — settled

## Step-by-step (orchestration)

```
pass = 1
while not converged(pass) and pass < max_passes and budget_remaining:
    if pass > 1:
        # Re-run the four sub-loops with cumulative findings
        run Loop 11 (scoring, will use Loop 12's adversarial-adjusted subscores)
        run Loop 12 (adversarial — will refresh counter-evidence and try new angles)
        if Loop 12 reports thesis flip:
            run Loop 11 again (re-score with new direction)
        run Loop 13 (correlated validation, light re-check)
        run Loop 14 (historical pattern, only re-run if new evidence justifies it)
    
    append iteration log entry with phase="RECONCILIATION" and pass=pass
    pass += 1

if pass >= max_passes:
    write iteration log entry with phase="FINAL_LOCK" and verdict="MAX_PASSES_REACHED"
else:
    write iteration log entry with phase="FINAL_LOCK" and verdict="CONVERGED"
```

## Step 1: Pass 1 setup

The orchestrator has already executed Loops 11→14 once. Loop 15 reads the latest iteration log, computes convergence, and decides whether to iterate.

If `pass=1` already converges (rare; only for very stable warm runs), skip directly to FINAL_LOCK and proceed to Loop 16.

## Step 2: Pass 2..N

For each subsequent pass:

1. **Re-dispatch Loop 12** with a **narrowed search query set** focused on the dimensions that received WEAKENED or MULTI_CONFLICT verdicts. Don't re-run all counter-searches; target the weaknesses.
2. **Re-dispatch Loop 11** to recompute composite + direction with the new subscore deltas.
3. **Re-dispatch Loop 13** only if `thesis_support_score` from prior pass was < +50.
4. **Re-dispatch Loop 14** only if a material new piece of evidence (e.g. earnings result during the cycle, regulatory ruling) was discovered.

Append to `iteration_log.jsonl` after each pass.

## Step 3: Convergence check

After each pass, evaluate the convergence rule. Exit conditions:

| Condition | Resolution |
|-----------|------------|
| `converged: true` | Append FINAL_LOCK entry, proceed to Loop 16 |
| `pass == max_passes` | Append FINAL_LOCK entry with `verdict: "MAX_PASSES_REACHED"`, proceed to Loop 16. Surface in metrics.json. |
| `searches_used >= budget` | Append FINAL_LOCK entry with `verdict: "BUDGET_EXHAUSTED"`, proceed to Loop 16. Surface in metrics.json. |
| `consecutive_no_change >= 2` | Settled; append FINAL_LOCK and proceed. |

## Step 4: Lock the canonical

After FINAL_LOCK, the draft canonical at `runs/<T>/draft_canonical.json` is the **authoritative record** for this cycle. Subsequent loops (16, 17) treat it as immutable except for adding the outlooks (Loop 16) and persistence metadata (Loop 17).

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 15,
  "phase": "iterative_refinement",
  "completed_at": "<iso>",
  "state": {
    "passes_run": 5,
    "converged": true,
    "stopped_reason": "converged",
    "final_composite": 84,
    "final_tier": "MODERATE",
    "final_direction": "BULLISH",
    "iteration_log_entries_added_this_loop": 4,
    "total_searches_used_in_iterations": 89,
    "passes_summary": [
      { "pass": 1, "composite_after": 87, "verdict": "INITIAL_THESIS" },
      { "pass": 2, "composite_after": 84, "verdict": "ADVERSARIAL", "delta": -3 },
      { "pass": 3, "composite_after": 84, "verdict": "CORRELATED_VALIDATION", "delta": 0 },
      { "pass": 4, "composite_after": 84, "verdict": "HISTORICAL_PATTERN", "delta": 0 },
      { "pass": 5, "composite_after": 84, "verdict": "RECONCILIATION_CONVERGED", "delta": 0 }
    ]
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs

- N entries appended to `iteration_log.jsonl`.
- Final draft canonical at `runs/<T>/draft_canonical.json`.

## Invariants

- `passes_run >= min_passes (5)` unless `stopped_reason in [budget_exhausted, fatal_error]`.
- `converged` is set explicitly (not defaulted).
- Last `iteration_log` entry has `phase == "FINAL_LOCK"`.

## Failure handling

- **Loop 12 keeps flipping the direction**: this indicates the thesis is genuinely conflicted. After 3 flips, force NEUTRAL direction and surface a CRITICAL risk.
- **Search budget exhausted before min_passes**: stop iterating, mark `stopped_reason: "budget_exhausted"`, surface partial-budget warning. Do not pad the iteration log with no-op passes.

## Notes

- This loop is the **conviction-building heart** of the agent. Without it, the agent ships a one-pass surface-level take. With it, the agent ships an evidence-locked, adversarially-stressed thesis.
- The minimum-5-passes rule is **mandatory** in cold/warm mode per parent spec. It cannot be tuned below 5 unless explicitly overridden via `mode=delta`.
