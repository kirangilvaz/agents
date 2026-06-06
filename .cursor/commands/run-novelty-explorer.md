# Run Novelty-Explorer Agent

Execute one full cycle of the Novelty-Explorer disruptive-technology discovery agent.

The agent's orchestrator spec lives at [`novelty-explorer/AGENT.md`](../../novelty-explorer/AGENT.md). Read it carefully — it defines the mission, conviction framework, source taxonomy, run modes, execution graph, and sub-agent dispatch contract. Then dispatch each loop in order, using the `Task` tool, by reading the corresponding subagent spec from [`novelty-explorer/subagents/`](../../novelty-explorer/subagents/).

## Optional arguments (parse from the user prompt)

- `mode=cold` — Rebuild from scratch (ignore caches and prior memory).
- `mode=warm` — Full pipeline, honor cache TTLs (default for any non-recent run).
- `mode=delta` — Quick refresh (Loops 0, 1-light, 4, 6, 8, 9; Loop 5 only if a rescore crosses a tier/lifecycle boundary).
- `mode=auto` (default) — Let Loop 0 decide based on `state.last_run_at`.
- `focus=<DOMAIN_ID>` — Bias discovery toward one domain (e.g. `focus=ENERGY`); still sweeps the others.
- `archive=true` — Also write a timestamped copy under `output/archive/` (off by default).
- `--reset` — Discard prior memory and force a cold start.

There is no required argument — a bare `/run-novelty-explorer` runs a full broad landscape scan.

## What you must do

1. Parse optional `mode=`, `focus=`, `archive=`, `--reset` from the user prompt.
2. Read [`novelty-explorer/AGENT.md`](../../novelty-explorer/AGENT.md) in full.
3. Dispatch [`subagents/00-warm-start.md`](../../novelty-explorer/subagents/00-warm-start.md) via the `Task` tool. Pass any `mode` / `focus` / `archive` / `--reset`.
4. Based on the mode the warm-start subagent reports, dispatch the remaining loops in the order defined by [`AGENT.md`](../../novelty-explorer/AGENT.md)'s execution graph:
   - **cold / warm:** 1 → 2 → 3 → 4 → 5 → 6 → 7 (Loop 7 internally re-runs 4→6 until convergence; min 3 passes, max 8) → 8 → 9
   - **delta:** 1 (light: refresh momentum/capital + new-entrant scan) → 4 (rescore) → 6 (amplify/suppress) → 8 (persist) → 9 (html). If a Loop 4 rescore crosses a conviction-tier boundary or flips lifecycle, insert Loop 5 (adversarial) before Loop 6.
5. After each subagent completes, verify it wrote its checkpoint to `novelty_explorer_memory/runs/<ts>/checkpoints/cycle_{N}_loop_{L}.json`. If not, surface the failure and stop.
6. Track `searches_used` per loop against the budget in [`policies/convergence.json`](../../novelty-explorer/policies/convergence.json). Warn at 80%, abort at 100%.
7. After Loop 9 completes, report to the user:
   - That `output/novelty-explorer.html` was updated in place (the same file every run).
   - Leaderboard size, tier distribution (Exceptional / High Conviction / Worth Monitoring / Emerging Signal), and average conviction.
   - A 3–5 line summary of the top opportunities (name, domain, conviction, TTM).
   - Summary of `diff.json` (added / removed / tier changes / any newly INVALIDATED).
   - `metrics.json` highlights (passes run, search budget used, cache hit rate, whether it converged).

## Constraints

- Do NOT alter the report template at [`novelty-explorer/templates/novelty_report_template.html`](../../novelty-explorer/templates/novelty_report_template.html). Loop 9 only substitutes placeholders — it never hand-writes HTML.
- The report is ALWAYS written to `output/novelty-explorer.html`, overwritten in place. Do NOT create per-run report folders. (Per-run audit artifacts go under `novelty_explorer_memory/runs/<ts>/`.)
- Do NOT skip subagents to "save time." Conviction depends on every loop running — especially Loop 1 (exhaustive, no-silent-skip sourcing) and Loop 5 (adversarial hype-vs-substance check). The minimum 3 refinement passes in Loop 7 is mandatory unless `mode=delta`.
- Do NOT write to `novelty_explorer_memory/` outside the paths each subagent owns. Loop 8 is the only loop allowed to mutate canonical records, `state.json`, `source_reliability.json`, `domains.json`, etc.
- Never fabricate evidence, funding rounds, investor names, papers, patents, or numbers. Every score component must trace to a verbatim quote in an evidence record. If a source is unreachable, log it and move on — no silent skips.
- Honor robots.txt, rate limits, paywall fallbacks, and ToS notes in [`policies/source_ttl.json`](../../novelty-explorer/policies/source_ttl.json). Cache hits consume 0 budget — don't bypass them unless `mode=cold`.

## Common patterns

Full broad landscape scan (default):
```
/run-novelty-explorer
```

Force a fresh full pass:
```
/run-novelty-explorer mode=cold
```

Quick daily refresh (new funding + new entrants):
```
/run-novelty-explorer mode=delta
```

Bias one domain, keep full coverage, and archive a snapshot:
```
/run-novelty-explorer focus=QUANTUM archive=true
```
