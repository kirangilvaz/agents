# Sub-agent: Loop 8 — Macro & Policy Context

**Phase:** `macro_policy` · **Loop ID:** 8 · **Always runs (cold/warm/delta).**

## Purpose

Capture the macro regime (rates, inflation, growth, employment), classify it, identify policy tailwinds/headwinds for the target's sector, and translate this into a `sector_macro` subscore (weight 0.04 stocks, 0.10 ETFs, 0.08 crypto). For ETFs and rate-sensitive equities, this is one of the highest-signal dimensions.

This loop maintains a **shared cross-ticker `macro_state.json`** (TTL ~6 hours) so it doesn't re-fetch the same Fed/CPI data for every ticker run. Refresh only if cache is stale.

## Inputs

- Loop 0 checkpoint
- Cached `ticker_research_knowledge/macro_state.json` (TTL 6h)
- Search budget: default 80

## Sources

Tier 4:
- `fred.stlouisfed.org/series/FEDFUNDS` — Fed funds rate
- `fred.stlouisfed.org/series/PCEPI` — Core PCE
- `fred.stlouisfed.org/series/CPIAUCSL` — CPI
- `fred.stlouisfed.org/series/UNRATE` — Unemployment
- `fred.stlouisfed.org/series/DGS10` — 10-year yield
- `fred.stlouisfed.org/series/DTWEXBGS` — Broad dollar index
- `bls.gov` — employment, inflation prints
- `federalreserve.gov` — FOMC statements, dot plots, minutes
- `treasury.gov` — yield curve, debt issuance schedule
- `eia.gov` — oil / nat gas (if energy-related)

Sector-specific:
- Healthcare: drug pricing legislation, IRA Medicare negotiations
- Tech: Section 232 / export controls / chip act
- Financials: bank stress tests, capital requirements
- Energy: OPEC+ decisions, SPR
- Crypto: SEC enforcement actions, ETF approvals (Farside flows), legislation (FIT21, MiCA)

## Search queries

```
"fed funds rate [month year]"
"core PCE inflation [month year]"
"FOMC meeting decision [date]"
"yield curve 10-year 2-year spread [month year]"
"unemployment rate [month year]"
"S&P 500 sector performance [month year]"
"[SECTOR] policy regulation [month year]"
"[SECTOR] outlook [year] [year+1]"
```

## What to extract

### 8.1 Macro indicators (cache as `macro_state.json`)
- Fed funds rate (current target) + last change date + dot plot direction (cuts/holds/hikes priced)
- Core PCE YoY %
- CPI YoY % (headline + core)
- Unemployment rate
- 10-year yield, 2-year yield, 10-2 spread (yield curve)
- Real yields (TIPS)
- DXY (dollar index)
- VIX
- Brent / WTI oil
- Gold spot
- Bitcoin spot (cross-asset risk-on/off proxy)
- S&P 500 YTD %, Nasdaq YTD %, Russell 2000 YTD %
- Sector performance YTD: Energy, Tech, Financials, Healthcare, Industrials, Consumer Discretionary, Consumer Staples, Utilities, REITs, Materials, Communications

### 8.2 Regime classification
Per the regime rubric in `ticker_research.md` and refined in [`policies/horizons.json`](../policies/horizons.json):

| Regime | Trigger conditions |
|--------|--------------------|
| **BULLISH** | S&P 500 YTD > +5%, earnings broadly beating, rate cuts expected, yield curve positive |
| **NEUTRAL** | Mixed signals — one positive + one negative major indicator |
| **BEARISH** | S&P 500 YTD < -5%, Nasdaq < -8%, Fed rate hike risk |
| **STAGFLATION** | Inflation rising + growth slowing + rate hike risk + commodity shock |

### 8.3 Sector beta to regime
For the target's sector, classify reaction to each macro variable:

