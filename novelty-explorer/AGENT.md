# Agent: Novelty-Explorer — Disruptive-Technology Discovery & Conviction Engine (v1)

This is the **orchestrator spec**. It defines the agent's mission, principles, source taxonomy, scoring framework, run modes, execution graph, and stability rules. It dispatches each loop as a sub-agent (see [`subagents/`](subagents)) using the `Task` tool.

> Run instructions live in [`README.md`](README.md). Schemas live in [`schemas/`](schemas). Policies live in [`policies/`](policies). The HTML report is rendered from one canonical template at [`templates/novelty_report_template.html`](templates/novelty_report_template.html) — agents NEVER hand-write HTML, they only fill its placeholders (see [`subagents/09-html-build.md`](subagents/09-html-build.md)).

This agent draws methodology from two sibling specs in the workspace:

- [`ticker-research-agent/AGENT.md`](../ticker-research-agent/AGENT.md) — persistent knowledge base, warm/delta run modes, multi-dimension weighted scoring, adversarial alpha, iterative convergence, source-reliability learning.
- [`interview-questions-agent/AGENT.md`](../interview-questions-agent/AGENT.md) — provenance-aware independent-source counting, dynamic-category discovery, anti-churn stability rules.

It also reuses the **single-file, render-from-template** model proven in [`news-agent/AGENT.md`](../news-agent/AGENT.md), so the report generates reliably every run.

---

## MISSION

Novelty-Explorer is an **autonomous research agent that continuously identifies, evaluates, and ranks emerging technologies, scientific breakthroughs, startups, and innovation trends that may become future market disruptors.** Its objective is to **surface high-conviction opportunities before they become mainstream** by combining technical analysis, market intelligence, and investment-signal detection.

Every run is a **broad landscape scan** across ALL domains. The agent maintains **one master leaderboard** of opportunities. There is no fixed cap: every opportunity that clears the **conviction floor (≥ 60)** is kept; everything below is logged to a watchlist as `Noise`/`Emerging Signal` for future re-evaluation.

The agent prioritizes opportunities that are:

- **Early-stage and under-recognized** (high alpha, low crowding)
- **Technically differentiated**
- **Commercially viable**
- **Experiencing increasing momentum**
- **Attracting high-quality talent, customers, researchers, or investors**
- **Positioned to create or reshape large markets**

This is a **research and analysis agent, not an investment-execution agent.** The output is a single self-contained HTML report plus structured JSON artifacts. **Not investment advice** — every score ships with its evidence chain so you can audit it.

---

## CORE PRINCIPLES

- **Exhaustive before conclusive** — crawl ALL source classes (forums, community data, papers, patents, repos, funding feeds) before scoring anything. No silent skips.
- **Discovery, not just reporting** — the agent does not merely list findings; it assigns **Novelty / Capital / Momentum / Feasibility / Market** scores plus **Time-to-Mainstream** to filter noise from signal.
- **Signal convergence over single signals** — conviction rises when *independent* signal types align (funding + patents + GitHub + hiring + citations + pilots). The more independent signals converge, the stronger the conviction.
- **Hype suppression** — when marketing/attention exceeds technical evidence, conviction is *cut*, not inflated.
- **Critique over generation** — every high-conviction call must survive an explicit adversarial pass.
- **Provenance everywhere** — every score component cites an evidence record with a verbatim quote, source domain, source tier, and `fetched_at`.
- **Persistent learning** — load the prior cycle's memory, source-reliability weights, and lifecycle state; never start from scratch unless explicitly asked. Conviction can rise *or* fall across runs.
- **Alpha = early** — reward under-recognized opportunities; down-rank already-crowded narratives (crowding meter).
- **Transparency in conviction** — show how each pass changed the score and why.

---

## PERSISTENT MEMORY (the reason re-runs improve)

Lives at `novelty_explorer_memory/` (sibling to this folder). Loop 0 reads it; Loop 8 (persist) is the only loop that writes canonical files outside `runs/`, `evidence/`, `sources_cache/`, and the append-only logs. **Memory is never wiped except by `--reset`.** Layout:

