---
name: unikit-plan
description: >-
  Create an implementation plan for a feature — a dependency-ordered, actionable task
  list for the project. Has three modes: fast (a quick single-pass plan), full (a richer
  plan that can also create a git branch), and add (extend an existing plan with more
  tasks). Pick the mode from the user's wording: "full plan" runs full; "quick plan" or
  "fast plan" runs fast; a plain "create a plan" with no qualifier defaults to fast; "add
  to the plan" or "extend the plan" runs add. Use whenever the user wants to plan a
  feature or task, e.g. "create a plan", "create a full plan", "create a quick plan",
  "plan this feature", "just plan this", "add this to the plan", "extend the plan", "add
  a phase to the plan".
argument-hint: "[fast | full | add | --list] [--base <branch>] <feature description in free form>"
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
  - Agent
  - Skill
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "7.2"
  category: planning
---

# {{engine_name}} Feature Plan Generator

Create a structured feature plan and roadmap for the current {{engine_name}} project.

Three modes:
- **Fast** — quick plan, no git branch, saves to `.unikit/code/PLAN.md`
- **Full** — optionally creates `<git.branch_prefix><name>` git branch (when `git.enabled` and `git.create_branches`), asks preferences, saves to `.unikit/code/plans/<dated-folder>/`
- **Add** — modify/extend an existing plan without creating a branch

**Output artifacts by mode:**

**Fast mode** → single flat file `.unikit/code/PLAN.md`:
- Contains everything: overview, settings, checklist, commit plan, dependency graph, and a `## Technical Context` section with plan-brief content (always generated based on current codebase state).
- Temporary plan for quick work — `/unikit-implement` may offer deletion after completion.

**Full mode** → folder `.unikit/code/plans/{YYYY-MM-DD}_{feature-name}/`:
- **`TASKS.md`** — actionable checklist with WHY context per task, effort estimates, file paths, commit plan, dependency graph.
- **`PLAN-BRIEF.md`** — always created. Structured technical brief (constraints, interfaces, key patterns, dependency graph, files) for the implementing agent, based on current codebase state at planning time.

When a research is linked (from `/unikit-explore`), the plan references it via `## Based on` using the Research Reference Format below. The research's `RESEARCH_BRIEF.md` is used as **input** for generating the plan's own `PLAN-BRIEF.md`, not as a replacement. This ensures the plan's brief reflects the actual codebase state at planning time, which may differ from exploration time.

### Research Reference Format

Standard block for `## Based on` when linking to a research. Each research entry includes an `Attached` timestamp (`YYYY-MM-DD HH:MM`) — this is the moment the research was linked to the plan. `/unikit-improve` uses `Attached` to detect if the research was updated after linking.

```
### YYYY-MM-DD_name
- **Attached**: YYYY-MM-DD HH:MM
- `RESEARCH_BRIEF.md` — structured technical context
- `RESEARCH_RESULT.md` — full research (consult when brief is unclear)
- `RESEARCH_SOURCE.md` — original exploration dialogue (only include if file exists)
```

Full paths are resolved from `.unikit/code/researches/<folder-name>/`. Example:

```
### 2026-03-15_customer-items-on-scene
- **Attached**: 2026-03-15 16:30
- `RESEARCH_BRIEF.md` — structured technical context
- `RESEARCH_RESULT.md` — full research (consult when brief is unclear)
- `RESEARCH_SOURCE.md` — original exploration dialogue
```

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

## Input

`$ARGUMENTS` — optional keyword `full`, `fast`, or `add`, optional `--base <branch>` flag, followed by free-form description in any language.

**Parsing rules:**
1. Extract `--base <branch>` if present anywhere in arguments → store as `base_branch`, remove from text
2. If `--list` is present → list mode, show all plans and STOP
3. If the first word (after flag removal) is `full` → full mode, remaining text is the feature description
4. If the first word is `fast` → fast mode, remaining text is the feature description
5. If the first word is `add` → add mode, remaining text is what to add/change in the existing plan
6. Otherwise → ask interactively, entire text is the description

`--base <branch>` — the branch to create the feature branch from (full mode only). `--base` flag overrides `git.base_branch` from config. Priority: `--base` flag > `git.base_branch` from `.unikit/config.yaml` > fallback `main`.

## Workflow

### Step 0: Parse Mode & Select Mode

```
/unikit-plan full Item appraisal system                    → mode: full, base: HEAD, description: "Item appraisal system"
/unikit-plan full --base master Item appraisal system      → mode: full, base: master, description: "Item appraisal system"
/unikit-plan fast Item appraisal system                    → mode: fast, description: "Item appraisal system"
/unikit-plan add Add error handling phase                  → mode: add, description: "Add error handling phase"
/unikit-plan Item appraisal system                         → mode: ?, ask user
```

Initialize flags: `research_pre_linked = false`, `research_linked = false`, `design_linked = false`.

**If mode is `--list`** → skip to **List Mode** section below.

**If mode is `add`** → run **Step 0.5 (Bootstrap Context)**, then skip to **Add Mode** section below.

### Step 0.1: Resolve Git State

Do **not** auto-run `git init`.

Resolve the current git mode from `.unikit/config.yaml`:

- `git.enabled: true` → git-aware workflow is allowed
- `git.enabled: false` → no-git workflow only
- `git.base_branch` → target branch for diffs/merge guidance (default: detected
  branch or `main`)
