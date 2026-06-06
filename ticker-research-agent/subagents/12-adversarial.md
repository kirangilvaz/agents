# Sub-agent: Loop 12 — Adversarial Challenge

**Phase:** `adversarial` · **Loop ID:** 12 · **Skipped in delta mode unless tier/direction flipped in Loop 11.** **The single most important loop — without it the agent just confidently regurgitates the dominant narrative.**

## Purpose

**Try to disprove the draft thesis.** Find the strongest opposing case for every bullish signal, the strongest case for inclusion despite every bearish flag, and stress-test signal independence. Every conviction tier ≥ MODERATE must survive **≥ 2 adversarial passes** before convergence.

## Inputs

- `runs/<T>/draft_canonical.json` from Loop 11
- All evidence files
- Search budget: default 150

## Step 1: Per-dimension counter-research

For each dimension where `subscore.direction != NEUTRAL`, run targeted counter-searches:

```
"[TICKER] bear case [year]"
"[TICKER] overvalued risks [year]"
"[TICKER] competition threat disruption [year]"
"[TICKER] downgrade analyst [latest 90d]"
"[TICKER] short thesis [year]"
"[TICKER] earnings miss concern [year]"
"[TICKER] regulatory investigation lawsuit [year]"
"[TICKER] insider selling [latest 6m]"
"[TICKER] guidance cut warning [year]"
"[TICKER] customer concentration risk [year]"
"[TICKER] margin compression [year]"
"[TICKER] dilution capital raise [year]"
"[TICKER] accounting questionable [year]"
"[TICKER] CEO departure [year]"
```

For BEARISH theses, search the inverse:
```
"[TICKER] turnaround catalyst [year]"
"[TICKER] activist investor unlock value [year]"
"[TICKER] short squeeze potential [year]"
"[TICKER] underappreciated bull case [year]"
```

Append all counter-evidence to the appropriate `evidence/<dim>.jsonl` with `is_counter_evidence: true` so it doesn't inflate independent_source_count.

## Step 2: Adversarial questions

For each subscore with `direction != NEUTRAL`, ask AND answer honestly:

1. **What is the strongest argument against this dimension's score?**
2. **Which source is weakest?** Is any source paywalled, AI-generated, or self-citing?
3. **Is the signal driven by a single dominant source?** Re-check `independent_source_count` after removing the most-cited single source — if it drops below 2, flag.
4. **Has the supporting evidence aged?** If the most recent supporting evidence is > 90 days old (>30 days for news/sentiment), flag.
5. **Is the quote re-validation correct?** Sample 2 random evidence records; re-read their `exact_quote` against the current claim. If the quote doesn't actually support the metric, flag the evidence with `confidence -= 0.2`.
6. **Could the signal be explained by a confounding variable?** (e.g. is the analyst rating boost just sector beta? Is the institutional buying just passive index inclusion?)
7. **For experimental signals**: Is the documented causal mechanism still defensible? If only correlation is shown, expire.

Record answers in `runs/<T>/adversarial_log/<dim>.json`.

## Step 3: Cross-signal corroboration

Find and surface signal divergences:

| Divergence | What it means |
|------------|---------------|
| `analyst_BULLISH` + `insider_SELLING` | Analysts overconfident vs management's revealed preference |
| `momentum_BULLISH` + `news_BEARISH` | Price climbing into negative news — exhaustion possible |
| `social_RETAIL_LEADING_BULLISH` + `institutional_DISTRIBUTION` | Retail bag-holding at top |
| `valuation_OVERVALUED` + `growth_decelerating` | Mean reversion risk |
| `valuation_UNDERVALUED` + `quality_low` + `accruals_high` | Value trap pattern |
| `short_interest_HIGH` + `borrow_RISING` + `price_falling` | Short conviction is being rewarded |
| `analyst_targets_RAISING` + `revenue_growth_decelerating` | Analyst targets are stale; revisions trail reality |

Each divergence creates a `risks` entry with severity HIGH (or CRITICAL).

## Step 4: Invalidation trigger generation

Define **at least 3** explicit invalidation triggers per `schemas/ticker_report.schema.json:invalidation_triggers`. Examples:

- "Close below $X for 3 consecutive sessions on above-average volume" (PRICE)
- "Q1 FY27 earnings miss EPS by > 10% AND guidance for FY27 cut by ≥ 5%" (EARNINGS)
- "Major customer (e.g. specific hyperscaler) announces shift to alternative supplier" (FUNDAMENTAL)
- "Fed pivots to rate hike cycle (≥ 3 hikes priced in)" (MACRO)
- "Section 232 export controls expanded to include consumer-grade GPUs" (REGULATORY)
- "CEO or CFO sells > $100M outside of 10b5-1 plan" (INSIDER)

Each trigger is a falsifiable, observable event.

## Step 5: Verdict assignment

Per dimension:

