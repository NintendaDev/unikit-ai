---
name: unikit-plan
description: >-
  Create an implementation plan for a feature — a dependency-ordered, actionable task
  list for the project. Has four modes: fast (a quick single-pass plan), full (a richer
  plan that can also create a git branch), ultra (a multi-file bundle — a manifest plus
  one deeply specified file per phase — for execution by a smaller model), and add
  (extend an existing plan with more tasks). Pick the mode from the user's wording: "full
  plan" runs full; "quick plan" or "fast plan" runs fast; "ultra plan", "ultraplan" or
  "ultra-plan" runs ultra; a plain "create a plan" with no qualifier defaults to fast;
  "add to the plan" or "extend the plan" runs add. Use whenever the user wants to plan a
  feature or task, e.g. "create a plan", "create a full plan", "create a quick plan",
  "run an ultra plan for the inventory system", "plan this feature", "add this to the
  plan", "extend the plan", "add a phase to the plan". Ultra runs only when the user
  names it — never because the feature looks large.
argument-hint: "[fast | full | ultra | add | --list] [--base <branch>] <feature description in free form>"
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
  - Bash(shasum *)
  - Bash(sha256sum *)
  - Bash(date *)
  - Agent
  - Skill
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "7.5"
  category: planning
---

# {{engine_name}} Feature Plan Generator

Create a structured feature plan and roadmap for the current {{engine_name}} project.

Four modes:
- **Fast** — quick plan, no git branch, saves to `.unikit/code/PLAN.md`
- **Full** — optionally creates `<git.branch_prefix><name>` git branch (when `git.enabled` and `git.create_branches`), asks preferences, saves to `.unikit/code/plans/<feature-name>/`
- **Ultra** — full mode plus one deeply specified file per phase, for later execution by a smaller model. **User-named, never model-inferred**: it runs because the user asked for an ultra plan, never because the feature looks big
- **Add** — modify/extend an existing plan without creating a branch

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

This skill uses a named delegation alias for `Agent(...)` calls. The alias is the single
place where the delegate's model is declared — call sites name the alias and never carry a
model argument of their own.

<!-- unikit:agents claude -->
- **`recon-agent`** — read-only parallel reconnaissance. Expands to:

  ```
  Agent(subagent_type: Explore, model: sonnet, prompt: "<focused question>")
  ```

  `sonnet` is a tier alias, never a version — the one model value that may be written into
  UniKit. A versioned model id goes stale silently and must never replace it.

  Fallback: if the `Agent` tool is unavailable, investigate inline with `Glob`/`Grep`/`Read`.
<!-- unikit:end -->
<!-- unikit:agents !claude -->
- **`recon-agent`** — read-only parallel reconnaissance. Expands to:

  ```
  Agent(subagent_type: Explore, prompt: "<focused question>")
  ```

  No model is named: this runtime either has no dispatch-time model argument or offers only
  versioned model ids, and a versioned id goes stale silently. The runtime's own configured
  default applies.

  Fallback: if the `Agent` tool is unavailable, investigate inline with `Glob`/`Grep`/`Read`.
<!-- unikit:end -->

## Input

`$ARGUMENTS` — optional keyword `full`, `fast`, `ultra`, or `add`, optional `--base <branch>` flag, followed by free-form description in any language. The mode may also be named inside that free-form text rather than as a leading token.

**Parsing rules:**
1. Extract `--base <branch>` if present anywhere in arguments → store as `base_branch`, remove from text
2. If `--list` is present → list mode, show all plans and STOP
3. If the first word (after flag removal) is `full` → full mode, remaining text is the feature description
4. If the first word is `fast` → fast mode, remaining text is the feature description
5. If the first word is `ultra`, **or** the text asks for an ultra plan in any phrasing or language — "ultra plan", "ultraplan", "ultra-plan", "ультраплан", "make an ultra plan for the inventory" → ultra mode; strip the ultra wording and the verb that carried it, the remainder is the feature description
6. If the first word is `add` → add mode, remaining text is what to add/change in the existing plan
7. Otherwise → ask interactively, entire text is the description