- `git.create_branches: true` → full mode may create a branch
- `git.create_branches: false` → full mode still creates a rich plan, but stays
  on the current branch

If `git.enabled = false`:

- Skip all branch commands
- Save full-mode plans under `.unikit/code/plans/<slug>/` (slug-based fallback)
- Treat the "create feature branch" step as unavailable

If `git.enabled = true` but the repository is not actually inside a git work tree:

- Warn the user that git-aware actions are unavailable until the repository is
  initialized
- Fall back to the same no-git behavior as above

### Step 0.2: Resolve Feature Description

If the user provided a feature description → use it and skip this step.

If the description is empty (user only typed a mode keyword like `full` or `fast`, or no arguments at all):

1. **Check session context** — look in the current conversation history for results of `/unikit-explore`. If found, use the exploration topic and findings as the feature description and context.

2. **Check recent researches** — if no session context, read `.unikit/code/researches/INDEX.md` (if it exists). The index is sorted newest-first. Take the first entry and ask:
   ```
   AskUserQuestion: Found recent research: "<Title>" (<Date>)
   Use as basis for planning?

   Options:
   1. Yes — use this research
   2. No — I'll describe the feature myself
   ```
   Based on choice:
   - Yes → use research title/summary as description, mark `research_pre_linked = true` (skip research matching in Step 2)
   - No → proceed to ask user for description (step 3 below)

3. **No context available** — if neither session context nor researches exist, ask the user for a description:
   ```
   AskUserQuestion: Describe the feature you want to plan.
   ```

**If no mode keyword** (`full`/`fast`/`add`) is found:

If the description was already resolved above → ask only about the mode:
```
AskUserQuestion: Which planning mode?

Options:
1. Full (recommended) — creates git branch, codebase reconnaissance, full plan
2. Fast — quick plan without a branch
```

If the description is ALSO still missing (no session context, no researches chosen) → combine into a single question:
```
AskUserQuestion:
1. Describe the feature you want to plan.
2. Which planning mode?
   a. Full (recommended) — creates git branch, codebase reconnaissance, full plan
   b. Fast — quick plan without a branch
```

Based on choice:
- Full → proceed to Full Mode steps
- Fast → proceed to Fast Mode steps

### Step 0.5: Bootstrap Context (MANDATORY — all modes except List)

Before any exploration or planning — silently load the project knowledge base. Do NOT narrate the loading process to the user. Runs for fast, full, and add modes.

#### Required reads (always, every time, in parallel)

1. **`.unikit/DESCRIPTION.md`** — project description, tech stack, constraints
2. **`.unikit/ARCHITECTURE.md`** — architecture decisions, folder structure, module rules, dependency directions
3. **Read `.unikit/memory/code/RULES_INDEX.md`**. Load rules:
   - **RULES.md**: ALWAYS read `.unikit/RULES.md` first (highest priority)
   - **Core**: read the Core table. For EACH row where Required By = `all` or contains `{{self_name}}` — read that file from `.unikit/memory/code/core/` using the Read tool. Do NOT skip any matching row. Always re-read at skill start, never rely on prior conversation cache
   - **Stack**: load dynamically when the current task or context matches "Load When" column, or when a need arises during work
4. **`.unikit/skill-context/{{self_name}}/SKILL.md`** — project-specific skill overrides (if exists)

#### Patches (learning from past fixes)

If `.unikit/code/patches/` exists:
- Use `Glob` to find all `*.md` files
- Read each patch to learn from past fixes
- Account for known pitfalls when designing the plan — tasks should avoid patterns that caused bugs

#### Design context (game-design module — optional)

Check whether `.unikit/gamedesign/GD-IDS.yaml` exists.

- **Exists** → this project carries a game-design workspace. **Schema guard (clean
  break — no automatic migration):** the registry MUST be `version: 2`. On a pre-v2
  `version: 1` registry, do NOT read it — emit a loud `ERROR [design] GD-IDS.yaml is
  version 1 (pre-v2 layout); design grounding unavailable until the workspace is
  upgraded via /unikit-gd-spec` and set `design_linked = false` (the plan continues
  purely code-side, never silently misreading the old layout). With a valid
  `version: 2`, set `design_linked = true` and note it for **Step 4.5**, which reads
  the relevant system design (and any flow that exercises it) and produces the plan's
  `## Design` + optional `## Flow Context` snapshots. Do NOT read the design docs here
  — Step 4.5 owns that, after the feature scope is clear.
- **Absent** → set `design_linked = false` and skip every design step. The plan is
  purely code-side, exactly as before — projects without a design module are unaffected.

**One-way boundary:** planning *reads* design (`GD-IDS.yaml`, `systems/*.md`,
`flows/*.md`, and the read-only `## System Map [gen]` / `## Flow Map [gen]` in
`GAME.md`); it never writes or edits any `.unikit/gamedesign/` artifact. Design
changes flow only through the `/unikit-gd-*` skills.

Remember loaded rule file paths — pass them to Explore tasks in Step 4.

### Step 1: Determine Feature Name and Folder

1. Read the description and understand the feature intent.
2. **Invent a short English name** for the feature — maximum 3-4 words, lowercase, hyphenated.
   Examples: `mini-games-editor`, `customer-dialogue`, `item-appraisal-system`, `wallet-ui`.