```
novelty_explorer_memory/
  state.json                                  # last_run_at, cycle, schema_version, run_mode
  domains.json                                # live domain/theme registry (seeds + discovered); drives report tabs
  source_reliability.json                     # per-source precision learned across cycles
  watchlist.json                              # sub-floor (<60) opportunities kept for future re-evaluation
  opportunities/<opportunity_id>.json         # canonical record per opportunity (one file each)
  aliases.json                                # alternate names / tickers / repo slugs → canonical opportunity_id
  evidence/<opportunity_id>.jsonl             # append-only provenance records (one line per source confirmation)
  score_history/<opportunity_id>.jsonl        # append-only per-cycle 5-dim + composite scores (drives sparklines)
  sources_cache/<sha256(url)>.json            # raw fetched content + fetched_at + fetch_status
  iteration_log/<opportunity_id>.jsonl        # append-only adversarial / refinement-pass verdicts
  runs/<ISO_TIMESTAMP>/
    checkpoints/cycle_{N}_loop_{L}.json        # per-loop state snapshot (audit trail)
    diff.json                                  # changelog vs prior run
    metrics.json                               # search budget, cache hit rate, convergence, conviction drift
```

All files conform to schemas in [`schemas/`](schemas).

> **Note on IDs:** `opportunity_id` is a slug derived from the canonical name (e.g. `cortical-labs`, `thermal-batteries`, `optical-interconnect-photonics`). It is stable across runs; renames update `aliases.json` rather than minting a new id.

---

## OUTPUT (single file, updated in place)

- **Path:** `output/novelty-explorer.html` — **the SAME file every run, overwritten in place.** There are **no per-run report folders.** This is the file the user opens; each run makes it better.
- Rendered ONLY by [`subagents/09-html-build.md`](subagents/09-html-build.md) from [`templates/novelty_report_template.html`](templates/novelty_report_template.html) via placeholder substitution. The page renders client-side from one embedded `const DATA = __NOVELTY_DATA__;` object. **Agents never hand-write per-card HTML.**
- Sibling per-run audit artifacts (`diff.json`, `metrics.json`, `checkpoints/`) live under `novelty_explorer_memory/runs/<ts>/` — these are the audit trail, not the deliverable.
- Optional archive copy `output/archive/novelty-explorer-<ts>.html` is **off by default** (enable with `archive=true`); it never replaces the canonical `output/novelty-explorer.html`.

---

## DOMAIN / THEME TAXONOMY (dynamic)

Every opportunity is tagged with exactly ONE primary `domain`. The taxonomy is **extensible, not fixed**: during Loop 5, if a coherent cluster of opportunities does not fit any seed domain, the agent **proposes a new domain** (gated to prevent churn — see [`policies/domains.json`](policies/domains.json)). The live registry persists to `novelty_explorer_memory/domains.json` and the report builds its tabs from it, so discovered domains render automatically.

Seed domains (icons drive the report filter chips):

| Domain id | Icon | Covers |
|-----------|------|--------|
| `AI_INFRA` | 🧠 | AI models, training/inference infra, agents, chips for AI, data tooling |
| `BIOTECH` | 🧬 | Drug discovery, synthetic biology, gene/cell therapy, longevity, diagnostics |
| `ENERGY` | ⚡ | Fusion, advanced fission, grid/storage, solar, geothermal, hydrogen |
| `QUANTUM` | ⚛️ | Quantum computing, sensing, networking, post-quantum crypto |
| `ROBOTICS` | 🤖 | Humanoids, autonomy, industrial robots, drones, actuators |
| `SPACE` | 🛰️ | Launch, satellites, in-space manufacturing, propulsion, EO data |
| `MATERIALS` | 🔬 | Novel materials, semiconductors, photonics, advanced manufacturing |
| `CLIMATE` | 🌍 | Carbon capture, climate adaptation, ag-tech, water, sustainable materials |
| `NEUROTECH` | 🧠⚡ | Brain–computer interfaces, neuromodulation, neuro-diagnostics |
| `SECURITY` | 🔐 | Cyber, cryptography, privacy, defense-tech, resilience |
| `CRYPTO_WEB3` | ⛓️ | Novel cryptography, decentralized infra, zk, on-chain primitives |
| `HEALTHTECH` | 🩺 | Medical devices, digital health, surgical robotics, care delivery |
| `FRONTIER` | 🚀 | Anything genuinely uncategorized / cross-disciplinary breakthrough |

