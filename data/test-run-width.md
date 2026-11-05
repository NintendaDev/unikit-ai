# Test run width

How wide a test run goes, what stops it and when it is green: one text for every skill that runs tests, delivered whichever skills are installed. Read once, the first time a run is due.

## Run width

How wide a run goes once its coverage is known. `/unikit-implement` Step 3.2 follows this file for a test-checkpoint task, `/unikit-fix` Step 4.2 for the run after a fix, `/unikit-execute` for a run the user chose, and `/unikit-verify` for unsaved editor state — one policy, one place.

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

Whatever the width, a run is **one** launch — except where the bridge cannot run the scope in one (`### One scope, one launch`, last paragraph).

- The suites that remain are started in **one** run whose filter names every one of them. Take the filter parameter from the live schema of the call on the engine bridge; how a server spells a list of suites is the server's business, not this file's.
- When that call cannot name every remaining suite in one filter — it takes a single name, or one of the suites has nothing the filter can address — run every test in the project instead, also in one launch.
- **Starting the suites one after another is forbidden.** Every launch pays the runner's fixed cost again, and a sequence of small runs is slower than one full run.

### One scope, one launch

The scope of a run is **closed before the first launch**, and the run is then started **once**. Close it whole, in this order:

1. The coverage of the run point (`### What a coverage runs`).
2. The coverage of every task merged into the point and of every deferred point this run carries (`## Step 2.5` of the `/unikit-implement` test-run reference).
3. With `use_affected_modules: true`, the dependent modules (`### Affected test suites`, steps 1-4).
4. The safety valve and the degenerate cases (`### Affected test suites`, steps 5-6), once, last.
5. The filter: it names only suites the search found, and it is sent after discovery has finished — otherwise it matches nothing and the run reads `passed 0/0`.

Then launch. Forbidden: a trial run to see what is red or what exists; growing the scope after the launch has started; one launch per merged point or per module. When the dependent modules cannot be determined with confidence, run every test — one wide run costs less than two narrow ones.

**A repeat after red is one launch of the whole scope.** For `phase N` / `phases N-M` and for the run after `/unikit-fix`, recompute the scope once over all the files changed so far, the fix included, and launch once; for `plan` it is every test in the project again; for `task N.M` the scope stays the fixtures and classes of that task's `### Tests`. A narrower check of the fixed test before the repeat is forbidden — the repeat is the check.

**A bridge that cannot run the scope in one launch splits it along its own boundary.** Its calibration, or the answer of its call, says where the boundary lies — two kinds of tests that cannot go in one call, a part that can only be started in the background. The scope is still closed whole before the first launch; then each part is launched once, and the run is over when every part has reported (`### What counts as green`). A repeat after red is the same launches again, one per part, over the scope recomputed once, and the narrower check stays forbidden. This is the only case in which a run is more than one launch.

### Unsaved editor state

A loaded scene or another open document with unsaved changes can stop a run or empty it: the bridge refuses to start, or reports a success with no tests. Check before the launch where the rule of the bridge says to, and read the refusal when it comes. You do not know what those changes are: they may be someone's work, or stale data left open while the file on disk is newer. A save writes them over the file, a discard loses them for good. **Never do either without an answer**, whatever a rule says about the state a run needs.

Ask once, as `.unikit/system/user-questions.md` says, naming every such document: `Unsaved changes stop the test run: <documents>. What do we do?`

- `I will save them myself (recommended)` — the user saves them and says so; check again and go on, and ask again if something is still unsaved.
- `Save and continue` — the current state, stale data included, is written over the files.
- `Discard all changes and continue` — the unsaved changes are lost for good.

A bridge with no such call → that option is left out. After a save or a discard, read back that nothing is unsaved before the launch. The answer covers these documents now: it spends neither the answer that allowed the run nor its repeat, and a later block asks again. Nobody to ask (the delegate mode, a non-interactive run) → no save, no discard and no run: note `Test run: blocked — unsaved changes in <documents>`.

**Verbose.** `INFO [testing] unsaved state: <the choice> — <documents>`.

### What counts as green

A run is green only when its result is **readable** — passed and failed counts — and **the number of tests run is above zero**. `passed 0/0`, a result without counts, a timeout and a run that never started are not green: the filter matched nothing, discovery had not finished, or the run did not happen. In `/unikit-implement` that is a Step 3.3 blocker; in `/unikit-fix` it is a failed test check — except a run of every test in the project that reports zero tests: the project has no tests yet, and `/unikit-fix` notes `Test run: no tests in the project` instead of failing.

A result that says **part of the run is still going** — a part the bridge started in the background and answered with a success flag — is not green either: the run is over when every part has reported, and a success flag of the call does not say so. Read such a part from the status the bridge keeps for the run (its calibration names where), and judge the run by all the parts together.

**Verbose.** Once, when the settings are first read: `INFO [testing] runs=<full|affected> · full-run threshold <n>% (<config|default>)` — the threshold part only for `affected`. Before each run: `INFO [testing] run <coverage>: <n> test suite(s) in one run`, or `INFO [testing] run <coverage>: every test` for a run of every test. `INFO [testing] safety valve: <n>/<total> ≥ <threshold>% — full run` when it fires; `INFO [testing] <case> — full run` on a degenerate case, the case named — `no module graph`, `no affected test suite`; `INFO [testing] filter cannot name every suite — full run` when the one-run rule widens the run.