**Fast mode** → skip steps 3-5 below. The plan goes to `.unikit/code/PLAN.md` (flat file, no folder).

**Full mode** → continue:

3. **Get today's date** in `YYYY-MM-DD` format.
4. Compose the folder name: `{YYYY-MM-DD}_{feature-name}` (e.g. `2026-03-10_item-appraisal-system`)

```
# Example
ls .unikit/code/plans/
# 2026-03-08_mini-games-editor/
# 2026-03-09_customer-types/
# → next: 2026-03-10_<new-feature>
```

---

## List Mode — Show Available Plans

When `--list` is present in arguments, show all available plans and STOP.

### List Step 1: Collect Plans

Scan for plans in all locations:
1. **Fast plan** — check if `.unikit/code/PLAN.md` exists
2. **Full plans** — list all folders in `.unikit/code/plans/` (if directory exists)
3. **Fix plan** — check if `.unikit/code/FIX_PLAN.md` exists

### List Step 2: Gather Info

For each found plan:
- **Name** — folder name (for full plans), "PLAN.md" (fast), "FIX_PLAN.md" (fix)
- **Progress** — count completed (`- [x]`) and total (`- [ ]` + `- [x]`) task checkboxes
- **Branch match** — compare plan name with current git branch (`git branch --show-current`). If on `<configured branch prefix><name>` and a plan folder ends with `_<name>` → mark as `← current branch`

### List Step 3: Display

```
Available plans:

  Plan                                    Progress       Branch
  ──────────────────────────────────────────────────────────────
  .unikit/code/plans/2026-03-10_night-trading  🔄 3/12       ← current branch
  .unikit/code/plans/2026-03-08_mini-games     ✅ 12/12      feature/mini-games
  .unikit/code/PLAN.md                         ⏳ 0/5        —
  .unikit/code/FIX_PLAN.md                     ⏳ 1/3        —

To start implementation: /unikit-implement
To modify a plan: /unikit-plan add <changes>
```

If no plans found:
```
No plans found.

Create one:
  /unikit-plan fast <description>
  /unikit-plan full <description>
```

**After displaying → STOP.** Do not continue to planning.

---

## Add Mode — Modify Existing Plan

Modifies an existing plan in-place. Never creates a new branch.

### Add Step 1: Find & Load Plan

Use unified plan detection:
1. Check both locations: `.unikit/code/PLAN.md` (fast plan) and `.unikit/code/plans/` (full plans — match by git branch `<configured branch prefix>*` → folder ending with `_<feature-name>`, or latest folder sorted lexicographically descending)
2. Both exist → ask user which to modify
3. Only one exists → use it
4. No plan found → tell user to create one first, **STOP**

Load the plan: `TASKS.md` + `PLAN-BRIEF.md` for folder plans, or `PLAN.md` for fast plans.

Project docs (DESCRIPTION.md, ARCHITECTURE.md, RULES.md, core/stack rules) are already loaded by Bootstrap (Step 0.5).

### Add Step 2: Analyze & Apply

Parse the user's description and determine changes: new tasks/phases, modifications, settings, updates to PLAN-BRIEF.md (full mode) or `## Technical Context` (fast mode).

If changes require codebase understanding → launch Explore tasks (same as Step 4 Phase A). Skip if purely structural.

Apply changes with Edit tool, preserving unaffected content:
- New tasks/phases follow existing format (numbering, WHY, Files, effort)
- Update Total Estimated Effort, Commit Plan, Dependency Graph as needed
- Update PLAN-BRIEF.md / Technical Context if changes affect constraints, interfaces, or patterns

### Add Step 3: Confirm

Show: plan path, what changed, updated effort. Ask if anything needs adjustment. **STOP after confirmation.**

---

## Full Mode — Additional Steps

These steps run **only in full mode**, before the shared planning workflow.

### Step A: Decide on Git Branch

**If `git.enabled = false` or `git.create_branches = false`:**
- Skip this step entirely
- Mark `branch_created = false`, continue to next step

**If `--base <branch>` was provided** — skip the question, always create the branch (the flag implies intent).

**Otherwise**, ask the user whether to create a feature branch or stay on the current one:

```
AskUserQuestion: Create a feature branch?

Options:
1. Yes — create <git.branch_prefix><feature-name> (recommended for new work)
2. No — stay on the current branch
```

Based on choice:
- Yes → create feature branch, mark `branch_created = true`:

  **Otherwise, create the branch:**

  ```bash
  git checkout <base_branch>
  git pull origin <base_branch>   # If pull fails (no remote, no network) — warn and continue from local state
  git checkout -b <git.branch_prefix><feature-name>
  ```

  Where `<base_branch>` is resolved from: `--base` flag > `git.base_branch` from config > fallback `main`.
  Where `<git.branch_prefix>` defaults to `feature/` if not set in `.unikit/config.yaml`.

  The branch name uses the feature name **without** the date prefix.
  Example: folder `2026-03-10_item-appraisal-system` → branch `<git.branch_prefix>item-appraisal-system`.
  If the branch already exists, ask: switch to existing or create with a different name?
- No → stay on current branch, mark `branch_created = false`, continue to next step

### Step B: Quick Reconnaissance

Launch 1-3 Explore tasks in parallel to quickly scan the codebase before deep planning. This gives a high-level picture without consuming main context.

