# Sub-agent: Loop 6 — Signal Collection (Phase 8) + Channel-Type Discovery

**Phase:** `signal_collection` · **Loop ID:** 6 · **Runs in cold/warm only.**

## Purpose

Run the dedicated **growth & buying-signal** pass (mission Phase 8) that times opportunities — fast-growing companies, new marketing budgets, expansion, fundraising, product launches, community activity spikes — and gate the addition of any **new product-specific channel type**. These signals raise the `growth_signals` dimension and fire the `recent_funding_or_launch` / `audience_growth_trend` amplifiers; they also rank LEAD opportunities by *timing*, not just fit.

## Inputs

- `runs/<brief_id>/<T>/enriched_set.json` (Loop 5); `icp.json`; `competitors.json`.
- [`policies/source_ttl.json`](../policies/source_ttl.json) (Tier 6 growth-signal sources) and [`policies/channels.json`](../policies/channels.json):`dynamic_discovery`.
- Search budget: **`loop_6`** (default 120).

## Step 1: Collect growth & buying signals

For each opportunity (prioritize LEADs, PARTNERSHIPs, and any candidate near the floor), look for evidence from Tier 6 sources:

| Signal | Where | Raises |
|--------|-------|--------|
| **Fundraising** | TechCrunch / Crunchbase snippets | New marketing budget → warmer partner/lead; fires `recent_funding_or_launch` |
| **New marketing budget / GTM hire** | LinkedIn jobs / careers page (`growth`, `marketing`, `demand gen` roles) | A GTM motion is forming → timing |
| **Product launch** | Product Hunt / company blog | Fresh attention / expansion |
| **Expansion** | News: new market, new segment, new geo | Lead timing |
| **Audience growth trend** | Social Blade / subscriber deltas captured in Loop 5 | `audience_growth_trend` amplifier |
| **Community activity spike** | trending posts in discovered communities | Where the ICP is concentrating *now* |

Write evidence records (`signal_class: "growth_signal"`) with a verbatim quote, `report_date`, and a structured `data_point` (with `prior_value` for growth). **A signal must be recent (within `Y`/`Y−1`) to count toward `growth_signals`** — tag `data_age_days`.

## Step 2: Score-relevant flags

For each opportunity, set booleans the scoring/amplifier loops will read:
- `has_recent_funding_or_launch`
- `has_audience_growth_trend`
- `has_community_activity_spike`

Do NOT score here — Loops 7/8 do. Just attach the verified flags + evidence.

## Step 3: Channel-type discovery (gated)

If a coherent cluster of ≥ `min_cluster_size` (default 3) opportunities doesn't fit any existing `channel_type` and shares a clear, product-specific theme (e.g. `APP_STORE_ASO` for a mobile app, `BROKER_INTEGRATION` for an investing product, `CREATOR_AFFILIATE` for a creator-economy tool), **propose ONE new channel type** this cycle (per `policies/channels.json:dynamic_discovery`): `UPPER_SNAKE` id, human label, single emoji icon, a report section name. The cluster must have ≥2 independent sources. Stage the proposal for Loop 10 to persist into `gtm_plan.json:channel_types`.

## Output checkpoint

```json
{
  "cycle": 3,
  "loop": 6,
  "phase": "signal_collection",
  "completed_at": "<iso>",
  "state": {
    "signal_set_path": "runs/ai-stock-signals/<T>/signal_set.json",
    "opportunities_with_growth_signal": 47,
    "signals_by_kind": { "funding": 9, "gtm_hire": 6, "launch": 14, "expansion": 5, "audience_growth": 22, "community_spike": 7 },
    "evidence_records_added": 73,
    "proposed_channel_type": { "id": "BROKER_INTEGRATION", "label": "Broker Integrations", "icon": "🔌", "section": "Channel List", "cluster_size": 4 }
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 118
}
```

## Outputs to memory

- `evidence/<id>.jsonl` — growth-signal evidence appended.
- `runs/<brief_id>/<T>/signal_set.json` — enriched set + growth-signal flags (consumed by Loop 7).
- Proposed channel type staged for Loop 10.

## Invariants

- Every opportunity carries verified growth-signal flags (or none, explicitly) with evidence.
- Growth signals counted toward scoring are recent (within `Y`/`Y−1`); older ones are evidence-only.
- At most ONE new channel type proposed; it has a cluster ≥ min size and ≥2 independent sources.

## Failure handling

- **No buying signal for an opportunity:** that's fine and common — `growth_signals` simply scores low; do not invent a signal.
- **Funding/news behind paywall:** use the headline + snippet, mark `unverified`/`estimated`; do not fabricate amounts or dates.
- **Budget exhausted:** finalize with signals gathered; un-scanned opportunities just won't get the growth amplifier this cycle.
