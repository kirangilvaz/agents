# Sub-agent: Loop 1 — Fundamentals & Earnings Data Collection

**Phase:** `fundamentals` · **Loop ID:** 1 · **Skipped in delta mode.**

## Purpose

Gather all fundamental, balance-sheet, and earnings data for the target ticker. This loop produces the data backbone for the `earnings_fundamentals` subscore (weight 0.20 in stock composite) and for fair-value computations in Loop 9.

## Inputs

- Loop 0 checkpoint
- Per-domain TTLs from [`policies/source_ttl.json`](../policies/source_ttl.json)
- Search budget for this loop (default 100; see [`policies/convergence.json`](../policies/convergence.json))
- Cached fetches in `ticker_research_knowledge/tickers/<TICKER>/sources_cache/`

## Sources to consult (ordered by priority)

Tier 1 — primary:
- `finviz.com/quote.ashx?t=<TICKER>` — single-page snapshot
- `finance.yahoo.com/quote/<TICKER>/key-statistics` — extended ratios
- `stockanalysis.com/stocks/<TICKER>/financials` — clean financial statements
- `sec.gov` — most recent 10-K, 10-Q (for revenue segments, capex, guidance language)

Tier 2:
- `morningstar.com/stocks/<exchange>/<TICKER>` — moat rating, fair value estimate
- `simplywall.st/stocks/<TICKER>` — DCF + snowflake breakdown
- `seekingalpha.com/symbol/<TICKER>` — quant ratings, recent earnings analysis

For ETFs, swap fundamentals for **holdings + NAV health**:
- ETF holdings page on issuer site (iShares, Vanguard, State Street, ARK)
- `etfdb.com/etf/<TICKER>` — flow history, expense ratio, AUM trend

For crypto, swap fundamentals for **on-chain health** (delegate to Loop 9 plus Tier 6 sources here):
- `coingecko.com/en/coins/<COIN>` — supply, MC, circulating
- `glassnode.com` / `cryptoquant.com` — MVRV, NUPL, exchange flows
- `defillama.com/protocol/<PROTOCOL>` — TVL, fees, revenue

## Search queries

Replace `[TICKER]` and `[year]`:

```
"[TICKER] stock price fundamentals P/E EV/EBITDA revenue margins ROE [year]"
"[TICKER] finviz stock analysis price target technical indicators"
"[TICKER] earnings history EPS estimates beat miss expectations next quarter [year]"
"[TICKER] earnings call transcript [latest quarter]"
"[TICKER] revenue breakdown segment product line [year]"
"[TICKER] forward guidance management [latest quarter]"
"[TICKER] capex capital expenditure guidance [year]"
"[TICKER] balance sheet debt cash flow [year]"
```

For ETFs:
```
"[TICKER] ETF holdings top components NAV expense ratio AUM [year]"
"[TICKER] ETF inflows outflows [year]"
```

For crypto:
```
"[COIN] tokenomics supply circulating max [year]"
"[COIN] on-chain mvrv nupl glassnode [year]"
"[COIN] exchange reserves inflow outflow [year]"
```

## What to extract

For each source, persist a cache entry per [`schemas/cache_entry.schema.json`](../schemas/cache_entry.schema.json) and emit one or more evidence records into `evidence/fundamentals.jsonl` per [`schemas/evidence_record.schema.json`](../schemas/evidence_record.schema.json).

Required data points:

### 1.1 Price & Volume snapshot
Loop 1 captures the price-side snapshot too (used as input by Loop 2 technical for indicators).
- Current price, prior close, day change %
- 52-week high / low, YTD %
- Returns: 1D / 5D / 20D / 60D / 1Y
- Today's volume vs 20-day avg (relative volume)
- Dollar volume, ATR(14)

### 1.2 Fundamentals
- Market cap, enterprise value
- P/E (trailing & forward), PEG, EV/EBITDA, EV/Revenue, P/S, P/B
- Revenue TTM + YoY + QoQ growth
- Revenue segments / product lines (especially critical for AAPL services, NVDA data center, MSFT cloud, etc.)
- Gross / operating / net margins (current + 5-yr trend)
- EBITDA margin
- Free cash flow TTM, FCF yield
- Operating cash flow
- ROE, ROA, ROIC
- Debt/Equity, Interest coverage
- Book value per share
- Dividend yield + buyback yield
- Capex guidance + ratio to revenue
- Piotroski F-Score, Altman Z-Score (if applicable)

