# Sub-agent: Loop 3 — Analyst Ratings & Institutional/Insider Activity

**Phase:** `analyst_institutional` · **Loop ID:** 3 · **Skipped in delta mode.**

## Purpose

Capture two of the most important signals for any equity:

1. **Analyst sentiment** — ratings distribution, target prices, recent upgrades/downgrades, estimate revisions
2. **Institutional & insider activity** — 13F changes, hedge fund positioning, dark pool signals, insider transactions

Drives `analyst_sentiment` (weight 0.10) and `institutional_activity` (weight 0.15) — combined the second-largest single contributor to composite conviction after fundamentals.

## Inputs

- Loop 0 checkpoint
- Loop 1 snapshot (current price, market cap)
- Search budget: default 100

## Sources

### Analyst ratings & targets
Tier 1: `marketbeat.com`, `tipranks.com`, `finviz.com` (analyst section), `nasdaq.com/market-activity/stocks/<TICKER>/analyst-research`
Tier 2: `zacks.com`, `seekingalpha.com`, `koyfin.com`, `benzinga.com/analyst-ratings`

### Institutional activity
Tier 1: `whalewisdom.com/stock/<TICKER>`, `fintel.io/s/us/<TICKER>`
Tier 2: `tipranks.com/stocks/<TICKER>/hedge-funds`, `13f.info/stock/<TICKER>`

### Insider activity
Tier 1: `openinsider.com/screener?s=<TICKER>`, `sec.gov` (Form 4 lookup)
Tier 2: `tipranks.com/stocks/<TICKER>/insider-trading`

### Dark pool / block trades
Tier 2: `fintel.io` dark pool tab, `whalewisdom.com` block trades

## Search queries

```
"[TICKER] analyst price target ratings [month year] buy sell hold upgrades downgrades"
"[TICKER] analyst upgrades downgrades [last 90 days]"
"[TICKER] price target raised lowered [month year]"
"[TICKER] institutional holders hedge fund 13F [latest quarter year]"
"[TICKER] insider buying selling [last 6 months]"
"[TICKER] dark pool activity block trades [month year]"
"[TICKER] estimate revisions [month year]"
"[TICKER] consensus rating [year]"
```

## What to extract

### 3.1 Analyst block (→ `evidence/analyst.jsonl`)
- Number of analysts covering
- Buy / Hold / Sell distribution (exact counts)
- Strong Buy / Buy / Hold / Sell / Strong Sell breakdown if available
- Average / Highest / Lowest price target (with firm names for high & low)
- Upside %: `(target_avg - current) / current * 100`
- Consensus recommendation
- **Recent changes (last 90 days)** — list every upgrade/downgrade/initiation with:
  - date, firm, action, old → new rating, old → new target
  - Flag any contrarian calls (single Sell amid all Buys, or vice versa) prominently
- Estimate revision trend — count of upward revisions minus downward revisions, last 30 / 60 / 90 days

### 3.2 Institutional block (→ `evidence/institutional.jsonl`)
- % institutional ownership (and trend QoQ)
- Number of funds holding (and delta vs prior quarter)
- Top 10 holders with: name, shares, ownership %, QoQ delta % and action (BOUGHT / SOLD / ADDED / TRIMMED / NEW_POSITION / EXITED / UNCHANGED)
- Recent notable buys (Berkshire, Bridgewater, Citadel, Vanguard, BlackRock, Fidelity, etc.) — name + magnitude
- Dark pool signal — ACCUMULATION / DISTRIBUTION / NEUTRAL based on block trade direction
- FTD (failure to deliver) trend if Fintel exposes it

### 3.3 Insider block (→ `evidence/insider.jsonl`)
- Insider ownership %
- Last 6 months: buy count, buy total $, sell count, sell total $
- Cluster buy detection: ≥3 insiders buying within 30 days (highly bullish)
- Notable transactions (CEO, CFO, founder buying or selling >$1M)
- 10b5-1 plan filings (pre-arranged sales, less informative)

## Subscore previews

Loop 11 owns final scoring; this loop provides previews using `policies/weights.json:subscore_inputs.analyst_sentiment` and `subscore_inputs.institutional_activity`:

### Analyst preview
```
analyst_preview = (
    0.25 * consensus_rating_normalized +    # Strong Buy=100, Buy=75, Hold=50, Sell=25, Strong Sell=0
    0.30 * upgrade_minus_downgrade_90d_normalized +
    0.25 * target_revision_30d_normalized +  # avg target change last 30d as %
    0.20 * estimate_revision_30d_normalized
)
```

### Institutional preview
```
institutional_preview = (
    0.30 * 13f_position_change_qoq_normalized +
    0.25 * insider_net_buying_6m_normalized +
    0.15 * dark_pool_signal_normalized +     # ACCUMULATION=100, NEUTRAL=50, DISTRIBUTION=0
    0.15 * ownership_pct_change_normalized +
    0.15 * ftd_trend_normalized              # FALLING=100, FLAT=50, RISING=0
)
```

Both saved to `runs/<T>/loop_3_analyst_inst.json`.

## Direction inference

Each subscore must also set a `direction` field for Loop 11:

- analyst direction:
  - BULLISH if consensus ≥ Buy AND upgrades > downgrades AND target_revision > 0
  - BEARISH if consensus ≤ Hold AND downgrades > upgrades AND target_revision < 0
  - NEUTRAL otherwise
- institutional direction:
  - BULLISH if 13F net buying AND insider net buying AND dark pool ACCUMULATION
  - BEARISH if 13F net selling AND insider net selling AND dark pool DISTRIBUTION
  - NEUTRAL if mixed (this is the most common case)

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 3,
  "phase": "analyst_institutional",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_3_analyst_inst.json",
    "evidence_records_added": { "analyst": 19, "institutional": 8, "insider": 6 },
    "n_analysts": 56,
    "consensus": "STRONG_BUY",
    "target_avg": 1080.50,
    "upside_pct": 16.7,
    "recent_changes_90d": 14,
    "n_funds_holding": 4823,
    "n_funds_delta_qoq": 312,
    "insider_cluster_buy": false,
    "analyst_preview": 91,
    "institutional_preview": 84,
    "analyst_direction": "BULLISH",
    "institutional_direction": "BULLISH"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 11
}
```

## Outputs to knowledge base

- New evidence in `evidence/analyst.jsonl`, `evidence/institutional.jsonl`, `evidence/insider.jsonl`.
- Snapshot at `runs/<T>/loop_3_analyst_inst.json`.

## Invariants for downstream loops

- The 90-day analyst changes list is non-empty if any changes occurred — Loop 12 (adversarial) will flag the contrarian ones.
- Insider cluster buys are flagged distinctly (high-signal event).

## Failure handling

- **WhaleWisdom paywall**: fall back to `tipranks.com` and `fintel.io` (free tiers); flag in `skipped_sources`.
- **Conflicting target averages** across sources: use the one with the most analysts; record the disagreement in the `risks` carry-forward for Loop 12.
- **No insider activity in 6 months**: that's a signal in itself (dormant) — record as such, don't fail.

## Notes

- ETFs: most analyst rating sources don't cover ETFs; substitute issuer commentary and major fund holder reports. Subscore weight already shifted in `policies/weights.json:weights.ETF`.
- Crypto: no traditional analyst coverage; substitute crypto-research firms (Galaxy, Messari, Bernstein crypto desk). Subscore weight already shifted in `policies/weights.json:weights.CRYPTO`.
