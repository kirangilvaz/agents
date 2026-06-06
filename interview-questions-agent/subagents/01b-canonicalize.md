# Sub-agent: Loop 1b — Canonicalize

**Phase:** `canonicalize` · **Loop ID:** 1b · **Skipped in delta mode.**

## Purpose

Collapse raw candidates into **canonical questions**. "Two Sum", "Find pair summing to K", and "Two-sum problem" should be one record, not three. Without this step, frequency counts are noisy and the "≥2 independent sources" rule is undermined.

## Inputs

- Loop 1 checkpoint
- `runs/<ts>/raw_candidates.jsonl`
- `interview_questions_knowledge/aliases.json` — accumulated paraphrase → `question_id` map
- `interview_questions_knowledge/questions/<category>/*.json` — existing canonical questions (warm start)

## Canonicalization strategy (per category)

### Coding (`swe-coding`, `aiml-coding`)

**Primary anchor:** LeetCode problem number when present. All raw candidates citing the same LeetCode `#N` collapse to one canonical question.

**Fallback:** title normalization (lowercase, strip punctuation, drop stopwords) + Levenshtein ≤ 3 matching against existing canonical titles in the same subcategory.

**Last resort:** semantic similarity ≥ 0.90 using any available embedding tool. Below that threshold → keep separate.

### System Design (`swe-system-design`, `aiml-system-design`)

**Primary anchor:** the system being designed (URL shortener, rate limiter, RAG chatbot). Build a vocabulary of canonical system names and match raw candidate titles against it.

**Fallback:** semantic similarity ≥ 0.85 (looser than coding because system-design phrasing varies more).

### Behavioral (`swe-behavioral`)

**Primary anchor:** STAR archetype (Conflict, Failure, Ownership, Ambiguity, Mentoring, etc.). Build a vocabulary of canonical archetypes; match raw candidate prompts to the closest archetype.

**Aliases for behavioral are looser** because the same archetype is asked in many phrasings ("disagreement with manager", "tell me about a time you disagreed", "describe a conflict at work" → all `archetype:conflict`). Store all phrasings in `aliases.json` keyed to the canonical question_id.

### Conceptual (`aiml-conceptual`)

**Primary anchor:** the concept being asked about (bias-variance, RLHF, RAG, LoRA). Match against a curated concept vocabulary.

**Fallback:** semantic similarity ≥ 0.88.

## Algorithm

For each raw candidate:

```
1. Normalize raw_title (lowercase, strip punctuation, drop stopwords).
2. Look up normalized title in aliases.json → if match, assign existing question_id. STOP.
3. Apply category-specific anchor (LeetCode #, system name, archetype, concept).
4. If anchor matches an existing canonical question → assign question_id, append normalized title to aliases.json. STOP.
5. If category-specific similarity ≥ threshold against existing canonical title → assign question_id, append to aliases.json. STOP.
6. Otherwise → mint a new question_id (slug from raw_title). Create a new in-memory canonical question record.
```

### Slug generation

```
slug = lowercase(raw_title)
       .replace(/[^a-z0-9 ]/g, '')
       .trim()
       .replace(/\s+/g, '-')
       .substring(0, 60)
```

If the slug already exists in the same category, append `-2`, `-3`, etc. (Should never happen if dedup worked, but safety first.)

## Conflict resolution

- If two raw candidates with **different LeetCode numbers** map to the same normalized title → keep separate. LeetCode # wins.
- If a raw candidate matches **multiple existing question_ids** above threshold → flag the candidate as `ambiguous`, do NOT assign, surface in checkpoint `state.ambiguous_candidates` for Loop 4 to investigate.
- If two existing canonical questions are now revealed to be the same (e.g. semantic similarity 0.95 between previously-separate records) → emit a `MERGED` action: keep the higher-evidence_count question, redirect the lower one's evidence and aliases.

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_1b.json`:

```json
{
  "cycle": 7,
  "loop": "1b",
  "phase": "canonicalize",
  "completed_at": "<iso>",
  "state": {
    "raw_candidates_in": 4321,
    "canonical_questions_total": 612,
    "questions_minted_new": 14,
    "questions_merged": 2,
    "aliases_added": 89,
    "ambiguous_candidates": 7
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

Also produces `runs/<ts>/canonical_candidates.jsonl` — one record per (raw_candidate, assigned_question_id) so Loop 2 can build evidence records correctly.

## Outputs to knowledge base

- **`aliases.json`** — updated with new paraphrase mappings.
- New canonical question records are NOT yet written to `questions/`. That happens in Loop 8 after scoring/adversarial/replacement complete.

## Invariants for downstream loops

- Every record in `canonical_candidates.jsonl` has exactly one `question_id`.
- The set of `question_id`s in `canonical_candidates.jsonl` is a superset of the existing baseline (warm start) plus any new ones minted this cycle.
- `aliases.json` round-trips: `aliases[normalize(any_known_phrasing)] == question_id`.

## Failure handling

- **Embedding tool unavailable**: fall back to Levenshtein-only matching with a tighter threshold (e.g. ≤ 2). Log degraded mode in checkpoint.
- **Translation failure on a candidate** (Loop 1 flagged it): match on `translated_quote` if available, otherwise skip canonicalization for that candidate and surface it in `ambiguous_candidates`.
- **Slug collision**: append numeric suffix as described above.