```
Agent(subagent_type: Explore, prompt:
  "In the current project, find files and modules related to [feature domain keywords].
   Report: key directories, relevant files, existing patterns, integration points.
   Thoroughness: quick. Be concise — return a structured summary, not file contents.")
```

**Fallback:** If Agent tool is unavailable, use Glob/Grep/Read directly to scan for relevant files and modules.

**Rules:**
- 1-3 tasks max, "quick" thoroughness — this is reconnaissance, not deep analysis
- Deep exploration happens later in the shared Step 4 (Explore the Codebase)
- Recon results are used to write **targeted** Phase A prompts — require structured output: list of discovered file paths, class/interface names, and module directories. This data feeds directly into Phase A to avoid redundant broad scanning

### Step C: Ask About Preferences

```
AskUserQuestion: Before planning:

1. Include tests in the plan?
   a. Yes, add a testing phase
   b. No, skip tests

2. Documentation policy after implementation?
   a. Yes — show documentation checkpoint after completion (invokes /unikit-docs)
   b. No — skip documentation

3. Roadmap milestone linkage (only if `.unikit/ROADMAP.md` exists):
   a. Link this plan to a milestone
   b. Skip — no linkage

4. Additional requirements or constraints?
```

Based on choice:
- Tests: Yes → add a testing phase after each implementation phase in the plan
- Tests: No → no test tasks in the plan
- Docs: Yes → add `Docs: yes` to Settings, `/unikit-implement` will show documentation checkpoint
- Docs: No → add `Docs: no` to Settings
- Roadmap: Link → proceed to milestone selection (see below)
- Roadmap: Skip → add `Milestone: "none"` to Roadmap Linkage

Store the preferences — they affect the `## Settings` section in `TASKS.md`, whether a testing phase is added, and whether `/unikit-implement` shows a documentation checkpoint.

**If `.unikit/ROADMAP.md` exists and the user chose milestone linkage:**
- Read `.unikit/ROADMAP.md` and list candidate milestones (prefer unchecked items)
- Ask the user to pick one milestone (or type a custom one)
- Store the selected milestone name and a 1-sentence rationale for inclusion in the plan file

---

## Fast Mode — Additional Step

This step runs **only in fast mode**, before the shared planning workflow.

### Step A: Ask About Preferences

```
AskUserQuestion: Before planning:

1. Include tests in the plan?
   a. Yes
   b. No

2. Any specific requirements or constraints?

3. Roadmap milestone linkage (only if `.unikit/ROADMAP.md` exists):
   a. Link this plan to a milestone
   b. Skip — no linkage
```

Based on choice:
- Tests: Yes → add a testing phase in the plan
- Tests: No → no test tasks
- Roadmap: Link → proceed to milestone selection (see below)
- Roadmap: Skip → add `Milestone: "none"` to Roadmap Linkage

Fast mode always uses `Docs: no` in Settings (documentation checkpoint is a full mode feature).

Store the preferences for the `## Settings` and `## Roadmap Linkage` sections in `PLAN.md`.

**If `.unikit/ROADMAP.md` exists and the user chose milestone linkage:** follow the same milestone selection procedure as in Full Mode Step C (read ROADMAP.md, list candidates, ask user to pick, store milestone name).

---

## Shared Steps (both modes)

### Step 2: Check for Related Researches

**If `research_pre_linked = true`** (user already confirmed a research in Step 0.2) → read that research's `RESEARCH_BRIEF.md` and `RESEARCH_SOURCE.md` (if exists), mark `research_linked = true`, store research path for `## Based on`, and skip to Step 3.

Before exploring code, check if `/unikit-explore` has produced relevant researches.

1. Read `.unikit/code/researches/INDEX.md`
   - If the file doesn't exist — skip this step entirely, proceed to Step 3.

2. Read `workflow.research_relevance_days` from `.unikit/config.yaml` (default: `7`).

3. **Filter** entries by two criteria:
   - `Date` is within `research_relevance_days` from today
   - `Status` is `completed` (skip `in-progress` and `needs-follow-up`)

4. **Match**: compare each surviving entry's `Summary` against the feature description. Select entries that are contextually relevant to the feature being planned.

5. If **0 relevant** researches found — proceed to Step 3 silently. Mark `research_linked = false`.

6. If **1 or more relevant** researches found — ask the user:

```
AskUserQuestion: Found related researches:

1. <Title> (<Date>) — <Summary>
2. <Title> (<Date>) — <Summary>

Options:
1. Use all listed researches
2. Let me pick which ones (specify numbers)
3. Skip all — plan from scratch
```

Based on choice:
- Use all → load all listed researches as planning context
- Let me pick → wait for user to specify numbers, load only selected
- Skip all → proceed without research context, mark `research_linked = false`

Highlight the most relevant entries in the question text (e.g., "Recommended: #1, #3").

