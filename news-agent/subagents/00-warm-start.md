# Sub-agent: Loop 0 — Warm Start (Date & Window Resolution)

**Phase:** `warm_start` · **Loop ID:** 0 · **Always runs first.** Read-only with respect to research; it only stages run state.

## Purpose

Deterministically resolve the briefing date and news window, bootstrap the run, and stage the in-memory state every downstream loop uses. This must happen before any search runs (see [`AGENT.md` Execution Contract §1](../AGENT.md#1-date--time-resolution)).

## Inputs

- User prompt arguments: `date=YYYY-MM-DD` (optional), `window=rolling|calendar` (optional, default `rolling`).
- Current wall-clock time.

## What this loop does

1. **Resolve briefing date.**
   - If `date=YYYY-MM-DD` is provided, use it.
   - Otherwise default to the current date in **America/New_York (ET)**.
2. **Resolve the news window.**
   - `rolling` (default): the rolling 24 hours ending at build time.
   - `calendar`: 00:00 ET → 23:59 ET on the briefing date.
3. **Compute display strings.**
   - `briefing_date_display` = `Weekday, Month D, YYYY` (user local TZ).
   - `news_window_display` = `News window: YYYY-MM-DD HH:MM ET → YYYY-MM-DD HH:MM ET`.
4. **Bootstrap the run timestamp** (ISO-8601) for changelog entries.
5. **Initialize the changelog** — an append-only list of `{pass, event, detail}` records. Every skipped/failed source and every story add/remove/re-rank gets logged here through the run.
6. **Initialize the candidate list and monitoring list** as empty.

## Output (staged state passed to Loop 1)

```json
{
  "loop": 0,
  "phase": "warm_start",
  "completed_at": "<iso>",
  "state": {
    "briefing_date": "2026-04-30",
    "briefing_date_display": "Wednesday, April 30, 2026",
    "news_window_mode": "rolling",
    "news_window_display": "News window: 2026-04-29 07:00 ET → 2026-04-30 07:00 ET",
    "run_ts": "<iso>",
    "pass": 0,
    "changelog": [],
    "candidates": [],
    "monitoring": []
  }
}
```

## Invariants for downstream loops

- `briefing_date` is fixed for the entire run; the HTML output path derives from it.
- The `[date]` substitution token in every search pattern MUST be replaced with `briefing_date` (and the human form on retry).
- The changelog exists and is appended to (never overwritten) by every later loop.

## Failure handling

- **Ambiguous/invalid `date=` argument**: do not guess — report the parse error and ask for a valid `YYYY-MM-DD`.
- This loop consumes 0 search budget.
