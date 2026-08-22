---
name: unikit-improve
description: >-
  Refine an existing implementation plan with a second iteration. Re-analyzes the
  codebase for gaps, missing tasks, and wrong dependencies. Use after /unikit-plan or to
  improve a /unikit-fix plan, or when the user says "improve the plan", "what's wrong
  with the plan", or "update the plan from research". Optional +check flag validates
  refinements via a fresh-context subagent.
argument-hint: "[--list] [@plan-folder] [+check] [feature-name or improvement prompt]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(git *)
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Agent
  - AskUserQuestion
  - Skill
metadata:
  author: unikit
  version: "2.3"
  category: planning
---

# {{engine_name}} Improve - Feature Plan Refinement

Refine an existing feature plan by re-analyzing it against the codebase. Finds gaps, missing tasks, wrong assumptions, architectural issues, and enhances plan quality.

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

## Core Idea

```
existing feature plan (the PLAN.md manifest)
    + project rules (Bootstrap: RULES_INDEX → core/stack rules)
    + deeper codebase analysis via Explore tasks (with doc references)
    + user feedback (optional)
        ↓
find gaps, missing edge cases, wrong assumptions, architectural issues
        ↓
enhanced plan with better tasks, correct dependencies, more detail
```

## Code Analysis Rules

This skill is a **plan refinement orchestrator**, not a code writer. It loads project rules itself (Step 0.5 Bootstrap) and delegates codebase exploration to Explore tasks.

**For deep code analysis, use Explore tasks** (`Agent(subagent_type: Explore, model: sonnet, ...)`):
- Launch 2-3 tasks in parallel for different aspects of the codebase
- Each task MUST receive references to project doc files in its prompt — paths to `.unikit/ARCHITECTURE.md` and relevant core/stack rule files loaded in Bootstrap

**Do NOT use `/unikit-devcontext` or `develop-agent`** — these are for code-writing skills (`/unikit-implement`, `/unikit-fix`). Plan refinement needs code reading and analysis, not code writing.

**What you CAN do directly** (without Explore tasks):
- Read any `.md` documentation files (the plan manifest, `.unikit/*.md`)
- **Lightweight structural queries** via Glob/Grep — checking if a file/folder exists, listing `.asmdef` names, counting files matching a pattern, verifying a namespace or class name is present

**What you MUST delegate to Explore tasks:**
- Reading `.cs` file contents for understanding logic or implementation details
- Finding code patterns, existing implementations, integration points
- Checking architectural consistency against actual code
- Verifying assumptions about class relationships, DI bindings, inheritance hierarchies

The distinction: use Glob/Grep when you need a **yes/no structural fact** (does this file exist? does this class name appear anywhere?). Delegate to Explore tasks when you need to **understand how code works** or **evaluate architectural correctness**.

## Workflow

### Step 0: Find the Feature

Parse `$ARGUMENTS` for special tokens first:

```
- --list    → list available plans only (read-only, then STOP)
- @<path>   → explicit plan folder override (highest priority)
- +check    → run the fresh-context findings validator (see Step 3.5); strip the token, remember check = true
- remaining text → feature name or improvement prompt
```

When both `--list` and `@<path>` are present, `--list` wins and no refinement is executed. Strip `+check` from `$ARGUMENTS` before extracting the feature name / improvement prompt so it is never mistaken for prompt text; `+check` together with `--list` is silently ignored (no refinement to validate).

#### Priority 1: `@<path>` — explicit path override

If `$ARGUMENTS` contains `@<path>`:

1. Resolve the path (relative to project root; absolute paths allowed)
2. If the path is a directory holding a plan manifest (`<path>/PLAN.md`) → use it
3. If the path is a directory containing `TASKS.md` (a pre-merge plan) → tell the user to run `unikit-ai update` and **STOP**. Do not read or convert it here — `update` is the sole migrator, the same refuse-over-autofix principle `rules sync` applies with exit 8.
4. If missing → show "Plan folder not found: `<path>`" and **STOP**

Remaining argument text (after removing `@<path>`) is the improvement prompt.

```
/unikit-improve @.unikit/code/plans/2026-03-08_customers-system добавь обработку ошибок
→ folder: .unikit/code/plans/2026-03-08_customers-system, prompt: "добавь обработку ошибок"
```

#### Priority 2: `--list` — show available plans