7. For each selected research:
   - Read its `RESEARCH_BRIEF.md` and `RESEARCH_SOURCE.md` (if exists) for technical context
   - Use as planning context and as **starting point** for Phase B deep-dive — reduces scope of Explore tasks in Step 4
   - Mark `research_linked = true` and store research path for `## Based on` (uses Research Reference Format)
   - `PLAN-BRIEF.md` is still created in Step 5 — research brief is used as input, not replacement (the plan's brief reflects the actual codebase state at planning time)

### Step 3: Analyze Requirements

Before exploring code, analyze the feature description for completeness.

**If requirements are clear** — proceed to Step 4.

**If requirements are ambiguous or incomplete** — ask clarifying questions:

```
Before planning, a few things need clarification:

1. [Specific question about feature scope]
2. [Question about implementation approach]
3. [Question about edge cases]
```

Wait for answers before proceeding. Do not plan based on assumptions when the description is ambiguous — ask.

### Step 4: Explore the Codebase & Technical Design

This is the most critical step. The goal is to produce a **deep technical understanding** sufficient
for writing actionable tasks with meaningful WHY context and for generating a `PLAN-BRIEF.md` that reflects the actual codebase state at planning time.

You loaded the project rules in Step 0.5 (Bootstrap). Now use that knowledge to write precise prompts for Explore tasks and to synthesize their results against project conventions.

#### Phase A: Exploration (Explore tasks)

Launch 2-4 Explore tasks in parallel, each with a **specific focus**. Each task MUST receive references to project documentation files so it operates with project knowledge.

**Doc references to include in every Explore task prompt:**
- `.unikit/ARCHITECTURE.md` — always (module boundaries, dependency rules)
- Core rule files loaded in Bootstrap — pass the **paths from RULES_INDEX.md** relevant to the task's focus (e.g., design principles for architecture analysis, folder structure for file path verification)
- Stack rule files loaded in Bootstrap — pass if the task's focus involves that framework

```
Task 1 — Architecture & affected modules:
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Before analysis, read these project docs:
   - .unikit/ARCHITECTURE.md
   - [core rule paths relevant to architecture — from RULES_INDEX.md Core table]

   Then: find files and modules related to [feature domain]. Map the directory structure,
   key entry points, and how modules interact. Thoroughness: medium.")

Task 2 — Existing patterns & conventions:
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Before analysis, read these project docs:
   - .unikit/ARCHITECTURE.md
   - [core rule paths relevant to patterns — from RULES_INDEX.md Core table]
   - [stack rule paths if task's focus involves a specific framework]

   Then: find examples of similar functionality already implemented in the project.
   Show patterns for [relevant patterns: services, controllers, models, DI bindings, etc.].
   Thoroughness: medium.")

Task 3 — Dependencies & integration points (if needed):
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Before analysis, read these project docs:
   - .unikit/ARCHITECTURE.md
   - [core rule paths relevant to dependencies — from RULES_INDEX.md Core table]

   Then: find all files that import/use [module/service]. Identify integration points
   and potential side effects of changes. Thoroughness: medium.")
```

**Fallback:** If Agent tool is unavailable, investigate directly using Glob/Grep/Read — search for relevant files, read key source code, and synthesize findings inline.

**Rules:**
- Fast mode: launch all 2-4 tasks from scratch.
- Full mode: Step B already identified key files, directories, and patterns. Use those findings to make Phase A prompts **specific** — include concrete file paths, class names, and module names discovered in Step B. This avoids re-discovery and focuses Phase A on deeper analysis of known areas rather than broad scanning.
  Example: instead of "find files related to [feature]" → "Read `Assets/Modules/.../IFeatureService.cs` and `Assets/Game/Scripts/.../FeatureController.cs` found in recon. Analyze their interfaces, DI bindings, and integration points."
- After tasks return, synthesize: files to create/modify, patterns to follow, dependencies, risks.

#### Phase B: Technical Deep-Dive (Explore agent)

**Always runs** — produces `PLAN-BRIEF.md` content based on the current codebase state.

When `research_linked = true`: use `RESEARCH_BRIEF.md` as a **starting point** for the deep-dive. The research brief provides initial constraints, interfaces, and patterns — but Phase B verifies them against the actual code and updates/extends as needed. This ensures the plan's brief is fresh and accurate even if the codebase changed since the research was conducted.

When `research_linked = false`: perform full technical analysis from scratch.

Launch an Explore task for detailed technical analysis using findings from Phase A. Include doc references (ARCHITECTURE.md + all core/stack rules from Bootstrap). The task should:
1. Read source code of existing similar features found in Phase A
2. Extract interface signatures, constructor dependencies, DI bindings from installers
3. Identify patterns the new feature must follow (naming, structure, registration)
4. Find constraints — what is MUST vs FORBIDDEN based on existing code

Return format: structured report matching the Plan Brief Template sections from `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md`. Do not guess — base on actual code read. Thoroughness: very thorough.

**Fallback:** If Agent tool is unavailable, perform analysis inline using Read.

Synthesize the task's findings with Bootstrap rules to produce `PLAN-BRIEF.md` content.

#### Phase C: Additional context

Project docs (DESCRIPTION.md, ARCHITECTURE.md, RULES.md, core/stack rules, patches, skill-context) were already loaded in Step 0.5 (Bootstrap). This phase handles only remaining optional reads.

**OPTIONAL (recommended):** Read `.unikit/ROADMAP.md` if it exists:
- Use it to link this plan to a specific milestone (when applicable)
- This reduces ambiguity in `/unikit-implement` milestone completion and `/unikit-verify` roadmap gates

### Step 4.5: Resolve Design Context (game-design module)

**Runs only when `design_linked = true`** (a `version: 2` `.unikit/gamedesign/GD-IDS.yaml` exists). It
grounds the plan in the game's design and is the source of the plan's `## Design` section.
When `design_linked = false`, skip this step entirely.

This step embodies the **one-way boundary**: it only *reads* design artifacts. Never write
to `.unikit/gamedesign/`.

#### 4.5.1 — Resolve the target system

1. Read `.unikit/gamedesign/GD-IDS.yaml` `systems` (the machine-readable roster — the
   same data GAME.md's `## System Map [gen]` renders read-only; read the registry, not
   the render). Each entry carries `id`, `name`, `category`, `tier`, `status`
   (`active | deprecated`), `doc_status`, `version`, `implemented_version`, `depends_on`,
   and `source`.
2. Match the feature description against each system's `name` (and `category` —
   `unikit-gd-spec` records it for exactly this match). Exclude entries whose `status` is
   `deprecated` from candidate matching — emit
   `WARN [design] SYS-<id> deprecated; excluded from candidates` and do not plan against
   one. One confident match → use it. Several plausible matches, or none → resolve with
   `AskUserQuestion` (list the candidate systems); **never guess** the system. If the user
   confirms the feature has no design system (pure code/tech work) → set
   `design_linked = false` and continue to Step 5 with no `## Design` section.
