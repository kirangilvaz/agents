# Sub-agent: Loop 9 — HTML Build (Fill Template Placeholders ONLY)

**Phase:** `html_build` · **Loop ID:** 9 · **Always runs last.**

## Purpose

Render the report by filling placeholders in the canonical template. This subagent is the reason the report generates reliably: it **NEVER hand-writes HTML, CSS, or JS** — it only substitutes tokens in [`templates/novelty_report_template.html`](../templates/novelty_report_template.html), which renders every card client-side from one embedded `DATA` object.

**Output is the SAME file every run, overwritten in place:** `output/novelty-explorer.html`. There are NO per-run report folders.

## Inputs

- `runs/<T>/report_data.json` (assembled by Loop 8).
- Loop 8 metrics + diff.
- [`templates/novelty_report_template.html`](../templates/novelty_report_template.html) (canonical; read verbatim).

## Step 1: Validate the leaderboard (last line of defense)

For every opportunity verify it has: `opportunity_id`, `name`, `description`, valid `domain`, numeric `composite_score` (0–100), `conviction_tier` matching the band, all 5 `scores` (each 0–100), `ttm`, `time_adjusted_score`, `convergence_count`, `crowding` + `crowding_label`, `lifecycle_state`, `conviction_trend` (array), `why_it_matters`, `investment_thesis`, `capital_signals`, `evidence` (≥1), `risks` (≥1), `adversarial`, and a unique `rank`.

If ANY opportunity fails validation, **abort** — write nothing — and report exactly which opportunity/field failed. A broken card must never reach the page.

## Step 2: Build the DATA object

```javascript
const DATA = {
  metadata: {
    generated_at_display: "Saturday, May 30, 2026 · 6:10 PM PT",
    cycle: 7,
    run_mode: "warm",
    leaderboard_size: 66,
    sources_consulted: 41,        // distinct source domains attempted in Loop 1
    evidence_records: 1149,
    passes_completed: 4,
    converged: true,
    data_availability: "FULL",
    avg_composite: 76,
    exceptional_count: 4,
    high_conviction_count: 18,
    changelog: [ /* diff.json entries, summarized {change_type, name, detail} */ ]
  },
  // domain_meta drives the filter tabs. One entry per domain present in opportunities[].
  // Use the live registry from novelty_explorer_memory/domains.json (seeds + discovered).
  domain_meta: [
    { id: 'AI_INFRA', icon: '🧠', label: 'AI & Infra' },
    { id: 'BIOTECH', icon: '🧬', label: 'Biotech' }
    /* ...all domains present... */
  ],
  // opportunities sorted by composite_score descending; each conforms to the Card Data Schema below.
  opportunities: [ /* ...the full leaderboard... */ ]
};
```

The template falls back to a built-in default `domain_meta` if omitted, but always include it (so discovered domains render). Every `domain` used in `opportunities[]` SHOULD have a matching `domain_meta` entry.

### Card Data Schema (each entry in `opportunities[]`)

