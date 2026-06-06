# GTM-Scout

An autonomous **Go-To-Market Intelligence agent** that, for any product/service/SaaS/app/investment product, discovers the most effective **channels, influencers, communities, agencies, partnerships, affiliates, newsletters, podcasts, events, and leads** — and turns them into an **actionable, ROI-ranked customer-acquisition playbook**.

It operates like a growth marketer + market researcher + venture analyst + influencer scout + partnership manager + BDR rolled into one. The goal isn't to dump data — it's to tell you **what to do, in what order, with your budget**, every recommendation backed by verifiable evidence.

The agent itself is a set of markdown specs in this folder. "Running" it means having an AI assistant (Claude in Cursor) read [`AGENT.md`](AGENT.md), which dispatches each phase as a sub-agent.

The output is **one self-contained HTML report per product**, overwritten in place each run:

```
output/gtm-scout-<brief_id>.html
```

There are **no per-run report folders** — each run sharpens the single report. (Per-run audit artifacts live under `gtm_scout_memory/runs/<brief_id>/<ts>/`.)

---

## Quick start

In Cursor chat, give it a product brief:

```
/run-gtm-scout
Product: AI-powered stock-market signal platform for retail investors.
Target customer: retail traders & investors.
Budget: $2,000/month.
Objective: acquire first 100 paying customers.
```

That's it. The slash command (defined in `.cursor/commands/run-gtm-scout.md`) attaches [`AGENT.md`](AGENT.md) and tells the assistant to execute one full cycle. Open `output/gtm-scout-ai-stock-signals.html` when it finishes.

Optional arguments:

```
/run-gtm-scout mode=cold              # rebuild from scratch (ignore caches + prior memory)
/run-gtm-scout mode=warm              # full pipeline, honor caches (default for non-recent runs)
/run-gtm-scout mode=delta             # quick refresh (growth/buying signals + new-entrant scan + rescore)
/run-gtm-scout focus=INFLUENCER       # bias discovery toward one opportunity type (still sweeps the others)
/run-gtm-scout archive=true           # also save a timestamped copy under output/archive/
/run-gtm-scout brief=ai-stock-signals # re-run an existing product brief without re-pasting it
```

---

## What it produces

The HTML report is a single dark-themed page with:

- **Executive Summary** — product, ICP, budget, objective, headline recommendation + top 3 moves.
- **Opportunities leaderboard** — every opportunity that clears the **score floor (≥ 70)**, grouped by tier (**Priority · Strong · Qualified**), with type-filter tabs.
- **Per-opportunity cards** — an opportunity-score ring, the 6-dimension mini-bars (Relevance / Audience / Reach / Growth / Access / Cost), an **expected-ROI** badge, a **conviction** chip, an **effort** badge, the verified reach (or `Unverified`), the lifecycle state, and a score sparkline.
- **Detail modals** — why it fits, a suggested **outreach angle**, the full signal breakdown with rationales, amplifiers/suppressors, verified reach + access (contact, rates, sponsorship/promo availability), evidence links, risks/flags, and the adversarial verdict.
- **Budget Allocation** — how to split your *actual* budget across the top channels (unverified-cost lines flagged in amber).
- **Outreach Strategy** — who to contact, in what order, with the angle.
- **Content Strategy** — themes/formats per channel, tied to ICP pains.
- **Go-To-Market Plan** — Immediate (1–7d) · Short-term (30d) · Mid-term (90d) · Long-term (6–12mo), conviction-tagged.
- **"What changed since last run"** changelog.

---

## The scoring framework (the mission's Phase 9)

Six 0–100 scores per opportunity, combined with the **exact mission weights**:

| Dimension | Weight | Measures |
|-----------|-------:|----------|
| Relevance | 30% | topical fit to category + ICP; promotion history in the niche |
| Audience Match | 25% | how closely the audience overlaps the ICP (demographics, intent, geo, B2B/B2C) |
| Reach | 15% | verified audience size (followers / members / subscribers / downloads / attendees) |
| Growth Signals | 15% | momentum: audience growth, recent funding/launch, rising engagement, fresh activity |
| Ease of Access | 10% | reachable: published contact, accepts sponsors/guests, allows promo, response likelihood |
| Cost Efficiency | 5% | expected ROI vs your budget (free/owned channels score highest) |

```
OpportunityScore = 0.30·Relevance + 0.25·AudienceMatch + 0.15·Reach + 0.15·GrowthSignals + 0.10·EaseOfAccess + 0.05·CostEfficiency
```

**Tiers:** 90–100 Priority · 80–89 Strong · 70–79 Qualified · < 70 Below floor (watchlist). **Only opportunities ≥ 70 are surfaced.**

**Signal amplifiers** raise the score when *independent* signals converge (confirmed sponsorship availability, a documented competitor promotion, audience growth, recent funding/launch, multiple reach confirmations, a public contact, an ICP/geo match, an open partner program). **Signal suppressors** cut it for vanity-over-substance (suspected fake followers, dead community, engagement far below size, off-ICP audience, pay-to-play "top X" lists, unverifiable reach, no promo path, cost over budget).

