# Merge plan — a plan that merges a named branch into the current one

Read **only** when the user asks to merge a named branch into the current one (`SKILL.md` → Input). An ordinary plan does not read this file.

The planner does the analysis itself, by `.unikit/system/merge-analysis.md`, and writes the plan that carries the merge out. It does not need a separate exploration first, and uses a fresh one when there is one. `/unikit-implement` then runs the plan by its ordinary rules.

## Trigger

A request to merge a **named** branch into the current one. Three things are not merges in this sense — **rebase**, **cherry-pick**, and merging by a pull request number. Say so in one line and offer an ordinary plan instead. The branch is not named → ask which one with `AskUserQuestion` (options from `git for-each-ref`).

There are three modes — `fast`, `full`, `ultra`. `add` does not apply to a merge.

## Bootstrap

Read `.unikit/system/merge-analysis.md`. It is missing → go on by your own judgement **without** directives over the engine rules and **without** anchors, and:

- print `WARN [merge] merge-analysis.md missing — plan is not per protocol; run unikit-ai update`;
- make the first sentence of the plan's `## Overview`: `Not per protocol: .unikit/system/merge-analysis.md was missing, so this plan has no directives over the engine rules and no SHA anchors.`;
- say it in the closing message.

Do **not** write the note into `## Open Questions`: in an ultra plan a question there can be counted as blocking and make the plan unfit for execution. The user has accepted the risk of a plan without the protocol.

## Analysis

Run the protocol whole, in its order. `git fetch` follows the protocol's `## Fetch`; `Bash(git *)` is already allowed, so no permission prompt will come.

A merge exploration that the ordinary Step 2 found is used when the SHAs of ours, theirs and base in its `Merge anchors:` line equal the ones pinned now. Otherwise recompute by the protocol, silently, and print one line:

```
INFO [merge] research <slug> not used — <ours, theirs or base> moved
```

## Forks and blocking questions

A fork of the kind "whose behaviour wins" is settled by a question in the planning session; the answer goes into the text of the tasks and into the plan's CONSTRAINTS.

A conflict for which no directive can be written → write **no plan** until the user answers or refuses to. Refusal → write the plan with the question under `## Open Questions` and call the plan not ready for execution in the closing message — in ultra with the line `Plan is NOT implementation-ready: N blocking open question(s)`. The full plan has no notion of a blocking question: this is the planner's rule, and the executor does not check it.

## The mode question

The question has three options, in this order: fast, full, ultra.

- Before it, **print as message text** the size of the divergence — the commits on each side and the number of files both sides touched (`## Divergence` of the protocol). Tool output is collapsed from the user, and without these numbers the question goes out blind. Repeat them in one line inside the question itself.
- `fast` is marked recommended for a small merge, `full` for a large overlap — a judgement on the printed numbers, there is no threshold. `ultra` is never recommended.
- The user named the mode already → no question.

## Where the plan goes, and no branch

- `fast` writes `.unikit/code/PLAN.md`. `full` and `ultra` write the folder `.unikit/code/plans/merge-<slug>/` and do not touch the plan of the current branch.
- `<slug>` is the merged branch's name in lowercase, each run of characters outside `[a-z0-9]` replaced with one `-`, the ends trimmed, at most 40 characters. This name replaces the "invent a name" of Step 1; the collision check of Step 1 holds for `full` and `ultra` unchanged.
- `fast` skips the collision check, so this file asks: `.unikit/code/PLAN.md` exists and still has `- [ ]` tasks → `AskUserQuestion`: overwrite it, or take `full` instead.
- Never create or switch a branch: the branch step of every mode is skipped. That is Step A of `full` and Step A of `ultra`, whatever `git.create_branches` says; the work goes on in the current branch.

## Layout

One for all three modes. Phases are numbered in order, with no gaps; a phase that is absent takes no number.

1. **The merge** — by the start state of the protocol.
   - State 1: a task to start the merge — `git merge --no-ff --no-commit <theirs sha>`, always, also when a fast-forward is possible; the editor must be closed first. A task to check the anchors (the protocol's last section). One task per group of explicit conflicts: `Files:` lists the conflicted files, the directive is in the task text, and asset deltas are separate `Editor:` tasks by the grammar of `TASK-FORMAT.md`. The **last** task completes the merge.
   - State 2: the same without the start task. State 3: a single task with `git commit --no-edit`. State 4: no merge phase.
   - The text of the last task says, word for word: `The merge commit is made by the last task of the merge phase: git add -- <resolved files>, then git commit --no-edit; /unikit-commit does not make it.` Never `git add .`. It is ready when `git merge-base --is-ancestor <theirs sha> HEAD` returns 0.
2. **Implicit conflicts** — one task per surface class where the analysis found a risk. A class that cannot be checked gets a task that checks, not one that edits.
3. **Verification** — open the editor and wait for import and compilation (`Editor:` by `ENGINE_RULES.md`), read the console, regenerate the generated files, run the tests by the usual policy (`testing.plan.checkpoints`; the rule `### One scope, one launch` holds).

**Anchors.** The three SHAs, the predicted conflicts and the forks decided go into the text of the merge phase's tasks and into the CONSTRAINTS of `## Technical Context` as a line starting `- MUST:`. `## Settings` gets no line for them. There are no new task kinds.

**`## Commit Plan` is required** whatever the task count — the "5+ tasks" threshold does not apply. The entry for the merge phase says that no `feat(<module>): <description>` message line is used, because the merge commit is made with `--no-edit`. Modules and PR checkpoints follow `TASK-FORMAT.md` as for any plan.

## The closing message

Step 6 names the command to run:

- `fast`: `/unikit-implement`, when the current branch has no plan folder with unfinished tasks. If it has one, the executor takes that plan without asking, so the message gives the explicit form instead: `@.unikit/code`. That form is a suggestion — it matches the executor's description of `@<path>` (a folder holding the manifest `<path>/PLAN.md`), but it has not been run on a flat plan.
- `full` and `ultra`: `/unikit-implement merge-<slug>` — a merge plan is never found by branch.

Add to it: the not-per-protocol note, when it applies; "not ready for execution", when it applies. For start states 2 and 3 add: when `/unikit-implement` asks about uncommitted changes, answer `Continue as is` — an unfinished merge is the plan's own work, and "Commit now" would finish the merge outside the plan and leave the last task with a clean tree.