3. For the resolved entry, read its system GDD from the `source` path
   (`.unikit/gamedesign/systems/*.md`). Capture: the system `SYS-id`, current `version`,
   the **effective status** (`doc_status`, overridden by `deprecated` from `status` and by
   `implemented` when `implemented_version` is non-empty — the same precedence the
   `## System Map [gen]` shows), and the **Acceptance Criteria** (verbatim, keyed by
   `AC-<id>`).

#### 4.5.2 — Status gate (warn, never block)

Plan generation continues regardless of status, but surface a `WARN [design]` line when the
resolved system's `Status` is not `detailed` or `reviewed`:

- `not-started` / `skeleton` — the design is incomplete; the plan may rest on a partial
  spec. Suggest finishing `/unikit-gd-system <system>` first.
- `revised` — the design moved ahead of the code after a `/unikit-gd-system` edit; treat
  this as a delta plan (4.5.3) and call out that old behavior may need removal.
- `implemented` — code already exists for this version (the version is recorded in
  `GD-IDS.yaml` `implemented_version`, read as the baseline in 4.5.3); confirm intent (a
  re-plan usually implies an unrecorded delta).
- `deprecated` — the system was dropped in a remap; 4.5.1 filters it out of candidate
  matching. If the user explicitly targets it, `WARN [design]` and confirm intent before
  planning — a deprecated system normally should not receive new code.

#### 4.5.3 — Delta plan (design moved ahead of code)

Prompts like "plan the new version of Combat" or "bring combat up to the design" need no
`SYS-id` or version number — resolve them here:

1. **System** — resolved in 4.5.1.
2. **What is already implemented** — read the resolved system's `implemented_version`
   from `.unikit/gamedesign/GD-IDS.yaml` (set by code-side `unikit-verify` on
   all-AC-met). A **non-empty** `implemented_version` is the authoritative implemented
   baseline. When the field is **absent or empty (`""`)** — e.g. a system implemented
   before this field existed — fall back (migration grace) to scanning prior `## Design`
   blocks for this `SYS-id` across `.unikit/code/plans/*/PLAN-BRIEF.md` (and
   `.unikit/code/PLAN.md`); the highest version in a completed plan is the inferred
   baseline. Neither source → ask: "no implementation found — plan the full system?".
3. **Delta** — collect the system GDD's changelog blocks (section K) over the interval
   `(implemented, current]`. Multiple edits → multiple blocks.
4. **Tasks** — new/changed `AC` → implementation tasks; **removed `AC` → tasks to rip out
   the old behavior**; changed formulas / tuning knobs → config tasks. If the delta is
   large or unclear, suggest `/unikit-explore` before planning.

#### 4.5.4 — Produce the `## Design` snapshot

Prepare a `## Design` block for the plan (written in Step 5 — in `PLAN-BRIEF.md` for full
mode, in the `## Technical Context` area for fast mode). It is a **snapshot at planning
time**: cite AC text by reference to the live doc (do not fork it), and record the version.
Checklist tasks reference the `AC-<id>`s.

```markdown
## Design
- **System**: SYS-combat — `.unikit/gamedesign/systems/combat.md`
- **Version**: 4 (prior plan 2026-06-10_combat-core implemented v3)
- **Delta v3→v4** (from changelog): stacks up to 5 (section C); FORM-status-tick → config; knob max_stacks → config
- **Acceptance Criteria (current, cited):**
  - AC-combat-3 (changed): Given …, When …, Then …
  - AC-combat-7, AC-combat-8 (new): …
  - AC-combat-5 — **removed in v4** → task to remove the old behavior
```

For a first-time plan (no prior implementation), drop the `Delta` line and list the
system's full current AC set.

#### 4.5.5 — Resolve flow context (optional — the dynamics axis)

After the system is resolved (4.5.1), check whether any **flow** exercises it. The
dynamics axis grounds the plan in *what the player does* with this system over time,
not just its rules — the flow's wiring-mode is often the single most actionable fact
for the implementer. This is a read-only design read (One-Way Boundary); never write
to `.unikit/gamedesign/`.

1. Read `.unikit/gamedesign/GD-IDS.yaml` `flows`. An empty `flows: []` (or a registry
   with no `flows` key yet) → **no flow context; skip silently** — never an error. For
   the resolved `SYS-id`, find every flow whose `depends_on` includes it **or** whose
   `goals[].targets` reference it (`GOAL → SYS`, or `GOAL → AC-<sys>-n`).
