# Ticker Research Agent

A research agent that takes **a single ticker symbol** and produces a definitive, multi-dimensional research report — synthesizing technical analysis, earnings, fundamentals, analyst & institutional positioning, options flow, short interest, news, retail & community sentiment, macro & policy, fair value, quant factors, and correlated tickers — into a **conviction score with near-term (1–4 weeks) and long-term (3–12 months) outlooks**, all backed by evidence and challenged across **5+ adversarial refinement passes**.

The agent itself is a set of markdown specs in this folder. "Running" the agent means having an AI assistant (Claude in Cursor) read [`AGENT.md`](AGENT.md), which dispatches each loop as a sub-agent.

The output is a single self-contained HTML report at:
```
ticker_research_knowledge/tickers/<TICKER>/runs/<latest-timestamp>/report.html
```

---

## Quick start

In Cursor chat:

```
/run-ticker-agent ticker=NVDA
```

That's it. The slash command (defined in `.cursor/commands/run-ticker-agent.md`) attaches [`AGENT.md`](AGENT.md) and tells the assistant to execute one full cycle for the given ticker.

You can also force a run mode:

```
/run-ticker-agent ticker=NVDA mode=cold     # rebuild from scratch
/run-ticker-agent ticker=NVDA mode=warm     # full pipeline, honor caches
/run-ticker-agent ticker=NVDA mode=delta    # quick refresh (news + sentiment + macro + rescore)
```

---

## Execution methods

Five ways to invoke, from interactive to fully automated:

### 1. Inline @-attach (interactive, simplest)

Open a fresh chat in Cursor and type:

```
@ticker-research-agent/AGENT.md execute this agent for NVDA
```

The `@` symbol attaches `AGENT.md`, which references all the subagents and policies. Use this when you want to watch the agent work step-by-step.

### 2. Slash command (one keystroke)

```
/run-ticker-agent ticker=NVDA
```

Best for repeatable runs you trigger by hand.

### 3. Cursor CLI (headless / automatable)

```bash
cursor-agent -p "Execute the agent defined in ticker-research-agent/AGENT.md for ticker=NVDA. Use mode=auto so warm-start chooses cold/warm/delta automatically."
```

### 4. Scheduled (cron / launchd)

Wrap the CLI for periodic refreshes. Example crontab — full re-research of a watchlist every Sunday 2 AM, intraday delta refresh every 4 hours:

```bash
# Full warm pass for top 10 watchlist names every Sunday
0 2 * * 0 cd /Users/kg010808/Downloads/agents && for T in NVDA AMD MSFT META AAPL GOOGL AMZN TSLA AVGO TSM; do cursor-agent -p "Execute ticker-research-agent/AGENT.md ticker=$T mode=warm"; done >> ~/logs/ticker-agent.log 2>&1

# Delta refresh during market hours
0 10,14 * * 1-5 cd /Users/kg010808/Downloads/agents && for T in NVDA AMD MSFT; do cursor-agent -p "Execute ticker-research-agent/AGENT.md ticker=$T mode=delta"; done >> ~/logs/ticker-agent.log 2>&1
```

For macOS, the launchd equivalent goes in `~/Library/LaunchAgents/com.user.ticker-agent.plist`.

### 5. Cursor rule auto-attach (optional setup — not configured by default)

This repo does **not** ship a rule for this yet. To enable it, create `.cursor/rules/ticker-agent.mdc` with `globs: ["ticker-research-agent/**", "ticker_research_knowledge/**"]` and a body that points at [`AGENT.md`](AGENT.md). Once created, any chat opened inside this folder auto-loads the orchestrator instructions and you can just say "run a cycle on AAPL" without attaching anything.

---

## Multi-subagent dispatch model

One CLI / chat invocation = **one full cycle for one ticker**. The orchestrator (Claude reading [`AGENT.md`](AGENT.md)) dispatches each loop as a sub-agent via Cursor's `Task` tool.

