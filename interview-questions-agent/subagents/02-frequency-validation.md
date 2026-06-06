# Sub-agent: Loop 2 — Frequency Counting & Provenance-Aware Validation

**Phase:** `frequency_validation` · **Loop ID:** 2 · **Skipped in delta mode.**

## Purpose

Convert each canonical question's raw candidates into **evidence records** with full provenance, then count **independent** sources via citation-cycle dedup. This is the single biggest accuracy fix over the original spec: two sources are independent only if neither cites the other (transitively).

## Inputs

- Loop 1b checkpoint
- `runs/<ts>/canonical_candidates.jsonl`
- `interview_questions_knowledge/sources_cache/` — provides `outbound_links` for every URL
- `interview_questions_knowledge/evidence/<question_id>.jsonl` — existing evidence baseline (warm start)
- Loop 0's `recency_window` `[Y-2, Y-1, Y]`

## Step 1: Build evidence records

For each `(raw_candidate, question_id)` pair from Loop 1b:

1. Look up the source's `cache_entry` to get `outbound_links`.
2. Build a new evidence record (see [`schemas/evidence_record.schema.json`](../schemas/evidence_record.schema.json)) with:
   - `evidence_id` = ULID
   - `question_id` = canonical id from Loop 1b
   - `cites` = `cache_entry.outbound_links` filtered to URLs that look interview-question-related
   - `confirmed_in_cycle` = current cycle
   - All other fields copied from the raw candidate
3. **Skip** if `extractor_confidence < 0.7`.
4. **Append** to `evidence/<question_id>.jsonl`. Existing evidence records for the same `(question_id, url_hash)` pair are NOT duplicated — instead append the current cycle to their `rescraped_in_cycles`.

## Step 2: Build the citation graph

Construct a directed graph `G` where:

- Nodes are URLs across all evidence records for a given `question_id`.
- Edges are `cites` relationships (extracted from cached `outbound_links` during Step 1, plus any explicit `cites` already in older evidence).

Maintain `cited_by` as the reverse index for fast cycle detection.

## Step 3: Independent-source counting

For each `question_id`, compute `independent_source_count`:

```
1. Group evidence records by source_domain (e.g. all leetcode.com records form one group).
2. For each group, pick the highest-tier representative URL (earliest fetched_at as tiebreaker).
3. Walk the citation graph: two representatives are NOT independent if there is a directed
   path between them (in either direction) that stays within the citation graph.
4. Use Tarjan's algorithm to identify strongly-connected components. All representatives
   within one SCC count as ONE independent source.
5. independent_source_count = number of distinct SCCs across the chosen representatives.
```

This breaks the original spec's silent failure where "Glassdoor + NeetCode" looked like 2 sources but NeetCode actually cited Glassdoor.

## Step 4: Cross-validation rule

A question is **eligible** for the main list iff:

- `independent_source_count >= 2` **AND**
- At least one of those independent sources is Tier 1 or Tier 2

Single-source questions are NOT excluded — they're moved to `emerging.json` for next-cycle re-validation. They never enter the main 135.

## Step 5: Per-question metrics

For each canonical question, also compute:

| Metric | Definition |
|--------|------------|
| `evidence_count` | Total records in `evidence/<question_id>.jsonl`. |
| `company_count` | `len(distinct evidence.company)` excluding nulls. |
| `recent_confirmation` | True iff at least one Tier 1/2 evidence record has `report_year` in `[Y-2, Y-1, Y]`. |
| `newest_recent_year` | `max(report_year for tier∈{1,2} and report_year in window)` or `null`. |
| `community_signal` | Categorize by sum of Tier 4 evidence: `none` (0), `discussed` (1–3), `heavily_discussed` (4+). |
| `persistence_years` | `len(distinct report_year)` across all evidence. |

For coding questions specifically:

- LeetCode `#N` and difficulty if any evidence carries them
- DSAPrep.dev frequency count if present
- `in_blind75` / `in_neetcode150` membership flags

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_2.json`:

```json
{
  "cycle": 7,
  "loop": 2,
  "phase": "frequency_validation",
  "completed_at": "<iso>",
  "state": {
    "questions_validated": 612,
    "questions_eligible": 412,
    "questions_emerging": 200,
    "evidence_records_added": 2104,
    "evidence_records_re_confirmed": 1789,
    "citation_cycles_collapsed": 47,
    "per_question_metrics_path": "runs/<ts>/per_question_metrics.json"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

`per_question_metrics.json` is the canonical input to Loop 3.

## Outputs to knowledge base

- **`evidence/<question_id>.jsonl`** — appended new records and updated `rescraped_in_cycles`.

## Invariants for downstream loops

- Every eligible question has `independent_source_count >= 2` with ≥1 Tier 1/2 source.
- Every evidence record has `cites` populated (possibly empty list, never null).
- The citation graph is acyclic per SCC after Tarjan; SCC membership is deterministic.

## Failure handling

- **Evidence file write failure**: retry once; if still failing, write to `runs/<ts>/evidence_pending/` and surface in checkpoint `errors`. Loop 8 must reconcile or the run is incomplete.
- **Citation graph too large** (memory-bound for very popular questions): chunk by `source_tier` and run SCC per tier; merge results conservatively (assume cross-tier independence unless explicit edge exists).
- **`extractor_confidence` missing on a raw candidate**: treat as 0.5 (below threshold), skip with log.
