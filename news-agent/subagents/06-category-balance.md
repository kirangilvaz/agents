# Sub-agent: Loop 6 — Category Balance & Gap Check

**Phase:** `category_balance` · **Loop ID:** 6 · Last loop in the refinement cycle; its output feeds the convergence check.

## Purpose

Ensure the briefing covers all important domains and all genuinely newsworthy + relevant stories of the day surface — not just whatever is loudest.

## Inputs

- Loop 5 enriched top 30.
- The `monitoring` list (candidates below the cut).

## Checks

1. Does the top 30 have at least ONE story from each of: WORLD, US POLITICS, ECONOMY, MARKETS, TECH?
2. If AI / SCIENCE had a major development, is it represented?
3. If a BREAKING event occurred, is it ranked appropriately (top 5)?
4. Is the list dominated by a single category? (More than 8 stories from one category suggests over-indexing on one news cycle.)
5. Are there important stories from Asia, Europe, Middle East, or Latin America that were missed?

## Gap-fill searches

If gaps exist, run targeted searches (replace `[date]`):

- `top world news today [date] NOT [dominant topic]`
- `Asia news today [date]`
- `Europe news today [date]`
- `Middle East news today [date]`
- `Latin America news today [date]`
- `science breakthrough today [date]`
- `AI news today [date]`

Any newly surfaced story is sent back through Loop 2 (dedup) → Loop 3 (score) → Loop 4 (adversarial) before it can enter the top 30. Do NOT inject an un-scored, un-challenged story directly.

## Convergence evaluation

After this loop, evaluate the [Convergence Criteria](../AGENT.md#convergence-criteria):

- Zero swaps between the two most recent passes
- Every story conviction ★★★★+
- Every story 2+ independent sources (3+ preferred)
- No category gaps remain
- Every story challenged ≥ 2 times

If converged OR `pass >= 10` → proceed to Loop 7. Otherwise increment `pass` and re-run Loops 3 → 6.

## Output

Balanced top 30 (with any gap-fills integrated through the proper pipeline), a `converged` boolean, and the current `pass` count. Append gap findings to the changelog.

## Invariants

- No story enters the top 30 without having passed Loops 2-4.
- It is acceptable to deliver fewer than 30 stories rather than pad with low-quality entries; record the shortfall in the changelog.

## Failure handling

- If a category genuinely had no major development, leave it under-represented and note "No major [CATEGORY] developments today" in the changelog — do not pad.
