---
name: unikit-implement
description: >-
  Execute the tasks from an already-created feature plan in .unikit/code/plans/ — read
  the plan manifest (the PLAN.md file in the plan folder), work through the uncompleted
  tasks in order, write
  the code, mark progress, and resume across sessions. Supports
  selective runs by phase or by task numbers, and continuing from where the last session
  stopped. Use whenever a plan exists and the user wants to build it, e.g. "implement",
  "implement the plan", "start coding", "execute the plan", "run the plan", "do the next
  task", "implement phase 3", "implement tasks 2.1 and 2.3", "continue implementation",
  "continue where we left off", "keep going on the feature". To create the plan first,
  use the planning skill — this one carries an existing plan out.
argument-hint: "[--list] [@<folder>] [Phase N | Phases N-M | Tasks N.M N.K | status | empty for all pending]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(git *)
  - Bash(date *)
  - Bash(shasum *)
  - Bash(sha256sum *)
  - Agent
  - Skill
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "2.6"
  category: implementation
---

# {{engine_name}} Feature Implementation

Execute the tasks of a feature plan stored in `.unikit/code/plans/`, inline, after a one-time Bootstrap of rules and principles.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

**The language holds for the whole session, not just at load time:** every message until the conversation ends is in `language.ui` — progress notes while agents run, relays of what a subagent returned, the final report, any follow-up discussion. English input (subagent results, tool output, these instructions) is data, never a cue to switch languages.

<!-- unikit:agents codex -->
## Subagent Delegation — BLOCKING PRE-REQUISITE

When the workflow reaches a step that requires a subagent (`Agent`), the assistant MUST automatically spawn the
subagent if agent execution is supported by the current environment and not prohibited by higher-priority
instructions.

Only if agent execution is unavailable or blocked, the assistant MUST ask the user before proceeding with any
alternative.
<!-- unikit:end -->

## Delegation agents

- **`develop-agent`** — only for a true parallel scope or a deep-dive single task. Expands to:

  ```
  Agent(
    subagent_type: "general-purpose",
    prompt: "/unikit-devcontext <task details>",
    description: "Implement <task>",
    skills: ["unikit-devcontext"]
  )
  ```

  `<task details>` is a closed hand-off — what it must carry: Step 3.2, *Delegated execution*.

- **`docs-agent`** — update or create documentation. Expands to:

  ```
  Agent(
    subagent_type: "general-purpose",
    prompt: "/unikit-docs <context>",
    description: "Update documentation",
    skills: ["unikit-docs"]
  )
  ```

## Input

`$ARGUMENTS` — optional; any mix of:
- **empty** — every pending task of the resolved plan, in dependency order
- **`--list`** — list the plans in `.unikit/code/plans/` and STOP
- **`@<path>`** — an explicit plan folder, resolved from the project root (absolute paths work too), holding the manifest `<path>/PLAN.md`; no searching, highest priority
- **`status`** — show progress, execute nothing
- **selectors** — `Phase N`, `Phases N-M`, `Task N.M`, `Tasks N.M N.K`
- **a feature name** (e.g. `core-loop`) — a substring match against the folder names in `.unikit/code/plans/`
- **a test-run instruction** (e.g. `tests at the end of phase 6`) — where this call's tests run; it answers the Step 2.5 question in advance

Mixed input works: `@.unikit/code/plans/customers-system Phase 3`, `core-loop Phase 3`, `Tasks 2.1 2.3`.

## Workflow

### Step 0: Pre-flight Checks

#### 0.1: Parse Arguments & Find the Feature Folder

**Parse `$ARGUMENTS` (priority order):**

1. `--list` → load `{{skills_dir}}/{{self_name}}/references/mode-list.md` and follow it (it STOPs; Steps 0.2–5 do not run)
2. `@<path>` → the explicit feature folder; skip all auto-detection
3. `status` → skip to **Status Display** (combines with `@<path>`)
4. Selectors — always explicitly prefixed; bare numbers are never selectors, they may be part of a feature name
5. **A test-run instruction** — words saying where this call's tests run (`tests at the end of phase 6`, `тесты в конце фазы 6`, `run tests at every point`) → keep it for Step 2.5. It is neither a selector nor a feature name: recognise it **before** the selectors of item 4, because the phase number inside it names a run point and never narrows the scope.
6. What remains, when there is no `@<path>` → a feature name

**An `@<path>` that does not resolve** — no such folder, or no `<path>/PLAN.md` inside it:

```
Feature folder not found or invalid: <path>
Expected a folder with a PLAN.md manifest inside, for example:
  /unikit-implement @.unikit/code/plans/2026-03-10_core-loop

If this plan predates the manifest merge, run: unikit-ai update
```
→ STOP

**Neither `@<path>` nor a feature name → auto-detect** (priority order):

1. **Fast plan check** — if `.unikit/code/PLAN.md` exists, use it (flat fast-mode plan).