Ultra is **user-named, never model-inferred**. Rule 5 recognises the request wherever it sits in the sentence, but it must be a request: ultra is never offered in Step 0.2 and never chosen because the feature looks large, spans many files, or seems hard — size is not a request. Wording that only asks for care — "a deep plan", "plan this thoroughly", "a detailed plan" — is **not** ultra; fall through to rule 7 and ask.

`--base <branch>` — the branch to create the feature branch from (full mode only). `--base` flag overrides `git.base_branch` from config. Priority: `--base` flag > `git.base_branch` from `.unikit/config.yaml` > fallback `main`.

## Workflow

### Step 0: Parse Mode & Select Mode

Initialize flags: `research_pre_linked = false`, `research_linked = false`, `design_linked = false`.

**If mode is `--list`** → load `{{skills_dir}}/{{self_name}}/references/mode-list.md` and follow it (it STOPs; Steps 0.1–7 do not run).

**If mode is `add`** → run **Step 0.5 (Bootstrap Context)**, then load `{{skills_dir}}/{{self_name}}/references/mode-add.md` and follow it (it STOPs; never creates a branch).

### Step 0.1: Resolve Git State

Do **not** auto-run `git init`. Read the git keys from `.unikit/config.yaml`:

- `git.enabled: false` → no branch commands; a full-mode plan goes to `.unikit/code/plans/<slug>/`
- `git.base_branch` → the target branch for diffs and merge guidance (default: the detected branch or `main`)
- `git.create_branches: false` → full mode still writes the rich plan, on the current branch

`git.enabled: true` outside a git work tree → warn that git-aware actions are unavailable until the repository is initialized, and continue as with `git.enabled: false`.

### Step 0.2: Resolve Feature Description

If the user provided a feature description → use it and skip this step.

If the description is empty (user only typed a mode keyword like `full` or `fast`, or no arguments at all):

1. **Check session context** — look in the current conversation history for results of `/unikit-explore`. If found, use the exploration topic and findings as the feature description and context.

2. **Check recent researches** — if no session context, read `.unikit/code/researches/INDEX.md` (if it exists). The index is sorted newest-first. Take the first entry whose `Lifecycle` is `active` — a record carrying no `Lifecycle` line counts as `active` — and ask:
   ```
   AskUserQuestion: Found recent research: "<Title>" (<Created>)
   Use as basis for planning?

   Options:
   1. Yes — use this research
   2. No — I'll describe the feature myself
   ```
   Based on choice:
   - Yes → use research title/summary as description, mark `research_pre_linked = true` (skip research matching in Step 2)
   - No → proceed to ask user for description (step 3 below)

   `<Created>` is the displayed field — never substitute `Updated` for it. A record with no `Created` is shown as `"<Title>" (date unknown)`, never with empty brackets.

3. **No context available** — if neither session context nor researches exist, ask the user for a description:
   ```
   AskUserQuestion: Describe the feature you want to plan.
   ```

**If no mode keyword** was found by the Step 0 parsing rules, ask one question, adding the description question when the description is still missing:
```
AskUserQuestion:
1. Describe the feature you want to plan.     ← only when the description is still missing
2. Which planning mode?
   a. Full (recommended) — creates git branch, codebase reconnaissance, full plan
   b. Fast — quick plan without a branch
```

Ultra is deliberately absent from this question — see the parsing rules in Step 0.

### Step 0.5: Bootstrap Context (MANDATORY — all modes except List)

Silently load the project knowledge base before any exploration — do not narrate the loading.

#### Required reads (always, every time, in parallel)

1. **`.unikit/DESCRIPTION.md`** — project description, tech stack, constraints
2. **`.unikit/ARCHITECTURE.md`** — architecture decisions, folder structure, module rules, dependency directions
3. **Read `.unikit/memory/code/RULES_INDEX.md`**. Load rules:
   - **RULES.md**: ALWAYS read `.unikit/RULES.md` first (highest priority)
   - **Core**: read the Core table. For EACH row where Required By = `all` or contains `{{self_name}}` — read that file from `.unikit/memory/code/core/` using the Read tool. Do NOT skip any matching row. Always re-read at skill start, never rely on prior conversation cache
   - **Stack**: load dynamically when the current task or context matches "Load When" column, or when a need arises during work
