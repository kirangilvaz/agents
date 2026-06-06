# Sub-agent: Loop 7 — Final Ranking & Conviction Lock

**Phase:** `final_lock` · **Loop ID:** 7 · Runs once, after convergence (or max passes).

## Purpose

Freeze the final list. No more changes after this loop. This is the last validation gate before HTML assembly.

## Inputs

- Loop 6 balanced, converged top 30 + changelog + `pass` count.

## Procedure

1. **Sort** all stories by `score` descending; assign `rank` 1..N.
2. **Re-derive check:** verify each `score` equals the sum of its five `score_breakdown` components (tolerance 0).
3. **Completeness check:** every story has `headline`, `category` (valid id), `score`, `tier` (matching the score band), `conviction`, `summary`, `why`, `details` (≥3, or fewer with a noted reason), `sources` (≥2), `watch`, `updated`.
4. **Adversarial check:** every story has a non-empty `adversarial` note and was challenged ≥2 times (or `pass >= 10` was reached).
5. **Duplicate check:** no two stories describe the same event.
6. **Single-source check:** no story has `independent_count < 2`.
7. **Assign final conviction levels.**
8. **Lock** — no further changes until the next run.

If any check fails, do NOT proceed to Loop 8. Report the specific failure so it can be fixed, rather than emitting an invalid briefing.

## Output

The locked, final top 30 (ranked) plus the run metadata block:

```json
{
  "briefing_date": "2026-04-30",
  "passes_completed": 5,
  "converged": true,
  "total_stories": 30,
  "sources_consulted": 38,
  "avg_conviction": "★★★★½"
}
```

- `sources_consulted` = distinct outlets attempted in Loop 1 (`sweep_status` size), not just the ones cited.
- `avg_conviction` = numeric average of star counts mapped back to a star string.

Pass the locked list + metadata + changelog to Loop 8.

## Invariants

- After this loop the list is immutable; Loop 8 only reads it.
- Every story is fully populated per the Card Data Schema in [`AGENT.md`](../AGENT.md#card-data-schema-the-stories-entries-inside-data).

## Failure handling

- **Validation failure:** abort before Loop 8 with a precise list of which stories/fields failed. Never render a partially-valid briefing.