2. For each matching flow, read its `FLOW.md` (`source` path) and capture the **flow
   brief**: the `FLOW-id` + `mode`, the `GOAL` steps that touch this system (id +
   summary + the `SYS`/`AC` each targets), and the **status of the systems the flow
   depends on** (so the plan knows which dependencies are already `implemented`).
3. **Wiring-mode dictates code structure** — surface it explicitly:
   - `linear` → a fixed step sequence with a success check per `GOAL`;
   - `conditional` → a branch dispatch on world/player state;
   - `emergent` → a goal-set of independent affordances, no fixed order.
4. **`Realized` is derived, read-only** — a flow is realized once **every** system in
   its `depends_on` has a non-empty `implemented_version`. Report it; **never write it
   back** (flows have no `implemented` field — flow delivery is confirmed by playtest,
   not the plan/verify gate).

Prepare an optional `## Flow Context` block (written in Step 5 alongside `## Design`),
omitted entirely when no flow exercises the system:

```markdown
## Flow Context
- **Flow**: FLOW-first-session — `.unikit/gamedesign/flows/FLOW-first-session.md` (mode: linear)
- **Exercises this system at**: GOAL-first-session-2 → AC-combat-3 ("defeat the first enemy")
- **Code shape (from mode)**: linear → a fixed step sequence with a success check per GOAL
- **Dependency status**: SYS-combat detailed v4 · SYS-stamina implemented v2 — flow Realized: no
```

### Step 5: Create the Plan

Use the canonical templates from `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md`.

**Plan file path:**
- **Fast mode** → `.unikit/code/PLAN.md` (single flat file)
- **Full mode** → `.unikit/code/plans/<dated-folder>/TASKS.md` + `PLAN-BRIEF.md`

#### Plan Sections (both modes)

1. **`## Overview`** — 3-5 sentences: WHAT is being built, WHY it's needed, WHAT GOAL it serves.

2. **`## Based on`** — if `research_linked = true`, list each linked research using the Research Reference Format (see above). Set `Attached` to the current timestamp (`YYYY-MM-DD HH:MM`). After all research entries, add "`PLAN-BRIEF.md` (in this folder)" for full mode or "see `## Technical Context` section below" for fast mode.
   If no research: fast mode → "see `## Technical Context` section below"; full mode → "`PLAN-BRIEF.md` (in this folder)."

   **`## Design`** (game-design module — only when `design_linked = true`) — insert the
   design snapshot prepared in Step 4.5 directly after `## Based on`: System + `SYS-id`,
   version, optional delta, and cited Acceptance Criteria. In full mode it lives in
   `PLAN-BRIEF.md`; in fast mode it goes into `PLAN.md`. Omit this section entirely for
   pure-code plans (`design_linked = false`).

   **`## Flow Context`** (game-design module — only when a flow exercises the resolved
   system, from Step 4.5.5) — insert the flow brief directly after `## Design`: the
   `FLOW-id` + wiring-mode, the `GOAL` steps touching this system, the code shape implied
   by the mode, and the derived (read-only) `Realized` state. Same file placement as
   `## Design`. Omit when no flow matches.

3. **`## Settings`** — User preferences (`/unikit-implement` reads this):
   - `Testing: yes/no` — whether to generate tests after each phase
   - `Docs: yes/no` — whether to show documentation checkpoint (invokes `/unikit-docs`)

4. **`## Roadmap Linkage`** (optional, only if `.unikit/ROADMAP.md` exists):
   - If linked: `Milestone: "<name>"` and `Rationale: "<why>"`
   - If skipped: `Milestone: "none"` and `Rationale: "Skipped by user"`

5. **`## Checklist`** — phases with tasks. Every task MUST include description, `WHY:` line, `Files:` line.
   The WHY line answers: "what breaks or is missing if we skip this task?"

6. **`## Commit Plan`** — when 5+ tasks, checkpoints every 3-5 tasks. For each `### Commit N: after tasks X-Y` heading, also emit a decorative `<!-- Commit checkpoint: tasks X-Y -->` HTML comment at the matching boundary inside the `## Checklist` (right after the last task of that range). The marker range mirrors the Commit Plan heading (single source of truth) and is **decorative only** — `/unikit-implement` does not parse it. See `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md`.

7. **`## Dependency Graph`** — phase dependencies in ASCII.

8. **`## Total Estimated Effort`** — sum of all phases.

#### Fast Mode: Additional Section

9. **`## Technical Context`** — always included. Contains plan-brief content inline (CONSTRAINTS, INTERFACES, KEY PATTERNS, FILES, DI BINDINGS, OUT OF SCOPE). Same quality bar as PLAN-BRIEF.md. When `research_linked = true`, use the research brief as a starting point but verify and update based on the current codebase state from Phase B.

#### Full Mode: `PLAN-BRIEF.md` (always created)

**Always created** — the plan's own technical brief based on the current codebase state at planning time. Use Plan Brief Template from `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md`. Content comes from Step 4 Phase B, synthesized with Bootstrap rules. Do not invent — base on actual codebase patterns.

When `research_linked = true`: use `RESEARCH_BRIEF.md` as a starting point — verify constraints, interfaces, and patterns against the current code. Update, extend, or correct as needed. The plan's `PLAN-BRIEF.md` is the authoritative source for `/unikit-implement` — it supersedes the research brief.

