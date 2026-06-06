# Sub-agent: Loop 5 — News & Catalysts

**Phase:** `news_catalysts` · **Loop ID:** 5 · **Always runs (cold/warm/delta).**

## Purpose

Gather news (last 72h heavily, last 30d for catalyst calendar), score sentiment, and assemble a forward-looking catalyst calendar. This loop runs in `delta` mode too, since news velocity is the most volatile and most actionable signal layer. Drives `news_catalyst` subscore (weight 0.10).

## Inputs

- Loop 0 checkpoint (asset_class, prior canonical)
- Search budget: default 120

## Sources

Tier 4 (news primary):
- `reuters.com`, `bloomberg.com`, `wsj.com`, `ft.com`, `cnbc.com`, `marketwatch.com`
- `seekingalpha.com/symbol/<TICKER>/news`, `finviz.com` (news section), `nasdaq.com/market-activity/stocks/<TICKER>/news-headlines`

Tier 1 (regulatory & filings):
- `sec.gov` for 8-K (material events)
- Company investor relations page

Sector-specific (apply per ticker):
- Healthcare: `fda.gov`, `clinicaltrials.gov`
- Energy: `eia.gov`, OPEC reports
- Tech: company blog, conference talks (e.g. NVIDIA GTC, Apple events)
- Fintech: regulatory dockets (CFPB, SEC, OCC)

## Search queries

```
"[TICKER] stock news [last 72 hours]"
"[TICKER] news today [date]"
"[TICKER] catalyst earnings date M&A partnership [month year]"
"[TICKER] product launch announcement [year]"
"[TICKER] regulatory FDA SEC investigation lawsuit [year]"
"[TICKER] CEO CFO management change [year]"
"[TICKER] guidance update preliminary results [year]"
"[TICKER] activist investor [year]"
"[TICKER] dividend buyback announcement [year]"
"[TICKER] capital markets day investor day [year]"
"[SECTOR] policy regulation [month year]"
```

## What to extract

### 5.1 Recent headlines (→ `evidence/news.jsonl`)
For each headline (last 72h heavy, last 30d acceptable for context), capture:
- date (publication date)
- title (verbatim)
- url
- source domain
- one-sentence summary
- category: `earnings | guidance | m_and_a | product | regulatory | macro | management | activist | dividend_buyback | partnership | other`
- sentiment: `POSITIVE | NEUTRAL | NEGATIVE` based on a strict rubric:
  - **POSITIVE**: Beat / raise / approval / win / partnership / accretion expected
  - **NEGATIVE**: Miss / cut / rejection / lawsuit / probe / dilutive deal / departure of key talent
  - **NEUTRAL**: Reiterate / clarification / scheduled event / mixed
- impact: `HIGH | MEDIUM | LOW` based on price-moving potential

Aim for **at least 10 headlines** in the last 7 days, more if the ticker is event-rich. If fewer than 5 distinct headlines exist in 30 days, mark `news_velocity: "LOW"` and weight accordingly.

### 5.2 Catalyst calendar (forward-looking)
List upcoming events in the next 90 days:
- date, event, impact (HIGH / MEDIUM / LOW)

Common catalysts:
- Next earnings date + EPS / revenue estimate
- FOMC meetings (especially for rate-sensitive sectors)
- Product launches / events (announced)
- FDA PDUFA dates (biotech)
- Capital markets days / investor days
- Analyst days
- Index rebalances (S&P inclusion / exclusion)
- Lockup expirations
- Major conferences (e.g. CES, GTC)
- Regulatory decisions

### 5.3 Aggregate sentiment score
Compute a weighted news sentiment score in [-1, +1]:

```
news_sentiment = sum(headline.sentiment_value * impact_weight * source_reliability_weight * recency_weight)
                 / sum(impact_weight * source_reliability_weight * recency_weight)

sentiment_value: POSITIVE = +1, NEUTRAL = 0, NEGATIVE = -1
impact_weight: HIGH = 1.0, MEDIUM = 0.5, LOW = 0.2
recency_weight: 24h = 1.0, 72h = 0.8, 7d = 0.6, 30d = 0.3
```

### 5.4 Narrative tracking
Identify the dominant narrative:
- "AI capex tailwind" / "AI digestion concern"
- "GLP-1 weight loss leader" / "GLP-1 demand fatigue"
- "Reshoring beneficiary"
- "Regulatory overhang"
- "Margin compression cycle"
- etc.

Track narrative continuity vs prior cycle's narrative. Sudden narrative shifts are flagged for Loop 12.

## Subscore preview

Per `policies/weights.json:subscore_inputs.news_catalyst`:

```
news_catalyst_preview = (
    0.30 * news_sentiment_72h_normalized +    # -1..+1 → 0..100
    0.30 * catalyst_calendar_skew +           # weighted by impact: net positive vs negative expected catalysts
    0.20 * regulatory_risk_flag +             # 100 = no overhang, 0 = active regulatory threat
    0.20 * narrative_strength                 # how dominant + how durable the current narrative is
)
```

Direction is set per the dominant news_sentiment direction, but Loop 12 may flip it if catalyst calendar contradicts (e.g. positive headlines but negative-impact earnings expected).

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 5,
  "phase": "news_catalysts",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_5_news.json",
    "evidence_records_added": { "news": 18, "regulatory": 2 },
    "headlines_24h": 5,
    "headlines_7d": 14,
    "news_sentiment": 0.62,
    "news_velocity": "HIGH",
    "narrative": "AI capex tailwind continues",
    "narrative_durability": "HIGH",
    "next_catalyst": { "date": "2026-05-21", "event": "Q1 FY27 Earnings", "impact": "HIGH" },
    "regulatory_overhang": false,
    "news_catalyst_preview": 84,
    "news_catalyst_direction": "BULLISH"
  },
  "skipped_sources": [{ "domain": "wsj.com", "reason": "403_paywall" }],
  "errors": [],
  "searches_used": 14
}
```

## Outputs to knowledge base

- Evidence in `evidence/news.jsonl`, `evidence/regulatory.jsonl` (if regulatory items found), `evidence/geopolitical.jsonl` (if geo events).
- Snapshot at `runs/<T>/loop_5_news.json`.

## Invariants

- `news_sentiment` is set in [-1, +1].
- The catalyst calendar lists at minimum the next earnings date, or explicitly notes "no earnings catalyst within 90 days".
- Every headline has a sentiment label.

## Failure handling

- **All major news sources paywalled**: fall back to aggregator snippets in search results. Mark `news_quality: "LOW"`.
- **No news in 30 days**: this is itself information. Set `news_velocity: "LOW"`, `news_catalyst_preview` capped at 50.
- **Regulatory action discovered**: append a HIGH severity entry to the carry-forward `risks` list — Loop 12 will validate.

## Delta-mode behavior

In `delta` mode, this loop runs identically — except it reuses the prior catalyst calendar and only adds new headlines + updates sentiment. Skip catalysts already on the calendar that haven't changed.

## Notes

- News sentiment is **the most easily fooled** signal — single-source PR pieces, rumor mill, AI-generated low-quality news. The `source_reliability_weight` multiplier is essential. Loop 12 (adversarial) explicitly stress-tests this.
- Resist the urge to call a single piece of bullish news a "catalyst" — only flag as MEDIUM/HIGH impact if confirmed by ≥2 Tier-4 sources.