If `$ARGUMENTS` contains `--list`, run read-only discovery and **STOP**:

```
1. Check if .unikit/code/PLAN.md exists (fast-mode plan)
2. Check if .unikit/code/FIX_PLAN.md exists (bugfix plan from /unikit-fix)
3. Get current branch:
   git branch --show-current
4. Scan .unikit/code/plans/ for all feature folders (both YYYY-MM-DD_name and legacy DDD-name formats)
5. For each, check if its .unikit/code/plans/<folder>/PLAN.md has uncompleted tasks (- [ ])
6. Mark which folder matches the current git branch (if any):
   - Extract feature name from branch (e.g. feature/customers-system → customers-system)
   - Match folder ending with _<feature-name> (new format) or *-<feature-name> (legacy)
7. Print availability summary (sorted lexicographically descending — newest first):

## Available Feature Plans

Current branch: feature/customers-system

💾 Fast plan: .unikit/code/PLAN.md (3 tasks remaining)
🔧 Fix plan:  .unikit/code/FIX_PLAN.md (2 tasks remaining)

  * 🔄 2026-03-08_customers-system        ← matches branch (4 tasks remaining)
    ✅ 2026-03-10_customers-service-pool   (completed)
    🔄 2026-03-09_customer-config-refactor (2 tasks remaining)

Use:
  /unikit-improve                                              # auto-detect (.unikit/code/PLAN.md → branch → latest)
  /unikit-improve customers-system                             # by name
  /unikit-improve @.unikit/code/plans/2026-03-08_customers-system  # by path

8. STOP.
```

**Important:** In `--list` mode — do not execute refinement, do not modify files.

#### Priority 3: `$ARGUMENTS` contains a feature name

If `$ARGUMENTS` contains a feature name (e.g., `2026-03-08_customers-system`, `customers-system`, or legacy `001-customers-system`):

1. Look for `.unikit/code/plans/$ARGUMENTS/` directory (exact match)
2. If not found by exact match → try partial match: scan `.unikit/code/plans/` for folders
   whose name **ends with** `_$ARGUMENTS` (new format) or `*-$ARGUMENTS` (legacy `DDD-*` format)
3. If found → use it
4. If NOT found → tell the user:

```
Feature "$ARGUMENTS" not found in .unikit/code/plans/.

Available features:
- [list existing feature folders]

What would you like to do?
1. Choose one of the existing features
2. Create a new feature plan
```

→ **STOP here.** Wait for user response.

#### Priority 4: No arguments — auto-detect by fast plan, fix plan, git branch, then latest

If `$ARGUMENTS` is empty (no parameters):

1. **Collect candidates:**
   - Check if `.unikit/code/PLAN.md` exists (flat fast-mode plan)
   - Check if `.unikit/code/FIX_PLAN.md` exists (bugfix plan from `/unikit-fix`)
   - Get current git branch: `git branch --show-current`
   - If on a `feature/*` branch → extract the feature name part (e.g., `feature/customers-system` → `customers-system`)
   - Scan `.unikit/code/plans/` for folders whose name **ends with** `_<feature-name>` (new format)
     or matches `*-<feature-name>` (legacy `DDD-*` format)
     - Example: branch `feature/customers-system` matches folder `2026-03-08_customers-system` or `001-customers-system`
   - If no branch match → sort all folders **lexicographically descending** and note the first one as "latest folder plan"

2. **Resolve ambiguity:**
   - If **no candidates** found (no flat plans, no folder plans) → show "No plans found" message and **STOP**:
     ```
     ⚠️ No plans found in .unikit/code/plans/, .unikit/code/PLAN.md, or .unikit/code/FIX_PLAN.md.

     Create a plan first:
     - /unikit-plan <description>  — for a feature plan
     - /unikit-fix <bug description> — for a bugfix plan
     ```
   - If **exactly one candidate** → use it
   - If **multiple candidates** (e.g., PLAN.md + FIX_PLAN.md, or a flat plan + folder plans, or multiple flat plans + branch-matching folder) → **ask the user** which plan to improve via `AskUserQuestion`, listing all candidates

3. **Use the resolved plan.**

**Ultra bundle check.** Read the first line of the resolved plan manifest. If it equals `<!-- unikit:plan-mode:ultra -->`, this is an ultra bundle: follow `.unikit/system/ultra-plan-read.md` for reading depth, integrity and mutability. Otherwise continue unchanged. **Discovery itself does not change** — the folder is found the way it always was; only what is read inside it differs.

