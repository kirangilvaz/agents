# Sub-agent: Loop 3 — Discovery Sweep (Phases 3–8: Exhaustive Channel Crawl)

**Phase:** `discovery` · **Loop ID:** 3 · **Runs in every mode** (full sweep in cold/warm; light refresh + new-entrant scan in delta).

## Purpose

Cast the widest possible net across **all opportunity types** to discover candidate channels and gather raw evidence — influencers, communities, agencies, partnerships, affiliates, newsletters, podcasts, events, leads, paid channels, and the growth/buying signals that time them. This is where thoroughness lives: **every channel class MUST be attempted, no silent skips.** Output is a pool of candidate opportunities ready for canonicalization (Loop 4) and enrichment (Loop 5).

## Inputs

- Loop 0/1/2 checkpoints; `icp.json`; `competitors.json`; `runs/<brief_id>/<T>/discovery_pool.json` (competitor seeds).
- All prior canonical opportunity records (refresh, not just discover net-new).
- [`policies/source_ttl.json`](../policies/source_ttl.json) (TTL, rate limits, paywall/login fallback) and [`policies/channels.json`](../policies/channels.json) (per-type discovery hints, platforms).
- Search budget: **`loop_3`** (default 450; delta shares the 350 cap).

## Tool contract

| Operation | Primary | Fallback |
|-----------|---------|----------|
| Discovery search (e.g. `best subreddits for retail investors`) | `WebSearch` | `WebFetch` on a directory/index |
| Fetch a profile/listing/directory page | `WebFetch` canonical URL | reader proxy `https://r.jina.ai/<url>` → archive → search snippet |
| Structured public data (Reddit `.json`, podcast DB, agency directory) | the source's public API/endpoint | `WebSearch` snippet |

**Concurrency:** batch independent searches in parallel (one message, multiple `WebSearch` calls). The type sweeps are independent and SHOULD be issued in parallel. **Never scrape behind login; never fabricate a count or contact.**

## Step 1: Sweep every opportunity type

Expand the ICP's "where they spend time" + Loop 2 seeds into per-type queries (combine ICP terms × category × geo × `Y`). For each type, attempt its discovery class from [`AGENT.md`](../AGENT.md)'s source tiers:

- **INFLUENCER (Tier 2):** YouTube/TikTok/IG/X/LinkedIn creators in the niche. Queries like `[category] youtube creators [Y]`, `[niche] tiktok`, `[competitor] sponsored`. Capture handle + claimed audience size + sponsor history.
- **COMMUNITY (Tier 3):** subreddits (+ public `.json` for member counts/activity), Discord (disboard), Slack, FB groups, Telegram, forums (Indie Hackers for B2B). Capture member count + activity + self-promo rules.
- **AGENCY (Tier 4):** Clutch/DesignRush/AgencySpotter by specialty (SEO/paid/influencer/PR/content/demand-gen/affiliate). Capture specialty + pricing band + client logos + rating.
- **PARTNERSHIP / AFFILIATE (Tier 4):** integration marketplaces (Zapier), adjacent SaaS, associations, affiliate networks (Impact/PartnerStack/ShareASale). Capture program terms / partnership angle.
- **NEWSLETTER / PODCAST / EVENT (Tier 5):** beehiiv/Substack newsletters + sponsorship marketplaces (Passionfroot/Paved) for REAL priced inventory; Listen Notes/Apple/Spotify podcasts; Meetup/Eventbrite/conference sites. Capture subscriber/download/attendee counts + sponsorship/guest availability + rates.
- **LEAD (B2B only):** potential customer companies fitting the ICP firmographics.
- **PAID_CHANNEL / CONTENT_SEO:** ad platforms a competitor demonstrably runs (from Loop 2) + keyword/SEO plays.

Also run **cross-cutting discovery queries** to catch what seeds miss: `where do [ICP] hang out online [Y]`, `best [category] communities/newsletters/podcasts [Y]`, `[category] micro influencers`, `[category] affiliate program`.

> If `focus=<TYPE>` is set, weight that type's queries more heavily but STILL sweep the others.

## Step 2: Growth & buying signals (Phase 8 — light pass here, deepened in Loop 6)

