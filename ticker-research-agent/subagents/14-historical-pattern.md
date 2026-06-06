# Sub-agent: Loop 14 — Historical Pattern Matching

**Phase:** `historical_pattern` · **Loop ID:** 14 · **Skipped in delta mode.**

## Purpose

Compare the **current setup** to **prior similar setups** in the ticker's history (and similar setups in peers) to ground the forecast in observed base rates rather than narrative. Reduces the agent's tendency to over-extrapolate the present.

## Inputs

- `runs/<T>/draft_canonical.json` — current setup
- All prior `score_history.jsonl` entries
- All prior `iteration_log.jsonl` entries
- Search budget: default 60

## Step 1: Identify the setup signature

Capture the current setup in 8 dimensions:

| Dimension | Current Value |
|-----------|---------------|
| Earnings surprise (last quarter) | e.g. +12% |
| Analyst revision direction (30d) | e.g. UP +6% |
| 90-day momentum percentile | e.g. 92 |
| Valuation percentile (vs 5y history) | e.g. 78th |
| Short interest % float | e.g. 1.2% |
| Insider activity (cluster?) | e.g. NO |
| Macro regime | e.g. NEUTRAL |
| News sentiment | e.g. +0.62 |

## Step 2: Find prior similar setups in target's history

Query strategies:

1. **Same ticker, prior cycles**: scan `score_history.jsonl` for cycles where the setup signature was within ±15% on each dimension. Capture the subsequent 3-month and 12-month price action.

2. **Earnings drift base rates**: search for "[TICKER] post-earnings X-day return after Y% beat" — the post-earnings drift in this name historically.

3. **Sector base rates**: search for "[SECTOR] stocks post-earnings beat X% return". Use sector aggregate as fallback when ticker history is sparse.

4. **Quant pattern base rates**: e.g. "stocks with 12-month returns > 80th percentile + analyst upgrades — base rate of next-quarter outperformance".

## Step 3: Counter-pattern search

Search for failures of similar setups:

```
"[TICKER] mean reversion after rally [year]"
"[TICKER] earnings beat sold off [year]"
"high momentum [SECTOR] stocks underperform [year]"
"AI stocks digestion phase [year]"  (or sector-specific)
```

Each failure adds to the bear case base rate.

## Step 4: Construct the base rate

```
prior_similar_setups = N
followup_3m_avg_return = X%
followup_3m_pct_positive = Y%
followup_12m_avg_return = Z%
followup_12m_pct_positive = W%
```

Use these as **probability priors** for Loop 16's scenario weighting.

| Setup | Implication |
|-------|-------------|
| 3m positive base rate ≥ 70% | Confirms BULLISH near-term |
| 3m positive base rate 50–70% | Neutral confirmation |
| 3m positive base rate ≤ 30% | Mean reversion likely; flag for adversarial reconsideration |
| 12m positive base rate ≥ 70% | Confirms BULLISH long-term |

## Step 5: Pattern match to known archetypes

Common setups + their historical base rates (loose):

| Archetype | Description | 3m base rate | 12m base rate |
|-----------|-------------|-------------:|--------------:|
| Earnings beat + raise + analyst up-revisions | PEAD setup | ~65% positive | ~60% |
| Top-decile momentum + quality | Quality momentum | ~60% positive | ~70% |
| Top-decile momentum + low quality | "Junk" rally | ~45% positive | ~30% (mean reversion risk) |
| Insider cluster buy + price near 52w low | Reversal candidate | ~70% positive | ~75% |
| Short squeeze setup (high SI + breakout) | Squeeze | ~55% positive (highly bimodal) | ~35% (often gives back) |
| Value trap (cheap + decelerating) | Trap | ~30% positive | ~25% |
| Growth at reasonable price | GARP | ~55% positive | ~65% |
| Story stock at extended valuation | "Priced for perfection" | ~50% positive | ~45% |

Identify the **best-matching archetype** and store in `runs/<T>/loop_14_pattern.json`.

## Step 6: Adjust scenario probabilities

Pre-Loop-16 hint: write the suggested probability adjustments to a hint file Loop 16 reads:

```json
{
  "near_term_scenario_priors": { "bull": 0.45, "base": 0.40, "bear": 0.15 },
  "long_term_scenario_priors": { "bull": 0.55, "base": 0.30, "bear": 0.15 }
}
```

These are priors — Loop 16 may further adjust based on catalyst calendar.

## Step 7: Append iteration log entry

- `phase: "HISTORICAL_PATTERN"`
- `verdict`: STRENGTHENED / NO_CHANGE / WEAKENED
- `key_findings`: top 3 historical analogs with date and follow-up performance

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 14,
  "phase": "historical_pattern",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_14_pattern.json",
    "evidence_records_added": { "fundamentals": 0 },
    "best_archetype": "Quality momentum + earnings re-acceleration",
    "archetype_3m_base_rate": 0.62,
    "archetype_12m_base_rate": 0.71,
    "prior_similar_setups_in_ticker_history": 3,
    "ticker_history_3m_avg_return": 11.4,
    "ticker_history_12m_avg_return": 28.6,
    "scenario_priors": {
      "near_term": { "bull": 0.50, "base": 0.35, "bear": 0.15 },
      "long_term": { "bull": 0.55, "base": 0.30, "bear": 0.15 }
    },
    "warnings": ["Top-decile momentum + extended P/E raises mean-reversion risk over 12m horizon"],
    "composite_before": 84,
    "composite_after": 84,
    "verdict": "NO_CHANGE"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 8
}
```

## Outputs

- Snapshot at `runs/<T>/loop_14_pattern.json`.
- Iteration log entry appended.

## Invariants

- `best_archetype` is set.
- `scenario_priors` sums to 1.0 per horizon.

## Failure handling

- **Insufficient ticker history** (new IPO, < 4 quarters): use sector base rates only. Mark `pattern_confidence: LOW`.
- **No matching archetype** (unusual setup): default to balanced priors (bull/base/bear = 0.33/0.34/0.33), set `archetype: "UNCLASSIFIED"`.

## Notes

- This loop's contribution is **calibration** — every base rate is a check on the agent's narrative confidence.
- Archetype matching is fuzzy by design. If the user disagrees, they can override scenario probabilities by editing `scenario_priors` between loops 14 and 16.