2. **Git branch match** — get current branch via `git branch --show-current`.
   If git is unavailable, skip to the next priority level.

   **Branch match.** From branch `<prefix><name>`, collect every folder in `.unikit/code/plans/` that matches any of the three name formats: (1) exactly `<name>` — the current format; (2) ending with `_<name>` — the `YYYY-MM-DD_<name>` format; (3) ending with `-<name>` and beginning with three digits — the legacy `DDD-<name>` format. Exactly one match → use it. **More than one → ask the user which one**, listing each with its `Updated:` — never by format precedence. No match → fall through to *latest*.

3. **Latest** (fallback) — read the `Updated:` line from each candidate's `.unikit/code/plans/<folder>/PLAN.md` and sort descending; ties break on `Created:` descending, then on folder name descending. A manifest with no `Updated:` is **excluded and named** — `WARN [plan] <folder>: manifest has no Updated: — excluded; run unikit-ai update to backfill it` — never guessed from the folder name or the file's mtime.
   **`latest fallback` is a guess, not a resolution:** the branch named no plan. With two
   or more plans present, print the candidate table (folder, `Updated:`, tasks remaining)
   and ask — never auto-select. With exactly one plan present there is nothing to choose
   between: announce it with the branch miss named in the reason and continue.

**Announce the resolution.** Print exactly one visible line before any other output:

```
INFO [plan] resolved: <path> (<reason>)
```

`<reason>` is exactly one of: `explicit path` · `feature name` · `fast plan` · `fix plan` ·
`branch match: <branch>` · `latest fallback`. This is plain output, never the payload of an
interactive question.

4. If `.unikit/code/plans/` is empty or absent and there is no `.unikit/code/PLAN.md`:
   - **`.unikit/code/FIX_PLAN.md` exists** → it was created by `/unikit-fix` and runs through the fix workflow: print `Fix plan detected (.unikit/code/FIX_PLAN.md) — launching /unikit-fix`, invoke `/unikit-fix` without arguments, and **STOP**.
   - **No plan at all** → ask, act on the answer, and **STOP**:

     ```
     No active plan found. Current branch: <current-branch>.

     Options:
     1. Plan a new feature — /unikit-plan full <description>
     2. Plan a quick task — /unikit-plan fast <description>
     3. Fix a bug — /unikit-fix <description>
     4. Just checking status — show branch info and stop
     ```

     Options 1-3 ask for the description, then run their command; option 4 shows `git branch --show-current` and `git log --oneline -5`.

**If both `.unikit/code/PLAN.md` and a folder plan resolved by the branch match exist**, the requested work decides — the tasks named by the selectors of item 4, or every task when there are none. Pending means at least one of those tasks is `- [ ]` in the plan's manifest checklist.
- **Pending in the folder plan** → use the folder plan without asking: the branch names it and the work is there. Announce `branch match: <branch>`, then print `INFO [plan] fast plan .unikit/code/PLAN.md not used — the branch plan has pending work (<selectors | all tasks>)`.
- **Nothing pending in the folder plan, but pending in the fast plan** → ask once: `Branch plan <folder> has nothing pending<, for the selectors>. Run the fast plan .unikit/code/PLAN.md?` — `Run the fast plan` (announce `fast plan`) · `Stop` (STOP). Without `AskUserQuestion`, the same two options as numbered text; end your turn and wait.
- **Pending in neither** → use the folder plan; Step 2 reports that nothing is left.

**Ultra bundle check.** Read the first line of the resolved plan manifest. If it equals `<!-- unikit:plan-mode:ultra -->`, this is an ultra bundle: follow `.unikit/system/ultra-plan-read.md` for reading depth, integrity and mutability. Otherwise continue unchanged.

**On resume**, re-read the active task's phase file, even when a previous session already read it.

#### 0.2: Check for Uncommitted Changes

Before any implementation work, check `git status`. If git is unavailable (not initialized), skip this step entirely and proceed to plan loading.

**If uncommitted changes exist**, the question is:

```
Uncommitted changes detected.

Options:
1. Commit now (recommended) — /unikit-commit, then continue
2. Stash and continue — git stash push -m "unikit-implement: stash before execution"
3. Continue as is — leave the working tree untouched
4. Cancel — "Implementation cancelled." → STOP
```

**Ask it right before Step 3, not here** — in one `AskUserQuestion` call together with the Step 2.5 question when Step 2.5 asks one, alone otherwise (numbered text, then end your turn, when the tool is absent). Carry out its answer first: a commit or a stash happens before any mark is written into the manifest. **After a stash, re-read the manifest** and recompute the scope and its run points (Steps 2 and 2.5) before any mark is written: `git stash push` reverts a tracked, uncommitted manifest underneath the scope already counted.

#### 0.3: Resume / Recovery (after `/clear` or session break)

If the user is resuming after a break, says the session was abandoned, or context was likely lost (e.g. after `/clear`), rebuild context from the repo before continuing. If git is unavailable, skip git commands and rely on plan file state only.

```bash
git status
git branch --show-current
git log --oneline --decorate -15
git diff --stat
```

