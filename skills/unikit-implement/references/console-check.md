# Console check across engine bridges

Loaded by Step 3.6 of `/unikit-implement` when `.unikit/system/engine-bridges/BRIDGES.md` lists at least one bridge.

1. Take the bridges in the order `.unikit/system/dev-principles.md` → **D3** gives and use the first whose `available when` line holds in this session.
2. Read the {{engine_name}} console through it, filtering for errors, by the read procedure of its block in `BRIDGES.md` and D6 — a marker before the phase's change and the delta after it when the bridge offers one.
3. No bridge is available → print `Console check: no engine bridge available, skipped` and go on to 3.7.
4. Analyze each error:
   - **Error relates to code created/modified in the current phase** → fix it inline using the same execution mode logic as Step 3.2 (default: inline; develop-agent only for true parallel/deep-dive)
   - **Error relates to code planned in a future phase** (check remaining tasks in the manifest's `## Checklist`) → skip, note in progress report: `"Known error: {description} — will be resolved in Phase {N}, task {N.M}"`
   - **Error is pre-existing and unrelated to the current feature** → skip, do not touch
5. After fixing, re-read the console log through the same bridge to verify the fixes did not introduce new errors.
6. Repeat the check→fix cycle until no errors from the current phase remain.