4. **`.unikit/skill-context/{{self_name}}/SKILL.md`** — project-specific skill overrides (if exists)
5. **Read `{{skills_dir}}/{{self_name}}/references/ENGINE_RULES.md`** — engine planning vocabulary: kind → concept (§1), language & layout (§2), when to write `Editor:` (§3), engine planning pitfalls (§4), out of scope (§5), direct-edit feasibility (§6). Set `engine_rules_loaded = true`.

   **If the file is absent** — a **normal path**, not an error (an engine whose planning vocabulary has not shipped yet): set `engine_rules_loaded = false`. Every step that writes an `Editor:` field, the `Editor tasks` setting or a confirmation line reads that flag (Step 5, Step 6, `mode-full.md`, `mode-fast.md`, `mode-add.md`). `add` mode runs this step too.

6. **Read `.unikit/system/engine-mcp/INDEX.md` — the base section only**: the delivery stamp plus every section **except** the `## Check` table — the exceptions that shape planning: where a commit boundary falls, what may never run in parallel, how the work splits into phases. Set `mcp_index_loaded = true`.

   **Do not read the `## Check` table** — it is the executors', grepped per task by area.

   **If the file is absent** — a normal path: set `mcp_index_loaded = false`, print exactly one line, and continue with the same rights:

   ```
   MCP rules: no INDEX.md — no known exceptions for this server, rights unchanged
   ```

   Absence never switches a task to `⏸️ MANUAL`, never suppresses an `Editor:` field, and never disables the engine MCP (`.unikit/system/dev-principles.md` → **A9 · no rules ≠ no rights**).

7. **`.unikit/config.yaml` → `testing.plan.checkpoints`** — the test-run placement policy, resolved per mode by `mode-full.md` / `mode-fast.md` / `mode-ultra.md`; here it is only read. File or key absent → the mode file's default, silently.

#### Patches (learning from past fixes)

If `.unikit/code/patches/` exists:
- Use `Glob` to find all `*.md` files
- Read each patch to learn from past fixes
- Account for known pitfalls when designing the plan — tasks should avoid patterns that caused bugs

#### Design context (game-design module — optional)

`.unikit/gamedesign/GD-IDS.yaml` exists → it MUST be `version: 2`. On `version: 1` do NOT read it: emit `ERROR [design] GD-IDS.yaml is version 1 (pre-v2 layout); design grounding unavailable until the workspace is upgraded via /unikit-gd-spec`, set `design_linked = false`, and plan code-side only. On `version: 2` set `design_linked = true` — Step 4.5 reads the design once the feature scope is clear; nothing is read here. Absent → `design_linked = false`, and every design step is skipped.

Planning only *reads* design; it never writes to `.unikit/gamedesign/` — design changes go through the `/unikit-gd-*` skills.

Remember loaded rule file paths — pass them to Explore tasks in Step 4.

### Step 1: Determine Feature Name and Folder

1. Read the description and understand the feature intent.
2. **Invent a short English name** for the feature — maximum 3-4 words, lowercase, hyphenated.
   Examples: `mini-games-editor`, `customer-dialogue`, `item-appraisal-system`, `wallet-ui`.

**Fast mode** → skip steps 3-5 below. The plan goes to `.unikit/code/PLAN.md` (flat file, no folder).

**Full and ultra modes** → continue:

3. **Get today's date** (`YYYY-MM-DD`) — the value of the manifest's `Created:` and `Updated:` fields (Plan Manifest Template in `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md`).
4. The folder name **is** the feature name from step 2 — `<feature-name>`, no date and no separator prefix (e.g. `item-appraisal-system`).