Then reconcile plan state with reality:
- Read the plan manifest (`.unikit/code/plans/<folder>/PLAN.md`, or the flat `.unikit/code/PLAN.md`) and check which tasks are marked `[x]`
- For tasks marked `[x]`, spot-check that the corresponding code actually exists (read a key file or check for expected classes/methods)
- If code for a completed task is missing (e.g. after reset/rebase), revert the checkbox back to `- [ ]` and inform the user
- If code exists but the task isn't marked complete, mark it `[x]` and inform the user

### Step 1: Load Plan Context

- Read the **plan manifest** — `.unikit/code/plans/<folder>/PLAN.md`, or the flat `.unikit/code/PLAN.md`. Its section list: `unikit-plan/references/TASK-FORMAT.md` → *Plan Manifest Template*. In an ultra bundle every task's detail lives in its phase file; the reading depth is set by `.unikit/system/ultra-plan-read.md`.
- `## Based on` names a research → do **NOT** read its `RESEARCH.md` as a substitute for the plan's own context: the plan's `## Technical Context` supersedes it. The research is read for **one** purpose only — the drift check below.
- Read **`.unikit/DESCRIPTION.md`** — project specification, tech stack, constraints
- Read **`.unikit/ARCHITECTURE.md`** — project structure, tech stack, and pointers to detailed rules

**Research drift check** — only when `## Based on` has at least one entry. Read `.unikit/system/research-link.md` now, and only now, and run its `## Checking an entry` against every entry.

**If `.unikit/system/research-link.md` is missing or unreadable, do not block:** record no `Summary SHA256` and check none — print `WARN [research-drift]: research-link contract missing — drift detection off for this run; run unikit-ai update` once, and continue.

Drift is printed **once**, here at plan load — not before each task. Execution continues on the plan's scope; the re-plan offer goes into the Step 4 summary as its `Research drifted` line.

**Read `.unikit/skill-context/unikit-implement/SKILL.md`** — MANDATORY if the file exists. Project-specific overrides: a skill-context rule wins over a general rule of this skill on conflict; otherwise apply both.

**Parse Settings** from the manifest's `## Settings`:
- `Testing: yes | no` — whether tests are written (Step 3.8) and run (test-checkpoint tasks, Steps 2.5 and 3.2). Under `Testing: yes` read `{{skills_dir}}/{{self_name}}/references/test-runs.md` now, once — Steps 2.5, 3.2, 3.4 and 3.8 follow it; under `Testing: no` never read it. File missing or unreadable → print `WARN [testing] test-run reference missing — test-checkpoint tasks are reported as blockers; run unikit-ai update` and then: every test-checkpoint task is a Step 3.3 blocker, Step 2.5 asks nothing and marks nothing (the points stay as written), and Step 3.8 writes tests by the Step 3.2 choice.
- `Test checkpoints: task | phase | plan` → where the test-checkpoint tasks stand (Steps 2.5 and 3.2). **Line absent under `Testing: yes` → the plan is legacy:** its placement was never declared; its run points are run commands in the task text (`### Tests`, `### Verification`, the implementation steps) plus test-checkpoint tasks recognisable only by their heading. Confidence is lower here, and the Step 4 report says so in one line. Under `Testing: no` the line is omitted by design (`unikit-plan/references/TASK-FORMAT.md`), and such a plan is not legacy.
- `Docs: yes | no` → the documentation checkpoint of Step 5.3
- `Editor tasks: mcp | manual | direct` → how tasks carrying an `Editor:` line are carried out (Step 3.2). **Line absent:** `mcp` if MCP server `{{engine_mcp_tool}}` is present in `{{settings_file}}` at the project root (the Step 3.6 probe), otherwise `manual`. Never default to `direct` — it is irreversible and only ever an explicit choice.

No `## Settings` at all → `Testing: no`, `Docs: no`, and `Editor tasks` by the same probe.

### Step 1.5: Bootstrap Rules & Principles

Load the project knowledge base once, before the first task.

**Read in parallel:**
1. `.unikit/system/dev-principles.md` — **up to its lazy-read boundary**: find the marker line (`Grep -n '^<!-- === LAZY-READ BOUNDARY === -->'`) and `Read` the file with `limit` set to that line number. The part **below the marker is read once, at plan load, when the checklist carries an `Editor:` line** — the deep reference plus the editor procedures D6–D8 this skill follows; a plan without `Editor:` lines never reads it. An agent that cannot read with a limit reads the whole file.
2. `.unikit/RULES.md` — project overrides (highest priority). **Rule topics:** only the root here; the topic files its `## Topics` table lists load per phase in Step 3.0.
3. `.unikit/memory/code/RULES_INDEX.md` — index of core/stack rules
4. For EACH row in the Core table where Required By = `all` or contains `unikit-implement` — read that file from `.unikit/memory/code/core/` using the Read tool.

Stack rules and rule topics are NOT loaded here — they are loaded lazily per-phase in Step 3.0.

**Engine-MCP rules (conditional, engine-neutral) — once per session, zero calls:**

