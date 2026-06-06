# Sub-agent: Loop 4 — Adversarial Challenge Pass (THE MOST IMPORTANT LOOP)

**Phase:** `adversarial` · **Loop ID:** 4 · Re-runs each pass until convergence.

## Purpose

Try to DEMOTE every story. Challenge every ranking. This is where conviction is earned, not assumed.

## Inputs

- Loop 3 scored top list (plus the `monitoring` list of candidates ranked just below the cut).

## Procedure — for EACH story currently in the top 30

### Step 1: Counter-research

- Search `"[STORY TOPIC]" debunked OR retracted OR denied [date]`.
- Search `"[STORY TOPIC]" correction OR update [date]`.
- Check: has the story been walked back, corrected, or denied by involved parties?

### Step 2: Adversarial questions (answer honestly, record the answer in `adversarial`)

- Is this really top 30, or just the first thing found?
- Is the coverage breadth inflated by wire re-runs? (If so, the real source count is 1, not 10 — push back to Loop 2's `independent_count`.)
- Is this a genuinely new development or a rehash of yesterday with a minor update?
- Am I ranking this high because it's important, or because it's sensational?
- Would a smart, busy professional regret NOT knowing this by end of day?
- Is there a story currently ranked 31-40 (in `monitoring`) that should replace this?

### Step 3: Source diversity check

- Is the top 30 ONLY US-centric? If yes, force-check international sources.
- Does it include at least one story from EACH of WORLD, ECONOMY/MARKETS, TECH/AI, and one other category?
- If a BREAKING event exists, is it ranked high enough (should be top 5)?

### Step 4: Score adjustment

- Story fails the adversarial test → reduce score by 10–15 points.
- Story confirmed across all checks → boost conviction toward ★★★★★, mark `adversarial` as confirmed.
- Story corrected or walked back → flag for removal (and log to changelog with reason).
- A `monitoring` story has stronger evidence than a bottom-of-list story → swap it in (max 3 swaps per pass, per [STABILITY RULE](../AGENT.md#stability-rule)).

## Output

Re-ranked top list with a populated `adversarial` note on every story, plus changelog entries for every demotion, removal, and swap. Pass to Loop 5.

## Invariants

- Every top-30 story has been challenged at least once this run; by convergence, at least twice.
- No removed-on-correction story survives into the next loop.
- Swaps respect the per-pass cap and the STABILITY RULE.

## Failure handling

- If counter-research is inconclusive (no confirmation either way), keep the story but cap conviction at ★★★ and note the uncertainty in `adversarial`.
