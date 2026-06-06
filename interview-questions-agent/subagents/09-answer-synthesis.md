# Sub-agent: Loop 9 — Answer Synthesis ("How to Answer")

**Phase:** `answer_synthesis` · **Loop ID:** 9 · **Runs in all modes (cold/warm/delta), after Loop 7, before Loop 8.**

## Purpose

Turn the ranked list from a *research artifact* into a *study artifact*. For every question on the final list, synthesize a **concise "how to answer" layer** — key talking points, an approach summary, common mistakes, and likely follow-ups — so the user can actually learn each question, not just see that it's frequently asked.

This is deliberately **NOT** a full solution generator. No full code, no end-to-end design docs, no complete STAR scripts. It produces the *scaffolding* a prepared candidate carries in their head. Keeping it concise also keeps it grounded and cheap.

## Grounding principle (critical)

Prep content MUST be grounded in:

1. The question's own `evidence/<question_id>.jsonl` quotes (what real interviewers actually probe).
2. Well-established, non-controversial domain knowledge (e.g. "Two Sum is solved with a one-pass hash map in O(n)").

Do NOT invent company-specific claims, fabricated metrics, or speculative follow-ups that no evidence supports. When the model is unsure, lower `prep.confidence` and keep the points generic rather than confidently wrong. The dashboard surfaces low-confidence prep with a caveat.

## Inputs

- Loop 7 checkpoint and `runs/<ts>/annotated.jsonl` (final ranked list with trends)
- `interview_questions_knowledge/evidence/<question_id>.jsonl` for each final-list question
- Existing `questions/<category>/<question_id>.json` (warm/delta: prior `prep` may already exist)
- `policies/categories.json` — to pick the right prep style per category `kind`
- Search budget for this loop (default 0 — grounded synthesis uses cached evidence; see policy)

## Scope (which questions get prep)

- **cold/warm:** every question on the final list (all categories).
- **delta:** only questions where `prep` is missing OR `prep.generated_in_cycle` is more than 4 cycles old OR the question's `freq`/`title` changed materially since `prep` was generated. Skip the rest — prep is stable and re-using it costs nothing.

## Per-category prep style

The shape of `prep.approach` and `prep.key_points` depends on the category `kind` (from `policies/categories.json`):

| kind | `approach` should cover | `key_points` should be |
|------|-------------------------|------------------------|
| `coding` | Optimal technique + time/space complexity (e.g. "Hash map, one pass, O(n)/O(n)"). Mention the brute-force baseline only to contrast. | The core insight, the data structure, edge cases to call out, the complexity. |
| `system-design` | The 3-6 must-mention components, the data flow, and the 1-2 defining tradeoffs (e.g. consistency vs availability, push vs pull). | Functional + non-functional requirements to clarify, the key components, the bottleneck, the scaling lever. |
| `behavioral` | Which STAR angle to use and which company value/principle it maps to (reuse `behavioral_signals.framework_alignment` if present). | The Situation/Task/Action/Result beats to hit, the "what I learned" close, the value being signaled. |
| `conceptual` | A 2-4 sentence model answer stating the core claim crisply. | The definition, the key distinction (e.g. L1 vs L2), the "when does it matter" hook. |
| any new kind | Adapt the closest of the above. | 3-6 crux bullets. |

## Algorithm

For each in-scope question:

```
1. Read up to ~8 highest-confidence evidence quotes (prefer Tier 1/2, prefer recent).
2. Pick prep style from category kind.
3. Draft:
   - key_points: 3-6 bullets (the crux; what a strong answer MUST contain).
   - approach: one short paragraph per the table above.
   - common_mistakes: 1-4 traps (pull from evidence where interviewers note them; else well-known traps).
   - followups: up to 5 (only those that are standard for this question OR appear in evidence).
4. Set prep.confidence:
   - 0.9+ if grounded in multiple Tier 1/2 quotes AND well-established domain knowledge.
   - 0.7-0.9 if standard domain knowledge but sparse question-specific evidence.
   - <0.7 if the question is novel/emerging and points are inferred — keep points generic.
5. Set prep.generated_in_cycle = current cycle.
6. Stage the prep object on the in-memory question record (Loop 8 persists it).
```

## Length & quality guardrails

- `key_points`: max 6, each ≤ ~140 chars. If you can't say it in a phrase, it's not a key point.
- `approach`: 1 short paragraph (≤ ~60 words). It is a reminder, not a tutorial.
- No fabricated company names, dates, or numbers. No full code blocks. No multi-paragraph essays.
- Behavioral prep must be a *template* ("a time you owned an outage end-to-end"), never a fake personal story.

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_9.json`:

```json
{
  "cycle": 7,
  "loop": 9,
  "phase": "answer_synthesis",
  "completed_at": "<iso>",
  "state": {
    "questions_in_scope": 135,
    "prep_generated": 135,
    "prep_reused": 0,
    "avg_prep_confidence": 0.88,
    "low_confidence_count": 6,
    "prepped_path": "runs/<ts>/prepped.jsonl"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

`runs/<ts>/prepped.jsonl` is the final list with `prep` populated — it becomes Loop 8's input (replaces `annotated.jsonl` as the assembly source).

## Outputs to knowledge base

- None directly. Loop 8 persists `prep` onto each `questions/<category>/<question_id>.json`.

## Invariants for downstream loops

- Every question on the final list has a `prep` object (possibly with empty arrays + low confidence, never null).
- `prep.key_points` length ≤ 6; `prep.approach` is a non-empty string for confidence ≥ 0.7.
- No `prep` field contains fabricated company-specific claims.

## Failure handling

- **No evidence quotes available for a question** (rare on the final list): generate prep from domain knowledge only, set `prep.confidence ≤ 0.7`, log in `errors`.
- **Search budget > 0 configured and exhausted**: stop generating *new* searches; finish synthesis from cache. Prep never blocks the run.
- **Synthesis ambiguous / question is genuinely novel**: emit `key_points` that are generic-but-correct, set low confidence; do NOT guess specifics.
