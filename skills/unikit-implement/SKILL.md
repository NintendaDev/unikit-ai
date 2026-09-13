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

Execute tasks from a feature plan stored in `.unikit/code/plans/`. This skill reads the plan, identifies pending work, and implements tasks inline with `Read/Edit/Write/Bash` after a one-time Bootstrap of rules and principles. The `develop-agent` alias is reserved for true parallel scopes or deep-dive single tasks.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

<!-- unikit:agents codex -->
## Subagent Delegation — BLOCKING PRE-REQUISITE

When the workflow reaches a step that requires a subagent (`Agent`), the assistant MUST automatically spawn the
subagent if agent execution is supported by the current environment and not prohibited by higher-priority
instructions.

Only if agent execution is unavailable or blocked, the assistant MUST ask the user before proceeding with any
alternative.
<!-- unikit:end -->

## Delegation agents

This skill uses named delegation aliases for `Agent(...)` calls. Each alias expands to an `Agent(subagent_type: "general-purpose", ...)` invocation with the matching skill loaded.

- **`develop-agent`** — used ONLY for true parallel scopes or deep-dive single tasks. Sequential tasks are implemented inline by this skill using rules loaded in Bootstrap. Expands to:

  ```
  Agent(
    subagent_type: "general-purpose",
    prompt: "/unikit-devcontext <task details>",
    description: "Implement <task>",
    skills: ["unikit-devcontext"]
  )
  ```

  `<task details>` is a closed hand-off: whatever is not in it, the delegate does not see. When the task carries `Editor:` lines, they go into the prompt **verbatim**, together with the resolved `Editor tasks` mode and the matching `### EDITOR TARGETS` rows from the manifest's `## Technical Context` (Step 3.2, *Delegated execution*). **In an ultra bundle those rows are not in the manifest** — the task's editor targets live in the `### Required Interfaces and Contracts` of its own section in the phase file, and that is where they are taken from.

  Fallback: if the `Agent` tool is unavailable, invoke `/unikit-devcontext` inline.

- **`docs-agent`** — update or create documentation. Expands to:

  ```
  Agent(
    subagent_type: "general-purpose",
    prompt: "/unikit-docs <context>",
    description: "Update documentation",
    skills: ["unikit-docs"]
  )
  ```

  Fallback: if the `Agent` tool is unavailable, invoke `/unikit-docs` inline.

## Input

`$ARGUMENTS` — optional. Can be:
- **Empty** — execute all pending tasks from the latest feature, in order
- **`--list`** — list available feature plans in `.unikit/code/plans/` and STOP (no implementation)
- **`@<path>`** — explicit path to a feature folder, resolved from project root. Bypasses all auto-detection. Use when you need to point to a plan outside `.unikit/code/plans/` or want an unambiguous full path (e.g. `@.unikit/code/plans/2026-03-10_core-loop`, `@/absolute/path/to/plan-folder`)
- **`status`** — show progress without executing any tasks
- **`Phase N`** (e.g. `Phase 3`) — execute only tasks from Phase N
- **`Phases N-M`** (e.g. `Phases 1-3`) — execute tasks from Phases N through M
- **`Task N.M`** or **`Tasks N.M N.K`** (e.g. `Tasks 2.1 2.3 5.2`) — execute only the specified tasks
- **Feature name** (e.g. `core-loop`) — shorthand lookup: scans `.unikit/code/plans/` for a folder whose name **contains** this value. Compared to `@<path>`, this is a convenience shorthand that only searches inside `.unikit/code/plans/`

**`@<path>` vs Feature name:** `@` takes an explicit path (relative or absolute) and expects a folder holding a plan manifest — `.unikit/code/plans/<folder>/PLAN.md` — inside; no searching. A bare name without `@` is a fuzzy match inside `.unikit/code/plans/`. When both could apply, `@` wins (highest priority).

Mixed input is supported: `@.unikit/code/plans/2026-03-08_customers-system Phase 3` (explicit path + phase), `core-loop Phase 3` (name search + phase), `Tasks 2.1 2.3` (specific tasks from latest feature).

## Workflow

### Step 0: Pre-flight Checks

#### 0.1: Parse Arguments & Find the Feature Folder

**Parse `$ARGUMENTS` (priority order):**

1. If `$ARGUMENTS` contains `--list` → skip to **List Available Plans** section
2. If `$ARGUMENTS` contains `@<path>` → extract path after `@`, use as explicit feature folder (skip all auto-detection). See **Explicit Folder Override** below.
3. If `$ARGUMENTS` is or contains `status` → skip to **Status Display** section (can combine with `@<path>`)
4. Look for explicit selectors (can combine with `@<path>` or feature name):
   - `Phase N` — single phase
   - `Phases N-M` — phase range
   - `Task N.M` or `Tasks N.M N.K` — specific tasks
5. If no `@<path>` was found, check remaining args for a **feature name** — a bare string (no `@` prefix) that matches a folder name in `.unikit/code/plans/` by substring (e.g. `core-loop` matches `2026-03-10_core-loop`). This is a convenience shorthand that only searches inside `.unikit/code/plans/`.
6. Bare numbers without prefix are NOT selectors — they might be part of the feature name. Phases and tasks must be explicitly prefixed.

#### List Available Plans (`--list`)

If `$ARGUMENTS` contains `--list`, run read-only plan discovery and stop.

1. Get current branch: `git branch --show-current` (if git is unavailable, skip branch matching)
2. Scan `.unikit/code/plans/` for all feature folders
3. Check existence of `.unikit/code/FIX_PLAN.md`
4. For each feature folder, read its manifest (`.unikit/code/plans/<folder>/PLAN.md`) and count completed/total tasks
5. Print plan availability summary:

```
Available plans in .unikit/code/plans/:

  Branch match:
    core-loop                     (12/40 tasks, 30%)  ← matches current branch

  Other plans:                                        (newest first, by manifest Updated:)
    customers-system              (18/18 tasks, 100% — completed)
    2026-03-08_inventory-rework   (5/22 tasks, 23%)
    003-legacy-shop-rework        (7/9 tasks, 78%)

  Fix plan: .unikit/code/FIX_PLAN.md — exists

Usage:
  /unikit-implement                              — auto-detect by branch
  /unikit-implement @.unikit/code/plans/<folder>      — use specific plan
  /unikit-implement <folder-name> Phase 3        — specific folder + phase
```

**Important:** In `--list` mode — do not execute tasks, do not modify files. STOP after displaying the list.

#### Explicit Folder Override (`@<path>`)

If `$ARGUMENTS` contains `@<path>`:

1. Extract path after `@` (e.g. `@.unikit/code/plans/2026-03-08_customers-system` → `.unikit/code/plans/2026-03-08_customers-system`)
2. Resolve relative to project root (absolute paths are also valid)
3. If folder does not exist or does not contain a plan manifest (`<path>/PLAN.md`):
   ```
   Feature folder not found or invalid: <path>
   Expected a folder with a PLAN.md manifest inside, for example:
     /unikit-implement @.unikit/code/plans/2026-03-10_core-loop

   If this plan predates the manifest merge, run: unikit-ai update
   ```
   → STOP
4. Use this folder as the active feature — skip all auto-detection logic

The `@<path>` argument can be combined with selectors: `/unikit-implement @.unikit/code/plans/2026-03-08_customers-system Phase 3`

**Feature folder resolution priority:**
1. `@<path>` — explicit path, no searching (highest)
2. **Feature name** — bare string, substring match inside `.unikit/code/plans/`
3. **Auto-detect** — git branch match or latest by date (lowest, see below)

