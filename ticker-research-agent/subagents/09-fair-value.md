# Sub-agent: Loop 9 — Fair Value Estimation

**Phase:** `fair_value` · **Loop ID:** 9 · **Skipped in delta mode.**

## Purpose

Estimate the ticker's intrinsic / fair market value using **at least 2 independent valuation methods**, then compute upside/downside and a classification. Drives `valuation_fair_value` subscore (weight 0.12).

For ETFs, "fair value" = NAV vs price (premium/discount) + holdings-implied value.
For crypto, "fair value" is more art than science: use on-chain MVRV/NUPL anchors, ETF flow models, and analyst consensus, then mark all crypto valuations as `confidence: 0.6` max.

## Inputs

- Loop 1 snapshot (P/E, EV/EBITDA, FCF, revenue, growth)
- Loop 8 macro snapshot (rates → discount rate)
- Search budget: default 60

## Sources

Tier 2:
- `morningstar.com/stocks/<exchange>/<TICKER>` — fair value estimate
- `simplywall.st/stocks/<TICKER>/past` — DCF
- `seekingalpha.com/symbol/<TICKER>/quant-rating` — valuation grade

Tier 1 (cross-check):
- `finviz.com` — P/E vs sector median
- `stockanalysis.com/stocks/<TICKER>/statistics` — multi-year multiples

For crypto, Tier 6:
- `coingecko.com` — historical realized cap, MVRV
- `glassnode.com` — NUPL, MVRV-Z
- ETF flow projections (Farside, K33)

## Search queries

```
"[TICKER] fair value intrinsic value DCF valuation analysis [year]"
"[TICKER] Morningstar fair value estimate [year]"
"[TICKER] DCF discounted cash flow [year]"
"[TICKER] price to earnings sector median [year]"
"[TICKER] EV EBITDA multiple peers [year]"
"[TICKER] sum of parts valuation [year]"
"[COIN] MVRV ratio fair value [year]"
"[COIN] realized price [year]"
```

## Methods (use at least 2)

### 9.1 DCF (Discounted Cash Flow)
- Pull or estimate base FCF (current + 5y forecast)
- Growth rate: 5–10% terminal for mature, 15–25% for growth, fade to perpetual
- Discount rate (WACC): risk-free (10y UST) + equity risk premium (~5%) × beta + debt cost weighting
- Terminal value: Gordon growth or exit multiple
- Sum: PV of forecasted FCF + PV of terminal → equity value → divide by shares

Required transparency: list every key assumption (growth rate, discount rate, terminal multiple) in `key_assumptions`.

### 9.2 Relative Valuation (Comparables)
- P/E vs sector median + historical (5y) average
  - Fair value via P/E = EPS × sector_median_PE (or normalized historical PE if sector is volatile)
- EV/EBITDA vs peers
- P/S for growth companies (low/no profit)
- PEG ratio: PE / EPS growth — < 1 cheap, > 2 expensive (with caveats)

### 9.3 Analyst Consensus Fair Value
- Average analyst price target (already from Loop 3)
- Median analyst target
- Morningstar fair value estimate (independent third-party)
- Composite: weighted average

### 9.4 Sum of Parts (for conglomerates / multi-segment)
- Value each business segment with appropriate sector multiple
- Sum + net cash – minority interests + adjustments

### 9.5 Replacement Cost / Asset-Based
- Useful for asset-heavy industries (REITs, utilities, banks)
- Tangible book value, NAV per share

### 9.6 Crypto-specific methods
- **MVRV anchor**: Realized price × historical MVRV mean (e.g. cycle-fair MVRV ~1.5)
- **NUPL anchor**: NUPL extremes (>0.75 = overheated, <0 = capitulation)
- **ETF flow model**: Net flows × multiplier for absorption
- **Stock-to-flow** (BTC) — controversial, include as one method only

## Compose the fair value

```
fair_value_estimate = sum(method.value × method.weight)
weights sum to 1.0; weight by method confidence
```

```
upside_pct = (fair_value_estimate - current_price) / current_price × 100
```

Classification thresholds:

| Upside % | Classification |
|----------|----------------|
| > +25% | SIGNIFICANTLY_UNDERVALUED |
| +10% to +25% | MODERATELY_UNDERVALUED |
| -10% to +10% | FAIRLY_VALUED |
| -25% to -10% | MODERATELY_OVERVALUED |
| < -25% | SIGNIFICANTLY_OVERVALUED |

Provide a **range** (low/high) reflecting method disagreement, not a single point estimate.

## Subscore preview

Per `policies/weights.json:subscore_inputs.valuation_fair_value`:

```
valuation_preview = (
    0.40 * fair_value_upside_pct_normalized +    # +30% upside → 100; -30% downside → 0
    0.20 * pe_vs_sector +                         # discount = bullish, premium = bearish (with quality offsets)
    0.20 * ev_ebitda_vs_sector +
    0.20 * peg_ratio_normalized                   # PEG < 1 → 100; PEG > 2.5 → 0
)
```

Direction is BULLISH if undervalued, BEARISH if significantly overvalued, NEUTRAL otherwise.

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 9,
  "phase": "fair_value",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_9_fair_value.json",
    "evidence_records_added": { "fair_value": 5 },
    "fair_value_estimate": 1010.0,
    "fair_value_low": 920.0,
    "fair_value_high": 1180.0,
    "upside_pct": 9.1,
    "classification": "FAIRLY_VALUED",
    "methods_used": [
      { "method": "DCF", "value": 1100, "weight": 0.40 },
      { "method": "RELATIVE_PE", "value": 980, "weight": 0.30 },
      { "method": "ANALYST_CONSENSUS", "value": 1080, "weight": 0.20 },
      { "method": "MORNINGSTAR_FV", "value": 870, "weight": 0.10 }
    ],
    "key_assumptions": ["FCF growth 18% next 5y, fading to 5%", "WACC 9.5%", "Terminal multiple 22x"],
    "valuation_preview": 71,
    "valuation_direction": "NEUTRAL"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 6
}
```

## Outputs to knowledge base

- Evidence in `evidence/fair_value.jsonl`.
- Snapshot at `runs/<T>/loop_9_fair_value.json`.

## Invariants

- `methods_used` has length ≥ 2.
- Method weights sum to 1.0 (±0.01).
- `key_assumptions` is non-empty.
- `classification` is set.

## Failure handling

- **No clean DCF inputs**: drop DCF, use Relative + Analyst Consensus + Morningstar; document the omission in `key_assumptions`.
- **All sources show wildly different valuations** (>50% range): widen `fair_value_low` / `fair_value_high`, downgrade confidence, classify as FAIRLY_VALUED unless one method is clearly anchored to a recent filing (use that as base).
- **For new IPOs / no comps**: use replacement cost or wait until next cycle. Mark `data_availability: "LOW"` for this dimension.

## Notes

- Resist the urge to anchor on the analyst price target — it's only **one** of the methods. The whole point of this loop is independent valuation.
- For tickers with notable forward growth or capital cycles (semis, biotech), DCF is often the dominant signal — give it 40–50% weight.
- For mature businesses (consumer staples, utilities), Relative + Replacement Cost dominate.