```
orchestrator (with ticker=NVDA)
   ├─ Task: subagents/00-warm-start.md             (decides cold/warm/delta)
   ├─ Task: subagents/01-fundamentals.md           (skipped in delta)
   ├─ Task: subagents/02-technical.md              (skipped in delta)
   ├─ Task: subagents/03-analyst-institutional.md  (skipped in delta)
   ├─ Task: subagents/04-options-short-interest.md (skipped in delta)
   ├─ Task: subagents/05-news-catalysts.md         (always)
   ├─ Task: subagents/06-sentiment-social.md       (always)
   ├─ Task: subagents/07-correlated-tickers.md     (skipped in delta)
   ├─ Task: subagents/08-macro-policy.md           (always)
   ├─ Task: subagents/09-fair-value.md             (skipped in delta)
   ├─ Task: subagents/10-quant-factors.md          (skipped in delta)
   ├─ Task: subagents/11-scoring-synthesis.md      (always)
   ├─ Task: subagents/12-adversarial.md            (delta: runs only if Loop 11 rescore crosses a tier boundary or flips direction)
   ├─ Task: subagents/13-correlated-validation.md  (skipped in delta)
   ├─ Task: subagents/14-historical-pattern.md     (skipped in delta)
   ├─ Task: subagents/15-iterative-refinement.md   (loops 11→14 until convergence; min 5 passes)
   ├─ Task: subagents/16-outlook-generation.md     (always)
   └─ Task: subagents/17-html-build.md             (always; the only loop that writes canonical files)
```

---

## Folder layout

### Agent spec (this folder, version-controlled)

```
ticker-research-agent/
  AGENT.md                                      # Top-level orchestrator spec — start here
  README.md                                     # This file
  subagents/
    00-warm-start.md                            # Loop 0: load prior, decide run mode
    01-fundamentals.md                          # Loop 1: price + fundamentals + earnings
    02-technical.md                             # Loop 2: trend, momentum, levels, patterns
    03-analyst-institutional.md                 # Loop 3: ratings + 13F + insider + dark pool
    04-options-short-interest.md                # Loop 4: IV, UOA, SI, squeeze potential
    05-news-catalysts.md                        # Loop 5: headlines + catalyst calendar
    06-sentiment-social.md                      # Loop 6: Reddit, ST, X, retail-vs-institutional
    07-correlated-tickers.md                    # Loop 7: ≥10 influencing tickers
    08-macro-policy.md                          # Loop 8: regime, rates, sector beta
    09-fair-value.md                            # Loop 9: DCF + comparables + analyst consensus
    10-quant-factors.md                         # Loop 10: academic factor alignment
    11-scoring-synthesis.md                     # Loop 11: 10-dim composite + tier + direction
    12-adversarial.md                           # Loop 12: try to disprove the thesis
    13-correlated-validation.md                 # Loop 13: peers confirm or contradict
    14-historical-pattern.md                    # Loop 14: archetype matching + base rates
    15-iterative-refinement.md                  # Loop 15: 11→14 until convergence (min 5 passes)
    16-outlook-generation.md                    # Loop 16: near-term + long-term + scenarios
    17-html-build.md                            # Loop 17: persist + render
  templates/
    ticker_report_template.html                 # Self-contained dark-theme report
  schemas/
    ticker_report.schema.json                   # Canonical record for one ticker
    evidence_record.schema.json                 # One source confirmation, with provenance
    correlated_ticker.schema.json               # Influencing-ticker schema
    iteration_log.schema.json                   # One refinement-pass entry
    cache_entry.schema.json                     # Cached fetch responses
    source_reliability.schema.json              # Per-source learned weights
    diff.schema.json                            # Cross-cycle changelog
  policies/
    source_ttl.json                             # Per-domain cache TTL, rate limits, ToS
    convergence.json                            # Iteration / convergence rules + budgets
    weights.json                                # Dimension weights + asset-class variants
    horizons.json                               # Per-horizon driver weights + thresholds
```

### Knowledge base (sibling folder, runtime; gitignore recommended)