**If no feature folder specified (no `@<path>`, no feature name in args) — auto-detect:**

Use unified plan detection (priority order):

1. **Fast plan check** — if `.unikit/code/PLAN.md` exists, use it (flat fast-mode plan).
   Both plan forms are a single manifest: the flat `.unikit/code/PLAN.md` and the folder's
   `.unikit/code/plans/<folder>/PLAN.md` carry checklist, settings and `## Technical Context`
   inline. There is no second file to read.

2. **Git branch match** — get current branch via `git branch --show-current`.
   If git is unavailable, skip to the next priority level.

   **Branch match.** From branch `<prefix><name>`, collect every folder in `.unikit/code/plans/` that matches any of the three name formats: (1) exactly `<name>` — the current format; (2) ending with `_<name>` — the `YYYY-MM-DD_<name>` format; (3) ending with `-<name>` and beginning with three digits — the legacy `DDD-<name>` format. Exactly one match → use it. **More than one → ask the user which one**, listing each with its `Updated:` — do not pick by format precedence: two folders for one feature is exactly the state the date used to prevent, and choosing silently is how the resolver starts finding the wrong one. No match → fall through to *latest*.

3. **Latest** (fallback) — read the `Updated:` line from each candidate's `.unikit/code/plans/<folder>/PLAN.md` and sort descending; ties break on `Created:` descending, then on folder name descending. A manifest with no `Updated:` is **excluded and named** — `WARN [plan] <folder>: manifest has no Updated: — excluded; run unikit-ai update to backfill it` — never guessed from the folder name and never from the file's mtime, which `git checkout` and a fresh clone rewrite.
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

4. If `.unikit/code/plans/` is empty or doesn't exist (and no `.unikit/code/PLAN.md`):

**First, check for `.unikit/code/FIX_PLAN.md`:**

If `.unikit/code/FIX_PLAN.md` exists — a fix plan was created by `/unikit-fix` in plan mode. Redirect to fix workflow:

```
Fix plan detected (.unikit/code/FIX_PLAN.md).

This plan was created via /unikit-fix and should be executed through the fix workflow
(it creates a patch and automatically cleans up the plan after execution).

Launching /unikit-fix to execute the plan...
```

→ `/unikit-fix` (without arguments — it will detect FIX_PLAN.md and execute it).
→ **STOP** — do not continue with implement workflow.

**If no plan found at all:**

Instead of silently stopping, present an interactive menu:

```
No active plan found. Current branch: <current-branch>.

Options:
1. Plan a new feature — /unikit-plan full <description>
2. Plan a quick task — /unikit-plan fast <description>
3. Fix a bug — /unikit-fix <description>
4. Just checking status — show branch info and stop
```

Based on choice:
- Plan feature → ask for description via AskUserQuestion, run `/unikit-plan full <description>`
- Quick task → ask for description, run `/unikit-plan fast <description>`
- Fix bug → ask for description, run `/unikit-fix <description>`
- Just checking → show `git branch --show-current` + `git log --oneline -5` → **STOP**

STOP here after handling the choice.

**If both `.unikit/code/PLAN.md` and a matching folder plan exist**, ask the user which one to use.

**Ultra bundle check.** Read the first line of the resolved plan manifest. If it equals `<!-- unikit:plan-mode:ultra -->`, this is an ultra bundle: follow `.unikit/system/ultra-plan-read.md` for reading depth, integrity and mutability. Otherwise continue unchanged. **Discovery itself does not change** — the folder is found the way it always was; only what is read inside it differs.

**Reading depth:** read the manifest plus the phase file of the **active task** — one task is executed at a time, so holding every phase in context means holding what is not being executed. Re-read the active phase file on resume, even when a previous session already read it.

#### 0.2: Check for Uncommitted Changes

**Skip this step for read-only modes (`--list`, `status`) — they already STOPped in Step 0.1.**

Before any implementation work, check `git status`. If git is unavailable (not initialized), skip this step entirely and proceed to plan loading.

```bash
git status
```

**If uncommitted changes exist:**

```
Uncommitted changes detected.

Options:
1. Commit now (recommended)
2. Stash and continue (git stash)
3. Continue as is
4. Cancel — I'll handle it myself
```

Based on choice:
- Commit now → run /unikit-commit, then continue to plan discovery
- Stash → `git stash push -m "unikit-implement: stash before execution"`, then continue
- Continue as is → leave the working tree untouched, continue to plan discovery
- Cancel → inform "Implementation cancelled." → **STOP**

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

- Read the **plan manifest** — `.unikit/code/plans/<folder>/PLAN.md` for a folder plan, `.unikit/code/PLAN.md` for a flat fast-mode plan. In fast and full one file carries everything: `## Overview`, `## Settings`, the `## Checklist` with phases, dependencies and completion status, and `## Technical Context` (constraints, interfaces, key patterns, dependency graph, files, editor targets, DI bindings). **In an ultra bundle it does not:** the manifest carries the checklist and only the cross-phase part of `## Technical Context`, while every task's own detail lives in its phase file — the reading depth is stated in `.unikit/system/ultra-plan-read.md`. For the full section list see `unikit-plan/references/TASK-FORMAT.md` → *Plan Manifest Template*; it is not restated here.
- If the manifest has a `## Based on` section pointing to a research, do **NOT** read that research's `RESEARCH.md` as a substitute for the plan's own context. The plan's `## Technical Context` is authoritative and supersedes the research summary (`/unikit-plan`: it was synthesized from the research and then verified against the code). The research is read for **one** purpose only — the drift check below.
- Read **`.unikit/DESCRIPTION.md`** — project specification, tech stack, constraints
- Read **`.unikit/ARCHITECTURE.md`** — project structure, tech stack, and pointers to detailed rules

**Research drift check.** For each entry in `## Based on`:

1. **Only when the entry carries a `Summary SHA256`**, recompute the SHA256 of the region between the `## Active Summary` markers of that research's `RESEARCH.md`, by the canonical procedure. An entry that carries no `Summary SHA256` is resolved by branch 5 or branch 6 and **nothing is recomputed for it** — the branches are read in order, so this precondition is settled before the first comparison, and skipping it is how a pre-manifest entry gets reported as drifted instead of unknown. **Rule 0** — extract the text between `<!-- unikit:active-summary:start -->` and `<!-- unikit:active-summary:end -->`, excluding the marker lines themselves; both markers are matched as whole lines. Then the five normalization rules — strip a leading **UTF-8 BOM**, LF line endings, trailing spaces trimmed from every line, exactly **one final newline**, no reformatting (line order and leading whitespace preserved) — fed through **stdin, never a temp file**: `… | shasum -a 256 | awk '{print $1}'`, falling back to `sha256sum`. Rule 0 runs on text already read; it needs no grant of its own.
2. Recomputed == the recorded `Summary SHA256` → say nothing and continue.
3. Recomputed ≠ the recorded `Summary SHA256` → emit
   `WARN [research-drift]: <folder> — the linked Active Summary is no longer byte-identical to the one this plan was built from`
   and continue **against the plan**, not against the research. Do not expand scope, do not add tasks, do not rewrite the hash. A rebase is `/unikit-improve`'s job and happens only when the user explicitly asks for it. The wording is deliberate: the summary is the declared input and is rewritten wholesale whenever the research is saved, so a mismatch proves the input is not the same bytes — not that the author changed their mind. Claiming the latter would make the warning read as a finding.