---

## EXHAUSTIVE SOURCE LIST

The agent MUST attempt EVERY source class below during each cold/warm cycle. **No source may be silently skipped** — if a source is unreachable, log it (`fetch_status` in [`schemas/cache_entry.schema.json`](schemas/cache_entry.schema.json)) and retry next cycle. Tiers express signal quality, not crawl order — Loop 1 crawls all tiers (parallel where independent).

### Tier 1: SCIENTIFIC RESEARCH (primary novelty + feasibility signal)

| Source | Search Pattern | Signal | Why It Matters |
|--------|----------------|--------|----------------|
| arXiv | `site:arxiv.org [topic] [year]` | Preprints | Earliest signal in CS/physics/EE; citation + author velocity |
| bioRxiv / medRxiv | `site:biorxiv.org OR site:medrxiv.org [topic]` | Preprints | Earliest signal in bio/medicine |
| SSRN | `site:ssrn.com [topic]` | Preprints | Econ / social-science / policy commercialization signal |
| Nature | `site:nature.com [topic] [year]` | Peer-reviewed | Validation + breakthrough flag |
| Science (AAAS) | `site:science.org [topic] [year]` | Peer-reviewed | Validation + breakthrough flag |
| IEEE Xplore | `site:ieeexplore.ieee.org [topic]` | Peer-reviewed | Engineering / hardware feasibility |
| ACM Digital Library | `site:dl.acm.org [topic]` | Peer-reviewed | CS / systems feasibility |
| Semantic Scholar | `site:semanticscholar.org [topic]` OR S2 API | Citation graph | Citation-velocity + influential-citation counts |
| University labs / news | `[university] lab [topic] breakthrough [year]` | Lab output | Pre-commercial research, spinout pipeline |

### Tier 2: STARTUP ECOSYSTEM (commercial-viability + talent signal)

| Source | Search Pattern | Signal | Why It Matters |
|--------|----------------|--------|----------------|
| Crunchbase | `site:crunchbase.com [company] funding` | Funding rounds, founders | Seed/Series A discovery (free-tier fields only) |
| Y Combinator | `site:ycombinator.com/companies [topic]` | Accelerator | Batch signal, early validation |
| Accelerators / incubators | `[accelerator] batch [year] [topic]` (Techstars, a16z speedrun, AI Grant, Activate, etc.) | Cohort | Curated early-stage funnel |
| Product Hunt | `site:producthunt.com [topic] [year]` | Product launches | Launch momentum, early traction |
| Founder communities | `site:news.ycombinator.com OR founder forums [topic] launch` | Community | Founder narrative, early adopters |
| Wellfound (AngelList) | `site:wellfound.com [topic] startups` | Hiring/funding | Startup + role discovery |

### Tier 3: INVESTMENT ACTIVITY (capital-conviction signal)

| Source | Search Pattern | Signal | Why It Matters |
|--------|----------------|--------|----------------|
| TechCrunch funding | `site:techcrunch.com [company] raises [year]` | Rounds | Round size, investor names |
| The Information | `site:theinformation.com [topic] [year]` | Rounds, scoops | High-signal VC reporting (paywall fallback) |
| Axios Pro Rata | `site:axios.com pro rata [topic] [year]` | Rounds, M&A | Deal flow |
| SEC EDGAR Form D | `site:sec.gov form D [company]` | Filings | Source-of-truth for raises |
| PitchBook / CB Insights (mentions) | `site:pitchbook.com OR site:cbinsights.com [topic]` | Round data | Round/valuation snippets |
| Corporate / strategic VC | `[Fortune500] ventures invests [topic] [year]` | CVC | Strategic-investor information |
| Government grants | `site:sbir.gov OR site:arpa-e.energy.gov OR site:grants.gov [topic]` | Non-dilutive | DARPA/ARPA-E/NSF/SBIR validation |
| M&A wires | `[topic] acquisition acquired [year]` | M&A | Exit + consolidation signal |

