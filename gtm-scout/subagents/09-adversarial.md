# Sub-agent: Loop 9 — Adversarial Challenge (CORE ALPHA + Convergence Controller)

**Phase:** `adversarial` · **Loop ID:** 9 · **Runs in cold/warm; in delta only if a rescore crosses a tier/conviction boundary.**

## Purpose

This is the agent's most important loop and the enforcement point for the mission's anti-hallucination contract. For every opportunity heading for the leaderboard, **try to disprove it**: Is the audience real? Does it actually match the ICP? Is it genuinely reachable within budget? Separating a real acquisition channel from a vanity-metric mirage is where wasted marketing spend is avoided. Loop 9 also drives **convergence** by re-running the tight cycle Loops 7 → 8 until the leaderboard stabilizes.

## Inputs

- `runs/<brief_id>/<T>/adjusted_set.json` (Loop 8) + all `evidence/<id>.jsonl`.
- `icp.json`; `source_reliability.json`; [`policies/scoring.json`](../policies/scoring.json) (suppressor flags); [`policies/convergence.json`](../policies/convergence.json).
- Search budget: **`loop_9`** (default 180) — for counter-evidence searches, drawn across passes.

## Step 1: Challenge each leaderboard candidate

For every opportunity with `opportunity_score >= opportunity_floor` (and any with `single_signal_dominant`), ask:

1. **Is the audience real?** Search for fake/bought-follower signals (sudden follower spikes, bot-comment patterns, Social Blade anomalies, "engagement far below follower count"). Flag `suspected_fake_followers` / `engagement_far_below_size`. For communities: is it actually active, or a ghost town? Flag `dead_or_inactive_community`.
2. **Does it match the ICP?** Re-check the audience against `icp.json`. A 2M-follower creator whose audience is the wrong segment/geo is OFF-ICP. Flag `off_icp_audience`. (This is why Audience Match is 25% — a huge but wrong audience is worse than a small right one.)
3. **Is it genuinely reachable within budget?** Did the "contact" verify? Is the rate within the brief's budget, or does cost wildly exceed it? Flag `cost_far_exceeds_budget` / `strict_no_promotion_no_path`. Is a "top X" placement *earned* or pay-to-play? Flag `pay_to_play_placement`.
4. **Is the reach number real?** Recompute `independent_source_count` after removing the single most-cited source — does the score survive? Is the core reach `verified` or only `estimated`/`unverified`? Flag `no_verifiable_reach`.
5. **Is the dominant dimension justified?** For `single_signal_dominant` opportunities, stress-test that one dimension hard.
6. **Disambiguation.** Resolve any `needs_disambiguation:true` flags from Loop 4 (merge or keep-separate with evidence).

For high-conviction calls, run ≥1 explicit counter-evidence search. **Never invent counter-evidence; if nothing disqualifying is found, that strengthens CONFIRMED.**

## Step 2: Record counter-evidence

Write counter-evidence as evidence records with `is_counter_evidence: true` (shows in `risks`, does NOT inflate independent-source counts). Add a `risks[]` entry for each material issue with a `severity`.

## Step 3: Assign a verdict per opportunity

Record in `iteration_log/<id>.jsonl`:

| Verdict | Action |
|---------|--------|
| `CONFIRMED` | Survives challenge; `adversarial.passes += 1` |
| `WEAKENED` | One dimension/claim conflicts; flag the suppressor(s) for Loop 8; note in `risks` |
| `MULTI_CONFLICT` | Multiple conflicts; Loop 8 applies larger suppression; tier likely downgraded |
| `INVALIDATED` | Audience confirmed fake / community dead / contact bounced / pay-to-play vanity → route to watchlist; cannot stay on the leaderboard this cycle |

Update `source_reliability` deltas in scratch: sources backing INVALIDATED opportunities get `candidates_invalidated += 1`; sources backing CONFIRMED get `candidates_confirmed += 1`. (Loop 10 persists.)

## Step 4: Convergence control

This loop is also the iteration controller. After Loop 8 re-runs on each pass, evaluate [`policies/convergence.json`](../policies/convergence.json):

```
converged = (
  pass >= min_passes (default 3)
  AND leaderboard_swap_pct < max_swap_pct (default 0.10)
  AND |avg_score_delta vs prior pass| < max_score_delta (default 2)
  AND every leaderboard opportunity has adversarial.passes >= require_adversarial_passes (default 2)
  AND every leaderboard opportunity has independent_source_count >= min_sources (default 2)
  AND no opportunity has max_dim_share > max_single_signal_share (default 0.40)
)
```

```
pass = 1
loop:
  run Loops 7 -> 8 (rescore + readjust with this pass's flags/verdicts)
  evaluate converged
  if converged: stop (stopped_reason = "converged")
  if pass >= max_passes (default 8): stop ("max_passes_reached")
  if search_budget exhausted: stop ("budget_exhausted")
  if consecutive_no_change_passes >= 2: stop ("stable")
  pass += 1
```

Each pass targets the weakest spots: near a tier boundary, < `min_sources`, `single_signal_dominant`, non-CONFIRMED latest verdict. Well-settled high-conviction names need not be re-challenged every pass (but must have ≥2 lifetime adversarial passes).

## Output checkpoint

```json
{
  "cycle": 3,
  "loop": 9,
  "phase": "adversarial",
  "completed_at": "<iso>",
  "state": {
    "challenged": 49,
    "verdicts": { "CONFIRMED": 34, "WEAKENED": 9, "MULTI_CONFLICT": 3, "INVALIDATED": 3 },
    "counter_evidence_added": 41,
    "suppressor_flags_raised": { "off_icp_audience": 6, "suspected_fake_followers": 3, "no_verifiable_reach": 5, "cost_far_exceeds_budget": 4 },
    "invalidated_ids": ["inf-fake-stock-guru", "comm-dead-traders-lounge", "news-bought-list-weekly"],
    "passes_run": 4,
    "converged": true,
    "stopped_reason": "converged",
    "final_swap_pct": 0.04,
    "final_avg_score_delta": 1.3,
    "leaderboard_size": 44,
    "source_reliability_deltas_path": "runs/ai-stock-signals/<T>/source_reliability_deltas.json"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 174
}
```

## Outputs to memory

- `evidence/<id>.jsonl` — counter-evidence appended.
- `iteration_log/<id>.jsonl` — verdicts appended.
- `runs/<brief_id>/<T>/source_reliability_deltas.json` — staged for Loop 10.
- `runs/<brief_id>/<T>/final_set.json` — converged, ranked leaderboard (consumed by Loop 10).

## Invariants

- Every leaderboard candidate has ≥1 adversarial pass this cycle; high-conviction calls have ≥1 counter-evidence search.
- INVALIDATED opportunities never appear on the leaderboard this cycle.
- At convergence, every leaderboard opportunity satisfies the adversarial + source-count gates.

## Failure handling

- **Counter-evidence inconclusive:** record what was checked and that nothing disqualifying was found (strengthens CONFIRMED). Do not invent counter-evidence.
- **Never converges (oscillating):** check `source_reliability` for a noisy source dragging scores; stop at `max_passes` and ship with `stopped_reason = "max_passes_reached"`. Surface in metrics.
- **Budget exhausted before all challenged:** challenge the highest-score candidates first; mark the remainder `adversarial.passes` unchanged and ship the best-so-far leaderboard.
