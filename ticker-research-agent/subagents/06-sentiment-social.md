# Sub-agent: Loop 6 — Social & Community Sentiment

**Phase:** `sentiment_social` · **Loop ID:** 6 · **Always runs (cold/warm/delta).**

## Purpose

Capture retail and community sentiment from Reddit, StockTwits, Twitter/X cashtags, and tech communities. Detect retail-vs-institutional divergence (often the most actionable contrarian signal). Drives `social_community_sentiment` subscore (weight 0.04 stocks, 0.07 crypto where retail matters more).

## Inputs

- Loop 0 checkpoint
- Search budget: default 80

## Sources

Tier 5:
- `reddit.com/r/wallstreetbets`, `reddit.com/r/stocks`, `reddit.com/r/options`, `reddit.com/r/investing`, `reddit.com/r/stockmarket`
- `stocktwits.com/symbol/<TICKER>`
- X (Twitter) — search `$<TICKER>` cashtag (snippets only; respect ToS)
- `news.ycombinator.com` — for tech-adjacent tickers
- `substack.com` — independent finance writers (downweighted)

Asset-class-specific:
- Crypto: `reddit.com/r/cryptocurrency`, `reddit.com/r/<COIN>`, Crypto Twitter influencer accounts
- Memes: `reddit.com/r/wallstreetbetsELITE`, `reddit.com/r/Superstonk` (for highly-shorted names)

## Search queries

```
"[TICKER] reddit wallstreetbets [last 7 days]"
"[TICKER] reddit stocks discussion [month year]"
"[TICKER] stocktwits sentiment [year]"
"$[TICKER] twitter [last 7 days]"
"[TICKER] retail investor sentiment [year]"
"[TICKER] mentioned reddit [last 24 hours]"
```

For specific themes:
```
"[TICKER] short squeeze reddit [year]"
"[TICKER] meme stock retail [year]"
"[TICKER] earnings reaction reddit [latest quarter]"
```

## What to extract

### 6.1 Reddit (→ `evidence/sentiment_social.jsonl`)
- Mention count last 24h / 7d (rough; from search result counts and DD post tracker if available)
- Top 5 highest-upvoted threads in last 7 days mentioning the ticker — title, subreddit, score, timestamp, URL, dominant sentiment
- Aggregate sentiment in [-1, +1] using upvote-weighted scoring of post titles + top comments
- Flag if any post has gone "viral" (>1000 upvotes) — adds to retail FOMO signal

### 6.2 StockTwits
- Bullish % (their internal metric)
- Message volume vs prior 30-day average
- Top trending message types (bullish DD, bearish puts, neutral chart posts)

### 6.3 Twitter/X cashtag
- Cashtag volume last 24h
- Notable tweets (high engagement, especially from FinTwit personalities like @ZeroHedge, sector specialists, fund managers)
- Sentiment polarity in [-1, +1] from the top 20 most-engaged tweets

### 6.4 Hacker News (tech tickers only)
- Recent threads mentioning the company / product
- Engineer / founder commentary tone
- Product critique vs praise ratio

### 6.5 Retail vs institutional divergence
This is the alpha-rich signal. Compute:

```
retail_sentiment_z = (reddit + stocktwits + twitter) / 3   in [-1, +1]
inst_sentiment_z   = analyst_direction (BULLISH=+1, NEUTRAL=0, BEARISH=-1) × upgrade_pct
                     + 13F_net_buying_normalized
                     + insider_net_buying_normalized

if |retail_sentiment_z - inst_sentiment_z| > 0.6:
    divergence = "RETAIL_LEADING" if retail > inst else "INST_LEADING"
elif sign(retail) == sign(inst):
    divergence = "ALIGNED"
else:
    divergence = "MIXED"
```

`RETAIL_LEADING` is often a contrarian flag (frothy top in WSB-favorite names) — but in genuine breakout stories it can confirm momentum. Loop 12 stress-tests this.
`INST_LEADING` ahead of broad retail enthusiasm is one of the highest-quality bullish setups (smart money in early).

### 6.6 Narrative recurrence
Track which narratives recur across communities:
- Same DD posted to multiple subs?
- Same chart pattern claimed by multiple FinTwit accounts?
- This indicates **narrative durability** — a key driver of multi-week price action.

## Subscore preview

Per `policies/weights.json:subscore_inputs.social_community_sentiment`:

```
social_preview = (
    0.25 * reddit_sentiment_normalized +
    0.20 * stocktwits_sentiment_normalized +
    0.20 * twitter_velocity_normalized +    # message volume change
    0.20 * retail_inst_divergence_score +   # +100 if INST_LEADING+aligned bullish; -100 if RETAIL_LEADING peak frothy
    0.15 * narrative_recurrence
)
```

Direction is **context-dependent**:
- INST_LEADING + bullish → strongly BULLISH
- RETAIL_LEADING + bullish + recent vertical move → can be BEARISH (frothy contrarian)
- RETAIL_LEADING + bullish + early stage breakout → BULLISH (momentum)
- Loop 12 always re-checks the direction here

## Output checkpoint

```json
{
  "ticker": "NVDA",
  "cycle": 12,
  "loop": 6,
  "phase": "sentiment_social",
  "completed_at": "<iso>",
  "state": {
    "snapshot_path": "runs/<T>/loop_6_social.json",
    "evidence_records_added": { "sentiment_social": 14, "sentiment_community": 6 },
    "reddit_sentiment": 0.42,
    "reddit_mentions_24h": 412,
    "stocktwits_sentiment": 0.55,
    "twitter_sentiment": 0.48,
    "retail_vs_inst": "ALIGNED",
    "narrative_recurrence_score": 0.71,
    "social_preview": 71,
    "social_direction": "BULLISH"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 7
}
```

## Outputs to knowledge base

- Evidence in `evidence/sentiment_social.jsonl` and `evidence/sentiment_community.jsonl`.
- Snapshot at `runs/<T>/loop_6_social.json`.

## Invariants

- All four sentiment values (reddit, stocktwits, twitter, hn-if-applicable) are in [-1, +1] OR explicitly null with `data_unavailable`.
- `retail_vs_inst` is set (one of RETAIL_LEADING / INST_LEADING / ALIGNED / MIXED / UNKNOWN).

## Failure handling

- **Reddit JSON API rate-limited**: back off 60s, retry once. If still failing, fall back to search snippets and downgrade confidence.
- **No social mentions detected**: set `social_velocity: "DEAD"`. For micro-caps this is normal. Score caps at 50 (mid-neutral) — don't fail.
- **Sentiment-extraction failure** (mixed irony, sarcasm): downgrade extraction confidence; Loop 12 will re-validate top threads.

## Delta-mode behavior

Run identically. Sentiment shifts hourly; this is one of the most useful delta-mode loops.

## Notes

- Treat WSB sentiment with extreme caution — high mentions can be momentum confirming OR exhaustion top. The `narrative_recurrence` and `retail_vs_inst` fields are what give this signal usable conviction.
- For crypto, also weight Crypto Twitter influencers (named accounts with track records); track and store under `evidence/sentiment_community.jsonl`.
