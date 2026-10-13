# Verifying a balance plan

Read **only** when the manifest has `## Balance Context` (`SKILL.md` → Step 0.2). An ordinary plan does not read this file.

This branch answers "may these data be returned?", not "is this balance good": the decision belongs to `/unikit-gd-balance`. The form of the task lines is `{{skills_dir}}/unikit-plan/references/TASK-FORMAT.md` → `### Balance checkpoint grammar`; the form of the report is `.unikit/system/balance-handback.md`. Neither is restated here.

## Step 1 — task status

- A `Measure:` task is done **iff** `## Measurements` has a row with its `Item` and `valid = yes`, and `runs` is not less than the task's `runs:`.
- A `Measure:` task the user chose to skip at a Step 3.3 blocker (it is listed under `## Not measured` of the report) is `⏭️ SKIPPED`: reported, never `verify-measure-<id>`, and it does not hold back the hand-back command — its id stands in `## Not measured`, which accounts for it in the report.
- `⏳ AWAITING RESULT` means **waiting**: a separate line of the report, not `⏸️ MANUAL`, and not a blocker in the normal mode (in the strict mode it is a failure).
- A `Hand-back:` task is done **iff** the report file exists and holds the header and every name of its `report:` list accounted for (by the contract's `## Header`, `## Body` and `**Report fields.**`: a row, a line, or a line of `## Not measured`). Contract missing → `WARN [balance] hand-back contract missing — report checked for existence and header only; run unikit-ai update`.

## Data validity

A sub-step of the 3.x block, by the plan's snapshot and the plan's own artifacts:

1. the report is complete (every name accounted for);
2. by the `## Measurements` rows: `runs` is not less than declared, `build` is present, and the known-answer check row of an instrument has `valid = yes`;
3. verdicts of different natures: `valid = no` blocks; `band = out` is data for the balance skill and is not a blocker — **except** for tasks whose acceptance is "closed by measurement `<item id>`": there a miss is an unfinished task unless an iteration limit was recorded.

## Drift

Only the **header** (the first 12 lines) of the live file is read, its path is the snapshot's `Source:`; nothing is written. This branch reads only the header of the live file and writes nothing.

- `Current` differs from the snapshot's `Point` → `WARN [balance-drift]`: the plan belongs to a point that is no longer current; the next command is `/unikit-plan full <path>` for the current one (with `Current: none` or `Status: closed` there is no command — the reason is stated).
- `Updated` of the live header differs from the snapshot's `Checkpoints updated` with the same `Current` → `WARN [balance-drift]` and the recommendation `/unikit-improve <plan>`.
- The live file is not readable → `WARN [balance-drift] checkpoints file not readable — drift unchecked`.

The commands `/unikit-plan` and `/unikit-improve` are named **only in the human report**, never in the `unikit-gate-result` block (`## Gate result`). A disagreement between the header, the roadmap and the block is **not** claimed here: this branch reads neither the roadmap nor the block (the planner and the improver see that). The level is `warn`, never `fail`.

## Gate result

Blocker ids in the `unikit-gate-result` block: `verify-balance-report` (the report is missing or incomplete), `verify-measure-<id>` (no row with `valid = yes`), `verify-instrument-<id>` (the known-answer check failed). A pending result and `WARN [balance-drift]` raise `status` to `warn` at least and are not in `blockers` (in the strict mode a pending result is `fail`). The schema of `.unikit/system/gate-result-contract.md` does not change: blocker ids are free.

**`suggested_next.command` is from the allowlist only** (the contract's list): for balance blockers, drift and a pending result it is `/unikit-fix` when the code or a test has to be fixed (`verify-instrument-<id>` is an instrument or instrument-check error; `verify-measure-<id>` when the cause is in the stand's code), otherwise `null`. `/unikit-plan`, `/unikit-improve`, `/unikit-gd-balance` and `/unikit-implement` never enter the block — neither in `command` nor in `reason`; they stand only in the human text of the report. The gate-result block stays the **last fenced block** of the output (Step 4.4, "last fence wins"); the hand-back command of `## Step 5` is printed after it as plain text, not in triple quotes — otherwise it would become the last fenced block and the orchestrator would read it instead of the gate result.

## Step 5

After a check with no blockers the command of the `to:` field of the `Hand-back:` task is repeated as the last line of Step 5 — `🧭 /unikit-gd-balance <slug> <path to report>` — as plain text, after the gate-result block, not fenced and not a call.

## What this branch does not do

It does not judge the balance, does not choose the next point and writes nothing into `.unikit/gamedesign/`; the `implemented_version` write (3.9) does not apply to such a plan.
