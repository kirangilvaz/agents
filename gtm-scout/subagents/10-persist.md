# Sub-agent: Loop 10 — Rank, GTM-Plan Synthesis & Memory Persist (Phase 10 + Output Format)

**Phase:** `persist` · **Loop ID:** 10 · **Always runs.** **The only loop that writes canonical files outside `runs/`, `evidence/`, `sources_cache/`, and the append-only logs.**

## Purpose

Finalize the leaderboard, derive lifecycle states and score trends, **synthesize the Go-To-Market plan** (Phase 10) plus the budget allocation, outreach strategy, and content strategy (the mission's required output sections), persist all canonical records and logs, update learned source reliability and the channel-type registry, and write the per-run diff + metrics + the report DATA object — so the next run warm-starts correctly and the report keeps improving.

## Inputs

- `runs/<brief_id>/<T>/final_set.json` (Loop 9) — or `adjusted_set.json` (delta).
- The brief (budget/objective/geo); `icp.json`; `competitors.json`.
- All prior canonical records + `score_history/<id>.jsonl`.
- `runs/<brief_id>/<T>/source_reliability_deltas.json` (Loop 9), proposed channel type (Loop 6).
- `watchlist.json`, [`policies/scoring.json`](../policies/scoring.json) (lifecycle + budget-allocation rules).
- Search budget: **0**.

## Step 1: Finalize ranks + split leaderboard / watchlist

- **Leaderboard** = opportunities with `opportunity_score >= opportunity_floor` (70). No fixed cap — everything that clears the floor is kept (the mission's "surface above 70").
- **Watchlist** = everything below 70, plus INVALIDATED-this-cycle. Persists so a future run can re-promote them.
- Rank the leaderboard by `opportunity_score` desc. Store the ROI and quick-win orderings too (the report toggles).

## Step 2: Derive lifecycle + score trend

Append this cycle to each opportunity's `score_history`, then derive `lifecycle_state` from `policies/scoring.json:lifecycle.rules` using `delta = score(this) - score(prior)`. **Any user-logged `outreach_status` (contacted/in_progress/won/declined) takes display precedence (`contacted_candidate`) and is NEVER overwritten by discovery.** Build `score_trend` (last N cycles) for the sparkline.

## Step 3: Apply anti-churn (STABILITY)

Per AGENT.md STABILITY: don't flip lifecycle/tier on cosmetic changes. A downgrade/removal requires the score to cross a tier boundary AND (for a hard removal) either dropping below the floor or an adversarial-INVALIDATED verdict. Deltas < ±3 per dimension are not material. Score history is append-only.

## Step 4: Persist canonical records

For each leaderboard opportunity, write/overwrite `opportunities/<id>.json` (validate against [`schemas/opportunity.schema.json`](../schemas/opportunity.schema.json)) with: all 6 dimension scores + rationales, opportunity_score, core_score, tier, effort + rationale, expected_roi, est_cost_usd (+ verified flag), conviction, convergence_count, amplifiers/suppressors fired, audience (verified facts), access (verified contact/availability/rates), why_it_fits, outreach_angle, curated evidence highlights, risks, adversarial summary, lifecycle_state, outreach_status (preserved), score_trend, independent_source_count, data_availability, first_seen_cycle, last_updated_cycle, as_of.

Set `last_updated_cycle = cycle`; preserve `first_seen_cycle` (or set to this cycle for new entries).

## Step 5: Synthesize the GTM plan + output sections (Phase 10)

Write `briefs_data/<brief_id>/gtm_plan.json` containing the mission's required output sections, all derived from the leaderboard (cite the opportunity_ids each recommendation rests on):

- **executive_summary** — product, ICP, budget, objective, the single headline recommendation, and the top 3 moves.
- **budget_allocation** — split the brief's **actual** budget across the top channels. Start from `policies/scoring.json:budget_allocation.default_splits_by_objective[objective.kind]`, then adjust to the surfaced opportunities and explain every line (e.g. "$900 → 3 micro-influencers @ ~$300 confirmed rate; $500 → newsletter sponsor [news-x]; $400 → community AMAs; $200 reserve"). Only allocate to channels with **verified** cost; flag any line whose cost is `Unverified`.
- **outreach_strategy** — who to contact, in what order (quick-wins first), with the per-opportunity `outreach_angle`. Sequenced by effort × ROI.
- **content_strategy** — themes/formats per channel grounded in the ICP pains/triggers.
- **gtm_plan** — phased actions:
  - **immediate (1–7 days)** — highest-ROI, lowest-effort moves (free communities, DMs, applications).
  - **short_term (30 days)** — campaigns + paid outreach within budget.
  - **mid_term (90 days)** — partnerships, affiliate program, scaling.
  - **long_term (6–12 months)** — brand building, events, ecosystem growth.
  Each action references the opportunity_ids it activates and carries its conviction.
- **confidence_notes** — for the headline recommendations, a plain-English "why this score" (conviction + the convergence signals + the key risk).

## Step 6: Append logs + update registries

- `score_history/<id>.jsonl` — append one entry per opportunity (incl. watchlist) per [`schemas/score_history.schema.json`](../schemas/score_history.schema.json).
- `source_reliability.json` — apply Loop 9 deltas: `precision = candidates_confirmed / max(candidates_proposed,1)`, `weight_multiplier = clamp(0.5 + precision, 0.5, 1.5)`, append history. Add `noise_flags` (e.g. `pay_to_play_directory`) where earned.
- `gtm_plan.json:channel_types` — if Loop 6 proposed a new type and it passed the gate, add it (re-tag its cluster).
- `watchlist.json` — overwrite with the current sub-floor set (cap to a reasonable size, e.g. top 200 by score).
- `aliases.json` — ensure all names/handles resolve.

## Step 7: Update state.json

```json
{
  "schema_version": "1.0",
  "active_brief": "ai-stock-signals",
  "briefs": {
    "ai-stock-signals": { "cycle": 3, "last_run_at": "<iso>", "run_mode": "warm", "leaderboard_size": 44, "watchlist_size": 131 }
  }
}
```

## Step 8: Write diff + metrics

- `runs/<brief_id>/<T>/diff.json` per [`schemas/diff.schema.json`](../schemas/diff.schema.json): ADDED / REMOVED / TIER_UPGRADE / TIER_DOWNGRADE / SCORE_MOVED (≥3) / LIFECYCLE_CHANGE / ROI_CHANGE / EFFORT_CHANGE / NEW_BUYING_SIGNAL / ADVERSARIAL_INVALIDATED / CONVICTION_CHANGE / CHANNEL_TYPE_ADDED / PROMOTED_FROM_WATCHLIST / DEMOTED_TO_WATCHLIST / OUTREACH_STATUS_CHANGE, plus a `summary`. Compare to the prior cycle's leaderboard.
- `runs/<brief_id>/<T>/metrics.json`: search budget (total/used/by_loop), cache hit rate, convergence (passes_run, converged, stopped_reason), evidence totals, % verified vs estimated vs unverified reach claims, score drift vs prior cycle, data_availability.

## Step 9: Stage the report DATA object

Assemble `runs/<brief_id>/<T>/report_data.json` — the exact object Loop 11 embeds (no recompute in Loop 11). See [`subagents/11-html-build.md`](11-html-build.md) for the DATA shape (metadata + brief + channel_type_meta + opportunities + the GTM-plan sections).

## Output checkpoint

```json
{
  "cycle": 3,
  "loop": 10,
  "phase": "persist",
  "completed_at": "<iso>",
  "state": {
    "leaderboard_size": 44,
    "watchlist_size": 131,
    "canonical_written": 44,
    "score_history_appended": 175,
    "channel_types_added": 1,
    "source_reliability_updated": 26,
    "gtm_plan_path": "briefs_data/ai-stock-signals/gtm_plan.json",
    "diff_path": "runs/ai-stock-signals/<T>/diff.json",
    "metrics_path": "runs/ai-stock-signals/<T>/metrics.json",
    "report_data_path": "runs/ai-stock-signals/<T>/report_data.json"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to memory

- `opportunities/<id>.json` (overwritten), `score_history/<id>.jsonl` (appended), `gtm_plan.json`, `source_reliability.json`, `watchlist.json`, `aliases.json`, `state.json` (updated).
- `runs/<brief_id>/<T>/diff.json`, `metrics.json`, `report_data.json`.

## Invariants

- After Loop 10, memory is consistent: `state.briefs[brief_id].cycle == cycle`, every leaderboard opportunity has a valid canonical record and a fresh score_history line.
- Every GTM-plan recommendation references at least one opportunity_id on the leaderboard.
- No budget line allocates real money to an `Unverified`-cost channel without flagging it.
- Score history is append-only; every `outreach_status` is preserved.

## Failure handling

- **Schema validation failure on a record:** do NOT persist that record or overwrite `state.json`; write the error and keep the prior cycle's data for that opportunity. A partial-but-valid persist is acceptable; a corrupt one is not.
- **Disk/write error:** leave prior memory intact, surface the error.

## Delta-mode behavior

Runs identically but only re-persists refreshed opportunities + appends their score_history; untouched records keep their prior canonical files. The GTM plan is refreshed (budget/outreach order may shift with new buying signals). The diff is smaller.