**Conviction** (HIGH/MEDIUM/LOW) is tracked separately — *how much to trust the score*. **The agent always prefers high-conviction opportunities over large-but-speculative ones** (sort by conviction in the report).

---

## Anti-hallucination contract (non-negotiable)

GTM-Scout **never invents** follower counts, traffic numbers, contact information, pricing, open rates, downloads, or sponsorship/guest availability. Every number traces to a verbatim quote + URL + fetch time, or it's marked **`Unverified`** and excluded from scoring. An opportunity whose core reach is only a third-party estimate is capped at the `Qualified` tier. Outreach hooks are clearly labeled generated suggestions, never facts about the target.

---

## How it works (multi-subagent dispatch)

One invocation = **one full cycle**. The orchestrator (Claude reading [`AGENT.md`](AGENT.md)) dispatches each loop as a sub-agent via Cursor's `Task` tool, mapping the mission's 10 phases onto 12 loops:

```
orchestrator
   ├─ Task: subagents/00-warm-start.md            (normalize brief, load memory, decide cold/warm/delta)
   ├─ Task: subagents/01-market-understanding.md  (Phase 1 — ICP, personas, pains, triggers)        [cold/warm]
   ├─ Task: subagents/02-competitor-intelligence.md(Phase 2 — how rivals acquire customers)          [cold/warm]
   ├─ Task: subagents/03-discovery-sweep.md        (Phases 3-8 — exhaustive channel crawl)
   ├─ Task: subagents/04-canonicalize.md           (dedupe entities → stable opportunity_id)          [cold/warm]
   ├─ Task: subagents/05-evidence-enrichment.md    (verify reach, engagement, contact, rates, rules)  [cold/warm]
   ├─ Task: subagents/06-signal-collection.md      (Phase 8 — growth/buying signals + new types)      [cold/warm]
   ├─ Task: subagents/07-scoring.md                (Phase 9 — 6 dims + effort/ROI + conviction)
   ├─ Task: subagents/08-amplifiers-suppressors.md (convergence boosts / vanity penalties)
   ├─ Task: subagents/09-adversarial.md            (audience real? ICP fit? reachable? + convergence) [cold/warm]
   ├─ Task: subagents/10-persist.md                (Phase 10 — rank, GTM plan, budget, persist memory)
   └─ Task: subagents/11-html-build.md             (fill template → output/gtm-scout-<brief_id>.html)
```

In **delta** mode the heavy loops (1, 2, 4, 5, 6, 9) are skipped for speed; Loop 9 is re-inserted only if a rescore crosses a tier/conviction boundary.

---

## Exhaustive source coverage

The agent attempts **every** channel class each cold/warm cycle (no silent skips; failures logged and retried next run):

- **Market & competitor intel:** category research · G2/Capterra/TrustRadius · competitor `/affiliates` & `/partners` pages · Similarweb traffic estimates · Meta/Google/TikTok ad libraries
- **Influencers:** YouTube · TikTok · Instagram · X · LinkedIn · Social Blade (cross-check)
- **Communities:** Reddit (public JSON API) · Discord (Disboard) · Slack · Facebook Groups · Telegram · forums / Indie Hackers
- **Agencies / partnerships / affiliates:** Clutch · DesignRush · AgencySpotter · Impact · PartnerStack · ShareASale · Zapier marketplace · industry associations
- **Sponsorship inventory:** Passionfroot · Paved · beehiiv · Substack · Listen Notes · Apple/Spotify podcasts · Meetup · Eventbrite · conference sites
- **Growth & buying signals:** TechCrunch · Crunchbase · LinkedIn jobs · Product Hunt · expansion news · community activity spikes

See the full tier tables in [`AGENT.md`](AGENT.md) and per-domain TTLs / rate limits / ToS notes in [`policies/source_ttl.json`](policies/source_ttl.json). The agent honors robots.txt and **never scrapes behind login**.

---

## Persistent memory (why re-runs improve)

Lives at `gtm_scout_memory/` (sibling folder; gitignore recommended). Partitioned **per product brief**. Loop 0 reads it; Loop 10 updates it. **Never wiped except by `--reset`.**

