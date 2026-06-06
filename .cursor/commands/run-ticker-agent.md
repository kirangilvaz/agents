# Run Ticker Research Agent

Execute one full cycle of the Ticker Research agent for a single ticker.

The agent's orchestrator spec lives at [`ticker-research-agent/AGENT.md`](../../ticker-research-agent/AGENT.md). Read it carefully — it defines the run modes, execution graph, and sub-agent dispatch contract. Then dispatch each loop in order, using the `Task` tool, by reading the corresponding subagent spec from [`ticker-research-agent/subagents/`](../../ticker-research-agent/subagents/).

## Required argument

The user MUST include the ticker in the prompt:

- `ticker=<SYMBOL>` — uppercase symbol (e.g. `ticker=NVDA`, `ticker=BTC-USD`, `ticker=SPY`)

If `ticker=` is missing, halt and ask the user to specify one. Do not pick a default.

## Optional arguments

- `mode=cold` — Force a cold start (rebuild from scratch, ignore prior `tickers/<TICKER>/canonical.json`)
- `mode=warm` — Force the full pipeline with cache honoring
- `mode=delta` — Force a quick refresh (Loops 0, 5, 6, 8, 11, 16, 17 only)
- `mode=auto` (default) — Let Loop 0 decide based on `canonical.as_of`
- `--reset` — Discard the prior `canonical.json` for this ticker and force a cold start (equivalent to `mode=cold` but also signals intent to rebuild from scratch). Loop 0 treats this the same as a missing canonical record.

## What you must do

1. Parse `ticker=` (required) and `mode=` (optional, default auto) from the user prompt.
2. Read [`ticker-research-agent/AGENT.md`](../../ticker-research-agent/AGENT.md) in full.
3. Dispatch [`subagents/00-warm-start.md`](../../ticker-research-agent/subagents/00-warm-start.md) via the `Task` tool. Pass `ticker` and the user's `mode=` override if any.
4. Based on the mode the warm-start subagent reports, dispatch the remaining loops in the order defined by [`AGENT.md`](../../ticker-research-agent/AGENT.md)'s execution graph:
   - **cold / warm**: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 (Loop 15 internally re-runs 11→14 until convergence; min 5 passes) → 16 → 17
   - **delta**: 5 → 6 → 8 → 11 → 16 → 17. If Loop 11's rescore crosses a conviction-tier boundary or flips direction vs the prior canonical, insert Loop 12 (adversarial) between Loop 11 and Loop 16 before persisting (per `policies/convergence.json:delta_mode.conditional_loops`).
5. After each subagent completes, verify it wrote its checkpoint to `ticker_research_knowledge/tickers/<TICKER>/runs/<ts>/checkpoints/cycle_{N}_loop_{L}.json`. If not, surface the failure and stop.
6. Track `searches_used` per loop against the budget in [`policies/convergence.json`](../../ticker-research-agent/policies/convergence.json). Warn at 80%, abort at 100%.
7. After Loop 17 completes, report to the user:
   - Path to the rendered report (`ticker_research_knowledge/tickers/<TICKER>/runs/<ts>/report.html`)
   - Summary of `diff.json` (composite delta, tier change, direction flipped)
   - `metrics.json` highlights (passes run, search budget used, cache hit rate)
   - Whether the cycle converged
   - The composite score, direction, and one-line summary of near-term and long-term outlooks

## Constraints

- Do NOT alter the report template at [`ticker-research-agent/templates/ticker_report_template.html`](../../ticker-research-agent/templates/ticker_report_template.html). Loop 17 only substitutes placeholders.
- Do NOT skip subagents to "save time." Conviction depends on every loop running. The minimum 5 refinement passes in Loop 15 is mandatory unless `mode=delta`.
- Do NOT write to `ticker_research_knowledge/` outside of the paths each subagent owns. Loop 17 is the only loop allowed to mutate `canonical.json`, `state.json`, `source_reliability.json`, etc.
- Honor robots.txt, rate limits, and ToS notes in [`policies/source_ttl.json`](../../ticker-research-agent/policies/source_ttl.json).
- Honor TTLs — cache hits consume 0 search budget. Don't bypass them unless `mode=cold`.

## Common batch patterns

Single ticker, default behavior:
```
/run-ticker-agent ticker=NVDA
```

Force a fresh full pass:
```
/run-ticker-agent ticker=NVDA mode=cold
```

Quick news/sentiment refresh:
```
/run-ticker-agent ticker=NVDA mode=delta
```

Crypto:
```
/run-ticker-agent ticker=BTC-USD
```

ETF:
```
/run-ticker-agent ticker=SOXX
```