5. **Collision check — a slug that already exists never resolves itself silently.** Scan `.unikit/code/plans/` and `.unikit/code/archive/plans/` for a folder matching the new name in **any** of the three formats that coexist on disk: exact `<name>`, a folder ending in `_<name>` (the `YYYY-MM-DD_` era), and a folder ending in `-<name>` whose name starts with three digits (the older `DDD-` era).

   - No match → create `plans/<feature-name>/` and continue.
   - A match in `.unikit/code/plans/` → ask, and do not decide it yourself:

   ```
   AskUserQuestion: A plan named "<name>" already exists (<matched folder>).

   Options:
   1. Refine the existing plan — hand over to add mode
   2. Choose another name — I'll enter a different slug
   ```

   - "Refine the existing plan" → hand control to the `add` body (`{{skills_dir}}/{{self_name}}/references/mode-add.md`) on the matched folder and print `INFO [plan] <name> exists — switching to add mode`.
   - "Choose another name" → take the user's slug and repeat this check on it. On success print `INFO [plan] creating <new-name>`.
   - A match **only in `.unikit/code/archive/plans/`** → the name belongs to an archived plan. An archived plan is not refined in place, and a second folder of that name would collide when this one is archived:

   ```
   AskUserQuestion: A plan named "<name>" is archived (<matched folder>).

   Options:
   1. Choose another name — I'll enter a different slug
   2. Cancel planning
   ```

   - "Choose another name" → as above. "Cancel planning" → **STOP**.

   **Appending an automatic suffix (`-2`, `-v2`, a date) is forbidden.**

### Step 1.5: Load the Mode Body

Load only the selected mode's body — never all of them at once:

- **Full mode** → load `{{skills_dir}}/{{self_name}}/references/mode-full.md`, run its
  additional steps (git branch, recon, preferences), then continue to the Shared Steps below.
- **Fast mode** → load `{{skills_dir}}/{{self_name}}/references/mode-fast.md`, run its
  preferences step, then continue to the Shared Steps below.
- **Ultra mode** → load `{{skills_dir}}/{{self_name}}/references/mode-ultra.md`, run its
  additional steps A-C (git branch, recon, preferences), then continue to the Shared Steps
  below. Steps D-H of that body run later — they refine Step 5 and Step 6 of the shared
  workflow, so do **not** run them here.

---

## Shared Steps (all planning modes)

### Step 2: Check for Related Researches

**The research-link contract — read at the first link, and only then.** The moment this step links its first research — through the `research_pre_linked` shortcut below or through point 7 — read `.unikit/system/research-link.md`. For each research linked here, compute its `Summary SHA256` over the `## Active Summary` just read, by `## Computing the hash`, and keep the digest for Step 5 (`## Writing an entry`).

**If `.unikit/system/research-link.md` is missing or unreadable, do not block:** record no `Summary SHA256` and check none — print `WARN [research-drift]: research-link contract missing — drift detection off for this run; run unikit-ai update` once, and continue.

**If `research_pre_linked = true`** (the user already confirmed a research in Step 0.2) → read it as point 7 below does, mark `research_linked = true`, store its path for `## Based on`, and skip to Step 3.

Before exploring code, check if `/unikit-explore` has produced relevant researches.

1. Read `.unikit/code/researches/INDEX.md`
   - If the file doesn't exist — skip this step entirely, proceed to Step 3.

2. Read `workflow.research_relevance_days` from `.unikit/config.yaml` (default: `7`).

3. **Filter** entries by three criteria:
   - `Updated` is within `research_relevance_days` from today. The age key is `Updated`, never `Created`.
   - `Status` is `completed` (skip `in-progress` and `needs-follow-up`). The field name and its three values are **fixed**.
   - `Lifecycle` is not `superseded`. A record carrying no `Lifecycle` line counts as `active`.

   **Log the drop** — one line, **always**, including when nothing was dropped:

   ```
   INFO [research] index: <N> entries, <K> shown (<a> older than <days>d, <b> not completed, <c> superseded)
   ```

   A record with no `Updated` is **not** guessed at from another field. It is excluded, and it is named:

   ```
   WARN [research] <folder>: index row has no Updated — excluded; run /unikit-explore to redraw the index
   ```

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
   - Read its `RESEARCH.md` — `## Active Summary` as the declared input, `## Findings` and the adaptive artifacts for the rationale; read `CONTRACTS.md` when it exists, and `SOURCE.md` for the dialogue
   - Use as planning context and as **starting point** for Phase B deep-dive — reduces scope of Explore tasks in Step 4
   - Mark `research_linked = true` and store the research path for `## Based on`

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
for writing actionable tasks with meaningful WHY context and for generating a `## Technical Context` that reflects the actual codebase state at planning time.

