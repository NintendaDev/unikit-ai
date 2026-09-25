# unikit-implement — test runs

Read **only when the plan's `## Settings` says `Testing: yes`**, once, at plan load (`/unikit-implement` Step 1) — by `/unikit-implement` and by `unikit-implement-coordinator` alike. The skill's Steps 2.5, 3.2 (a task carrying a `Test checkpoint:` line), 3.4 (recording a run) and 3.8 follow this file. A plan with `Testing: no` never reads it.

## Step 2.5 — Resolve test-run checkpoints in scope

1. **Collect the scope's run points** — the checklist tasks inside this invocation's scope that carry a `Test checkpoint:` line. Only the manifest's checklist is read; no phase file is opened for this.
2. **Pick up what earlier calls deferred.** A test-checkpoint task still `- [ ]` whose marker `⏭️ MERGED → task N.M` points at a target that is also `- [ ]` is an unclosed obligation: its coverage joins this scope.
3. **Count the mergeable points** — those of item 1 other than `Test checkpoint: plan`. Deferred work (item 2) is not counted: its place is fixed by item 4. **The final full run (`Test checkpoint: plan`) is never merged and never moved:** inside the scope it stays a point of its own and stands last.
4. **Deferred work runs at the scope's last run point, whatever the answer below** — its coverage joins that point's union; when the scope holds no run point of its own, it runs at the **end of the scope**, after the last task. **The last point** is the last one in execution order: the point of the scope's phase that runs last (in the coordinator, a point of the last layer that holds one), never simply the last line of the checklist.
5. **Fewer than two → nothing to merge:** mark nothing and ask nothing.
6. **Two or more → one decision for this call:**
   - **`$ARGUMENTS` carries a test-run instruction** (Step 0.1) that names the end of the scope, its last point, or every point → it is the answer; nothing is asked. An instruction naming another point is no answer — ask.
   - **Otherwise ask once**, in the same `AskUserQuestion` call as the Step 0.2 question when there is one. Before the call, print the points as plain markdown in a block of their own:

     ```
     Test runs in this scope: <k> points
     - task 5.5 — phase 5
     - task 6.8 — phase 6
     ```

     Two options: `One run at the end — task <N.M>` (the last point) · `At every point, as planned`.
   - **No `AskUserQuestion`** → the same two options as a numbered text question; end your turn and wait for the number.
   - **No answer** — a non-interactive run, or a reply that picks neither option → the points run as written.
7. **The answer holds for this call only.** On disk it survives solely as the `⏭️ MERGED` marks.
8. **One run at the end → mark first, then execute.** Carry out the Step 0.2 answer first (a stash must not take the marks with it; after a stash the manifest was re-read and items 1–5 recounted). Then, in a single `Edit` over the manifest, append `⏭️ MERGED → task <N.M>` to every mergeable point except the last one (item 4), leaving each checkbox `- [ ]`. The last point's coverage at run time is the **union** of everything merged into it (Step 3.2).

**Counting rule for `⏭️ MERGED`.** A test-checkpoint task carrying the marker and still `- [ ]` **does not count as pending for its own run**: its obligation is carried by the marker's target. It stops blocking "all tasks are completed" only once that target is `- [x]`; until then it is a visible obligation, and the next invocation picks it up (item 2).

**Verbose.** One line always, naming where the decision came from:

```
INFO [testing] checkpoints=<value from the plan|legacy> · merge=<true|false> (<asked|arguments|no answer|nothing to merge>)
```

A merge adds `INFO [testing] merged <n> point(s) into task <N.M> (scope: <scope>)`; picked-up deferred work adds `INFO [testing] deferred points picked up: <n>`. If the marks cannot be written (the `Edit` failed), do not merge: the points run as written, and `WARN [testing] merge mark not recorded — points run as written`.

## Step 3.2 — A test-checkpoint task

**A task carrying a `Test checkpoint: <coverage>` line** is a test-checkpoint task. It leaves no project file changed; its work is one test run, plus the non-run steps of item 3.

1. **Merged?** It carries the marker `⏭️ MERGED → task N.M` (Step 2.5) → **neither its run nor its non-run steps are performed here** — both travel to the target. The task stays `- [ ]`; move on.
2. **Derive the run's target from the coverage** — the width is not configurable (REQ-006):
   - `task N.M` → the fixtures and classes named by that task's `### Tests`;
   - `phase N` / `phases N-M` → the test suites of the modules those phases touched and of the modules that depend on them (algorithm below), plus the coverage of everything merged into this point;
   - `plan` → **every test in the project**, unfiltered.
