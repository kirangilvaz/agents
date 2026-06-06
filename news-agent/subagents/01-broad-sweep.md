# Sub-agent: Loop 1 — Broad Sweep (Cast the Widest Net)

**Phase:** `broad_sweep` · **Loop ID:** 1 · Runs once per cold/warm cycle, before scoring.

## Purpose

Gather every candidate story from every source in the [EXHAUSTIVE SOURCE LIST](../AGENT.md#exhaustive-source-list). Do NOT filter yet — breadth first.

## Inputs

- Loop 0 state (`briefing_date`, `news_window`, `changelog`).

## Procedure

Issue searches across all five tiers. **Batch independent searches in parallel** (one tool-call message with multiple `WebSearch` calls per tier) per [Tool Contract §2](../AGENT.md#2-tool-contract). Replace every `[date]` token with `briefing_date`.

1. **Tier 1 — Wire & record-of-record.** AP, Reuters, NYT, WaPo, BBC, WSJ, Guardian, NPR. Note headline and position (lead / featured / buried).
2. **Tier 2 — Broadcast & cable.** CNN, Fox, NBC, ABC, CBS. Note which stories lead across the political spectrum.
3. **Tier 3 — Tech & business.** Bloomberg, CNBC, TechCrunch, The Verge, Ars Technica, Wired, Hacker News.
4. **Tier 4 — Social & aggregator signal.** Google News top stories, Reddit r/news + r/worldnews + r/technology + r/politics, Twitter/X trending, Ground News, Memeorandum, AllSides.
5. **Tier 5 — International & specialist.** Al Jazeera, SCMP, Economist, FT, Nature/Science, Intercept/ProPublica.

Apply the [Paywall & Access Strategy §3](../AGENT.md#3-paywall--access-strategy) whenever a fetch is truncated.

## No-silent-skip rule (REQUIRED)

Every source in the source list MUST be attempted. For each source, record one of: `ok` (with candidate count), `empty`, or `failed` (with reason). Append `failed`/`empty` entries to the changelog. **Never** drop a source without a changelog record. If 3+ Tier 1 sources are `failed` in this run, abort with a degraded-data error per [FAILURE HANDLING](../AGENT.md#failure-handling).

## For each candidate story found, record

- `headline` (as reported)
- `source` outlet (and whether the byline credits a wire service — needed by Loop 2)
- `position` (lead / featured / buried)
- `publish_time` (approximate)
- `category` (best-guess primary category from the [NEWS CATEGORIES](../AGENT.md#news-categories))
- `url`

## Output

A raw list of **50–80 candidate story records** with source attribution, plus a per-source `sweep_status` map. Pass both to Loop 2.

## Invariants

- No filtering, deduplication, or scoring happens here — that is Loops 2 and 3.
- Every source has a `sweep_status` entry.

## Failure handling

- A single failed source: log and continue.
- 3+ Tier 1 failures: abort the run (degraded data).
