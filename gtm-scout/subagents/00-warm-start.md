# Sub-agent: Loop 0 — Warm Start (Normalize Brief, Load Memory, Decide Mode)

**Phase:** `warm_start` · **Loop ID:** 0 · **Always runs first.**

## Purpose

Normalize the user's free-form product brief into [`schemas/brief.schema.json`](../schemas/brief.schema.json), load all prior knowledge for this `brief_id` from `gtm_scout_memory/`, decide the run mode (`cold` / `warm` / `delta`), and stage the in-memory state every downstream loop uses. This is the single biggest reason re-runs improve instead of starting from scratch.

## Required / optional inputs (from the orchestrator)

- **The product brief** (free-form text): product description, website, target customer, industry, geo, budget, objective.
- `mode` — optional override: `cold` | `warm` | `delta` | `auto` (default `auto`).
- `focus` — optional opportunity type to bias discovery (e.g. `focus=INFLUENCER`). Does NOT drop other types.
- `archive` — optional `true` to also write a timestamped archive copy in Loop 11.
- `--reset` — discard prior canonical memory for this brief and force a cold start.

## Step 1: Normalize the brief

1. Derive `brief_id = kebab-case(product_name)` (e.g. `ai-stock-signals`). If the user didn't name the product, slugify a 2–4 word description.
2. Extract every brief field. Parse the budget into `{amount_usd, period, raw}` (e.g. `$2,000/month` → `{2000, "monthly", "$2,000/month"}`). Classify `objective.kind` (first_customers / scale_acquisition / brand_awareness / lead_gen / retention / other) and `product_kind` (saas / mobile_app / service / investment_product / …).
3. **Do NOT invent missing fields.** If geo, industry, or competitors aren't given, leave them empty — Loop 1/2 infer them from research and mark inferred values as such.
4. Write `gtm_scout_memory/briefs/<brief_id>.json` (validate against the schema). On a warm/delta run, merge with the existing brief (the user may have updated budget/objective); preserve `created_at`, set `updated_at`.

## Step 2: Load prior memory for this brief

| Path | Purpose |
|------|---------|
| `gtm_scout_memory/state.json` | Global state: schema_version, cycle, last_run_at, active_brief |
| `gtm_scout_memory/briefs/<brief_id>.json` | Prior brief (merge) |
| `gtm_scout_memory/briefs_data/<brief_id>/opportunities/*.json` | All prior canonical opportunity records |
| `gtm_scout_memory/briefs_data/<brief_id>/score_history/*.jsonl` | Per-opportunity score trajectory |
| `gtm_scout_memory/briefs_data/<brief_id>/watchlist.json` | Sub-floor opportunities kept for re-evaluation |
| `gtm_scout_memory/briefs_data/<brief_id>/icp.json`, `competitors.json`, `gtm_plan.json` | Prior research artifacts |
| `gtm_scout_memory/source_reliability.json` | Learned source weights (global) |
| `gtm_scout_memory/briefs_data/<brief_id>/aliases.json` | Name/handle → opportunity_id map |
| [`policies/convergence.json`](../policies/convergence.json) | `cold_after_days`, `delta_after_days` |
| [`policies/channels.json`](../policies/channels.json) | Seed channel-type registry (used on cold start) |

Missing files imply a cold start for this brief — do NOT error.

## Run-mode decision logic

```
if no memory for this brief_id OR --reset in prompt:
    mode = "cold"
elif prompt contains "mode=cold|warm|delta":
    mode = user override
elif now - state.last_run_at(for this brief) < delta_after_days (default 3):
    mode = "delta"
else:
    mode = "warm"   # >= 3 days: re-sweep all channel classes, honoring caches
```

> `warm` re-sweeps all sources but honors cache TTLs; `cold` ignores caches and re-derives from scratch (used by `--reset` or a missing brief memory).

Persist the chosen mode and the reason in the checkpoint.

## Step 3: Stage in-memory state

1. **Bootstrap** the run timestamp `T` (ISO-8601) and reference year `Y`. Create `gtm_scout_memory/runs/<brief_id>/<T>/checkpoints/`.
2. **Compute next cycle number**: `cycle = (state.cycle_for_brief ?? 0) + 1`.
3. **Seed channel types** — on cold start (or if `gtm_plan.json:channel_types` missing), copy `policies/channels.json:channel_types`. Otherwise load the live registry (seeds + any discovered types).
4. **Load** all opportunity records + their score_history into in-memory structures keyed by `opportunity_id`. Validate against [`schemas/opportunity.schema.json`](../schemas/opportunity.schema.json). **Preserve every `outreach_status`** — user-logged status is sacred.
5. **Initialize source reliability** for any source domain not yet present with neutral prior `precision=0.7`, `weight_multiplier=1.0`.
6. **Stage stale-data flags** — mark which signal classes have evidence whose newest `fetched_at` exceeds the per-domain TTL in [`policies/source_ttl.json`](../policies/source_ttl.json). Warm/delta re-fetch stale signals; cold ignores all caches.
7. **Stage delta short-list** — if `delta`, build the list of existing opportunities to refresh (growth/buying signals + reach per `policies/convergence.json:delta_mode`) plus reserve budget for a new-entrant scan.

## Output checkpoint

Write to `runs/<brief_id>/<T>/checkpoints/cycle_{N}_loop_0.json`:

```json
{
  "cycle": 3,
  "loop": 0,
  "phase": "warm_start",
  "completed_at": "<iso>",
  "state": {
    "brief_id": "ai-stock-signals",
    "run_mode": "warm",
    "run_mode_reason": "last_run_at 9 days ago",
    "focus": null,
    "archive": false,
    "T": "2026-05-31T17:00:00Z",
    "Y": 2026,
    "brief_summary": { "product_kind": "saas", "budget_usd": 2000, "budget_period": "monthly", "objective_kind": "first_customers", "geo": ["US"], "b2b_or_b2c": "b2c" },
    "prior_opportunity_count": 58,
    "prior_leaderboard_count": 41,
    "channel_types_loaded": 11,
    "watchlist_count": 92,
    "stale_signal_classes": { "inf-the-plain-bagel": ["growth_signals", "reach"] },
    "delta_refresh_ids": [],
    "search_budget_total": 1600,
    "search_budget_used": 0
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to memory

- `briefs/<brief_id>.json` — written/merged (the normalized brief).
- Otherwise **read-only** — canonical opportunity updates happen in Loop 10.

## Invariants for downstream loops

- `state.brief_id`, `run_mode`, `focus`, `T`, `Y` are set; downstream loops MUST honor them.
- The normalized brief is written and validates; downstream loops read budget/objective/geo from it.
- The live channel-type registry is loaded; Loop 6 may extend it (gated).
- Prior canonical records and score_history are in memory; Loops 1–9 mutate copies and Loop 10 persists deltas.
- Every prior `outreach_status` is preserved.

## Failure handling

- **Corrupted JSON file:** log to `errors`, treat as missing for that file only, do NOT abort.
- **Schema version mismatch with no migration:** abort with a clear message; do not silently corrupt data.
- **Brief cannot be parsed (no product description):** abort and ask the user for at least a product description — it's the one required field.
- **Missing memory folder + no write permission:** abort with instructions to fix permissions.

## Notes

- Loop 0 consumes 0 search budget.
- If `mode == "delta"`, the orchestrator skips Loops 1, 2, 4, 5, 6, 9 (Loop 9 may be re-inserted per `policies/convergence.json:delta_mode.conditional_loops`). Loop 0 still populates the full in-memory baseline because Loops 3/7/8/10/11 read from it.
