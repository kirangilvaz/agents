# Interview Questions Agent

A research agent that crawls community forums, interview databases, and curated guides to compile and continuously refine the **Top 135 Most Asked Interview Questions** across SWE and AI/ML roles. Each run loads prior knowledge and improves on it — the list gets more accurate every cycle.

It is both a **research engine** (frequency-ranked, evidence-backed, adversarially challenged) and a **study companion**: every question on the final list carries a concise **"How to Answer"** layer — key talking points, an approach summary, common mistakes, and likely follow-ups — so learning the list actually prepares you, not just informs you. The category taxonomy is **dynamic**: when the research surfaces a coherent cluster of questions that doesn't fit the six seed categories, the agent proposes a new one.

The agent itself is a set of markdown specs in this folder. "Running" the agent means having an AI assistant (Claude in Cursor) read [`AGENT.md`](AGENT.md), which dispatches each loop as a sub-agent.

---

## Quick start

In Cursor chat, run:

```
/run-interview-agent
```

That's it. The slash command (defined in `.cursor/commands/run-interview-agent.md`) attaches [`AGENT.md`](AGENT.md) and tells the assistant to execute one full cycle. Output lands in `interview_questions_knowledge/runs/<timestamp>/dashboard.html`.

---

## Execution methods

Five ways to invoke the agent, from interactive to fully automated:

### 1. Inline @-attach (interactive, simplest)

Open a fresh chat in Cursor and type:

```
@interview-questions-agent/AGENT.md execute this agent
```

The `@` symbol attaches `AGENT.md`, which references all the subagents and policies. Use this when you want to watch the agent work step-by-step.

### 2. Slash command (one keystroke)

```
/run-interview-agent
```

Defined in `.cursor/commands/run-interview-agent.md`. Best for repeatable runs you trigger by hand.

You can pass an explicit run mode:

```
/run-interview-agent mode=cold     # rebuild from scratch
/run-interview-agent mode=warm     # full pipeline, honor caches
/run-interview-agent mode=delta    # quick refresh (Loops 6, 7, 9, 8 only)
```

### 3. Cursor CLI (headless / automatable)

```bash
cursor-agent -p "Execute the agent defined in interview-questions-agent/AGENT.md. Use mode=auto so warm-start chooses cold/warm/delta automatically."
```

Run from any terminal. Output is the same — `interview_questions_knowledge/runs/<ts>/dashboard.html`.

### 4. Scheduled (cron / launchd)

Wrap the CLI for periodic refreshes. Example crontab entry — full cycle every Sunday 2 AM, delta refresh every weekday 6 AM:

```bash
0 2 * * 0 cd /Users/kg010808/Downloads/agents && cursor-agent -p "Execute interview-questions-agent/AGENT.md mode=warm" >> ~/logs/iq-agent.log 2>&1
0 6 * * 1-5 cd /Users/kg010808/Downloads/agents && cursor-agent -p "Execute interview-questions-agent/AGENT.md mode=delta" >> ~/logs/iq-agent.log 2>&1
```

For macOS, the launchd equivalent goes in `~/Library/LaunchAgents/com.user.iq-agent.plist`.

### 5. Cursor rule auto-attach (always primed)

Create `.cursor/rules/interview-agent.mdc` with `globs: ["interview-questions-agent/**"]`. Then any chat opened inside this folder auto-loads the orchestrator instructions and you can just say "run a cycle" without attaching anything.

Useful when you frequently iterate on the spec itself.

---

## Multi-subagent dispatch model

One CLI / chat invocation = **one full cycle**. The orchestrator (Claude reading [`AGENT.md`](AGENT.md)) dispatches each loop as a sub-agent via Cursor's `Task` tool. You never invoke subagents directly.

```
orchestrator
   ├─ Task: subagents/00-warm-start.md     (decides cold/warm/delta)
   ├─ Task: subagents/01-broad-sweep.md    (skipped in delta)
   ├─ Task: subagents/01b-canonicalize.md  (skipped in delta)
   ├─ Task: subagents/02-frequency-validation.md  (skipped in delta)
   ├─ Task: subagents/03-scoring.md        (skipped in delta)
   ├─ Task: subagents/04-adversarial.md    (skipped in delta)
   ├─ Task: subagents/05-replacement.md    (skipped in delta)
   ├─ Task: subagents/06-company-tags.md   (always runs)
   ├─ Task: subagents/07-trends.md         (always runs)
   ├─ Task: subagents/09-answer-synthesis.md (always runs; "How to Answer" layer)
   └─ Task: subagents/08-html-build.md     (always runs, last)
```