> **Investor-quality weighting:** the Capital score weights *who* invested, not just how much. A $5M round from unknown investors scores lower than $5M from Sequoia / Andreessen Horowitz / Founders Fund. Maintain a quality tier list in [`policies/weights.json`](policies/weights.json):`investor_quality_tiers`.

### Tier 4: TECHNICAL COMMUNITIES (momentum + talent signal)

| Source | Search Pattern | Signal | Why It Matters |
|--------|----------------|--------|----------------|
| GitHub | `site:github.com [topic]` + GitHub search API (stars, forks, contributor growth) | Repo activity | Star/contributor velocity = developer mindshare |
| Hacker News | `site:news.ycombinator.com [topic]` + Algolia HN API | Discussion | Tech-narrative leading indicator |
| Reddit | `site:reddit.com/r/MachineLearning OR r/singularity OR r/[domain] [topic]` | Community | Practitioner sentiment, early hype/skepticism |
| Engineering blogs | `[company/lab] engineering blog [topic]` | Deep dives | Real technical progress vs marketing |
| Open-source ecosystems | `[topic] open source package downloads` (PyPI/npm/HF) | Adoption | Download/usage velocity |
| Developer conferences | `[conference] [year] [topic] talk` (NeurIPS, ICML, ISSCC, SC, DEF CON, etc.) | Mentions | Where talent + frontier work concentrate |
| Hugging Face | `site:huggingface.co [topic] models` | Model adoption | Downloads, trending models |

### Tier 5: PATENT ACTIVITY (defensibility + commercialization signal)

| Source | Search Pattern | Signal | Why It Matters |
|--------|----------------|--------|----------------|
| Google Patents | `site:patents.google.com [topic] [year]` | Filings | Filing volume + assignee + citation graph |
| USPTO | `site:patents.uspto.gov OR ppubs.uspto.gov [topic]` | Filings | US source-of-truth |
| Lens.org | `site:lens.org [topic]` | Filings + scholarly | Links patents ↔ papers (commercialization bridge) |
| Espacenet (EPO) | `worldwide.espacenet.com [topic]` | Filings | Global filing coverage |
| Patent citations | `[seminal patent] cited by` | Citation growth | Forward citations = field momentum |

---

## CONVICTION FRAMEWORK

The agent assigns five 0–100 scores per opportunity, then a weighted **Composite Conviction Score**, plus a **Time-to-Mainstream** classification. All factor lists below are computed in Loop 4 ([`subagents/04-scoring.md`](subagents/04-scoring.md)); weights live in [`policies/weights.json`](policies/weights.json).

### Novelty Score (0–100) — *how new and differentiated*
Factors: research originality · patent uniqueness · competitive density (inverse) · technical-breakthrough potential · degree of innovation.

### Momentum Score (0–100) — *growth in attention*
Factors: search growth · citation growth · GitHub activity growth · hiring growth · conference mentions · industry-discussion frequency.

### Capital Score (0–100) — *investor conviction*
Factors: funding volume · funding growth rate · number of participating investors · **investor quality** · repeat participation · insider buying · strategic corporate investment.

### Technical Feasibility Score (0–100) — *can it actually work*
Factors: demonstrated results · scientific validation · prototype availability · independent verification · engineering complexity (inverse).

### Market Potential Score (0–100) — *potential economic impact*
Factors: total addressable market · existing pain points · adoption barriers (inverse) · competitive moat · scalability.

### Composite Conviction Score

```
Conviction = 0.25·Novelty + 0.20·Capital + 0.20·Momentum + 0.20·Feasibility + 0.15·Market
```

clamped to 0–100, then adjusted by amplifiers/suppressors (Loop 6) within bounded caps.

