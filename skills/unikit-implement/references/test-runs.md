# unikit-implement — test runs

Read **only when the plan's `## Settings` says `Testing: yes`**, once, at plan load (`/unikit-implement` Step 1) — by `/unikit-implement` and by `unikit-implement-coordinator` alike. The skill's Steps 2.5, 3.2 (a task carrying a `Test checkpoint:` line), 3.4 (recording a run) and 3.8 follow this file, and so does every `unikit-commit` call of the run (`## Carrying the anchor across a commit`). A plan with `Testing: no` never reads it. `/unikit-fix` reads `## Run width` alone, for the test run after a fix (its Step 4.2).

## Step 2.5 — Resolve test-run checkpoints in scope

1. **Collect the scope's run points** — the checklist tasks inside this invocation's scope that carry a `Test checkpoint:` line. Only the manifest's checklist is read; no phase file is opened for this.
2. **Pick up what earlier calls deferred.** A test-checkpoint task still `- [ ]` whose marker `⏭️ MERGED → task N.M` points at a target that is also `- [ ]` is an unclosed obligation: its coverage joins this scope.
3. **Count the mergeable points** — those of item 1 other than `Test checkpoint: plan`. Deferred work (item 2) is not counted: its place is fixed by item 4. **The final full run (`Test checkpoint: plan`) is never merged and never moved:** inside the scope it stays a point of its own and stands last.
4. **Deferred work runs at the scope's last run point, whatever the answer below** — its coverage joins that point's union; when the scope holds no run point of its own, it runs at the **end of the scope**, after the last task; that run is recorded like a point (Step 3.2, item 7, its coverage the union of the deferred tasks' coverage) and closes them (item 9). **The last point** is the last one in execution order: the point of the scope's phase that runs last (in the coordinator, a point of the last layer that holds one), never simply the last line of the checklist.
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
8. **One run at the end → mark first, then execute.** Carry out the Step 0.2 answer first (a stash must not take the marks with it; after a stash the manifest was re-read and items 1–5 recounted — a recount that leaves fewer than two points drops the answer: nothing is marked, and the INFO line says `nothing to merge`). Then, in a single `Edit` over the manifest, append `⏭️ MERGED → task <N.M>` to every mergeable point except the last one (item 4), leaving each checkbox `- [ ]`. The last point's coverage at run time is the **union** of everything merged into it (Step 3.2).

**Counting rule for `⏭️ MERGED`.** A test-checkpoint task carrying the marker and still `- [ ]` **does not count as pending for its own run**: its obligation is carried by the marker's target. It stops blocking "all tasks are completed" only once that target is `- [x]` or a later run has carried its coverage — it is then ticked itself (Step 3.2, item 9); until then it is a visible obligation, and the next invocation picks it up (item 2).

**Verbose.** One line always, naming where the decision came from:

```
INFO [testing] checkpoints=<value from the plan|legacy> · merge=<true|false> (<asked|arguments|no answer|nothing to merge>)
```

A merge adds `INFO [testing] merged <n> point(s) into task <N.M> (scope: <scope>)`; picked-up deferred work adds `INFO [testing] deferred points picked up: <n>`. If the marks cannot be written (the `Edit` failed), do not merge: the points run as written, and `WARN [testing] merge mark not recorded — points run as written`.

## Step 3.2 — A test-checkpoint task

**A task carrying a `Test checkpoint: <coverage>` line** is a test-checkpoint task. It leaves no project file changed; its work is one test run, plus the non-run steps of item 3.

1. **Merged?** It carries the marker `⏭️ MERGED → task N.M` (Step 2.5) → **neither its run nor its non-run steps are performed here** — both travel to the target. The task stays `- [ ]`; move on.
2. **Derive the run's target from the coverage, by `## Run width`** — a run is never narrower than its coverage:
   - `task N.M` → the fixtures and classes named by that task's `### Tests`;
   - `phase N` / `phases N-M` → every test in the project, or — with `testing.run.use_affected_modules: true` — the affected test suites, plus the coverage of everything merged into this point;
   - `plan` → **every test in the project**, unfiltered — unless the point is closed by reuse (item 4).
3. **The phase's tests, then the non-run steps, come first.** A phase that has not run `## Step 3.8` yet writes its tests now, for the logic its tasks changed so far: a test written after the run reaches no run of this phase, and none at all after the plan's last one. In `unikit-implement-coordinator`, a phase a worker executed has already written its tests with its tasks — that counts as Step 3.8, and the coordinator writes tests here only for a phase it executed itself. Then, before its run, the task performs its own non-run steps and, at a point that others were merged into, the non-run steps of every task merged into it, in checklist order — a negative control (create the temporary probe, see the test go red, remove the probe, see it green) or a manual smoke with the evidence it names. Their text is in each task itself: its checklist line, or in an ultra bundle its `## Task N.M:` section in its phase file, read now. A failed step is a Step 3.3 blocker, exactly like a red run.
4. **The final full run may be closed by reuse.** Only for `Test checkpoint: plan`, and only when neither the point nor any task merged into it or carried by it has non-run steps (item 3). Compute the current tree hash by the procedure of item 8. A `Full run:` anchor line in `## Test Runs` whose `tree-sha256` equals that hash — never `unavailable` — and whose count is above zero is a run of every test over exactly this tree, so **no run is started**: record the reuse (item 7) and close the point (item 9). The hash differs, the anchor is missing or cannot be parsed, git is unavailable → run as usual. The final run stays mandatory: it is closed by a run of every test over this very tree, made earlier in the plan.
5. **Start the run** — **one** launch (`## Run width` → `### One run`) and `### One scope, one launch` — by the engine's own means, exactly as any other check in this step does (through the engine MCP when one is configured). Wait for the result.
6. **A red run, or a run that is not green by `## Run width` → `### What counts as green`, goes to the blocker loop (Step 3.3).** After the fix the run is repeated — as one launch of the whole scope (`## Run width` → `### One scope, one launch`). A red run is never ticked `[x]`, and never quietly demoted to a warning.
7. **A green run is recorded in the manifest**, by the same `Edit` that ticks the checkbox (Step 3.4):
   - append a bullet to `## Test Runs`: `<date> · <coverage> · <what ran> · passed N/N · tree-sha256 <hash>`;
   - **for every run that ran every test in the project, additionally** rewrite the anchor line `Full run: <date> · all tests · passed N/N · tree-sha256 <hash>` — `Test checkpoint: plan`, a phase point under `use_affected_modules: false`, and a narrowed run that `## Run width` widened to every test alike;
   - **a reuse (item 4)** appends `<date> · plan · reused: the full run of <anchor date>, tree unchanged · passed N/N · tree-sha256 <hash>`, with `N/N` copied from the anchor, and leaves the anchor line as it is;
   - `<date>` comes from `Bash(date *)`; `<hash>` from the procedure below.
   - `<what ran>` names the non-run steps of item 3 and the deferred tasks the run carried as well — e.g. `12 test suites of phases 5-6 + task 5.5: negative control red→green, smoke ✓ + deferred task 4.6`.

   The plan carries no `## Test Runs` section (a legacy plan) → create it at `##` level, under `## Rule Candidates`, or above `## Dependency Graph` when that one is absent too.
8. **`tree-sha256` is computed over a short text**, not over the project, and by the same procedure as `Summary SHA256` — its digest step, `.unikit/system/research-link.md` → `### Digest`. The command below is that step in full: nothing is read for it mid-run:

   ```
   { git rev-parse HEAD; { git diff HEAD --name-only --no-renames --ignore-submodules -- . ':(exclude).unikit' ':(exclude,icase)*.md'; git ls-files --others --exclude-standard --full-name -- . ':(exclude).unikit' ':(exclude,icase)*.md'; } | sort; { git diff HEAD --name-only --no-renames --ignore-submodules --diff-filter=d -- . ':(exclude).unikit' ':(exclude,icase)*.md'; git ls-files --others --exclude-standard --full-name -- . ':(exclude).unikit' ':(exclude,icase)*.md'; } | grep -v '/$' | sort | git hash-object --stdin-paths; } | shasum -a 256 | cut -d' ' -f1
   ```

   The text is the commit, every path that differs from it — tracked or new, sorted, so staging a file never moves it — and one git blob id for every changed or new file. An edit to a file that was already modified moves the hash; staging, a submodule's own state, Markdown files (`*.md`, any case — documentation: the plan's closing documentation step writes them after the final run, and in a game project no test runs one) and `.unikit/`, where the plan records its own progress, never do. Paths are read from the repository root, so the command answers the same from a project that sits in a subdirectory of it. You read no project file for it — git hashes only the changed ones. **Any `fatal:` line the command prints → git did not answer:** a path git could not hash drops every path after it from the text, so such a hash is never written — treat it as git unavailable. No `shasum` → `sha256sum`. Git unavailable → the field is written as `tree-sha256 unavailable`; the run is still recorded, and `/unikit-verify` does not reuse such a run.