| Verdict | Action |
|---------|--------|
| `CONFIRMED` | All challenges survived; mark `adversarial_pass += 1` for this dim. No score change. |
| `WEAKENED` | One signal conflicts; subscore −5 (in absolute terms). Note in `risks`. |
| `MULTI_CONFLICT` | Multiple signals conflict; subscore −10. Direction may flip to NEUTRAL. |
| `INVALIDATED` | An invalidation trigger has already fired (e.g. earnings miss already happened). Subscore −20. Direction flips. Loop 11 will re-run. |

Composite verdict (overall thesis):

| Composite Verdict | Trigger |
|-------------------|---------|
| `THESIS_CONFIRMED` | All dims CONFIRMED or only minor WEAKENED |
| `THESIS_WEAKENED` | ≥ 2 dims WEAKENED |
| `THESIS_FRACTURED` | ≥ 1 INVALIDATED OR ≥ 3 MULTI_CONFLICT |
| `THESIS_FLIPPED` | Composite direction needs to flip per Loop 11 redo |

If `THESIS_FRACTURED` or `THESIS_FLIPPED`, the orchestrator must re-run Loop 11 to recompute composite/direction with adversarial-adjusted subscores.

## Step 6: Source reliability feedback

For every source whose evidence backed a dim that ended up `CONFIRMED` → `+1 to candidates_confirmed`.
For every source backing an `INVALIDATED` or `MULTI_CONFLICT` → `+1 to candidates_invalidated`, `-1 to candidates_confirmed` (clamped at 0).

These deltas stage in the checkpoint and apply at Loop 17.

## Step 7: Append iteration log entry

Per [`schemas/iteration_log.schema.json`](../schemas/iteration_log.schema.json), append one entry to `iteration_log.jsonl` with:
- `phase: "ADVERSARIAL"`
- `composite_score_before` / `composite_score_after`
- `subscore_changes` (which dims moved, by how much, and why)
- `verdict` (overall composite verdict)
- `key_findings` array
- `counter_evidence_added` array of evidence_ids

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 12,
  "phase": "adversarial",
  "completed_at": "<iso>",
  "state": {
    "verdicts": {
      "earnings_fundamentals": "CONFIRMED",
      "institutional_activity": "CONFIRMED",
      "momentum_price": "WEAKENED",
      "valuation_fair_value": "WEAKENED",
      "analyst_sentiment": "CONFIRMED",
      "news_catalyst": "CONFIRMED",
      "quant_factor": "CONFIRMED",
      "options_short_interest": "CONFIRMED",
      "social_community_sentiment": "WEAKENED",
      "sector_macro": "CONFIRMED"
    },
    "thesis_verdict": "THESIS_WEAKENED",
    "subscore_adjustments": [
      { "dim": "momentum_price", "before": 82, "after": 77, "reason": "RSI nearing overbought + recent vertical move" },
      { "dim": "valuation_fair_value", "before": 71, "after": 66, "reason": "DCF assumptions sensitive to terminal multiple; 2 analyst notes flagged 'priced for perfection'" },
      { "dim": "social_community_sentiment", "before": 71, "after": 66, "reason": "WSB volume rising rapidly; retail-vs-institutional divergence shifted toward RETAIL_LEADING" }
    ],
    "composite_before": 87,
    "composite_after": 84,
    "tier_before": "HIGH",
    "tier_after": "MODERATE",
    "direction_before": "BULLISH",
    "direction_after": "BULLISH",
    "single_signal_dominant": false,
    "invalidation_triggers_added": 5,
    "risks_added": 6,
    "counter_evidence_count": 11,
    "source_reliability_deltas": {
      "marketbeat.com": { "candidates_confirmed_delta": 4 },
      "substack.com": { "candidates_invalidated_delta": 2 }
    },
    "needs_loop_11_rerun": false
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 24
}
```

## Outputs

- Counter-evidence appended to `evidence/<dim>.jsonl`.
- Adversarial logs at `runs/<T>/adversarial_log/<dim>.json`.
- Iteration log entry appended.
- Updated draft canonical at `runs/<T>/draft_canonical.json` with adjusted subscores, populated `risks`, populated `invalidation_triggers`.

## Invariants

- Every dim has a verdict.
- `risks` array length ≥ 3 (every thesis has at least 3 risks).
- `invalidation_triggers` length ≥ 3.
- If `THESIS_FRACTURED` or `THESIS_FLIPPED`, `needs_loop_11_rerun: true`.

## Failure handling

- **Counter-search returns empty**: positive signal (no contrary evidence). Mark dim CONFIRMED only if Step 2's questions pass.
- **Quote re-validation fails for a sampled evidence record**: flag that record with `confidence -= 0.2`, but don't fail the dimension unless ALL sampled fail.
- **Search budget exhausted mid-pass**: complete current dim's challenges, set `state.partial = true`. Convergence cannot be reached this cycle; orchestrator advances to Loop 16.

## Notes

- **Resist confirmation bias** — the goal of this loop is to find what could be wrong with the bull case.
- The most common adversarial finding is **stale evidence** — supporting sources from > 6 months ago. Flag all of them.
- Source reliability deltas are how the agent **learns**: noisy/wrong sources lose weight cycle by cycle.