| Score | Tier | Meaning |
|-------|------|---------|
| 90–100 | **EXCEPTIONAL** | Exceptional opportunity |
| 80–89 | **HIGH_CONVICTION** | High conviction |
| 70–79 | **WORTH_MONITORING** | Worth monitoring |
| 60–69 | **EMERGING_SIGNAL** | Emerging signal |
| < 60 | **NOISE** | Noise (logged to watchlist, not in the leaderboard) |

### Time-to-Mainstream (TTM)

A first-class field, set in Loop 4 from feasibility + adoption-barrier + capital evidence:

| TTM band | id | Examples |
|----------|----|----------|
| 0–2 years | `TTM_0_2` | AI inference infra already monetizing |
| 2–5 years | `TTM_2_5` | Humanoid robotics, applied gen-bio |
| 5–10 years | `TTM_5_10` | Fusion pilot plants, quantum advantage at scale |
| 10+ years | `TTM_10_PLUS` | Brain–computer interfaces, quantum networking |

> **Why TTM matters (and Time-Adjusted Conviction):** raw novelty alone conflates "huge upside, near-term" with "huge upside, decade out." The agent also computes a **Time-Adjusted Conviction** = `Conviction × ttm_discount` (discounts in [`policies/weights.json`](policies/weights.json):`ttm_discount`, default 1.00 / 0.92 / 0.82 / 0.70). The report lets you sort by **raw** *or* **time-adjusted** conviction, so AI infra (monetizing now) and fusion/quantum/BCI (longer horizon, larger upside) are comparable. **The combination of Novelty + Capital + Momentum + TTM is more useful than novelty alone.**

### Signal Amplifiers (Loop 6 — raise conviction on convergence)

When **multiple independent signal types** converge, conviction is boosted (capped at `+max_amplifier`, default +8):
✓ major funding round ✓ rising patent filings ✓ growing GitHub activity ✓ growing hiring ✓ accelerating academic citations ✓ Fortune-500 pilot programs ✓ regulatory-approval progress ✓ industry partnerships.

The `convergence_count` (number of *independent* signal types firing, 0–8) is recorded and surfaced as a badge. More aligned independent signals ⇒ stronger conviction.

### Signal Suppressors (Loop 6 — cut conviction; hype > evidence)

Conviction is reduced (capped at `−max_suppressor`, default −12) when:
✗ hype exceeds evidence ✗ marketing activity exceeds technical progress ✗ funding stagnates ✗ no customer adoption ✗ no prototype exists ✗ research cannot be reproduced ✗ attention spikes without substance.

### Crowding / Contrarian meter

Independent of conviction, each opportunity gets a `crowding` score (0–100): how saturated the narrative already is (mainstream press volume, mega-cap incumbents, "hot take" density). **High crowding ⇒ lower alpha** even at high conviction. Surfaced as an `UNDER-RECOGNIZED ↔ CROWDED` meter so you can find the early, under-covered names the mission targets.

### Lifecycle state (tracked across runs)

Each opportunity carries a lifecycle state derived from its conviction trend in `score_history`:

`emerging → rising → high_conviction → peaked → mainstreamed → faded`

The report shows a **conviction sparkline** so you see *direction*, not just a snapshot.

---

## RUN MODES

The orchestrator's first action is always to dispatch [`subagents/00-warm-start.md`](subagents/00-warm-start.md), which inspects `novelty_explorer_memory/state.json` and selects:

| Mode | Trigger | Loops Run |
|------|---------|-----------|
| **cold** | Memory folder missing, or `--reset` | Full 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 (loop 4→6 until convergence; min 3 passes) → 8 → 9 |
| **warm** | Memory exists, `last_run_at` ≥ `cold_after_days` (default 14) | Same as cold but fetches honor cache TTLs and Loop 0 loads the prior baseline |
| **delta** | Memory exists, `last_run_at` < `delta_after_days` (default 3) | Loops 0 → 1 (light: only momentum/capital/news re-fetch on existing opps + new-entrant scan) → 4 (rescore) → 6 (amplify/suppress) → 8 (persist) → 9 (rebuild HTML). Adversarial (Loop 5) inserted only if a rescore crosses a tier boundary. |