While sweeping, capture any **growth/buying signals** attached to a candidate: recent funding, a product launch, hiring for growth/marketing, expansion news, or a community activity spike. These raise the `growth_signals` dimension and can fire the `recent_funding_or_launch` amplifier. (Loop 6 does the dedicated deep pass; here just don't drop signals you stumble on.)

## Step 3: Refresh existing opportunities

For every prior canonical opportunity, re-query the signals flagged stale in Loop 0 (and ALWAYS growth/buying signals + reach, which decay fastest). Honor cache TTLs in warm/delta: a cache hit consumes 0 budget. In cold mode, ignore caches.

## Step 4: Delta-mode new-entrant scan

In delta mode, Steps 1–2 are trimmed: refresh existing opportunities' fast-decaying signals, then spend the reserved budget on a **new-entrant scan** — only the highest-yield discovery queries (new newsletters/creators in the niche, fresh funding/launches that create warm leads, newly active communities).

## Step 5: Capture evidence

For every candidate (new or existing), write append-only evidence records to `evidence/<opportunity_id>.jsonl` per [`schemas/evidence_record.schema.json`](../schemas/evidence_record.schema.json). For brand-new candidates without an assigned id, stage them in `discovery_pool.json` keyed by a provisional slug; Loop 4 assigns canonical ids.

Each evidence record MUST include: `signal_class`, `feeds_dimension`, `source_domain`, `source_tier`, `url`, `url_hash`, `fetched_at`, `exact_quote` (verbatim), `verification_status`, and a structured `data_point` where possible (e.g. `{metric:"subscriber_count", value:412000, prior_value:380000, as_of:"2026-05-01"}`). **Never fabricate a quote or a number.** Counts that can't be confirmed from a verifiable source → `verification_status: "unverified"`, value `null`.

## Step 6: Cache everything

Write a `cache_entry` (sha256(url) filename) for every fetch with `expires_at = fetched_at + ttl_hours`. Store only a trimmed `content_excerpt` — never full copyrighted articles or scraped private data.

## Output checkpoint

```json
{
  "cycle": 3,
  "loop": 3,
  "phase": "discovery",
  "completed_at": "<iso>",
  "state": {
    "discovery_pool_path": "runs/ai-stock-signals/<T>/discovery_pool.json",
    "candidates_total": 214,
    "candidates_new": 63,
    "candidates_refreshed": 41,
    "by_type": { "INFLUENCER": 58, "COMMUNITY": 39, "AGENCY": 18, "PARTNERSHIP": 16, "AFFILIATE": 9, "NEWSLETTER": 22, "PODCAST": 17, "EVENT": 11, "LEAD": 14, "PAID_CHANNEL": 6, "CONTENT_SEO": 4 },
    "evidence_records_written": 488,
    "buying_signals_spotted": 12,
    "sources_attempted": 26,
    "cache_hits": 88,
    "cache_misses": 362
  },
  "skipped_sources": [
    { "source": "instagram.com", "reason": "engagement login-gated", "fetch_status": "login_required" }
  ],
  "errors": [],
  "searches_used": 442
}
```

## Outputs to memory

- `evidence/<opportunity_id>.jsonl` — appended (existing opportunities).
- `sources_cache/<hash>.json` — written/updated.
- `runs/<brief_id>/<T>/discovery_pool.json` — extended with new candidates (provisional slugs), consumed by Loop 4.

## Invariants

- Every opportunity type in [`policies/channels.json`](../policies/channels.json) was attempted; failures are in `skipped_sources`.
- Every candidate has ≥1 evidence record with a verbatim quote.
- No fabricated counts, contacts, rates, or sponsorship-availability claims; unconfirmable counts are `unverified` with `null` value.

## Failure handling

- **Source unreachable / login-gated:** apply `policies/source_ttl.json:global_rules.paywall_fallback_chain`; if still blocked, record what's publicly visible with the right `fetch_status` and log to `skipped_sources`. Do NOT drop it silently and do NOT scrape behind login.
- **Budget exhausted mid-sweep:** stop discovery, write the checkpoint with `searches_used = budget`, and let the orchestrator skip to scoring with what was gathered.