**Reading depth:** read the manifest plus **every** phase file — improvement is not local, and moving a task between phases touches two of them.

### Step 0.5: Bootstrap Context (MANDATORY)

Before any analysis — silently load the project knowledge base. Do NOT narrate the loading process to the user.

#### Required reads (always, every time, in parallel)

1. **`.unikit/DESCRIPTION.md`** — project description, tech stack, constraints
2. **`.unikit/ARCHITECTURE.md`** — architecture decisions, folder structure, module rules, dependency directions
3. **Read `.unikit/memory/code/RULES_INDEX.md`**. Load rules:
   - **RULES.md**: ALWAYS read `.unikit/RULES.md` first (highest priority)
   - **Core**: read the Core table. For EACH row where Required By = `all` or contains `{{self_name}}` — read that file from `.unikit/memory/code/core/` using the Read tool. Do NOT skip any matching row. Always re-read at skill start, never rely on prior conversation cache
   - **Stack**: load dynamically when the current task or context matches "Load When" column, or when a need arises during work
4. **`.unikit/skill-context/{{self_name}}/SKILL.md`** — project-specific skill overrides (if exists)
5. `.unikit/system/dev-principles.md` — engine development principles, read on **two** levels (used in Step 2.3/2.4 architectural consistency checks and in the Guard B pass, Step 3.3a). Everything **above** the LAZY-READ BOUNDARY is read here, every time: the evidence contract, the claim-class → evidence-class lattice, the nine failure-class names, phase order, the lane, and the `kind` / area vocabularies. The section **below** the boundary — the nine detectors in full and the catalog checklist — is read **once per session, on the first task that touches editor state**, and read **unconditionally**: never gated on which rules happen to be installed, because that is exactly where the universal safety net would disappear (A9).
6. **`.unikit/system/ultra-plan-read.md`** — the reader contract for an ultra plan bundle: detection, per-consumer reading depth, what is mutable during execution, and the blocking integrity checks. Name it and follow it; never restate it here — one contract, one place.
   **If `.unikit/system/ultra-plan-read.md` is missing or unreadable, do not block:** treat every plan as a single-file plan and continue exactly as before — a project that predates the ultra port has no bundles to read.

Remember loaded rule file paths — pass them to Explore tasks in Step 2.

### Step 1: Load Feature Plan

- Read the **plan manifest** — `.unikit/code/plans/<folder>/PLAN.md` for a folder plan, `.unikit/code/PLAN.md` for a flat fast-mode plan. One file carries everything: `## Overview`, `## Settings`, the `## Checklist` with phases and dependencies, and `## Technical Context` (constraints, interfaces, key patterns, dependency graph, files, editor targets, DI bindings). For the full section list see `unikit-plan/references/TASK-FORMAT.md` → *Plan Manifest Template*; it is not restated here.
- If the manifest has a `## Based on` section → parse all linked research entries (folder name + `Attached` timestamp for each). Store as `linked_researches` list for Step 1.5. Also read each linked research's `RESEARCH_BRIEF.md` **alongside** the manifest's `## Technical Context` (not instead of it) — both are needed for cross-referencing in Step 3.8.

Understand:
- Feature scope and goals
- Current phases and tasks
- Dependencies between tasks
- Which tasks are already completed (checkboxes `- [x]`)
- Architecture decisions made
- Which researches are linked and when they were attached

### Step 1.5: Research Check

Check whether research context has changed since the plan was created or if new relevant researches exist. This step is **optional enrichment** — if no research updates are found, proceed silently to Step 2.

#### Case A: Plan has linked researches (`## Based on` exists with entries)

1. For each entry in `linked_researches`:
   - Read `.unikit/code/researches/INDEX.md` and find the matching entry by `Path`
   - Compare its `Updated` timestamp against the `Attached` timestamp from the plan
   - If `Updated > Attached` → the research was revised after being linked to the plan. Mark it as `research_updated = true`

2. If any `research_updated = true`:
   - Re-read the updated research's `RESEARCH_BRIEF.md`
   - Compare new constraints, interfaces, and decisions against the current manifest — its `## Technical Context` and its `## Checklist`
   - Collect differences as `research_improvements` (these will appear in the report under a dedicated section)

