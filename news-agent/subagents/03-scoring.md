# Sub-agent: Loop 3 — Popularity Scoring

**Phase:** `scoring` · **Loop ID:** 3 · Re-runs each pass until convergence.

## Purpose

Assign a **Popularity Score (0–100)** and conviction level to each cluster, then rank. Uses the weights in [POPULARITY SCORING SYSTEM](../AGENT.md#popularity-scoring-system).

## Inputs

- Loop 2 clusters (with `independent_count`, `position_best`, `partisan_only`).
- On re-passes: the prior pass's scored list and adversarial notes.

## Procedure

For EACH cluster, compute the five components and store them in `score_breakdown`:

1. **Coverage breadth (max 30).** From `independent_count`: 1-2 = 10, 3-5 = 20, 6-10 = 25, 10+ = 30.
2. **Editorial prominence (max 25).** Is it the #1 story on AP, Reuters, NYT, BBC, CNN, or Google News? Buried = 5, Featured = 15, Lead/Headline = 25.
3. **Social engagement (max 20).** Search `"[STORY TOPIC]" site:reddit.com` and `"[STORY TOPIC]" trending`. No signal = 0, Discussed = 10, Trending = 15, Viral = 20.
4. **Consequentiality (max 15).** How many people are directly affected? Niche = 3, National = 10, Global = 15.
5. **Novelty (max 10).** Ongoing update = 3, Significant development = 7, Breaking new story = 10.

`score = coverage + prominence + social + consequentiality + novelty` (0–100).

**BREAKING boost:** stories tagged BREAKING get a ranking boost — if borderline, round the tier up one level.

### Assign tier from score

CRITICAL 90–100 · MAJOR 75–89 · NOTABLE 60–74 · NOTEWORTHY 45–59.

### Assign conviction from evidence quality

Per the [CONVICTION SYSTEM](../AGENT.md#conviction-system): ★★★★★ (10+ outlets + social + 3+ leads), ★★★★ (5-9 outlets, featured), ★★★ (3-4 outlets), ★★ (2 outlets only).

## Output

Scored, ranked list (by `score` descending). Each story carries `score`, `score_breakdown`, `tier`, `conviction`, and keeps its sources. Pass to Loop 4.

## Invariants

- `score` equals the sum of its five `score_breakdown` components (re-derivable; Loop 7 re-checks this).
- `tier` matches the score band; `conviction` matches the evidence.

## Failure handling

- If a social-signal search fails, record `social: 0` and note it — do not block scoring on one signal.
