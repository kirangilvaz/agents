# Sub-agent: Loop 0 — Warm Start

**Phase:** `warm_start` · **Loop ID:** 0 · **Always runs first.**

## Purpose

Load all prior knowledge for the target ticker from `ticker_research_knowledge/`, decide the run mode (`cold` / `warm` / `delta`), and stage the in-memory state every downstream loop will use. This is the single biggest reason re-runs improve over time instead of starting from scratch.

## Required input

The orchestrator MUST pass:
- `ticker` — uppercase symbol (e.g. `NVDA`, `BTC-USD`, `SPY`). Required.
- `mode` — optional override: `cold` | `warm` | `delta` | `auto` (default `auto`).

## Inputs

Read these files. Missing files imply cold start; do not error.

| Path | Purpose |
|------|---------|
| `ticker_research_knowledge/state.json` | Global state: schema_version, last_run_at (any ticker), watchlist |
| `ticker_research_knowledge/tickers/<TICKER>/canonical.json` | Last finalized record for THIS ticker |
| `ticker_research_knowledge/tickers/<TICKER>/score_history.jsonl` | Score trajectory |
| `ticker_research_knowledge/tickers/<TICKER>/iteration_log.jsonl` | All prior refinement passes |
| `ticker_research_knowledge/tickers/<TICKER>/evidence/*.jsonl` | Per-dimension evidence baseline |
| `ticker_research_knowledge/source_reliability.json` | Cross-ticker learned source weights |
| `ticker_research_knowledge/macro_state.json` | Cached macro regime + indicators (TTL ~6h) |
| `ticker_research_knowledge/correlated_universe.json` | Cross-ticker correlation cache |
| [`policies/convergence.json`](../policies/convergence.json) | `cold_after_days`, `delta_after_hours`, etc. |

## Run-mode decision logic

```
if canonical.json missing OR --reset flag in user prompt:
    mode = "cold"
elif user prompt contains "mode=cold|warm|delta":
    mode = user override
elif now - canonical.as_of < policies.delta_after_hours (default 24):
    mode = "delta"
elif now - canonical.as_of >= policies.cold_after_days (default 7):
    mode = "cold"   # data too stale, treat as fresh start
else:
    mode = "warm"   # 24h - 7d window
```

Persist the chosen mode and the reason in the checkpoint.

## Asset class detection

If `canonical.asset_class` exists, use it. Otherwise infer from the ticker:

- Suffix `-USD` / `-USDT` / matches CoinGecko slug → `CRYPTO`
- Listed in known ETF universe (`SPY`, `QQQ`, `XLE`, `ARKK`, `TLT`, `GLD`, `SOXX`, `XBI`, etc.) or has `:ETF` suffix → `ETF`
- Otherwise → `STOCK` (let Loop 1 confirm by checking exchange listing)

The asset class drives which Tier 6 (crypto) sources are queried and which subscore variants from `policies/weights.json` apply.

## What this loop does

1. **Bootstrap** the run timestamp `T` (ISO-8601). Create `ticker_research_knowledge/tickers/<TICKER>/runs/<T>/checkpoints/`.
2. **Load** all input files into in-memory structures keyed by `dimension`. Validate against [`schemas/`](../schemas).
3. **Determine asset class** per the rules above.
4. **Compute next cycle number**: `cycle = (canonical.cycle ?? 0) + 1`.
5. **Apply schema migrations** if the loaded `canonical.schema_version` is older than current. (For now: trivial.)
6. **Initialize source reliability** for any new source not yet in `source_reliability.json` with neutral prior `precision=0.7`, `weight_multiplier=1.0`.
7. **Stage stale-data flags** — for each dimension, mark stale if its newest evidence `fetched_at` exceeds the per-domain TTL in `policies/source_ttl.json`.
8. **Stage delta-mode short list** — if mode is `delta`, build a list of dimensions that always re-fetch per `policies/convergence.json:delta_mode.always_refresh_dims`.
9. **Delta-mode price refresh** — if mode is `delta`, perform ONE lightweight price-only fetch (a single Tier 1 snapshot, e.g. Finviz or Yahoo) to update `price.current`, `price.day_change_pct`, `price.prior_close`, and `atr_14`. Loop 1 (which normally captures the price snapshot) is skipped in delta, so without this the report header and Loop 16's ATR bands would render stale prices from the prior warm/cold run. This is the only fetch Loop 0 ever makes, and only in delta mode (budget: 1, counted against `delta_total_cap`). In cold/warm mode Loop 0 still consumes 0 budget.

## Output checkpoint

Write to `runs/<T>/checkpoints/cycle_{N}_loop_0.json`:

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 0,
  "phase": "warm_start",
  "completed_at": "<iso>",
  "state": {
    "run_mode": "warm",
    "run_mode_reason": "last_run_at 3 days ago, between delta_after_hours and cold_after_days",
    "asset_class": "STOCK",
    "T": "2026-04-30T20:00:00Z",
    "prior_canonical_loaded": true,
    "prior_composite": 87,
    "prior_direction": "BULLISH",
    "evidence_baseline": { "fundamentals": 12, "earnings": 8, "analyst": 21, "...": "..." },
    "stale_dimensions": ["news", "sentiment_social"],
    "always_refresh_dims": [],
    "search_budget_total": 1200,
    "search_budget_used": 0
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to knowledge base

- **None yet** — Loop 0 is read-only. State updates happen in Loop 17.

## Invariants for downstream loops

- `state.run_mode` and `state.asset_class` are set; downstream loops MUST honor them.
- `state.T` is fixed for the entire cycle.
- Prior canonical record (if any) is in memory; Loops 1–14 mutate copies and Loop 17 persists deltas.
- `stale_dimensions` lists what must be re-fetched even in warm mode.

## Failure handling

- **Corrupted JSON file**: log to `errors`, treat as if missing for that file only, do NOT abort.
- **Schema version mismatch with no migration available**: abort with a clear error message; do not silently corrupt data.
- **Missing knowledge folder + no write permissions**: abort with instructions to fix permissions.
- **Ambiguous asset class**: default to `STOCK`, flag in `errors` for the user to override on next run.

## Notes

- This loop consumes 0 search budget in cold/warm mode. In **delta mode only**, it makes a single price-only fetch (step 9) so the report doesn't show a stale price — counted as 1 search against `delta_total_cap`.
- If `mode == "delta"`, the orchestrator skips Loops 1–4, 7, 9, 10, 12–15 (Loop 12 may be re-inserted per `policies/convergence.json:delta_mode.conditional_loops`). Loop 0 still must populate the in-memory baseline because Loops 5/6/8/11/16/17 read from it.