5. `.unikit/system/engine-mcp/INDEX.md`, **base section only** — the delivery stamp (`server:`) and every section **except** the `## Check` table, which is grepped per task, by area (Step 3.2).
6. `.unikit/MCP-RECHECK-NOTES.md`, **header only** (`server:` / `audited:`) — this project's own accumulated findings. Compare that header against the delivery stamp from item 5. On a mismatch print exactly one line and **apply the entries anyway**:

   ```
   WARN [engine-mcp] notes header ≠ configured server (<notes> ≠ <configured>)
   ```

   The entries are suspect, not void; retiring them belongs to `/unikit-mcp-audit`.

**Either file absent → skip it, print one line, and continue with every right you had:**

```
MCP rules: no INDEX.md — no known exceptions for this server, rights unchanged
```

No rules means no known exceptions, never no capabilities. Absence never disables the engine MCP and never turns a target into `⏸️ MANUAL` (`.unikit/system/dev-principles.md` → **A9**).

**Ultra plan bundle reader contract — only for an ultra bundle:**

7. `.unikit/system/ultra-plan-read.md` — **only when Step 0.1 found the marker `<!-- unikit:plan-mode:ultra -->`**: read it once — here, unless Step 0.1 already did — and follow it for detection, per-consumer reading depth, what is mutable during execution, and the blocking integrity checks. A plan without the marker never reads this file.
   **If `.unikit/system/ultra-plan-read.md` is missing or unreadable, do not block:** treat every plan as a single-file plan and continue exactly as before — a project that predates the ultra port has no bundles to read.

Keep an in-memory list of loaded rule file paths (`loaded_rules`). Used in Step 3.0 for delta detection.

### Step 2: Determine Work Scope

**If all tasks are completed (`- [x]`):**

```
All tasks in {feature-folder} are completed.
Nothing to implement.
```
STOP here.

**Counting rule for `⏸️ MANUAL`.** A task marked `- [x] … ⏸️ MANUAL` (Step 3.4) counts as **out of scope**, not as pending: it does not block "all tasks are completed" and it is never picked up again by a later run. It is also not counted as implemented — Step 4 reports it on its own line.

A merged test-checkpoint task is the other third outcome, and it counts differently — the counting rule is in `references/test-runs.md` → `## Step 2.5`.

**If `$ARGUMENTS` contains phase/task selectors:**

- Collect the pending tasks the selectors name (Step 0.1); a named task that is already completed is skipped, and the user is told.
- If a phase depends on an incomplete phase — its `**Dependencies:**` line in `## Checklist`, cross-checked against `## Dependency Graph` — warn `Phase {N} depends on Phase {M}, which has {X} incomplete tasks` and ask: implement Phase {M} first (recommended) · continue as is · skip Phase {N} and take the next independent phase

**If no selectors (execute all pending):**

Collect all pending tasks across all phases, respecting dependency order:
1. Start with phases that have no unmet dependencies
2. Within a phase, execute tasks in order (1.1, 1.2, 1.3...)
3. After completing a phase, check if any new phases are now unblocked

### Step 2.5: Resolve test-run checkpoints in scope

Runs **before** the first task, and only when `Testing: yes`: follow `references/test-runs.md` → `## Step 2.5` (read at Step 1). It may ask one question — in the same call as the Step 0.2 question when there is one.

### Step 3: Execute Tasks

Keep a running list of files you create, modify, or delete during execution — you'll need it for the completion summary and commit.

**3.0: Phase Rules Refresh (before starting each phase)**

Before executing the first task of any phase (including the first phase):
1. Re-read `.unikit/memory/code/RULES_INDEX.md`.
2. Match the phase name and its task descriptions against the Stack table's `Load When` column **and against the `Load when` column of the `## Topics` table in `.unikit/RULES.md`** (read at Step 1.5; a root without that table has no topics).
3. Compute delta: stack rules and topic files needed for this phase that are NOT in `loaded_rules`. A topic whose match is uncertain is needed.
4. Read each delta rule — a stack rule from `.unikit/memory/code/stack/`, a topic file from `.unikit/rules/` — using the Read tool. A topic file the table lists but the disk lacks → print `WARN [rules] topic file missing: .unikit/rules/<slug>.md` and continue.
5. Add them to `loaded_rules`.

Inside a phase, do NOT re-check rules between individual tasks — they share the same loaded set.

**Before starting the first task**, display the execution overview:

```
## Implementation Progress

✅ Completed: {X}/{total} tasks
🔄 Executing: Phase {N} — {Y} tasks pending in scope
⏳ Remaining after scope: {Z} tasks
```

For each task to execute:

**3.1: Present the task**

Show the user what you're about to implement:
```
## Phase {N}: {Phase Name}
### Task {N.M}: {task description}
Status: Pending
Dependencies: {met/unmet}
```

**3.2: Implement the task**

This skill writes sequential tasks itself, with `Read/Edit/Write/Bash` and the rules already loaded in Step 1.5 + Step 3.0. Do NOT invoke `/unikit-devcontext` via `Skill(...)`.

