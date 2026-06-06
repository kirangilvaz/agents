# Sub-agent: Loop 8 — Final Assembly, Persistence & HTML Build

**Phase:** `html_build` · **Loop ID:** 8 · **Always runs last.** **The only loop that writes to the canonical knowledge base** (`questions/`, `state.json`, `source_reliability.json`, `coverage_matrix.json`, `aliases.json`, `emerging.json`).

## Purpose

Persist all staged changes from prior loops, render the dashboard, write the structured diff and metrics, and update `state.json` so the next run can warm-start correctly.

## Inputs

- All prior checkpoints (Loops 0–7, 9) for the current cycle
- `runs/<ts>/prepped.jsonl` (final ranked list with trends **and** the `prep` "how to answer" layer from Loop 9). Falls back to `runs/<ts>/annotated.jsonl` only if Loop 9 was skipped.
- `runs/<ts>/coverage_matrix_new.json`
- `runs/<ts>/categories_new.json` (live category registry from Loop 5; falls back to [`policies/categories.json`](../policies/categories.json) seed on cold start)
- Loop 4's `source_reliability_deltas`
- Loop 5's gap queue (`runs/<ts>/next_sweep_queue.json`)
- `interview_questions_knowledge/eval/holdout.jsonl` — user-curated real interview questions for recall measurement
- [`templates/interview_dashboard_template.html`](../templates/interview_dashboard_template.html)

## Step 1: Final list assembly

For each category **in the live registry** (`categories_new.json` — seeds plus any discovered category):

1. Sort by `freq` descending.
2. Apply that category's quota (from the registry; discovered categories use their assigned `default_quota`) — drop anything past the quota into `emerging.json`.
3. Assign `rank` (1-based within category).
4. Verify no duplicate `question_id` across categories.
5. Verify all `freq` values match their score breakdown components from Loop 3 (re-derivable check).
6. Verify all conviction levels match their evidence base.
7. Verify all company tags are evidence-backed.

If any verification fails, abort the run with an error checkpoint — this is the last line of defense against invalid data reaching the dashboard.

## Step 2: Compute metadata

```json
{
  "cycle": 7,
  "last_updated": "2026-04-30",
  "total_questions": 135,
  "avg_conviction": "★★★★½",
  "sources_used": 47,
  "companies_covered": 33
}
```

`sources_used` = distinct `source_domain` across all evidence on the final list.
`companies_covered` = distinct `company` across all `companies[]` entries.
`avg_conviction` is the rounded numeric average mapped back to a star string.

## Step 3: Build the dashboard DATA object

Convert each canonical question record into the Card Data Schema (subset used by the template):

```javascript
{
  rank, title, category, subcategory, difficulty, leetcode,
  freq, tier, conviction,
  companies: [{name, count}],   // sorted desc by count, top 12
  concepts,
  description, thesis, sources, risks, tags,
  trend, in_blind75, in_neetcode150,
  last_asked_year,              // = question.newest_recent_year (null if no recent confirmation). Rendered as the "Last asked" chip.
  prep: {                       // from Loop 9; omit gracefully if absent
    key_points, approach, common_mistakes, followups, confidence
  }
}
```

Then wrap. **Categories are data-driven** — build the `categories` map and the `category_meta` list from the live registry (`categories_new.json`), NOT a hardcoded six. This is what lets discovered categories render automatically.

```javascript
const DATA = {
  metadata: { /* from Step 2 */ },
  // category_meta drives the dashboard tabs (order, label, icon). One entry per live category.
  category_meta: [
    { id: 'swe-coding', label: 'SWE Coding', icon: '💻' },
    /* ...one per registry entry, including any discovered categories... */
  ],
  categories: {
    'swe-coding': [...],
    /* ...one key per category_meta entry... */
  }
};
```

The template reads `DATA.category_meta` to build tabs and falls back to a built-in default order if `category_meta` is missing (older runs). Every key in `DATA.categories` MUST have a matching `category_meta` entry.

## Step 4: Render the HTML

1. Read [`templates/interview_dashboard_template.html`](../templates/interview_dashboard_template.html) verbatim.
2. Replace placeholders:

| Placeholder | Source |
|-------------|--------|
| `__DASHBOARD_DATA__` | `JSON.stringify(DATA)` |
| `__PASS_NUMBER__` | `cycle` |
| `__PASS_COUNT__` | `cycle` |
| `__LAST_UPDATED__` | `metadata.last_updated` (YYYY-MM-DD) |
| `__TOTAL_QUESTIONS__` | `metadata.total_questions` |
| `__AVG_CONVICTION__` | `metadata.avg_conviction` |
| `__SOURCES_USED__` | `metadata.sources_used` |
| `__COMPANIES_COVERED__` | `metadata.companies_covered` |
| `__CRITICAL_COUNT__` | count of questions where `tier == 'CRITICAL'` |
| `__HIGH_COUNT__` | count of questions where `tier == 'HIGH'` |

3. Write to `interview_questions_knowledge/runs/<ts>/dashboard.html`.