```javascript
{
  rank: 1,
  opportunity_id: 'thermal-grid-batteries',
  name: 'Thermal Grid Batteries',
  type: 'company',                       // technology | company | trend | research_program | open_source_project
  domain: 'ENERGY',
  description: 'Long-duration energy storage using crushed-rock thermal batteries.',
  composite_score: 88,
  time_adjusted_score: 81,               // composite * ttm_discount
  conviction_tier: 'HIGH_CONVICTION',    // EXCEPTIONAL | HIGH_CONVICTION | WORTH_MONITORING | EMERGING_SIGNAL
  scores: { novelty: 86, capital: 90, momentum: 84, feasibility: 91, market: 89 },
  ttm: 'TTM_2_5',                        // TTM_0_2 | TTM_2_5 | TTM_5_10 | TTM_10_PLUS
  ttm_rationale: 'Pilot plants operating; commercial scale 2-4 years out.',
  convergence_count: 6,                  // 0..8 independent signals firing
  amplifiers_fired: ['major_funding_round','fortune500_pilot','growing_hiring','industry_partnership','rising_patent_filings','regulatory_progress'],
  suppressors_fired: [],
  crowding: 28,                          // 0..100
  crowding_label: 'UNDER_RECOGNIZED',    // UNDER_RECOGNIZED | BALANCED | CROWDED
  lifecycle_state: 'rising',
  conviction_trend: [71, 78, 84, 88],    // composite per cycle, newest last (sparkline)
  why_it_matters: 'Grid-scale long-duration storage is the missing piece for renewables...',
  investment_thesis: 'One paragraph on why this could become a significant opportunity...',
  capital_signals: {
    recent_rounds: [
      { stage: 'Series B', amount_usd_m: 70, date: '2026-03-10', lead_investors: ['Breakthrough Energy Ventures'], investor_quality_tier: 'tier_3_strategic', source_url: 'https://...' }
    ],
    strategic_partnerships: ['Utility X 100MWh pilot'],
    grants: ['ARPA-E $5M'],
    total_known_funding_usd_m: 140
  },
  evidence: [
    { kind: 'paper', label: 'Nature Energy 2026 — thermal storage efficiency', url: 'https://...', source_tier: 1, date: '2026-02-01' },
    { kind: 'patent', label: 'US Patent — rock-bed heat exchanger', url: 'https://...', source_tier: 5 },
    { kind: 'funding', label: 'TechCrunch — $70M Series B', url: 'https://...', source_tier: 3 }
  ],
  risks: [
    { risk: 'Round-trip efficiency contested by one independent lab', severity: 'MEDIUM', is_counter_evidence: true },
    { risk: 'Capex per MWh still above lithium at small scale', severity: 'MEDIUM' }
  ],
  adversarial: { passes: 3, latest_verdict: 'CONFIRMED', notes: 'Survived efficiency challenge; pilot data holds.' },
  independent_source_count: 7,
  data_availability: 'FULL',
  updated: 'May 30, 2026 · cycle 7'
}
```

## Step 3: Render the HTML

1. Read [`templates/novelty_report_template.html`](../templates/novelty_report_template.html) **verbatim**.
2. Replace these placeholders (and NOTHING else):

| Placeholder | Source |
|-------------|--------|
| `__NOVELTY_DATA__` | `JSON.stringify(DATA)` |
| `__GENERATED_AT__` | `metadata.generated_at_display` |
| `__CYCLE__` | `metadata.cycle` |
| `__RUN_MODE__` | `metadata.run_mode` |
| `__CONVERGED__` | `"CONVERGED"` if `metadata.converged` else `"IN PROGRESS"` |
| `__PASS_BADGE_CLASS__` | `"badge-pass"` if converged else `"badge-progress"` |
| `__PASSES__` | `metadata.passes_completed` |

3. **Do NOT alter** the template's CSS, JS, or HTML structure. If a feature needs a template change, edit [`templates/novelty_report_template.html`](../templates/novelty_report_template.html) directly — never inline-render markup here.

## Step 4: Write the output (in place)

1. Create `output/` if missing.
2. Write the rendered HTML to **`output/novelty-explorer.html`**, overwriting the existing file in place. This is the canonical, stable link the user opens — the same path every run.
3. **Only if** `archive=true` was passed: also copy to `output/archive/novelty-explorer-<T>.html`. By default, do NOT create archive copies or per-run folders.

## Output checkpoint

Write to `runs/<T>/checkpoints/cycle_{N}_loop_9.json`:

```json
{
  "cycle": 7,
  "loop": 9,
  "phase": "html_build",
  "completed_at": "<iso>",
  "state": {
    "report_path": "output/novelty-explorer.html",
    "cards_rendered": 66,
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
- `__NOVELTY_DATA__` is replaced with valid JSON (the template is sensitive to malformed embedded JSON).
- The number of cards rendered equals `metadata.leaderboard_size`.
- No placeholder tokens remain in `output/novelty-explorer.html`.
- The file at `output/novelty-explorer.html` is overwritten in place — no new per-run report files are created (unless `archive=true`).

## Failure handling

- **Template missing:** abort with a clear error pointing to `templates/novelty_report_template.html`. The template is canonical and must exist.
- **`__NOVELTY_DATA__` substitution produces invalid JSON:** abort, surface the error; do not write a half-broken page.
- **Validation failure (Step 1):** abort before writing; report which opportunity/field failed.
