# Novelty-Explorer

An autonomous, research-grade agent that continuously **discovers, evaluates, and ranks emerging technologies, scientific breakthroughs, startups, and innovation trends** that may become future market disruptors — and surfaces high-conviction opportunities **before they go mainstream**.

Every run does a broad landscape scan across all domains, scores each opportunity on five dimensions plus Time-to-Mainstream, challenges every high-conviction call adversarially, and **updates one self-contained HTML report in place** so the radar gets sharper with each run.

The agent itself is a set of markdown specs in this folder. "Running" it means having an AI assistant (Claude in Cursor) read [`AGENT.md`](AGENT.md), which dispatches each loop as a sub-agent.

The output is **always the same file**, overwritten in place:

```
output/novelty-explorer.html
```

There are **no per-run report folders** — each run improves the single report. (Per-run audit artifacts live under `novelty_explorer_memory/runs/<ts>/`.)

---

## Quick start

In Cursor chat:

```
/run-novelty-explorer
```

That's it. The slash command (defined in `.cursor/commands/run-novelty-explorer.md`) attaches [`AGENT.md`](AGENT.md) and tells the assistant to execute one full cycle. Open `output/novelty-explorer.html` when it finishes.

Optional arguments:

```
/run-novelty-explorer mode=cold          # rebuild from scratch (ignore caches + prior memory)
/run-novelty-explorer mode=warm          # full pipeline, honor caches (default for non-recent runs)
/run-novelty-explorer mode=delta         # quick refresh (momentum/capital + new-entrant scan + rescore)
/run-novelty-explorer focus=ENERGY       # bias discovery toward one domain (still sweeps the others)
/run-novelty-explorer archive=true       # also save a timestamped copy under output/archive/
```

---

## What it produces

The HTML report is a single dark-themed page with:

- **A leaderboard** of every opportunity that clears the conviction floor (≥ 60), grouped by tier: **Exceptional · High Conviction · Worth Monitoring · Emerging Signal**.
- **Per-opportunity cards** with a composite-conviction ring, the 5-dimension mini-bars (Novelty / Capital / Momentum / Feasibility / Market), a **Time-to-Mainstream** badge, a **signal-convergence** badge, an **under-recognized ↔ crowded** meter, the **lifecycle state**, and a **conviction-trend sparkline**.
- **Detail modals**: investment thesis, why-it-matters, full signal breakdown with rationales, amplifiers/suppressors, capital signals (rounds + investor names + partnerships + grants), evidence links (papers, patents, repos, funding, news), risks/failure modes, and the adversarial review verdict.
- **Controls**: search; sort by **raw conviction**, **time-adjusted conviction**, momentum, novelty, or "most under-recognized"; filter by domain, by TTM horizon, and quick toggles (under-recognized only / rising only / high-convergence only).
- **A "What changed since last run"** changelog.

---

## The conviction framework

Five 0–100 scores per opportunity:

| Dimension | Weight | Measures |
|-----------|-------:|----------|
| Novelty | 25% | research originality, patent uniqueness, competitive density, breakthrough potential |
| Capital | 20% | funding volume + growth, # investors, **investor quality**, repeat participation, strategic/CVC |
| Momentum | 20% | search / citation / GitHub / hiring growth, conference + industry discussion |
| Technical Feasibility | 20% | demonstrated results, scientific validation, prototype, independent verification |
| Market Potential | 15% | TAM, pain points, adoption barriers, moat, scalability |

```
Conviction = 0.25·Novelty + 0.20·Capital + 0.20·Momentum + 0.20·Feasibility + 0.15·Market
```

**Tiers:** 90–100 Exceptional · 80–89 High Conviction · 70–79 Worth Monitoring · 60–69 Emerging Signal · < 60 Noise (watchlist).

**Signal amplifiers** raise conviction when *independent* signals converge (funding + patents + GitHub + hiring + citations + pilots + regulatory + partnerships). **Signal suppressors** cut it when hype exceeds evidence (no prototype, not reproducible, funding stagnant, attention without substance). Investor quality is weighted — $5M from Sequoia/a16z/Founders Fund beats $5M from unknowns.

