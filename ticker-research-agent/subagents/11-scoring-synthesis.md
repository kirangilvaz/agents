# Sub-agent: Loop 11 — Scoring & Signal Synthesis

**Phase:** `scoring` · **Loop ID:** 11 · **Always runs (cold/warm/delta).** **In delta mode, this is the recompute pass after Loops 5/6/8 refresh.**

## Purpose

Compose the **10 dimension subscores** and the **composite conviction score**, set conviction tier and direction, and emit the in-memory canonical record draft. Loop 12 (adversarial) will then challenge it.

## Inputs

- All prior loop snapshots (`runs/<T>/loop_1_*.json` through `runs/<T>/loop_10_*.json`)
- All evidence files in `evidence/<dim>.jsonl`
- `source_reliability.json` for evidence weighting
- [`policies/weights.json`](../policies/weights.json) for dimension weights and asset-class variants
- Search budget: **0** (pure computation)

## Step 1: Compute independent_source_count per dimension

For each dimension's `evidence/<dim>.jsonl`:

1. Filter to records with `confidence >= 0.7`.
2. Build a citation graph from `cites` / `cited_by` fields.
3. Run citation-cycle dedup: if A cites B and B cites A (transitively), they count as 1 independent source.
4. Group by `source_domain` — domains in the same parent corporation count as 1 (e.g. WSJ + Barron's same parent).
5. `independent_source_count = len(unique_independent_sources)`.

A dimension with `independent_source_count < 2` is flagged `data_unavailable: true` for scoring (or score capped to 50, neutral).

## Step 2: Compute weighted dimension subscore

For each dimension, take the preview score from its parent loop and refine:

```
final_subscore = sum(component_score × component_weight)
where weights come from policies/weights.json:subscore_inputs.<dim>.components
```

Apply source_reliability multipliers:

```
contribution_i = signal_value_i × component_weight_i × source_reliability_multiplier_i
```

Clamp to [0, 100].

## Step 3: Set per-dim direction

Per `policies/weights.json:sign_conventions`:

- always_bullish_when_high dims (earnings_fundamentals, institutional_activity, momentum_price, valuation_fair_value, analyst_sentiment, quant_factor): direction = BULLISH if score ≥ 65, BEARISH if score ≤ 40, NEUTRAL otherwise
- context_dependent dims (news_catalyst, options_short_interest, social_community_sentiment, sector_macro): direction is set by the parent loop's preview field, possibly adjusted here

Record the rationale in `subscores.<dim>.rationale` (1-2 sentences with quantitative evidence).

## Step 4: Compute composite

```
composite = sum(subscore_i × weight_i)   # per asset class weights
composite = clamp(composite, 0, 100)

# Add experimental signal contribution (capped 5%)
exp_contribution = sum(exp_signal.contribution × exp_signal.weight)
composite = composite + min(exp_contribution, 5)
composite = clamp(composite, 0, 100)
```

Record both `composite_score` and `core_only_composite` (without exp signal contribution).

## Step 5: Set conviction tier

| Range | Tier |
|-------|------|
| 90–100 | MAXIMUM |
| 85–89 | HIGH |
| 75–84 | MODERATE |
| 65–74 | LOW |
| 50–64 | VERY_LOW |
| < 50 | NONE |

Apply tier caps:
- If `data_availability: "LOW"` → cap at MODERATE
- If `independent_source_count < 2` for ≥ 3 dimensions → cap at LOW
- If macro regime is STAGFLATION → cap conviction tier at MODERATE for any non-defensive sector

## Step 6: Set direction classification

Count dimension directions:
- Compute n_bullish, n_neutral, n_bearish

Direction:

| Composite | n_bullish_dims | n_bearish_dims | Direction |
|-----------|---------------:|---------------:|-----------|
| ≥ 85 | ≥ 8 | 0 | STRONGLY_BULLISH |
| 75–84 | ≥ 6 | ≤ 2 | BULLISH |
| 50–74 | any | any | NEUTRAL |
| 75–84 | ≤ 2 | ≥ 6 | BEARISH |
| ≥ 85 | 0 | ≥ 8 | STRONGLY_BEARISH |

If composite ≥ 85 but dims aren't unanimous, downgrade to BULLISH/BEARISH.

## Step 7: Single-signal cap check

For convergence:
```
max_subscore_share = max(subscore_i × weight_i) / composite
```

If `max_subscore_share > 0.40`, flag `single_signal_dominant: true`. Loop 12 must explicitly stress-test this dimension before convergence.

## Step 8: Emit draft canonical

Write `runs/<T>/draft_canonical.json` matching [`schemas/ticker_report.schema.json`](../schemas/ticker_report.schema.json) — fully populated except for adversarial-derived fields (`risks`, `invalidation_triggers`, refined outlooks). Loop 12+ will fill those.

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 11,
  "phase": "scoring",
  "completed_at": "<iso>",
  "state": {
    "draft_canonical_path": "runs/<T>/draft_canonical.json",
    "composite_score": 87,
    "core_only_composite": 87,
    "conviction_tier": "HIGH",
    "direction": "BULLISH",
    "subscores": {
      "earnings_fundamentals": { "score": 92, "direction": "BULLISH" },
      "institutional_activity": { "score": 84, "direction": "BULLISH" },
      "momentum_price": { "score": 82, "direction": "BULLISH" },
      "valuation_fair_value": { "score": 71, "direction": "NEUTRAL" },
      "analyst_sentiment": { "score": 91, "direction": "BULLISH" },
      "news_catalyst": { "score": 84, "direction": "BULLISH" },
      "quant_factor": { "score": 76, "direction": "BULLISH" },
      "options_short_interest": { "score": 67, "direction": "NEUTRAL" },
      "social_community_sentiment": { "score": 71, "direction": "NEUTRAL" },
      "sector_macro": { "score": 72, "direction": "BULLISH" }
    },
    "n_dims_bullish": 7,
    "n_dims_neutral": 3,
    "n_dims_bearish": 0,
    "single_signal_dominant": false,
    "max_subscore_share": 0.21,
    "experimental_contribution": 0,
    "data_availability": "FULL"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs

- Draft canonical at `runs/<T>/draft_canonical.json`.

## Invariants

- All 10 subscores set, every one with a `direction` field.
- `composite_score`, `conviction_tier`, `direction` all set.
- `core_only_composite` recorded (used for invalidation logic — exp signals can't be the deciding factor).

## Failure handling

- **Multiple dimensions data_unavailable**: cap conviction tier (see Step 5). Note in `state.errors`.
- **Numerical anomaly** (composite > 100 or < 0 after clamp): write `errors` and abort the cycle — this is a logic bug.

## Delta-mode behavior

In delta mode, only the dimensions refreshed by Loops 5/6/8 (news, social, sector_macro) get re-scored. All other dimensions keep their prior subscores from `canonical.subscores`. Composite is recomputed.

If the recomputed composite crosses a tier or direction boundary in delta mode, **flag for adversarial validation** before persisting — Loop 12 must run even in delta mode in that case.

## Notes

- This is a pure computation loop — every value must be derivable from prior snapshots + policies. No new searches.
- Reproducibility: given the same snapshots and weights, this loop must produce identical output. Useful for unit testing.
