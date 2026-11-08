# unikit-implement — test runs

Read **only when the plan's `## Settings` says `Testing: yes`**, once, at plan load (`/unikit-implement` Step 1) — by `/unikit-implement` and by `unikit-implement-coordinator` alike. The skill's Steps 2.5, 3.2 (a task carrying a `Test checkpoint:` line), 3.4 (recording a run) and 3.8 follow this file. A plan with `Testing: no` never reads it. `/unikit-fix` reads `.unikit/system/test-run-width.md` alone, for the test run after a fix (its Step 4.2).

The width of a run, what stops it and when it is green are in `.unikit/system/test-run-width.md`: read it once, the first time a run is due. The file is missing → run every test in the project in one run, and print `WARN [testing] test-run reference missing — every test is run; run unikit-ai update`.

## Step 2.5 — Resolve test-run checkpoints in scope

1. **Collect the scope's run points** — the checklist tasks inside this invocation's scope that carry a `Test checkpoint:` line. Only the manifest's checklist is read; no phase file is opened for this.
2. **Pick up what earlier calls deferred.** A test-checkpoint task still `- [ ]` whose marker `⏭️ MERGED → task N.M` points at a target that is also `- [ ]` is an unclosed obligation: its coverage joins this scope.
3. **Count the points** — every point of item 1, the final full run (`Test checkpoint: plan`) included. Deferred work (item 2) is not counted: its place is fixed by item 4. **The final full run is the merge target, never merged away and never moved:** inside the scope it stands last and keeps its own run, and the other points merge into it — a run of every test covers whatever they covered. A phase point and the final run are therefore already two points, and the question is asked.
4. **Deferred work runs at the scope's last run point, whatever the answer below** — its coverage joins that point's union; when the scope holds no run point of its own, it runs at the **end of the scope**, after the last task; that run is recorded like a point (Step 3.2, item 7, its coverage the union of the deferred tasks' coverage) and closes them (item 9). **The last point** is the last one in execution order: the point of the scope's phase that runs last (in the coordinator, a point of the last layer that holds one), never simply the last line of the checklist.
5. **Fewer than two → nothing to merge:** mark nothing and ask nothing.
6. **Two or more → one decision for this call:**
   - **`$ARGUMENTS` carries a test-run instruction** (Step 0.1) that names the end of the scope, its last point, or every point → it is the answer; nothing is asked. An instruction naming another point is no answer — ask.
   - **Otherwise ask once**, in the same call of the question tool of your agent (`AskUserQuestion`) as the Step 0.2 question when there is one. Before the call, print the points as plain markdown in a block of their own:

     ```
     Test runs in this scope: <k> points
     - task 5.5 — phase 5
     - task 6.8 — phase 6
     ```

     Two options: `One run at the end — task <N.M>` (the last point) · `At every point, as planned`.
   - **No answer** — a non-interactive run, or a reply that picks neither option → the points run as written.
7. **The answer holds for this call only.** On disk it survives solely as the `⏭️ MERGED` marks.
8. **One run at the end → mark first, then execute.** Carry out the Step 0.2 answer first (a stash must not take the marks with it; after a stash the manifest was re-read and items 1–5 recounted — a recount that leaves fewer than two points drops the answer: nothing is marked, and the INFO line says `nothing to merge`). Then, in a single `Edit` over the manifest, append `⏭️ MERGED → task <N.M>` to every point except the last one (item 4), leaving each checkbox `- [ ]`. The last point's coverage at run time is the **union** of everything merged into it (Step 3.2).

**Counting rule for `⏭️ MERGED`.** A test-checkpoint task carrying the marker and still `- [ ]` **does not count as pending for its own run**: its obligation is carried by the marker's target. It stops blocking "all tasks are completed" only once that target is `- [x]` or a later run has carried its coverage — it is then ticked itself (Step 3.2, item 9); until then it is a visible obligation, and the next invocation picks it up (item 2).

**Verbose.** One line always, naming where the decision came from:

```
INFO [testing] checkpoints=<value from the plan|legacy> · merge=<true|false> (<asked|arguments|no answer|nothing to merge>)
```

A merge adds `INFO [testing] merged <n> point(s) into task <N.M> (scope: <scope>)`; picked-up deferred work adds `INFO [testing] deferred points picked up: <n>`. If the marks cannot be written (the `Edit` failed), do not merge: the points run as written, and `WARN [testing] merge mark not recorded — points run as written`.

## Step 3.2 — A test-checkpoint task

**A task carrying a `Test checkpoint: <coverage>` line** is a test-checkpoint task. It leaves no project file changed; its work is one test run, plus the non-run steps of item 3.

1. **Merged?** It carries the marker `⏭️ MERGED → task N.M` (Step 2.5) → **neither its run nor its non-run steps are performed here** — both travel to the target. The task stays `- [ ]`; move on.
2. **Derive the run's target from the coverage, by `.unikit/system/test-run-width.md`** — a run is never narrower than its coverage:
   - `task N.M` → the fixtures and classes named by that task's `### Tests`;
   - `phase N` / `phases N-M` → every test in the project, or — with `testing.run.use_affected_modules: true` — the affected test suites, plus the coverage of everything merged into this point;
   - `plan` → **every test in the project**, unfiltered — unless the point is closed by reuse (item 4).
3. **The phase's tests, then the non-run steps, come first.** A phase that has not run `## Step 3.8` yet writes its tests now, for the logic its tasks changed so far: a test written after the run reaches no run of this phase, and none at all after the plan's last one. In `unikit-implement-coordinator`, a phase a worker executed has already written its tests with its tasks — that counts as Step 3.8, and the coordinator writes tests here only for a phase it executed itself. Then, before its run, the task performs its own non-run steps and, at a point that others were merged into, the non-run steps of every task merged into it, in checklist order — a negative control (create the temporary probe, see the test go red, remove the probe, see it green) or a manual smoke with the evidence it names. Their text is in each task itself: its checklist line, or in an ultra bundle its `## Task N.M:` section in its phase file, read now. A failed step is a Step 3.3 blocker, exactly like a red run.
4. **The final full run may be closed by reuse.** Only for `Test checkpoint: plan`, and only when neither the point nor any task merged into it or carried by it has non-run steps (item 3). Compute the current tree hash by the procedure of item 8. A `Full run:` anchor line in `## Test Runs` whose `tree-sha256` equals that hash — never `unavailable` — and whose count is above zero is a run of every test over exactly this tree, so **no run is started**: record the reuse (item 7) and close the point (item 9). The hash differs, the anchor is missing or cannot be parsed, git is unavailable → run as usual. The final run stays mandatory: it is closed by a run of every test over this very tree, made earlier in the plan.
5. **Start the run** — **one** launch (`.unikit/system/test-run-width.md` → `### One run`) and `### One scope, one launch` — by the engine's own means, exactly as any other check in this step does (through an engine bridge when one is configured). Wait for the result.
6. **A red run, or a run that is not green by `.unikit/system/test-run-width.md` → `### What counts as green`, goes to the blocker loop (Step 3.3).** After the fix the run is repeated — as one launch of the whole scope (`.unikit/system/test-run-width.md` → `### One scope, one launch`). A red run is never ticked `[x]`, and never quietly demoted to a warning.
7. **A green run is recorded in the manifest**, by the same `Edit` that ticks the checkbox (Step 3.4):
   - append a bullet to `## Test Runs`: `<date> · <coverage> · <what ran> · passed N/N · tree-sha256 <hash>`;
   - **for every run that ran every test in the project, additionally** rewrite the anchor line `Full run: <date> · all tests · passed N/N · tree-sha256 <hash>` — `Test checkpoint: plan`, a phase point under `use_affected_modules: false`, and a narrowed run that `.unikit/system/test-run-width.md` widened to every test alike;
   - **a reuse (item 4)** appends `<date> · plan · reused: the full run of <anchor date>, tree unchanged · passed N/N · tree-sha256 <hash>`, with `N/N` copied from the anchor, and leaves the anchor line as it is;
   - `<date>` comes from `Bash(date *)`; `<hash>` from the procedure below.
   - `<what ran>` names the non-run steps of item 3 and the deferred tasks the run carried as well — e.g. `12 test suites of phases 5-6 + task 5.5: negative control red→green, smoke ✓ + deferred task 4.6`.

   The plan carries no `## Test Runs` section (a legacy plan) → create it at `##` level, under `## Rule Candidates`, or above `## Dependency Graph` when that one is absent too. A balance plan whose manifest lost its `## Measurements` gets it created the same way, directly after `## Test Runs` — `{{skills_dir}}/{{self_name}}/references/balance-measure.md` → `## Step 3.2 — a Measure: task`.
8. **`tree-sha256` is computed by the one tree-hash command below.** Nothing is read for it mid-run:

   ```
   node .unikit/system/tree-hash.mjs
   ```

   Run it from the project root. It prints a digest of the project's content, one git blob id per file, and needs no Git Bash and no Unix utility. An edit, a new file, a deletion and a rename move it. A commit that moves no file, staging, a submodule's own state, a change of a file's mode alone, Markdown files (`*.md`, any case — documentation: the plan's closing documentation step writes them after the final run, and in a game project no test runs one) and `.unikit/`, where the plan records its own progress, never do. A project that sits in a subdirectory of the repository counts its own files only: a change next to it does not move the hash, even when the project's tests depend on that file. You read no project file for it — git hashes only the changed ones. **A non-zero exit, or no `node` → git did not answer:** the command prints no digest, so the field is written as `tree-sha256 unavailable`; the run is still recorded, and `/unikit-verify` does not reuse such a run.