Loops 1→7 may repeat until convergence (see [`policies/convergence.json`](policies/convergence.json)).

---

## Folder layout

### Agent spec (this folder, version-controlled)

```
interview-questions-agent/
  AGENT.md                              # Top-level orchestrator spec — start here
  README.md                             # This file
  subagents/
    00-warm-start.md                    # Loop 0: load prior knowledge, choose run mode
    01-broad-sweep.md                   # Loop 1: cast widest net across all sources
    01b-canonicalize.md                 # Loop 1b: dedupe candidates → canonical question_id
    02-frequency-validation.md          # Loop 2: provenance-aware independent-source counting
    03-scoring.md                       # Loop 3: frequency score + behavioral matrix
    04-adversarial.md                   # Loop 4: try to disprove every ranking
    05-replacement.md                   # Loop 5: stability rule + coverage gap analysis
    06-company-tags.md                  # Loop 6: per-company refresh + level normalization
    07-trends.md                        # Loop 7: rising/declining + emerging concepts
    09-answer-synthesis.md              # Loop 9: concise "How to Answer" study layer per question
    08-html-build.md                    # Loop 8: persist + render dashboard
  templates/
    interview_dashboard_template.html   # Dark-themed dashboard, data-driven tabs (do not embed in subagents)
  schemas/
    question.schema.json                # Canonical question record
    evidence_record.schema.json         # One source confirmation, with provenance
    source_reliability.schema.json      # Per-source precision learned across cycles
    cache_entry.schema.json             # Cached fetch responses
    coverage_matrix.schema.json         # Companies × categories heatmap
    diff.schema.json                    # Structured per-cycle changelog
  policies/
    source_ttl.json                     # Per-domain TTL, rate limits, ToS notes
    convergence.json                    # Convergence thresholds + search budgets
    company_level_tags.json             # Level taxonomy (L3/L4/E5/SDE2 → canonical)
    categories.json                     # Seed categories + dynamic-discovery rules (drives tabs + quotas)
```

### Knowledge base (sibling folder, runtime; gitignore recommended)

```
interview_questions_knowledge/
  state.json                              # last_cycle, last_run_at, run_mode, schema_version
  categories.json                         # live category registry (seeds + discovered); drives dashboard tabs + quotas
  questions/<category>/<question_id>.json # canonical record per question (includes the prep "how to answer" layer)
  aliases.json                            # paraphrase → canonical question_id
  evidence/<question_id>.jsonl            # append-only provenance records
  sources_cache/<sha256(url)>.json        # raw fetched content + fetched_at
  source_reliability.json                 # per-source precision learned across cycles
  companies/<company_slug>.json           # per-company aggregations + level tags
  coverage_matrix.json                    # companies × categories heatmap
  emerging.json                           # 45–59 score band watchlist
  eval/holdout.jsonl                      # YOUR confirmed real interview questions
  runs/<ISO_TIMESTAMP>/
    checkpoints/cycle_{N}_loop_{L}.json   # per-loop state snapshots (audit trail)
    diff.json                             # structured changelog vs previous run
    dashboard.html                        # rendered output — open this in a browser
    metrics.json                          # eval recall, search budget, cache hit rate
```

The knowledge base is what makes re-runs improve. Loop 0 reads it, Loop 8 updates it.

---

## Run modes

The agent picks a mode automatically based on `interview_questions_knowledge/state.json`:

| Mode | Triggered when... | What runs |
|------|-------------------|-----------|
| **cold** | Knowledge folder doesn't exist (first run) | Full Loops 0 → 1 → 1b → 2 → 3 → 4 → 5 → 6 → 7 → (loop until convergence) → 8 |
| **warm** | Last run ≥ 30 days ago, OR 7-30 days ago window | Same as cold, but Loop 1 honors source cache TTLs (much faster) |
| **delta** | Last run < 7 days ago | Only Loops 6 → 7 → 9 → 8 (refresh tags + trends + stale prep, no broad sweep) |

Override with `mode=cold|warm|delta` in your prompt to force a specific mode.

Tunable in [`policies/convergence.json`](policies/convergence.json):