```
ticker_research_knowledge/
  state.json                                    # last_run_at (global), schema_version
  source_reliability.json                       # cross-ticker learned source weights
  macro_state.json                              # cached macro snapshot (TTL ~6h)
  correlated_universe.json                      # cross-ticker correlation cache
  watchlist.json                                # tickers being tracked
  tickers/<TICKER>/
    canonical.json                              # latest finalized record
    score_history.jsonl                         # per-cycle scores (append-only)
    iteration_log.jsonl                         # per-cycle refinement passes (append-only)
    evidence/<dimension>.jsonl                  # per-dim provenance (append-only)
    sources_cache/<sha256(url)>.json            # raw fetched content + status
    runs/<ISO_TIMESTAMP>/
      checkpoints/cycle_{N}_loop_{L}.json       # per-loop snapshots
      report.html                               # rendered HTML report — open in browser
      diff.json                                 # changelog vs prior run
      metrics.json                              # budget, cache, convergence, drift
```

The knowledge base is what makes re-runs improve. Loop 0 reads it; Loop 17 updates it.

---

## Run modes

The agent picks a mode automatically based on the prior `canonical.json` for the requested ticker:

| Mode | Triggered when... | What runs |
|------|-------------------|-----------|
| **cold** | No prior record for this ticker, or `--reset` flag | Full pipeline (Loops 0–17), iterates 11→14 until convergence with min 5 passes |
| **warm** | Last run for this ticker between 24h and 7d ago | Same as cold but data fetches honor cache TTLs (much faster) |
| **delta** | Last run for this ticker < 24h ago | Loops 0 → 5 (news) → 6 (sentiment) → 8 (macro check) → 11 (rescore) → 16 (outlook) → 17 (html). Thesis preserved unless invalidation triggers. |

Override with `mode=cold|warm|delta` in your prompt.

Tunable in [`policies/convergence.json`](policies/convergence.json):
- `cold_after_days` (default 7)
- `delta_after_hours` (default 24)
- `min_passes` (default 5) and `max_passes` (default 8)
- Convergence thresholds (`max_conviction_delta`, `max_single_signal_share`, etc.)
- Search budget per loop and per cycle

---

## What the report contains

The HTML report (open `runs/<ts>/report.html`) is a single dark-theme page with:

1. **Header** — Ticker, name, sector, asset class, current price + day change, direction badge, cycle metadata
2. **Conviction Hero** — 200px composite ring, conviction tier badge, near-term outlook card, long-term outlook card with targets and scenario probabilities
3. **Thesis** — 1–2 sentence summary, bull case bullets, bear case bullets
4. **10-Dimension Conviction Breakdown** — every subscore with direction badge, bar fill, and rationale
5. **Fair Value** — Current vs estimate with classification, all valuation methods used with weights
6. **Technical Setup** — RSI, MACD, ADX, BB, SMAs, ATR, supports, resistances
7. **Analyst Ratings** — Buy/Hold/Sell distribution bar, target high/avg/low, last 90d changes table
8. **Earnings** — Next date, current Q estimate, revision trend, last 4 quarters with surprise %
9. **Institutional & Insider** — Top holders QoQ deltas, insider 6-month buy/sell summary, cluster buy flag
10. **Options & Short Interest** — IV rank, P/C ratio, max pain, SI %, days-to-cover, squeeze potential, UOA list
11. **News Sentiment & Social** — Reddit / Twitter / StockTwits sentiment, retail-vs-institutional divergence
12. **Recent Headlines** — Last 12 with sentiment + impact pills, source badges
13. **Catalyst Calendar** — Next 90 days with impact pills
14. **Macro & Policy** — Regime, Fed rate, PCE, CPI, unemployment, 10y, DXY, tailwinds + headwinds
15. **Correlated Tickers** — ≥10 peers with influence, 1D/5D/20D perf, near-term outlook, alignment
16. **Quant Factor Alignment** — Momentum, value, quality, low-beta, PEAD, short anomaly
17. **Scenario Analysis** — Bull / Base / Bear cards with probability, target, narrative, drivers (per horizon)
18. **Risks & Counter-Arguments** — Severity-tagged
19. **Invalidation Triggers** — Specific, falsifiable thresholds for thesis breakage
20. **Conviction Refinement Log** — Auto-numbered passes showing how the score evolved across iterations

