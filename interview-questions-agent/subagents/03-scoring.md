# Sub-agent: Loop 3 — Scoring & Ranking

**Phase:** `scoring` · **Loop ID:** 3 · **Skipped in delta mode.**

## Purpose

Assign each eligible question a **Frequency Score (0–100)**, **Conviction Level**, and **Tier** using the persisted `source_reliability` weights from prior cycles. Behavioral questions use an alternate scoring matrix.

## Inputs

- Loop 2 checkpoint and `per_question_metrics.json`
- `interview_questions_knowledge/source_reliability.json` — per-source `weight_multiplier`
- Loop 0's `Y` and `recency_window`

## Frequency Score formula (Coding, System Design, AI/ML Conceptual)

### Staleness penalty (applied first)

If **no** Tier 1 or Tier 2 evidence for the question has `report_year` in the rolling window `[Y-2, Y-1, Y]`, the **Recency** signal is **capped at 5 points** regardless of how strong older historical reports are. This prevents stale ghosts from outranking questions with fresh but sparser evidence.

### Signal weights

| Signal | Weight | Scoring |
|--------|--------|---------|
| Multi-company appearance | 30% | 1–2 companies = 10 pts · 3–5 = 20 pts · 5–10 = 25 pts · 10+ = 30 pts |
| Recency (rolling 3-year window) | 20% | newest Tier 1/2 in **Y** = 20 · **Y−1** = 15 · **Y−2** = 10 · none = **5 (staleness cap)** |
| Source count | 25% | `independent_source_count` 1 = 5 · 2 = 10 · 3–4 = 18 · 5+ = 25 |
| Community consensus | 15% | `none` = 0 · `discussed` = 8 · `heavily_discussed` = 15 |
| Persistence (multi-year) | 10% | 1 year = 3 · 2–3 years = 7 · 5+ years = 10 |

### Source reliability multiplier

Compute the raw score above. Then apply a per-question reliability adjustment:

```
reliability_factor = clamp(
  weighted_avg(source_reliability[evidence.source_domain].weight_multiplier
               for evidence in question.evidence,
               weight = 1.0 / source_tier),
  0.85,
  1.15
)

final_freq = clamp(round(raw_freq * reliability_factor), 0, 100)
```

Sources with low precision drag the score down (max 15% reduction); sources with high precision boost it (max 15% increase). The clamp keeps scoring stable across cycles.

## Behavioral scoring matrix (any category with `scoring: "behavioral"`)

> Applies to `swe-behavioral` and to any category the registry ([`policies/categories.json`](../policies/categories.json)) marks with `scoring: "behavioral"` (e.g. a discovered soft-skill category). All other categories use the standard Frequency Score formula above.

Frequency-of-question-text is a poor signal for behavioral because the same archetype is asked everywhere with different phrasings. Use this alternate matrix:

| Signal | Weight | Scoring |
|--------|--------|---------|
| Framework alignment | 35% | Per-archetype mapping to company frameworks. Score = max alignment across covered frameworks (Amazon LP, Meta values, Google Googliness, Microsoft growth-mindset, Stripe operating principles). 1.0 alignment = 35 pts. |
| Answer-archetype frequency | 30% | How often the underlying STAR archetype is requested across all companies (sum of distinct evidence pointing at this archetype, regardless of question phrasing). 1+ company = 10 · 3–5 = 20 · 6+ = 30 |
| Company-specific phrasing diversity | 15% | Number of distinct companies with verbatim phrasings in evidence. 1 = 3 · 2–3 = 8 · 4+ = 15 |
| Recency (same window as standard) | 10% | Y = 10 · Y−1 = 7 · Y−2 = 5 · none = 2 |
| Source count | 10% | `independent_source_count` 1 = 2 · 2 = 5 · 3–4 = 8 · 5+ = 10 |

Then apply the **same** `reliability_factor` adjustment.

The behavioral scorer ALSO populates `question.behavioral_signals` (see [`schemas/question.schema.json`](../schemas/question.schema.json)) with framework alignment scores and the canonical archetype, so Loop 8 can render them in the modal.

## Conviction Levels

| Level | Criteria |
|-------|----------|
| ★★★★★ | freq ≥ 85 AND `independent_source_count` ≥ 5 AND `company_count` ≥ 10 AND `persistence_years` ≥ 2 |
| ★★★★ | freq 75–84 AND `independent_source_count` ≥ 3 AND `company_count` ≥ 5 |
| ★★★ | freq 60–74 AND `independent_source_count` ≥ 2 |
| ★★ | freq 45–59 AND emerging signals only (Tier 4 dominant) |

## Frequency Tiers

| Tier | Score | Meaning |
|------|-------|---------|
| CRITICAL | 90–100 | Asked by nearly every major company, every cycle |
| HIGH | 75–89 | Asked frequently across multiple companies |
| MODERATE | 60–74 | Asked regularly but not universally |
| EMERGING | 45–59 | Growing in frequency, worth tracking |

Questions scoring < 45 are dropped from candidates (kept in `emerging.json` for next cycle if they have any Tier 1/2 source).

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_3.json`:

```json
{
  "cycle": 7,
  "loop": 3,
  "phase": "scoring",
  "completed_at": "<iso>",
  "state": {
    "questions_scored": 412,
    "ranked_path": "runs/<ts>/ranked.jsonl",
    "tier_counts": {"CRITICAL": 41, "HIGH": 138, "MODERATE": 167, "EMERGING": 66},
    "avg_conviction": 4.2,
    "avg_reliability_factor": 1.03,
    "staleness_capped_count": 18
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

`runs/<ts>/ranked.jsonl` contains every question with computed `freq`, `tier`, `conviction`, and the score component breakdown for Loop 4 to inspect.

## Outputs to knowledge base

- None directly. `score_history` is appended in Loop 8 once the cycle is final.

## Invariants for downstream loops

- Every question in `ranked.jsonl` has `freq ∈ [0, 100]`, a tier, and a conviction.
- Sum of category counts ≥ category quotas (otherwise Loop 5 will flag a quota gap).
- The score breakdown per question is stored so Loop 4 can challenge individual signals.

## Failure handling

- **Missing source_reliability entry for a domain**: use neutral prior `weight_multiplier = 1.0`, log to `errors`.
- **All evidence for a question is single-tier**: still score, but cap conviction at ★★★ regardless of frequency.
- **Behavioral question with no archetype assigned by Loop 1b**: default to `framework_alignment = 0.5` across all frameworks and emit a warning; surface in `errors` for the user to refine archetype taxonomy.
