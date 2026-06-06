# Sub-agent: Loop 7 — Trend Detection & Future-Proofing

**Phase:** `trends` · **Loop ID:** 7 · **Runs in all modes (cold/warm/delta).**

## Purpose

Identify questions gaining or losing frequency, detect emerging topics, and surface company interview-format changes. This is what keeps the agent's recommendations from going stale.

## Inputs

- Loop 6 checkpoint and `enriched.jsonl`
- Per-question `score_history` from prior cycles (in-memory from Loop 0)
- `emerging.json` baseline
- Search budget for this loop (default 100)

## Step 1: Trend computation from history

For each question, compare current cycle's `freq` to the average of the prior 3 cycles:

| Δ vs 3-cycle average | Trend |
|----------------------|-------|
| `+10` or more, AND `independent_source_count` not regressing | `▲ RISING` |
| `-10` or more | `▼ DECLINING` |
| Otherwise | `""` (no trend) |

Cycle 1 / 2 / 3 of the agent's life: no trend can be computed (insufficient history). Leave blank.

## Step 2: Targeted trend searches

Run these searches (counts toward the 100 budget):

```
new interview questions [Y] emerging trends software engineering
interview questions rising frequency [Y] AI ML
agentic AI interview questions [Y]
LLM evaluation interview questions [Y]
multi-agent system design interview [Y]
[COMPANY] changed interview process [Y]    (for top 10 companies)
```

Any new candidate questions surfaced here go to `emerging.json` (NOT into the main list this cycle — they need provenance + adversarial passes first).

## Step 3: Emerging-topic detection

Scan recent (Y, Y−1) Tier 1/2 evidence for **concept tags** that are over-represented vs prior cycles:

```
for each concept_tag:
    recent_freq = count of evidence in [Y-1, Y] containing this tag
    historical_freq = count of evidence before Y-1 containing this tag
    if recent_freq / max(historical_freq, 1) >= 3.0 and recent_freq >= 5:
        flag as emerging concept
```

Examples to watch (cycle-relative; do not hardcode):

- LLM evaluation frameworks
- RAG / retrieval augmentation pipelines
- Agentic AI / multi-agent orchestration
- AI-assisted coding rounds
- LLM serving (KV cache, speculative decoding)
- Model evaluation harnesses

## Step 4: Company format change detection

For each top-25 company, check for evidence of interview-process changes:

```
[COMPANY] interview format change [Y]
[COMPANY] new interview round [Y]
[COMPANY] AI-assisted coding round [Y]
[COMPANY] take-home replaced [Y]
```

If detected, add a structured note in `runs/<ts>/diff.json`:

```json
{
  "type": "FLAGGED",
  "category": "process_change",
  "question_id": null,
  "rationale": "Meta added an AI-assisted coding round in [Y], replacing the second algorithmic round. 5 evidence records confirm.",
  "evidence_ids": ["..."]
}
```

These go straight to the dashboard's changelog so users see process changes prominently.

## Step 5: Cross-trend annotation

Mark each question with up to one trend annotation. Persist `trend` on the question record. Loop 8 renders these as the ▲ / ▼ badges in the dashboard.

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_7.json`:

```json
{
  "cycle": 7,
  "loop": 7,
  "phase": "trends",
  "completed_at": "<iso>",
  "state": {
    "rising_count": 14,
    "declining_count": 6,
    "no_trend_count": 115,
    "emerging_concepts": ["agentic-ai-orchestration", "llm-eval-frameworks"],
    "process_change_notes": [
      {"company": "meta", "change": "AI-assisted coding round added", "evidence_count": 5}
    ],
    "annotated_path": "runs/<ts>/annotated.jsonl"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 92
}
```

## Outputs to knowledge base

- `emerging.json` — updated with new emerging-concept candidates.
- New evidence records from trend searches.

## Invariants for downstream loops

- Every question in the final list has a `trend` value (possibly empty string).
- `emerging_concepts` is a subset of concepts that appear in evidence.
- `process_change_notes` map 1:1 to changelog entries Loop 8 will write.

## Failure handling

- **No prior history** (cycle 1–3): emit empty `rising_count` and `declining_count`. This is normal; do not error.
- **Search budget exhausted**: complete current company-format check, write checkpoint with `state.partial = true`, continue to Loop 8.
