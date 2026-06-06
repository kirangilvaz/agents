# Sub-agent: Loop 0 — Warm Start

**Phase:** `warm_start` · **Loop ID:** 0 · **Always runs first.**

## Purpose

Load all prior knowledge from `interview_questions_knowledge/`, decide the run mode (`cold` / `warm` / `delta`), and stage the in-memory state every downstream loop will use. This is the single biggest reason re-runs improve over time instead of starting from scratch.

## Inputs

Read these files. Missing files imply cold start; do not error.

| Path | Purpose |
|------|---------|
| `interview_questions_knowledge/state.json` | `last_cycle`, `last_run_at`, `run_mode`, `schema_version` |
| `interview_questions_knowledge/categories.json` | Live category registry (seeds + discovered). Missing → seed from [`policies/categories.json`](../policies/categories.json). |
| `interview_questions_knowledge/questions/<category>/*.json` | Canonical questions baseline (incl. existing `prep`) |
| `interview_questions_knowledge/aliases.json` | Paraphrase → `question_id` map |
| `interview_questions_knowledge/source_reliability.json` | Per-source weight multipliers |
| `interview_questions_knowledge/coverage_matrix.json` | Last cycle's gaps queue |
| `interview_questions_knowledge/emerging.json` | Watchlist of 45–59 score band |
| `interview_questions_knowledge/eval/holdout.jsonl` | User-provided real-interview ground truth (used by Loop 8 metrics) |
| `policies/convergence.json` | `cold_after_days`, `delta_mode` rules |
| User prompt override | `mode=cold|warm|delta` if present |

## Run-mode decision logic

```
if state.json missing OR --reset flag in user prompt:
    mode = "cold"
elif user prompt contains "mode=cold|warm|delta":
    mode = user override
elif now - state.last_run_at >= policies.convergence.cold_after_days (default 30):
    mode = "warm"
elif now - state.last_run_at < 7 days:
    mode = "delta"
else:
    mode = "warm"  # 7-30d window
```

Persist the chosen mode and the reason in the checkpoint.

## What this loop does

1. **Bootstrap** the run timestamp (ISO-8601). Create `interview_questions_knowledge/runs/<ts>/checkpoints/`.
2. **Load** all input files into in-memory structures keyed by `question_id`. Validate against [`schemas/`](../schemas).
3. **Determine reference year Y** = current calendar year. Pre-compute the recency window `[Y-2, Y-1, Y]`.
4. **Pre-flag stale questions** for the convergence check and (in delta mode) for re-validation:
   - `last_confirmed_cycle < current_cycle - 4`
   - `newest_recent_year < (Y - 2)`
   - `tier == "EMERGING"`
   - `trend == "▼ DECLINING"`
   - Any question with `independent_source_count < 2`
5. **Apply schema migrations** if `state.schema_version` is older than current. (For now: trivial; document migrations here as the schema evolves.)
6. **Initialize source reliability** for any new source not yet in `source_reliability.json` with neutral prior `precision=0.7`, `weight_multiplier=1.0`.
7. **Initialize categories** if `categories.json` is missing by copying `seed_categories` from [`policies/categories.json`](../policies/categories.json) into the live registry.
8. **Initialize coverage_matrix** if missing using companies from AGENT.md Tier 5 list × all live categories, all cells with `question_count=0`.
9. **Stage the gap queue** — copy `coverage_matrix.gaps` into the checkpoint so Loop 1 can prioritize targeted sweeps for under-covered cells.

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_0.json`:

```json
{
  "cycle": 7,
  "loop": 0,
  "phase": "warm_start",
  "completed_at": "<iso>",
  "state": {
    "run_mode": "warm",
    "run_mode_reason": "last_run_at 12 days ago, between 7d and 30d threshold",
    "Y": 2026,
    "recency_window": [2024, 2025, 2026],
    "questions_loaded": 134,
    "evidence_records_loaded": 4821,
    "aliases_loaded": 312,
    "stale_question_ids": ["..."],
    "gap_queue": [
      {"company": "stripe", "category": "swe-system-design", "deficit": 1, "search_queries": ["..."]}
    ],
    "search_budget_total": 1500,
    "search_budget_used": 0
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to knowledge base

- **None yet** — Loop 0 is read-only. State updates happen in Loop 8.

## Invariants for downstream loops

- `state.run_mode` is set and downstream loops MUST honor it.
- `state.Y` is set and the recency window is fixed for the entire cycle.
- The full questions baseline is in memory; Loops 1–7 mutate copies and Loop 8 persists deltas.
- The gap_queue is non-empty if any (company, category) cell is below `min_threshold_per_cell`; Loop 1 prioritizes these.

## Failure handling

- **Corrupted JSON file**: log to `errors`, treat as if missing for that file only, do NOT abort.
- **Schema version mismatch with no migration available**: abort with a clear error message; do not silently corrupt data.
- **Missing knowledge folder + no write permissions**: abort with instructions to fix permissions.

## Notes

- This loop intentionally consumes 0 search budget.
- If `mode == "delta"`, the orchestrator skips Loops 1–5 entirely. Loop 0 still must populate the in-memory baseline because Loops 6/7/8 read from it.