4. `RESEARCH.md` missing or unreadable, or its `## Active Summary` markers absent or duplicated → emit `WARN [research-drift]: <folder> source missing` and continue against the plan.
5. The entry carries a `Brief SHA256` and no `Summary SHA256` → emit `WARN [research-drift]: <folder> drift unknown (recorded against the retired brief field)`. Nothing is recomputed: the recorded digest describes a different object, and comparing it against the summary would print "the research changed" where the honest answer is "there is no mechanism here". The repair is the standard re-link in `/unikit-improve` Step 5.5.
6. No hash field of either name recorded (a plan predating both) → drift is **unknown**, not absent. Emit `WARN [research-drift]: <folder> drift unknown (no hash recorded)`.
7. Neither `shasum` nor `sha256sum` available → emit `WARN [research-drift]: no SHA256 tool available — drift checks skipped` **once** for the whole run, and continue.

The label `WARN [research-drift]` is canonical and the same for every outcome; per-branch labels would make them indistinguishable when a log is grepped for drift. Branches 5 and 6 both report "unknown" and are worded apart on purpose: one needs a re-link, the other is merely older than the field, and the log line is the only place that difference is visible.

There is no bundle-validation branch here. `## Based on` always names a folder under `.unikit/code/researches/`, and the hashed object is always one fixed section in one fixed file — one shape, one region. A source path that varies between a single configured file and a bundle entry point would need such a branch; UniKit's does not.

Drift is printed **once**, here at plan load — not before each task. Execution continues on the scope of the plan; the offer to re-plan goes into the Step 5 final report as the single line `Research drifted — consider /unikit-improve <plan> before continuing`.

The manifest's `## Overview` tells you WHAT to do and WHY; its `## Technical Context` tells you HOW; DESCRIPTION.md and ARCHITECTURE.md give project-wide context.

**Read `.unikit/skill-context/unikit-implement/SKILL.md`** — MANDATORY if the file exists.

This file contains project-specific workflow rules added by `/unikit-skills-context` or `/unikit-evolve`.
These rules change how this skill orchestrates work (priorities, delegation, commit behavior, etc.).

**How to apply skill-context rules:**
- Treat them as **project-level overrides** for this skill's general instructions
- When a skill-context rule conflicts with a general rule written in this SKILL.md,
  **the skill-context rule wins** (more specific context takes priority)
- When there is no conflict, apply both: general rules from SKILL.md + project rules from skill-context
- Do NOT ignore skill-context rules even if they seem to contradict this skill's defaults —
  they exist because the project's experience proved the default insufficient

**Parse Settings:**

Read the `## Settings` section from the plan manifest:
- `Testing: yes` → after completing each phase, write tests inline (default) for the code created in that phase, or via `develop-agent` for parallel/deep-dive (same execution-mode logic as Step 3.2)
- `Testing: no` → skip test creation entirely
- `Test checkpoints: task | phase | plan` → where the test-checkpoint tasks stand in the plan. Affects Step 2.5 (what may be merged) and Step 3.2 (the width of a run). **Line absent → the plan is legacy:** its placement was never declared. Run points in such a plan are run commands sitting in the task text (`### Tests`, `### Verification`, the implementation steps) plus test-checkpoint tasks recognisable only by their heading. Confidence is lower here, and the Step 4 report says so in one line.
- `Docs: yes` → after all tasks are completed, show a mandatory documentation checkpoint (Step 5.3)
- `Docs: no` → skip documentation checkpoint, emit warning
- `Editor tasks: mcp | manual | direct` → how tasks carrying an `Editor:` line are carried out (Step 3.2). **Default when the line is absent:** `mcp` if the engine MCP is configured (MCP server `{{engine_mcp_tool}}` present in `{{settings_file}}` at the project root — the same probe as Step 3.6), otherwise `manual`. Never default to `direct`: it is irreversible and requires a git commit first, so it is only ever an explicit choice.

If `## Settings` section is missing, default to `Testing: no`, `Docs: no`, and resolve `Editor tasks` by the same probe (`mcp` when the engine MCP is configured, otherwise `manual`).

**Resolve the merge mode (read from the config, not from the plan):**

Read `.unikit/config.yaml` → `testing.implement.merge_checkpoints.<plan mode>`. The plan's mode is already known from detection (`.unikit/system/ultra-plan-read.md` → `## Detection`): a manifest carrying the marker → `ultra`; a folder plan without it → `full`; the flat `.unikit/code/PLAN.md` → `fast`.

- **File, key or value absent → `false`.** Merging is only ever enabled explicitly.
- The value is meaningful only under `Test checkpoints: phase` or `task`. Under `plan` there is nothing to merge: take `false` and print nothing — that is a normal combination, not a misconfiguration.
- This is the **only** config key this skill reads. The planner's placement key is never read here: the placement is already recorded in the plan, and reading that key again would reinterpret a plan that has already been written.

Store it as `merge_checkpoints` — Step 2.5 reads it.

**Log the resolved policy once, naming both halves:**

```
INFO [testing] checkpoints=<value from the plan|legacy> · merge=<true|false>
```

Both halves must appear: it is precisely their divergence that explains why a run performed fewer test runs than the plan has checkpoints. A missing config or key resolves to `false` **silently** — a project without a config is a normal case, and a line on every run would turn the warning into wallpaper. A value that is neither `true` nor `false` (`yes`, `1`, an empty string) resolves to `false` plus `WARN [testing] merge_checkpoints=<value read> is not true|false; took false`. A legacy plan — no `Test checkpoints:` line — adds one line to the Step 4 report: `Test checkpoints: legacy — placement not declared, runs found from the task text`.

Store the parsed settings — they affect behavior in Step 2.5 (merging the test-run checkpoints), Step 3.2 (editor targets, and the width of a test run), Step 3.8 (tests), Step 3.9 (commit), and Step 5.3 (documentation).

Understand:
- Which tasks are completed (`- [x]`) and which are pending (`- [ ]`)
- Phase dependencies (a phase can only start when its dependencies are done)
- The overall architecture and technical decisions from the description

### Step 1.5: Bootstrap Rules & Principles

Load the project knowledge base ONCE at the start of execution. This replaces per-task delegation to `/unikit-devcontext` for sequential work.

**Read in parallel:**
1. `.unikit/system/dev-principles.md` — engine development principles (Core Principles + Workflow that used to live in /unikit-devcontext)
2. `.unikit/RULES.md` — project overrides (highest priority)
3. `.unikit/memory/code/RULES_INDEX.md` — index of core/stack rules
4. For EACH row in the Core table where Required By = `all` or contains `unikit-implement` — read that file from `.unikit/memory/code/core/` using the Read tool.

Stack rules are NOT loaded here — they are loaded lazily per-phase in Step 3.0.

**Engine-MCP rules (conditional, engine-neutral) — once per session, zero calls:**

5. `.unikit/system/engine-mcp/INDEX.md`, **base section only** — the delivery stamp (`server:`) plus every section **except** the `## Check` table — access, the live failure classes, shape and cost, what is irreversible, the lane, and what to do when the file is silent. Those are the exceptions that hold for every task here. **Do not read the `## Check` table now** — it is grepped per task, by area (Step 3.2).
6. `.unikit/MCP-RECHECK-NOTES.md`, **header only** (`server:` / `audited:`) — this project's own accumulated findings. Compare that header against the delivery stamp from item 5. On a mismatch print exactly one line and **apply the entries anyway**:

   ```
   WARN [engine-mcp] notes header ≠ configured server (<notes> ≠ <configured>)
   ```

   The entries are *suspect*, not void, and a suspect check still fails safe. Retiring them belongs to `/unikit-mcp-audit`, never to this skill.

