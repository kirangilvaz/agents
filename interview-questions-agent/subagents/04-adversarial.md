# Sub-agent: Loop 4 — Adversarial Challenge Pass

**Phase:** `adversarial` · **Loop ID:** 4 · **Skipped in delta mode (delta-mode re-validation queue handles its own subset).**

## Purpose

**Try to disprove every question's ranking.** Critique over generation. This is the single most important loop — without it the agent just confidently regurgitates whatever the loudest sources say. Every question must survive ≥2 adversarial passes before convergence.

## Inputs

- Loop 3 checkpoint and `ranked.jsonl`
- Per-question metrics from Loop 2
- `evidence/<question_id>.jsonl`
- Search budget for this loop (default 200)

## Scope

Run adversarial review on:

1. **All questions in the top 100** by frequency score across categories.
2. **All questions with `adversarial_passes < 2`** (so newly-added questions get challenged before convergence).
3. **All questions whose freq changed by ≥ 10 points vs prior cycle** (sudden moves are suspicious).

## Step 1: Counter-research

For each in-scope question, run targeted searches (counts toward the 200 budget):

```
"[QUESTION_TITLE]" outdated interview [Y]
"[QUESTION_TITLE]" no longer asked FAANG [Y]
"[QUESTION_TITLE]" replaced by [Y]
[CATEGORY] interview questions declining frequency [Y]
"[QUESTION_TITLE]" deprecated [Y]
"[QUESTION_TITLE]" trick question [Y]
```

Cache responses per the same TTL policy. Add resulting evidence to `evidence/<question_id>.jsonl` with a special marker `confirmed_in_cycle = current` and a `cites: []` (counter-evidence is its own thing — surface in `risks`, not in `independent_source_count`).

## Step 2: Adversarial questions

For each in-scope question, ask AND answer honestly:

1. **What is the strongest argument for REMOVING this question from the list?**
2. **Which source is weakest?** Is any source outdated, paywalled, or AI-generated?
3. **Has a newer variant or replacement emerged?** (e.g. "topological sort" replacing "course schedule" because the canonical phrasing shifted)
4. **Is the frequency inflated by a single dominant source?** Re-check `independent_source_count` against Tier 1/2 specifically — if removing the dominant source drops it below 2, flag.
5. **Would a hiring manager today (relative to Y) actually ask this?** Or is it legacy?
6. **Does the question's `exact_quote` actually support the claim?** Sample 2 random evidence records and re-read their quotes.

Record answers in `runs/<ts>/adversarial_log/<question_id>.json`.

## Step 3: Signal corroboration

Cross-check each question's signals against each other:

- Do LeetCode frequency counts align with 1Point3Acres reports?
- Do Glassdoor reviews corroborate Blind posts?
- Are community discussions (Reddit, HN) consistent with curated guide rankings?
- Is there a source that **disagrees** with the current ranking?

Conflicts are recorded in the question's `risks` field.

## Step 4: Score adjustment & verdict

Based on the challenge, assign one of these verdicts:

| Verdict | Action |
|---------|--------|
| `CONFIRMED` | All signals align. Mark `adversarial_passes += 1`. No score change. |
| `WEAKENED` | One signal conflicts. Reduce conviction by 1 level. Note the conflict in `risks`. |
| `MULTI_CONFLICT` | Multiple signals conflict. Reduce `freq` by 5–10 points (re-clamp). Note all conflicts. |
| `FLAG_REMOVE` | Counter-evidence is strong (e.g. multiple Tier 1 sources confirm question is no longer asked, OR `exact_quote` re-read fails to support the claim). Flag for **Lane A integrity removal** in Loop 5. |
| `FLAG_RENAME` | Canonical question is right, but the title/canonical_id is misleading. Flag for Loop 5 to rename. |
| `FLAG_MERGE` | Adversarial pass discovered this question is the same as another canonical question. Flag for Loop 5 to merge. |

## Step 5: Source reliability feedback

For each source whose evidence supported a question that ended up `CONFIRMED` → `+1 to candidates_confirmed`.
For each source whose evidence supported a question that ended up `FLAG_REMOVE` → `-1 to candidates_confirmed` (clamped at 0).

This feeds back into `source_reliability.json` at Loop 8.

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_4.json`:

```json
{
  "cycle": 7,
  "loop": 4,
  "phase": "adversarial",
  "completed_at": "<iso>",
  "state": {
    "questions_challenged": 137,
    "verdicts": {
      "CONFIRMED": 109,
      "WEAKENED": 18,
      "MULTI_CONFLICT": 6,
      "FLAG_REMOVE": 2,
      "FLAG_RENAME": 1,
      "FLAG_MERGE": 1
    },
    "challenged_path": "runs/<ts>/challenged.jsonl",
    "adversarial_log_dir": "runs/<ts>/adversarial_log/",
    "source_reliability_deltas": {
      "leetcode.com": {"candidates_confirmed_delta": 14},
      "medium.com": {"candidates_confirmed_delta": -3}
    }
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 187
}
```

## Outputs to knowledge base

- New evidence records (counter-evidence) in `evidence/<question_id>.jsonl`.
- `source_reliability` deltas are staged in checkpoint, applied in Loop 8.

## Invariants for downstream loops

- Every in-scope question has a verdict.
- Every question with `FLAG_*` verdict has a `runs/<ts>/adversarial_log/<question_id>.json` with the rationale and supporting evidence_ids.
- `risks` field on every challenged question is populated (possibly empty list, never null).

## Failure handling

- **Counter-search returns empty**: that's a positive signal (no contrary evidence). Mark as `CONFIRMED` only if Step 2's questions are answered satisfactorily.
- **Quote re-validation fails for a sampled record**: flag the specific evidence record with `confidence -= 0.2`, but do not fail the question unless ALL sampled records fail.
- **Search budget exhausted mid-pass**: complete current question's checks, then write checkpoint with `state.partial = true`. Convergence cannot be reached this cycle; orchestrator continues to Loop 5 with what it has.
