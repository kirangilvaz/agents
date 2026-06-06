# Sub-agent: Loop 13 — Correlated Ticker Validation

**Phase:** `correlated_validation` · **Loop ID:** 13 · **Skipped in delta mode.**

## Purpose

Use the correlated tickers from Loop 7 to **confirm or contradict** the target's thesis from Loop 11/12. If competitors are outperforming and we say the target is BULLISH, we have to explain why the target is lagging. If supply chain is weakening and we say BULLISH, we need a strong reason. This is the cross-asset reality check.

## Inputs

- `runs/<T>/loop_7_correlated.json` — list of correlated tickers + their lightweight outlooks
- `runs/<T>/draft_canonical.json` — current target thesis (post-adversarial)
- Search budget: default 80

## Step 1: Confirmation count

For each correlated ticker, classify alignment vs the target's direction:

```python
target_direction = canonical.direction  # e.g. BULLISH
for ct in correlated_tickers:
  if ct.relationship in [DIRECT_COMPETITOR, SECTOR_PEER, THEMATIC_PEER]:
      # Same-direction expectation
      ct.alignment = (
          CONFIRMS if ct.near_term_outlook in [BULLISH, STRONGLY_BULLISH] and target_direction in [BULLISH, STRONGLY_BULLISH]
          else CONTRADICTS if (ct.outlook bullish XOR target bullish)
          else NEUTRAL
      )
  if ct.relationship == SUPPLIER:
      # Supplier strength → target benefits (typically same direction)
      ...
  if ct.relationship == CUSTOMER:
      # Customer strength → target benefits (downstream demand)
      ...
  if ct.relationship == MACRO_PROXY:
      # Inverse relationships common (e.g. TLT up = rates down → growth tech up)
      ct.alignment = (
          CONFIRMS if ct.correlation_direction matches expected helper direction
          else CONTRADICTS
      )
  if ct.relationship == INVERSE_PROXY:
      # E.g. VIX up = risk-off = stocks down
      ct.alignment = CONFIRMS if (ct.outlook opposite of target.direction)
```

Count:
- `confirmation_count` — how many correlated tickers CONFIRM the target direction
- `contradiction_count` — how many CONTRADICT
- `neutral_count`

## Step 2: Investigate contradictions

For each CONTRADICTING ticker, run a targeted search to understand why the divergence exists:

```
"[CT_TICKER] vs [TICKER] divergence [year]"
"[CT_TICKER] [TICKER] performance gap [month year]"
"why [TICKER] lagging [CT_TICKER] [year]"
```

Possible causes:
1. **Idiosyncratic** — target has a unique catalyst/headwind the peer doesn't (e.g. lawsuit, earnings miss). NOT a thesis breaker.
2. **Sector rotation** — money is rotating; peer is benefiting from the new theme but target isn't. **Concerning** if persistent.
3. **Quality differentiation** — peer is genuinely higher quality and the gap is structural. **Concerning** if material.
4. **Capital structure** — different leverage, dividend, or buyback profile.
5. **Geographic exposure** — different international mix.

Record the cause for each contradiction in `runs/<T>/loop_13_contradictions.json`.

## Step 3: Compute thesis support score

```
thesis_support = (
    (confirmation_count - contradiction_count) / total_correlated * 100
)
```

| thesis_support | Action |
|---------------:|--------|
| ≥ +50 | Strong cross-asset confirmation. No score adjustment. Loop 14 follows. |
| 0 to +50 | Modest confirmation. No score adjustment. Note in `risks` for the contradicting tickers. |
| -25 to 0 | Mixed cross-asset signal. Composite −3. Note in `risks`. |
| < -25 | **Cross-asset contradiction is severe.** Composite −7 and direction may need re-evaluation. Loop 11 must re-run. |

## Step 4: Macro proxy stress test

Specifically check macro proxies (TLT, DXY, VIX, oil, gold):
- Are bond yields directionally consistent with our `sector_macro` thesis?
- Is the dollar moving in a way that supports the international exposure narrative?
- Is VIX at levels consistent with our IV/options call?

Any contradiction here adds to `risks` regardless of overall thesis_support.

## Step 5: Append iteration log entry

Per `schemas/iteration_log.schema.json`:
- `phase: "CORRELATED_VALIDATION"`
- `composite_score_before` / `composite_score_after`
- `key_findings`: top 3 confirmations and top 3 contradictions
- `verdict`: STRENGTHENED / NO_CHANGE / WEAKENED / MULTI_CONFLICT

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 13,
  "phase": "correlated_validation",
  "completed_at": "<iso>",
  "state": {
    "n_correlated_evaluated": 14,
    "confirmation_count": 9,
    "contradiction_count": 3,
    "neutral_count": 2,
    "thesis_support_score": 42.9,
    "key_confirmations": [
      "AVGO STRONGLY_BULLISH; AI accelerator demand confirmed by AVGO Q1 +57% custom silicon revenue",
      "TSM BULLISH; capex guidance up validates wafer demand intact",
      "MSFT BULLISH; Azure capex commentary supports hyperscaler buy cycle"
    ],
    "key_contradictions": [
      "AMD NEUTRAL — MI300X ramp not translating to share gains; explainable: NVDA's ecosystem moat is structural",
      "INTC BEARISH — fab issues; not relevant to NVDA thesis (different segment)",
      "SOXX up but underperforming NVDA YTD — NVDA's outsize weight in SOXX is the cause; not a contradiction"
    ],
    "macro_proxies_aligned": true,
    "composite_before": 84,
    "composite_after": 84,
    "needs_loop_11_rerun": false
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 9
}
```

## Outputs

- Loop log file at `runs/<T>/loop_13_contradictions.json`.
- Iteration log entry appended.
- Updated draft canonical (if `composite_after != composite_before`).

## Invariants

- All correlated tickers from Loop 7 have an alignment classification (CONFIRMS / CONTRADICTS / NEUTRAL).
- Severe contradictions trigger `needs_loop_11_rerun: true`.

## Failure handling

- **Insufficient correlated tickers** (< 10 from Loop 7): downgrade this loop's reliability; cap `composite_adjustment` magnitude at 2 points either way.

## Notes

- This loop is the agent's defense against **single-ticker confirmation bias**. Even if every direct signal on the target says BULLISH, if peers are tanking we should be skeptical.
- The most useful contradictions are **between sector ETF performance and target performance**: if the sector is up and the target is flat, something idiosyncratic is going on.