**Either file absent → skip it, print one line, and continue with every right you had:**

```
MCP rules: no INDEX.md — no known exceptions for this server, rights unchanged
```

No rules means no known exceptions, never no capabilities. Absence never disables the engine MCP and never turns a target into `⏸️ MANUAL` (`.unikit/system/dev-principles.md` → **A9**).

**Ultra plan bundle reader contract — once, before the first task is executed:**

7. `.unikit/system/ultra-plan-read.md` — how to read an ultra plan bundle: detection, per-consumer reading depth, what is mutable during execution, and the blocking integrity checks. Name it and follow it; never restate it here — one contract, one place.
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

A merged test-checkpoint task is the other third outcome, and it counts differently — see the counting rule in Step 2.5.

**If `$ARGUMENTS` contains phase/task selectors:**

- **`Phase N`** (e.g. `Phase 3`): collect all pending tasks from Phase N
- **`Phases N-M`** (e.g. `Phases 1-3`): collect all pending tasks from Phases N through M
- **`Task N.M`** or **`Tasks N.M N.K`** (e.g. `Tasks 2.1 2.3`): collect only those specific pending tasks
- If a specified task is already completed, skip it and note this to the user
- If a phase depends on an incomplete phase, warn the user but proceed if they confirm

**If no selectors (execute all pending):**

Collect all pending tasks across all phases, respecting dependency order:
1. Start with phases that have no unmet dependencies
2. Within a phase, execute tasks in order (1.1, 1.2, 1.3...)
3. After completing a phase, check if any new phases are now unblocked

### Step 2.5: Resolve test-run checkpoints in scope

Runs **before** the first task, and only when `Testing: yes`.

1. **Collect the scope's run points.** Read the manifest's checklist and select the tasks carrying a `Test checkpoint:` line that fall inside this invocation's scope. **Only the manifest's checklist is read** — no phase file is opened for this.
2. **Pick up what earlier calls deferred.** A test-checkpoint task that is `- [ ]` and carries the marker `⏭️ MERGED → task N.M` whose target `N.M` is also `- [ ]` is an unclosed obligation: its coverage joins this invocation's scope. This is not a new run — it was planned, and merely merged.
3. **`merge_checkpoints: false`** → mark nothing. Every point runs where it is written (the one exception is a parallel layer — Step 3.2 and the coordinator). Go to Step 3.
4. **`merge_checkpoints: true`** → take the scope's **last** run point and mark **all the others** merged into it, in a single `Edit` over the manifest:
   - append `⏭️ MERGED → task <N.M>` to the text of each merged task, leaving its checkbox `- [ ]`;
   - the surviving point's coverage at run time is the **union** of the coverage of everything merged into it (Step 3.2).

   **The final full run (`Test checkpoint: plan`) is never merged and never moved.** If it falls inside the scope it stays a point of its own and stands last.
5. **The scope holds no run point at all**, but something was deferred → the deferred work runs at the **end of the scope**, after the last task.
6. A merge touches no phase file: the marker is the text of a task in the manifest's checklist, on the model of `⏸️ MANUAL`.

**Counting rule for `⏭️ MERGED`.** A test-checkpoint task carrying the marker and still `- [ ]` **does not count as pending for its own run**: its obligation is carried by the marker's target. It stops blocking "all tasks are completed" only once that target is `- [x]`; until then it is a visible obligation, and the next invocation picks it up (point 2).

**The order is part of the contract: mark first, then execute.** A mark written after the first task no longer survives an interruption *during* that task — which is the whole reason this decision is written into the manifest instead of being held in memory.

**Verbose.** A non-empty merge prints one line — `INFO [testing] merged <n> point(s) into task <N.M> (scope: <scope>)`; picking up deferred work prints `INFO [testing] deferred points picked up: <n>`. If the mark cannot be written (the `Edit` failed) → **do not perform the merge**: fall back to the `merge_checkpoints: false` behaviour and print `WARN [testing] merge mark not recorded — points run as written`. A merge that was never recorded is exactly the shape this design rejects.

### Step 3: Execute Tasks

Keep a running list of files you create, modify, or delete during execution — you'll need it for the completion summary and commit.

**3.0: Phase Rules Refresh (before starting each phase)**

Before executing the first task of any phase (including the first phase):
1. Re-read `.unikit/memory/code/RULES_INDEX.md` (it may have been updated by `/unikit-memory` since Bootstrap).
2. Match the phase name and its task descriptions against the Stack table's `Load When` column.
3. Compute delta: stack rules needed for this phase that are NOT in `loaded_rules`.
4. Read each delta rule from `.unikit/memory/code/stack/` using the Read tool.
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

This skill OWNS code-writing for sequential tasks. Use `Read/Edit/Write/Bash` directly with the rules already loaded in Step 1.5 + Step 3.0. Do NOT invoke `/unikit-devcontext` via `Skill(...)` — that defeats the rules-loading optimization.

