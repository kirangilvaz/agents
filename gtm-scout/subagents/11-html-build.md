# Sub-agent: Loop 11 — HTML Build (Fill Template Placeholders ONLY)

**Phase:** `html_build` · **Loop ID:** 11 · **Always runs last.**

## Purpose

Render the report by filling placeholders in the canonical template. This subagent is the reason the report generates reliably: it **NEVER hand-writes HTML, CSS, or JS** — it only substitutes tokens in [`templates/gtm_report_template.html`](../templates/gtm_report_template.html), which renders every section client-side from one embedded `DATA` object.

**Output is the SAME file every run for a brief, overwritten in place:** `output/gtm-scout-<brief_id>.html`. There are NO per-run report folders.

## Inputs

- `runs/<brief_id>/<T>/report_data.json` (assembled by Loop 10).
- Loop 10 metrics + diff.
- [`templates/gtm_report_template.html`](../templates/gtm_report_template.html) (canonical; read verbatim).

## Step 1: Validate the leaderboard (last line of defense)

For every opportunity verify it has: `opportunity_id`, `name`, `type`, `description`, numeric `opportunity_score` (0–100), `tier` matching the band, all 6 `scores` (each 0–100), `conviction`, `effort`, `expected_roi`, `convergence_count`, `lifecycle_state`, `why_it_fits`, `evidence` (≥1), `risks` (≥1), `adversarial`, and a unique `rank`. Verify the GTM-plan sections exist (`executive_summary`, `budget_allocation`, `outreach_strategy`, `content_strategy`, `gtm_plan`).

Also verify the **anti-hallucination contract**: any `audience.size` with `size_verified:false` must render as `Unverified` (never a bare number presented as fact), and `access.contact` must be empty unless `contact_verified:true`.

If ANY opportunity or required section fails validation, **abort** — write nothing — and report exactly which field failed. A broken card or a fabricated number must never reach the page.

## Step 2: Build the DATA object

```javascript
const DATA = {
  metadata: {
    generated_at_display: "Sunday, May 31, 2026 · 5:00 PM PT",
    brief_id: "ai-stock-signals",
    cycle: 3,
    run_mode: "warm",
    leaderboard_size: 44,
    sources_consulted: 26,
    evidence_records: 1077,
    passes_completed: 4,
    converged: true,
    data_availability: "FULL",
    avg_score: 78,
    priority_count: 3,
    strong_count: 14,
    verified_pct: 73,                  // % of leaderboard with a verified core reach number
    changelog: [ /* diff.json entries summarized {change_type, name, detail} */ ]
  },
  brief: {
    product_name: "AI Stock Signals",
    product_description: "AI-powered stock-market signal platform for retail investors.",
    icp_summary: "US retail traders & investors, 25-45, active on Reddit/YouTube finance.",
    budget_display: "$2,000 / month",
    objective_display: "Acquire first 100 paying customers"
  },
  // channel_type_meta drives the filter tabs. One entry per type present in opportunities[].
  // Use the live registry from gtm_plan.json:channel_types (seeds + discovered).
  channel_type_meta: [
    { id: 'INFLUENCER', icon: '📣', label: 'Influencers' },
    { id: 'COMMUNITY', icon: '👥', label: 'Communities' }
    /* ...all types present... */
  ],
  // The mission's required output sections (rendered as panels):
  plan: {
    executive_summary: "string (1-2 paragraphs)",
    headline_recommendation: "string",
    top_moves: ["string", "string", "string"],
    budget_allocation: [
      { channel: "Micro-influencers", amount_usd: 900, pct: 45, detail: "3 creators @ ~$300 verified rate", opportunity_ids: ["inf-..."], cost_verified: true }
      /* ... */
    ],
    budget_total_usd: 2000,
    budget_period: "monthly",
    outreach_strategy: [
      { step: 1, target_type: "COMMUNITY", action: "Post a value-first AMA in r/...", angle: "...", opportunity_ids: ["comm-..."], effort: "EFFORT_LOW" }
      /* ... */
    ],
    content_strategy: [
      { channel: "YouTube influencers", theme: "...", formats: ["sponsored explainer","integration"], rationale: "ties to ICP pain '...'." }
      /* ... */
    ],
    gtm_plan: {
      immediate:  [ { action: "string", opportunity_ids: ["..."], conviction: "HIGH", est_cost_usd: 0 } ],
      short_term: [ { action: "string", opportunity_ids: ["..."], conviction: "MEDIUM", est_cost_usd: 500 } ],
      mid_term:   [ { action: "string", opportunity_ids: ["..."], conviction: "MEDIUM" } ],
      long_term:  [ { action: "string", opportunity_ids: ["..."], conviction: "LOW" } ]
    }
  },
  // opportunities sorted by opportunity_score descending; each conforms to the Card Data Schema below.
  opportunities: [ /* ...the full leaderboard... */ ]
};
```

The template falls back to a built-in default `channel_type_meta` if omitted, but always include it (so discovered types render). Every `type` used in `opportunities[]` SHOULD have a matching `channel_type_meta` entry.

### Card Data Schema (each entry in `opportunities[]`)