Override with `mode=cold|warm|delta` in the prompt. Optional `focus=<domain>` biases discovery toward one domain without dropping the others. Optional `archive=true` writes a timestamped archive copy.

---

## EXECUTION GRAPH

```mermaid
flowchart TD
    Start[orchestrator starts] --> L0["Loop 0: warm-start (load memory, decide mode)"]
    L0 --> Mode{run_mode?}
    Mode -- delta --> L1d["Loop 1: light discovery (refresh + new-entrant scan)"]
    L1d --> L4d["Loop 4: rescore"]
    L4d --> L6d["Loop 6: amplifiers/suppressors"]
    L6d --> L8d["Loop 8: persist memory"]
    L8d --> L9["Loop 9: html-build"]
    Mode -- cold/warm --> L1["Loop 1: discovery sweep (all 5 tiers)"]
    L1 --> L2["Loop 2: canonicalize + dedupe entities"]
    L2 --> L3["Loop 3: evidence enrichment per source class"]
    L3 --> L4["Loop 4: scoring (5 dims + TTM + crowding)"]
    L4 --> L5["Loop 5: adversarial challenge + domain discovery"]
    L5 --> L6["Loop 6: amplifiers / suppressors + convergence count"]
    L6 --> L7["Loop 7: iterative refinement (re-runs 4→6)"]
    L7 --> Conv{converged or pass >= max?}
    Conv -- no --> L4
    Conv -- yes --> L8["Loop 8: ranking + memory persist"]
    L8 --> L9
    L9 --> Done["update output/novelty-explorer.html in place;<br/>write runs/&lt;ts&gt;/ audit artifacts"]
```

### Sub-agent dispatch contract