**Quality checklist:**
1. CONSTRAINTS — non-obvious decisions with rationale (MUST / FORBIDDEN)
2. INTERFACES — full {{engine_code_language}} signatures for every interface in tasks
3. KEY PATTERNS — code examples for patterns the implementer must follow
4. FILES — exact paths for files to create/modify
5. DI BINDINGS — Zenject bindings for installer(s)

Self-check: if an interface appears in tasks but not in INTERFACES — add it.

### Step 6: Confirm with User

After artifacts are created, show the user:

**Fast mode:**
1. Plan file: `.unikit/code/PLAN.md`
2. A brief summary of phases identified
3. Total estimated effort
4. Remind: "To start implementation, run: `/unikit-implement`"
5. Ask if they want to adjust anything

**Full mode:**
1. The feature folder path created
2. The git branch name (only if `branch_created = true`; if `false`, show current branch name instead)
3. Files created: `TASKS.md` and `PLAN-BRIEF.md`, plus research reference if linked
4. A brief summary of phases identified
5. Total estimated effort
6. Remind: "To start implementation, run: `/unikit-implement`"
7. Ask if they want to adjust anything

### Step 7: Context Cleanup

Suggest the user to free up context space if needed: `/clear` (full reset) or `/compact` (compress history).

## Task Description Requirements

Every task in `TASKS.md` MUST include:
- **Clear deliverable** — what exactly is produced (class, interface, configuration, etc.)
- **WHY line** — one sentence explaining why this task matters in the context of the feature
- **File paths** — where changes will be made or files created (use `Files:` line under the task)
- **Dependency notes** — when the task depends on another task's output (if not obvious from phase ordering)

Format with WHY and file paths:
```markdown
- [ ] Task N.M — {what to do}
  WHY: {why this task matters — connects to feature goal, constraint, or dependency}
  Files: `{path/to/file.cs}`, `{path/to/other.cs}`
```

For simple tasks (rename, delete, move), file paths in the description are sufficient:
```markdown
- [ ] Task 1.1 — Rename `IShopCustomer.cs` → `IDayCustomer.cs`
  WHY: Name alignment with domain terminology — "day customer" reflects the day/night cycle mechanic
```

Bad examples:
```markdown
# Too vague — no deliverable, no files, no WHY
- [ ] Task 1.1 — Implement appraisal system

# WHY restates the task instead of explaining purpose
- [ ] Task 1.1 — Create IAppraisalService interface
  WHY: We need to create this interface
```

## Important Rules

1. **NO report tasks** — don't create summary/report tasks at the end of a plan
2. **Right granularity** — not too big (overwhelming), not too small (noise). A task should be completable in one focused session
3. **Dependencies matter** — order tasks so they can be done sequentially without blockers
4. **Include file paths** — help the implementer know exactly where to work
5. **Every task needs WHY** — the WHY line must explain purpose, not restate the description
6. **Commit checkpoints for large plans** — 5+ tasks need a Commit Plan section with checkpoints every 3-5 tasks
7. **NO tests if user said no** — don't sneak in test tasks when the user opted out
8. **Actionable tasks** — each task must have a clear, concrete deliverable
9. **Respect module boundaries** — follow the project's Modular Monolith architecture (Modules/ → Game/ allowed, Game/ → Modules/ FORBIDDEN)
10. **Roadmap linkage (when available)** — If `.unikit/ROADMAP.md` exists, include a `## Roadmap Linkage` section in the plan (or explicitly state it was skipped)
11. **Always create PLAN-BRIEF.md** — even when a research's `RESEARCH_BRIEF.md` exists, the plan always generates its own `PLAN-BRIEF.md` (full mode) or `## Technical Context` (fast mode) based on the current codebase state. The research brief is used as input, not as a replacement — code may have changed since the research was conducted. The plan's brief is the authoritative source for `/unikit-implement`
12. **Plan file location** — Fast mode: `.unikit/code/PLAN.md` (single flat file, temporary). Full mode: `.unikit/code/plans/<dated-folder>/TASKS.md` + `PLAN-BRIEF.md`
13. **Design is read-only and cited, not copied** — when a game-design workspace exists (a `version: 2` `.unikit/gamedesign/GD-IDS.yaml`), ground the plan in it via `## Design` (Step 4.5): cite Acceptance Criteria by `AC-id` referencing the live system doc, snapshot the version, and warn when Status ≠ `detailed`/`reviewed`. Never write to `.unikit/gamedesign/` — design changes go through `/unikit-gd-*` (one-way boundary: code reads design, design never knows code)

## Code Analysis & Delegation Rules

Use **Explore tasks** for codebase analysis — not `unikit-devcontext` or `develop-agent` (those are for code-writing). Each Explore task MUST receive doc references (ARCHITECTURE.md + relevant core/stack rules from Bootstrap). Fallback: Glob/Grep/Read.

## Quick Reference
```
/unikit-plan fast <description>           → .unikit/code/PLAN.md
/unikit-plan full <description>           → .unikit/code/plans/YYYY-MM-DD_name/ (TASKS.md + PLAN-BRIEF.md)
/unikit-plan full --base master <desc>    → same, branch from master
/unikit-plan add <what to change>         → modifies existing plan in-place
/unikit-plan <description>                → asks Full or Fast interactively
```