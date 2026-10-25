# Executing a balance plan — measurements and the hand-back

Read **only** when the manifest has `## Balance Context` (`SKILL.md` → Step 1). An ordinary plan does not read this file.

## What this reference owns

Carrying out `Measure:` and `Hand-back:` tasks, the `⏳ AWAITING RESULT` label, its counting and its resume. The form of those lines is `{{skills_dir}}/unikit-plan/references/TASK-FORMAT.md` → `### Balance checkpoint grammar`; the form of the report is `.unikit/system/balance-handback.md`. Neither is restated here.

## Step 3.2 — a Measure: task

1. Read the task's lines: `Item:` and `Measure:` (class, stand, metric, acceptance, `runs`).
2. **The route is principle A9 and ladder D3** of `.unikit/system/dev-principles.md` — A9 "no rules is not no rights" is the principle, D3 the degradation ladder. First find a way to run it and try it (an engine tool through MCP, the test runner, a script, a project console command: D3, the rung "another route you can see"). The D3 rung "by hand" is `⏸️ MANUAL`; for a `Measure:` task it is replaced by `⏳ AWAITING RESULT`. `⏸️ MANUAL` is never written for a `Measure:` task. D3 sits behind the lazy-read marker of `dev-principles.md` and is read once per session by the usual rule; for `Measure:` the first attempt of an MCP route counts as touching the editor state.
3. When the item is an instrument (its `Item` names a known-answer check), run that check first: a mismatch with the known answer is `valid = no`, and the runs do not start.
4. Do `runs` runs; reduce them by the metric; compare with the acceptance → `band` (`in`, `out` or `n-a`). `valid` is `yes` only when every run finished with no instrument error.
5. Write a row into `## Measurements` (`id` is the id from `Item:`, `build` is `git rev-parse --short HEAD`, `from` is `task <N.M>`) **by the same `Edit` that ticks the checkbox** (Step 3.4). If the manifest has no such section (the plan was edited by hand or lost it), create it at `##` level with the table header of the grammar section, directly after `## Test Runs`; with no `## Test Runs` either, by the rule of `{{skills_dir}}/{{self_name}}/references/test-runs.md` (the end of item 7 of `## Step 3.2`): under `## Rule Candidates`, and when that is absent too, above `## Dependency Graph`.
6. The result cannot be obtained now (a manual game session, another person's device) → do not tick: write the label `⏳ AWAITING RESULT: <the exact instruction> → <where to put the result>`. Independent tasks go on; dependent ones wait.
7. A repeated measurement (a tuning loop) is a new row; earlier rows are never rewritten.
8. A misleading MCP answer becomes a `## Engine Bridge Findings` row by the same rule as for other tasks (Step 3.4 of `SKILL.md`).

## Step 3.4 — ticking

`valid = yes` → `- [x]`; a `⏳ AWAITING RESULT` label is removed by the same `Edit`. `valid = no` → the task is not ticked: repeat (up to three times when the cause is the instrument) or a Step 3.3 blocker with the options `Skip` / `Change approach` / `Stop`. `Skip` marks the item "not measured" in the report.

## Counting (Step 2)

A task with `⏳ AWAITING RESULT` is **pending**: not "out of scope", not implemented; "all tasks are completed" is false; dependent tasks and `Hand-back:` wait. A ticked `Measure:` task counts as any ordinary one.

While any task of the scope is pending — a label, or an unticked `Hand-back:` — the run is not complete, and the Step 5 prompts say so by what they do not offer: **5.4** never offers to delete `.unikit/code/PLAN.md` (the label, the snapshot and `## Measurements` live only there), **5.6** does not describe the work as complete, and **5.8** prints no `/unikit-archive` line and no hand-back command; Step 4 names the waiting tasks instead.

## Resume (Step 0.3)

After a `/clear` labelled tasks are picked up: once per run the user is offered to hand the result over (a paste or a path). Accepted → check the form (the `what`, `runs` and `result` fields), write the row (`from` is `task <N.M> via user`), tick, remove the label. No result → the task stays pending and goes into the Step 4 report.

The code spot-check of Step 0.3 does not apply to a ticked `Measure:` or `Hand-back:` task: it has no code, and its evidence is the `## Measurements` row whose `from` is its task id, or the report file at the path of its `Hand-back:` line. Evidence missing (a reset, a lost file) → say so and un-tick that task only; nothing is re-run silently.

## Step 3.2 — the Hand-back: task

It runs when every `Measure:` task of the plan is `[x]` or was skipped by the user at a blocker. Read `.unikit/system/balance-handback.md`; build the report by its contract (the header exactly as its `## Header` defines it — `Plan` and `Build` with their `fast` and `unknown` forms — and `Date` from `Bash(date *)`; the last `## Measurements` row of each `id`; `## Not measured` — skipped and failed items); write the file to the path in the task's `Hand-back:` line; check that every name of `report:` is present (a missing one → `WARN [balance] report field missing: <name>`, appended to `## Not measured`, never an invented value); tick. Contract missing → `WARN [balance] hand-back contract missing — report built from the task line; run unikit-ai update`. The command of the `to:` field is **not** printed here — it is printed at Step 5.8 (below), because between Step 4 and the end of the call come 5.2 (the blocking rules question), 5.6 (the verify-or-commit question and the `unikit-review` / `unikit-commit` calls) and 5.8 with its archive, PR and `Testing: yes` lines, so a "last block of the summary" would not stay last.

## Delegated execution

`Measure:` and `Hand-back:` go to neither `develop-agent` nor `unikit-implement-worker`; the coordinator carries them out in the main session by this file.

## Report lines (Step 4)

An `Awaiting results:` block (one line per task: id and instruction) and a `Hand-back: <path>` line after the report was built; the block is omitted when nothing waits.

## Steps 3.6-3.9

Tell the steps of a **task** from the steps of a **phase**:

- **3.6 (console and compile), 3.7 (context artifacts) and 3.8 (tests)** do not apply to `Measure:` and `Hand-back:` tasks themselves: they have no `Files:`, change no source, so there is nothing to compile, refresh or test; in a phase made only of such tasks these steps run on their own "no changes" condition.
- **3.9 (the phase's commit checkpoint) is not "not applicable" — it works as usual.** It comes when the phase is complete and stages the run's own changes (`## Important Rules`, item 1 of `SKILL.md`). `## Measurements` rows in the manifest and `handback-<point id>.md` in the plan folder are the run's own changes exactly as the manifest's ticks are, so the **ordinary flow** commits them: the phase checkpoint (or the `final commit` of Step 5.6 for the rest) in the same `unikit-commit` call. There is no separate path, no separate commit and no manual commit by the executor. A project that ignores `.unikit/code/` gets them out of the commit as it does the ticks; that is not an error. They do not move the `Full run:` anchor: `tree-sha256` excludes `.unikit/` and `*.md`.
- A phase that still holds a task with `⏳ AWAITING RESULT` is not complete: 3.9 does not come for it until the result is accepted or skipped.

## Step 5.8 — the hand-back command

The command of the `to:` field of the `Hand-back:` task is printed at Step 5.8 ("Next steps") as the **last line of the whole output of the call**: after the `PR after verification` line and the `Testing: yes` line — whichever of them were printed come before it; the icon in front, nothing after: `🧭 /unikit-gd-balance <slug> <path to report>`. It is plain text, not a call and not inside triple quotes. A plan with `## Balance Context` gets no `/unikit-archive <folder>` line at 5.8, ever: the report lies in the plan's folder and archiving moves the folder, so a path printed under that line would be stale when the lines are taken in order; the user archives the plan with `/unikit-archive` once the report is received. The condition: this run's `Hand-back:` is `[x]` and the report file is written. No report (the task did not get there or waits for a result) → the line is not printed and Step 4 names the reason in the `Awaiting results:` block. A run stopped before 5.8 prints nothing; `/unikit-verify` Step 5 reproduces it.