You loaded the project rules in Step 0.5 (Bootstrap). Now use that knowledge to write precise prompts for Explore tasks and to synthesize their results against project conventions.

#### Phase A: Exploration (Explore tasks)

Launch 2-4 Explore tasks in parallel, each with a **specific focus**. Each task MUST receive references to project documentation files so it operates with project knowledge.

Every task gets the same prompt shape; only the focus and the rule paths change:

```
recon-agent(prompt:
  "Before analysis, read these project docs:
   - .unikit/ARCHITECTURE.md
   - [core rule paths relevant to <focus> — from the RULES_INDEX.md Core table]
   - [stack rule paths, when <focus> involves a specific framework]

   Then: <focus>. Thoroughness: medium.")
```

Foci: (1) **architecture & affected modules** — the files and modules related to [feature domain], the directory structure, the entry points and how the modules interact; (2) **existing patterns** — similar functionality already implemented, and its patterns (services, controllers, models, DI bindings); (3) **dependencies & integration points**, when needed — everything that imports or uses [module/service], its integration points and side effects. In full mode, name the files and classes Step B found (`mode-full.md`).

After the tasks return, synthesize: files to create/modify, patterns to follow, dependencies, risks.

Code analysis in this skill is read-only: never `/unikit-devcontext`, never a code-writing delegate.

#### Phase B: Technical Deep-Dive (Explore agent)

**Always runs** — produces the plan's `## Technical Context` content based on the current codebase state.

When `research_linked = true`: use the research's `## Active Summary` — and `CONTRACTS.md` when it exists — as a **starting point** for the deep-dive. They provide initial constraints, interfaces, and patterns; Phase B verifies them against the actual code and updates/extends as needed. This ensures the plan's own context is fresh and accurate even if the codebase changed since the research was conducted.

When `research_linked = false`: perform full technical analysis from scratch.

Launch an Explore task for detailed technical analysis using findings from Phase A. Include doc references (ARCHITECTURE.md + all core/stack rules from Bootstrap). The task should:
1. Read source code of existing similar features found in Phase A
2. Extract interface signatures, constructor dependencies, DI bindings from installers
3. Identify patterns the new feature must follow (naming, structure, registration)
4. Find constraints — what is MUST vs FORBIDDEN based on existing code

Return format: structured report matching the `## Technical Context` section of the Plan Manifest Template in `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md`. Do not guess — base on actual code read. Thoroughness: very thorough.

**Fallback:** If Agent tool is unavailable, perform analysis inline using Read.

Synthesize the task's findings with Bootstrap rules to produce the plan's `## Technical Context` content.

#### Ultra depth gate (ultra mode only)

In ultra, reconnaissance is **not finished** until the plan has code-level evidence for
**every** phase:

- relevant existing paths and symbols
- callers/consumers and side effects
- exact integration and configuration points
- existing tests, fixtures, commands, logging, migration, and documentation patterns

It feeds each phase file's `## Current-Code Evidence` table and its `### Implementation Steps`; thin reconnaissance is rejected by `{{skills_dir}}/{{self_name}}/references/ULTRA-PLAN-FORMAT.md` → `## Required Detail Gate`.

**Do not paste entire source files into phase plans.** Cite only the evidence that makes the
implementation steps deterministic.

When evidence for a phase cannot be gathered, the decision goes into the manifest's
`## Open Questions` as a blocking question — it is never hidden behind a vague step.

#### Phase C: Additional context

**OPTIONAL (recommended):** Read `.unikit/ROADMAP.md` if it exists:
- Use it to link this plan to a specific milestone (when applicable)
- This reduces ambiguity in `/unikit-implement` milestone completion and `/unikit-verify` roadmap gates