**Time-to-Mainstream (TTM):** 0–2 / 2–5 / 5–10 / 10+ years. A **Time-Adjusted Conviction** = `Conviction × ttm_discount` lets near-term monetizers (AI infra) and long-horizon moonshots (fusion, quantum networking, BCI) be compared. Sort either way in the report.

---

## How it works (multi-subagent dispatch)

One invocation = **one full cycle**. The orchestrator (Claude reading [`AGENT.md`](AGENT.md)) dispatches each loop as a sub-agent via Cursor's `Task` tool.

```
orchestrator
   ├─ Task: subagents/00-warm-start.md            (load memory, decide cold/warm/delta)
   ├─ Task: subagents/01-discovery-sweep.md       (exhaustive crawl: all 5 source tiers)
   ├─ Task: subagents/02-canonicalize.md          (dedupe entities → stable opportunity_id)   [cold/warm]
   ├─ Task: subagents/03-evidence-enrichment.md   (deep-dive per source class)                [cold/warm]
   ├─ Task: subagents/04-scoring.md               (5 dims + composite + TTM + crowding)
   ├─ Task: subagents/05-adversarial.md           (try to disprove; hype check; domain discovery) [cold/warm]
   ├─ Task: subagents/06-amplifiers-suppressors.md(convergence boosts / hype penalties)
   ├─ Task: subagents/07-iterative-refinement.md  (re-run 4→6 until convergence; min 3 passes) [cold/warm]
   ├─ Task: subagents/08-persist.md               (rank, lifecycle, persist memory, diff, metrics)
   └─ Task: subagents/09-html-build.md            (fill template → output/novelty-explorer.html)
```

In **delta** mode the heavy loops (2, 3, 5, 7) are skipped for speed; Loop 5 is re-inserted only if a rescore crosses a tier/lifecycle boundary.

---

## Exhaustive source coverage

The agent attempts **every** source class each cold/warm cycle (no silent skips; failures are logged and retried next run):

- **Scientific:** arXiv · bioRxiv/medRxiv · SSRN · Nature · Science · IEEE · ACM · Semantic Scholar · university labs
- **Startup ecosystem:** Crunchbase · Y Combinator · accelerators/incubators · Product Hunt · founder communities · Wellfound
- **Investment activity:** TechCrunch · The Information · Axios · SEC EDGAR (Form D) · PitchBook/CB Insights · corporate/strategic VC · government grants (SBIR/ARPA-E/NSF) · M&A
- **Technical communities:** GitHub · Hacker News · Reddit · engineering blogs · open-source ecosystems (PyPI/npm/HF) · developer conferences
- **Patent activity:** Google Patents · USPTO · Lens.org · Espacenet · patent citations

See the full tier tables in [`AGENT.md`](AGENT.md) and per-domain TTLs / rate limits / ToS notes in [`policies/source_ttl.json`](policies/source_ttl.json).

---

## Persistent memory (why re-runs improve)

Lives at `novelty_explorer_memory/` (sibling folder; gitignore recommended). Loop 0 reads it; Loop 8 updates it. **Never wiped except by `--reset`.**

```
novelty_explorer_memory/
  state.json                            # cycle, last_run_at, run_mode
  domains.json                          # live domain registry (seeds + discovered) → report tabs
  source_reliability.json               # per-source precision learned across cycles
  watchlist.json                        # sub-floor opportunities kept for re-evaluation
  opportunities/<id>.json               # canonical record per opportunity
  aliases.json                          # alternate names → canonical id
  evidence/<id>.jsonl                   # append-only provenance (verbatim quotes)
  score_history/<id>.jsonl              # append-only per-cycle scores (drives sparklines + lifecycle)
  sources_cache/<sha256(url)>.json      # cached fetches + fetched_at + status
  iteration_log/<id>.jsonl              # append-only adversarial verdicts
  runs/<ISO_TIMESTAMP>/
    checkpoints/cycle_{N}_loop_{L}.json # per-loop audit snapshots
    diff.json                           # what changed vs prior run
    metrics.json                        # budget, cache hit rate, convergence, drift
```

