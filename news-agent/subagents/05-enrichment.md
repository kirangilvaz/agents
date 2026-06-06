# Sub-agent: Loop 5 — Deep-Dive Enrichment

**Phase:** `enrichment` · **Loop ID:** 5

## Purpose

For each surviving top-30 story, gather the details needed for the briefing card and detail modal.

## Inputs

- Loop 4 re-ranked, adversarially challenged top list.

## Procedure — for EACH story in the current top 30

1. **What happened (`summary`)** — 2-3 sentences capturing the core facts. No editorializing.
2. **Why it matters (`why`)** — 1-2 sentences on broader significance: who is affected, what changes.
3. **Key details (`details`)** — 3-5 specific facts, numbers, quotes, or data points pulled from reporting. Each is a short string in the array.
4. **Source citations (`sources`)** — the 2-5 best source URLs as `{name, url, flag?}`. Prefer AP/Reuters/NYT/BBC for factual claims, specialist outlets for analysis. Set `flag` to `[via archive]`, `[via reader]`, or `[paywalled — headline only]` when applicable (per [Paywall Strategy §3](../AGENT.md#3-paywall--access-strategy)).
5. **What to watch (`watch`)** — one sentence on what happens next (next vote, hearing, earnings, etc.).
6. **Stamp `updated`** — `Month D, YYYY · H:MM AM/PM ET`.

## Output

Enriched top 30 where every story has `summary`, `why`, `details` (3-5), `sources` (2+), `watch`, and `updated`, in addition to the fields from Loops 2-4. Pass to Loop 6.

## Invariants

- No story may have fabricated body content. If only the headline + meta description was retrievable, `summary` must reflect that limited basis and the source carries the `[paywalled — headline only]` flag.
- Every `details` entry is traceable to one of the cited `sources`.

## Failure handling

- If a story cannot reach 3 details from real reporting, include fewer rather than inventing; note the thinness in `adversarial`.
