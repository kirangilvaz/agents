# Daily News Agent

A research agent that scrapes wire services, papers of record, broadcast/cable, tech/business outlets, social aggregators, and international sources to compile the **Top 30 Most Important News Stories of the Day**, ranked by popularity and significance. Each run produces a self-contained dark-themed HTML briefing.

The agent itself is a set of markdown specs in this folder. "Running" it means having an AI assistant (Claude in Cursor) read [`AGENT.md`](AGENT.md), which dispatches each loop as a sub-agent via the `Task` tool.

---

## Quick start

In Cursor chat, run:

```
/run-news-agent
```

That's it. The slash command (defined in `.cursor/commands/run-news-agent.md`) attaches [`AGENT.md`](AGENT.md) and tells the assistant to execute one full cycle. Output lands in `output/news-<YYYY-MM-DD>.html` (and `output/index.html` as the stable "today" link).

Optional arguments:

```
/run-news-agent date=2026-04-30        # specific briefing date
/run-news-agent window=calendar        # calendar-day instead of rolling 24h
```

You can also @-attach the spec interactively:

```
@news-agent/AGENT.md execute this agent
```

---

## Why HTML now generates reliably

Earlier versions described the HTML inline and asked the model to build the page from prose every run — so it hand-wrote a ~600-line page from scratch each time, which broke often.

This version mirrors the proven pattern used by the sibling `interview-questions-agent` and `ticker-research-agent`:

- A **canonical template** ([`templates/news_dashboard_template.html`](templates/news_dashboard_template.html)) renders every card client-side from one embedded object: `const DATA = __NEWS_DATA__;`.
- A **dedicated build loop** ([`subagents/08-html-build.md`](subagents/08-html-build.md)) only substitutes placeholders and is forbidden from hand-writing HTML.

The model never authors markup — it produces a validated `DATA` object and fills tokens.

---

## How it works (loop graph)

```
orchestrator (reads AGENT.md)
   ├─ Task: subagents/00-warm-start.md      (resolve date + news window)
   ├─ Task: subagents/01-broad-sweep.md     (query all 5 source tiers, parallel)
   ├─ Task: subagents/02-dedup-cluster.md   (wire-copy collapse + partisan check)
   ├─ Task: subagents/03-scoring.md         (popularity score 0-100)        ┐
   ├─ Task: subagents/04-adversarial.md     (try to demote every story)     │ repeat
   ├─ Task: subagents/05-enrichment.md      (summary/why/details/sources)   │ until
   ├─ Task: subagents/06-category-balance.md(gap-fill + relevancy coverage) ┘ converged
   ├─ Task: subagents/07-final-lock.md      (validate + lock the top 30)
   └─ Task: subagents/08-html-build.md      (fill template placeholders, write output/)
```

Loops 3→6 repeat until convergence (min 3 passes, max 10) per [AGENT.md](AGENT.md#convergence-criteria).

---

## Folder layout

```
news-agent/
  AGENT.md                          # orchestrator spec — start here
  README.md                         # this file
  subagents/
    00-warm-start.md                # resolve briefing date + news window
    01-broad-sweep.md               # cast widest net across all source tiers
    02-dedup-cluster.md             # collapse wire copy, count independent outlets
    03-scoring.md                   # popularity score (coverage/prominence/social/...)
    04-adversarial.md               # challenge + demote every ranking
    05-enrichment.md                # summary, why, key details, sources, what-to-watch
    06-category-balance.md          # ensure all newsworthy domains are covered
    07-final-lock.md                # validate + freeze the top 30
    08-html-build.md                # fill template placeholders, write the report
  templates/
    news_dashboard_template.html    # canonical dark dashboard (do not embed in subagents)

output/                             # rendered briefings (runtime)
  news-<YYYY-MM-DD>.html            # one per briefing date
  index.html                        # copy of the latest briefing
```

---

## Output

After every successful run, open:

```
output/index.html        # latest briefing
output/news-<date>.html  # a specific day's briefing
```

The dashboard has a stat bar, category filter chips, ranked cards grouped by tier (CRITICAL / MAJOR / NOTABLE / NOTEWORTHY) with score rings and conviction badges, search, and a detail modal per story (what happened, why it matters, key details, popularity score breakdown, adversarial review, clickable sources, and what to watch).

---

## Customization

| To change...                  | Edit...                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Which sources to scrape       | [`AGENT.md`](AGENT.md) source-tier tables                                                |
| Scoring weights / tiers       | [`AGENT.md`](AGENT.md) Popularity Scoring System + [`subagents/03-scoring.md`](subagents/03-scoring.md) |
| Adversarial challenge logic   | [`subagents/04-adversarial.md`](subagents/04-adversarial.md)                             |
| Category set / icons          | [`AGENT.md`](AGENT.md) News Categories + the `category_meta` in [`subagents/08-html-build.md`](subagents/08-html-build.md) |
| Convergence criteria          | [`AGENT.md`](AGENT.md#convergence-criteria)                                              |
| Dashboard look-and-feel       | [`templates/news_dashboard_template.html`](templates/news_dashboard_template.html) (CSS, never the placeholder tokens) |

---

## Troubleshooting

**"Report renders blank"** — Open the browser console. Almost always a bad `__NEWS_DATA__` substitution (invalid JSON). Loop 8 should abort before writing in that case; re-run.

**"Too few stories"** — A category genuinely had no major development, or sources failed. Check the changelog in the report's metadata; the agent intentionally never pads with low-quality stories.

**"A story looks over-ranked"** — Likely wire-copy inflation. Loop 2 collapses republished AP/Reuters copy into a single source; verify `independent_count` reflects original reporting, not distribution reach.

---

## ToS

For personal news awareness. Honor robots.txt, rate limits, and outlet Terms of Service; never republish third-party content without attribution. Paywalled content is cited honestly (`[via archive]` / `[via reader]` / `[paywalled — headline only]`).
