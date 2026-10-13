# Balance plan — a plan built from a Balance Checkpoints file

Read **only** when the input is a Balance Checkpoints file, a folder or slug under `.unikit/gamedesign/balance/`, or a request for calibration or measurement work on a balance document (`SKILL.md` → Input). An ordinary plan does not read this file.

The planner finds the current point itself and builds a plan **only up to it**: the returned data may change what comes next, and that decision belongs to `/unikit-gd-balance`, not to the plan. The grammar of the new task lines and sections has one owner, `TASK-FORMAT.md` → `### Balance checkpoint grammar`; this file points there and does not restate it.

## Resolving the input

A path to `CHECKPOINTS.md` is taken as it is; a folder gets `CHECKPOINTS.md` added; a slug is `.unikit/gamedesign/balance/<slug>/CHECKPOINTS.md`. No such file → `Glob` `.unikit/gamedesign/balance/*/CHECKPOINTS.md`, show the five latest by `Updated` (read only the first 12 lines of each) and ask once. Nothing found → "there is no balance document: `/unikit-gd-balance`" and **STOP**.

## Finding the point

Read the header (the first 12 lines), `## Roadmap` and `## Current Balance Checkpoint` — nothing else (never `BALANCE.md` or `results/`). The allowed header combinations are defined in `{{skills_dir}}/unikit-gd-balance/references/template-checkpoints.md` → `Allowed header combinations`; in a project without the Game Design group that file may be absent, so this branch relies on the field values themselves:

- `Status: closed` → say "the balance is closed", build no plan, **STOP**;
- `Status: open` and `Current: none` → "there is no point to plan: the document waits for a decision of the balance skill — `/unikit-gd-balance <slug>`", **STOP**;
- `Current: BCH-<n>`, exactly one `current` row in `## Roadmap` with the same id, and the same `Point` in the block → the point is found;
- anything else (several `current` rows, a header, a roadmap row and a block that disagree) → `ERROR [balance] <path>: header, roadmap and block disagree (<what>) — plan not built; fix with /unikit-gd-balance <slug>`, **STOP**.

The point is never guessed from the text of the request.

## An existing plan for this point

Look in **both** places: folder plans `.unikit/code/plans/*/PLAN.md` and the fast plan `.unikit/code/PLAN.md` (it does not live under `plans/`, and a walk of `plans/*` alone would miss it). Find a manifest with a `## Balance Context` that has the same `Source:` and the same `Point` (point numbers repeat from one document to another). The same `Checkpoints updated` → say so and offer `/unikit-implement`; another `Checkpoints updated` → offer `/unikit-improve <plan>`. A second plan is not built until the user confirms with one question. Read only the header and the `## Balance Context` of each manifest.

## The snapshot and the horizon

Write `## Balance Context` by the grammar section. The plan covers the `Work` items of the current point and `Hand-back:`; the work of `planned` rows is not included; an unresolved question of the point is a blocking entry in `## Open Questions`, not a guess. The feasibility of the items is checked by the planner against the code itself (Step 4 of `SKILL.md`): the point passes a capability class, never files.

## Work items to tasks

| Kind in `Work` | Task form |
|---|---|
| `tool`, `stand`, `data-edit` | an ordinary task with `Files:` (and `Editor:` where the editor's serialized state changes) + `Item:` |
| `measure` | a `Measure:` task carrying the item's `via` + `Item:`, no `Files:`; its `runs` is the minimal sample the item's `acceptance` or the point's `Until` → `Stop` states — none stated is a blocking entry in `## Open Questions`, never a guessed number |
| `probe`, `human-check` | a probe-class `Measure:` task + `Item:`, no `Files:`; the metric is the recorded observation or a go/no-go |
| `tuning-loop` | an ordinary task with `Files:` + `Item:`; acceptance "closed by measurement `<item id>`"; the iteration limit and one lever at a time in the task text |

## Order, layers and tests

Dependencies come from the items' `depends:`. The order inside a phase is the one in the grammar section ("Order inside a phase"); a task that needs a measurement's result is in a later phase; a phase with a game-session or probe measurement is alone in its execution layer; the layer check is one, together with Guard B and the module barrier. Under `Testing: yes`, `Test checkpoint: plan` stands directly above `Hand-back:` (the last phase's `Measure:` tasks are before that run; `plan-bundle.mjs` check 11 accepts exactly this form); other `Test checkpoint:` tasks follow the ordinary rules. A measurement does not replace a test: it is the acceptance of a numeric metric.

## The Hand-back task

The report path is by `.unikit/system/balance-handback.md` → `## Place and name`, with the plan folder from Step 1; its `report:` list is the snapshot's `Report:`. Contract missing → `WARN [balance] hand-back contract missing — report path and fields written from the point; run unikit-ai update`, and the path is built from the template `handback-<point id>.md` in the plan folder.

## Self-check before saving

All blocking: exactly one `Hand-back:` task and it is the last; every `Measure:` task has an `Item:` that exists in the snapshot's `Work`; every `Measure:` stands after all ordinary tasks and the test checkpoint of its phase, and a task that depends on its result is in a later phase; no task carries an `Item:` whose item is not in the snapshot; nothing follows `Hand-back:`; `## Measurements` is present if and only if there is a `Measure:` task. A violation → `ERROR [balance] plan self-check: <what exactly>` and the fix before saving.

## Where the plan goes, and no branch

- `fast` writes `.unikit/code/PLAN.md`. `full` and `ultra` write the folder `.unikit/code/plans/balance-<slug>-bch-<n>/` and do not touch the plan of the current branch. `<slug>` is the name of the document's folder under `.unikit/gamedesign/balance/` in lowercase by the rule of `merge-plan.md` (runs outside `[a-z0-9]` become one `-`, ends trimmed, at most 40 characters; a name with nothing left becomes `doc`); `<n>` is the number from the point's `BCH-<n>`. This name replaces the "invent a name" of Step 1; the collision check of Step 1 holds for `full` and `ultra` unchanged.
- `fast` skips the collision check, so this file asks: `.unikit/code/PLAN.md` exists and still has `- [ ]` tasks → `AskUserQuestion`: overwrite it, or take `full`.
- Never create or switch a branch: the branch step of every mode is skipped, whatever `git.create_branches` says; the work goes on in the current branch.

## The closing message

The plan is created. The next step is the executor's command with the folder named explicitly: `/unikit-implement balance-<slug>-bch-<n>` for `full` and `ultra` (a balance plan is not found by branch, as a merge plan is not); for `fast` `/unikit-implement`, with the caveat of `merge-plan.md` → `## The closing message` about an existing folder plan of the branch. The executor prints the hand-back command itself. `ultra` is not offered: only the user names it.
