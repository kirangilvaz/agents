# Sub-agent: Loop 4 — Canonicalize & Dedupe Entities

**Phase:** `canonicalize` · **Loop ID:** 4 · **Runs in cold/warm only** (delta reuses existing canonical ids).

## Purpose

Collapse the raw discovery pool into a clean set of **canonical opportunities** with stable `opportunity_id`s, merge duplicates and aliases (the same creator found on three platforms; a podcast and its host; a newsletter and its owning company), assign exactly one primary `type`, and merge net-new candidates into the existing memory graph so evidence attaches to the right record.

## Inputs

- `runs/<brief_id>/<T>/discovery_pool.json` (Loops 2–3 staged candidates).
- All prior canonical opportunity records + `aliases.json`.
- [`policies/channels.json`](../policies/channels.json) (type definitions + platforms).
- Search budget: **0** (pure resolution; uses already-fetched evidence).

## Step 1: Normalize names + assign type

For each candidate, normalize the display name/handle (strip `@`, trailing platform suffixes; keep canonical casing in `name`). Generate a slug **namespaced by type**: `{type_prefix}-{kebab(name)}` where prefixes are `inf-`, `comm-`, `agency-`, `part-`, `aff-`, `news-`, `pod-`, `event-`, `lead-`, `paid-`, `seo-`. Assign exactly one primary `type` from the candidate's discovery class (a creator who also has a newsletter → pick the dominant channel as primary; record the other in `aka`/notes).

## Step 2: Resolve against aliases + existing records

1. Exact slug match against existing `opportunity_id` or any `aka` → merge.
2. Check `aliases.json` (alternate handles, URLs, cross-platform identities) → merge.
3. Fuzzy match: same person/org across platforms (same name + linked profiles), same company website, same podcast host → MERGE and add the new handle to `aka`. When genuinely unsure, keep separate and flag `needs_disambiguation:true` for Loop 9. **Never merge two different entities.**

## Step 3: Dedupe within the new pool

Two new candidates that refer to the same entity (a YouTube channel + its Twitter; a newsletter + its sponsor page) collapse to one, primary type = the dominant channel. Pick the most recognizable canonical `name`; others become `aka`.

## Step 4: Assign / reconcile opportunity_id and rewrite evidence

- New entity → mint `opportunity_id = slug`; on collision with an unrelated record, add a disambiguator.
- Move evidence staged under a provisional slug to `evidence/<final_opportunity_id>.jsonl`.
- Update `aliases.json` with every alternate name/handle/URL → canonical id.

## Step 5: Drop obvious non-opportunities

Remove candidates that are clearly not actionable: generic articles with no specific operator, defunct channels, pure listicles with no underlying entity, the user's own product, or direct competitors themselves (those live in `competitors.json`, not the opportunity leaderboard — unless they run an affiliate program the product can join, in which case keep the *program* as an `AFFILIATE`/`PARTNERSHIP`). Note removals in the checkpoint; keep their evidence for audit.

## Output checkpoint

```json
{
  "cycle": 3,
  "loop": 4,
  "phase": "canonicalize",
  "completed_at": "<iso>",
  "state": {
    "canonical_set_path": "runs/ai-stock-signals/<T>/canonical_set.json",
    "opportunities_total": 178,
    "merged_into_existing": 38,
    "new_canonical": 57,
    "duplicates_collapsed": 19,
    "dropped_non_opportunities": 21,
    "type_distribution": { "INFLUENCER": 48, "COMMUNITY": 33, "AGENCY": 15, "PARTNERSHIP": 14, "AFFILIATE": 8, "NEWSLETTER": 19, "PODCAST": 14, "EVENT": 9, "LEAD": 12, "PAID_CHANNEL": 4, "CONTENT_SEO": 2 },
    "needs_disambiguation": 3
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to memory

- `aliases.json` — updated (append-merge).
- `evidence/<id>.jsonl` — provisional-slug records relocated to canonical ids.
- `runs/<brief_id>/<T>/canonical_set.json` — the deduped opportunity set (consumed by Loop 5).

## Invariants

- Every opportunity has a unique stable `opportunity_id` and exactly one primary `type`.
- No two records refer to the same real-world entity.
- All evidence is attached to a canonical id (no orphaned provisional slugs).

## Failure handling

- **Ambiguous merge:** keep separate, flag `needs_disambiguation:true` for Loop 9. Never force-merge.
- **Unassignable type:** assign the closest existing type and flag it; Loop 6 may propose a new product-specific type if a coherent cluster emerges.