9. **Close the merged and the carried tasks.** After a green run or a reuse, tick `- [x]` every task whose marker points at this run point and every deferred task whose coverage this run carried (Step 2.5, item 2 — its marker still names the point it was first merged into), keeping the marker in its text: it explains why that task has no line of its own in `## Test Runs`.

**Verbose.** The width lines — the settings, the run, the safety valve, a widening — are in `## Run width`. Here: `INFO [testing] final run reused — full run of <date>, tree unchanged` on a reuse; `INFO [testing] deferred task(s) closed: <tasks>` after a green run or a reuse that carried them; `WARN [testing] git unavailable — tree-sha256 unavailable`. A red run is reported by the Step 3.3 blocker, not by a second line here. A run that never started — the runner is busy, or it timed out — is a Step 3.3 blocker and **not** a lifted gate: lifting is `/unikit-verify`'s decision, and the executor does not take it.

## Step 3.4 — Recording a run

A test-checkpoint task is ticked by the same `Edit` that writes its entry into `## Test Runs` — a reuse entry included — and that same `Edit` closes the tasks merged into it and the deferred tasks it carried (Step 3.2, item "Close the merged and the carried tasks").

## Step 3.8 — Writing tests

**This step only WRITES tests and never runs them** (REQ-002). A run is a separate test-checkpoint task in the checklist (Step 3.2). Writing tests is not constrained by the `Test checkpoints` policy: tests are written in any task of any phase, exactly as before. The one exception is an edit the user makes in answer to a handed-over result — the review loop, `dev-principles.md` item 5a: it gets its tests after acceptance, not here. A phase's own Step 3.8 inside the run is outside that loop.

