# Synchronising a balance plan

Read **only** when the manifest has `## Balance Context`. An ordinary plan does not read this file.

The plan is **not rebuilt**: a new version carries no guarantee of fewer disagreements, and that costs more than an edit. The improver keeps the plan to the current Balance Checkpoint by small edits keyed on item ids, and never goes past the plan's horizon. The grammar is `{{skills_dir}}/unikit-plan/references/TASK-FORMAT.md` → `### Balance checkpoint grammar`.

## What is read

The plan's `## Balance Context` snapshot; from the live file named by `Source:` — **read only** — the header (the first 12 lines) and the `## Current Balance Checkpoint` block. Nothing else of the live file.

## When the point changed

`Current` of the header differs from the snapshot's `Point` (the plan belongs to a finished or replaced point): there is nothing to improve. Print which point is current and the command `/unikit-plan full <path>` (with `none` or `closed` there is no command — say why). No rewrite of the plan is offered. If the header and the block's `Point` disagree between themselves, that is a file error: `WARN [balance] checkpoints file inconsistent: header and block disagree`, the recommendation `/unikit-gd-balance <slug>`, and no plan edits.

## Synchronising by item id

Compare the tasks' `Item:` links with the snapshot's `Work` list and the live block:

| Divergence | Proposal |
|---|---|
| a work item has no task | add a task above `Hand-back:` (and above the final `Test checkpoint: plan`); inside a phase, above the `Measure:` tasks of its phase |
| an item changed (kind, acceptance) | update the linked task's text and acceptance |
| an item was removed from the point | propose removing the task if it is not executed; mark an executed one |
| the live header's `Updated` differs from the snapshot's `Checkpoints updated`, items the same | update the snapshot only (`Checkpoints updated`) |

Edits are small, by `Edit`, approved through the ordinary report (Steps 4-5); the snapshot is refreshed in the same edit; task ids are not renamed; tasks without `Item:` are not touched. Output: the ordinary Step 4 report plus one line `INFO [balance] sync: point=<id> updated=<old>→<new> changes=<n>` (`<old>` is the snapshot's `Checkpoints updated` before the edit, `<new>` the live header's `Updated`).

## Horizon

Nothing is added past `Hand-back:`: no task, no phase, no module after the last one (`mode-add.md` of the planner holds the same rule). A finding outside the point's `Work` and `Until` does not go into the plan; it goes into the report as a proposal for `/unikit-gd-balance` (to change the point).

## Executor data

`## Measurements` is carried over whole together with `## MCP Findings`, `## Rule Candidates` and `## Test Runs`; its rows are not edited.

## Grammar checks

As 3.3a-3.3c: `Hand-back:` is the last and the only one; a game-session or probe measurement is the only phase in its execution layer; every task with an `Item:` has its item in the snapshot; no task depends on a result that returns only after `Hand-back:`.

## Step 1.5

"New researches are newer than the plan" does not apply to a balance plan as it stands; the input that changed is the checkpoints file (the two sections above).

## Never

The balance document is never edited here. It belongs to `/unikit-gd-balance`; the live file is read, never written. If it is not readable: `WARN [balance] checkpoints file not readable — plan not synchronised`.