The template now builds its tabs from `DATA.category_meta`, renders a "Last asked: <year>" chip from `last_asked_year`, exposes a "Recent only" filter, and renders the `prep` study panel (How to Answer / Common Mistakes / Follow-ups) in the detail modal — all driven by the DATA object. No template edit is needed to add a discovered category.

**Do NOT alter** the CSS, JS, or HTML structure of the template at render time. If a feature requires a template change, edit `templates/interview_dashboard_template.html` directly (the spec doesn't embed it anymore — it lives at one canonical path).

## Step 5: Persist canonical knowledge

This is the only loop that mutates `interview_questions_knowledge/` outside of `runs/`, `evidence/`, `sources_cache/`, and `aliases.json`. Apply staged changes from prior loops:

1. **`questions/<category>/<question_id>.json`** — write/overwrite each canonical question with current cycle's `freq`, `tier`, `conviction`, `companies`, `risks`, `trend`, `evidence_count`, `independent_source_count`, `newest_recent_year`, `last_confirmed_cycle`. Append to `score_history`.
2. **For removed questions** (from Loop 5 Lane A or demoted): delete the file (or move to `questions/_archived/<category>/<question_id>.json` for audit trail).
3. **`source_reliability.json`** — apply Loop 4 deltas, recompute `precision = candidates_confirmed / max(candidates_proposed, 1)`, recompute `weight_multiplier = clamp(0.5 + precision, 0.5, 1.5)`, append history entry.
4. **`coverage_matrix.json`** — replace with `coverage_matrix_new.json`.
5. **`emerging.json`** — replace with the current cycle's emerging set.
6. **`categories.json`** — replace with `categories_new.json` (the live registry incl. any discovered/demoted categories from Loop 5). On cold start, seed from [`policies/categories.json`](../policies/categories.json).
7. **`aliases.json`** — already updated in Loop 1b; just verify no orphans (alias → non-existent question_id).
8. **`state.json`** — update:
   ```json
   {
     "last_cycle": 7,
     "last_run_at": "<iso>",
     "last_run_mode": "warm",
     "schema_version": "1.0"
   }
   ```

## Step 6: Write the structured diff

Build `runs/<ts>/diff.json` per [`schemas/diff.schema.json`](../schemas/diff.schema.json) by collecting `ADDED` / `REMOVED` / `UPGRADE` / `DOWNGRADE` / `RENAMED` / `MERGED` / `CONFIRMED` / `FLAGGED` entries from Loops 4, 5, and 7. Compute `summary.swap_pct = (added + removed) / total_questions × 100`.

## Step 7: Eval & metrics

For each line in `eval/holdout.jsonl` (format: `{"question_text": "...", "company": "...", "asked_at": "<iso>", "category": "..."}`):

1. Try to match against the final list via `aliases.json` and (fallback) the same canonicalization rules from Loop 1b.
2. Mark hit/miss.

Compute:

```json
{
  "cycle": 7,
  "completed_at": "<iso>",
  "eval": {
    "holdout_total": 24,
    "holdout_hits": 19,
    "recall": 0.79
  },
  "search_budget": {
    "total": 1500,
    "used": 1247,
    "by_loop": {"1": 894, "4": 187, "6": 274, "7": 92}
  },
  "cache": {
    "hits": 2103,
    "misses": 894,
    "hit_rate": 0.70
  },
  "convergence": {
    "converged": true,
    "swap_pct": 0.74,
    "avg_conviction": 4.6,
    "all_questions_adversarially_challenged": true,
    "stopped_reason": "converged"
  }
}
```

Write to `runs/<ts>/metrics.json`.

## Step 8: Final checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_8.json`:

```json
{
  "cycle": 7,
  "loop": 8,
  "phase": "html_build",
  "completed_at": "<iso>",
  "state": {
    "dashboard_path": "runs/<ts>/dashboard.html",
    "diff_path": "runs/<ts>/diff.json",
    "metrics_path": "runs/<ts>/metrics.json",
    "questions_persisted": 135,
    "questions_archived": 2,
    "source_reliability_updated": 47,
    "state_json_updated": true
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to knowledge base

Everything in Step 5, Step 6, Step 7, plus the dashboard HTML.

## Invariants

- After Loop 8 completes, the knowledge base is fully consistent — `state.json.last_cycle == cycle`, all `questions/` files are valid against the schema, `source_reliability.json.updated_at == completed_at`, and every `question.category` exists in `categories.json`.
- Every key in `DATA.categories` has a matching `DATA.category_meta` entry (so every tab renders).
- The dashboard renders without JavaScript errors when opened in a browser.
- `diff.json.summary.swap_pct` matches the actual diff entries.
- `metrics.json.eval.recall` is between 0 and 1.

## Failure handling

- **Template missing**: abort. The template file is canonical and must exist. Surface a clear error pointing to `templates/interview_dashboard_template.html`.
- **Validation failure** (Step 1): write a partial checkpoint with detailed `errors`, do NOT overwrite `questions/` or `state.json`. The previous cycle's data remains intact.
- **Disk full / write error on knowledge base**: same as above — leave prior cycle's data intact, surface error in checkpoint.
- **Holdout file missing**: skip eval, set `metrics.eval = null`, do not error.