### Step 4.5: Resolve Design Context (game-design module)

**Only when `design_linked = true`:** load `{{skills_dir}}/{{self_name}}/references/design-context.md` and follow it. It reads the shared `design-read` contract, resolves the door (a system, a flow or a content type), produces the `## Design` snapshot plus the optional `## Flow Context` / `## Content Context`, and returns here for Step 5. When `design_linked = false` the body is never loaded. Read only — never write to `.unikit/gamedesign/`.

### Step 4.6: Read the Catalog Negatively (only when the plan carries editor work)

**Gate.** Runs only when Step 4 established that the feature touches the editor's **serialized state** *and* an engine MCP is configured (MCP server `{{engine_mcp_tool}}` present in `{{settings_file}}`). A pure-code plan skips this step and makes no call at all.

Whatever engine-MCP grants this skill's frontmatter carries are read-only discovery and nothing else — that is the whole of the planner's contact with the engine MCP. Use them **once**, to answer exactly two questions:

1. **Which kinds of editor work have no route here at all** — so the plan does not schedule an intent this project cannot carry out. The six-word `kind` vocabulary is in `.unikit/system/dev-principles.md` → A8.
2. **Which evidence classes are reachable** — so no acceptance criterion is written against evidence nobody can produce. The claim-class → evidence-class lattice is A2 of the same file.

That is the entire question — **not** which tool does it, **not** how it is called, **not** a strategy — and neither the question nor its answer is written into the plan.

**What the outcome may change, and what it may not:**

- a kind of work with no route → do not schedule it as engine-MCP work: express the change in a form that has a route, or keep the task and name the missing capability in its `WHY:`. **Do not pre-write `⏸️ MANUAL` into the task** — it is a runtime verdict (A9);
- an evidence class that is not reachable → rewrite the acceptance criterion against a class that is, or say plainly in `## Overview` that it cannot be closed here. Never silently downgrade it to the cheapest observation available.

**The planner never:** calls anything that changes state, reads the `## Check` table, reads `.unikit/MCP-RECHECK-NOTES.md`, or opens Context7.

**No engine MCP configured, or discovery yields nothing → skip.** Plan against the base principles, unchanged.

### Step 5: Create the Plan

- **Fast and full** — use the canonical templates from
  `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md`.
- **Ultra** — the canonical source of templates and integrity checks is
  `{{skills_dir}}/{{self_name}}/references/ULTRA-PLAN-FORMAT.md` and nothing else.
  `TASK-FORMAT.md` describes the single-file format and applies only where the bundle
  specification explicitly points back at it.

**Plan file path:**
- **Fast mode** → `.unikit/code/PLAN.md` (single flat file)
- **Full mode** → `.unikit/code/plans/<feature-name>/PLAN.md` (single manifest in a folder)
- **Ultra mode** → `.unikit/code/plans/<feature-name>/PLAN.md` (manifest) + `phase-NN-<slug>.md`

In ultra, Step 5 is carried out by `mode-ultra.md` Steps D-G — the section list below still
applies to the manifest, minus the task-level subsections of `## Technical Context`.

#### Plan Sections (all planning modes)

0. **Header timestamps** — `Created:` and `Updated:` directly under the H1, both today's date from Step 1 (`Bash(date *)`). Their shape and the rule for moving `Updated:`: `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md` → *Plan Manifest Template*; ultra writes the same two lines under its own H1.

1. **`## Overview`** — 3-5 sentences: WHAT is being built, WHY it's needed, WHAT GOAL it serves.

2. **`## Based on`** — if `research_linked = true`, one entry per linked research in the form `.unikit/system/research-link.md` → `## The entry`, carrying the `Summary SHA256` computed back in Step 2 (a research whose digest could not be computed there is written without that line — `## Writing an entry`). The contract was already read in Step 2; it is not re-read here. After all research entries, add "see the `## Technical Context` section below".
   If no research: "see the `## Technical Context` section below".

   **`## Design`**, **`## Flow Context`**, **`## Content Context`** (game-design module) — the snapshots Step 4.5 prepared, placed in this order directly after `## Based on`, each omitted when it was not produced (always, for a pure-code plan). What each one carries — the `SYS-id`, its version and the cited Acceptance Criteria; the `FLOW-id`, its wiring mode and `GOAL` steps; the `CT-id`, its `scale` and `CT.fields` schema — is `design-context.md`'s. `## Design` feeds `/unikit-verify`'s `implemented_version` writeback; `## Flow Context` and `## Content Context` have none.

