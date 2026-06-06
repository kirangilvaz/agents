# Sub-agent: Loop 8 — Signal Amplifiers / Suppressors + Convergence Count

**Phase:** `signal_adjust` · **Loop ID:** 8 · **Always runs (cold/warm/delta).**

## Purpose

Apply the scoring framework's **Signal Amplifiers** (convergence boosts) and **Signal Suppressors** (vanity penalties) to turn each opportunity's `core_score` into a final `opportunity_score`, and record the `convergence_count` badge. This is a pure-computation loop driven by Loop 7's scores and Loop 9's verdicts/flags (on iteration passes ≥ 2).

## Inputs

- `runs/<brief_id>/<T>/scored_set.json` (Loop 7) — and, on passes ≥ 2, `challenged_set.json` (Loop 9 verdicts/flags).
- All `evidence/<id>.jsonl` (to detect which amplifier signal types fired) + Loop 6 growth-signal flags.
- [`policies/scoring.json`](../policies/scoring.json) — `amplifiers`, `suppressors`.
- Search budget: **0**.

## Step 1: Detect independent amplifier signals

For each opportunity, set a boolean for each of the 8 `amplifiers.signal_types` from the evidence:

| Signal type | Fires when |
|-------------|-----------|
| `sponsorship_or_guest_available` | A verified sponsorship rate card / "work with me" / guest-application page exists |
| `promoted_competitor_or_peer` | Verified evidence it has promoted a competitor or category peer before |
| `audience_growth_trend` | Verified positive audience growth (Loop 6 flag) |
| `recent_funding_or_launch` | Recent (within `Y`/`Y−1`) funding/launch buying signal (Loop 6 flag) |
| `multiple_reach_confirmations` | ≥2 independent verified reach confirmations |
| `published_reachable_contact` | A verified public contact exists (`contact_verified:true`) |
| `explicit_icp_geo_match` | Verified audience demographics/geo explicitly match the ICP |
| `promotion_allowed_or_partner_program` | Promotion allowed OR an active partner/affiliate program |

`convergence_count = number of signal types that fired` (0–8). Record which fired in `amplifiers_fired`. **Only count INDEPENDENT signals** — two articles about the same launch are ONE `recent_funding_or_launch`.

## Step 2: Compute amplifier adjustment

```
amplifier_adj = min( convergence_count * amplifiers.per_signal, amplifiers.max_amplifier )   # default per_signal 1.5, cap +8
```

## Step 3: Compute suppressor adjustment

From Loop 9's `suppressor_flags` for this opportunity (and any Loop 7 vanity flags):

```
suppressor_adj = max( count(flags) * suppressors.per_flag, suppressors.max_suppressor )   # default per_flag -2.5, cap -12
```

Apply extra suppression for adversarial verdicts: `WEAKENED` → at least −3; `MULTI_CONFLICT` → at least −8. (Take the more negative of flag-derived and verdict-derived.) Suppressor flags include: `suspected_fake_followers`, `dead_or_inactive_community`, `engagement_far_below_size`, `off_icp_audience`, `pay_to_play_placement`, `no_verifiable_reach`, `strict_no_promotion_no_path`, `cost_far_exceeds_budget`.

## Step 4: Final score

```
amplifier_adjustment = amplifier_adj + suppressor_adj          # net, can be + or -
opportunity_score    = clamp( core_score + amplifier_adjustment, 0, 100 )
```

Recompute `tier` from the adjusted `opportunity_score` (re-applying the Loop 7 caps: PARTIAL/unverified-reach/LOW-conviction cap at QUALIFIED). **A suppressed opportunity may drop below the floor → route to watchlist.** An amplified one may cross into a higher tier — but anti-churn (Loop 10 / AGENT.md STABILITY) still governs lifecycle flips.

## Step 5: Re-rank

Sort all above-floor opportunities by `opportunity_score` descending (primary). Also compute the ROI ordering and the quick-win (ease-of-access desc) ordering — the report toggles between them. Stamp a provisional `rank`.

## Output checkpoint

```json
{
  "cycle": 3,
  "loop": 8,
  "phase": "signal_adjust",
  "completed_at": "<iso>",
  "state": {
    "adjusted_set_path": "runs/ai-stock-signals/<T>/adjusted_set.json",
    "leaderboard_size": 47,
    "avg_amplifier_adj": 3.4,
    "avg_suppressor_adj": -1.9,
    "convergence_distribution": { "0-2": 18, "3-4": 19, "5-6": 8, "7-8": 2 },
    "promoted_to_higher_tier": 6,
    "suppressed_below_floor": 4
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs

- `runs/<brief_id>/<T>/adjusted_set.json` — final scored, adjusted, provisionally-ranked set (consumed by Loop 9/10).

## Invariants

- Every opportunity has `opportunity_score`, `convergence_count`, `amplifiers_fired`, `suppressors_fired`, and `amplifier_adjustment`.
- `amplifier_adjustment` is within `[max_suppressor, max_amplifier]` (default `[-12, +8]`).
- `opportunity_score` is consistent with `core_score + amplifier_adjustment` (clamped).

## Failure handling

- **Amplifier and suppressor both large:** legitimate (strong signals AND real risks) — net them honestly; surface both in the report.
- **Convergence_count high but all from one signal class:** that's NOT convergence — re-examine independence; do not award the boost.