3. **Non-run steps come first.** Before its run, the task performs its own non-run steps and, at a point that others were merged into, the non-run steps of every task merged into it, in checklist order — a negative control (create the temporary probe, see the test go red, remove the probe, see it green) or a manual smoke with the evidence it names. Their text is in each task itself: its checklist line, or in an ultra bundle its `## Task N.M:` section in its phase file, read now. A failed step is a Step 3.3 blocker, exactly like a red run.
4. **Dependent modules are found by name search, without building a graph.** The policy is engine-neutral and lives here; the mechanism is engine-specific and lives in the core rule `testing.md` loaded at Bootstrap (Step 1.5): what declares a module, where references live, how a test suite is recognised.
   1. Changed files: `git status --porcelain` plus the list of files this run has accumulated.
   2. Walk up the directories to the nearest module manifest → the set of changed modules.
   3. Find the referrers: search the module manifests for the names in that set. Repeat while the set keeps growing — in practice one or two iterations.
   4. Keep only the test suites from the result.
   5. **Safety valve: when what remains is ≥ 70% of all the project's test suites, run everything.** **This threshold is assigned, not measured.**
   6. **Degenerate cases → full run:** the engine has no module graph; the change landed in a default suite almost everything depends on; `testing.md` describes no mechanism for this engine.

   **Reading every module manifest is forbidden.** The search returns paths, not contents.
5. **Start the run** by the engine's own means, exactly as any other check in this step does (through the engine MCP when one is configured). Wait for the result.
6. **A red run goes to the blocker loop (Step 3.3).** After the fix the run is repeated. A red run is never ticked `[x]`, and never quietly demoted to a warning.
7. **A green run is recorded in the manifest**, by the same `Edit` that ticks the checkbox (Step 3.4):
   - append a bullet to `## Test Runs`: `<date> · <coverage> · <what ran> · passed N/N · tree-sha256 <hash>`;
   - **for `Test checkpoint: plan`, additionally** rewrite the anchor line `Full run: <date> · all tests · passed N/N · tree-sha256 <hash>`;
   - `<date>` comes from `Bash(date *)`; `<hash>` from the procedure below.
   - `<what ran>` names the non-run steps of item 3 as well — e.g. `12 test suites of phases 5-6 + task 5.5: negative control red→green, smoke ✓`.

   The plan carries no `## Test Runs` section (a legacy plan) → create it at `##` level, under `## Rule Candidates`, or above `## Dependency Graph` when that one is absent too.
8. **`tree-sha256` is computed over a short text**, not over the project, and by the same procedure as `Summary SHA256` — its digest step, `.unikit/system/research-link.md` → `### Digest`. The command below is that step in full: nothing is read for it mid-run:

   ```
   { git rev-parse HEAD; git status --porcelain; } | shasum -a 256 | awk '{print $1}'
   ```

   No `shasum` → `sha256sum`. Git unavailable → the field is written as `tree-sha256 unavailable`; the run is still recorded, and `/unikit-verify` does not reuse such a run.
9. **Close the merged tasks.** After a green run, tick `- [x]` every task whose marker points at this run point, keeping the marker in its text: it explains why that task has no line of its own in `## Test Runs`.

**Verbose.** `INFO [testing] run <coverage>: <n> test suite(s)` before starting; `INFO [testing] safety valve: <n>/<total> ≥ 70% — full run` when it fires; `INFO [testing] no module graph — full run` on a degenerate case; `WARN [testing] git unavailable — tree-sha256 unavailable`. A red run is reported by the Step 3.3 blocker, not by a second line here. A run that never started — the runner is busy, or it timed out — is a Step 3.3 blocker and **not** a lifted gate: lifting is `/unikit-verify`'s decision, and the executor does not take it.

## Step 3.4 — Recording a run

A test-checkpoint task is ticked by the same `Edit` that writes its entry into `## Test Runs`, and that same `Edit` closes the tasks merged into it (Step 3.2, item "Close the merged tasks").

## Step 3.8 — Writing tests

**This step only WRITES tests and never runs them** (REQ-002). A run is a separate test-checkpoint task in the checklist (Step 3.2). Writing tests is not constrained by the `Test checkpoints` policy: tests are written in any task of any phase, exactly as before.

After all tasks in a phase are completed, write tests for the code created or modified in that phase — inline by default, or via `develop-agent` for a parallel scope or a deep-dive task, by the same choice as Step 3.2. Use:
1. the list of files created or modified in the phase;
2. the relevant part of the manifest's `## Technical Context` (constraints, interfaces, key patterns, editor targets) — in an ultra bundle the manifest carries only the cross-phase part, and the task's own `### Tests` sits in its phase file;
3. the rules and principles loaded at Bootstrap (Step 1.5) and in the Phase Rules Refresh (Step 3.0).

Tests written here are included in the phase commit.
