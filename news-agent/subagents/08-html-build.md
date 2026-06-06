# Sub-agent: Loop 8 — HTML Build (Fill Template Placeholders ONLY)

**Phase:** `html_build` · **Loop ID:** 8 · **Always runs last.**

## Purpose

Render the briefing by filling placeholders in the canonical template. This subagent is the reason the report now generates reliably: it **NEVER hand-writes HTML, CSS, or JS** — it only substitutes tokens in [`templates/news_dashboard_template.html`](../templates/news_dashboard_template.html), which renders every card client-side from one embedded `DATA` object.

## Inputs

- Loop 7 locked top-30 list + run metadata + changelog.
- [`templates/news_dashboard_template.html`](../templates/news_dashboard_template.html) (canonical; read verbatim).

## Step 1: Validate the locked list (last line of defense)

For every story verify it has: `headline`, valid `category`, numeric `score` (0–100), `tier` matching the score band, `conviction`, `summary`, `why`, `details` (≥3 or a noted reason), `sources` (≥2 with `name`; `url` where available), `score_breakdown` (5 components summing to `score`), `adversarial`, `watch`, `updated`, and a unique `rank`.

If ANY story fails validation, **abort** — write nothing — and report exactly which story/field failed. A broken card must never reach the page.

## Step 2: Build the DATA object

```javascript
const DATA = {
  metadata: {
    briefing_date: "2026-04-30",
    total_stories: 30,
    sources_consulted: 38,        // distinct outlets attempted in Loop 1
    avg_conviction: "★★★★½",
    passes_completed: 5,
    converged: true,
    changelog: [ /* {pass, event, detail} entries from the run */ ]
  },
  // category_meta drives the dashboard filter chips. One entry per category present in stories[].
  // Use the canonical ids/icons from AGENT.md NEWS CATEGORIES.
  category_meta: [
    { id: 'WORLD', icon: '🌍', label: 'World' },
    { id: 'US POLITICS', icon: '🏛️', label: 'US Politics' },
    { id: 'ECONOMY', icon: '📉', label: 'Economy' },
    { id: 'MARKETS', icon: '📊', label: 'Markets' },
    { id: 'TECH', icon: '💻', label: 'Tech' },
    { id: 'AI', icon: '🤖', label: 'AI' },
    { id: 'SCIENCE', icon: '🔬', label: 'Science' },
    { id: 'BUSINESS', icon: '🏢', label: 'Business' },
    { id: 'CULTURE', icon: '🎭', label: 'Culture' },
    { id: 'BREAKING', icon: '🔴', label: 'Breaking' }
  ],
  // stories sorted by score descending; each conforms to the Card Data Schema in AGENT.md.
  stories: [ /* ...locked top 30... */ ]
};
```

The template falls back to a built-in default `category_meta` if it is omitted, but always include it. Every `category` used in `stories[]` SHOULD have a matching `category_meta` entry (unmatched categories still render with a default icon).

## Step 3: Render the HTML

1. Read [`templates/news_dashboard_template.html`](../templates/news_dashboard_template.html) **verbatim**.
2. Replace these placeholders (and NOTHING else):

| Placeholder           | Source                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| `__NEWS_DATA__`       | `JSON.stringify(DATA)`                                                                   |
| `__BRIEFING_DATE__`   | `metadata.briefing_date_display` (e.g. "Wednesday, April 30, 2026")                     |
| `__NEWS_WINDOW__`     | Loop 0 `news_window_display`                                                             |
| `__LAST_UPDATED__`    | build timestamp, human-readable (e.g. "Apr 30, 2026 · 7:05 AM ET")                      |
| `__PASS_NUMBER__`     | `metadata.passes_completed`                                                              |
| `__CONVERGED__`       | `"CONVERGED"` if `metadata.converged` else `"IN PROGRESS"`                               |
| `__PASS_BADGE_CLASS__`| `"badge-pass"` if `metadata.converged` else `"badge-progress"`                           |

3. **Do NOT alter** the template's CSS, JS, or HTML structure. If a feature needs a template change, edit [`templates/news_dashboard_template.html`](../templates/news_dashboard_template.html) directly — never inline-render markup here.

## Step 4: Write the output

1. Write the rendered HTML to `output/news-<briefing_date>.html` (e.g. `output/news-2026-04-30.html`). Create the `output/` directory if missing. Re-running the same date overwrites this same file in place.
2. Copy the same rendered HTML to `output/index.html` (stable "open this for today" link).

## Outputs

- `output/news-<YYYY-MM-DD>.html` — the briefing.
- `output/index.html` — copy of the latest briefing.

## Invariants

- The page renders without JavaScript errors when opened in a browser.
- `__NEWS_DATA__` is replaced with valid JSON — the template is sensitive to malformed embedded JSON.
- The number of cards rendered equals `metadata.total_stories`.
- No placeholder tokens remain in the output file.

## Failure handling

- **Template missing:** abort with a clear error pointing to `templates/news_dashboard_template.html`. The template is canonical and must exist.
- **`__NEWS_DATA__` substitution produces invalid JSON:** abort, surface the error; do not write a half-broken page.
- **Validation failure (Step 1):** abort before writing; report which story/field failed.
