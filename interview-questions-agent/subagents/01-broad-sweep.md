# Sub-agent: Loop 1 — Broad Sweep

**Phase:** `broad_sweep` · **Loop ID:** 1 · **Skipped in delta mode.**

## Purpose

Cast the widest possible net. Gather raw question candidates from every source listed in [`AGENT.md`](../AGENT.md#exhaustive-source-list). **Do NOT filter, score, or rank yet.** Just collect.

## Inputs

- Loop 0 checkpoint (in particular: `gap_queue`, `Y`, `search_budget_total`)
- Baseline questions in memory (warm start)
- [`policies/source_ttl.json`](../policies/source_ttl.json) — cache TTL + rate limits per domain
- [`policies/convergence.json`](../policies/convergence.json) — search budget for this loop (default 600 searches)

## What this loop does

### Step 1: Cache-first fetch contract

For every search/fetch:

1. Compute `url_hash = sha256(url)`.
2. Check `interview_questions_knowledge/sources_cache/<url_hash>.json`.
3. If `now < cache_entry.expires_at` AND `cache_entry.fetch_status == "ok"` → **cache hit**: use cached `content_excerpts`. **Consumes 0 search budget.**
4. Otherwise → fetch, respecting `policies/source_ttl.json` (rate limit, robots.txt, user-agent). Persist a new `cache_entry`. **Consumes 1 search budget.**
5. On 4xx/5xx/timeout → write a `cache_entry` with the appropriate `fetch_status` so we don't retry-storm. Honor `circuit_breaker` from policy.

### Step 2: Sweep order

Run sweeps in this order, short-circuiting if `searches_used >= per_loop_budget * 0.95`:

1. **Gap-queue priority sweeps** (cells flagged by Loop 5 in the prior cycle). Use the `search_queries` pre-built in `coverage_matrix.gaps`. If Loop 5 discovered a new category last cycle, its gap queries appear here.
2. **Tier 1 sources** for each live category (the 6 seeds plus any discovered category).
3. **Tier 2 sources** for each live category.
4. **Tier 3 sources** for AI/ML categories only.
5. **Tier 4 sources** for each live category.
6. **Tier 5 company-specific deep dives** for the top 10 companies by interview volume (Google, Amazon, Meta, Microsoft, Apple, Netflix, Stripe, OpenAI, Anthropic, Databricks).

### Step 3: Required subcategory coverage per category

Every cycle must attempt to surface candidates for these subcategories. The check happens in Loop 5 (gap analysis), but Loop 1 plans queries to hit each one.

**SWE Coding (16+ DSA subcategories):**
Arrays, Strings, Hash Maps, Linked Lists, Trees (Binary, BST, N-ary), Graphs (BFS, DFS, Topological Sort, Union-Find, Dijkstra), Dynamic Programming (1D, 2D, String DP), Stacks & Queues (Monotonic Stack), Binary Search, Heaps / Priority Queues, Backtracking, Tries, Sliding Window, Two Pointers, Intervals & Greedy, Design / Implementation (LRU Cache, Trie, etc.)

**SWE System Design:**
URL shortener, rate limiter, social feed (Twitter), chat system (WhatsApp/Slack), notification system, video streaming (YouTube/Netflix), photo sharing (Instagram), ride-hailing (Uber), distributed cache (Redis), file storage (Drive/Dropbox), web crawler, e-commerce, search autocomplete, payment system, key-value store, Google Maps, CDN, message queue (Kafka), recommendation system, ticket booking, metrics/monitoring, code deployment, collaborative editor, proximity service (Yelp), ad serving, distributed lock, leaderboard, hotel reservation, task scheduler, stock exchange, distributed ID generator, API gateway, event-driven architecture, web-scale search engine.

**SWE Behavioral:**
Tell me about yourself, disagreement/conflict, failure/mistake, complex project, decision with incomplete info, why this company, ownership/above and beyond, prioritization, persuasion/influence, difficult coworker, critical feedback, tech debt vs shipping, mentoring, process improvement, production incident, learning quickly, results under pressure, leadership, customer focus, simplification, status quo challenge, ambiguity, trade-offs, cross-team work, strengths, career vision.

**AI/ML Coding:**
Logistic regression, K-Means, linear regression, neural network (forward + backprop), attention (self/multi-head), decision tree, KNN, AUC-ROC, softmax + cross-entropy, TF-IDF, transformer encoder, CNN, batch norm, gradient boosting, dropout, data splitting, feature engineering, matrix ops, sampling, reservoir sampling, word2vec/embedding, beam search, layer norm, positional encoding, RAG pipeline.

**AI/ML System Design:**
Recommendation, search ranking, fraud detection, news feed, ad CTR, LLM/RAG chatbot, content moderation, ML inference pipeline, spam classification, autocomplete, training infra, self-driving perception, feature store, model monitoring/drift, image/video search, agentic AI, multi-agent orchestration, vector search, LLM serving (batching, KV cache, speculative decoding), guardrails / safety filtering.

**AI/ML Conceptual:**
Bias-variance, class imbalance, overfitting/underfitting, evaluation metrics, A/B testing, transformers, RAG, data leakage, fine-tuning/LoRA, gradient descent variants, attention, LLM hallucinations, missing data, L1 vs L2, feature engineering, RLHF, model drift, RF vs GBM, deployment comparison, tokenization, prompt engineering, chain-of-thought, LLM eval frameworks, AI safety / alignment, MoE, knowledge distillation.

### Step 4: Multilingual handling

For non-English sources (e.g. 1Point3Acres Chinese content):

1. Extract `original_quote` in source language.
2. Translate to English → `translated_quote`. Use any available translation tool; if confidence < 0.7, flag the cache entry with `noise_flags: ["translation_low_confidence"]`.
3. Store BOTH quotes. Loop 4 may need to re-validate the original.

### Step 5: Raw candidate emission

For every question candidate found, emit a **raw candidate record** (NOT yet a canonical question or evidence record — that happens in Loop 1b and Loop 2):

```json
{
  "raw_id": "<ulid>",
  "category": "swe-coding",
  "raw_title": "Find two indices summing to target",
  "subcategory_guess": "Arrays & Hashing",
  "source_domain": "leetcode.com",
  "source_tier": 1,
  "url": "...",
  "url_hash": "...",
  "fetched_at": "<iso>",
  "report_year": 2025,
  "exact_quote": "Two Sum is the most-asked easy problem at Amazon (108x).",
  "translated_quote": null,
  "company": "amazon",
  "company_frequency": 108,
  "level_tag": null,
  "outbound_links": ["leetcode.com/problems/two-sum"],
  "extractor_confidence": 0.92
}
```

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_1.json`:

```json
{
  "cycle": 7,
  "loop": 1,
  "phase": "broad_sweep",
  "completed_at": "<iso>",
  "state": {
    "raw_candidates_count": 4321,
    "raw_candidates_path": "runs/<ts>/raw_candidates.jsonl",
    "by_category_count": {
      "swe-coding": 1840,
      "swe-system-design": 510,
      "swe-behavioral": 290,
      "aiml-coding": 720,
      "aiml-system-design": 380,
      "aiml-conceptual": 581
    },
    "cache_hits": 2103,
    "cache_misses": 894,
    "fetch_failures": 47,
    "gap_queue_satisfied": ["stripe/swe-system-design"]
  },
  "skipped_sources": [
    {"domain": "1point3acres.com", "reason": "login_wall", "downgrade_to_tier": 4}
  ],
  "errors": [],
  "searches_used": 894
}
```

Raw candidates are written separately to `runs/<ts>/raw_candidates.jsonl` (append-only, one record per line) so Loop 1b and Loop 2 can stream them.

## Outputs to knowledge base

- **`sources_cache/`** — new and refreshed cache entries.

## Invariants for downstream loops

- Every raw candidate has a non-null `url_hash` that resolves to a `cache_entry` in `sources_cache/`.
- Every candidate has an `exact_quote` and (if non-English) a `translated_quote`.
- `cache_hits + cache_misses == total fetches attempted`.

## Failure handling

- **Rate limit (HTTP 429)**: pause domain for 60s (per `policies/source_ttl.json`), then resume.
- **Repeated 5xx**: trip circuit breaker; cache the failure; try again next cycle.
- **Login wall on Tier 1 source**: log in `skipped_sources` with `downgrade_to_tier: 4` so Loop 3 weights accordingly for this cycle. Do NOT remove the source permanently.
- **Search budget exhausted**: stop sweeping, write checkpoint with `searches_used = budget`, mark `state.budget_exhausted = true`.
