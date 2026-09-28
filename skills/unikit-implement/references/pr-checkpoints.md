# PR checkpoints and plan modules

Read once, at plan load, by `/unikit-implement` and by `unikit-implement-coordinator` alike, when the checklist carries a `PR checkpoint:` line or the manifest has `## Modules`. Grammar: `unikit-plan/references/TASK-FORMAT.md` → `### Modules section`, `### PR checkpoint task grammar`. Boundaries: `.unikit/system/plan-boundaries.md`. Neither is restated here.

The question texts and option labels below are templates: say them in `language.ui`. `INFO` / `WARN` and their tags stay as they are.

## Push

While the checklist carries a `PR checkpoint:` line — in any plan, legacy included — every call to `unikit-commit` from this run adds `no-push`: phase checkpoints, the pre-edit commit of a `direct` editor task, the module commit of a PR checkpoint, the commit of Step 5.6. A run never pushes; the branch reaches the remote through `/unikit-pr` or the developer.

## Legacy

A PR checkpoint task in a plan whose `## Settings` has no `PR checkpoints: yes` (a plan written under a project's own rule) is executed by its own steps — in an ultra bundle the `### Implementation Steps` of its section, in a full plan its description and `WHY:`. A step that asks to push or to open a pull request is **not** carried out (`## Push`); a step that ends the run is. A `→ skipped` label reads as `⏭️ MERGED` into the next PR checkpoint.

## Counting (Step 2)

A `[ ]` PR checkpoint carrying `⏭️ MERGED → task <N.M>` is not pending. A merged last PR checkpoint is already `[x]` and counts like any closed task.

## Step 3.2 — the PR checkpoint

Under `PR checkpoints: yes`. A PR checkpoint runs at the Step 3.9 position of its phase, after Steps 3.6-3.8: the compile fixes, the context files and the phase's tests "included in the phase commit" have to land inside the module, not past its boundary.

1. **Commit the module.** Uncommitted files of this run → `unikit-commit` with `checkpoint: phase <N>, no-push` (and `auto` when auto-commit is on). This commit is the Step 3.9 commit of the closing phase: Step 3.9 does not ask again for it. Nothing to commit → the boundary is `HEAD`. The commit is cancelled or does not complete → the task stays `[ ]`, print `WARN [pr] module <name> is not committed — PR checkpoint <N.M> stays open`, and the run ends as Step 3.3 "Stop" does. Disable checkpoints does not skip the module commit: a module boundary needs a commit. After "Disable checkpoints" it goes through the `unikit-commit` question, exactly as the Step 5.6 commit does, unless auto-commit is on; the same holds for the label commit of `## Step 3.4 — labels`.
2. `boundary = git rev-parse --short HEAD`; for the review call, the full SHA (`git rev-parse HEAD`).
3. **The reminder** — three to five lines in `language.ui`: the module and its phases; the branch → the base (from the task's `PR checkpoint:` line); what the base branch gets (`delivers:`); the module's tests — green (task N.M) · moved to task N.M · not run (`Test checkpoints: plan`) · no tests (`Testing: no`); the modules merged into this pull request (`⏭️ MERGED → task <this task>`). The reminder is printed as its own block before the question, never inside it: a body glued to an interactive question is lost as soon as the choice moves into a widget.
4. **One question** — asked under auto-commit too. An answer given in advance in the run's arguments — `combine PRs`, `stop at PR points`, `run /unikit-pr at PR points` (never "merge PRs": `merge` is a `/unikit-pr` level) — answers every PR checkpoint of the run.

   ```
   AskUserQuestion: Module <name> is committed (<boundary>). What now?

   Options:
   1. Check the module — /unikit-verify and /unikit-review
   2. Run /unikit-pr and continue
   3. Stop here — I will make the PR myself
   4. Merge into the next PR
   ```

   - **Check the module** → `## Module check`, then the same question without this option.
   - **Run /unikit-pr and continue** → three tiers: `Skill(skill: "unikit-pr", args: "checkpoint: task <N.M>, boundary <sha>")` → `/unikit-pr checkpoint: task <N.M>, boundary <sha>` → print `Run: /unikit-pr checkpoint: task <N.M>, boundary <sha>`. Any outcome — the pull request opened, updated, printed, or its confirmation declined — goes to `## Step 3.4 — labels` with `→ PR <sha>`, then on to the next module. When `{{skills_dir}}/unikit-pr/SKILL.md` does not exist (a project that ran `update` without `--install-new`), print `WARN [pr] /unikit-pr is not installed — run unikit-ai update --install-new` and continue as **Stop here** — printing a command that does not exist would be a false hint.
   - **Stop here — I will make the PR myself** → `## Step 3.4 — labels` with `→ PR <sha>`; the run ends (Step 4), with a hint to `/clear` before the next `/unikit-implement`.
   - **Merge into the next PR** → the label `⏭️ MERGED → task <id of the next PR checkpoint task>`, the checkbox stays `[ ]`, and the run goes on to the next module. At the **last** PR checkpoint there is no next one: write `- [x] Task N.M — … ⏭️ MERGED` at once, with no target — the module goes into the pull request made after `/unikit-verify`.

   Without a question widget, print the options as a numbered list and end the turn.
5. `/unikit-implement` itself does nothing with the remote.

## Step 3.4 — labels

- `- [x] Task N.M — … → PR <sha>`; then every task labelled `⏭️ MERGED → task <N.M>` (and, transitively, every task pointing at those) becomes `[x]` with `→ PR <sha>` appended — its label stays. A phase whose tasks are all done → `**Status:** [x] Completed`.
- **No PR checkpoint label is left uncommitted when the run stops on it** — neither `→ PR <sha>` nor `⏭️ MERGED`. The label is written after the module commit, so the next phase's commit usually carries it. When the run ends right after it (**Stop here**, the last task of the run's scope, an interruption by the user), commit the manifest change on its own: `unikit-commit` with `checkpoint: task <N.M>, no-push` (and `auto` when auto-commit is on). Otherwise the next run's Step 0.2 offers `git stash`, the stash puts the task back to `[ ]` or drops its label, and the PR checkpoint question comes a second time. The commit is cancelled → `WARN [pr] the PR checkpoint label of task <N.M> is not committed — do not stash it, or the checkpoint runs again`. Nothing to commit (the label is already committed) → nothing.
- A commit checkpoint whose range ends with the PR checkpoint task (`### Commit N: after tasks X-<N.M>` for the coordinator, Step 3.9 for this skill) **is** the module commit of step 1 and is not repeated.

## Module check

The module's start — `.unikit/system/plan-boundaries.md` → `## Module start`. Then, in this session and not as a delegation, three tiers each:

1. `Skill(skill: "unikit-verify", args: "<folder> Phases K-L")` — K-L are the module's phases.
2. `Skill(skill: "unikit-review", args: "<full module start sha>")` — the review's commits mode, from the module's start. Always the **full** SHA: `unikit-review` sends an argument made of digits alone to its pull-request mode, and a short SHA can be all digits.

The contract is missing → review without a ref would review the staged changes instead: do not run it, and print `WARN [pr] plan-boundaries contract missing — module review skipped; run unikit-ai update`.

After the module check the boundary is taken again. Fixes made from the verify ("Fix issues") or from the review land after `<sha>`: when the work tree is dirty or `HEAD` has moved past the boundary, commit the module once more (step 1, with `no-push`) and take `boundary = git rev-parse --short HEAD` anew — otherwise **Run /unikit-pr** would push a stale SHA.

## Module boundary drift (ultra only)

When the run reaches the first task of module k+1 — after a PR checkpoint, after a merge into the next PR, or when the run starts in module k+1:

- `evidence` — the paths of the `## Current-Code Evidence` tables in the phase files of module k+1;
- `changed` — `git diff --name-only <plan start> HEAD` (`## Plan start`; a two-dot diff — the start may be the empty tree);
- `expected` — the union of `## Files in This Phase` of every phase before module k+1;
- `drift = evidence ∩ changed − expected`. Empty → silence.
- Not empty → `WARN [plan-drift] module M<k+1>: <n> evidence file(s) changed unexpectedly: <paths>`, then ask:

  ```
  AskUserQuestion: The evidence module M<k+1> was planned on has changed. Refine it first?

  Options:
  1. Refine the module first — /unikit-improve
  2. Continue as planned
  ```

  **Refine the module first** prints `/unikit-improve @.unikit/code/plans/<folder> module M<k+1>: evidence drifted in <paths>` — the `@<path>` form, whose remainder is the prompt; without the `@` improve would take the whole argument for a folder name — and the run stops. **Continue as planned** goes on.

Only in an ultra bundle with `## Modules`; a full plan has no evidence tables to compare. The contract is missing → print `WARN [plan-drift] plan-boundaries contract missing — drift check off; run unikit-ai update` and skip the check.

## Report lines (Step 4)

- `PR checkpoints: task 4.5 → PR a1b2c3d · task 7.3 merged → task 11.4` — only when the run met a PR checkpoint.
- `Module drift: M5 — consider /unikit-improve` — only after a `WARN [plan-drift]`.

## Status by modules

With `## Modules`, the status display shows one line per module:

```
M<k> · <name> · phases K-L · <done>/<total> tasks · PR: open | → PR <sha> | merged → <id> | merged | after verify
```

`merged` is a merged last PR checkpoint; `after verify` is the last module, which carries no PR checkpoint task.
