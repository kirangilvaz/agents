# Sub-agent: Loop 4 — Scoring (5 Dimensions + TTM + Crowding)

**Phase:** `scoring` · **Loop ID:** 4 · **Always runs (cold/warm/delta).** In delta this is the recompute pass after Loop 1 refreshes signals.

## Purpose

Compute the **five dimension scores** (Novelty, Capital, Momentum, Feasibility, Market), the **Composite Conviction Score**, **Time-to-Mainstream**, **Time-Adjusted Conviction**, and the **crowding** score for every opportunity. This is a (mostly) pure computation loop — every value must be derivable from the evidence records + policies. Loop 5 (adversarial) and Loop 6 (amplify/suppress) then challenge and adjust it.

## Inputs

- `runs/<T>/enriched_set.json` + all `evidence/<id>.jsonl`.
- `source_reliability.json` (evidence weighting).
- [`policies/weights.json`](../policies/weights.json) — composite weights, dimension components, investor-quality tiers, ttm_discount, crowding.
- Search budget: **0**.

## Step 1: Independent-source count per opportunity

For each opportunity's evidence:
1. Filter to `confidence >= 0.7` and `is_counter_evidence == false`.
2. Build a citation graph from `cites` / `cited_by`. Run citation-cycle dedup: mutually-citing sources count as 1.
3. Group by `source_domain`; same-parent domains count as 1.
4. `independent_source_count = len(unique independent sources)`, and track how many distinct `signal_class`es are represented (diversity matters more than raw count).

An opportunity with `independent_source_count < min_sources` (default 3) → flag `data_availability:"PARTIAL"`; under-evidenced dimensions are capped at 50.

## Step 2: Compute each dimension score

For each dimension, map evidence `data_point`s to its components (`policies/weights.json:dimension_components`). Each component is normalized to 0–100:

- **Level components** (e.g. funding_volume, TAM): map to 0–100 via sensible bands (document the band in the rationale).
- **Growth components** (e.g. citation_growth, github_activity_growth, funding_growth_rate): compute `(value - prior_value)/max(prior_value,1)`, map the growth rate to 0–100.
- **Inverse components** (`inverse:true`: competitive_density, engineering_complexity, adoption_barriers): a HIGH raw observation yields a LOW contribution (`100 - normalized`).
- **investor_quality**: take the max `investor_quality_tiers[*].score` among participating investors, lightly blended with investor count. (A $5M round led by a tier_1 firm scores far above the same amount from unknowns.)

```
component_norm_i  = normalize(component_i)            # 0..100, inverse handled
contribution_i    = component_norm_i * component_weight_i * source_reliability_multiplier_i
dim_score         = clamp( sum(contribution_i), 0, 100 )
```

If a component has no qualifying evidence, exclude it and renormalize the remaining component weights (don't treat missing as 0). If ALL of a dimension's components are missing → `dim_score = 50`, `data_unavailable: true`.

Record `scores.<dim>.rationale` (1–2 sentences, quantitative) and `scores.<dim>.components` (the normalized values).

## Step 3: Composite

```
core_composite = 0.25*novelty + 0.20*capital + 0.20*momentum + 0.20*feasibility + 0.15*market
core_composite = clamp(core_composite, 0, 100)
```

`composite_score` is set to `core_composite` for now; Loop 6 applies amplifier/suppressor adjustments. Record `core_composite` for audit.

## Step 4: Set conviction tier

Per `policies/weights.json:conviction_tiers`: EXCEPTIONAL 90–100, HIGH_CONVICTION 80–89, WORTH_MONITORING 70–79, EMERGING_SIGNAL 60–69, NOISE < 60.

Tier caps:
- `data_availability:"PARTIAL"` → cap at WORTH_MONITORING.
- `independent_source_count < 2` → cap at EMERGING_SIGNAL.
- run-level `data_availability:"DEGRADED"` (3+ scientific classes failed) → no new EXCEPTIONAL promotions this cycle.

## Step 5: Time-to-Mainstream

Set `ttm` from feasibility + adoption-barrier + capital evidence:
- `TTM_0_2` — shipping/monetizing now, prototypes in market, clear revenue.
- `TTM_2_5` — strong prototypes, early commercial pilots, no scaled revenue yet.
- `TTM_5_10` — lab-validated, major engineering/scale barriers remain.
- `TTM_10_PLUS` — early science, fundamental unsolved problems, regulatory unknowns.

Compute `time_adjusted_score = composite_score * ttm_discount[ttm]` (discounts in policies). Record `ttm_rationale`.

## Step 6: Crowding

Compute `crowding` (0–100) from `policies/weights.json:crowding.components`. Set `crowding_label`: `UNDER_RECOGNIZED` (< 35), `CROWDED` (> 70), else `BALANCED`.

## Step 7: Single-signal dominance check (for convergence)

```
max_dim_share = max(dim_score_i * composite_weight_i) / core_composite
```
If `max_dim_share > 0.40`, flag `single_signal_dominant: true` so Loop 5 stress-tests that dimension before convergence.

## Step 8: Emit scored set

Write `runs/<T>/scored_set.json` with each opportunity fully populated except adversarial-derived fields (`risks` additions, `amplifiers_fired`, final `composite_score`) which Loops 5–6 fill.

## Output checkpoint

```json
{
  "cycle": 7,
  "loop": 4,
  "phase": "scoring",
  "completed_at": "<iso>",
  "state": {
    "scored_set_path": "runs/<T>/scored_set.json",
    "scored_count": 268,
    "above_floor": 71,
    "tier_distribution": { "EXCEPTIONAL": 4, "HIGH_CONVICTION": 18, "WORTH_MONITORING": 27, "EMERGING_SIGNAL": 22, "NOISE": 197 },
    "ttm_distribution": { "TTM_0_2": 19, "TTM_2_5": 28, "TTM_5_10": 16, "TTM_10_PLUS": 8 },
    "single_signal_dominant_count": 6,
    "partial_data_count": 22
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs

- `runs/<T>/scored_set.json`.

## Invariants

- Every opportunity has all 5 dimension scores (each with a rationale or `data_unavailable`), a `core_composite`, a `conviction_tier`, a `ttm`, a `time_adjusted_score`, and a `crowding` score.
- Composite re-derives from dimension scores × composite weights (±1 tolerance).

## Delta-mode behavior

Only opportunities whose signals were refreshed by Loop 1 are re-scored; others keep prior dimension scores. If a recompute crosses a tier boundary or flips lifecycle, flag it so the orchestrator inserts Loop 5 before persisting.

## Failure handling

- **Numerical anomaly** (composite out of 0–100 after clamp): write `errors`, abort — logic bug.
- **All dimensions data_unavailable for an opportunity:** route it to the watchlist (do not score onto the leaderboard).
