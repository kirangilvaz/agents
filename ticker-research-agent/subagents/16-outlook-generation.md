# Sub-agent: Loop 16 — Outlook Generation (Near-Term & Long-Term)

**Phase:** `outlook_generation` · **Loop ID:** 16 · **Always runs (cold/warm/delta).**

## Purpose

Translate the locked composite + subscores + scenario priors (from Loop 14) into **explicit, probability-weighted forecasts** for two horizons:

- **Near-term**: 1–4 weeks
- **Long-term**: 3–12 months

A **mid-term (1–3 months)** forecast is added if catalyst conditions in [`policies/horizons.json`](../policies/horizons.json) are met.

Each horizon includes a directional classification, expected price range, key levels, scenario tree (bull/base/bear) with probabilities, and key assumptions.

## Inputs

- Locked draft canonical from Loop 15
- Loop 2 technical (ATR, supports/resistances)
- Loop 4 options (max pain, gamma)
- Loop 5 catalyst calendar
- Loop 9 fair value (long-term anchor)
- Loop 14 scenario priors
- [`policies/horizons.json`](../policies/horizons.json)
- Search budget: default 30 (mostly synthesis from prior loops)

## Step 1: Compute per-horizon scores

Per [`policies/horizons.json`](../policies/horizons.json), each horizon has its own driver weights:

```python
horizon_score = sum(subscore[dim] * weight[dim] for dim, weight in horizon_driver_weights.items())
```

Higher near-term weight on momentum/options/news; higher long-term weight on fundamentals/valuation/macro.

Apply directional adjustments — if the dimension's `direction` is BEARISH, its contribution to the horizon score becomes `(100 - subscore[dim]) * weight[dim]` instead.

## Step 2: Classify each horizon

Per `policies/horizons.json:classification_thresholds`:

| Horizon Score | Classification |
|--------------:|----------------|
| ≥ 85 + all top drivers aligned | STRONGLY_BULLISH |
| ≥ 70 + majority drivers aligned | BULLISH |
| 50–69 + mixed | NEUTRAL |
| ≤ 49 + majority bearish | BEARISH |
| ≤ 30 + all bearish | STRONGLY_BEARISH |

## Step 3: Compute expected price ranges

### Near-term (1–4 weeks)
ATR-based band:

```
expected_low  = current_price - atr_band_multiplier_low * atr_14
expected_high = current_price + atr_band_multiplier_high * atr_14
```

Default multipliers (per `policies/horizons.json:horizons.near_term`): 1.5 / 2.5. If direction is BULLISH/STRONGLY_BULLISH, skew the high higher; if BEARISH, skew the low lower.

Then refine using key supports/resistances from Loop 2:
- Round `expected_low` toward the nearest support level if the band straddles one
- Round `expected_high` toward the nearest resistance level if the band straddles one

### Long-term (3–12 months)
Use fair value + analyst consensus:

```
target_3m  = blend(70% recent_trajectory, 30% fair_value)
target_6m  = blend(50% recent_trajectory, 50% fair_value)
target_12m = blend(30% recent_trajectory, 70% fair_value)
```

Where `recent_trajectory` is the implied price from extrapolating the last 90-day trend, dampened by 0.5x.

The 12m target should anchor close to fair value plus or minus drift toward the bull/bear regime.

## Step 4: Build scenario tree

Use the priors from Loop 14 as starting points. Refine based on catalyst calendar:

```
catalyst_skew = sum(impact * sentiment for catalyst in calendar within horizon)
```

Adjust:
```
adjusted_priors.bull = max(0.05, prior_bull + catalyst_skew_normalized)
adjusted_priors.bear = max(0.05, prior_bear - catalyst_skew_normalized)
adjusted_priors.base = 1.0 - adjusted_priors.bull - adjusted_priors.bear
```

Clamp per `policies/horizons.json:scenario_probability_floors`.

For each scenario (bull / base / bear), populate:
- `probability` (sums to 1.0 per horizon)
- `narrative` (1-2 sentences)
- `price_target` (specific number)
- `key_drivers` (3 specific factors)

## Step 5: Define mid-term horizon (if conditions met)

If any of these are true, also produce a mid-term horizon:
- Earnings within 60 days
- Major regulatory decision within 60 days
- FOMC decision within 30 days
- Major catalyst on calendar within 90 days

Use mid-term driver weights from `policies/horizons.json:horizons.mid_term`.

## Step 6: Validate against invalidation triggers

For each invalidation trigger from Loop 12, check if it has **already partially fired** (e.g. price closed below trigger level once but not 3 sessions yet). Note any "approaching invalidation" warnings and add to `risks` with severity HIGH.

## Step 7: Write final canonical

Update `runs/<T>/draft_canonical.json` with the populated `near_term_outlook`, `long_term_outlook`, and (optionally) `mid_term_outlook` blocks.

## Step 8: Append iteration log entry

- `phase: "FINAL_LOCK"` if not already locked by Loop 15
- `key_findings`: short summary of each horizon's classification + target

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 16,
  "phase": "outlook_generation",
  "completed_at": "<iso>",
  "state": {
    "near_term": {
      "classification": "BULLISH",
      "expected_range": [905, 985],
      "scenarios": { "bull": 0.45, "base": 0.40, "bear": 0.15 }
    },
    "mid_term_included": true,
    "mid_term": {
      "classification": "BULLISH",
      "scenarios": { "bull": 0.50, "base": 0.30, "bear": 0.20 }
    },
    "long_term": {
      "classification": "BULLISH",
      "target_3m": 990,
      "target_6m": 1050,
      "target_12m": 1180,
      "scenarios": { "bull": 0.55, "base": 0.30, "bear": 0.15 }
    },
    "approaching_invalidations": []
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 4
}
```

## Outputs

- Updated `runs/<T>/draft_canonical.json` with full outlook blocks.
- Iteration log entry appended.

## Invariants

- All scenario probabilities sum to 1.0 within ±0.01 per horizon.
- Each scenario has a price target.
- `expected_range_low < current_price < expected_range_high` for near-term (unless STRONGLY_BEARISH; in which case current may be above the range).
- Long-term targets satisfy `target_3m, target_6m, target_12m` as plausible monotone progression toward fair value.

## Failure handling

- **No catalyst calendar items**: use Loop 14 priors verbatim.
- **Invalidation already fired** (e.g. earnings reported and missed during the cycle): direction must already be re-scored by Loops 11–15. If it wasn't, surface as fatal error.
- **Scenario probabilities don't sum to 1.0 after adjustments**: re-normalize and log a `warnings` entry.

## Notes

- The near-term horizon is **the most actionable** for traders; the long-term horizon is **the most defensible** for investors. Both must be present, regardless of which the user prefers.
- For ETFs, scenarios should reflect basket-level dynamics (sector rotation, rates, flows) more than single-name catalysts.
- For crypto, scenarios should account for the dominant liquidity factor (ETF flows, halving cycles for BTC, narrative cycles for alts).
