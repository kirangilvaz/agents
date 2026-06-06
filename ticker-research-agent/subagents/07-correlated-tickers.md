# Sub-agent: Loop 7 — Correlated & Influencing Tickers

**Phase:** `correlated` · **Loop ID:** 7 · **Skipped in delta mode.**

## Purpose

Identify and analyze every ticker that materially influences the target, then capture each one's price snapshot, near-term outlook, and impact narrative. Loop 13 (correlated validation) uses these to confirm or contradict the target's thesis.

Output minimum: **10 correlated tickers** spanning competitors, supply chain, sector ETFs, macro proxies, and thematic peers.

## Inputs

- Loop 0 checkpoint
- Loop 1 snapshot (sector / subsector)
- Cached `correlated_universe.json` from prior cycles
- Search budget: default 150

## Source strategy

For each correlated ticker, do a **lightweight pass** — much shallower than the target ticker. Just enough to populate the schema:
- Yahoo / Finviz quote page → current price, recent perf
- Search snippet for catalyst / news sentiment
- Quick sector ETF check via finviz Sector view

## Categories of influence (must cover all)

| Category | Min Count | Examples for an AI ticker (NVDA) |
|----------|----------:|----------------------------------|
| Direct Competitors | 3 | AMD, AVGO, INTC |
| Supplier (upstream) | 1 | TSM, ASML |
| Customer (downstream) | 1 | MSFT, META, GOOGL, AMZN, ORCL |
| Sector / Industry Peers | 2 | MU, MRVL |
| Sector ETFs | 2 | SOXX, SMH, XLK |
| Macro Proxy | 1 | TLT (rates), DXY (dollar), or commodity per sector |
| Thematic Peer | 2 | PLTR (AI app), SMCI (AI server), ANET (AI networking) |
| Index Membership | 1 | QQQ, SPY (always include) |

Total minimum: **10**. More is better; 15–20 is typical.

For ETFs, add: top 5 holdings, sector ETF peers (other XL_ funds), broad-market index, opposing/inverse ETF.

For crypto: add: BTC (always), ETH (if not the target), L1 peers, sector tokens (DeFi, L2, etc.), dollar (DXY), gold (GLD), risk-on/off proxies (VIX).

## Search queries

```
"[TICKER] competitors top peers [year]"
"[TICKER] supply chain customers suppliers [year]"
"[SECTOR] ETF top holdings [year]"
"[TICKER] correlation [PEER] [year]"
"[PEER] stock price news [last 7 days]"
"[SECTOR] thematic peers [year]"
```

## What to extract per correlated ticker

Each entry conforms to [`schemas/correlated_ticker.schema.json`](../schemas/correlated_ticker.schema.json):

- `ticker`, `name`, `asset_class`
- `relationship` — one of: DIRECT_COMPETITOR, SUPPLIER, CUSTOMER, SECTOR_PEER, SECTOR_ETF, INDEX_MEMBERSHIP, MACRO_PROXY, THEMATIC_PEER, INVERSE_PROXY
- `correlation_direction` — POSITIVE or NEGATIVE
- `correlation_coefficient` — if available (e.g. 60-day rolling Pearson)
- `influence_magnitude` — HIGH / MEDIUM / LOW with one-line justification
- Recent perf: 1D / 5D / 20D %
- `near_term_outlook` and `long_term_outlook` for that ticker (lightweight — based on its own price action, recent news, sector view; this is NOT a full conviction analysis)
- `key_catalyst` (one liner)
- `impact_narrative` — 1-2 sentence narrative explaining HOW this ticker materially impacts the target
- `thesis_alignment` — CONFIRMS, CONTRADICTS, or NEUTRAL relative to the target's draft thesis from Loop 1

## Step-by-step

1. **Generate the universe**:
   - Use sector + subsector to pull peers from prior `correlated_universe.json` if available
   - Search for competitors / suppliers / customers if not cached
   - Always include the broad index (SPY/QQQ for stocks, BTC for non-BTC crypto)
2. **For each candidate**:
   - Quick price + perf fetch (cache aggressively; correlated tickers re-used across runs)
   - Search snippet for recent news / catalyst
   - Compute correlation coefficient if 60d historical price is available; otherwise estimate qualitatively (HIGH/MEDIUM/LOW)
3. **Classify** each as CONFIRMS / CONTRADICTS / NEUTRAL relative to the target draft thesis. This is the input Loop 13 will validate.
4. **Append evidence** records to `evidence/correlated.jsonl` — one per correlated ticker.
5. **Update** `correlated_universe.json` (cross-ticker cache) with any new pairs discovered (so future runs benefit).

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 7,
  "phase": "correlated",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_7_correlated.json",
    "n_correlated": 14,
    "category_coverage": {
      "DIRECT_COMPETITOR": 3,
      "SUPPLIER": 2,
      "CUSTOMER": 4,
      "SECTOR_PEER": 1,
      "SECTOR_ETF": 2,
      "MACRO_PROXY": 1,
      "THEMATIC_PEER": 2,
      "INDEX_MEMBERSHIP": 2
    },
    "alignment_summary": {
      "CONFIRMS": 9,
      "CONTRADICTS": 3,
      "NEUTRAL": 2
    }
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 22
}
```

## Outputs to knowledge base

- Evidence in `evidence/correlated.jsonl`.
- Updated `correlated_universe.json`.
- Snapshot at `runs/<T>/loop_7_correlated.json`.

## Invariants

- `n_correlated >= 10`. If fewer, mark `data_availability` for this dimension as PARTIAL.
- All required category counts >= category minimums above.
- Every entry has a non-empty `impact_narrative`.

## Failure handling

- **Can't identify competitors** (e.g. unique business): use the closest sector ETF and all its top holdings as proxies. Note `competitor_inference: "sector_etf_holdings"` in checkpoint.
- **Correlation calc fails**: fall back to qualitative HIGH/MEDIUM/LOW based on domain knowledge in narrative.

## Notes

- **Be ruthless about minimum count of 10** — this is a hard requirement. Cycle convergence checks for it.
- **Reuse `correlated_universe.json`** aggressively — peers don't change often. Saves significant search budget.
- **Outlooks here are intentionally shallow** — the report acknowledges they're not full analyses. If the user wants a deep dive on a peer, they re-run the agent on that peer.