3. **`## Settings`** — User preferences (`/unikit-implement` reads this):
   - `Testing: yes/no` — whether tests are written at all
   - `Test checkpoints: task | phase | plan` — where the test-checkpoint tasks stand; resolved in the mode file, omitted when `Testing: no`, `task` only in ultra.
   - `Docs: yes/no` — whether to show documentation checkpoint (invokes `/unikit-docs`)
   - `Editor tasks: mcp | manual | direct` — read by `/unikit-implement`: how tasks carrying an `Editor:` line are carried out. Resolved in `mode-full.md` / `mode-fast.md`. **Omit this line entirely when `engine_rules_loaded = false`**.

4. **`## Roadmap Linkage`** (optional, only if `.unikit/ROADMAP.md` exists):
   - If linked: `Milestone: "<name>"` and `Rationale: "<why>"`
   - If skipped: `Milestone: "none"` and `Rationale: "Skipped by user"`

5. **`## Checklist`** — phases with tasks. Every task MUST include description, `WHY:` line, `Files:` line.
   The WHY line answers: "what breaks or is missing if we skip this task?"

   **When to write `Editor:`** — the criterion is neutral: the change touches the **serialized state of the editor**, not source text. Editing a plain text or config file stays in `Files:`. The concrete signals for the active engine are listed in `{{skills_dir}}/{{self_name}}/references/ENGINE_RULES.md` §3 — read them from there, **do not restate them here**: they are engine facts (a scene, a prefab, a blueprint are not the same concept across engines), and a second inline copy diverges from §3 on its first edit.
   Form: `Editor: [kind] <container> → <target> : <action>`, one line per target, placed after `Files:` (grammar and the 6 kinds: `references/TASK-FORMAT.md` → `### Editor task grammar`). Pure code tasks omit the field. When `engine_rules_loaded = false` the field is **not generated at all**.

   **Test-checkpoint task.** A run point is a **separate** checklist task carrying the line `Test checkpoint: <coverage>` in the position `Files:` occupies. The rest — no `Files:`, where a checkpoint is worth placing, a phase left without one, the closing `Test checkpoint: plan` under `Testing: yes`, no list of suites, no run commands elsewhere — is `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md` → `### Test checkpoint task grammar`; **do not restate it here**.

6. **`## Commit Plan`** — when 5+ tasks, checkpoints every 3-5 tasks, each mirrored by a decorative `<!-- Commit checkpoint: tasks X-Y -->` marker in `## Checklist`; `/unikit-implement` does not parse it (`TASK-FORMAT.md`).

7. **`## MCP Findings`** — emitted **empty** (heading and header row) whenever the plan carries at least one `Editor:` task, omitted otherwise; filled by the executor. Contract: `TASK-FORMAT.md` → `### MCP findings section`.

8. **`## Rule Candidates`** — emitted **always, and empty** (heading and header row). Contract: `TASK-FORMAT.md` → `### Rule candidates section`.

9. **`## Test Runs`** — emitted **empty under `Testing: yes`** (the heading alone), omitted under `Testing: no`. Contract: `TASK-FORMAT.md` → `### Test runs section`.

