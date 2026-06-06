# Sub-agent: Loop 2 — Deduplication & Clustering

**Phase:** `dedup_cluster` · **Loop ID:** 2

## Purpose

Merge duplicate stories into single clusters with multiple *independent* sources. The hard requirement: **wire-copy republication MUST NOT inflate the coverage-breadth count.** This is the core accuracy mechanism — get this wrong and everything downstream over-ranks.

## Inputs

- Loop 1 candidate list + `sweep_status` map.

## Procedure

For each candidate story:

1. **Cluster by event.** Identify stories about the same event/development across outlets and merge them into a single cluster, preserving all source URLs.
2. **Wire-copy detection (REQUIRED).** Before counting independent outlets, collapse wire-copy republications into a single source. Treat two articles as the *same* source (not independent) if any of:
   - Byline credits a wire service ("By The Associated Press", "Reuters", "AFP", "Bloomberg") — collapse all such republications into one entry attributed to the wire.
   - Body-text overlap > ~70% (same lede, same direct quotes in the same order).
   - Article notes "originally published by [Wire]" or "contributing: AP/Reuters".
   When collapsing, preserve the republishing outlets in a `republished_by` list and label the source e.g. `AP wire (republished by ABC, CBS, Yahoo News, MSN)`. Republishers count as **distribution reach**, not independent confirmation.
3. **Count independent outlets.** After wire collapse, count *independent* outlets per cluster. This is the **coverage breadth** signal Loop 3 consumes. An AP story on 8 sites is breadth = 1; AP + Reuters + NYT + BBC each with original reporting is breadth = 4.
4. **Partisan-cluster sanity check.** If all independent sources sit on one end of the spectrum (e.g. Fox + Newsmax + Daily Wire only, or MSNBC + HuffPost + Mother Jones only), flag the cluster `partisan_only` and treat coverage breadth as **half** its raw value.
5. **Identify the primary source** — the outlet with the most detailed original reporting (wire services are valid primaries).
6. **Flag single-source clusters** — move clusters with only one independent outlet to the `monitoring` list; they are excluded from the top 30 until confirmed.

## Output

**30–50 deduplicated clusters**, each with:

```json
{
  "cluster_id": "slug",
  "headline": "...",
  "category": "WORLD",
  "independent_count": 4,
  "republished_by": ["ABC", "CBS"],
  "primary_source": "Reuters",
  "partisan_only": false,
  "position_best": "lead",
  "sources": [{"name": "Reuters", "url": "..."}, {"name": "BBC", "url": "..."}]
}
```

Plus the updated `monitoring` list. Pass to Loop 3.

## Invariants

- `independent_count` is post-wire-collapse and post-partisan-halving — never the raw URL count.
- No cluster in the scored set has `independent_count < 2`.
- Every collapsed republisher is preserved in `republished_by` (auditability).

## Failure handling

- If two clusters are genuinely ambiguous (could be the same event or two events), keep them separate and note it; merging unrelated events is worse than a near-duplicate.
