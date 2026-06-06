# Run Interview Questions Agent

Execute one full cycle of the Interview Questions research agent.

The agent's orchestrator spec lives at [`interview-questions-agent/AGENT.md`](../../interview-questions-agent/AGENT.md). Read it carefully — it defines the run modes, execution graph, and sub-agent dispatch contract. Then dispatch each loop in order, using the `Task` tool, by reading the corresponding subagent spec from [`interview-questions-agent/subagents/`](../../interview-questions-agent/subagents/).

## Arguments

The user may include any of the following in their prompt:

- `mode=cold` — Force a cold start (rebuild from scratch, ignore existing `interview_questions_knowledge/`)
- `mode=warm` — Force the full pipeline with cache honoring
- `mode=delta` — Force a quick refresh (Loops 6, 7, 9, 8 only)
- `mode=auto` (default) — Let Loop 0 decide based on `state.json.last_run_at`

If no `mode=` is specified, use `auto`.

## What you must do

1. Read [`interview-questions-agent/AGENT.md`](../../interview-questions-agent/AGENT.md) in full.
2. Dispatch [`subagents/00-warm-start.md`](../../interview-questions-agent/subagents/00-warm-start.md) via the `Task` tool. Pass the user's `mode=` override if any.
3. Based on the mode the warm-start subagent reports, dispatch the remaining loops in the order defined by [`AGENT.md`](../../interview-questions-agent/AGENT.md)'s execution graph:
   - **cold / warm**: 1 → 1b → 2 → 3 → 4 → 5 → 6 → 7 → (loop until convergence per [`policies/convergence.json`](../../interview-questions-agent/policies/convergence.json)) → 9 → 8
   - **delta**: 6 → 7 → 9 → 8
4. After each subagent completes, verify it wrote its checkpoint to `interview_questions_knowledge/runs/<ts>/checkpoints/cycle_{N}_loop_{L}.json`. If not, surface the failure and stop.
5. Track `searches_used` per loop against the budget in [`policies/convergence.json`](../../interview-questions-agent/policies/convergence.json). Warn at 80%, abort at 100%.
6. After Loop 8 completes, report to the user:
   - Path to the rendered dashboard (`interview_questions_knowledge/runs/<ts>/dashboard.html`)
   - Summary of `diff.json` (added / removed / upgraded counts)
   - `metrics.json` highlights (eval recall, search budget used, cache hit rate)
   - Whether the cycle converged

## Constraints

- Do NOT alter the dashboard template at [`interview-questions-agent/templates/interview_dashboard_template.html`](../../interview-questions-agent/templates/interview_dashboard_template.html). Loop 8 only substitutes placeholders.
- Do NOT skip subagents to "save time." Stability and provenance depend on every loop running.
- Do NOT write to `interview_questions_knowledge/` outside of the paths each subagent owns. Loop 8 is the only loop allowed to mutate the canonical knowledge files.
- Honor robots.txt, rate limits, and ToS notes in [`policies/source_ttl.json`](../../interview-questions-agent/policies/source_ttl.json).