Choose execution mode:
- **Sequential within phase** (default for tasks that depend on each other or share files) → inline implementation. The skill writes code itself.
- **Independent across phases** (per the manifest's `## Dependency Graph`, e.g. Phase 3 and Phase 4 can run in parallel) → spawn `develop-agent` (Agent + /unikit-devcontext) per independent scope. Use ONLY for true parallelism.
- **Deep-dive single task** (requires extensive codebase exploration that would bloat parent context) → spawn `develop-agent` to isolate the exploration.

When implementing inline, use the rules from Bootstrap + Phase Rules Refresh, the principles from `dev-principles.md`, the task description from the manifest's `## Checklist`, and the technical context from its `## Technical Context`.

**In an ultra bundle the checklist line is a pointer, not the specification.** The task's specification is its `## Task N.M:` section in the phase file — `### Intent` through `### Verification` — and the manifest's `## Technical Context` supplies only the cross-phase part.

**Fallback:** If `Agent` tool is unavailable, do NOT invoke `/unikit-devcontext` inline (rules and dev-principles are already loaded in Step 1.5 / Step 3.0). Instead, degrade parallel scopes to sequential and continue the inline implementation cycle for ALL tasks. Each phase still triggers Step 3.0 Phase Rules Refresh.

**Tasks carrying an `Editor:` line** target the editor's serialized state, not source files. Handle each `Editor:` line — `[kind] <container> → <target> : <action>` — by the `Editor tasks` mode parsed in Step 1:

- **`mcp`** — carry it out through the engine MCP, in this order, on **every** such task:

  1. **Candidates from the live catalog, by intent.** Take the task's `kind` and its action, and pick 3-5 candidate affordances out of the tool list you actually hold. That list is the only place a name may come from — not this file, not a rules file, not memory. A name recalled instead of read is a `catalog phantom` you invented.
  2. **Ask the server for the schema** of those 3-5 before calling any of them. A one-line or empty declaration does not mean "no parameters".
  3. **Grep by area.** Read the `## Check` table of `.unikit/system/engine-mcp/INDEX.md` and of `.unikit/MCP-RECHECK-NOTES.md`, filtered to this task's own area — the one its `kind` names — **plus every cross-cutting area**: `rollback · console · batch · compile · transport · visual`. The cross-cutting six are read **always**; the lines are short, and the moment one becomes applicable is not knowable in advance.
  4. **Execute, then read the changed state back.** Close the claim with the evidence class its claim class requires (`dev-principles.md` → A2). A response code is not evidence; the evidence is the read-back of what you claimed to change.

  **No rules file, or no check line for this area → nothing changes.** Every right you had, you keep: an absent exception is not an absent capability, and it is never a reason to mark the target `⏸️ MANUAL` (A9). `⏸️ MANUAL` is reached only by trying, finding no route at all, and having the evidence of that absence to show.
- **`manual`** — do **not** touch any file. Mark the task `⏸️ MANUAL` (Step 3.4) and hand the user the exact instruction in the form `[kind] container → target : action`, one line per target.
- **`direct`** — **commit to git before editing** (this is mandatory and the whole reason the mode is gated), then edit the serialized format directly, staying inside the bounds §6 allows for that format. Never use `direct` for a format §6 rates 🔴.

  **§6 is owned by the `unikit-plan` skill** — read it from `references/ENGINE_RULES.md` inside that skill's own directory under `{{skills_dir}}`. This skill has no engine template of its own, so there is no local copy of §6 to read and none to keep in sync.

  **If that file is not there**, treat every format as 🔴: refuse `direct`, put the task back on `manual`, and state the reason in one line. Continuing silently is not an option here — a binary serialized format edited as text is not reversible by review, and this gate is the only thing standing in front of that. This is **not** the A9 case: what is missing is not a rule that would grant a right, it is the permission for an irreversible text edit, and withholding it changes nothing about the `mcp` route.

**A task carrying a `Test checkpoint: <coverage>` line** is a test-checkpoint task. It changes no files; its work is one test run.

1. **Merged?** It carries the marker `⏭️ MERGED → task N.M` (Step 2.5) → **the run is not performed.** The task stays `- [ ]`; move on. Its coverage is already counted into the target task's run.
2. **Derive the run's target from the coverage** — the width is not configurable (REQ-006):
   - `task N.M` → the fixtures and classes named by that task's `### Tests`;
   - `phase N` / `phases N-M` → the test suites of the modules those phases touched and of the modules that depend on them (algorithm below), plus the coverage of everything merged into this point;
   - `plan` → **every test in the project**, unfiltered.
3. **Dependent modules are found by name search, without building a graph.** The policy is engine-neutral and lives here; the mechanism is engine-specific and lives in the core rule `testing.md` loaded at Bootstrap (Step 1.5): what declares a module, where references live, how a test suite is recognised.
   1. Changed files: `git status --porcelain` plus the list of files this run has accumulated.
   2. Walk up the directories to the nearest module manifest → the set of changed modules.
   3. Find the referrers: search the module manifests for the names in that set. Repeat while the set keeps growing — in practice one or two iterations.
   4. Keep only the test suites from the result.
   5. **Safety valve: when what remains is ≥ 70% of all the project's test suites, run everything.** A filter of twenty names costs more than one full run, and assembling it is the more error-prone half. **This threshold is assigned, not measured**, and the text must admit it rather than let the next reader take it for a measurement.
   6. **Degenerate cases → full run:** the engine has no module graph; the change landed in a default suite almost everything depends on; `testing.md` describes no mechanism for this engine. Failing to narrow means widening — that is fail-safe, not refusal.

   **Reading every module manifest is forbidden.** The search returns paths, not contents; reading the whole graph costs thousands of tokens and buys no accuracy.
4. **Start the run** by the engine's own means, exactly as any other check in this step does (through the engine MCP when one is configured). Wait for the result.
5. **A red run goes to the blocker loop (Step 3.3).** After the fix the run is repeated. A red run is never ticked `[x]`, and never quietly demoted to a warning.
6. **A green run is recorded in the manifest**, by the same `Edit` that ticks the checkbox (Step 3.4):
   - append a bullet to `## Test Runs`: `<date> · <coverage> · <what ran> · passed N/N · tree-sha256 <hash>`;
   - **for `Test checkpoint: plan`, additionally** rewrite the anchor line `Full run: <date> · all tests · passed N/N · tree-sha256 <hash>`;
   - `<date>` comes from `Bash(date *)`; `<hash>` from the procedure below.

   The plan carries no `## Test Runs` section (a legacy plan) → create it at `##` level, under `## Rule Candidates`, or above `## Dependency Graph` when that one is absent too.
7. **`tree-sha256` is computed over a short text**, not over the project, and by the same procedure as `Summary SHA256` (Step 1) — through stdin, no temp file. That procedure is named here, never restated:

   ```
   { git rev-parse HEAD; git status --porcelain; } | shasum -a 256 | awk '{print $1}'
   ```

   No `shasum` → `sha256sum`. Git unavailable → the field is written as `tree-sha256 unavailable`; the run is still recorded, and `/unikit-verify` does not reuse such a run.
8. **Close the merged tasks.** After a green run, tick `- [x]` every task whose marker points at this run point, keeping the marker in its text: it explains why that task has no line of its own in `## Test Runs`.

**Verbose.** `INFO [testing] run <coverage>: <n> test suite(s)` before starting; `INFO [testing] safety valve: <n>/<total> ≥ 70% — full run` when it fires; `INFO [testing] no module graph — full run` on a degenerate case; `WARN [testing] git unavailable — tree-sha256 unavailable`. A red run is reported by the Step 3.3 blocker and not by a second line here: two places printing one failure drift apart. A run that never started — the runner is busy, or it timed out — is a Step 3.3 blocker and **not** a lifted gate: lifting is `/unikit-verify`'s decision, and the executor does not take it.

**A call that misled you is a finding — and it goes in two places, neither of them the notes file.**

- the run report for this task, as a candidate line: the `area`, what has to be confirmed, and the raw call with the raw answer it gave;
- the plan's `## MCP Findings` table — the half that survives the session. Columns and their contract: `references/TASK-FORMAT.md` → `### MCP findings section`.

**When it is written: in Step 3.4, by the same `Edit` pass that ticks the checkbox** — not at the end of the run. The finding and the task that produced it are one unit of work, and a table filled only at the end is lost to every `/clear`, every context overflow and every session that simply stops. Ticking the box and appending the row together is what makes the two survive or fail as one.

**Never write `.unikit/MCP-RECHECK-NOTES.md` from here.** One observation is a bad sample and a bad line lives for months; the durable surface passes through a human running `/unikit-mcp-trap`.

**The library reference — two triggers, and never on Bootstrap.**

Reach for it on exactly two occasions:

1. **an unfamiliar area** — what approaches the authors propose; once per area per session;
2. **a dead end** — you hold the schema and the capability still is not there.

**Never routinely, and never at Bootstrap.** It is a network dependency inside the editor lane, a few thousand tokens per query, and it makes the run irreproducible — two runs of the same plan diverge. It also mixes a source with a systematic bias toward confidence into the hot path: retrieval returns what is most relevant, and a caveat is almost never the most relevant answer to "how do I do this".

**The identifier is already known.** It is carried in the header of `.unikit/system/engine-mcp/INDEX.md`, which names the reference for the configured server — so nothing has to be resolved at run time.

**Say when you reached for it, and why.** One line into the run report, at the moment of the call — the network was touched and the report has to show it:

```
Reference: trigger <1|2> — <the area, or the dead end>
```

Without it the run reads as if everything came from observation, which is exactly the confusion a source biased toward confidence should not get for free.

**How the answer is treated.** The reference describes **intent, not behaviour**. Anything taken from it carries the same evidence obligations as anything else, and with heightened attention: it has been caught presenting a structurally broken path as an exemplary example. It never closes a claim — only an observation does (`dev-principles.md` → A2).

**The reference is optional in the wizard.** If it was not configured, trigger 2 simply has no fallback: descend the degradation ladder (`dev-principles.md` → D3) and reach `⏸️ MANUAL` at its proper rung only — by absence of a route, established by trying. An unconfigured reference is not itself a missing capability.

**Delegated execution.** When a task with `Editor:` goes to `develop-agent` or to `unikit-implement-worker`, the dispatch prompt MUST carry the `Editor:` lines **verbatim** and the already-resolved mode. A delegate that receives only the description implements the task as pure code and both mode gates are bypassed silently. **In an ultra bundle the whole task section goes into the prompt**, not just the `Editor:` lines: a delegate that receives only the checklist line loses the implementation steps, the contracts and the acceptance criteria along with the targets. `manual` is **never executed by a delegate** — the task comes back up marked `⏸️ MANUAL`.

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
- Write the checkbox as `- [x]` and append the marker `⏸️ MANUAL` to the task text, right after the description: `- [x] Task 2.1 — wire the pause button ⏸️ MANUAL`. The checkbox must be `[x]` so Step 2 does not pick the task up again on every subsequent run; the marker is what keeps it honest, and it sits in the task text so `/unikit-verify` sees it during the task audit.
- A `⏸️ MANUAL` task **does not block** "all tasks completed" — the user took it on deliberately. It is **not** counted as implemented either: report it separately (Step 4).

**The task produced an MCP finding (Step 3.2)** — a third outcome to record in the same pass:
- Append the row to the plan's `## MCP Findings` table now, in the same `Edit` that ticks the checkbox. Not at the end of the phase, not at the end of the run.
- **Id:** `F<n>`, where `<n>` is one more than the highest already in the table. Read the table before appending — a re-run of the same task must not restart the numbering and collide with rows written earlier.
- **`observed`:** the date you observed it, `Bash(date *)`.
- **Dedup is semantic, not mechanical.** Drop a candidate that says the same thing about the same `area` as a row already there, judging by meaning rather than by string match; only the id allocation is mechanical. Being loose here is deliberate — the error is cheap in both directions. A duplicate that slips through costs one extra line, which `/unikit-mcp-trap` or `/unikit-mcp-audit` drops later; merging two observations that were not the same thing destroys the `evidence` of one of them, and evidence is the half that cannot be reconstructed.

**A test-checkpoint task (Step 3.2)** — the checkbox is ticked by the same `Edit` that writes the entry into `## Test Runs`, and that same `Edit` closes the tasks merged into it. One write surface, one `Edit` — the very rule by which `## MCP Findings` is written in this step.

**The task produced a rule candidate** — a further outcome, recorded in the same pass:
- Append a row to `## Rule Candidates`: `id | rule | full formulation | from | status`, with `status = open` and `from = task <N.M>`.
- **Id:** `R<n>`, one more than the highest already in the table. Read the table before appending — a re-run of the same task must not restart the numbering and collide with rows written earlier.
- `rule` carries **one line, one directive** — exactly what would go into `.unikit/RULES.md`. `full formulation` carries the long version with its rationale, under no length limit; that column is the reason the short form is allowed to stay short.
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

This step is critical: do NOT proceed to commit (3.9) with compilation errors that belong to the current phase. Future-phase errors are acceptable — they indicate planned work, not broken code.

**3.7: Update context artifacts (if project structure changed)**

After completing a phase, check whether the implementation introduced structural changes that should be reflected in context files:

- **If the tech stack changed** (new dependencies, integrations, or tools added) → update `.unikit/DESCRIPTION.md` with factual deltas only. Do not rewrite — add or modify the relevant section.
- **If new modules, directories, or layers were added** → update `AGENTS.md` — refresh the project structure tree and key entry points table to reflect new directories/files.
- **If new modules or dependency rules changed** → update `.unikit/ARCHITECTURE.md` — add new modules to the folder structure section and update dependency constraints if needed.

Skip this step if the phase only modified existing files without structural changes.

**3.8: Tests (after completing a phase, if Testing: yes)**

**This step only WRITES tests and never runs them** (REQ-002). A run is a separate test-checkpoint task in the checklist (Step 3.2). Writing tests is not constrained by the `Test checkpoints` policy: tests are written in any task of any phase, exactly as before.

If Settings specify `Testing: yes`, after all tasks in a phase are completed, write tests for the code created/modified in that phase inline (default) or via `develop-agent` (parallel/deep-dive only) — same choice logic as Step 3.2.

Fallback: If Agent tool is unavailable, write tests inline; do NOT invoke `/unikit-devcontext` via `Skill(...)`.

When writing tests, use:
1. List of files created/modified in the phase
2. Relevant context from the manifest's `## Technical Context` (constraints, interfaces, key patterns, editor targets). In an ultra bundle the manifest carries only the cross-phase part, and the task's own `### Tests` sits in its phase file
3. The rules and principles already loaded in Step 1.5 Bootstrap + Step 3.0 Phase Rules Refresh

If tests are generated, they will be included in the phase commit.

If `Testing: no` or Settings section is missing — skip this step entirely.

**3.9: Commit checkpoint (after completing a phase)**

After all tasks in a phase are completed (and tests generated if applicable), offer to commit:

```
✅ Phase {N} complete — {count} tasks done.

💾 Commit checkpoint. Commit changes?
Suggested message: "feat({feature}): {phase summary}"

Options:
1. Yes, commit
2. No, continue to next phase
3. Disable checkpoints — don't ask again
```

Based on choice:
- Yes → run /unikit-commit with phase-related files, proceed to next phase
- No → skip commit, proceed to next phase
- Disable checkpoints → skip commit checkpoints for the rest of the session, proceed

Commit staging rules — see Rule 8 in **Important Rules**.

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
Research drifted — consider /unikit-improve <plan> before continuing
```

The `Research drifted` line appears **only** when the Step 1 drift check emitted at least one `WARN [research-drift]`, and is omitted entirely otherwise. It carries the offer forward past the point where the warning scrolled away; it is not a blocker and never stops the run.

The `Manual (editor targets)` block lists every task marked `⏸️ MANUAL` with its exact instruction, and is **omitted entirely** when there are none. It is **not** the same as "not done": the user chose to carry these out themselves, and `/unikit-verify` does not treat them as blockers.

### Step 5: Post-Completion Actions

After all tasks in the current scope are done, perform the following actions.

**IMPORTANT:** Steps 5.1 and 5.3 delegate work to Agent calls and do NOT wait for user input. **Step 5.2 is the exception and blocks on the user** — it never writes a rule without an answer. Steps 5.4–5.8 are sequential and may involve user interaction.

**5.1: Check TODO.md**

After implementation, check if any open tasks in the project TODO list were resolved:

1. Check if `.unikit/TODO.md` exists. If not — skip this step.
2. Read `.unikit/TODO.md` and collect all unchecked tasks (`- [ ]`).
3. Compare each unchecked task against the work just completed — match by semantic similarity to modified files, classes, methods, or feature descriptions from the plan.
4. If matching tasks found — change `- [ ]` to `- [x]` directly in `.unikit/TODO.md` using the Edit tool. No agents or skills needed.
5. If no matching tasks found — skip silently.

**5.2: Propose New Rules**

The candidates are already collected: the rows whose status is `open` in the manifest's `## Rule Candidates` (Step 3.4). This step formulates nothing anew — it proposes what is written down, and records the choice.

1. **No `open` candidate → silence.** Not a line, not a "no rules found". A run without candidates is the ordinary case, and a line about it on every run turns the signal into wallpaper — the same rule the empty findings table follows in Step 5.5.
2. **Select at most three** `open` candidates. The filter: a general convention for future code; not about one task; not a description of the current code; absent from `.unikit/RULES.md` and from `RULES_INDEX.md`; one line, one directive.
3. **Print the candidates as plain markdown, in a block of their own** — before the question:

   ```
   Project rule candidates:

   1. <the rule text, as it will be written>
      from: task 2.3
   2. <the rule text>
      from: task 4.1
   ```

   **Print first, ask second: the question mechanism carries the options and nothing else.** A question that also holds the payload is invisible on a runtime that has no such mechanism — that is a measured failure, not a supposition.
4. **Ask once, with `AskUserQuestion` and `multiSelect`:** one option per candidate plus an explicit **"Add nothing"**. Three candidates and a refusal are exactly four options, the tool's limit — which is the reason the count is capped at three. Keep the option label short; the full rule text goes in the option's `description`, and that is why the one-line rule form is a condition of readability here rather than decoration.
5. **No `AskUserQuestion` → the same list as a numbered text question**, answered by number. An agent without a structured-question tool presents the same options as plain text; that is the second and last tier.
6. **Nothing is written without an answer. Do NOT add any rules until the user answers.**
7. **What was selected goes to `/unikit-rules` as one numbered batch**, through the same three-tier dispatch as Step 5.6: Tier 1 `Skill(skill: "unikit-rules", args: "<batch>")` inline; Tier 2 the inline slash form `/unikit-rules <batch>`, rewritten per agent by the installer; Tier 3 printing the command, only where no inline mechanism exists at all. This is **a real call, not text in backticks**.
8. **Show the user the `## Batch result` table** the delegate returned, and update the statuses in `## Rule Candidates` from it: `added` for the rules it marked `added`, `declined` for those the user did not select. **`declined` is durable:** such a candidate is never offered again on a later run.
9. Only then proceed to Step 5.3.

**Verbose.** `INFO [rules] open candidates: <n>, proposed: <m>` before the block is printed — the one line explaining why fewer were proposed than recorded. If the dispatch degenerated to Tier 3 (printing), the statuses are **not** set to `added`: the rule was not written, and marking otherwise would be a lie — print `WARN [rules] /unikit-rules was not invoked — candidate statuses unchanged`. If the delegate returned no table, the same holds: the statuses stand, and `WARN [rules] the /unikit-rules report could not be parsed — candidate statuses unchanged`.

**5.3: Documentation Checkpoint**

**If `Docs: yes`** (from `## Settings`):

Delegate to `docs-agent` to update or create documentation based on completed work. Do NOT wait for the agent to finish — proceed to Step 5.4 immediately.

**Fallback** (if the `Agent` tool is unavailable in the current environment): you MUST invoke `/unikit-docs` yourself via whatever skill-invocation mechanism is available. This must be a real call, not a printed recommendation to the user, and must not be wrapped in triple backticks. Wait for the invocation to return, then proceed to Step 5.4.

**If `Docs: no` or Settings section is missing:**

- Do **not** delegate to `docs-agent`
- Emit `WARN [docs] Docs policy is no/unset; skipping documentation`

**Always include documentation outcome in the completion output (Step 4):**

Append one of these lines to the Implementation Summary:
- `Documentation: delegated to docs-agent`
- `Documentation: updated via /unikit-docs (fallback for docs-agent)`
- `Documentation: warn-only (Docs: no/unset)`

**5.4: Handle plan file after completion**

**If using the flat `.unikit/code/PLAN.md`** (fast-mode plan):

```
All tasks completed. Delete .unikit/code/PLAN.md? (It's no longer needed)

Options:
1. Yes, delete it
2. No, keep it
```

Based on choice:
- Yes → delete `.unikit/code/PLAN.md`
- No → leave as is

**If using a folder plan** (`.unikit/code/plans/<folder>/`, e.g. `.unikit/code/plans/2026-03-10_core-loop/`):
- Keep it — a folder plan is a durable record of what was done; the user may delete it before merging if desired
- **Never offer to delete `.unikit/code/plans/<folder>/PLAN.md`.** It shares a name with the flat fast plan and differs from it only by path, so the prompt above must always spell out the full path it is about to remove.

**5.5: MCP Findings handoff**

Read the plan's `## MCP Findings` table.

- **No rows** (or no such heading) → say nothing at all and go to 5.6. Not a note, not a "no findings this run" line. A run with no findings is the ordinary case, and a line announcing it every time is how a signal becomes wallpaper.
- **Rows present** → offer to move them to the durable surface:

```
<n> MCP findings recorded in this plan. Transfer them to .unikit/MCP-RECHECK-NOTES.md?
```

  On agreement, invoke `Skill(skill: "unikit-mcp-trap", args: "<path to the plan file>")`. The explicit path is what makes it read *this* plan and nothing else — see that skill's `## Input`.

**Why here, before review and commit.** The findings are part of the result of this run, and they are the part with no other keeper: the code is in git, the tasks are in the plan, and a finding lives only in a table nobody has read yet. Put this after review and it competes with a discussion of code quality for the user's attention — and loses, every time, ending up "later", which is where it was before this step existed.

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
- **Tier 2 — fallback (slash-command).** If the `Skill` tool is unavailable in this environment, **invoke `/unikit-review` inline**, one at a time, waiting for each. The slash form is rewritten per agent by the installer (Codex `$unikit-review`, Qwen `/skills unikit-review`); `Skill(...)` is **not** rewritten and non-Claude agents have no `Skill` tool, so without this tier the step is dead on 5 of 6 agents. This must be a **real call**, not a printed recommendation.
- **Tier 3 — degenerate (print).** Only when **no** inline invocation mechanism exists at all, print the ordered `Run: /unikit-…` list for the user to execute by hand. Last resort, never the default.

The invocation must be **a real call, not printed text**, and must not be wrapped in triple backticks.

**Review is NOT delegated here — unlike Step 5.3.** State it plainly, because the shape of this file argues the other way: a step above says "Delegate to `docs-agent`", a `Subagent Delegation — BLOCKING PRE-REQUISITE` block sits at the top, and generalising from the neighbours is exactly how this step came to be read as a delegation.

Why the distinction is real and not stylistic: a subagent carries the findings into a context you cannot see, so `file:line` references stop being clickable, no follow-up question can be asked about a finding, and — since `unikit-review` holds `Agent` in `allowed-tools` for its `+check` validator — the validator would run as an agent inside an agent. `docs-agent` is delegated precisely because its output is *not* a conversation: it writes a file and finishes. Step 5.2 is delegated to nobody at all — it blocks on the user, and only the answer decides what is written.

**5.7: Context Cleanup**

Suggest the user to free up context space if needed: `/clear` (full reset) or `/compact` (compress history).

**5.8: Next steps**

```
Next steps:
- {suggest what to do next — e.g. "Run /unikit-implement to continue from Phase 4"}
- {or "All phases completed — feature is done!"}
```

## Status Display

When `$ARGUMENTS` is `status`:

1. Find the active feature folder using the same resolution logic as Step 0.1 (Fast plan → Branch match → Latest by date)
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

Counts come from the checkboxes. A task marked `- [x] … ⏸️ MANUAL` counts toward its phase's `(N/M tasks)` and toward `Progress` like any other `- [x]` — it is genuinely off the work queue. When any exist in the plan, add one line below the box: `Manual (editor targets): {count}` so the number is never mistaken for implemented work.

Then STOP — do not execute any tasks.

## Dependency Validation

Before executing any phase, verify its phase dependencies from the manifest (the phase's `**Dependencies:**` line in `## Checklist`, cross-checked against `## Dependency Graph`):
- Read the `**Dependencies:**` line for the phase
- Check that all dependency phases have their tasks completed
- If a dependency is unmet, warn the user:

```
Phase {N} depends on Phase {M}, which has {X} incomplete tasks.
Implementing Phase {N} now may lead to compilation errors or incorrect behavior.

Options:
1. Implement Phase {M} first (recommended)
2. Continue as is (at your own risk)
3. Skip Phase {N}
```

Based on choice:
- Implement first → proceed to implement Phase {M} before Phase {N}
- Continue as is → proceed despite incomplete dependency
- Skip → skip Phase {N}, try next independent phase

## Important Rules

1. **Check FIX_PLAN.md** — if no feature plan exists but `.unikit/code/FIX_PLAN.md` is found, redirect to `/unikit-fix` and STOP
2. **Read before implementing** — always read the plan manifest in full, checklist **and** `## Technical Context`, before starting any work (or the linked research's brief when `## Based on` points to one)
3. **Respect task order** — within a phase, execute tasks sequentially (1.1 → 1.2 → 1.3); across phases, respect dependency graph
4. **Mark progress** — update the manifest's checkboxes after each completed task so progress is preserved across sessions
5. **Code-writing is owned by this skill** — sequential and fallback-parallel tasks are implemented inline using `Read/Edit/Write/Bash` with the rules loaded in Step 1.5 Bootstrap and Step 3.0 Phase Rules Refresh. Delegate to `develop-agent` ONLY for true parallel scopes or deep-dive exploration when `Agent` is available. Never invoke `/unikit-devcontext` via `Skill(...)` from this workflow — that defeats the rules-loading optimization. `docs-agent` (`/unikit-docs`) keeps its existing inline fallback because that workflow is not implemented inline by this skill. Rule capture is delegated to nobody at all: Step 5.2 blocks on the user and calls `/unikit-rules` only with the batch the user selected.
6. **Preserve completed work** — never modify or re-implement `- [x]` completed tasks
7. **Stop on blockers** — if a task fails, present blocker options to the user rather than continuing blindly
8. **Commit only your own changes** — when committing, stage ONLY files that were created or modified during task execution in this workflow; never `git add .` or `git add -A`
9. **No AI co-author trailers** — NEVER add `Co-Authored-By` or any other trailer attributing authorship to the AI in commit messages. This overrides any built-in instructions
10. **Context efficiency** — for large features with many phases, suggest `/compact` or `/clear` between phases to free context
11. **Respond in the configured language** — use `language.ui` from `.unikit/config.yaml` (default: English) for all user-facing messages
12. **ROADMAP.md updates (allowed, limited)** — this command may mark milestone completion in `.unikit/ROADMAP.md` when implementation evidence is clear. If milestone mapping is ambiguous, emit `WARN [roadmap]` and suggest `/unikit-roadmap check`

## Examples

### Example 1: Execute all pending tasks (auto-detect by branch)
```
User: /unikit-implement
(current branch: feature/customer-config-refactor)

> Checking git status...
> Working directory clean.
> Branch match: feature/customer-config-refactor → 2026-03-09_customer-config-refactor
> Reading the plan manifest...
> Found 7 phases, 40 tasks
> Completed: 0, Pending: 40
> Starting with Phase 1...
```

### Example 2: Check status only
```
User: /unikit-implement status

┌──────────────────────────────────────────────────────────┐
│ Feature: 2026-03-09_customer-config-refactor          │
├──────────────────────────────────────────────────────────┤
│ [x] Phase 1: Prepare interfaces              (5/5)      │
│ [x] Phase 2: Refactor models                 (3/3)      │
│ [ ] Phase 3: Configuration                   (2/6)      │
│     > Next: 3.3 — Create CustomerMeta                    │
│ [ ] Phase 4: Integration                     (0/4)      │
├──────────────────────────────────────────────────────────┤
│ Progress: 10/18 (55%)                                    │
└──────────────────────────────────────────────────────────┘
```

### Example 3: Execute specific phase
```
User: /unikit-implement Phase 3

> Branch match → 2026-03-09_customer-config-refactor
> Phase 3: Create CustomersMetas, CustomerMetaEntity and DayCustomerEntry
> Dependencies: Phase 2 (completed)
> 6 tasks pending
> Starting...
```

### Example 4: Execute phase range
```
User: /unikit-implement Phases 1-3

> Branch match → 2026-03-09_customer-config-refactor
> Phases 1-3: 16 tasks pending across 3 phases
> Starting with Phase 1...
```

### Example 5: Execute specific tasks
```
User: /unikit-implement Tasks 2.1 2.3

> Branch match → 2026-03-09_customer-config-refactor
> Selected tasks:
>   2.1 — Rename IShopCustomer.cs to IDayCustomer.cs
>   2.3 — Delete CustomerType.cs
> Starting...
```

### Example 6: Specific feature + phase
```
User: /unikit-implement 2026-03-08_customers-system Phase 4

> Feature: 2026-03-08_customers-system
> Phase 4: Implement SimpleCustomersSystem
> 7 tasks pending
> Starting...
```

### Example 7: List available plans
```
User: /unikit-implement --list

Available plans in .unikit/code/plans/:

  Branch match:
    2026-03-10_core-loop          (12/40 tasks, 30%)  ← matches feature/core-loop-part1

  Other plans:
    2026-03-08_customers-system   (18/18 tasks, 100% — completed)
    2026-03-05_inventory-rework   (5/22 tasks, 23%)

  Fix plan: not found

Usage:
  /unikit-implement                                          — auto-detect by branch
  /unikit-implement @.unikit/code/plans/2026-03-05_inventory-rework   — use specific plan
  /unikit-implement 2026-03-05_inventory-rework Phase 2          — specific folder + phase
```

### Example 8: Explicit folder override
```
User: /unikit-implement @.unikit/code/plans/2026-03-05_inventory-rework Phase 2

> Feature: 2026-03-05_inventory-rework (explicit @path)
> Phase 2: Migrate item categories
> Dependencies: Phase 1 (completed)
> 4 tasks pending
> Starting...
```

### Example 9: Explicit folder + status
```
User: /unikit-implement @.unikit/code/plans/2026-03-08_customers-system status

┌──────────────────────────────────────────────────────────┐
│ Feature: 2026-03-08_customers-system (explicit @path)  │
├──────────────────────────────────────────────────────────┤
│ [x] Phase 1: Interfaces                       (5/5)      │
│ [x] Phase 2: Models                           (3/3)      │
│ [x] Phase 3: Configuration                    (6/6)      │
│ [x] Phase 4: Integration                      (4/4)      │
├──────────────────────────────────────────────────────────┤
│ Progress: 18/18 (100% — completed)                        │
└──────────────────────────────────────────────────────────┘
```

### Example 10: Blocker encountered
```
> Blocker on task 3.2
>
> Problem: Class CustomerMetaEntity depends on IItemCategory,
> which is not yet defined (task 4.1).
>
> Options:
> 1. Skip and continue
> 2. Change implementation approach
> 3. Stop implementation and discuss
```
