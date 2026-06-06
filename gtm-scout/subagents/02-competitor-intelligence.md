# Sub-agent: Loop 2 — Competitor Intelligence (Phase 2)

**Phase:** `competitor_intel` · **Loop ID:** 2 · **Runs in cold/warm only.**

## Purpose

Reverse-engineer **how competitors already acquire customers** — and harvest that as a discovery seed list. Competitors' influencers, affiliate programs, communities, podcasts, conferences, and ad channels are the highest-conviction starting points for the product, because they've already proven the audience converts in this category. Produces `competitors.json`.

## Inputs

- Loop 0 + Loop 1 checkpoints; `icp.json`; the normalized brief (`competitors_seed`).
- [`policies/channels.json`](../policies/channels.json):`competitor_intel_dimensions` (the fields to fill per competitor).
- [`policies/source_ttl.json`](../policies/source_ttl.json) (ad libraries, traffic estimators, review sites, competitor sites).
- Search budget: **`loop_2`** (default 180).

## Step 1: Build the competitor set

- **Direct competitors** — products solving the same problem for the same ICP.
- **Indirect competitors** — different approach, same job-to-be-done.
- **Adjacent products** — complementary tools the ICP already uses (these double as partnership/affiliate targets in Loop 3).

Start from `competitors_seed` and the category map from Loop 1; expand via `[product] alternatives`, `[product] vs`, G2/Capterra "compare" pages. Cap at the ~8–12 most relevant; don't sprawl.

## Step 2: For each competitor, fill the intel dimensions

Attempt EACH field in `competitor_intel_dimensions` (log any you can't fill — never fabricate):

- **Traffic sources** — Similarweb/estimator snippets: which channels drive their traffic (search/social/referral/direct). Mark estimates as `estimated`.
- **Influencers promoting them** — `[competitor] sponsored`, `[competitor] review`, `[competitor] partner` on YouTube/X/IG/TikTok. Each found influencer is a **discovery seed** for Loop 3 (high conviction: they already promote this category).
- **Affiliate program** — fetch `[competitor].com/affiliates`, `/partners`; check Impact/PartnerStack/ShareASale. Note commission terms if published.
- **Communities discussing them** — subreddits/Discords/forums where the competitor is mentioned (seeds for Loop 3).
- **Podcasts featuring them** — episodes where the competitor/founder appeared (guest-appearance seeds).
- **YouTube channels reviewing them** — reviewers/explainers (influencer seeds).
- **Conferences they attend / sponsor** — event seeds.
- **Advertising channels** — Meta Ad Library / Google Ads Transparency / TikTok Creative Center: which platforms they actively run ads on, with creative angles. These become `PAID_CHANNEL` candidates.
- **Sponsorship & partnership opportunities** — explicit openings the competitor's footprint reveals.

## Step 3: Emit discovery seeds

Every concrete operator found (an influencer handle, a subreddit, a podcast, an agency, a newsletter, an affiliate network) is staged as a **candidate** in `runs/<brief_id>/<T>/discovery_pool.json` with `provisional_slug`, `type`, `source` (which competitor revealed it), and an evidence record. Loop 3 expands these; Loop 4 canonicalizes. **A channel that already promotes a competitor gets the `promoted_competitor_or_peer` amplifier flag in Loop 8.**

## Step 4: Capture evidence

Write evidence records (`signal_class: "competitor"`) for every intel data point with a verbatim quote. Tag estimator-derived numbers `verification_status: "estimated"`. Cache every fetch.

## Output checkpoint

Write to `runs/<brief_id>/<T>/checkpoints/cycle_{N}_loop_2.json`:

```json
{
  "cycle": 3,
  "loop": 2,
  "phase": "competitor_intel",
  "completed_at": "<iso>",
  "state": {
    "competitors_path": "briefs_data/ai-stock-signals/competitors.json",
    "competitors_analyzed": { "direct": 5, "indirect": 3, "adjacent": 4 },
    "dimensions_filled": { "traffic_sources": 9, "influencers_promoting": 22, "affiliate_program": 6, "advertising_channels": 7, "podcasts_featuring": 8 },
    "seeds_staged": 71,
    "evidence_records_written": 96
  },
  "skipped_sources": [{ "source": "similarweb.com", "reason": "full data login-gated", "fetch_status": "login_required" }],
  "errors": [],
  "searches_used": 176
}
```

## Outputs to memory

- `briefs_data/<brief_id>/competitors.json` — the competitor intel graph.
- `runs/<brief_id>/<T>/discovery_pool.json` — competitor-derived seeds (consumed/extended by Loop 3).
- `evidence/<provisional>.jsonl`, `sources_cache/<hash>.json`.

## Invariants

- Every competitor has its intel dimensions attempted; unfillable ones are logged, not invented.
- Every seed has a `type`, a source competitor, and ≥1 evidence record.
- Estimator numbers are tagged `estimated`; nothing is presented as verified that isn't.

## Failure handling

- **Ad library / estimator login-gated:** record `login_required`, fall back to search snippets, mark resulting numbers `estimated`/`unverified`. Do not skip silently.
- **Competitor has no discoverable marketing footprint:** note it (a real signal — the category may be under-marketed = opportunity), don't pad with guesses.
