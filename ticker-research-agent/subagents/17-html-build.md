# Sub-agent: Loop 17 — Final Assembly, Persistence & HTML Build

**Phase:** `html_build` · **Loop ID:** 17 · **Always runs last.** **The only loop that writes to canonical files outside `runs/`, `evidence/`, `sources_cache/`, `score_history.jsonl`, and `iteration_log.jsonl`.**

## Purpose

Persist all staged changes from prior loops, render the dashboard HTML report, write the structured diff and metrics, and update `state.json` and per-ticker `canonical.json` so the next run can warm-start correctly.

## Inputs

- All checkpoints (Loops 0–16) for the current cycle
- `runs/<T>/draft_canonical.json` (locked by Loop 15, outlooks populated by Loop 16)
- All evidence files
- Loop 12's `source_reliability_deltas`
- [`templates/ticker_report_template.html`](../templates/ticker_report_template.html)

## Step 1: Final canonical assembly

Validate `runs/<T>/draft_canonical.json` against [`schemas/ticker_report.schema.json`](../schemas/ticker_report.schema.json):

1. All required fields present.
2. `composite_score` matches the math from `subscores` × weights (re-derive and compare; tolerance ±1).
3. `direction` matches the rules from Loop 11 Step 6.
4. `conviction_tier` matches the score range.
5. Every subscore has a `direction` and `rationale`.
6. Outlook scenarios sum to 1.0 per horizon (for each of `near_term_outlook`, `long_term_outlook`, and `mid_term_outlook` if the latter is present).
7. ≥10 correlated tickers (cold/warm; this check is skipped in delta). This is the single source of truth for the minimum — the schema's `correlated_tickers.minItems` is intentionally 0 because delta runs may carry fewer.
8. ≥3 risks and ≥3 invalidation triggers.
9. `mid_term_outlook` is OPTIONAL — validate it against the schema only if present (Loop 16 emits it only when catalyst conditions are met). Its absence is not an error.

If any check fails, abort the run with a partial checkpoint and detailed errors. **Do NOT** overwrite `canonical.json` or `state.json` — the previous cycle's data stays intact.

## Step 2: Compute report metadata

```json
{
  "cycle": 12,
  "as_of": "2026-04-30T20:00:00Z",
  "passes_run": 5,
  "converged": true,
  "evidence_count_total": 187,
  "sources_used": 28,
  "correlated_tickers_count": 14,
  "data_availability": "FULL",
  "run_mode": "warm"
}
```

## Step 3: Render the HTML report

1. Read [`templates/ticker_report_template.html`](../templates/ticker_report_template.html) verbatim.
2. Replace placeholders:

| Placeholder | Source |
|-------------|--------|
| `__TICKER__` | `canonical.ticker` |
| `__NAME__` | `canonical.name` |
| `__SECTOR__` | `canonical.sector` |
| `__ASSET_CLASS__` | `canonical.asset_class` |
| `__AS_OF__` | `metadata.as_of` (formatted "Apr 30, 2026 · 1:00 PM PT") |
| `__CYCLE__` | `metadata.cycle` |
| `__PASSES__` | `metadata.passes_run` |
| `__CURRENT_PRICE__` | `canonical.price.current` |
| `__DAY_CHANGE__` | `canonical.price.day_change_pct` |
| `__COMPOSITE_SCORE__` | `canonical.composite_score` |
| `__CONVICTION_TIER__` | `canonical.conviction_tier` |
| `__DIRECTION__` | `canonical.direction` |
| `__REPORT_DATA__` | `JSON.stringify(canonical)` (the entire record, embedded as a JS object the template renders from) |
| `__METADATA__` | `JSON.stringify(metadata)` |
| `__RUN_MODE__` | `metadata.run_mode` |

3. Write to `ticker_research_knowledge/tickers/<TICKER>/runs/<T>/report.html`.

**Do NOT alter** the CSS or JS structure of the template. If a feature requires a template change, edit `templates/ticker_report_template.html` directly.

## Step 4: Persist canonical knowledge

This is the only loop that mutates files outside the `runs/`, `evidence/`, etc. paths.

1. **`tickers/<TICKER>/canonical.json`** — write/overwrite with the locked record.
2. **`tickers/<TICKER>/score_history.jsonl`** — append one entry:
   ```json
   {
     "cycle": 12,
     "as_of": "2026-04-30T20:00:00Z",
     "composite": 84,
     "core_only_composite": 84,
     "tier": "MODERATE",
     "direction": "BULLISH",
     "near_term": "BULLISH",
     "long_term": "BULLISH",
     "fair_value": 1010.0,
     "current_price": 925.50,
     "delta_vs_prior": -3
   }
   ```