3. After processing linked researches → check for **new** researches:
   - Read `.unikit/code/researches/INDEX.md`
   - Find the latest `Attached` timestamp among all `linked_researches` entries
   - Filter index for researches with `Date` **newer** than this latest `Attached` timestamp
   - Take up to 5 entries, check relevance against the plan's feature scope (compare Summary against plan Overview)
   - If relevant entries found → ask user:
     ```
     AskUserQuestion: Found new researches since the plan was created:

     1. <Title> (<Date>) — <Summary>
     2. <Title> (<Date>) — <Summary>

     Use them to improve the plan?

     Options:
     1. Yes — use all
     2. Let me pick (specify numbers)
     3. Skip — improve without new researches
     ```
   - If user selects researches → read their `RESEARCH_BRIEF.md`, add findings to `research_improvements`, and prepare to attach them to `## Based on` in Step 5

4. If no updates and no new relevant researches → proceed to Step 2 silently.

#### Case B: Plan has NO linked researches (no `## Based on` or empty)

1. **Check current session** — look in the conversation history for results of `/unikit-explore`. If found and relevant to the plan → use as research context, add to `research_improvements`.

2. **Check index** — if no session context:
   - Read `.unikit/code/researches/INDEX.md`
   - Take the **last 5 entries** (index is sorted newest-first)
   - Check relevance against the plan's feature scope
   - If relevant entries found → ask user (same question format as Case A step 3)
   - If user selects → read their `RESEARCH_BRIEF.md`, add to `research_improvements`, prepare to attach in Step 5

3. If nothing found or user skips → proceed to Step 2 silently.

#### After Step 1.5

Regardless of the outcome, **always continue to Step 2** (Deep Codebase Analysis). Research improvements are collected separately and will be merged into the final report in Step 4, appearing in a dedicated section before the standard codebase analysis findings.

### Step 2: Deep Codebase Analysis

Follow the delegation rules from **Code Analysis Rules** section above.

Formulate analysis questions based on the feature plan, then launch Explore tasks in parallel. Each task MUST receive references to project doc files in its prompt.

**Doc references to include in every Explore task prompt:**
- `.unikit/ARCHITECTURE.md` — always (module boundaries, dependency rules)
- Core rule files loaded in Bootstrap — pass the **paths from RULES_INDEX.md** relevant to the task's focus
- Stack rule files loaded in Bootstrap — pass if the task's focus involves that framework

**Example: launching parallel tasks for a customer system feature:**

```
Task 1 — Existing code & bindings:
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Before analysis, read these project docs:
   - .unikit/ARCHITECTURE.md
   - [core rule paths from RULES_INDEX.md Core table]

   Find all existing customer-related classes, interfaces,
   and installers. Show their relationships and Zenject bindings.
   Check for ICustomer, SimpleCustomer, CustomerInstaller, etc.
   Thoroughness: medium.")

Task 2 — Integration points:
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Before analysis, read these project docs:
   - .unikit/ARCHITECTURE.md
   - [core rule paths from RULES_INDEX.md Core table]

   Find all SignalBus events (ISignal structs) related to
   gameplay flow. Check how Bootstrap loading operations work
   and what integration points exist for new systems.
   Thoroughness: medium.")

Task 3 — Save & controller patterns:
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Before analysis, read these project docs:
   - .unikit/ARCHITECTURE.md
   - [core rule paths from RULES_INDEX.md Core table]

   Check existing SaveSerializer implementations.
   Find the pattern for adding new save data to the system.
   Look at existing GRASP controllers for reference patterns.
   Thoroughness: medium.")
```

**Fallback:** If Agent tool is unavailable, investigate directly using Glob/Grep for structural checks and Read for code understanding.

After tasks return, **synthesize** their findings with the project rules loaded in Bootstrap.

**What to analyze (delegate these questions):**

**2.1: Trace existing code paths**
- Existing patterns the plan should follow
- Code that already partially implements what a task describes
- Hidden dependencies the plan missed
- Shared utilities or services the plan should reuse

**2.2: Check integration points**
- Zenject installer registrations needed
- SignalBus events that need declaring
- Addressable asset references
- SaveSystem serializers needed
- Bootstrap loading operations
- Module boundary violations (Modules → Game is FORBIDDEN)

