# Sub-agent: Loop 3 — Evidence Enrichment (Deep-Dive per Source Class)

**Phase:** `enrichment` · **Loop ID:** 3 · **Runs in cold/warm only.**

## Purpose

Take the canonical opportunity set and go **deep** on each one to gather the structured data points the five scoring dimensions need. Loop 1 cast a wide net; Loop 3 fills the gaps so every dimension has enough independent evidence to score (target ≥ `min_sources` = 3 independent sources per opportunity, spread across signal classes).

## Inputs

- `runs/<T>/canonical_set.json` (Loop 2).
- Existing `evidence/<id>.jsonl`, `source_reliability.json`.
- [`policies/source_ttl.json`](../policies/source_ttl.json), [`policies/weights.json`](../policies/weights.json) (so the enricher knows which components each dimension needs).
- Search budget: **`loop_3`** (default 250).

## Step 1: Identify evidence gaps per opportunity

For each opportunity, check which scoring components (from `policies/weights.json:dimension_components`) lack a structured data point. Prioritize gaps on opportunities currently near a tier boundary (the highest-value-of-information searches). Spend more budget on candidates with sparse evidence; spend little on already well-covered names.

## Step 2: Targeted deep-dive queries by signal class

**Scientific (novelty, feasibility):** citation count + 12-month citation growth (Semantic Scholar Graph API), influential-citation count, replication/independent-verification status, whether results are peer-reviewed vs preprint, demonstrated results (benchmarks, world records).

**Startup / Investment (capital, market):** total known funding, most recent round (stage, amount, date), lead investors (→ map to `investor_quality_tiers`), repeat participation across rounds, strategic/corporate investors, government grants (SBIR/ARPA-E), customer logos / pilots, TAM estimates from credible sources.

**Community (momentum, feasibility):** GitHub stars + 90-day star/contributor growth, HN front-page hits + comment volume, Reddit discussion frequency, package download velocity (PyPI/npm/HF), conference talk mentions, open job postings count (hiring growth).

**Patent (novelty, feasibility):** filing count + trend (last 12m vs prior), assignee, forward-citation count, patent↔paper links (Lens) as a commercialization bridge.

For every data point, prefer a **structured metric with a `prior_value`** so Loop 4 can compute growth rates, not just levels.

## Step 3: Crowding evidence

Gather the signals the crowding meter needs (`policies/weights.json:crowding.components`): mainstream-press volume (count of Tier-1 general-news mentions), mega-cap incumbent entry (is Google/Microsoft/NVIDIA/etc. already shipping this?), hot-take density, search saturation. Under-recognized names are the alpha; record enough to place each on the UNDER-RECOGNIZED ↔ CROWDED axis.

## Step 4: Write enriched evidence

Append new evidence records (same schema as Loop 1). Mark `confidence` honestly — a vague snippet is < 0.7 and will be excluded from independent-source counting. Honor caches and the no-silent-skip rule.

## Output checkpoint

```json
{
  "cycle": 7,
  "loop": 3,
  "phase": "enrichment",
  "completed_at": "<iso>",
  "state": {
    "opportunities_enriched": 268,
    "evidence_records_added": 511,
    "opportunities_below_min_sources": 22,
    "structured_datapoints": { "citation_growth": 140, "github_growth": 96, "funding_rounds": 110, "patent_trend": 71, "tam_estimates": 58 }
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 243
}
```

## Outputs to memory

- `evidence/<id>.jsonl` — appended.
- `sources_cache/<hash>.json` — written/updated.
- `runs/<T>/enriched_set.json` — opportunity set with attached evidence summaries (consumed by Loop 4).

## Invariants

- Every opportunity targeted for the leaderboard has had its evidence gaps addressed (or `data_unavailable` flagged on the dimension that still can't be filled).
- All numbers trace to a verbatim `exact_quote` in an evidence record.

## Failure handling

- **Still < `min_sources` after enrichment:** keep the opportunity but flag `data_availability:"PARTIAL"`; Loop 4 caps under-evidenced dimensions at 50 and Loop 8 caps the tier.
- **Conflicting funding numbers across sources:** record both with their sources; Loop 4 uses the most authoritative (SEC Form D > TechCrunch > rumor) and notes the conflict in `risks`.