3. **`source_reliability.json`** — apply Loop 12 deltas:
   - For each source: update `candidates_proposed`, `candidates_confirmed`, `candidates_invalidated`
   - Recompute `precision = candidates_confirmed / max(candidates_proposed, 1)`
   - Recompute `weight_multiplier = clamp(0.5 + precision, 0.5, 1.5)`
   - Append history entry
4. **`correlated_universe.json`** — write any new correlated pairs discovered.
5. **`state.json`** — update:
   ```json
   {
     "schema_version": "1.0",
     "last_run_at": "<iso>",
     "watchlist_count": 12,
     "tickers_analyzed_count": 47,
     "last_ticker": "NVDA"
   }
   ```

## Step 5: Write the structured diff

Build `runs/<T>/diff.json` per [`schemas/diff.schema.json`](../schemas/diff.schema.json):

- Compare current canonical vs prior `canonical.json` (if any).
- Build entries for each subscore that moved by ≥3, every direction flip, fair value revision, outlook change, new risk, cleared risk, signal lifecycle event.
- `summary` block tallies composite_delta, tier_change, direction_flipped, etc.

## Step 6: Write metrics

```json
{
  "cycle": 12,
  "completed_at": "<iso>",
  "search_budget": {
    "total": 1200,
    "used": 643,
    "by_loop": {"1": 9, "2": 4, "3": 11, "4": 6, "5": 14, "6": 7, "7": 22, "8": 9, "9": 6, "10": 3, "12": 24, "13": 9, "14": 8, "15": 489, "16": 4},
    "_note": "The loop_15 figure is the aggregate of re-dispatched Loops 11-14 across iteration passes 2..N, not searches loop 15 itself issued (it issues none). See policies/convergence.json:search_budget._note_loop_15."
  },
  "cache": {
    "hits": 87,
    "misses": 64,
    "hit_rate": 0.58
  },
  "convergence": {
    "converged": true,
    "passes_run": 5,
    "stopped_reason": "converged",
    "final_conviction_delta": 0
  },
  "evidence": {
    "total_records": 187,
    "tier1_2_records": 96,
    "counter_evidence_records": 11,
    "dimensions_with_data": 10,
    "dimensions_unavailable": 0
  },
  "drift_vs_prior_cycle": {
    "composite_delta": -3,
    "fair_value_delta_pct": -2.1,
    "subscore_max_delta": 5
  }
}
```

Write to `runs/<T>/metrics.json`.

## Step 7: Final checkpoint

Write to `runs/<T>/checkpoints/cycle_{N}_loop_17.json`:

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 17,
  "phase": "html_build",
  "completed_at": "<iso>",
  "state": {
    "report_path": "ticker_research_knowledge/tickers/NVDA/runs/<T>/report.html",
    "diff_path": "runs/<T>/diff.json",
    "metrics_path": "runs/<T>/metrics.json",
    "canonical_persisted": true,
    "score_history_appended": true,
    "source_reliability_updated": 28,
    "state_json_updated": true
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to knowledge base

- `tickers/<TICKER>/canonical.json` — overwritten with locked record
- `tickers/<TICKER>/score_history.jsonl` — appended
- `tickers/<TICKER>/runs/<T>/report.html`
- `tickers/<TICKER>/runs/<T>/diff.json`
- `tickers/<TICKER>/runs/<T>/metrics.json`
- `source_reliability.json` — updated
- `correlated_universe.json` — updated
- `state.json` — updated

## Invariants

- After Loop 17 completes, the knowledge base is fully consistent — `canonical.cycle == cycle`, all evidence files are valid, `source_reliability.json.updated_at == completed_at`.
- The HTML report renders without JavaScript errors when opened in a browser.
- `diff.json.summary.composite_delta` matches the actual diff entries.

## Failure handling

- **Template missing**: abort. The template file is canonical and must exist. Surface a clear error pointing to `templates/ticker_report_template.html`.
- **Schema validation failure** (Step 1): write a partial checkpoint with detailed `errors`, do NOT overwrite `canonical.json` or `state.json`. Previous cycle data stays intact.
- **Disk full / write error on knowledge base**: same as above — leave prior data intact, surface error.
- **`__REPORT_DATA__` substitution failure** (e.g. invalid JSON): abort, surface error. The template is sensitive to malformed embedded JSON.

## Delta-mode behavior

In delta mode, this loop runs identically — but the diff vs prior cycle will be smaller. The HTML output is the same (the user opens one URL regardless of run mode).

## Notes

- This loop is the **last line of defense** against invalid data reaching the report. The Step 1 validations are intentionally strict.
- The HTML template is the **only** authoritative visual layout — agents must NOT inline-render any HTML; they only fill placeholders.
- The user opens `ticker_research_knowledge/tickers/<TICKER>/runs/<latest-ts>/report.html` to read results.
