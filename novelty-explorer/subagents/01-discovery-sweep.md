# Sub-agent: Loop 1 — Discovery Sweep (Exhaustive, All Five Source Tiers)

**Phase:** `discovery` · **Loop ID:** 1 · **Runs in every mode** (full sweep in cold/warm; light refresh + new-entrant scan in delta).

## Purpose

Cast the widest possible net across **all five source tiers** to discover candidate opportunities and gather raw evidence. This is where thoroughness lives: **every source class MUST be attempted, no silent skips.** The output is a pool of candidate opportunities, each with raw evidence records, ready for canonicalization (Loop 2) and enrichment (Loop 3).

## Inputs

- Loop 0 checkpoint (`run_mode`, `focus`, `T`, `Y`, prior opportunity ids, stale signal classes).
- All prior canonical opportunity records (to refresh, not just discover net-new).
- [`policies/source_ttl.json`](../policies/source_ttl.json) (TTL, rate limits, paywall fallback) and [`policies/domains.json`](../policies/domains.json) (keywords per domain).
- Search budget: **`loop_1`** from [`policies/convergence.json`](../policies/convergence.json) (default 400; delta 300 cap shared).

## Tool contract

| Operation | Primary | Fallback |
|-----------|---------|----------|
| Search query (e.g. `site:arxiv.org neuromorphic 2026`) | `WebSearch` | `WebFetch` on the source index / API endpoint |
| Fetch a specific URL | `WebFetch` on the canonical URL | reader proxy `https://r.jina.ai/<url>` → archive `https://web.archive.org/web/2*/<url>` → search for a mirror |
| Structured metrics (GitHub stars, citations, downloads) | the source's API (GitHub search, Semantic Scholar Graph, Algolia HN, PatentsView, pypistats) | `WebSearch` snippet |

**Concurrency:** batch independent searches in parallel (one message, multiple `WebSearch` calls). The five tier sweeps are independent and SHOULD be issued in parallel.

**No-silent-skip rule:** every source class MUST be attempted. If a source is unreachable, write a `cache_entry` with the right `fetch_status` and add it to `skipped_sources` — never drop it quietly. If `focus=<domain>` is set, weight that domain's keywords more heavily but STILL sweep the others.

## Step 1: Build the query matrix

For each **seed domain** (and any discovered domain) in the live registry, expand its `keywords` into queries against each tier. Always append the reference year `Y` and try `Y−1`. Example for `ENERGY`:

- **Scientific:** `site:arxiv.org fusion confinement [Y]`, `site:biorxiv.org ...`, `site:nature.com fusion breakthrough [Y]`, `site:semanticscholar.org [topic]`
- **Startup:** `site:ycombinator.com/companies fusion`, `fusion startup seed series A [Y]`, `site:producthunt.com energy [Y]`
- **Investment:** `site:techcrunch.com fusion raises [Y]`, `site:sec.gov form D fusion`, `ARPA-E fusion award [Y]`, `[fusion company] strategic investment [Y]`
- **Community:** `site:github.com plasma simulation`, `site:news.ycombinator.com fusion [Y]`, `site:reddit.com/r/fusion`
- **Patent:** `site:patents.google.com fusion confinement [Y]`, `lens.org fusion`

Also run **cross-cutting discovery queries** not tied to a seed domain, to catch FRONTIER/uncategorized breakthroughs:
`"breakthrough" OR "first demonstration" OR "world record" [emerging tech] [Y]`, `most promising deep tech startups [Y]`, `[accelerator] batch [Y] companies`, `darpa OR arpa-e new program [Y]`, `most starred new github repos [Y] [domain]`.

## Step 2: Refresh existing opportunities

For every prior canonical opportunity, re-query the signals flagged stale in Loop 0 (and ALWAYS momentum + capital, which decay fastest). Honor cache TTLs in warm/delta: a cache hit consumes 0 budget. In cold mode, ignore caches.

## Step 3: New-entrant scan (delta mode focus)

In delta mode, Steps 1–2 are trimmed: refresh existing opportunities' fast-decaying signals, then spend the reserved budget on a **new-entrant scan** — only the highest-yield discovery queries (recent funding feeds, trending repos, new accelerator batches, breakthrough headlines in `Y`).

## Step 4: Capture evidence

For every candidate (new or existing), write append-only evidence records to `novelty_explorer_memory/evidence/<opportunity_id>.jsonl` per [`schemas/evidence_record.schema.json`](../schemas/evidence_record.schema.json). For brand-new candidates whose `opportunity_id` isn't assigned yet, stage them in the run scratch (`runs/<T>/discovery_pool.json`) keyed by a provisional slug; Loop 2 assigns canonical ids.

Each evidence record MUST include: `signal_class`, `feeds_dimension`, `source_domain`, `source_tier`, `url`, `url_hash` (sha256 of url), `fetched_at`, `exact_quote` (verbatim), and a structured `data_point` where possible (e.g. `{metric:"github_stars", value:8200, prior_value:3100, as_of:"2026-05-01"}`). Never fabricate a quote or a number.

## Step 5: Cache everything

Write a `cache_entry` (sha256(url) filename) for every fetch with `expires_at = fetched_at + ttl_hours`. Store only a trimmed `content_excerpt` / abstract — never full copyrighted articles.

## Output checkpoint

Write to `runs/<T>/checkpoints/cycle_{N}_loop_1.json`:

```json
{
  "cycle": 7,
  "loop": 1,
  "phase": "discovery",
  "completed_at": "<iso>",
  "state": {
    "discovery_pool_path": "runs/<T>/discovery_pool.json",
    "candidates_total": 312,
    "candidates_new": 47,
    "candidates_refreshed": 41,
    "evidence_records_written": 638,
    "by_tier": { "scientific": 180, "startup": 96, "investment": 88, "community": 210, "patent": 64 },
    "sources_attempted": 41,
    "cache_hits": 121,
    "cache_misses": 410
  },
  "skipped_sources": [
    { "source": "theinformation.com", "reason": "paywall, headline-only", "fetch_status": "paywalled" }
  ],
  "errors": [],
  "searches_used": 392
}
```

## Outputs to memory

- `evidence/<opportunity_id>.jsonl` — appended (existing opportunities).
- `sources_cache/<hash>.json` — written/updated.
- `runs/<T>/discovery_pool.json` — staged new candidates with provisional slugs (consumed by Loop 2).

## Invariants

- Every source class in the tier tables was attempted; failures are in `skipped_sources`.
- Every candidate has ≥1 evidence record with a verbatim quote.
- No fabricated quotes, numbers, funding rounds, or investor names.

## Failure handling

- **Source unreachable / paywalled:** apply the `policies/source_ttl.json:global_rules.paywall_fallback_chain`; if still blocked, record headline-only with the right `fetch_status` and log to `skipped_sources`. Do NOT drop it silently.
- **3+ Tier 1 (scientific) classes fail:** continue but set `data_availability:"DEGRADED"` in the run state for Loop 8 to propagate.
- **Budget exhausted mid-sweep:** stop discovery, write the checkpoint with `searches_used = budget`, and let the orchestrator skip to scoring with whatever was gathered.
