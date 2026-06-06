# Sub-agent: Loop 5 — Replacement, Gap Analysis & Coverage Matrix

**Phase:** `replacement` · **Loop ID:** 5 · **Skipped in delta mode.**

## Purpose

Apply [STABILITY RULE](../AGENT.md#stability-rule) precedence (Lane A integrity first, Lane B competitive second), perform gap analysis against the coverage matrix, and queue targeted sweeps for the next cycle.

## Inputs

- Loop 4 checkpoint and `challenged.jsonl`
- Loop 4 verdicts and adversarial logs
- `coverage_matrix.json` (existing baseline)
- [`policies/categories.json`](../policies/categories.json) — live category registry + dynamic-discovery rules
- Per-category quotas from the registry (seed defaults in [`policies/categories.json`](../policies/categories.json); also summarized in [`AGENT.md`](../AGENT.md#category-quotas))

## Order of operations (strict)

### Step 1: Lane A — Integrity (mandatory)

For each question with verdict `FLAG_REMOVE` from Loop 4:

- Remove from current list.
- Emit a `REMOVED` entry in `runs/<ts>/diff.json` with `lane: "A_integrity"`, `evidence_ids` from the adversarial log, and `rationale` quoting the strongest counter-evidence.
- Stability rules do **not** block this. Cap rules do **not** block this.

For `FLAG_RENAME`:

- Update `title` and (if needed) `question_id` slug. Old slug becomes an alias in `aliases.json`. Emit `RENAMED` entry.

For `FLAG_MERGE`:

- Merge the lower-evidence question into the higher-evidence one. Redirect evidence and aliases. Emit `MERGED` entry.

### Step 2: Lane B — Competitive (optional, max 1 per category per cycle)

After Lane A, if a category still has budget under the **combined cap of 5**:

- Identify the **lowest-scoring question** in the category.
- Identify the highest-scoring **eligible candidate not currently in the list** for that category.
- If `candidate.freq >= weakest.freq + 10` AND `candidate.adversarial_passes >= 1` AND `candidate.independent_source_count >= 2`, perform the swap. Emit `REMOVED` + `ADDED` entries with `lane: "B_competitive"`.
- Otherwise, no Lane B swap this cycle.

### Step 3: Gap analysis (rebuild coverage_matrix)

Recompute `coverage_matrix.json` from the post-Lane-A/B list:

```
for each company in policies/source_ttl.json companies + AGENT.md Tier 5 list:
    for each category in the live registry (categories.json):
        cell.question_count = count of questions where company appears in question.companies
        cell.evidence_count = sum of evidence records pointing at this (company, category)
        cell.is_gap = (question_count < min_threshold_per_cell)  # default 2
```

Then for every gap cell, build pre-suggested search queries (these go straight into `coverage_matrix.gaps` for next cycle's Loop 1):

```
"[COMPANY] [CATEGORY-friendly-name] interview questions [Y]"
"[COMPANY] [CATEGORY-friendly-name] interview questions [Y-1]"
"site:1point3acres.com [COMPANY] [CATEGORY-friendly-name]"
"site:glassdoor.com [COMPANY] [CATEGORY-friendly-name]"
```

### Step 4: Subcategory gap check (within categories)

For SWE Coding specifically, verify all 16+ DSA subcategories have ≥1 question. For System Design, verify the canonical 30-topic list. For AI/ML, verify emerging topics (Agentic AI, MoE, RAG pipelines) are represented if eligible candidates exist.

If a subcategory is empty AND a candidate scoring ≥45 exists for it → promote that candidate (counts as `gap_fill` lane, NOT subject to the +10 Lane B margin). Emit `ADDED` entry with `lane: "gap_fill"`.

### Step 4b: Dynamic category discovery (optional, max 1 new category per cycle)

The six seed categories are not a closed set. If the research surfaces a coherent cluster of frequently-asked questions that does **not** fit any existing category, propose a **new category** rather than discarding or force-fitting those questions. This is gated to prevent taxonomy churn — see [`policies/categories.json`](../policies/categories.json) `dynamic_discovery`.

**Detection:**

```
1. Collect eligible candidates (independent_source_count >= 2, adversarial_passes >= 1,
   recent_confirmation == true) that were NOT assigned to any seed category by Loop 1b,
   OR were force-fit into a seed category with low subcategory-match confidence.
2. Cluster them by theme (shared concepts / subcategory_guess / semantic similarity).
   Examples of clusters that have historically NOT fit the seeds: OS & concurrency,
   SQL / data manipulation, frontend/web platform, recruiter/hiring-manager screen,
   language-specific (Python/Java/Go) trivia.
3. For the largest coherent cluster, check dynamic_discovery.promote_when:
   - cluster size >= min_clustered_questions (default 8)
   - every question independent_source_count >= 2 AND adversarial_passes >= 1
   - cluster does NOT map to an existing category's subcategory vocabulary
   - cluster has recent confirmation
```

**Promotion (if criteria met, and `max_new_categories_per_cycle` not yet hit this cycle):**

- Mint a new category: `id` (slug), `label`, `icon`, `domain`, `kind` (coding | system-design | behavioral | conceptual), `default_quota` (default 15), `scoring` (default `standard`; use `behavioral` for soft-skill clusters).
- Stage it for the live registry (Loop 8 writes `interview_questions_knowledge/categories.json`).
- Reassign the clustered questions to the new category. Emit a `CATEGORY_ADDED` entry in `runs/<ts>/diff.json` with the cluster's `question_id`s and the rationale.
- The new category does NOT lock until it survives `dynamic_discovery.stability.must_persist_cycles_before_locking` (default 1) cycle.

**Demotion:**

- A previously discovered (non-seed) category whose live question count is below `min_clustered_questions` for `demote_after_consecutive_cycles_below_min` (default 2) consecutive cycles is removed. Its questions are reassigned to the nearest seed category or moved to `emerging.json`. Emit a `CATEGORY_REMOVED` diff entry.
- Seed categories are NEVER demoted.

**Constraints:** at most **one** new category per cycle. Discovery never blocks the run — if no cluster qualifies, do nothing (this is the common case).

### Step 5: Combined cap enforcement

| Lane | Max changes per category per cycle |
|------|-------|
| A_integrity | unlimited (overrides cap) |
| B_competitive | 1 |
| gap_fill | 3 |
| **Combined cap** | **5** |

If the combined cap would be exceeded, drop the lowest-priority `gap_fill` actions first, then `B_competitive`. Lane A is never dropped.

### Step 6: Promote / demote between EMERGING and main list

- Questions in `emerging.json` whose freq crossed the 60-point threshold this cycle AND have `independent_source_count >= 3` AND `adversarial_passes >= 1` → graduate to main list (counts as `gap_fill`).
- Questions in main list whose freq dropped below 45 → demote to `emerging.json`.

## Output checkpoint

Write to `runs/<ts>/checkpoints/cycle_{N}_loop_5.json`:

```json
{
  "cycle": 7,
  "loop": 5,
  "phase": "replacement",
  "completed_at": "<iso>",
  "state": {
    "lane_a_removals": 2,
    "lane_b_swaps": 1,
    "gap_fill_additions": 4,
    "merges": 1,
    "renames": 1,
    "promoted_from_emerging": 3,
    "demoted_to_emerging": 2,
    "categories_added": [],
    "categories_removed": [],
    "category_registry_path": "runs/<ts>/categories_new.json",
    "final_list_path": "runs/<ts>/final_list.jsonl",
    "coverage_matrix_path": "runs/<ts>/coverage_matrix_new.json",
    "gaps_count": 18,
    "next_cycle_sweep_queue_path": "runs/<ts>/next_sweep_queue.json"
  },
  "skipped_sources": [],
  "errors": [],
  "searches_used": 0
}
```

## Outputs to knowledge base

- Loop 5 stages all changes — actual writes to `questions/`, `coverage_matrix.json`, `emerging.json`, and `aliases.json` happen in Loop 8 once company tags and trends are finalized.

## Invariants for downstream loops

- Final list satisfies category quotas OR an `errors` entry explains the deficit.
- Combined cap of 5 changes per category is respected.
- Every entry in the final list has `independent_source_count >= 2` (Lane A removals already enforced).
- `coverage_matrix_new.json` is a complete grid (no missing cells).
- At most one `CATEGORY_ADDED` per cycle; every question's `category` exists in `categories_new.json`.

## Failure handling

- **Quota cannot be met after gap_fill** (e.g. SWE Coding has only 38 valid candidates instead of 40): leave 2 slots as `Research In Progress`. Emit a `FLAGGED` diff entry. Do NOT pad with low-conviction questions.
- **Lane A removal would drop category below quota**: still remove (integrity wins). Slot marked `Research In Progress`.
- **Coverage matrix has cells with deficit > 5**: still build search queries; Loop 1 next cycle will allocate budget proportionally.