Conviction can rise **or** fall across runs. An opportunity that gets a new funding round and accelerating citations climbs; one whose hype outran its evidence (or that failed reproduction) gets suppressed and may drop to the watchlist — then climb back if the evidence later catches up.

---

## Folder layout

```
novelty-explorer/
  AGENT.md                               # Orchestrator spec — start here
  README.md                              # This file
  subagents/                             # The 10 loop specs (00–09)
  templates/
    novelty_report_template.html         # Canonical dark-theme report (do not inline-render elsewhere)
  schemas/
    opportunity.schema.json              # Canonical opportunity record
    evidence_record.schema.json          # One source confirmation, with provenance
    source_reliability.schema.json       # Per-source learned weights
    diff.schema.json                     # Cross-cycle changelog
    cache_entry.schema.json              # Cached fetch responses
    score_history.schema.json            # Per-cycle score line
  policies/
    convergence.json                     # Run-mode thresholds, convergence rules, search budgets
    weights.json                         # Composite + component weights, TTM discounts, investor tiers, amplifiers/suppressors, crowding, lifecycle
    source_ttl.json                      # Per-domain TTL, rate limits, ToS notes, paywall fallback
    domains.json                         # Seed domains + dynamic-discovery rules
```

---

## Customization

| To change... | Edit... |
|--------------|---------|
| Which sources to crawl | [`AGENT.md`](AGENT.md) source tier tables + [`policies/source_ttl.json`](policies/source_ttl.json) |
| Composite formula / dimension component weights | [`policies/weights.json`](policies/weights.json) |
| TTM discount factors | [`policies/weights.json`](policies/weights.json) → `ttm_discount` |
| Investor-quality tiers | [`policies/weights.json`](policies/weights.json) → `investor_quality_tiers` |
| Amplifier / suppressor caps | [`policies/weights.json`](policies/weights.json) → `amplifiers` / `suppressors` |
| Conviction floor, convergence, min/max passes, budgets | [`policies/convergence.json`](policies/convergence.json) |
| Seed domains + when a new one can be added | [`policies/domains.json`](policies/domains.json) |
| Report look-and-feel | [`templates/novelty_report_template.html`](templates/novelty_report_template.html) (CSS/JS only — never the placeholder tokens) |

---

## Scheduling (optional)

Wrap the Cursor CLI for periodic refreshes:

```bash
# Full warm landscape scan every Monday 6 AM
0 6 * * 1 cd /Users/kg010808/Downloads/agents && cursor-agent -p "Execute novelty-explorer/AGENT.md mode=warm" >> ~/logs/novelty.log 2>&1

# Quick delta refresh (new funding + new entrants) every day
0 7 * * * cd /Users/kg010808/Downloads/agents && cursor-agent -p "Execute novelty-explorer/AGENT.md mode=delta" >> ~/logs/novelty.log 2>&1
```

---

## Troubleshooting

**"No prior memory"** — First run = cold start. Normal.

**"Skipped most loops"** — You're in delta mode (last run < 3 days). Force a full pass with `mode=warm` or `mode=cold`.

**"Report renders blank"** — Open the browser console. Almost always a malformed `__NOVELTY_DATA__` substitution. Check `novelty_explorer_memory/runs/<ts>/checkpoints/cycle_N_loop_9.json` for errors.

**"Conviction jumped between runs"** — Check `diff.json` and the opportunity's `iteration_log`. Large moves usually trace to a new funding round (amplifier) or an adversarial suppression.

**"Search budget exhausted"** — Raise `per_cycle_total_cap` in [`policies/convergence.json`](policies/convergence.json) or accept a partial cycle (the report still ships).

---

## License & ToS

This agent is for **personal research and analysis**. Crawled sources have their own Terms of Service (see per-domain notes in [`policies/source_ttl.json`](policies/source_ttl.json)). Honor robots.txt, rate limits, and paywalls; never republish third-party content without attribution. The agent is configured to respect these by default.

The output is **not investment advice.** Every score makes its evidence chain explicit so you can audit it — the decision is yours.
