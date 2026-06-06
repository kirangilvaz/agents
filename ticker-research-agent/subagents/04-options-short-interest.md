# Sub-agent: Loop 4 — Options Flow & Short Interest

**Phase:** `options_short` · **Loop ID:** 4 · **Skipped in delta mode.**

## Purpose

Capture options-market positioning (IV, skew, unusual activity, gamma) and short-interest dynamics (SI %, days-to-cover, borrow cost, squeeze potential). These signals frequently lead price action and are powerful confirmation tools for theses derived from fundamentals/technicals. Drives `options_short_interest` subscore (weight 0.05 stocks, 0.08 crypto).

For crypto: substitute **derivatives & funding** — perp funding rate, futures basis, options skew (Deribit), liquidations.

## Inputs

- Loop 1 snapshot (price, market cap)
- Loop 2 technical (key strikes/levels)
- Search budget: default 80

## Sources

### Options
Tier 3: `barchart.com/stocks/quotes/<TICKER>/options`, `marketchameleon.com/Overview/<TICKER>/IV`, `optionstrat.com/build/<TICKER>`, `cheddarflow.com` (where accessible)
Tier 1: `nasdaq.com/market-activity/stocks/<TICKER>/option-chain` (basic chain)

### Short interest
Tier 3: `fintel.io/ss/us/<TICKER>`, `nasdaq.com/market-activity/stocks/<TICKER>/short-interest`, `iborrowdesk.com/report/<TICKER>` (borrow rates), `marketbeat.com/stocks/<TICKER>/short-interest`

### Crypto derivatives (skip if asset_class != CRYPTO)
- `coinglass.com/<COIN>` — funding rates, OI, liquidations, basis
- `laevitas.ch` — options skew, term structure
- `deribit.com` — options data (or via search snippets if API not available)

## Search queries

```
"[TICKER] short interest options unusual activity implied volatility [month year]"
"[TICKER] short squeeze potential borrow cost days cover [year]"
"[TICKER] unusual options activity calls puts sweeps [month year]"
"[TICKER] options open interest max pain [month year]"
"[TICKER] gamma exposure dealer positioning [month year]"
"[TICKER] put call ratio [year]"
"[TICKER] failure to deliver FTD [year]"
```

For crypto:
```
"[COIN] futures funding rate liquidations [month year]"
"[COIN] options skew gamma deribit [month year]"
"[COIN] open interest perpetual basis [month year]"
```

## What to extract

### 4.1 Options positioning (→ `evidence/options.jsonl`)
- IV rank (0–100 percentile vs trailing 52w)
- IV percentile
- IV / HV ratio (>1 = options expensive vs realized; <1 = cheap)
- 30-day implied volatility
- Term structure (front-month vs back-month IV) — backwardation vs contango
- Put/Call open interest ratio
- Put/Call volume ratio (today)
- Volume call skew (recent days)
- Notable unusual options activity (single-trade size, OTM call sweeps, large put protection) — list of strings
- Max pain price
- Largest gamma exposure strikes (above and below spot) — gamma magnet effect
- Notable strike clusters: >5x avg OI

### 4.2 Short interest & borrow (→ `evidence/short_interest.jsonl`)
- Short interest as % of float
- SI trend (rising / falling / flat) — magnitude
- Days to cover (= SI shares / avg daily volume)
- Borrow cost (annualized %)
- Stock loan availability
- FTD trend (last 30 days)
- Cost-to-borrow trend
- Squeeze potential (HIGH / MEDIUM / LOW / NONE) — heuristic:
  - **HIGH**: SI > 20% of float AND days_to_cover > 5 AND borrow_cost > 30% AND price recently broke key resistance
  - **MEDIUM**: SI > 10% AND days_to_cover > 3
  - **LOW**: SI > 5%
  - **NONE**: SI < 5%

### 4.3 Crypto derivatives (→ `evidence/options.jsonl` with `data_point.metric` prefixed `crypto_`)
- Perp funding rate (8h / annualized) — extreme positive = leveraged longs paying shorts
- Futures basis (3m annualized) — contango bullish, backwardation bearish
- Options 25-delta put skew (positive = puts richer)
- Total OI in derivatives, %change 30d
- Recent liquidations (long vs short, last 24h)

## Subscore preview

Per `policies/weights.json:subscore_inputs.options_short_interest`:

```
options_short_preview = (
    0.20 * iv_rank_normalized +              # 50 = neutral; high IV=high if bullish narrative, bad if cratering
    0.20 * pc_ratio_skew_normalized +        # >1.5 = high put protection (often contrarian bullish)
    0.20 * unusual_activity_signal +         # bullish UOA = positive
    0.20 * si_pct_float_normalized +         # contextual: high SI is bad if price falling, good if squeeze setup
    0.20 * days_to_cover_squeeze
)
```

Direction is **context-dependent** per `policies/weights.json:sign_conventions`:
- High SI + falling price + rising borrow → BEARISH
- High SI + rising price + low days-to-cover → BULLISH (squeeze setup)
- High call UOA on momentum → BULLISH
- High put UOA after a decline → BEARISH (more downside)
- High put UOA at support during oversold conditions → BULLISH (contrarian protection bid)

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 4,
  "phase": "options_short",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_4_options_short.json",
    "evidence_records_added": { "options": 9, "short_interest": 4 },
    "iv_rank": 38,
    "iv_hv_ratio": 0.92,
    "put_call_ratio": 0.58,
    "unusual_activity_count": 7,
    "unusual_activity_skew": "BULLISH",
    "max_pain": 920,
    "short_interest_pct_float": 1.2,
    "days_to_cover": 0.8,
    "squeeze_potential": "NONE",
    "options_short_preview": 67,
    "options_short_direction": "BULLISH"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 6
}
```

## Outputs to knowledge base

- Evidence in `evidence/options.jsonl`, `evidence/short_interest.jsonl`.
- Snapshot at `runs/<T>/loop_4_options_short.json`.

## Invariants

- For stocks: at minimum SI % of float and IV rank are populated, or `data_unavailable: true` is set.
- Squeeze potential is set explicitly (never null).
- Crypto runs use the `crypto_*` data point prefix; non-crypto skips on-chain blocks.

## Failure handling

- **No options chain (low-float / new IPO)**: mark `options_data_unavailable: true`, fall back to SI-only scoring.
- **All UOA sources gated**: use Tier 1 nasdaq.com basic chain; mark UOA detection as LOW confidence.

## Notes

- IV/HV ratio is one of the most reliable contrarian signals — flag IV rank > 80 (overpriced; potential vol sell setup if no catalyst) or IV rank < 20 (underpriced; potential vol buy setup if catalyst pending).
- Negative skew (calls richer than puts) on indices is rare and bullish; standard for individual names is mild positive skew.