**2.3: Check architectural consistency**
- Non-MonoBehaviour first principle adherence
- Model-View separation, GRASP controller patterns
- R3 reactive subscription cleanup (`.AddTo()`)
- UniTask with CancellationToken on every async method
- Proper DI registration patterns (`.NonLazy()` for controllers/presenters)

**2.4: Check edge cases**
- Missing `CancellationToken` propagation
- Missing R3 subscription disposal
- Missing Odin `[Required]` attributes
- ZLinq usage instead of System.Linq in hot paths

### Step 3: Identify Improvements

Compare the plan against what you found. Categorize issues:

**3.1: Missing tasks**
- Tasks that should exist but don't (e.g., installer registration, save serializer, signal declarations)
- Tasks for edge cases not covered
- Missing test tasks for new systems

**3.2: Task quality issues**
- Descriptions too vague (no file paths, no specific implementation details)
- Missing specific class names or namespaces
- Incorrect assumptions about existing code
- Missing reference to existing patterns that should be followed

**3.3: Dependency issues**
- Wrong task/phase order
- Missing dependencies between phases
- Tasks that could run in parallel but are sequential

**3.3a: Guard B — a phase carrying an `Editor:` task must be serialized alone in its execution layer**

This skill is the **third writer of tasks** (after `/unikit-plan` and `/unikit-plan add`), so it checks the constraint on a plan it did not write.

The unit of parallelism downstream is the **phase**: `unikit-implement-coordinator` builds the phase graph from the `**Dependencies:**` lines, computes execution layers (Layer 0 = phases with no dependencies; Layer N = phases whose dependencies all sit in layers 0..N-1) and runs **every phase of one layer concurrently**, while tasks inside a phase run in order.

Procedure:

1. Collect the phases carrying at least one `Editor:` line.
2. Recompute the execution layers from the plan's `**Dependencies:**` lines, exactly as the coordinator does.
3. A layer that holds an editor phase **and** any other phase is a finding.

Two things this check is **not**. It is not a rule about tasks — two `Editor:` tasks inside one phase are already sequential, and recommending they be split would manufacture the very collision the guard exists to prevent; never propose that fix. And it is not limited to editor-versus-editor conflicts — a neighbouring **code** phase writes a source file, the editor re-reads it, the domain reloads, and minutes of unavailability land in the middle of another phase's mutation. Any co-resident phase is the finding, whatever it is doing.

The fix is always on the dependency lines, never on the phase contents: make the editor phase depend on everything that must precede it, and make every remaining phase depend on it directly or transitively.

Each finding goes into the 🔄 Dependency Fixes group in the format below — it must name the **layer**, every phase sharing it, and the `Editor:` task that forces the serialization, because without those three the reader cannot tell which dependency line to add.

```
🔒 Layer <N> holds Phase <X> beside editor Phase <Y>
   Editor task: Phase <Y> / Task <n.m> — `Editor: [kind] <container> → <target> : <action>`
   Fix: add `Phase <Y>` to Phase <X>'s **Dependencies:** (or the reverse, if <X> must run first)
```

**3.4: Redundant or duplicate tasks**
- Two tasks doing the same thing
- Task unnecessary because code already exists
- Task that duplicates existing module functionality

**3.5: Scope issues**
- Tasks too large (should be split into smaller steps)
- Tasks too small (should be merged)
- Tasks outside feature scope (gold-plating)

**3.6: Architectural issues**
- Module boundary violations in the plan
- Wrong namespace assignments
- Missing SOLID/GRASP principle adherence
- Plan suggests patterns that contradict project conventions

**3.7: User-prompted improvements (if specific feedback in `$ARGUMENTS`)**

If the user provided improvement instructions beyond just a feature name:
- Apply the user's feedback to the plan
- Look for tasks that need modification
- Add new tasks if required

**3.8: Research consistency (only when `research_improvements` is non-empty)**

If Step 1.5 produced `research_improvements` (from updated or newly linked researches):
- Compare research `RESEARCH_BRIEF.md` constraints against the manifest's `### CONSTRAINTS` — find mismatches
- Find interfaces defined in research but missing from plan tasks
- Find decisions in research that contradict plan tasks
- Flag research open questions that the plan resolved without justification
- Each finding goes into `research_improvements` list with source attribution (which research it came from)

### Step 3.5: Validate Findings (`+check` only)

Run this step **only** when `check = true` (the `+check` flag was parsed in Step 0) and Step 3 produced at least one finding in a validated group. Otherwise skip it entirely — no validator lines appear anywhere in the output and the Step 4 / Step 5.8 Summary keeps its default shape.

