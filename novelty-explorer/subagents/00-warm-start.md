# Sub-agent: Loop 0 — Warm Start

**Phase:** `warm_start` · **Loop ID:** 0 · **Always runs first.**

## Purpose

Load all prior knowledge from `novelty_explorer_memory/`, decide the run mode (`cold` / `warm` / `delta`), seed the domain registry on first run, and stage the in-memory state every downstream loop uses. This is the single biggest reason re-runs improve instead of starting from scratch.

## Required / optional inputs (from the orchestrator)

- `mode` — optional override: `cold` | `warm` | `delta` | `auto` (default `auto`).
- `focus` — optional domain id to bias discovery (e.g. `focus=ENERGY`). Does NOT drop other domains.
- `archive` — optional `true` to also write a timestamped archive copy in Loop 9.
- `--reset` — discard prior canonical memory and force a cold start.

## Inputs (read; missing files imply cold start — do not error)

| Path | Purpose |
|------|---------|
| `novelty_explorer_memory/state.json` | Global state: schema_version, cycle, last_run_at |
| `novelty_explorer_memory/domains.json` | Live domain registry |
| `novelty_explorer_memory/opportunities/*.json` | All prior canonical opportunity records |
| `novelty_explorer_memory/score_history/*.jsonl` | Per-opportunity conviction trajectory |
| `novelty_explorer_memory/watchlist.json` | Sub-floor opportunities kept for re-evaluation |
| `novelty_explorer_memory/source_reliability.json` | Learned source weights |
| `novelty_explorer_memory/aliases.json` | Name → opportunity_id map |
| [`policies/convergence.json`](../policies/convergence.json) | `cold_after_days`, `delta_after_days` |
| [`policies/domains.json`](../policies/domains.json) | Seed domains (used only on cold start) |

## Run-mode decision logic

```
if memory folder missing OR --reset in prompt:
    mode = "cold"
elif prompt contains "mode=cold|warm|delta":
    mode = user override
elif now - state.last_run_at < policies.delta_after_days (default 3 days):
    mode = "delta"
elif now - state.last_run_at >= policies.cold_after_days (default 14 days):
    mode = "warm"   # full pipeline, but honor caches; not a true cold rebuild
else:
    mode = "warm"   # 3-14 day window
```

> Note: in this agent `warm` is the default for any non-recent run because discovery should re-sweep all sources; `cold` differs only in that it ignores caches and re-derives everything from scratch (used by `--reset` or a missing memory folder).

Persist the chosen mode and the reason in the checkpoint.

## What this loop does

1. **Bootstrap** the run timestamp `T` (ISO-8601) and reference year `Y`. Create `novelty_explorer_memory/runs/<T>/checkpoints/`.
2. **Compute next cycle number**: `cycle = (state.cycle ?? 0) + 1`.
3. **Seed domains** — on cold start (or if `domains.json` missing), copy `policies/domains.json:seed_domains` into `novelty_explorer_memory/domains.json`. Otherwise load the live registry (seeds + any discovered domains).
4. **Load** all opportunity records + their score_history into in-memory structures keyed by `opportunity_id`. Validate against [`schemas/opportunity.schema.json`](../schemas/opportunity.schema.json).
5. **Initialize source reliability** for any source domain not yet present with neutral prior `precision=0.7`, `weight_multiplier=1.0`.
6. **Stage stale-data flags** — for each opportunity, mark which signal classes have evidence whose newest `fetched_at` exceeds the per-domain TTL in [`policies/source_ttl.json`](../policies/source_ttl.json). Warm/delta runs re-fetch stale signals; cold ignores all caches.
7. **Stage delta short-list** — if `delta`, build the list of existing opportunities to refresh (momentum/capital/news per `policies/convergence.json:delta_mode`) plus reserve budget for a new-entrant scan.
8. **Derive prior lifecycle baseline** — from score_history, compute each opportunity's prior `composite` and `lifecycle_state` so Loop 8 can compute deltas.

## Output checkpoint

Write to `runs/<T>/checkpoints/cycle_{N}_loop_0.json`:

```json
{
  "cycle": 7,
  "loop": 0,
  "phase": "warm_start",
  "completed_at": "<iso>",
  "state": {
    "run_mode": "warm",
    "run_mode_reason": "last_run_at 9 days ago, within 3-14d window",
    "focus": null,
    "archive": false,
    "T": "2026-05-30T18:00:00Z",
    "Y": 2026,
    "prior_opportunity_count": 41,
    "prior_leaderboard_count": 33,
    "domains_loaded": 13,
    "watchlist_count": 58,
    "stale_signal_classes": { "cortical-labs": ["momentum", "investment"] },
    "delta_refresh_ids": [],
    "search_budget_total": 1500,
    "search_budget_used": 0
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to memory

- **None yet** — Loop 0 is read-only except seeding `domains.json` on a true cold start. Canonical updates happen in Loop 8.

## Invariants for downstream loops

- `state.run_mode`, `state.focus`, `state.T`, `state.Y` are set; downstream loops MUST honor them.
- The live domain registry is loaded; Loop 5 may extend it (gated).
- Prior canonical records and score_history are in memory; Loops 1–7 mutate copies and Loop 8 persists deltas.
- `stale_signal_classes` lists what must be re-fetched even in warm mode.

## Failure handling

- **Corrupted JSON file:** log to `errors`, treat as missing for that file only, do NOT abort.
- **Schema version mismatch with no migration:** abort with a clear message; do not silently corrupt data.
- **Missing memory folder + no write permission:** abort with instructions to fix permissions.

## Notes

- Loop 0 consumes 0 search budget.
- If `mode == "delta"`, the orchestrator skips Loops 2, 3, 5, 7 (Loop 5 may be re-inserted per `policies/convergence.json:delta_mode.conditional_loops`). Loop 0 still populates the full in-memory baseline because Loops 1/4/6/8/9 read from it.
