# Sub-agent: Loop 5 — Adversarial Challenge + Domain Discovery (CORE ALPHA)

**Phase:** `adversarial` · **Loop ID:** 5 · **Runs in cold/warm; in delta only if a rescore crosses a tier/lifecycle boundary.**

## Purpose

This is the agent's most important loop. For every opportunity heading for the leaderboard, **try to disprove the thesis.** Separating real disruptive signal from hype is where the conviction framework earns its keep. Loop 5 also proposes new domains when a coherent uncategorized cluster appears.

## Inputs

- `runs/<T>/scored_set.json` + all `evidence/<id>.jsonl`.
- `source_reliability.json`, [`policies/weights.json`](../policies/weights.json) (suppressor flags), [`policies/domains.json`](../policies/domains.json) (discovery rules).
- Search budget: **`loop_5`** (default 200) — for counter-evidence searches.

## Step 1: Challenge each leaderboard candidate

For every opportunity with `core_composite >= conviction_floor` (and any with `single_signal_dominant`), ask:

1. **What is the strongest opposing case?** Search explicitly for counter-evidence: failed reproductions, skeptical expert commentary, competitors who already do this better, retracted/contested claims, regulatory blockers, "<company> shutdown/layoffs/lawsuit". Find ≥1 piece of counter-evidence per high-conviction call.
2. **Hype vs substance.** Is attention (press, social) outpacing technical evidence? Is there a real prototype / demonstrated result, or just a vision deck? Flag any of the `policies/weights.json:suppressors.flags` that apply: `hype_exceeds_evidence`, `marketing_exceeds_progress`, `funding_stagnant`, `no_customer_adoption`, `no_prototype`, `not_reproducible`, `attention_spike_no_substance`.
3. **Is the signal noise or real?** Recompute `independent_source_count` after removing the single most-cited source — does conviction survive?
4. **Is the dominant dimension justified?** For `single_signal_dominant` opportunities, stress-test that one dimension hard.
5. **Reproducibility / verification.** For science-driven opportunities, has anyone independently reproduced or verified the result? Unreproduced ≠ disqualifying, but it caps Feasibility.
6. **Disambiguation.** Resolve any `needs_disambiguation:true` flags from Loop 2 (merge or keep-separate with evidence).

## Step 2: Record counter-evidence

Write counter-evidence as evidence records with `is_counter_evidence: true` (so it shows in `risks` but does NOT inflate independent-source counts). Add a `risks[]` entry for each material failure mode with a `severity`.

## Step 3: Assign a verdict per opportunity

Record in `iteration_log/<id>.jsonl`:

| Verdict | Action |
|---------|--------|
| `CONFIRMED` | Thesis survives challenge; `adversarial.passes += 1` |
| `WEAKENED` | One dimension conflicts; flag the suppressor(s) for Loop 6; note in `risks` |
| `MULTI_CONFLICT` | Multiple dimensions conflict; Loop 6 should apply a larger suppression; tier likely downgraded |
| `INVALIDATED` | Core claim is false / discredited / vaporware → route to watchlist with reason; cannot stay on leaderboard this cycle |

Update `source_reliability` deltas in scratch: sources that backed an INVALIDATED opportunity get `candidates_invalidated += 1`; sources backing CONFIRMED get `candidates_confirmed += 1`. (Loop 8 persists.)

## Step 4: Domain discovery (gated)

If a coherent cluster of ≥ `min_cluster_size` (default 3) opportunities sits in `FRONTIER` and shares a clear theme not covered by an existing domain, **propose ONE new domain** this cycle (per `policies/domains.json:dynamic_discovery`): pick an `UPPER_SNAKE` id, a human label, one emoji icon. The cluster must have survived adversarial review and have ≥3 independent sources. Stage the proposal for Loop 8 to persist into `domains.json`.

## Output checkpoint

```json
{
  "cycle": 7,
  "loop": 5,
  "phase": "adversarial",
  "completed_at": "<iso>",
  "state": {
    "challenged": 71,
    "verdicts": { "CONFIRMED": 49, "WEAKENED": 14, "MULTI_CONFLICT": 5, "INVALIDATED": 3 },
    "counter_evidence_added": 88,
    "suppressor_flags_raised": { "hype_exceeds_evidence": 9, "no_prototype": 6, "funding_stagnant": 4 },
    "invalidated_ids": ["quantum-supreme-ai", "roomtemp-superconductor-xyz", "metaverse-os"],
    "proposed_domain": { "id": "SYNTHETIC_BIO_FOUNDRY", "label": "Bio Foundries", "icon": "🧫", "cluster_size": 4 },
    "source_reliability_deltas_path": "runs/<T>/source_reliability_deltas.json"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 196
}
```

## Outputs to memory

- `evidence/<id>.jsonl` — counter-evidence appended.
- `iteration_log/<id>.jsonl` — verdicts appended.
- `runs/<T>/source_reliability_deltas.json` — staged for Loop 8.
- `runs/<T>/challenged_set.json` — scored set + verdicts + suppressor flags (consumed by Loop 6).

## Invariants

- Every leaderboard candidate has ≥1 adversarial pass this cycle; high-conviction calls have ≥1 counter-evidence search.
- INVALIDATED opportunities never appear on the leaderboard this cycle.
- At most ONE new domain proposed.

## Failure handling

- **Counter-evidence inconclusive:** record what was checked and that nothing disqualifying was found (this strengthens CONFIRMED). Do not invent counter-evidence.
- **Budget exhausted before all challenged:** challenge the highest-conviction candidates first; mark the remainder `adversarial.passes` unchanged and let Loop 7 finish them on the next pass.