Choose execution mode:
- **Sequential within phase** (default for tasks that depend on each other or share files) → inline implementation. The skill writes code itself.
- **Independent across phases** (per the manifest's `## Dependency Graph`, e.g. Phase 3 and Phase 4 can run in parallel) → spawn `develop-agent` (Agent + /unikit-devcontext) per independent scope. Use ONLY for true parallelism.
- **Deep-dive single task** (requires extensive codebase exploration that would bloat parent context) → spawn `develop-agent` to isolate the exploration.

When implementing inline, use the rules from Bootstrap + Phase Rules Refresh, the principles from `dev-principles.md`, the task description from the manifest's `## Checklist`, and the technical context from its `## Technical Context`.

**In an ultra bundle the checklist line is a pointer, not the specification.** The task's specification is its `## Task N.M:` section in the phase file — `### Intent` through `### Verification` — and the manifest's `## Technical Context` supplies only the cross-phase part.

**Fallback:** If `Agent` tool is unavailable, do NOT invoke `/unikit-devcontext` inline (rules and dev-principles are already loaded in Step 1.5 / Step 3.0). Instead, degrade parallel scopes to sequential and continue the inline implementation cycle for ALL tasks. Each phase still triggers Step 3.0 Phase Rules Refresh.

**Tasks carrying an `Editor:` line** target the editor's serialized state, not source files. Handle each `Editor:` line — `[kind] <container> → <target> : <action>` — by the `Editor tasks` mode parsed in Step 1:

- **`mcp`** — carry it out through the engine MCP by `.unikit/system/dev-principles.md` → **D6**, on **every** such task; a call that misled you is a finding (**D7**); the library reference has two triggers and none of them is Bootstrap (**D8**). No rules file, or no check line for this area, changes nothing (A9).
- **`manual`** — do **not** touch any file. Mark the task `⏸️ MANUAL` (Step 3.4) and hand the user the exact instruction in the form `[kind] container → target : action`, one line per target.
- **`direct`** — **a rollback point must exist before editing** (this is mandatory and the whole reason the mode is gated):
  - Files this run changed and has not committed yet → stage only those and commit them through `/unikit-commit`, like every other commit of this run — never with a `git commit` of your own. The user cancels that commit, or it does not complete → do not edit: put the task back on `manual` and print `WARN [editor] <task>: no pre-edit commit — direct edit skipped, task back on manual` — without that commit there is no rollback point.
  - Nothing of this run is uncommitted → `HEAD` already is the rollback point: no commit is needed.
  - The target file itself has uncommitted changes this run did not make → a rollback would erase them. Before anything is staged, ask once with `AskUserQuestion` (numbered text, then end your turn, without the tool): `<target> has uncommitted changes that are not from this run` — `Commit them with the pre-edit commit` / `Leave this task on manual`. The first adds the target to the pre-edit commit; the second puts the task back on `manual` with that reason.

  Once the rollback point exists, edit the serialized format directly, staying inside the bounds §6 allows for that format. Never use `direct` for a format §6 rates 🔴.

  **§6 is owned by the `unikit-plan` skill** — read it from `references/ENGINE_RULES.md` inside that skill's own directory under `{{skills_dir}}`. This skill has no engine template of its own, so there is no local copy of §6 to read and none to keep in sync.

  **If that file is not there**, treat every format as 🔴: refuse `direct`, put the task back on `manual`, and state the reason in one line. Continuing silently is not an option here — a binary serialized format edited as text is not reversible by review, and this gate is the only thing standing in front of that. This is **not** the A9 case: what is missing is not a rule that would grant a right, it is the permission for an irreversible text edit, and withholding it changes nothing about the `mcp` route.

**A task carrying a `Test checkpoint: <coverage>` line** is a test-checkpoint task: it leaves no project file changed, and its work is one test run plus its non-run steps — `references/test-runs.md` → `## Step 3.2`.

**Delegated execution.** `<task details>` is a closed hand-off: whatever is not in it, the delegate does not see. When a task with `Editor:` goes to `develop-agent` or to `unikit-implement-worker`, the dispatch prompt MUST carry the `Editor:` lines **verbatim**, the already-resolved mode, and the matching `### EDITOR TARGETS` rows — from the manifest's `## Technical Context`, or in an ultra bundle from the task's own `### Required Interfaces and Contracts` in its phase file. A delegate that receives only the description implements the task as pure code and both mode gates are bypassed silently. **In an ultra bundle the whole task section goes into the prompt**, not just the `Editor:` lines: a delegate that receives only the checklist line loses the implementation steps, the contracts and the acceptance criteria along with the targets. `manual` is **never executed by a delegate** — the task comes back up marked `⏸️ MANUAL`.

**3.3: Handle Blockers**

If a task cannot be completed (compilation error, missing dependency, unclear requirement, etc.):

```
Blocker on task {N.M}

Problem: {description of what went wrong}

Options:
1. Skip and continue (task will be marked as blocked)
2. Change implementation approach
3. Stop implementation and discuss
```

Based on choice:
- Skip → mark task as blocked in the manifest, continue to next task
- Change approach → discuss alternative with user, retry task
- Stop → pause implementation → **STOP**

**3.4: Mark task as completed**

After successful implementation, update the manifest:
- Change `- [ ] {task}` to `- [x] {task}`
- If all tasks in a phase are done, update the phase status: `**Status:** [x] Completed`

**Editor task handed to the user (`Editor tasks: manual`)** — a third outcome, neither done nor pending:
- Write `- [x]` and append the marker `⏸️ MANUAL` to the task text: `- [x] Task 2.1 — wire the pause button ⏸️ MANUAL`. It counts by the `⏸️ MANUAL` rule of Step 2 and is reported separately (Step 4).

**The task produced an MCP finding (Step 3.2)** — append its row to the plan's `## MCP Findings` table in this same `Edit`, by `dev-principles.md` → **D7**: `F<n>`, `observed` from `Bash(date *)`, semantic dedup. Not at the end of the phase, not at the end of the run. In every case — an `Editor:` task or not (the Step 3.6 console read, a test run) — a misleading call is also a candidate line in the run report (the raw call and the raw answer), and `.unikit/MCP-RECHECK-NOTES.md` is never written from here.

**A test-checkpoint task (Step 3.2)** — ticked and recorded by `references/test-runs.md` → `## Step 3.4`.

**The task produced a rule candidate** — a further outcome, recorded in the same pass:
- Append a row to `## Rule Candidates`: `id | rule | full formulation | from | status`, with `status = open` and `from = task <N.M>`.
- **Id:** `R<n>`, one more than the highest already in the table — read it first: a re-run of the same task must not restart the numbering.
- `rule` carries **one line, one directive** — exactly what would go into `.unikit/RULES.md`. `full formulation` carries the long version with its rationale, under no length limit.
- **Dedup is semantic:** a candidate saying the same thing as a row already present — of any status, `declined` included — is not added.
- **Nothing here reaches `.unikit/RULES.md`.** Step 5.2 proposes the candidates to the user; only `/unikit-rules`, invoked with the batch the user selected, writes that file.
- The plan carries no `## Rule Candidates` section (a legacy plan) → create it at `##` level under `## MCP Findings`, or above `## Dependency Graph` when that one is absent too, and print `INFO [rules] section ## Rule Candidates created`.

Use the Edit tool to make these changes surgically.

**3.5: Progress report**

After each task (or batch of parallel tasks), briefly report:
```
✅ Task {N.M}: {one-line summary of what was done}
Progress: {completed}/{total} ({percent}%) · {remaining} remaining in scope
```

**3.6: Compilation & Console Check (after completing a phase)**

After all tasks in a phase are done, check {{engine_name}} console for compilation errors.

**Prerequisite:** Check if MCP server `{{engine_mcp_tool}}` is configured in `{{settings_file}}` at the project root. If MCP server `{{engine_mcp_tool}}` is not present in MCP settings — skip this step entirely and proceed to 3.7.

**If MCP server `{{engine_mcp_tool}}` is available:**

1. Read the {{engine_name}} console log via MCP server `{{engine_mcp_tool}}`, filtering for errors
2. Analyze each error:
   - **Error relates to code created/modified in the current phase** → fix it inline using the same execution mode logic as Step 3.2 (default: inline; develop-agent only for true parallel/deep-dive)
   - **Error relates to code planned in a future phase** (check remaining tasks in the manifest's `## Checklist`) → skip, note in progress report: `"Known error: {description} — will be resolved in Phase {N}, task {N.M}"`
   - **Error is pre-existing and unrelated to the current feature** → skip, do not touch
3. After fixing, re-read the console log to verify fixes didn't introduce new errors
4. Repeat the check→fix cycle until no errors from the current phase remain

**Do NOT proceed to commit (3.9) with compilation errors that belong to the current phase.** Future-phase errors are acceptable.

**3.7: Update context artifacts (if project structure changed)**

After completing a phase, check whether the implementation introduced structural changes that should be reflected in context files:

- **If the tech stack changed** (new dependencies, integrations, or tools added) → update `.unikit/DESCRIPTION.md` with factual deltas only. Do not rewrite — add or modify the relevant section.
- **If new modules, directories, or layers were added** → update `AGENTS.md` — refresh the project structure tree and key entry points table to reflect new directories/files.
- **If new modules or dependency rules changed** → update `.unikit/ARCHITECTURE.md` — add new modules to the folder structure section and update dependency constraints if needed.

Skip this step if the phase only modified existing files without structural changes.

**3.8: Tests (after completing a phase, if Testing: yes)**

`Testing: yes` → `references/test-runs.md` → `## Step 3.8`. `Testing: no`, or no `## Settings` at all → skip this step.

**3.9: Commit checkpoint (after completing a phase)**

After all tasks in a phase are completed (and tests written if applicable), ask:

```
✅ Phase {N} complete — {count} tasks done.

💾 Commit checkpoint. Commit changes?

Options:
1. Yes, commit — /unikit-commit with this phase's files
2. No, continue to next phase
3. Disable checkpoints — no more commit questions this session
```

Staging: **Important Rules** → *Commit only your own changes*.

Do not suggest a message here. `/unikit-commit` writes it from the plan's `## Overview` and this phase's `WHY:` lines; a subject assembled from a phase title is exactly the technical message its contract rules out.

A scope of many phases: suggest `/compact` or `/clear` before the next phase.

**3.10: Check ROADMAP.md progress (after all phases in scope are done)**

If `.unikit/ROADMAP.md` exists:
1. Read it
2. If the plan file includes `## Roadmap Linkage` with a non-`none` milestone, prefer that milestone for completion marking
3. Check if the completed work corresponds to any unchecked milestone
4. If yes — mark it `[x]` and add entry to the Completed table with today's date
5. Tell the user which milestone was marked done
6. If milestone mapping is ambiguous, emit `WARN [roadmap]` and suggest: `/unikit-roadmap check`

### Step 4: Completion Summary

After all tasks in scope are done:

```
## Implementation Summary

Feature: {feature-folder}
Scope: {all / Phase N / Tasks N.M, N.K}

Completed:
- Task {N.M}: {summary}
- Task {N.K}: {summary}
...

Manual (editor targets):
- Task {N.M}: {[kind] container → target : action}
...

Affected files:
- Created: {list of created files}
- Modified: {list of modified files}
- Deleted: {list of deleted files}

Remaining tasks: {count} (in {phases} phases)
Documentation: {delegated to docs-agent | updated via /unikit-docs (fallback for docs-agent) | warn-only (Docs: no/unset)}
Test checkpoints: legacy — placement not declared, runs found from the task text
Research drifted — consider /unikit-improve <plan> before continuing
```

The `Research drifted` line appears **only** when the Step 1 drift check emitted at least one `WARN [research-drift]`, and is omitted otherwise; it never stops the run.

The `Documentation:` line is the one Step 5.3 names; its value follows from `Docs:` and from whether the `Agent` tool exists, both known at Step 1. The `Test checkpoints: legacy` line appears only for a legacy plan under `Testing: yes` (Step 1) and is omitted otherwise.

The `Manual (editor targets)` block lists every task marked `⏸️ MANUAL` with its exact instruction, and is **omitted entirely** when there are none.

### Step 5: Post-Completion Actions

After all tasks in the current scope are done, perform the following actions.

**IMPORTANT:** Step 5.3 delegates to `docs-agent` and does NOT wait for it. **Step 5.2 blocks on the user** — it never writes a rule without an answer. Steps 5.4–5.8 are sequential and may involve user interaction.

**5.1: Check TODO.md**

If `.unikit/TODO.md` exists, tick every open task (`- [ ]` → `- [x]`, with `Edit`) that the completed work resolves — matched by meaning against the modified files, classes, methods and the plan's feature descriptions. No file, or no match → skip silently.

**5.2: Propose New Rules**

The candidates are already collected: the rows whose status is `open` in the manifest's `## Rule Candidates` (Step 3.4). This step formulates nothing anew — it proposes what is written down, and records the choice.

1. **No `open` candidate → silence** — not even a "no rules found" line.
2. **Select at most three** `open` candidates. The filter: a general convention for future code; not about one task; not a description of the current code; absent from `.unikit/RULES.md` and from `RULES_INDEX.md`; one line, one directive.
3. **Print the candidates as plain markdown, in a block of their own** — before the question:

   ```
   Project rule candidates:

   1. <the rule text, as it will be written>
      from: task 2.3
   2. <the rule text>
      from: task 4.1
   ```

   **Print first, ask second: the question mechanism carries the options and nothing else.**
4. **Ask once, with `AskUserQuestion` and `multiSelect`:** one option per candidate plus an explicit **"Add nothing"** — four options at most, the tool's limit. Keep the option label short; the full rule text goes in the option's `description`.
5. **No `AskUserQuestion` → the same list as a numbered text question**, answered by number. An agent without a structured-question tool presents the same options as plain text; that is the second and last tier.
6. **Nothing is written without an answer. Do NOT add any rules until the user answers.**
7. **What was selected goes to `/unikit-rules` as one numbered batch**, by the three-tier dispatch of Step 5.6: Tier 1 `Skill(skill: "unikit-rules", args: "<batch>")` inline, Tier 2 the inline slash form, Tier 3 printing the command. This is **a real call, not text in backticks**.
8. **Show the user the `## Batch result` table** the delegate returned, and update the statuses in `## Rule Candidates` from it: `added` for the rules it marked `added`, `declined` for those the user did not select. **`declined` is durable:** such a candidate is never offered again on a later run.
9. Only then proceed to Step 5.3.

**Verbose.** `INFO [rules] open candidates: <n>, proposed: <m>` before the block is printed. If the dispatch degenerated to Tier 3 (printing), the statuses are **not** set to `added` — the rule was not written; print `WARN [rules] /unikit-rules was not invoked — candidate statuses unchanged`. If the delegate returned no table, the statuses stand as well: `WARN [rules] the /unikit-rules report could not be parsed — candidate statuses unchanged`.

**5.3: Documentation Checkpoint**

**If `Docs: yes`** (from `## Settings`):

Delegate to `docs-agent` to update or create documentation based on completed work. Do NOT wait for the agent to finish — proceed to Step 5.4 immediately.

**Fallback** (no `Agent` tool): invoke `/unikit-docs` yourself — a real call, not a printed recommendation — wait for it to return, then proceed to Step 5.4.

**If `Docs: no` or the Settings section is missing:** do **not** delegate; emit `WARN [docs] Docs policy is no/unset; skipping documentation`.

The Implementation Summary (Step 4) carries one documentation line: `Documentation: delegated to docs-agent` · `Documentation: updated via /unikit-docs (fallback for docs-agent)` · `Documentation: warn-only (Docs: no/unset)`.

**5.4: Handle plan file after completion**

**If using the flat `.unikit/code/PLAN.md`** (fast-mode plan):

```
All tasks completed. Delete .unikit/code/PLAN.md? (It's no longer needed)

Options:
1. Yes, delete it
2. No, keep it
```

Yes → delete `.unikit/code/PLAN.md`; No → leave it.

**If using a folder plan** (`.unikit/code/plans/<folder>/`): keep it. **Never offer to delete `.unikit/code/plans/<folder>/PLAN.md`.** A finished folder plan leaves the active list only through `/unikit-archive`, which Step 5.8 names.

**5.5: MCP Findings handoff**

Read the plan's `## MCP Findings` table.

- **No rows** (or no such heading) → say nothing at all — not even a "no findings this run" line — and go to 5.6.
- **Rows present** → offer to move them to the durable surface:

```
<n> MCP findings recorded in this plan. Transfer them to .unikit/MCP-RECHECK-NOTES.md?
```

  On agreement, invoke `Skill(skill: "unikit-mcp-trap", args: "<path to the plan file>")` — the explicit path makes it read this plan and nothing else.

**5.6: Verify or Commit**

```
All tasks complete. What's next?

Options:
1. 🔍 Verify first — /unikit-review → /unikit-commit (recommended)
2. 💾 Skip to commit — /unikit-commit directly
```

Based on choice:
- **Verify first** → invoke `unikit-review`, wait for it to return, then invoke `unikit-commit`.
- **Skip to commit** → invoke `unikit-commit`.

**These are skill invocations, in this session — not delegations.** Three tiers, in order:

- **Tier 1 — primary (`Skill`).** `Skill(skill: "unikit-review")`, then `Skill(skill: "unikit-commit")`, inline, waiting for each to return before starting the next. This is the path on Claude Code.
- **Tier 2 — fallback (slash-command).** If the `Skill` tool is unavailable in this environment, **invoke `/unikit-review` inline**, then `/unikit-commit`, one at a time, waiting for each. The slash form is rewritten per agent by the installer; `Skill(...)` is not.
- **Tier 3 — degenerate (print).** Only when **no** inline invocation mechanism exists at all, print the ordered `Run: /unikit-…` list for the user to execute by hand.

The invocation must be **a real call, not printed text**, and must not be wrapped in triple backticks.

**Review is NOT delegated here — unlike Step 5.3.**

**5.7: Context Cleanup**

Suggest the user to free up context space if needed: `/clear` (full reset) or `/compact` (compress history).

**5.8: Next steps**

```
Next steps:
- {suggest what to do next — e.g. "Run /unikit-implement to continue from Phase 4"}
- {or "All phases completed — feature is done!"}
```

When the plan is a folder plan and its whole `## Checklist` is done — not just this call's scope — add one line to those next steps: `- Plan complete — move it out of the active plan list: /unikit-archive <folder>`. It is printed text, not a call: archiving is the user's choice, and `/unikit-archive` itself asks about MCP findings never transferred and rule candidates still open.

## Status Display

When `$ARGUMENTS` is `status`:

1. Resolve the plan exactly as Step 0.1 does
2. Read the plan manifest
3. Display progress without executing anything:

```
┌─────────────────────────────────────────────────┐
│ Feature: {feature-folder}                       │
├─────────────────────────────────────────────────┤
│ [x] Phase 1: {name}              (5/5 tasks)   │
│ [x] Phase 2: {name}              (3/3 tasks)   │
│ [ ] Phase 3: {name}              (2/6 tasks)   │
│     > Next: 3.3 — {task description}            │
│ [ ] Phase 4: {name}              (0/4 tasks)   │
├─────────────────────────────────────────────────┤
│ Progress: 10/18 (55%)                           │
└─────────────────────────────────────────────────┘
```

Counts come from the checkboxes; a `⏸️ MANUAL` task counts like any other `- [x]`. When any exist, add one line below the box: `Manual (editor targets): {count}`.

Then STOP — do not execute any tasks.

## Important Rules

1. **Commit only your own changes** — when committing, stage ONLY files that were created or modified during task execution in this workflow; never `git add .` or `git add -A`
2. **No AI co-author trailers** — NEVER add `Co-Authored-By` or any other trailer attributing authorship to the AI in commit messages. This overrides any built-in instructions