Follow the full procedure in **`references/CHECK-MODE.md`**: it dispatches one fresh-context `Agent(subagent_type: Explore, model: sonnet)` validator over the four codebase-traceable groups (`missing`, `improvements`, `architectural`, `removals`), applies each `keep`/`modify`/`drop` verdict, recomputes the 🔄 Dependency Fixes group on the filtered list (phase b), and tracks the `hidden` / `adjusted` counters. The **Research-Based Findings** (`research_improvements`) and the 🔄 Dependency Fixes group are **not** validated.

**Fallback (do NOT inline-analyze):** if the validator agent is unavailable/blocked or the dispatch fails, the procedure keeps **all** findings as-is and emits the single line `WARN [+check]: validator failed (<reason>), all items kept as-is` — it never re-does the validator's work with Glob/Grep/Read. This `+check` path is **exempt** from the `## Subagent Delegation — BLOCKING PRE-REQUISITE` rule: an unavailable validator is silently skipped, the user is never asked.

The filtered findings (and recomputed dependencies) are what Step 4 renders.

### Step 4: Present Improvements

Show the user what you found. When `research_improvements` is non-empty, the report has two sections: research-based findings first, then codebase analysis findings. When empty, only the standard section appears.

```
## Plan Improvement Report

Feature: [feature folder name]
Files: <plan folder>/PLAN.md
Phases analyzed: N
Tasks analyzed: N
Researches checked: N (list names if any)

### Research-Based Findings (only if research_improvements is non-empty)

Source: [research folder name(s)]

#### Updated Constraints (N)
1. **[Constraint from research]**
   Change: [what changed in the research vs what the plan has]
   Action: [update the constraint in `## Technical Context` / update task description]

#### New/Changed Interfaces (N)
1. **[Interface name]**
   Change: [new method / changed signature / removed]
   Action: [add task / update existing task]

#### Research-Plan Contradictions (N)
1. **[Issue]**
   Research says: [X]
   Plan says: [Y]
   Recommendation: [which to follow and why]

#### New Researches to Attach (N) (only if new researches were selected in Step 1.5)
1. **[Research title]** (<date>)
   Relevant findings: [brief summary of what this research adds]

### Codebase Analysis Findings

#### ⚠️ Missing Tasks (N)
1. **[Task description]**
   Reason: [why this task is necessary]
   After: [dependency on phase/task]