Write tests for the logic created or modified in a phase **before the phase's first test-checkpoint task that runs** (Step 3.2, item 3), so that run covers them; a phase without one gets them after all its tasks are completed, and so does logic its tasks changed after that run — usually none, because a phase's checkpoint stands last. Inline by default, or via `develop-agent` for a parallel scope or a deep-dive task, by the same choice as Step 3.2. Use:
1. the list of files created or modified in the phase;
2. the relevant part of the manifest's `## Technical Context` (constraints, interfaces, key patterns, editor targets) — in an ultra bundle the manifest carries only the cross-phase part, and the task's own `### Tests` sits in its phase file;
3. the rules and principles loaded at Bootstrap (Step 1.5) and in the Phase Rules Refresh (Step 3.0).

Tests written here are included in the phase commit.

**After acceptance.** The classes of target are item 5 of `dev-principles.md`; the tests of the review loop (item 5a) are written once, after acceptance, for the logic changed since the last commit. The run that follows is not part of this step: it is one run recorded by Step 3.2, items 5–9, with coverage `plan` — only in a plan with `Testing: yes` and a manifest, so that `/unikit-verify` does not ask to repeat it. No manifest → one run, no record.

## Carrying the anchor across a commit

A commit moves no file. The tree a run of every test covered is still on disk after it — but `git rev-parse HEAD` changed, and so did the hash of Step 3.2, item 8. Left alone, the `Full run:` anchor of every committed plan would read as stale to `/unikit-verify`. So **every `unikit-commit` call of this run** — a phase checkpoint, the Step 5.6 commit, a PR checkpoint's module commit, the commit before a `direct` editor edit — is wrapped in two steps:

1. **Before the call.** The manifest's `## Test Runs` holds a `Full run:` anchor whose `tree-sha256` is a hash, not `unavailable` → compute the tree hash by Step 3.2, item 8 — staging the commit's files first does not move it. Equal to the anchor's → this commit carries the anchor. Different → nothing to carry: the anchor describes another tree, and a commit does not make it describe this one.
2. **After the call** — only when it carries the anchor and `git rev-parse HEAD` moved — compute the hash again and, by one `Edit`, replace the anchor's `tree-sha256 <old>` with `tree-sha256 <new>`. Nothing else in the line changes: the date and the count stay, because no test ran again, and the bullets of `## Test Runs` are not touched. A cancelled or failed commit leaves `HEAD` where it was → nothing is written. The edit lands under `.unikit/`, which item 8 leaves out, so it does not move the hash it has just written.

Git unavailable → nothing is carried. A commit made outside this run — `/unikit-commit` called by hand — carries nothing either: `/unikit-verify` then reports the anchor stale, and `--strict` offers the run.

**Verbose.** `INFO [testing] Full run: anchor carried over commit <short sha>` after a carry; `INFO [testing] Full run: anchor not carried — the tree changed since the run of <date>` when an anchor was there and did not match.

## Run width

How wide a run goes once its coverage is known. Step 3.2 follows this section for a test-checkpoint task, and `/unikit-fix` Step 4.2 reads **this section alone** for the run after a fix — one policy, one place.

### Settings

Read `.unikit/config.yaml` once, the first time a width is derived in this session:

- `testing.run.use_affected_modules` — `true` → affected runs (below). `false`, the key absent, or no config file → **every test in the project**. Any other value → `false`, and `WARN [testing] testing.run.use_affected_modules=<value> is not true or false — every test is run`.
- `testing.run.full_run_threshold_percent` — read only when the first key is `true`. An integer from 1 to 100 → the safety-valve threshold. Key or file absent → `30`. Any other value → `30`, and `WARN [testing] testing.run.full_run_threshold_percent=<value> is not an integer from 1 to 100 — 30 is used`.

