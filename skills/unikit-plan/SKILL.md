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

**If mode is `--list`** → load `{{skills_dir}}/{{self_name}}/references/mode-list.md` and follow it (it STOPs; Steps 0.1–7 do not run).

**If mode is `add`** → run **Step 0.5 (Bootstrap Context)**, then load `{{skills_dir}}/{{self_name}}/references/mode-add.md` and follow it (it STOPs; never creates a branch).

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
- Full → full mode (the Full-mode additional steps load in Step 1.5)
- Fast → fast mode (the Fast-mode additional step loads in Step 1.5)

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
  the relevant system design (and any flow that exercises it, and any content type that feeds
  it) and produces the plan's `## Design` + optional `## Flow Context` / `## Content Context`
  snapshots. Do NOT read the design docs here — Step 4.5 owns that, after the feature scope is
  clear.
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

### Step 1.5: Load the Mode Body

The shared preamble (Steps 0–1) is done. Load the selected mode's reference body
on demand — do **not** keep all four mode bodies in context at once:

- **Full mode** → load `{{skills_dir}}/{{self_name}}/references/mode-full.md`, run its
  additional steps (git branch, recon, preferences), then continue to the Shared Steps below.
- **Fast mode** → load `{{skills_dir}}/{{self_name}}/references/mode-fast.md`, run its
  preferences step, then continue to the Shared Steps below.

(`--list` and `add` modes already dispatched in Step 0 to their own bodies — `mode-list.md` / `mode-add.md` — and STOP; they never reach here.)

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

**Runs only when `design_linked = true`** (the gate is resolved inline in Step 0.5). When it is
true, load `{{skills_dir}}/{{self_name}}/references/design-context.md` and follow it on demand —
do **not** keep the design-context body in context for pure-code plans. That body reads the shared
`design-read` contract (`.unikit/system/gamedesign/design-read.md`), applies **Flow-First
Resolution** (*intent decides the door* — resolve a system, a flow, or a content type first,
ambiguous → ask), and produces the plan's `## Design` (+ optional `## Flow Context` /
`## Content Context`) snapshot, then returns here for Step 5. When `design_linked = false`, skip this step entirely (the design-context body is never
loaded).

This step embodies the **one-way boundary**: it only *reads* design artifacts — never write to
`.unikit/gamedesign/`.

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

   **`## Flow Context`** (game-design module — only when a flow is in scope: the flow door,
   or a flow that exercises the resolved system; from Step 4.5 / `design-context.md`) — insert
   the flow brief directly after `## Design`: the `FLOW-id` + wiring-mode, the `GOAL` steps
   touching the relevant system(s), the code shape implied by the mode, and the derived
   (read-only) `Realized` state. Same file placement as `## Design`. Omit when no flow is in scope.

   **`## Content Context`** (game-design module — only when a content type is in scope: the
   content door, or a content type that feeds the resolved system; from Step 4.5 /
   `design-context.md` §4.5.6) — insert the content brief directly after `## Flow Context`: the
   `CT-id` + `scale`, the `CT.fields` schema (the data contract the code reads), the `belongs_to`
   system, and the code shape implied by `scale` (`bulk` → a data-driven loader; `curated` → named
   instances). Same file placement as `## Design`. Omit when no content type is in scope. There is
   **no** writeback — content has no `implemented_version` (read-only, the same stance as a flow's
   `Realized`).

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