```
gtm_scout_memory/
  state.json                                   # cycle, last_run_at, active_brief (per brief)
  briefs/<brief_id>.json                       # normalized product brief
  source_reliability.json                      # per-source precision learned across cycles (global)
  briefs_data/<brief_id>/
    icp.json                                    # ICPs, personas, pains, triggers, where-they-hang-out
    competitors.json                            # competitor acquisition-channel intel
    gtm_plan.json                               # the synthesized go-to-market plan + channel-type registry
    watchlist.json                              # sub-floor opportunities kept for re-evaluation
    opportunities/<id>.json                     # canonical record per opportunity
    aliases.json                                # alternate handles → canonical id
    evidence/<id>.jsonl                         # append-only provenance (verbatim quotes)
    score_history/<id>.jsonl                    # append-only per-cycle scores (sparklines + lifecycle)
    iteration_log/<id>.jsonl                    # append-only adversarial verdicts
  sources_cache/<sha256(url)>.json              # cached fetches + fetched_at + status (global)
  runs/<brief_id>/<ISO_TIMESTAMP>/
    checkpoints/cycle_{N}_loop_{L}.json         # per-loop audit snapshots
    diff.json                                    # what changed vs prior run
    metrics.json                                 # budget, cache hit rate, convergence, % verified
    report_data.json                             # the exact object the HTML embeds
```

Scores can rise **or** fall across runs. A creator who lands a new funding-backed sponsor and growing audience climbs; one whose followers turn out to be bought (or whose community went dead) gets suppressed and drops to the watchlist — then climbs back if the evidence later supports it. **Your logged outreach status (`contacted`, `won`, `declined`) is preserved across runs and never overwritten.**

---

## Folder layout

```
gtm-scout/
  AGENT.md                               # Orchestrator spec — start here
  README.md                              # This file
  subagents/                             # The 12 loop specs (00–11)
  templates/
    gtm_report_template.html             # Canonical dark-theme report (do not inline-render elsewhere)
  schemas/
    brief.schema.json                    # Normalized product brief
    opportunity.schema.json              # Canonical opportunity record
    evidence_record.schema.json          # One source confirmation, with provenance + verification_status
    source_reliability.schema.json       # Per-source learned weights
    diff.schema.json                     # Cross-cycle changelog
    cache_entry.schema.json              # Cached fetch responses
    score_history.schema.json            # Per-cycle score line
  policies/
    scoring.json                         # 6-dim weights, components, effort/ROI bands, amplifiers/suppressors, conviction, budget splits
    convergence.json                     # Run-mode thresholds, convergence rules, search budgets
    source_ttl.json                      # Per-domain TTL, rate limits, ToS notes, paywall/login fallback
    channels.json                        # Opportunity-type registry + influencer tiers + dynamic-discovery rules
```

---

## Customization

| To change... | Edit... |
|--------------|---------|
| Which channels/sources to crawl | [`AGENT.md`](AGENT.md) source tier tables + [`policies/source_ttl.json`](policies/source_ttl.json) |
| The scoring formula / dimension components | [`policies/scoring.json`](policies/scoring.json) → `opportunity_weights` / `dimension_components` |
| Amplifier / suppressor caps | [`policies/scoring.json`](policies/scoring.json) → `amplifiers` / `suppressors` |
| The score floor (default 70), convergence, passes, budgets | [`policies/convergence.json`](policies/convergence.json) |
| Default budget splits per objective | [`policies/scoring.json`](policies/scoring.json) → `budget_allocation` |
| Opportunity types / report tabs, influencer tiers | [`policies/channels.json`](policies/channels.json) |
| Report look-and-feel | [`templates/gtm_report_template.html`](templates/gtm_report_template.html) (CSS/JS only — never the placeholder tokens) |

---

## Scheduling (optional)

Wrap the Cursor CLI for periodic refreshes:

```bash
# Full warm scan for a product every Monday 6 AM
0 6 * * 1 cd /Users/kg010808/Downloads/agents && cursor-agent -p "Execute gtm-scout/AGENT.md brief=ai-stock-signals mode=warm" >> ~/logs/gtm.log 2>&1

# Quick delta refresh (new buying signals + new entrants) every day
0 7 * * * cd /Users/kg010808/Downloads/agents && cursor-agent -p "Execute gtm-scout/AGENT.md brief=ai-stock-signals mode=delta" >> ~/logs/gtm.log 2>&1
```

---

## Troubleshooting

**"No prior memory"** — First run for this product = cold start. Normal.

**"Skipped most loops"** — You're in delta mode (last run < 3 days). Force a full pass with `mode=warm` or `mode=cold`.

**"Report renders blank"** — Open the browser console. Almost always a malformed `__GTM_DATA__` substitution. Check `gtm_scout_memory/runs/<brief_id>/<ts>/checkpoints/cycle_N_loop_11.json` for errors.

**"Too many Unverified fields"** — Many platforms hide counts behind login. That's expected and honest; the agent will not fabricate. Verified opportunities still rank above unverified ones.

**"Search budget exhausted"** — Raise `per_cycle_total_cap` in [`policies/convergence.json`](policies/convergence.json) or accept a partial cycle (the report still ships).

---

## License & ToS

For **personal research and GTM planning**. Crawled sources have their own Terms of Service (see per-domain notes in [`policies/source_ttl.json`](policies/source_ttl.json)). The agent honors robots.txt, rate limits, and paywalls, and never scrapes behind login. It is a planning aid — it does not contact anyone or spend money. The decisions (and the outreach) are yours.