- `cold_after_days` (default 30)
- `min_passes` (default 3) and `max_passes` (default 25)
- Convergence thresholds (`max_swap_pct`, `min_avg_conviction`, etc.)
- Search budget per loop and per cycle

---

## Seeding the eval harness

To measure how good the agent's recall is, append confirmed real interview questions to `interview_questions_knowledge/eval/holdout.jsonl` (one JSON object per line):

```json
{"question_text": "Implement an LRU cache", "company": "stripe", "asked_at": "2026-03-15", "category": "swe-coding"}
{"question_text": "Design a rate limiter for the Stripe API", "company": "stripe", "asked_at": "2026-03-15", "category": "swe-system-design"}
{"question_text": "Tell me about a time you disagreed with a tech lead", "company": "anthropic", "asked_at": "2026-04-02", "category": "swe-behavioral"}
```

Loop 8 attempts to match each holdout entry against the final list and reports recall in `runs/<ts>/metrics.json`. Higher recall over cycles = the agent is genuinely improving, not just confidently restating itself.

You can seed this from your own interview history, your network's reports, or screenshots of "actually asked" questions. Even 10–20 entries are enough to start measuring.

---

## Output

After every successful run, open:

```
interview_questions_knowledge/runs/<latest-timestamp>/dashboard.html
```

The dashboard has data-driven tabs (one per live category, including any the agent discovered), a "Last asked: <year>" recency chip and a **🕒 Recent only** filter on each card, and a **🎯 How to Answer** study panel in every question's detail modal (key points, approach, common mistakes, likely follow-ups).

Sibling files in the same `runs/<ts>/` folder:

- **`diff.json`** — what changed vs the previous cycle (added, removed, upgraded, downgraded, etc.)
- **`metrics.json`** — eval recall, search budget used, cache hit rate, convergence info
- **`checkpoints/`** — per-loop state snapshots for debugging or resuming a failed run

---

## Customization

| To change... | Edit... |
|--------------|---------|
| Which sources to crawl | [`AGENT.md`](AGENT.md) source tier tables + [`policies/source_ttl.json`](policies/source_ttl.json) |
| Cache TTL or rate limits per domain | [`policies/source_ttl.json`](policies/source_ttl.json) |
| Convergence criteria or pass limits | [`policies/convergence.json`](policies/convergence.json) |
| Search budget per loop | [`policies/convergence.json`](policies/convergence.json) → `search_budget` |
| Level tag mappings (L3 → mid, etc.) | [`policies/company_level_tags.json`](policies/company_level_tags.json) |
| Category quotas + seed categories | [`policies/categories.json`](policies/categories.json) → `seed_categories` (also summarized in [`AGENT.md`](AGENT.md)) |
| When the agent may add a new category | [`policies/categories.json`](policies/categories.json) → `dynamic_discovery` |
| The "How to Answer" study layer | [`subagents/09-answer-synthesis.md`](subagents/09-answer-synthesis.md) |
| Frequency score weights | [`subagents/03-scoring.md`](subagents/03-scoring.md) |
| Behavioral scoring matrix | [`subagents/03-scoring.md`](subagents/03-scoring.md) |
| Dashboard look-and-feel | [`templates/interview_dashboard_template.html`](templates/interview_dashboard_template.html) (CSS, never the placeholder tokens) |

---

## Troubleshooting

**"Agent says it can't find prior knowledge"** — Knowledge base hasn't been created yet. First run = cold start. Normal.

**"Agent skipped Loop 1"** — You're in delta mode (last run < 7 days ago). Force a full pass with `mode=warm` or `mode=cold`.

**"Search budget exhausted"** — Loop 1 hit the per-cycle cap (default 1500). Either raise it in `policies/convergence.json` or wait for the next cycle (cached fetches don't count).

**"Convergence never reached"** — Check `metrics.json.convergence`. Likely causes: a noisy source needs to be downweighted (look at `source_reliability.json`), or `max_swap_pct` is too tight in `policies/convergence.json`.

**"Dashboard renders blank"** — Open the browser console. Almost always a bad `__DASHBOARD_DATA__` substitution. Check `runs/<ts>/checkpoints/cycle_N_loop_8.json` for errors.

---

## License & ToS

This agent is for **personal interview preparation**. The crawled sources have their own Terms of Service (see [`policies/source_ttl.json`](policies/source_ttl.json) per-domain notes). Honor robots.txt, rate limits, and never republish third-party content without attribution. The agent is configured to respect these by default.