### 1.3 Earnings history & expectations
- Last 4 quarters: actual EPS vs estimate (beat/miss %), actual revenue vs estimate (beat/miss %), 5-day post-earnings drift
- Next earnings date (confirmed)
- Current quarter EPS + revenue estimates
- Next quarter estimates
- Full-year (current + next FY) estimates
- Estimate revision trend (30d / 60d / 90d) — direction and magnitude
- Guidance vs consensus (beat/miss magnitude)
- 3-5 key quotes from latest earnings call signaling management confidence
- Whisper number if available

## Step-by-step

1. **Cache check first** — for each candidate URL, compute `url_hash = sha256(url)` and look in `sources_cache/<url_hash>.json`. If a cache entry exists with `now < expires_at`, skip the fetch (0 budget, mark as cache hit in metrics).
2. **Fetch** with rate limits per `policies/source_ttl.json`. Respect `robots.txt`.
3. **Parse / extract** structured data points. Store both the raw excerpt (in cache_entry) and the normalized data point (`data_point` field on evidence records).
4. **Append evidence records** to `evidence/fundamentals.jsonl` and `evidence/earnings.jsonl`. Include `confidence` (your extractor's confidence the quote really refers to the metric); records with `confidence < 0.7` are excluded by Loop 11.
5. **Write the structured snapshot** to `runs/<T>/loop_1_snapshot.json` (the in-memory blob the rest of the loops read; not the final canonical, that's Loop 17).

## Output checkpoint

Write to `runs/<T>/checkpoints/cycle_{N}_loop_1.json`:

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 1,
  "phase": "fundamentals",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_1_snapshot.json",
    "evidence_records_added": { "fundamentals": 11, "earnings": 7 },
    "cache_hits": 4,
    "cache_misses": 9,
    "data_unavailable": [],
    "key_metrics": {
      "current_price": 925.50,
      "market_cap_b": 2280,
      "pe_forward": 31.2,
      "revenue_growth_yoy_pct": 78.3,
      "next_earnings_date": "2026-05-21"
    }
  },
  "skipped_sources": [{ "domain": "morningstar.com", "reason": "403_paywall" }],
  "errors": [],
  "searches_used": 9
}
```

## Outputs to knowledge base

- New evidence records appended to `evidence/fundamentals.jsonl` and `evidence/earnings.jsonl`.
- New cache entries in `sources_cache/`.
- The structured snapshot at `runs/<T>/loop_1_snapshot.json`.
- Canonical record updates wait for Loop 17.

## Invariants for downstream loops

- `state.snapshot_path` exists and is valid JSON.
- Every fundamental data point in the snapshot has at least one supporting evidence record.
- `key_metrics.current_price` is set and is from a Tier 1 source (used by Loop 2 for technical level computation).

## Failure handling

- **Tier 1 source unreachable** (e.g. Yahoo down): mark `skipped_sources`, fall back to Tier 2. Do not fail the loop.
- **All Tier 1+2 sources blocked**: emit a partial snapshot with `data_availability: "LOW"`. Loop 11 will cap the conviction tier.
- **Conflicting numbers across sources** (e.g. Finviz P/E ≠ Yahoo P/E): record both in the snapshot with `disagreement: true`. Use the most recent quarterly filing (SEC) as the tiebreaker if available.
- **Search budget exhausted mid-loop**: complete current source, write checkpoint with `state.partial = true`, surface to orchestrator. Subsequent loops continue with what we have.

## Notes

- For thinly-traded tickers, accept missing fields rather than fabricating. Note `data_unavailable: ["fcf_yield", "ev_ebitda"]` in the checkpoint.
- For ETFs, treat **fund flows + holdings drift** as the equivalent of fundamental signals. The subscore variant in `policies/weights.json:weights.ETF` rebalances the dimension automatically.
- For crypto, defer most heavy lifting to Tier 6 sources. The data points captured here feed the `on_chain` block of the canonical schema.
