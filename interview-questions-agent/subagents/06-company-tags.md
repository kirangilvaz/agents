# Sub-agent: Loop 6 — Company Tag Deep Enhancement

**Phase:** `company_tags` · **Loop ID:** 6 · **Runs in all modes (cold/warm/delta).**

## Purpose

Maximize company attribution accuracy. For every question in the final list, do a focused per-company sweep to refine company tags, frequency counts, and level tags. This is also Loop 6's job in **delta mode** — re-validate company tags for stale or decaying questions even if no broad sweep ran.

## Inputs

- Loop 5 checkpoint and `final_list.jsonl` (or in delta mode: prior cycle's final list from `questions/`)
- `coverage_matrix.json`
- [`policies/company_level_tags.json`](../policies/company_level_tags.json) — level normalization rules
- Search budget for this loop (default 300)

## What this loop does

### Step 1: Per-question company refresh

For each question in the final list, for each of the **top 25 companies** in `coverage_matrix.companies`:

1. Build query: `"[QUESTION TITLE]" [COMPANY] interview [Y]`
2. Use cache-first contract (same TTL policy from Loop 1).
3. If new evidence found → add evidence record, recount this question's `companies[].count`.
4. If a Tier 1/2 source no longer mentions the company-question pair AND no other Tier 1/2 source does → **remove** that company tag (only remove on absence-of-evidence from a strong source; never on Tier 4 silence alone).

### Step 2: Frequency count enrichment

For coding questions specifically:

- Cross-reference LeetCode company tags + DSAPrep.dev frequency data + Crackr.dev rankings.
- Where the source provides an explicit count (e.g. "asked 108 times"), set `companies[i].count = max(existing, source_count)`.
- Where multiple sources give different counts, use the **maximum** (counts are floors, not ceilings — sources tend to underreport).

### Step 3: Level tag normalization

For each evidence record with a `level_tag`:

1. Look up the company in `policies/company_level_tags.json`.
2. Apply `raw_to_canonical` mapping; if no match, apply `fallback_normalization_rules`.
3. Add the canonical level to `companies[i].level_tags` (deduped).

### Step 4: Last-seen-year refresh

For each company on each question, set `companies[i].last_seen_year = max(report_year for evidence where company == this)`.

### Step 5: Company aggregations

Update `companies/<company_slug>.json` per company with:

```json
{
  "company": "stripe",
  "updated_at": "<iso>",
  "questions_total": 23,
  "questions_by_category": {"swe-coding": 12, "swe-system-design": 5, ...},
  "top_questions": ["question-id-1", "question-id-2", "..."],
  "level_distribution": {"junior": 4, "mid": 11, "senior": 6, "staff+": 2},
  "newest_evidence_year": 2026
}
```

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_6.json`:

```json
{
  "cycle": 7,
  "loop": 6,
  "phase": "company_tags",
  "completed_at": "<iso>",
  "state": {
    "questions_enriched": 135,
    "company_tags_added": 87,
    "company_tags_removed": 12,
    "level_tags_added": 203,
    "company_aggregations_updated": 28,
    "enriched_path": "runs/<ts>/enriched.jsonl"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 274
}
```

## Outputs to knowledge base

- `companies/<company_slug>.json` — updated aggregations.
- New evidence records appended to `evidence/<question_id>.jsonl`.
- New cache entries.

## Invariants for downstream loops

- Every question has `companies[]` sorted descending by `count`.
- Every `level_tag` in `companies[].level_tags` is from the canonical taxonomy (`intern`, `new-grad`, `junior`, `mid`, `senior`, `staff+`).
- `companies/` directory has exactly one file per tracked company.

## Failure handling

- **Search budget exhausted mid-question**: complete current question, mark `state.partial = true`, continue.
- **Conflicting counts across sources**: take max (per Step 2). Log conflict in `risks` only if max disagrees with min by >5x.
- **Level tag with no canonical mapping**: apply fallback rule, log low confidence in evidence record, do not block.
