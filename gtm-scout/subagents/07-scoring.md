# Sub-agent: Loop 7 — Opportunity Scoring (Phase 9: 6 Dimensions + Effort/ROI + Conviction)

**Phase:** `scoring` · **Loop ID:** 7 · **Always runs (cold/warm/delta).** In delta this is the recompute pass after Loop 3 refreshes signals.

## Purpose

Compute the **six dimension scores** (Relevance, Audience Match, Reach, Growth Signals, Ease of Access, Cost Efficiency), the **Opportunity Score** with the exact mission weights, the **effort** + **expected_roi** + **est_cost** bands, and the **conviction** label for every opportunity. This is a (mostly) pure computation loop — every value must be derivable from the evidence records + policies. Loop 8 (amplify/suppress) and Loop 9 (adversarial) then adjust and challenge it.

## Inputs

- `runs/<brief_id>/<T>/signal_set.json` (Loop 6) — or `enriched_set.json` if Loop 6 skipped — + all `evidence/<id>.jsonl`.
- `icp.json` (for relevance/audience-match grounding), the brief (budget for cost-efficiency).
- `source_reliability.json` (evidence weighting).
- [`policies/scoring.json`](../policies/scoring.json) — weights, components, bands, conviction rules.
- Search budget: **0**.

## Step 1: Independent-source count per opportunity

For each opportunity's evidence:
1. Filter to `confidence >= 0.7`, `is_counter_evidence == false`, and `verification_status != "unverified"`.
2. Group by `source_domain`; same-parent domains count as 1. De-dup citation cycles (two listicles citing each other = 1).
3. `independent_source_count = len(unique independent sources)`; track how many distinct `signal_class`es are represented.

`independent_source_count < min_sources` (default 2) → flag `data_availability:"PARTIAL"`; under-evidenced dimensions capped at 50.

## Step 2: Compute each dimension score

For each dimension, map evidence `data_point`s to its components (`policies/scoring.json:dimension_components`). Each component normalized to 0–100:

- **Level components** (verified_audience_size, demographic_overlap): map to 0–100 via sensible bands (document the band in the rationale). Reach uses verified audience size scaled by type (a 50k newsletter ≈ a 500k YouTube channel for a niche B2B product — normalize within type).
- **Growth components** (audience_growth_rate, engagement_trend): compute `(value - prior_value)/max(prior_value,1)`, map the rate to 0–100. `recent_funding_or_launch` is a 0/1 boosted by recency.
- **Inverse components** (`inverse:true`: cost_vs_budget, expected_cpm_or_cac): a HIGH raw cost yields a LOW contribution (`100 - normalized`). `cost_vs_budget` = est_cost / brief budget — over budget → low.
- **Relevance / audience_match** are grounded in `icp.json`: topical fit, ICP/persona alignment, geo, B2B/B2C, and any verified promotion history in the exact niche (a creator who already promoted a competitor scores high on `niche_promotion_history`).

```
component_norm_i  = normalize(component_i)            # 0..100, inverse handled
contribution_i    = component_norm_i * component_weight_i * source_reliability_multiplier_i
dim_score         = clamp( sum(contribution_i), 0, 100 )
```

If a component has no qualifying evidence, exclude it and renormalize the remaining weights (don't treat missing as 0). If ALL of a dimension's components are missing → `dim_score = 50`, `data_unavailable: true`. Record `scores.<dim>.rationale` (1–2 sentences, quantitative) and `scores.<dim>.components`.

## Step 3: Opportunity Score (exact mission weights)

```
core_score = 0.30*relevance + 0.25*audience_match + 0.15*reach + 0.15*growth_signals + 0.10*ease_of_access + 0.05*cost_efficiency
core_score = clamp(core_score, 0, 100)
```

`opportunity_score` is set to `core_score` for now; Loop 8 applies amplifier/suppressor adjustments. Record `core_score` for audit.

## Step 4: Set tier

Per `policies/scoring.json:tiers`: PRIORITY 90–100, STRONG 80–89, QUALIFIED 70–79, BELOW_FLOOR < 70.

Tier caps:
- `data_availability:"PARTIAL"` → cap at QUALIFIED.
- Core **reach claim is `unverified`/`estimated`-only** → cap at QUALIFIED.
- `conviction == LOW` → cap at QUALIFIED (`low_conviction_tier_cap`).

## Step 5: Effort, ROI, and cost

- `effort`: from ease_of_access + cost_vs_budget — `EFFORT_LOW` (open contact + accepts promo + low/no cost), `EFFORT_MED` (outreach + modest spend), `EFFORT_HIGH` (contract/retainer or spend near/over budget).
- `expected_roi`: coarse band from `(reach·audience_match·relevance)/max(est_cost, floor)` per `policies/scoring.json:roi_bands`. Owned/free + high-fit → `HIGH`.
- `est_cost_usd`: from a verified rate card / commission / pricing band; else `"Unverified"` with `est_cost_verified:false`.

## Step 6: Conviction

Set `conviction` per `policies/scoring.json:conviction.rules` from `independent_source_count` + recency + whether the core reach is verified. **This is the mission's "prefer conviction over size" lever** — surfaced as a chip and a sort option.

## Step 7: Single-signal dominance check (for convergence)

```
max_dim_share = max(dim_score_i * weight_i) / core_score
```
If `max_dim_share > 0.40`, flag `single_signal_dominant: true` so Loop 9 stress-tests that dimension before convergence.

## Step 8: Emit scored set

Write `runs/<brief_id>/<T>/scored_set.json` with each opportunity fully populated except adversarial-derived fields (`risks` additions, `amplifiers_fired`, final `opportunity_score`) which Loops 8–9 fill.

## Output checkpoint

```json
{
  "cycle": 3,
  "loop": 7,
  "phase": "scoring",
  "completed_at": "<iso>",
  "state": {
    "scored_set_path": "runs/ai-stock-signals/<T>/scored_set.json",
    "scored_count": 178,
    "above_floor": 49,
    "tier_distribution": { "PRIORITY": 3, "STRONG": 14, "QUALIFIED": 32, "BELOW_FLOOR": 129 },
    "conviction_distribution": { "HIGH": 28, "MEDIUM": 21, "LOW": 129 },
    "roi_distribution": { "HIGH": 19, "MEDIUM": 24, "LOW": 6 },
    "single_signal_dominant_count": 7,
    "partial_data_count": 24
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs

- `runs/<brief_id>/<T>/scored_set.json`.

## Invariants

- Every opportunity has all 6 dimension scores (each with a rationale or `data_unavailable`), a `core_score`, a `tier`, an `effort`, an `expected_roi`, an `est_cost_usd`, and a `conviction`.
- `core_score` re-derives from dimension scores × weights (±1 tolerance).
- No opportunity with an unverified core reach exceeds QUALIFIED.

## Delta-mode behavior

Only opportunities whose signals were refreshed by Loop 3 are re-scored; others keep prior dimension scores. If a recompute crosses a tier boundary or flips lifecycle/conviction, flag it so the orchestrator inserts Loop 9 before persisting.

## Failure handling

- **Numerical anomaly** (score out of 0–100 after clamp): write `errors`, abort — logic bug.
- **All dimensions data_unavailable for an opportunity:** route it to the watchlist (do not score onto the leaderboard).