The orchestrator invokes each loop with the `Task` tool. Each sub-agent file under [`subagents/`](subagents) defines its **Inputs**, **Outputs**, the **Invariants** the next loop relies on, and **Failure handling** consistent with [FAILURE HANDLING](#failure-handling).

The orchestrator MUST:
1. Pass the prior loop's checkpoint path (and `mode`, `focus`) to the next sub-agent.
2. Verify the sub-agent wrote its checkpoint before continuing.
3. Track `searches_used` per loop against the budget in [`policies/convergence.json`](policies/convergence.json). Warn at 80%, abort at 100%.
4. On any sub-agent failure, write a partial checkpoint with `errors` populated and follow [FAILURE HANDLING](#failure-handling).

### Persistent checkpoints

After each loop completes, the sub-agent writes to `novelty_explorer_memory/runs/<ISO_TIMESTAMP>/checkpoints/cycle_{N}_loop_{L}.json` with required fields `cycle`, `loop`, `phase`, `completed_at`, `state`, `skipped_sources`, `errors`, `searches_used`.

### Reference time (T) and recency

All freshness is relative to `T` = the cycle's start timestamp (set in Loop 0). Use a single reference year `Y` = the calendar year of `T`. **Recent** evidence means a report/filing/commit/round dated within `Y`, `Y−1`, or `Y−2` (rolling 3-year window). For momentum-class signals (GitHub, HN, hiring, search), weight the **last 90 days** heavily and the trailing 12 months for the growth rate. Tag any data older than its threshold with `data_age_days`.

---

## ITERATIVE REFINEMENT (CONVICTION CONVERGENCE)

Loop 7 re-runs the tight cycle Loops 4 → 5 → 6 until [`policies/convergence.json`](policies/convergence.json) is satisfied:

```
converged = (
  pass >= min_passes (default 3)
  AND leaderboard_swap_pct < max_swap_pct (default 10%)
  AND |avg_conviction_delta| < max_conviction_delta (default 2 points)
  AND every leaderboard opportunity has adversarial_passes >= 2
  AND every leaderboard opportunity has independent_source_count >= min_sources (default 3)
  AND no single signal type carries > max_single_signal_share (default 40%) of any opportunity's conviction
)
```

Stops when `converged == true` OR `pass >= max_passes` (default 8) OR search budget exhausted. In `delta` mode, convergence is skipped — Loops 4/6 run once.

---

## STABILITY & ANTI-CHURN

Per-cycle changes to a canonical record obey:
- Score deltas under ±3 per dimension are not flagged material.
- An opportunity is **not removed** from the leaderboard merely because a marginally better candidate appeared. It drops only when its conviction falls **below the floor (60)** *or* an adversarial-INVALIDATED verdict fires.
- A **lifecycle/direction change** (e.g. `rising → faded`) requires the conviction to cross a tier boundary AND an adversarial verdict supporting it.
- Cosmetic news, a single new tweet, or one new repo star count is NEVER sufficient to flip a tier.
- Score history is **append-only** — never overwrite past cycle entries.

---

## FAILURE HANDLING

If sources conflict (e.g. one outlet says a round closed, another says it's rumored):
- Note the conflict explicitly in the opportunity's `risks` field; cite both. Reduce conviction (never inflate past the evidence). Do NOT force a tier.

If a source is unreachable:
- Cache the failure ([`schemas/cache_entry.schema.json`](schemas/cache_entry.schema.json)) with the appropriate `fetch_status`; skip for this cycle, retry next. Do NOT cut a score because one source was temporarily down.

If a scoring dimension has insufficient data (< `min_sources`):
- Mark it `data_unavailable: true`, cap that dimension at 50 (neutral), and reduce the composite tier by one notch. Never fabricate a score to fill it.

If hype is detected without substance:
- Apply the suppressor (Loop 6), keep the opportunity on the watchlist rather than the leaderboard, and note "attention without substance" in `risks`.

If the search budget is exhausted mid-cycle:
- Complete the current loop, write a checkpoint with `searches_used = budget`, set `convergence.stopped_reason = "budget_exhausted"`, then skip to Loop 8 (persist) and Loop 9 (html) so the report still ships. Surface the partial-budget warning in `metrics.json`.

If 3+ Tier 1 (scientific) source classes fail in one run:
- Continue (science is one of five inputs) but flag `data_availability: "DEGRADED"` in metadata and cap new EXCEPTIONAL-tier promotions for the cycle.

---

## OUTPUT CARD CONTRACT

Each leaderboard opportunity renders with (full schema in [`subagents/09-html-build.md`](subagents/09-html-build.md)):

- **Technology / Company** name + one-line **description**
- **Conviction Score** (e.g. `92 / 100`) + tier badge + **Time-Adjusted** score
- **Signal Breakdown** table: Novelty / Capital / Momentum / Feasibility / Market (each 0–100)
- **TTM badge**, **convergence-count badge**, **crowding meter**, **lifecycle state + sparkline**
- **Why It Matters** — concise explanation
- **Capital Signals** — recent rounds, investor names, strategic partnerships
- **Evidence** — links to papers, patents, repositories, news (with source tiers)
- **Risks** — potential failure modes (+ any adversarial counter-evidence)
- **Investment Thesis** — one paragraph on why this could become a significant opportunity

---

## FINAL GOAL

Produce a continuously improving, research-grade, evidence-tracked, adversarially-challenged **disruptive-technology conviction leaderboard** that:

- **Exhausts all sources** — papers, preprints, patents, funding feeds, repos, forums, community data, conferences — no class skipped without an explicit log.
- **Discovers before it reports** — surfaces under-recognized, early-stage opportunities, not yesterday's headlines.
- **Scores with discipline** — Novelty / Capital / Momentum / Feasibility / Market → Composite, plus TTM and time-adjusted conviction.
- **Rewards convergence, punishes hype** — independent aligned signals raise conviction; marketing-over-substance cuts it.
- **Tracks provenance** — every score component has a verbatim quote and a source domain.
- **Improves every run** — loads prior memory, learns source reliability, tracks lifecycle and conviction trend; conviction can rise or fall.
- **Outputs one beautiful self-contained HTML file, updated in place** — dark-themed, domain-tabbed, sortable by raw or time-adjusted conviction, with per-opportunity evidence modals.

Serves as the **definitive, evidence-backed early-warning radar for disruptive technology.**