```javascript
{
  rank: 1,
  opportunity_id: 'inf-the-plain-bagel',
  name: 'The Plain Bagel',
  type: 'INFLUENCER',
  platform: 'youtube',
  url: 'https://youtube.com/@ThePlainBagel',
  description: 'Finance-education YouTube channel popular with retail investors.',
  opportunity_score: 88,
  core_score: 84,
  tier: 'STRONG',                        // PRIORITY | STRONG | QUALIFIED
  scores: {
    relevance: 92, audience_match: 89, reach: 80, growth_signals: 74, ease_of_access: 78, cost_efficiency: 70,
    relevance_rationale: 'Audience is exactly retail investors; covered competitor X in 2025.',
    audience_match_rationale: 'US-skewed, 25-45, investing intent — matches ICP.',
    reach_rationale: '1.1M subscribers (verified via channel page).',
    growth_signals_rationale: '+8% subs trailing 6mo (Social Blade, estimated).',
    ease_of_access_rationale: 'Business email published; runs sponsorships.',
    cost_efficiency_rationale: '~$3-5k/integration (media kit) — above per-creator budget; partial fit.'
  },
  conviction: 'HIGH',                    // HIGH | MEDIUM | LOW
  convergence_count: 6,
  amplifiers_fired: ['promoted_competitor_or_peer','sponsorship_or_guest_available','published_reachable_contact','explicit_icp_geo_match','multiple_reach_confirmations','promotion_allowed_or_partner_program'],
  suppressors_fired: [],
  effort: 'EFFORT_MED',
  expected_roi: 'MEDIUM',
  est_cost_usd: '3000-5000',
  est_cost_verified: true,
  audience: { size: 1100000, size_unit: 'subscribers', size_verified: true, influencer_tier: 'TIER_2', engagement_note: '~120k avg views', icp_overlap_note: 'high', geo_note: 'US-skewed' },
  access: { contact: 'business@...', contact_verified: true, accepts_sponsors: 'yes', accepts_guests: 'unknown', promotion_allowed: 'yes', partner_program_url: null, rate_card_note: '$3-5k/integration (media kit)' },
  why_it_fits: 'Directly reaches the ICP with trusted finance education; already promotes category peers.',
  outreach_angle: 'Offer a data-backed "AI vs human stock picks" segment with a tracked affiliate code. (suggested)',
  evidence: [
    { kind: 'profile', label: 'YouTube channel — 1.1M subscribers', url: 'https://...', source_tier: 2, date: '2026-05-20' },
    { kind: 'sponsorship', label: 'Media kit — integration rates', url: 'https://...', source_tier: 5 },
    { kind: 'promotion_history', label: 'Sponsored video for competitor X (2025)', url: 'https://...', source_tier: 2 }
  ],
  risks: [
    { risk: 'Integration cost exceeds per-creator budget; negotiate or use affiliate-only.', severity: 'MEDIUM' },
    { risk: 'Growth figure is a third-party estimate.', severity: 'LOW', is_counter_evidence: true }
  ],
  adversarial: { passes: 3, latest_verdict: 'CONFIRMED', notes: 'Audience real + on-ICP; only risk is cost.' },
  lifecycle_state: 'rising',
  outreach_status: 'none',
  score_trend: [80, 85, 88],
  independent_source_count: 4,
  data_availability: 'FULL',
  updated: 'May 31, 2026 · cycle 3'
}
```

## Step 3: Render the HTML

1. Read [`templates/gtm_report_template.html`](../templates/gtm_report_template.html) **verbatim**.
2. Replace these placeholders (and NOTHING else):

| Placeholder | Source |
|-------------|--------|
| `__GTM_DATA__` | `JSON.stringify(DATA)` |
| `__PRODUCT_NAME__` | `brief.product_name` |
| `__GENERATED_AT__` | `metadata.generated_at_display` |
| `__CYCLE__` | `metadata.cycle` |
| `__RUN_MODE__` | `metadata.run_mode` |
| `__CONVERGED__` | `"CONVERGED"` if `metadata.converged` else `"IN PROGRESS"` |
| `__PASS_BADGE_CLASS__` | `"badge-pass"` if converged else `"badge-progress"` |
| `__PASSES__` | `metadata.passes_completed` |

3. **Do NOT alter** the template's CSS, JS, or HTML structure. If a feature needs a template change, edit [`templates/gtm_report_template.html`](../templates/gtm_report_template.html) directly — never inline-render markup here.

## Step 4: Write the output (in place)

1. Create `output/` if missing.
2. Write the rendered HTML to **`output/gtm-scout-<brief_id>.html`**, overwriting in place. This is the canonical, stable link the user opens for that product.
3. **Only if** `archive=true`: also copy to `output/archive/gtm-scout-<brief_id>-<T>.html`.

## Output checkpoint

Write to `runs/<brief_id>/<T>/checkpoints/cycle_{N}_loop_11.json`:

```json
{
  "cycle": 3,
  "loop": 11,
  "phase": "html_build",
  "completed_at": "<iso>",
  "state": {
    "report_path": "output/gtm-scout-ai-stock-signals.html",
    "cards_rendered": 44,
    "plan_sections_rendered": 5,
    "archive_written": false,
    "placeholders_remaining": 0
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Invariants

- The page renders without JavaScript errors when opened in a browser.
- `__GTM_DATA__` is replaced with valid JSON (the template is sensitive to malformed embedded JSON).
- The number of cards rendered equals `metadata.leaderboard_size`.
- No placeholder tokens remain in the output file.
- The file is overwritten in place — no new per-run report files (unless `archive=true`).
- No `Unverified` number is rendered as a fact; no invented contact appears.

## Failure handling

- **Template missing:** abort with a clear error pointing to `templates/gtm_report_template.html`. The template is canonical and must exist.
- **`__GTM_DATA__` substitution produces invalid JSON:** abort, surface the error; do not write a half-broken page.
- **Validation failure (Step 1):** abort before writing; report which opportunity/field/section failed.
