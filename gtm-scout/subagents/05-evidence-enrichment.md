# Sub-agent: Loop 5 — Evidence Enrichment (Deep-Dive: Reach, Engagement, Contact, Rates, Rules)

**Phase:** `enrichment` · **Loop ID:** 5 · **Runs in cold/warm only.**

## Purpose

Take the canonical opportunity set and go **deep** on each one to gather the structured data points the six scoring dimensions need — and, critically, to **verify the numbers** (the mission's anti-hallucination core). Loop 3 cast a wide net; Loop 5 fills the gaps so every dimension has enough independent, verified evidence to score (target ≥ `min_sources` = 2 independent sources per opportunity).

## Inputs

- `runs/<brief_id>/<T>/canonical_set.json` (Loop 4); `icp.json` (for audience-match).
- Existing `evidence/<id>.jsonl`, `source_reliability.json`.
- [`policies/source_ttl.json`](../policies/source_ttl.json), [`policies/scoring.json`](../policies/scoring.json) (so the enricher knows which components each dimension needs), [`policies/channels.json`](../policies/channels.json) (influencer tiers).
- Search budget: **`loop_5`** (default 300).

## Step 1: Identify evidence gaps per opportunity

For each opportunity, check which scoring components (from `policies/scoring.json:dimension_components`) lack a **verified** data point. Prioritize gaps on opportunities near the floor (the highest value-of-information searches). Spend more budget on sparse candidates; little on already well-covered ones.

## Step 2: Targeted deep-dive by type

For each opportunity, gather (always with a verbatim quote + `verification_status`):

**Reach (the core number — verify hard):**
- INFLUENCER: subscriber/follower count from the **native profile** (verified) cross-checked vs Social Blade (estimated). Assign `influencer_tier` per `policies/channels.json:influencer_tiers` ONLY from a verified count.
- COMMUNITY: member count + activity (posts/day, online members) — Reddit `.json` is authoritative; Discord/FB via public about pages.
- NEWSLETTER: subscriber count (publisher page / sponsorship marketplace) — often verifiable on Passionfroot/Paved/beehiiv.
- PODCAST: Listen Notes listen-score / chart ranking (downloads rarely public → mark `estimated`/`unverified`).
- EVENT: attendee count (event site / prospectus).
- LEAD/PARTNERSHIP: company size, traffic (estimator → `estimated`).

**Engagement (reach quality):** avg views/likes/comments vs audience size; community posts-per-day; newsletter open rate (only if published). Used to flag `engagement_far_below_size`.

**Audience match:** evidence the audience overlaps the ICP (audience demographics if published, topical fit of recent content, geo signals). Compare against `icp.json`.

**Ease of access:** is there a **published** contact (business email, sponsorship form, "work with me" page, partner-program URL)? Does it accept sponsors/guests? What are the self-promo rules? Populate `access.contact` ONLY if verified — else `null` / `Unverified`. Never invent an email.

**Cost efficiency:** published rate card / CPM (sponsorship marketplaces, media kits), affiliate commission %, agency pricing band. Compute against the brief's budget. If no rate is published → `est_cost_usd: "Unverified"`.

For every data point, prefer a **structured metric with a `prior_value`** so Loop 7 can compute growth, not just levels.

## Step 3: Write enriched evidence

Append new evidence records (same schema as Loop 3). Set `verification_status` honestly: native/authoritative = `verified`, third-party estimator = `estimated`, unconfirmed = `unverified`. Mark `confidence` honestly — a vague snippet is < 0.7 and is excluded from independent-source counting. Honor caches and the no-silent-skip / no-login rules.

## Step 4: Stage the enriched set

Emit `runs/<brief_id>/<T>/enriched_set.json`: each opportunity with attached `audience`, `access`, and per-dimension evidence summaries, plus a per-dimension `data_availability` flag where a component still can't be filled.

## Output checkpoint

```json
{
  "cycle": 3,
  "loop": 5,
  "phase": "enrichment",
  "completed_at": "<iso>",
  "state": {
    "enriched_set_path": "runs/ai-stock-signals/<T>/enriched_set.json",
    "opportunities_enriched": 178,
    "evidence_records_added": 401,
    "verified_reach_counts": 121,
    "unverified_reach_counts": 38,
    "contacts_found_verified": 64,
    "rate_cards_found": 29,
    "opportunities_below_min_sources": 24
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 291
}
```

## Outputs to memory

- `evidence/<id>.jsonl` — appended.
- `sources_cache/<hash>.json` — written/updated.
- `runs/<brief_id>/<T>/enriched_set.json` — consumed by Loop 6/7.

## Invariants

- Every opportunity targeted for the leaderboard has had its reach + access + cost gaps addressed (or `data_unavailable` flagged on the dimension that still can't be filled).
- Every number traces to a verbatim `exact_quote` with a `verification_status`. No invented counts/contacts/rates.
- `access.contact` is populated ONLY when `contact_verified: true`.

## Failure handling

- **Still < `min_sources` after enrichment:** keep the opportunity but flag `data_availability:"PARTIAL"`; Loop 7 caps under-evidenced dimensions at 50 and sets conviction `LOW`.
- **Conflicting reach numbers across sources:** record both with their sources; Loop 7 uses the most authoritative (native > estimator > listicle) and notes the conflict in `risks`.
- **Only an estimator number exists for the core reach:** keep it as `estimated`, cap the opportunity at `QUALIFIED`, and note "reach estimate only" in `risks`.