---

## Customization

| To change... | Edit... |
|--------------|---------|
| Which sources to crawl | [`AGENT.md`](AGENT.md) source tier tables + [`policies/source_ttl.json`](policies/source_ttl.json) |
| Cache TTL / rate limits per domain | [`policies/source_ttl.json`](policies/source_ttl.json) |
| Convergence criteria, min/max passes | [`policies/convergence.json`](policies/convergence.json) |
| Search budget per loop | [`policies/convergence.json`](policies/convergence.json) → `search_budget` |
| Composite formula weights | [`policies/weights.json`](policies/weights.json) |
| Asset-class subscore variants | [`policies/weights.json`](policies/weights.json) → `weights.STOCK / ETF / CRYPTO` |
| Per-horizon driver weights | [`policies/horizons.json`](policies/horizons.json) |
| Direction classification thresholds | [`policies/horizons.json`](policies/horizons.json) → `classification_thresholds` |
| Report look-and-feel | [`templates/ticker_report_template.html`](templates/ticker_report_template.html) (CSS, never the placeholder tokens) |

---

## Troubleshooting

**"Agent says no prior knowledge"** — Knowledge base hasn't been created yet. First run for this ticker = cold start. Normal.

**"Agent skipped most loops"** — You're in delta mode (last run < 24h). Force a full pass with `mode=warm` or `mode=cold`.

**"Search budget exhausted"** — Loop 1+5+7+12 hit the per-cycle cap (default 1200). Either raise it in `policies/convergence.json` or accept a partial cycle.

**"Convergence never reached"** — Check `metrics.json.convergence.stopped_reason`. Likely causes: (a) a noisy source needs to be downweighted (look at `source_reliability.json`), (b) `max_conviction_delta` too tight, (c) thesis genuinely conflicted (multiple INVALIDATED verdicts).

**"Report renders blank"** — Open the browser console. Almost always a malformed `__REPORT_DATA__` substitution. Check `runs/<ts>/checkpoints/cycle_N_loop_17.json` for errors.

**"Composite jumped wildly between runs"** — Check `iteration_log.jsonl` and `diff.json`. Most large deltas trace to a single high-impact news event in Loop 5 or a cluster insider buy/sell. Both should appear in the diff.

**"Direction is BULLISH but every dim is yellow"** — `direction` is set in Loop 11 from the bull/bear count, not pure score. A composite of 76 with 8 dims neutral and 2 bullish reads BULLISH only marginally; the report will show this honestly.

---

## Data hygiene

The agent's TTL policies are tuned for personal research use:
- Price / news / sentiment: 2–12 hours
- Analyst / institutional: 12–24 hours
- Fundamentals / fair value: 24–168 hours
- 13F filings: 168 hours (quarterly cadence anyway)
- Macro indicators: 168 hours

**Don't bypass the cache** unless you have a specific reason — many sources will rate-limit or block aggressive scraping.

The `source_reliability.json` learns over cycles. If you find a source consistently produces wrong predictions (e.g. a particular Substack writer), it'll lose weight automatically. You can also manually edit weights to bypass that learning.

---

## Eval harness (optional)

There is no built-in eval harness like the interview-questions-agent's `holdout.jsonl` — for stocks, "ground truth" is forward returns, which take time to materialize. To evaluate, you can:

1. Run the agent across your watchlist weekly.
2. Compare each cycle's near-term and long-term outlooks against subsequent realized returns (e.g. 4-week return after a near-term BULLISH call).
3. The `score_history.jsonl` makes this trivially scriptable.

A future enhancement: add a `subagents/18-eval.md` loop that scores prior calls vs realized returns and feeds that into source_reliability + iteration log learning.

---

## License & ToS

This agent is for **personal research and analysis**. Crawled sources have their own Terms of Service (see [`policies/source_ttl.json`](policies/source_ttl.json) per-domain notes). Honor robots.txt, rate limits, and never republish third-party content without attribution. The agent is configured to respect these by default.

The output is **not investment advice**. Every report makes its evidence chain explicit so you can audit it, but the final decision is yours.
