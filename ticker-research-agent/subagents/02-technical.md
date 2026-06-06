# Sub-agent: Loop 2 — Technical Analysis

**Phase:** `technical` · **Loop ID:** 2 · **Skipped in delta mode.**

## Purpose

Compute and capture the full technical setup: trend, momentum indicators, volume confirmation, key levels, volatility, and pattern recognition. Drives the `momentum_price` subscore (weight 0.12) and feeds Loop 16's expected-range calculation.

## Inputs

- Loop 1 snapshot (price, volume, MAs may already be partially captured)
- Search budget for this loop (default 50)

## Sources

Tier 1:
- `finviz.com` — chart with overlaid SMAs, RSI, MACD, ATR, ADX
- `finance.yahoo.com/chart/<TICKER>` — historical price series
- `tradingview.com/symbols/<TICKER>` — community-curated technicals (search snippets only; respect ToS)
- `barchart.com/stocks/quotes/<TICKER>` — technical opinion summary

Tier 2:
- `stockcharts.com` — point-and-figure, advanced patterns
- `investing.com/equities/<slug>-technical` — multi-indicator summary

## Search queries

```
"[TICKER] technical analysis chart [year] support resistance"
"[TICKER] RSI MACD moving average [year]"
"[TICKER] support resistance levels key price [year]"
"[TICKER] chart pattern breakout breakdown [year]"
"[TICKER] volatility ATR Bollinger [year]"
```

## What to extract

### 2.1 Trend
- Position vs 20 / 50 / 100 / 200 SMA and 20 / 50 EMA (above/below, by %)
- Slope of 50 and 200 SMA (rising / flat / falling)
- Golden cross / death cross active?
- Higher highs / higher lows pattern (uptrend) or lower highs / lower lows (downtrend)

### 2.2 Momentum indicators
- RSI(14): value, overbought (>70) / oversold (<30) flag, hidden divergence vs price
- MACD(12,26,9): MACD line, signal line, histogram, recent crossovers
- Stochastic(14,3,3): %K, %D, crossover state
- ADX(14): trend strength (>25 = trending)

### 2.3 Volume
- Today's volume vs 20-day average (relative volume)
- 5-day average vs 20-day average
- On-Balance Volume (OBV) trend
- Volume-confirmed breakouts/breakdowns (price + above-avg volume)

### 2.4 Volatility
- ATR(14)
- Bollinger Band width (compressing / expanding) and position (%B)
- Historical volatility (20d / 60d annualized)
- Implied volatility — pulled from Loop 4, but if available here cross-check IV / HV ratio

### 2.5 Key levels
- 3-5 support levels (recent swing lows, round numbers, prior pivots, MAs)
- 3-5 resistance levels (recent swing highs, prior pivots, options strikes — Loop 4 will refine)
- 52-week high / low position
- Anchored VWAP from significant pivots if available
- Recent gaps (open gaps that may act as magnets)

### 2.6 Pattern recognition
Look for and flag any of:
- Bull flag / bear flag
- Head & shoulders / inverse H&S
- Cup & handle
- Ascending / descending triangle
- Wedge
- Double top / double bottom
- Failed breakout / failed breakdown

Each pattern flag must include: pattern name, target price (measured move), invalidation level.

## Step-by-step

1. **Reuse Loop 1 cache** for any URLs already fetched.
2. **Fetch** technical data per the source list.
3. **Compute synthetic indicators** if a source page doesn't expose them — e.g. compute 12-1 momentum percentile from Yahoo historical.
4. **Append evidence** to `evidence/technical.jsonl`. Each pattern recognition or level must cite at least one source.
5. **Build the technical block** of the snapshot at `runs/<T>/loop_2_technical.json`.

## Subscore preview

Loop 11 owns final scoring, but provide a preview using the components in `policies/weights.json:subscore_inputs.momentum_price`:

```
momentum_price_preview = (
    0.30 * 12_1_momentum_percentile +
    0.20 * 200d_sma_position +       # +1 above by >5%, 0 within ±5%, -1 below by >5%
    0.20 * rs_vs_sector +
    0.15 * rsi_macd_alignment +      # +1 both bullish, 0 mixed, -1 both bearish
    0.15 * volume_confirmation       # +1 above-avg vol on up days, -1 below-avg or distribution
)  scaled to 0-100
```

Save to `runs/<T>/loop_2_technical.json:momentum_price_preview`.

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 2,
  "phase": "technical",
  "completed_at": "<iso>",
  "state": {
    "technical_path": "runs/<T>/loop_2_technical.json",
    "trend": "STRONG_UP",
    "rsi_14": 64.2,
    "macd_signal": "BULLISH_CROSS",
    "key_supports": [880.0, 845.5, 800.0],
    "key_resistances": [950.0, 982.0, 1020.0],
    "patterns": ["bull_flag_breakout"],
    "atr_14": 28.5,
    "momentum_price_preview": 82
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 4
}
```

## Outputs to knowledge base

- Evidence appended to `evidence/technical.jsonl`.
- Technical block at `runs/<T>/loop_2_technical.json`.

## Invariants for downstream loops

- `key_supports` and `key_resistances` are sorted descending and ascending respectively.
- `atr_14` is set (used by Loop 16 to compute expected near-term price range).
- `momentum_price_preview` is in [0, 100].

## Failure handling

- **No technical data available** (e.g. brand-new IPO with insufficient history): set `data_unavailable: ["momentum_price"]` and continue. Loop 11 redistributes weight.
- **Indicator disagreement** (e.g. RSI bullish, MACD bearish): record `signals_diverging: true` in the snapshot — this triggers a Loop 12 adversarial flag.

## Notes

- Cryptos rarely have clean ADX readings due to 24/7 trading; flag with lower confidence rather than skipping.
- ETFs follow standard technicals.
- Anchored VWAP is optional — only include if the source explicitly provides it.