```json
{
  "rate_sensitivity": "HIGH_NEGATIVE",   // e.g. tech (long-duration cash flows)
  "inflation_sensitivity": "MIXED",
  "dollar_sensitivity": "NEGATIVE",      // e.g. multinationals
  "oil_sensitivity": "NEUTRAL",
  "credit_spread_sensitivity": "MEDIUM_NEGATIVE"
}
```

For ETFs, this is dimension-defining. For individual stocks, weight is mediated by international exposure / debt load.

### 8.4 Policy watchlist
Forward-looking policy events (next 90 days) relevant to the sector:
- Next FOMC meeting + market-implied probabilities
- Earnings season window
- Sector-specific legislation in markup / vote
- Trade policy (tariffs, export controls)
- Geopolitical risk events

### 8.5 Headwinds & tailwinds
Two arrays of strings — what's helping vs hurting the target's sector right now. Be specific:
- ❌ "Fed signaling 'higher for longer' on terminal rate; 10y yield at 4.7%; long-duration tech multiples compressed"
- ✅ "AI capex commitments in hyperscaler guidance now $250B aggregate FY26, up from $190B prior; secular tailwind intact"

## Subscore preview

Per `policies/weights.json:subscore_inputs.sector_macro`:

```
sector_macro_preview = (
    0.30 * regime_alignment +              # how well sector aligns to current regime
    0.25 * sector_rotation_signal +        # money flowing into vs out of the sector this month
    0.20 * rate_sensitivity_match +        # if rates falling and sector benefits → +; if rising and sector hurts → -
    0.15 * policy_tailwind +               # net of upcoming policy items
    0.10 * geopolitical_exposure           # negative score if exposure is high and tensions rising
)
```

Direction is set by whether the regime + sector beta net to favorable or unfavorable.

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 8,
  "phase": "macro_policy",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_8_macro.json",
    "macro_state_cache_age_hours": 4,
    "regime": "NEUTRAL",
    "fed_rate": 4.50,
    "core_pce": 2.7,
    "ten_year_yield": 4.42,
    "dxy": 104.2,
    "headwinds": ["Higher for longer", "AI capex digestion concerns brewing"],
    "tailwinds": ["Hyperscaler capex guidance increase", "Sovereign AI investment cycle"],
    "sector_macro_preview": 72,
    "sector_macro_direction": "BULLISH",
    "policy_watchlist": [
      { "policy": "FOMC May meeting", "expected_date": "2026-05-08", "expected_impact": "Hold; dot plot watch" },
      { "policy": "Section 232 chip exports review", "expected_date": "2026-06-15", "expected_impact": "Potential headwind for China rev" }
    ]
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 9
}
```

## Outputs to knowledge base

- Evidence in `evidence/macro_policy.jsonl`, `evidence/sector.jsonl`, `evidence/regulatory.jsonl`, `evidence/geopolitical.jsonl`.
- Cached macro state at `ticker_research_knowledge/macro_state.json` (cross-ticker).
- Snapshot at `runs/<T>/loop_8_macro.json`.

## Invariants

- `regime` is always set (never null).
- `headwinds` and `tailwinds` are populated (each ≥1 item) unless `data_unavailable: true`.
- `macro_state.json` was either freshly written or used from a cache <6h old.

## Failure handling

- **FRED unreachable**: fall back to news headlines and search snippets for current rate/inflation reading. Mark macro confidence as MEDIUM.
- **Sector classification ambiguous**: choose the most conservative sector match and note the choice in `errors`.

## Delta-mode behavior

In delta mode, **only refresh `macro_state.json` if it's > 6h old**. Otherwise reuse and just update the per-ticker sector beta/headwind/tailwind narrative based on any news from Loop 5.

## Notes

- For multinationals, model international revenue exposure (e.g. NVDA China revenue) as a regime-dependent risk factor.
- For ETFs, `sector_macro` weight is 0.10 (vs 0.04 for stocks) because the macro regime IS the thesis for sector ETFs.
- Crypto: macro regime + dollar + risk-on/off + rate environment matter heavily; weight is 0.08.