Neither key is recorded into the plan: they set the cost of executing a checkpoint, never what the checkpoint means. **The coverage is the floor of a run, never its ceiling** — a run may be wider than its coverage, never narrower.

### What a coverage runs

- `task N.M` → the fixtures and classes named by that task's `### Tests`, whatever the settings say.
- `phase N` / `phases N-M` → `use_affected_modules: false` → every test in the project; `true` → the affected test suites (below).
- `plan` → every test in the project, whatever the settings say.
- `/unikit-fix` has no coverage: its run follows the `phase` row, with the fix's changed files as the changed files.

### Affected test suites

**Dependent modules are found by name search, without building a graph.** The policy is engine-neutral and lives here; the mechanism is engine-specific and lives in the core rule `testing.md` loaded at Bootstrap: what declares a module, where references live, how a test suite is recognised.

1. Changed files: `git status --porcelain` plus the list of files this run has accumulated.
2. Walk up the directories to the nearest module manifest → the set of changed modules.
3. Find the referrers: search the module manifests for the names in that set. Repeat while the set keeps growing — in practice one or two iterations. This repeats the search, not a launch: no suite is started while it repeats.
4. Keep only the test suites from the result.
5. **Safety valve: when what remains is ≥ `full_run_threshold_percent` % of all the project's test suites, run everything.** **This threshold is assigned, not measured.**
6. **Degenerate cases → full run:** the engine has no module graph; the change landed in a default suite almost everything depends on; `testing.md` describes no mechanism for this engine; **nothing remains after step 4** — no test suite covers the changed modules or their referrers, and a run over zero suites would prove nothing.

**Reading every module manifest is forbidden.** The search returns paths, not contents.

### One run

Whatever the width, a run is **one** launch.

- The suites that remain are started in **one** run whose filter names every one of them. Take the filter parameter from the live tool schema of the engine MCP; how a server spells a list of suites is the server's business, not this file's.
- When that call cannot name every remaining suite in one filter — it takes a single name, or one of the suites has nothing the filter can address — run every test in the project instead, also in one launch.
- **Starting the suites one after another is forbidden.** Every launch pays the runner's fixed cost again, and a sequence of small runs is slower than one full run.

### One scope, one launch

The scope of a run is **closed before the first launch**, and the run is then started **once**. Close it whole, in this order:

1. The coverage of the run point (`### What a coverage runs`).
2. The coverage of every task merged into the point and of every deferred point this run carries (`## Step 2.5`).
3. With `use_affected_modules: true`, the dependent modules (`### Affected test suites`, steps 1-4).
4. The safety valve and the degenerate cases (`### Affected test suites`, steps 5-6), once, last.
5. The filter: it names only suites the search found, and it is sent after discovery has finished — otherwise it matches nothing and the run reads `passed 0/0`.

Then launch. Forbidden: a trial run to see what is red or what exists; growing the scope after the launch has started; one launch per merged point or per module. When the dependent modules cannot be determined with confidence, run every test — one wide run costs less than two narrow ones.

**A repeat after red is one launch of the whole scope.** For `phase N` / `phases N-M` and for the run after `/unikit-fix`, recompute the scope once over all the files changed so far, the fix included, and launch once; for `plan` it is every test in the project again; for `task N.M` the scope stays the fixtures and classes of that task's `### Tests`. A narrower check of the fixed test before the repeat is forbidden — the repeat is the check.

### What counts as green

A run is green only when its result is **readable** — passed and failed counts — and **the number of tests run is above zero**. `passed 0/0`, a result without counts, a timeout and a run that never started are not green: the filter matched nothing, discovery had not finished, or the run did not happen. In `/unikit-implement` that is a Step 3.3 blocker; in `/unikit-fix` it is a failed test check — except a run of every test in the project that reports zero tests: the project has no tests yet, and `/unikit-fix` notes `Test run: no tests in the project` instead of failing.

**Verbose.** Once, when the settings are first read: `INFO [testing] runs=<full|affected> · full-run threshold <n>% (<config|default>)` — the threshold part only for `affected`. Before each run: `INFO [testing] run <coverage>: <n> test suite(s) in one run`, or `INFO [testing] run <coverage>: every test` for a run of every test. `INFO [testing] safety valve: <n>/<total> ≥ <threshold>% — full run` when it fires; `INFO [testing] <case> — full run` on a degenerate case, the case named — `no module graph`, `no affected test suite`; `INFO [testing] filter cannot name every suite — full run` when the one-run rule widens the run.