10. **`## Dependency Graph`** — phase dependencies in ASCII.

   **Guard B — a phase carrying an `Editor:` task is serialized alone in its execution layer.**

   The unit of parallelism downstream is the **phase**. `/unikit-implement` and `unikit-implement-coordinator` build the phase graph from the `**Dependencies:**` lines, compute execution layers (Layer 0 = phases with no dependencies; Layer N = phases whose dependencies all sit in layers 0..N-1) and run **every phase of one layer concurrently**, while the tasks *inside* a phase always run in order.

   So this is a rule about **layers**, never about tasks: two `Editor:` tasks in one phase are already sequential, and splitting them into two phases to "separate" them creates exactly the collision it was meant to prevent.

   **How to write it.** When a phase carries at least one `Editor:` line, write the dependency lines so that the phase is the only member of its layer:
   - the editor phase **depends on every phase that must precede it**, so nothing from the earlier layers lands beside it;
   - **every remaining phase depends on the editor phase**, directly or transitively, so nothing from the later ones does either.

   Then check the graph you actually wrote, not the intent: walk the layers the way the coordinator does and confirm that every layer holding an editor phase has exactly one member. If serialization makes the plan awkward, move the editor work into a phase of its own rather than relaxing the rule.

11. **`## Total Estimated Effort`** — sum of all phases.

12. **`## Technical Context`** — always included. Nine subsections (`CONTEXT`, `CONSTRAINTS`, `INTERFACES`, `KEY PATTERNS`, `DEPENDENCY GRAPH`, `FILES`, `EDITOR TARGETS`, `DI BINDINGS`, `OUT OF SCOPE`); `EDITOR TARGETS` is omitted entirely when the plan carries no `Editor:` task. In **ultra** the manifest keeps only the cross-phase part and the rest goes into the phase files — the distribution rule is `{{skills_dir}}/{{self_name}}/references/ULTRA-PLAN-FORMAT.md`. Content comes from Step 4 Phase B, synthesized with the Bootstrap rules: base it on the actual code, do not invent. Template: `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md`.

   **Self-check:** every interface the tasks name is in `### INTERFACES` with its full {{engine_code_language}} signature, every `Editor:` target has its `### EDITOR TARGETS` row (Kind / Container / Target / Change), and the DI bindings follow `references/ENGINE_RULES.md` §2. In **fast and full** the check runs inside the one plan file; in **ultra** both subsections live in the phase file of the task that owns them, and the check runs between the manifest checklist and that file — never pull them back into the manifest.

13. **`## Open Questions`** (optional) — uncertainties the planning pass could not close, one line each; the last section of the manifest (`TASK-FORMAT.md`). `unikit-plan-polisher` writes its leftovers here; omit the section when there are none.

### Step 6: Confirm with User

Show the user:
1. The plan path — `.unikit/code/PLAN.md` (fast), or `.unikit/code/plans/<feature-name>/PLAN.md` (full, ultra), plus the research reference if linked
2. Full and ultra: the git branch name when `branch_created = true`, otherwise the current branch name
3. A brief summary of the phases and the total estimated effort
4. When `engine_rules_loaded = false` — the line `Engine rules: ENGINE_RULES.md not found, Editor: fields skipped`
5. The reminder: "To start implementation, run: `/unikit-implement`"
6. Ask whether to adjust anything

**Ultra mode:** the items above plus `mode-ultra.md` Step H (phase-file count, task count, integrity result, and the not-implementation-ready line when blocking open questions exist).

### Step 7: Context Cleanup

Suggest the user to free up context space if needed: `/clear` (full reset) or `/compact` (compress history).

## Task Description Requirements

Beyond Step 5 item 5 and `references/TASK-FORMAT.md`: name a dependency on another task's output when the phase order does not make it obvious; a simple task (rename, delete, move) may carry its paths in the description instead of a `Files:` line. A task needs a concrete deliverable, and its `WHY:` must not restate it.

## Important Rules

1. **NO report tasks** — don't create summary/report tasks at the end of a plan
2. **Right granularity** — not too big (overwhelming), not too small (noise). A task should be completable in one focused session
3. **Dependencies matter** — order tasks so they can be done sequentially without blockers
4. **Respect module boundaries** — follow the dependency rules of `.unikit/ARCHITECTURE.md`; never invent a direction it does not state
5. **A plan is intent, not inventory — no tool name ever reaches it.** Names live in the live catalog and in the `evidence` column of a findings row, and nowhere else. The planner never lifts an obligation on the executor's behalf — no pre-declared gate, no "this server cannot do X", no `⏸️ MANUAL` written in advance
