# Sub-agent: Loop 10 — Quant Factor Alignment

**Phase:** `quant_factors` · **Loop ID:** 10 · **Skipped in delta mode.**

## Purpose

Score how the target aligns with established academic factor models (momentum, value, quality, low-beta, PEAD, short interest anomaly). These are the most rigorously back-tested patterns in finance and provide a final cross-check on the thesis before composite scoring. Drives `quant_factor` subscore (weight 0.08).

## Inputs

- Loop 1 snapshot (fundamentals, valuation, growth)
- Loop 2 technical (returns, momentum)
- Loop 3 (analyst, institutional) — for estimate revisions
- Loop 4 (short interest)
- Search budget: default 30 (mostly cached / computed from prior loops)

## Factors

### 10.1 Momentum (Jegadeesh & Titman 1993 / 12-1)
- 12-month return EXCLUDING the most recent month
- Score: percentile vs sector or universe (top decile = 100)
- Bullish if top quartile

### 10.2 Value (Fama-French HML)
- Book-to-Market ratio percentile
- Earnings yield vs market percentile
- Score: high B/M and high E/Y → high HML loading
- Note: large-cap tech often has negative HML loading; that's not necessarily bearish

### 10.3 Quality (Asness et al. QMJ)
- Profitability: gross margin, ROE, ROIC
- Earnings stability (CV of EPS over 5y)
- Low leverage (debt/equity)
- Score: composite percentile

### 10.4 Low Beta (Frazzini-Pedersen BAB)
- Beta vs market over trailing 60 months
- Score: low beta → positive BAB loading; high beta requires higher returns
- Useful as a defensiveness check

### 10.5 PEAD — Post-Earnings Announcement Drift (Bernard-Thomas 1989)
- Applicable if earnings reported within last 60 days
- Sign and magnitude of earnings surprise (SUE = surprise / std dev)
- Direction of analyst revisions in the 30 days post-earnings
- Setup: large positive surprise + upward revisions → bullish drift expected over next 60 days
- Conversely: large negative surprise + downward revisions → bearish drift

### 10.6 Short Interest Anomaly (Desai et al. 2002)
- High short interest = predictive of underperformance (smart short money)
- BUT mediated by squeeze setup: high SI + rising price + low days-to-cover → bullish (covering)
- Use Loop 4's data

### 10.7 Idiosyncratic vol / Lottery (Bali et al.)
- High idiosyncratic vol historically underperforms
- Useful as a reality check on speculative names

### 10.8 Profitability/Investment (Fama-French 5-factor RMW + CMA)
- Operating profitability vs assets
- Asset growth — high asset growth historically underperforms
- Score against universe

## Aggregate

```
factor_alignment = sum(factor_score × academic_weight)
where academic_weights reflect the factor's empirical robustness
```

Default academic weights (tunable):
- Momentum: 0.25
- Quality: 0.20
- Value: 0.15
- Low-beta: 0.10
- PEAD (when applicable): 0.10
- Short anomaly: 0.10
- Profitability: 0.10

If PEAD is not applicable (no recent earnings), redistribute its weight proportionally.

Classification:

| Score | factor_alignment |
|-------|------------------|
| ≥ 80 | STRONG_BULL |
| 65–79 | BULL |
| 40–64 | MIXED |
| 20–39 | BEAR |
| < 20 | STRONG_BEAR |

## Subscore preview

Per `policies/weights.json:subscore_inputs.quant_factor`:

```
quant_factor_preview = (
    0.30 * fama_french_alignment +
    0.20 * qmj_loading +
    0.20 * low_beta_anomaly +        # adds when low beta + low recent vol
    0.15 * pead_setup +              # if applicable; else weight redistributed
    0.15 * short_interest_anomaly
)
```

Direction set by `factor_alignment` classification.

## Search queries (light — most data is from prior loops)

```
"[TICKER] beta 5-year [year]"
"[TICKER] earnings surprise SUE [latest quarter]"
"[TICKER] 12-month return percentile sector [year]"
"[SECTOR] factor exposure value momentum [year]"
```

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 10,
  "phase": "quant_factors",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_10_quant.json",
    "evidence_records_added": { "quant_factors": 4 },
    "momentum_12_1_percentile": 92,
    "value_hml_loading": -0.6,
    "quality_qmj_loading": 0.95,
    "low_beta_loading": -0.4,
    "pead_applicable": true,
    "pead_signal": "BULLISH",
    "short_anomaly": 0.15,
    "factor_alignment": "BULL",
    "quant_factor_preview": 76,
    "quant_factor_direction": "BULLISH"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 3
}
```

## Outputs

- Evidence in `evidence/quant_factors.jsonl`.
- Snapshot at `runs/<T>/loop_10_quant.json`.

## Invariants

- `factor_alignment` is set.
- If `pead_applicable: false`, the PEAD weight is redistributed and noted in checkpoint.

## Failure handling

- **Insufficient history (new IPO)**: skip momentum + low-beta. Use only quality + value + PEAD if applicable. Mark confidence MEDIUM.
- **No earnings within 60d**: skip PEAD; redistribute weight.

## Notes

- This loop is the closest thing the agent has to a "model" — it embeds peer-reviewed empirical findings. It's a useful **reality check** against the more fluid signals from Loops 5 (news) and 6 (sentiment).
- Crypto: classical factors don't apply cleanly; substitute crypto-native factors (MVRV mean reversion, supply distribution, fee/MC ratio). For crypto, this loop's weight in the composite is already lower (0.05).
- ETFs: quant factors apply at the holdings level; aggregate the ETF's beta-weighted factor exposures.
