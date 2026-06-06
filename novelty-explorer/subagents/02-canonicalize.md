# Sub-agent: Loop 2 — Canonicalize & Dedupe Entities

**Phase:** `canonicalize` · **Loop ID:** 2 · **Runs in cold/warm only** (delta reuses existing canonical ids).

## Purpose

Collapse the raw discovery pool into a clean set of **canonical opportunities** with stable `opportunity_id`s, merge duplicates and aliases, assign a primary `domain`, and merge net-new candidates into the existing memory graph so evidence is attached to the right record. This prevents the same technology/company from appearing two or three times under different names.

## Inputs

- `runs/<T>/discovery_pool.json` (Loop 1 staged candidates).
- All prior canonical opportunity records + `aliases.json`.
- [`policies/domains.json`](../policies/domains.json) keywords for domain assignment.
- Search budget: **0** (pure resolution; uses already-fetched evidence).

## Step 1: Normalize names

For each candidate, normalize the display name (trim legal suffixes "Inc/Ltd/Labs" for matching but keep them in `name`), lowercase for matching, strip punctuation. Generate a candidate slug: `kebab-case(normalized_name)`.

## Step 2: Resolve against aliases + existing records

1. Exact slug match against existing `opportunity_id` or any `aka` → merge into that record.
2. Check `aliases.json` (alternate names, tickers, repo slugs, founder-company pairs) → merge.
3. Fuzzy match: if a candidate's name, primary URL domain, or founding team strongly matches an existing record (e.g. same company website, same GitHub org, same arXiv author cluster), MERGE and add the new name to `aka`. When in doubt, keep separate and flag for Loop 5 to disambiguate — never merge two genuinely different entities.

## Step 3: Dedupe within the new pool

Two new candidates that refer to the same entity (e.g. a company and its flagship product, or two spellings) collapse to one. Pick the most recognizable canonical `name`; the others become `aka`.

## Step 4: Assign primary domain

Score each candidate's evidence text against every domain's `keywords`. Assign the highest-scoring domain as `domain`; record up to 2 `secondary_domains`. If nothing scores above threshold, assign `FRONTIER` (Loop 5 may later propose a dedicated domain).

## Step 5: Assign / reconcile opportunity_id and rewrite evidence

- New entity → mint `opportunity_id = slug`; if the slug collides with an unrelated record, suffix a disambiguator (`-photonics`, `-bio`).
- Move any evidence staged under a provisional slug to `evidence/<final_opportunity_id>.jsonl`.
- Update `aliases.json` with every alternate name → canonical id.

## Step 6: Drop obvious non-opportunities

Remove candidates that are clearly not opportunities (general news topics, broad fields with no specific entity/program, pure listicles). Note removals in the checkpoint; do NOT delete their evidence (keep for audit).

## Output checkpoint

Write to `runs/<T>/checkpoints/cycle_{N}_loop_2.json`:

```json
{
  "cycle": 7,
  "loop": 2,
  "phase": "canonicalize",
  "completed_at": "<iso>",
  "state": {
    "canonical_set_path": "runs/<T>/canonical_set.json",
    "opportunities_total": 268,
    "merged_into_existing": 39,
    "new_canonical": 44,
    "duplicates_collapsed": 25,
    "dropped_non_opportunities": 18,
    "domain_distribution": { "AI_INFRA": 61, "BIOTECH": 38, "ENERGY": 22, "QUANTUM": 14, "FRONTIER": 9 }
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to memory

- `aliases.json` — updated (append-merge).
- `evidence/<id>.jsonl` — provisional-slug records relocated to canonical ids.
- `runs/<T>/canonical_set.json` — the deduped opportunity set (consumed by Loop 3).

## Invariants

- Every opportunity has a unique stable `opportunity_id` and exactly one primary `domain`.
- No two records refer to the same real-world entity.
- All evidence is attached to a canonical id (no orphaned provisional slugs remain).

## Failure handling

- **Ambiguous merge (could be same or different entity):** keep separate, flag `needs_disambiguation:true` for Loop 5. Never force-merge.
- **Unassignable domain:** default to `FRONTIER`, do not drop the candidate.