9. **Close the merged and the carried tasks.** After a green run or a reuse, tick `- [x]` every task whose marker points at this run point and every deferred task whose coverage this run carried (Step 2.5, item 2 — its marker still names the point it was first merged into), keeping the marker in its text: it explains why that task has no line of its own in `## Test Runs`.

**Verbose.** The width lines — the settings, the run, the safety valve, a widening — are in `.unikit/system/test-run-width.md`. Here: `INFO [testing] final run reused — full run of <date>, tree unchanged` on a reuse; `INFO [testing] deferred task(s) closed: <tasks>` after a green run or a reuse that carried them; `WARN [testing] the tree-hash command did not answer — tree-sha256 unavailable`. A red run is reported by the Step 3.3 blocker, not by a second line here. A run that never started — the runner is busy, or it timed out — is a Step 3.3 blocker and **not** a lifted gate: lifting is `/unikit-verify`'s decision, and the executor does not take it.

## Step 3.4 — Recording a run

A test-checkpoint task is ticked by the same `Edit` that writes its entry into `## Test Runs` — a reuse entry included — and that same `Edit` closes the tasks merged into it and the deferred tasks it carried (Step 3.2, item "Close the merged and the carried tasks").

## Step 3.8 — Writing tests

**This step only WRITES tests and never runs them** (REQ-002). A run is a separate test-checkpoint task in the checklist (Step 3.2). Writing tests is not constrained by the `Test checkpoints` policy: tests are written in any task of any phase, exactly as before. The one exception is an edit the user makes in answer to a handed-over result — the review loop, `dev-principles.md` item 5a: it gets its tests after acceptance, not here. A phase's own Step 3.8 inside the run is outside that loop.