#### 🔍 Task Improvements (N)
1. **Phase X, Task Y: [name]**
   Issue: [what's wrong]
   Fix: [what needs to change]

#### 🔄 Dependency Fixes (N)
1. Phase X should depend on Phase Y
   Reason: [why]
2. 🔒 Layer N holds Phase X beside editor Phase Y
   Editor task: Phase Y / Task n.m — `Editor: [kind] <container> → <target> : <action>`
   Fix: add `Phase Y` to Phase X's **Dependencies:** (or the reverse, if X must run first)

#### 🏗️ Architectural Notes (N)
1. **[Issue description]**
   Recommendation: [how to fix]

#### 🗑️ Removals (N)
1. **Task: [name]**
   Reason: [why it's redundant]

### Summary
- Research-based changes: N
- Missing tasks: N
- Tasks to improve: N
- Dependencies to fix: N
- Architectural notes: N
- Tasks to remove: N
- Hidden by +check: N      (only when +check ran successfully — see Step 3.5)
- Adjusted by +check: M    (only when +check ran successfully — see Step 3.5)

Apply improvements?
1. Yes, apply all
2. Choose which to apply
3. No, keep the plan as is
```

Based on choice:
- **Apply all** → apply all improvements to the manifest, proceed to Step 5
- **Choose which** → use `AskUserQuestion` with `multiSelect: true` to let the user pick items. Group options by category (Missing Tasks, Task Improvements, Dependency Fixes, Architectural Notes, Removals). Each option label = `"#N: short description"`. After the user selects → proceed to Step 5, applying **only the selected items**. Unselected items are skipped without comment.
- **No** → keep plan as is → **STOP**

**If no improvements found:**

```
## Plan Review Complete

✅ The plan looks good! No significant issues found.

Feature: [feature folder name]
Phases: N, Tasks: N

Ready to proceed with implementation.
```

### Step 5: Apply Approved Improvements

Based on user's choice, apply changes sequentially.

Use `Edit` for every change. **`Write` over a plan manifest is forbidden** — the file carries `## Technical Context` (and, in an ultra bundle, `## Phase Index`), and a regenerating write silently drops whatever the current pass did not reconstruct. When a change is too large for a single `Edit`, split it into several `Edit` calls; do not fall back to `Write`.

**Editing an ultra bundle.** The manifest and every affected phase file are edited **together** — never regenerate the manifest alone when phase detail changed, and never write a checkbox into a phase file. After the write, re-run the bundle integrity checks named in `.unikit/system/ultra-plan-read.md`; a bundle left inconsistent by an improvement blocks the next consumer that opens it.

**5.1: Add missing tasks to the manifest's `## Checklist`**

For each new task from the report:
1. Determine the correct phase (create a new phase if needed)
2. Insert the task with `- [ ]` checkbox at the correct position within its phase
3. Include file paths, class names, and a brief WHY context in the description
4. If the task has dependencies, note them inline (e.g., `(after Phase 1)`)
5. Add an `Editor:` line — one per editor target, placed after `Files:`, in the form `Editor: [kind] <container> → <target> : <action>` — **only** when the change touches the editor's **serialized state**. A pure code task omits the field, and when `engine_rules_loaded = false` (no `ENGINE_RULES.md` for this engine) it is not generated at all. Match the form already used by the surrounding tasks in the plan.

**5.2: Improve existing task descriptions in the manifest**

For each task flagged for improvement:
1. Locate the exact task line in the manifest's `## Checklist`
2. Replace the vague description with the improved one from the report
3. Add specific file paths, class names, namespace references
4. Do NOT change `- [x]` to `- [ ]` — preserve completion status

**5.3: Fix dependency ordering in the manifest**

1. Move tasks/phases to correct positions if ordering was wrong
2. Update inline dependency references if task numbers shifted
3. Verify that no task references a dependency that comes after it

**5.4: Remove redundant tasks from the manifest**

1. Delete the task line (and its sub-items if any)
2. Check if the parent phase is now empty — remove the phase header too if so
3. Update any other tasks that referenced the removed task

**5.5: Update research references in the manifest (`## Based on`)**

Only when `research_improvements` is non-empty (Step 1.5 found updates):

1. **Updated linked researches** — for each research where `Updated > Attached`: update the `Attached` timestamp to the current time (`YYYY-MM-DD HH:MM`). This marks that the plan now reflects the latest research state.

2. **Newly attached researches** — for each new research the user selected in Step 1.5: add a new entry to `## Based on` using the Research Reference Format from `/unikit-plan` (folder name, `Attached` timestamp, file links). If `## Based on` section doesn't exist yet, create it after `## Overview`.

**5.6: Update `## Technical Context` in the manifest**

Only when the applied improvements changed the technical picture:
1. `### INTERFACES` — add interfaces that appeared in new tasks or from research; remove interfaces for deleted tasks
2. `### CONSTRAINTS` — update if architectural assumptions changed during analysis or from updated research constraints
3. `### FILES` — add new paths from new tasks; remove paths for deleted tasks
4. `### DI BINDINGS` — update if new bindings are needed for new tasks
5. `### EDITOR TARGETS` — add a row for every editor target in new tasks; remove rows for deleted tasks (symmetric with FILES). Leave the subsection absent when the plan has no `Editor:` task

The section always exists — there is no "create it if missing" branch any more.

**5.7: Update Overview section**

If the total number of tasks or phases changed significantly (added a phase, removed multiple tasks):
1. Update `## Overview` task/phase counts
2. Update scope description if new tasks expanded or narrowed the feature

**5.8: Confirm completion**

```
## Plan Improved

Research updates: (only if research_improvements was non-empty)
- Researches re-synced: N (list names, updated Attached timestamps)
- New researches attached: N (list names)
- Constraints/interfaces updated from research: N

+check validation: (only when +check ran successfully — see Step 3.5)
- Hidden by +check: N
- Adjusted by +check: M

💾 Changes applied to .unikit/code/plans/[feature]/PLAN.md:
- Tasks added: N (list brief names)
- Descriptions improved: N
- Dependencies reordered: N
- Tasks removed: N
- Technical Context updated: interfaces N, constraints N, files N (only if changed)
```

### Step 6: Next Steps

```
Plan improved. What's next?

Options:
1. 🚀 Implement now — start /unikit-implement
2. 🔄 Review plan again — re-run /unikit-improve
3. ✅ Done for now
```

Based on choice:
- **Implement now** → invoke `/unikit-implement @<resolved-plan-path>`, passing the same plan path used in this session (e.g., `@.unikit/code/plans/2026-03-08_customers-system` or `@.unikit/code/PLAN.md`)
- **Review again** → invoke `/unikit-improve @<resolved-plan-path>` to reload the skill from scratch with full re-analysis
- **Done for now** → suggest `/clear` or `/compact` → **STOP**

### Context Cleanup

Suggest the user to free up context space if needed: `/clear` (full reset) or `/compact` (compress history).

## Important Rules

1. **Don't rewrite from scratch** — improve the existing plan, don't replace it
2. **Preserve completed work** — never modify or remove `- [x]` completed tasks
3. **Traceable improvements** — every change must be justified by codebase analysis
4. **No gold-plating** — don't add tasks outside the feature scope unless critical
5. **User approves first** — never apply changes without user confirmation
6. **Keep the manifest internally consistent** — after improvements, `### INTERFACES`, `### FILES` and `### EDITOR TARGETS` must match the tasks in `## Checklist`. There is no second file to sync with; the check is inside one file
7. **Agent-based delegation** — follow the rules in the **Code Analysis Rules** section; single source of truth for what to delegate vs. do inline
8. **Respond in the configured language** — use `language.ui` from `.unikit/config.yaml` (default: English)

## Examples

### Example 1: Auto-detect by git branch

```
User: /unikit-improve
(current branch: feature/customers-system)

→ Branch: feature/customers-system → looking for *_customers-system
→ Found: .unikit/code/plans/2026-03-08_customers-system/
→ Reading the plan manifest...
→ Bootstrap: loading rules from RULES_INDEX...
→ Deep codebase analysis via Explore tasks...
→ Report with findings → User approves → Changes applied
```

### Example 2: Auto-detect fallback to latest

```
User: /unikit-improve
(current branch: main — no matching feature)

→ No branch match for "main"
→ Latest feature by date: 2026-03-10_customers-service-pool
→ Reading feature files...
→ Analysis...
```

### Example 3: Specific feature by name

```
User: /unikit-improve 2026-03-08_customers-system

→ Found: .unikit/code/plans/2026-03-08_customers-system/
→ Reading feature files...
→ Analysis...
→ Report...
```

### Example 4: Partial name match

```
User: /unikit-improve customers-system

→ No exact match for "customers-system"
→ Partial match: .unikit/code/plans/2026-03-08_customers-system/
→ Using it...
```

### Example 5: Explicit path override

```
User: /unikit-improve @.unikit/code/plans/2026-03-08_customers-system добавь обработку ошибок

→ Explicit path: .unikit/code/plans/2026-03-08_customers-system/
→ Improvement prompt: "добавь обработку ошибок"
→ Reading feature files...
→ Analysis focused on error handling...
```

### Example 6: List mode

```
User: /unikit-improve --list

## Available Feature Plans

Current branch: feature/customers-system

  Fix plan:  .unikit/code/FIX_PLAN.md (2 tasks remaining)

  * 2026-03-08_customers-system        ← matches branch (3 tasks remaining)
    2026-03-09_customer-config-refactor (completed)
    2026-03-10_customers-service-pool   (5 tasks remaining)

Use:
  /unikit-improve                                              # auto-detect
  /unikit-improve customers-system                             # by name
  /unikit-improve @.unikit/code/plans/2026-03-08_customers-system  # by path
```

### Example 7: Fix plan auto-detected

```
User: /unikit-improve
(no .unikit/code/PLAN.md, .unikit/code/FIX_PLAN.md exists)

→ Found fix plan: .unikit/code/FIX_PLAN.md
→ Reading plan...
→ Bootstrap: loading rules from RULES_INDEX...
→ Deep codebase analysis via Explore tasks...
→ Report with findings → User approves → Changes applied
```

### Example 8: Feature not found

```
User: /unikit-improve nonexistent-feature

→ Feature "nonexistent-feature" not found in .unikit/code/plans/.

Available features:
- 2026-03-08_customers-system
- 2026-03-09_customer-config-refactor
- 2026-03-10_customers-service-pool

What would you like to do?
```
