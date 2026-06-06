# Run Daily News Agent

Execute one full cycle of the Daily News Intelligence Briefing agent.

The agent's orchestrator spec lives at [`news-agent/AGENT.md`](../../news-agent/AGENT.md). Read it carefully — it defines the execution contract, source taxonomy, scoring system, and sub-agent dispatch contract. Then dispatch each loop in order, using the `Task` tool, by reading the corresponding subagent spec from [`news-agent/subagents/`](../../news-agent/subagents/).

## Arguments

The user may include any of the following in their prompt:

- `date=YYYY-MM-DD` — Briefing date. If omitted, defaults to today in America/New_York (ET).
- `window=rolling` (default) — Rolling 24 hours ending at build time.
- `window=calendar` — Calendar day (00:00–23:59 ET) for the briefing date.

## What you must do

1. Read [`news-agent/AGENT.md`](../../news-agent/AGENT.md) in full.
2. Dispatch [`subagents/00-warm-start.md`](../../news-agent/subagents/00-warm-start.md) via the `Task` tool. Pass `date=` / `window=` if provided.
3. Dispatch the remaining loops in the order defined by the [AGENT.md execution graph](../../news-agent/AGENT.md#execution-graph):
   - `1 → 2 → 3 → 4 → 5 → 6 → (loop 3→6 until convergence per AGENT.md; min 3 passes, max 10) → 7 → 8`
4. Pass each loop's output to the next. Verify Loop 7's validation passes before dispatching Loop 8 — if it fails, surface the failure and stop.
5. Honor the [no-silent-skip rule](../../news-agent/subagents/01-broad-sweep.md): every source must be attempted and every failure logged to the changelog. If 3+ Tier 1 sources fail, abort with a degraded-data error.
6. After Loop 8 completes, report to the user:
   - Path to the rendered report (`output/news-<date>.html`) and that `output/index.html` was updated.
   - Story count, average conviction, and pass count.
   - Whether the cycle converged.
   - A 3-5 line summary of the top stories.

## Constraints

- Do NOT alter the report template at [`news-agent/templates/news_dashboard_template.html`](../../news-agent/templates/news_dashboard_template.html). Loop 8 only substitutes placeholders — it never hand-writes HTML.
- Do NOT skip subagents to "save time." Accuracy and conviction depend on every loop running (especially Loop 2 wire-copy collapse and Loop 4 adversarial).
- No single-source story may enter the top 30.
- Honor paywall fallbacks and cite honestly (`[via archive]` / `[via reader]` / `[paywalled — headline only]`).

## Common patterns

Today's briefing, default rolling window:
```
/run-news-agent
```

A specific date as a calendar-day briefing:
```
/run-news-agent date=2026-04-30 window=calendar
```
