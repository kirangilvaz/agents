# Sub-agent: Loop 8 — Ranking, Lifecycle & Memory Persist

**Phase:** `persist` · **Loop ID:** 8 · **Always runs.** **The only loop that writes canonical files outside `runs/`, `evidence/`, `sources_cache/`, and the append-only logs.**

## Purpose

Finalize the leaderboard, derive lifecycle states and conviction trends, persist all canonical opportunity records and append-only logs, update the domain registry and learned source reliability, and write the per-run diff + metrics — so the next run warm-starts correctly and the report keeps improving.

## Inputs

- `runs/<T>/final_set.json` (Loop 7) — or `adjusted_set.json` (delta).
- All prior canonical records + `score_history/<id>.jsonl`.
- `runs/<T>/source_reliability_deltas.json` (Loop 5), proposed domain (Loop 5).
- `watchlist.json`, [`policies/weights.json`](../policies/weights.json) (lifecycle rules).
- Search budget: **0**.

## Step 1: Finalize ranks + split leaderboard / watchlist

- **Leaderboard** = opportunities with `composite_score >= conviction_floor` (60). No fixed cap — everything that clears the floor is kept.
- **Watchlist** = everything below the floor (NOISE / EMERGING_SIGNAL that dipped), plus INVALIDATED-this-cycle. These persist in `watchlist.json` so a future run can re-promote them if conviction improves.
- Rank the leaderboard by `composite_score` desc; store `time_adjusted_score` too (report toggles).

## Step 2: Derive lifecycle + conviction trend

For each opportunity, append this cycle to its `score_history`, then derive `lifecycle_state` from `policies/weights.json:lifecycle.rules` using `delta = composite(this) - composite(prior)`:

- `emerging` (first appearance or 60–69) · `rising` (delta ≥ +3 and composite ≥ 70) · `high_conviction` (composite ≥ 80, |delta| < 3) · `peaked` (composite ≥ 80, delta ≤ −3) · `mainstreamed` (crowding > crowded_above and ttm == TTM_0_2) · `faded` (below floor for 2 consecutive cycles).

Build `conviction_trend` (last N cycles of composite) for the report sparkline.

## Step 3: Apply anti-churn (STABILITY)

Per AGENT.md STABILITY: do NOT flip an opportunity's lifecycle/tier on cosmetic changes. A downgrade or removal requires the conviction to cross a tier boundary AND (for a hard removal) either dropping below the floor or an adversarial-INVALIDATED verdict. Score deltas < ±3 per dimension are not material. Score history is append-only — never overwrite past entries.

## Step 4: Persist canonical records

For each leaderboard opportunity, write/overwrite `opportunities/<id>.json` (validate against [`schemas/opportunity.schema.json`](../schemas/opportunity.schema.json)) with: all 5 dimension scores + rationales, composite, core_composite, time_adjusted, tier, ttm + rationale, convergence_count, amplifiers/suppressors fired, crowding + label, lifecycle_state, conviction_trend, why_it_matters, investment_thesis, capital_signals, curated evidence highlights, risks, adversarial summary, independent_source_count, data_availability, first_seen_cycle, last_updated_cycle, as_of.

Set `last_updated_cycle = cycle`; preserve `first_seen_cycle` from the prior record (or set to this cycle for new entries).

## Step 5: Append logs + update registries

- `score_history/<id>.jsonl` — append one entry per opportunity (incl. watchlist) per [`schemas/score_history.schema.json`](../schemas/score_history.schema.json).
- `iteration_log/<id>.jsonl` — already appended by Loop 5; ensure consistency.
- `source_reliability.json` — apply Loop 5 deltas: recompute `precision = candidates_confirmed / max(candidates_proposed,1)`, `weight_multiplier = clamp(0.5 + precision, 0.5, 1.5)`, append history.
- `domains.json` — if Loop 5 proposed a new domain and it passed the gate, add it (re-tag its cluster's opportunities from FRONTIER).
- `watchlist.json` — overwrite with the current sub-floor set (capped to a reasonable size, e.g. keep top 200 by composite).
- `aliases.json` — ensure all names resolve.

## Step 6: Update state.json

```json
{
  "schema_version": "1.0",
  "cycle": 7,
  "last_run_at": "<iso>",
  "run_mode": "warm",
  "leaderboard_size": 66,
  "watchlist_size": 188,
  "domain_count": 14,
  "opportunities_tracked": 254
}
```

## Step 7: Write diff + metrics

- `runs/<T>/diff.json` per [`schemas/diff.schema.json`](../schemas/diff.schema.json): ADDED / REMOVED / TIER_UPGRADE / TIER_DOWNGRADE / SCORE_MOVED (≥3) / LIFECYCLE_CHANGE / TTM_CHANGE / NEW_CAPITAL_SIGNAL / ADVERSARIAL_INVALIDATED / CROWDING_CHANGE / DOMAIN_ADDED / PROMOTED_FROM_WATCHLIST / DEMOTED_TO_WATCHLIST, plus a `summary` block. Compare to the prior cycle's leaderboard.
- `runs/<T>/metrics.json`: search budget (total/used/by_loop), cache hit rate, convergence (passes_run, converged, stopped_reason), evidence totals, conviction drift vs prior cycle, data_availability.

## Output checkpoint

```json
{
  "cycle": 7,
  "loop": 8,
  "phase": "persist",
  "completed_at": "<iso>",
  "state": {
    "leaderboard_size": 66,
    "watchlist_size": 188,
    "canonical_written": 66,
    "score_history_appended": 254,
    "domains_added": 1,
    "source_reliability_updated": 41,
    "diff_path": "runs/<T>/diff.json",
    "metrics_path": "runs/<T>/metrics.json",
    "report_data_path": "runs/<T>/report_data.json"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Step 8: Stage the report DATA object

Assemble `runs/<T>/report_data.json` — the exact object Loop 9 embeds. Loop 9 does NOT recompute anything; it only fills the template. See [`subagents/09-html-build.md`](09-html-build.md) for the DATA shape.

## Outputs to memory

- `opportunities/<id>.json` (overwritten), `score_history/<id>.jsonl` (appended), `source_reliability.json`, `domains.json`, `watchlist.json`, `aliases.json`, `state.json` (updated).
- `runs/<T>/diff.json`, `runs/<T>/metrics.json`, `runs/<T>/report_data.json`.

## Invariants

- After Loop 8, memory is fully consistent: `state.cycle == cycle`, every leaderboard opportunity has a valid canonical record and a fresh score_history line.
- `diff.json.summary` matches the actual entries.
- Score history is append-only (no prior entries mutated).

## Failure handling

- **Schema validation failure on a record:** do NOT persist that record or overwrite `state.json`; write the error and keep the prior cycle's data for that opportunity intact. A partial-but-valid persist is acceptable; a corrupt one is not.
- **Disk/write error:** leave prior memory intact, surface the error.

## Delta-mode behavior

Runs identically but only re-persists refreshed opportunities + appends their score_history; untouched records keep their prior canonical files. The diff is smaller.
