# Sub-agent: Loop 1 — Market Understanding (Phase 1)

**Phase:** `market_understanding` · **Loop ID:** 1 · **Runs in cold/warm only** (delta reuses the prior ICP).

## Purpose

Build the foundation every later loop scores against: **who the customer is, what they want, what triggers a purchase, and where they spend time.** Without a sharp ICP, "relevance" and "audience match" (55% of the score combined) are guesswork. This loop produces the `icp.json` artifact.

## Inputs

- Loop 0 checkpoint (`brief_id`, `run_mode`, `T`, `Y`, brief summary).
- The normalized brief (`briefs/<brief_id>.json`).
- Prior `icp.json` (warm runs: refine, don't rebuild).
- [`policies/source_ttl.json`](../policies/source_ttl.json) (Tier 1 market sources) and [`policies/channels.json`](../policies/channels.json).
- Search budget: **`loop_1`** from [`policies/convergence.json`](../policies/convergence.json) (default 120).

## Tool contract

| Operation | Primary | Fallback |
|-----------|---------|----------|
| Category/competitor research | `WebSearch` | `WebFetch` on a category guide / review site |
| Read a review/listing page | `WebFetch` on the canonical URL | reader proxy → archive → search snippet |

Batch independent searches in parallel. Honor robots.txt, rate limits, and the no-login rule.

## Step 1: Analyze the market

Using the brief + Tier 1 sources (category research, G2/Capterra/TrustRadius, competitor sites), determine:

- **Product category** — the precise category the product competes in (not just "fintech" but "AI stock-signal apps for retail traders").
- **Customer segments** — the 2–4 distinct buyer groups (e.g. "active day traders", "buy-and-hold beginners", "finance-curious millennials").
- **Existing acquisition channels** — how products in this category typically get customers (observed, not assumed).
- **Industry trends** — what's shifting in the category right now (`Y`/`Y−1`).

## Step 2: Generate ICPs, personas, pains, triggers

For each customer segment, produce a structured **Ideal Customer Profile** with:

- **Persona** — role/identity, demographics (only if researchable — else "inferred"), B2B vs B2C, geo.
- **Pain points** — the problems the product solves, in the customer's own language (pull verbatim phrasing from reviews/communities where possible).
- **Purchasing triggers** — events/moments that make them buy (e.g. "a losing trade", "market volatility spike", "a friend's referral").
- **Where they spend time** — the specific platforms, subreddits, YouTube niches, newsletters, podcasts, and communities this segment frequents. **This is the seed list Loops 3–5 expand and verify.** Capture concrete names/handles wherever the research surfaces them, each with an evidence record.

Mark anything you couldn't verify from a source as **inferred** (do not present inference as fact).

## Step 3: Capture evidence

For every concrete claim that will feed scoring (e.g. "retail traders concentrate in r/stocks and r/options", "the category's buyers skew US 25–40"), write an evidence record per [`schemas/evidence_record.schema.json`](../schemas/evidence_record.schema.json) with `signal_class: "market"`, a verbatim `exact_quote`, and `feeds_dimension` (usually `relevance` / `audience_match`). Cache every fetch.

## Output checkpoint

Write to `runs/<brief_id>/<T>/checkpoints/cycle_{N}_loop_1.json`:

```json
{
  "cycle": 3,
  "loop": 1,
  "phase": "market_understanding",
  "completed_at": "<iso>",
  "state": {
    "icp_path": "briefs_data/ai-stock-signals/icp.json",
    "category": "AI stock-signal apps for retail traders",
    "segments": ["active day traders", "buy-and-hold beginners", "finance-curious millennials"],
    "personas_built": 3,
    "pain_points_count": 11,
    "triggers_count": 6,
    "seed_channels_found": { "communities": 14, "influencer_niches": 5, "newsletters": 6, "podcasts": 4 },
    "evidence_records_written": 38
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 112
}
```

## Outputs to memory

- `briefs_data/<brief_id>/icp.json` — the ICP/persona/pains/triggers/where-they-hang-out artifact (staged for Loop 10 to persist canonically; written here so Loops 2–7 can read it).
- `evidence/<provisional>.jsonl` — market evidence (relocated to canonical ids in Loop 4).
- `sources_cache/<hash>.json` — written/updated.

## Invariants

- `icp.json` exists with ≥1 ICP, each with persona + pains + triggers + where-they-spend-time.
- Every non-obvious claim has an evidence record OR is explicitly marked `inferred`.
- The seed channel list is concrete (named handles/communities), not generic ("use Reddit").

## Failure handling

- **Sparse category data:** proceed with what's verifiable; mark thin ICPs `data_availability: PARTIAL` so later loops widen discovery rather than over-trusting a guess.
- **Conflicting segment definitions across sources:** keep the best-evidenced segmentation; note the alternative in the ICP.
- **Budget exhausted:** finalize the ICP from what was gathered; downstream loops still function with a PARTIAL ICP.