Write tests for the logic created or modified in a phase **before the phase's first test-checkpoint task that runs** (Step 3.2, item 3), so that run covers them; a phase without one gets them after all its tasks are completed, and so does logic its tasks changed after that run — usually none, because a phase's checkpoint stands last. Inline by default, or via `develop-agent` for a parallel scope or a deep-dive task, by the same choice as Step 3.2. Use:
1. the list of files created or modified in the phase;
2. the relevant part of the manifest's `## Technical Context` (constraints, interfaces, key patterns, editor targets) — in an ultra bundle the manifest carries only the cross-phase part, and the task's own `### Tests` sits in its phase file;
3. the rules and principles loaded at Bootstrap (Step 1.5) and in the Phase Rules Refresh (Step 3.0).

Tests written here are included in the phase commit.

**After acceptance.** The classes of target are item 5 of `dev-principles.md`; the tests of the review loop (item 5a) are written once, after acceptance, for the logic changed since the last commit. The run that follows is not part of this step: it is one run recorded by Step 3.2, items 5–9, with coverage `plan` — only in a plan with `Testing: yes` and a manifest, so that `/unikit-verify` does not ask to repeat it. Under `Testing: yes` with no manifest → one run, no record. No plan → the run is asked for (`dev-principles.md` item 5a).
