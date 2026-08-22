---
name: unikit-verify
description: >-
  Verify a completed implementation against the feature plan in .unikit/code/plans/.
  Confirms every planned task was fully implemented and nothing was forgotten, the code
  compiles, the tests pass, and {{engine_name}}-specific conventions are followed (per
  ENGINE_RULES.md). Run this after /unikit-implement finishes, or whenever the user wants
  to confirm the work is complete and correct against the plan, e.g. "verify", "verify
  the implementation", "check the work", "did we miss anything", "did we implement
  everything", "is the plan fully done", "make sure nothing was forgotten", "does it
  build and pass tests". This checks plan completeness and build/test health — for
  code-quality, bug, and security review use the review skill instead.
argument-hint: "[--strict] [NNN-feature-name]"
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
  - Bash(date *)
  - Bash(shasum *)
  - Bash(sha256sum *)
  - Agent
  - AskUserQuestion
  - Skill
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.5"
  category: quality
---

# Verify — Post-Implementation Quality Check

Verify that the implementation matches the plan, nothing was missed, and the code is ready for merge.

This skill runs after `/unikit-implement` or manually at any time.

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

---

## Delegation agents

This skill uses named delegation aliases for `Agent(...)` calls. Each alias expands to an `Agent(subagent_type: "general-purpose", ...)` invocation with the matching skill loaded.

- **`develop-agent`** — used ONLY for fixes that span many independent files OR require extensive codebase exploration. Default fixes are applied inline by this skill using rules loaded in Step 0.2 Bootstrap. Expands to:

  ```
  Agent(
    subagent_type: "general-purpose",
    prompt: "/unikit-devcontext <fix details>",
    description: "Apply fix",
    skills: ["unikit-devcontext"]
  )
  ```

  Fallback: if the `Agent` tool is unavailable, invoke `/unikit-devcontext` inline.

- **`rules-agent`** — capture a new project rule spotted during verification. Expands to:

  ```
  Agent(
    subagent_type: "general-purpose",
    prompt: "/unikit-rules Add rule: <rule text>",
    description: "Record project rule",
    skills: ["unikit-rules"]
  )
  ```

  Fallback: if the `Agent` tool is unavailable, invoke `/unikit-rules` inline, one rule at a time.

---

## Step 0: Load Context

### 0.0 Load Ownership and Gate Contract

- Read `{{skills_dir}}/{{self_name}}/references/CONTEXT-GATES-AND-OWNERSHIP.md` first.
- Treat it as the canonical source for:
  - command-to-artifact ownership,
  - read-only behavior for `unikit-commit`/`unikit-review`/`unikit-verify`,
  - normal vs strict context-gate thresholds.
- If this contract conflicts with older examples in this file, follow the contract.
- Also read `.unikit/system/gate-result-contract.md` — the canonical schema for the machine-readable `unikit-gate-result` block emitted in Step 4.4. If it is missing or unreadable, do not block: the Step 4.4 section is self-sufficient on the schema and degrades gracefully (see there).
- Also read `.unikit/system/ultra-plan-read.md` — the reader contract for an ultra plan bundle: detection, per-consumer reading depth, what is mutable during execution, and the blocking integrity checks. Name it and follow it; never restate it here — one contract, one place.
  **If `.unikit/system/ultra-plan-read.md` is missing or unreadable, do not block:** treat every plan as a single-file plan and continue exactly as before — a project that predates the ultra port has no bundles to read.

### 0.1 Find Feature Plan

Search logic — same as `/unikit-implement` (unified plan detection):

1. If `$ARGUMENTS` specifies a folder name (e.g. `2026-03-10_core-loop` or legacy `NNN-feature-name`) → use it
2. Otherwise → auto-detect:
   a. **Fast plan check** — if `.unikit/code/PLAN.md` exists, use it (flat fast-mode plan)
   b. **Git branch match** — if on `feature/*` branch, find folder ending with `_<feature-name>` (new format) or `*-<feature-name>` (legacy)
   c. **Latest by date** (fallback) — sort all folders lexicographically descending, pick first (YYYY-MM-DD gives chronological order; legacy `DDD-*` sorts before `2xxx-*`)
3. If no plan found (no `.unikit/code/PLAN.md` and `.unikit/code/plans/` is empty or doesn't exist):

```
No plan found. What should I verify?

Options:
1. Verify branch diff — compare current branch against master
2. Verify last N commits — check recent commits for completeness
3. Cancel
```

Based on choice:
- Branch diff → gather `CHANGED_FILES` via `git diff --name-only $BASE_BRANCH...HEAD`. Skip Step 1 (Task Completion Audit — no plan exists). Execute Step 2 (Code Quality) and Step 3 (Consistency Checks) on collected files. In the report (Step 4), use header: `### Standalone verification (no plan)` instead of `### Feature: ...`
- Last N commits → ask user for the number of commits via AskUserQuestion. Gather files via `git diff --name-only HEAD~N..HEAD`. Skip Step 1. Execute Steps 2-3 on collected files. Same standalone report header.
- Cancel → **STOP**

**If both `.unikit/code/PLAN.md` and a matching folder plan exist**, ask the user which one to verify.

Check if `--strict` is in `$ARGUMENTS`. If yes — enable strict mode (see Strict Mode section).

**Ultra bundle check.** Read the first line of the resolved plan manifest. If it equals `<!-- unikit:plan-mode:ultra -->`, this is an ultra bundle: follow `.unikit/system/ultra-plan-read.md` for reading depth, integrity and mutability. Otherwise continue unchanged. **Discovery itself does not change** — the folder is found the way it always was; only what is read inside it differs.

**Reading depth:** read the manifest plus **every** phase file **before** verification begins — this gate validates the plan as a whole, and a phase read late is a phase whose criteria were never applied.

### 0.2 Read Plan & Context

- Read the **plan manifest** — `.unikit/code/plans/<folder>/PLAN.md` for a folder plan, `.unikit/code/PLAN.md` for a flat fast-mode plan. One file carries everything: `## Overview`, `## Settings`, the `## Checklist` with phases, dependencies and completion status, and `## Technical Context` (constraints, interfaces, key patterns, dependency graph, files, editor targets, DI bindings). For the full section list see `unikit-plan/references/TASK-FORMAT.md` → *Plan Manifest Template*; it is not restated here.
- If the manifest has a `## Based on` section pointing to a research, do **NOT** read that research's `RESEARCH_BRIEF.md` as a substitute for the plan's own context. The plan's `## Technical Context` is authoritative and supersedes the research brief (`/unikit-plan`: it was synthesized from the research and then verified against the code). The research is read for **one** purpose only — the drift check below.
- Read **`.unikit/DESCRIPTION.md`** — project specification, tech stack
- Read **`.unikit/ARCHITECTURE.md`** — project structure, dependency rules, modules, namespace conventions
- Read **`.unikit/ROADMAP.md`** (if present) — strategic milestones for alignment checks

**Research drift check.** For each entry in `## Based on` that carries a `Brief SHA256` field:

1. Recompute the SHA256 of that research's `RESEARCH_BRIEF.md` with the canonical five-rule normalization — strip a leading **UTF-8 BOM**, LF line endings, trailing spaces trimmed from every line, exactly **one final newline**, no reformatting (line order and leading whitespace preserved) — fed through **stdin, never a temp file**: `… | shasum -a 256 | awk '{print $1}'`, falling back to `sha256sum`.
2. Recomputed == recorded → say nothing and continue.
3. Recomputed ≠ recorded → emit
   `WARN [research-drift]: <folder> — linked brief is no longer byte-identical to the one this plan was built from`
   and continue **against the plan**, not against the research. Do not expand scope, do not add tasks, do not rewrite the hash. A rebase is `/unikit-improve`'s job and happens only when the user explicitly asks for it. The wording is deliberate: the brief is regenerated wholesale on every save, so a mismatch proves the input is not the same bytes — not that the author changed their mind. Claiming the latter would make the warning read as a finding.
4. `RESEARCH_BRIEF.md` missing or unreadable → emit `WARN [research-drift]: <folder> source missing` and continue against the plan.
5. No `Brief SHA256` recorded (a plan predating this field) → drift is **unknown**, not absent. Emit `WARN [research-drift]: <folder> drift unknown (no hash recorded)`.
6. Neither `shasum` nor `sha256sum` available → emit `WARN [research-drift]: no SHA256 tool available — drift checks skipped` **once** for the whole run, and continue.

The label `WARN [research-drift]` is canonical and the same for every outcome; per-branch labels would make them indistinguishable when a log is grepped for drift.

There is no bundle-validation branch here. `## Based on` always names a folder under `.unikit/code/researches/`, and the hashed file is always `RESEARCH_BRIEF.md` — one shape, one filename. A source path that varies between a single configured file and a bundle entry point would need such a branch; UniKit's does not.

**Skipping this drift check is a verification bug.** A verification that passed while the plan and its source had diverged is the one failure this check exists to prevent.

Every `WARN [research-drift]` line reaches the Step 4 report **and** the `unikit-gate-result` block — otherwise it is lost with the session, the same argument that carries `⏸️ MANUAL` commands there. The gate level is `warn`, **never** `fail`: source drift does not make the implementation wrong, it makes it debatable, and the decision is the user's.

**Parse `## Settings`** from the plan while it is open here — Step 1 needs it and runs long before the `Docs:` read in Step 3:
- `Editor tasks: mcp | manual | direct` — the mode `/unikit-implement` used. Context for Step 1: under `manual`, editor targets are expected to be marked `⏸️ MANUAL` rather than implemented.

Bootstrap loads coding rules and principles ONCE upfront so Step 4.3 fixes can be applied inline without re-loading on each delegation.

**Read in parallel (rules + principles, for inline fix execution in Step 4.3):**
1. `.unikit/system/dev-principles.md` — engine development principles
2. `.unikit/RULES.md` — project overrides (highest priority)
3. `.unikit/memory/code/RULES_INDEX.md` — index of core/stack rules
4. For EACH row in the Core table where Required By = `all` or contains `unikit-verify` — read that file from `.unikit/memory/code/core/` using the Read tool.

Stack rules are loaded on-demand if Step 4.3 fixes reveal framework-specific issues.

**Engine-MCP rules (conditional, engine-neutral) — once per session, zero calls:**

5. `.unikit/system/engine-mcp/INDEX.md`, **base section only** — the delivery stamp (`server:`) plus every section **except** the `## Check` table — access, the live failure classes, shape and cost, what is irreversible, the lane, and what to do when the file is silent. Those are the exceptions that hold for every target here. **Do not read the `## Check` table now** — it is grepped per editor target, by area (Step 1).
6. `.unikit/MCP-RECHECK-NOTES.md`, **header only** (`server:` / `audited:`) — this project's own accumulated findings. Compare that header against the delivery stamp from item 5. On a mismatch print exactly one line and **apply the entries anyway**:

   ```
   WARN [engine-mcp] notes header ≠ configured server (<notes> ≠ <configured>)
   ```

   The entries are *suspect*, not void, and a suspect check still fails safe. Retiring them belongs to `/unikit-mcp-audit`.
7. `.unikit/system/engine-mcp/verification.md` — **this skill and no other reads it.** It is the per-gate calibration for the configured server: for each gate, whether it is reachable and **what class of evidence closes it**. It grants nothing and lifts nothing (see the gate rule in Step 2); it tells you which observation counts.

**Any of them absent → skip it, print one line, and continue with every right you had:**

```
MCP rules: no INDEX.md — no known exceptions for this server, rights unchanged
```

No rules means no known exceptions, never no capabilities. Absence never disables the engine MCP and never turns a target into `⏸️ MANUAL` (`.unikit/system/dev-principles.md` → **A9**), and it never lifts a gate — a missing calibration leaves every gate in force.

**Read `.unikit/skill-context/unikit-verify/SKILL.md`** — MANDATORY if the file exists.

This file contains project-specific rules accumulated by `/unikit-evolve` from patches,
codebase conventions, and tech-stack analysis. These rules are tailored to the current project.

**How to apply skill-context rules:**
- Treat them as **project-level overrides** for this skill's general instructions
- When a skill-context rule conflicts with a general rule written in this SKILL.md,
  **the skill-context rule wins** (more specific context takes priority)
- When there is no conflict, apply both: general rules from SKILL.md + project rules from skill-context
- Do NOT ignore skill-context rules even if they seem to contradict this skill's defaults —
  they exist because the project's experience proved the default insufficient

Understand:
- Which tasks are completed (`- [x]`) and which are not (`- [ ]`)
- Dependencies between phases
- Which files and classes are expected

### 0.3 Load Engine Rules

Read `{{skills_dir}}/{{self_name}}/references/ENGINE_RULES.md` to load engine-specific verification checks.

This file contains:
- **Companion file checks** — engine-specific file pairing rules
- **Module boundary checks** — engine-specific boundary enforcement mechanism
- **Structural checks** — engine-specific code conventions and validation rules
- **Read-only paths** — engine-specific directories that must not be modified
- **Strict mode items** — engine-specific checks that always fail on violation

All engine-specific checks in Steps 2 and 3 reference this file. If `ENGINE_RULES.md` is missing, skip engine-specific checks and note: `Engine rules: ENGINE_RULES.md not found, engine-specific checks skipped`.

### 0.4 Detect Base Branch

Determine the project's base branch (may be `main` or `master`):

```bash
# Detect base branch
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
# Fallback: check which branch exists
if [ -z "$BASE_BRANCH" ]; then
  BASE_BRANCH=$(git rev-parse --verify origin/master >/dev/null 2>&1 && echo master || echo main)
fi
```

Save as `$BASE_BRANCH` — use it in all subsequent git commands instead of hardcoded `main` or `master`.

### 0.5 Gather Changed Files

```bash
# Files changed within the feature
git diff --name-only $BASE_BRANCH...HEAD
# Or if on $BASE_BRANCH — check recent commits
git diff --name-only HEAD~20..HEAD
```

Save as `CHANGED_FILES` — this list will be used in all subsequent steps.

---

## Step 1: Task Completion Audit

**Use `Agent` tool with `subagent_type: Explore, model: sonnet` to verify task completion in parallel.** This keeps the main context clean and allows simultaneous verification of multiple phases.

Launch one Explore task per phase from the plan's task list. For each phase, provide:
- Task descriptions from the roadmap
- `CHANGED_FILES` list for context
- Instructions: find implementing code using Glob/Grep, read key files, confirm completeness (not a stub), report status per task with file paths
- Instructions: **skip any task carrying an `Editor:` line — do not mark it `NOT FOUND`.** It is verified in the main context (see below).

**Editor targets are excluded from the Explore fan-out.** A task with an `Editor:` line changed the editor's serialized state; there is nothing in the sources to find, so an Explore agent would honestly return `❌ NOT FOUND` and block correctly completed work. The subagents also have no engine tools — the `allowed-tools` grants in `mcp/*.json` are issued to `unikit-verify`, not to its children. So:

- **Editor tasks stay in this skill's own context** and are verified by **reading the editor state back through the engine MCP**, never with Glob/Grep. The per-kind checks are engine knowledge — see `{{skills_dir}}/{{self_name}}/references/ENGINE_RULES.md` → `## Editor Target Checks`.
- **Verify against the editor, never against the plan.** The acceptance criterion is closed by what the editor reports now, not by what the plan said would happen and not by what the implementation report claimed. Re-reading the plan's own words back is not verification: it makes a planning error invisible, because the two sides of the comparison have the same author.
- **Per target, before the read-back:** pick candidate affordances from the live catalog by intent (never from a file, never from memory), ask the server for their schemas, and grep the `## Check` tables of `.unikit/system/engine-mcp/INDEX.md` and `.unikit/MCP-RECHECK-NOTES.md` for this target's own area **plus every cross-cutting area** — `rollback · console · batch · compile · transport · visual`. No matching line changes nothing: an absent exception is not an absent capability (A9).
- **A call that misled you is a finding.** Record it in the verification report as a candidate line (the `area`, what has to be confirmed, the raw call and the raw answer) and in the plan's `## MCP Findings` table. **Write the table row on the pass over the target that produced it, not in the verification summary** — a finding held until the summary is lost to every run that stops early. `F<n>` is one more than the highest id already in the table (read the table first, so a re-verify does not restart the numbering); `observed` is the date you observed it (`Bash(date *)`), copied into the notes verbatim by `/unikit-mcp-trap`, so leaving it empty makes the notes record the transfer date instead; dedup is semantic — a candidate saying the same thing about the same `area` as an existing row is dropped, by meaning rather than by string match. Columns: `unikit-plan/references/TASK-FORMAT.md` → `### MCP findings section`. **Never write `.unikit/MCP-RECHECK-NOTES.md` from here** — the durable surface passes through a human running `/unikit-mcp-trap`.
- **MCP unavailable** → `⏭️ SKIPPED (editor target, MCP unavailable)`. Not a failure.
- **Task marked `⏸️ MANUAL` in the plan** → `⏸️ MANUAL`. Not a blocker: the user took it on deliberately. Report the target so it stays visible.

**Fallback:** If Agent tool is unavailable, investigate directly using Glob and Grep — with the **same exclusion**: tasks carrying an `Editor:` line are not Glob/Grep-verifiable and keep the treatment above.

**In an ultra bundle the checkbox is not the specification.** Verify implementation against the detailed per-task interfaces, edge cases, logging, acceptance criteria, and commands — **not only the short checkbox text**. The manifest's checklist line is a pointer; what is verified against is the task's own `### Acceptance Criteria` and `### Verification` in its phase file. Pass those to each Explore task alongside the checklist line.

### 1.1 Build Checklist

After tasks return, synthesize findings into a checklist:

```
✅ Task 1.1: Create ICustomer interface — COMPLETED
   - ICustomer.cs created in Assets/Modules/Characters/Scripts/Customers/
   - All methods from plan are present
   - Namespace is correct

⚠️ Task 2.3: Add customer factory — PARTIAL
   - CustomerFactory.cs created
   - MISSING: CreateFromConfig() method mentioned in plan
   - MISSING: registration in Zenject installer

❌ Task 3.1: Create CustomerView — NOT FOUND
   - File not found in expected directory
   - No mention of CustomerView in changed files
```

Statuses:
- `✅ COMPLETED` — all requirements confirmed in code
- `⚠️ PARTIAL` — partially implemented, something missing
- `❌ NOT FOUND` — implementation not found
- `⏭️ SKIPPED` — task was intentionally skipped by the user, or an editor target could not be read back (`⏭️ SKIPPED (editor target, MCP unavailable)`)
- `⏸️ MANUAL` — an editor target the user took on themselves (`Editor tasks: manual`); reported, never a blocker

---

## Step 2: Code Quality Verification

**Gate calibration — `.unikit/system/engine-mcp/verification.md` (read in Step 0).**

Steps 2.1 and 2.2 each have a bail-out branch for "engine MCP unavailable". That is not the only way a gate can fail to close: the tool may be reachable while the *capability* is not — a run that starts and never reports, a validator that answers clean by construction. Three outcomes, and only three:

- **MCP unavailable** — MCP server `{{engine_mcp_tool}}` itself is not reachable → skip with the wording given in the step.
- **Gate closed** — the gate produced the class of evidence `verification.md` names for it → report it passed, on that evidence and no other.
- **`GATE LIFTED`** — **a verdict this skill produces, never a line it reads.** `verification.md` pre-declares nothing: it says which gates are reachable and what proves them. A gate is lifted only when you **tried it, found no affordance, and can present the evidence of that absence** — then skip it and note the reason as the observation that established it, not as `engine MCP unavailable`. Do not substitute another tool for a lifted gate, and never report it as passed.

A gate marked **partly** reachable is not lifted in advance either: attempt it, and lift only the half that produced evidence of absence.

If `verification.md` does not exist, **every gate applies in full.** A missing calibration is a missing hint, not a missing obligation (`dev-principles.md` → A9).

### 2.1 {{engine_name}} Compile Check

Use MCP server `{{engine_mcp_tool}}` to check that the project compiles after implementation:
- Refresh/recompile the project through MCP server `{{engine_mcp_tool}}`
- Check the {{engine_name}} console for compilation errors
- If errors found — display them with `file:line` references
- If MCP server `{{engine_mcp_tool}}` is unavailable — skip and note: `Compilation check: engine MCP unavailable, skipped`
- If the compile gate is attempted and no affordance answers it — **GATE LIFTED**, skip and note: `Compilation check: gate lifted — <the observation that established it>`

### 2.2 {{engine_name}} Test Check

Use MCP server `{{engine_mcp_tool}}` to run tests for affected modules:
- Determine which test assemblies cover the modified modules (check CLAUDE.md for the list of test assemblies)
- If changed files include modules with test assemblies — run those assemblies specifically
- Otherwise run all EditMode tests as a baseline check
- Wait for results and display them — highlight any failures
- If MCP server `{{engine_mcp_tool}}` is unavailable — skip and note: `Test run: engine MCP unavailable, skipped`
- If the tests gate is attempted and no affordance answers it — **GATE LIFTED**, skip and note: `Test run: gate lifted — <the observation that established it>`. `verification.md` also names what the gate must require of a passing run (a readable result, and a test count above zero); a run that reports success over zero tests has not closed it

### 2.3 Engine-Specific Checks

Apply all checks defined in `{{skills_dir}}/{{self_name}}/references/ENGINE_RULES.md`:

- **Companion file checks** — verify file pairing rules for this engine (if applicable)
- **Module boundary checks** — verify dependency boundaries using the engine's boundary mechanism (if applicable)
- **Structural checks** — verify engine-specific code conventions
- **Read-only path enforcement** — flag any modifications to engine-defined read-only directories

If `ENGINE_RULES.md` is not loaded (Step 0.3), skip this section and note: `Engine-specific checks: skipped (no ENGINE_RULES.md)`

---

## Step 3: Consistency Checks

### 3.1 Plan vs Code Drift

Check discrepancies between plan and code:

- **Naming**: do class/interface/method names match the plan?
- **File locations**: are files where the plan expected them?
- **Contracts**: do interfaces contain the methods described in the plan?

### 3.2 Leftover Artifacts

Search for artifacts that should have been cleaned up:

```
Grep in CHANGED_FILES: TODO|FIXME|HACK|XXX|TEMP|PLACEHOLDER
```

Also check:
- `Debug.Log` without conditional context (not in #if DEBUG)
- Commented-out code blocks

Each finding — record it, but note it may be intentional.

### 3.3 DESCRIPTION.md Sync

Check whether `.unikit/DESCRIPTION.md` reflects the current state:

- New dependencies/libraries → should be in the document
- Architecture changes → should be reflected
- New modules → should be documented

### 3.4 ARCHITECTURE.md Sync

Check `.unikit/ARCHITECTURE.md`:

- New modules or directories → should be in the project tree
- New module boundaries → should be reflected in dependency rules
- Changes to folder structure → should be updated

### 3.5 Context Gates (Architecture / Rules / Roadmap)

Apply the canonical contract from `{{skills_dir}}/{{self_name}}/references/CONTEXT-GATES-AND-OWNERSHIP.md`.

Evaluate and report each gate explicitly:

- **Architecture gate**
  - Pass: implementation follows module/layer boundaries, dependency rules, and anti-patterns from `.unikit/ARCHITECTURE.md`
  - Warn: architecture document appears stale or mapping is ambiguous
  - Fail: clear boundary/dependency violation (e.g. `Assets/Modules/` → `Assets/Game/`)

- **Rules gate**
  - Pass: implementation follows explicit project rules
  - Warn: relevance/verification is ambiguous
  - Fail: clear violation of explicit rule text

- **Roadmap gate** (only if `.unikit/ROADMAP.md` exists)
  - Pass: `feat`/`fix`/`perf` work has milestone linkage in the plan's `## Roadmap Linkage` section
  - Warn: `.unikit/ROADMAP.md` missing, ambiguous milestone mapping, or no milestone linkage for `feat`/`fix`/`perf` scope
  - Note: missing milestone linkage for `feat`/`fix`/`perf` remains a warning even in strict mode — it is never a blocker

Normal mode behavior:
- Architecture/rules clear violations fail verification.
- Ambiguous or stale context artifacts are warnings.
- Missing milestone linkage is a warning.

Strict mode behavior:
- Architecture and rules clear violations fail verification.
- Stale context artifacts are warnings.
- Missing milestone linkage is a warning (not a failure).

Logging/reporting format:
- Non-blocking findings: `WARN [gate-name] ...`
- Blocking findings: `ERROR [gate-name] ...`

### 3.6 Context Drift (Optional Remediation)

`/unikit-verify` is **read-only** for context artifacts. Do not edit or regenerate `.unikit/*` files here.

If you detect that a context artifact is stale, missing, or ambiguous, report it as a drift finding and provide the owner-command remediation:

- `DESCRIPTION.md` drift → suggest `/unikit` (or note that `/unikit-implement` should have updated it)
- `ARCHITECTURE.md` drift → suggest `/unikit-architecture`
- `RULES.md` drift → suggest `/unikit-rules` to add missing conventions
- `ROADMAP.md` drift → suggest `/unikit-roadmap check` (or `/unikit-roadmap <update request>`)

Ask the user a single optional question **only if** drift was detected and fixing it now would materially improve correctness:

```
Context drift detected. Update now?

Options:
1. Yes — show update commands (recommended)
2. No — continue without updating
```

Based on choice:
- Yes → show update commands for user to invoke
- No → continue verification without updating

### 3.7 Documentation Sync

Check whether the implementation introduced user-facing changes that should be reflected in project documentation (`README.md`, `docs/`).

**a) Check plan's Docs policy:**

Read the `## Settings` section from the plan manifest:
- If `Docs: yes` — verify that documentation was actually updated during implementation (check `CHANGED_FILES` for `README.md`, `docs/*.md`, or `.unikit/docs-config.json`). If no doc files were modified: `WARN [docs] Docs policy was 'yes' but no documentation files were changed — run /unikit-docs`
- If `Docs: no` or missing — check whether the implementation introduced new public APIs, new modules, changed configuration, or modified user-facing behavior. If yes: `WARN [docs] Implementation changed public API/behavior but Docs policy was no/unset — consider /unikit-docs`

**b) Check existing docs for staleness:**

If `README.md` and/or `docs/` exist:
- Scan for references to classes, interfaces, or files that were renamed or deleted during this implementation
- Check if docs mention modules or systems that were substantially restructured
- If stale references found: `WARN [docs] docs/<file>.md references <old-name> which was renamed/deleted in this implementation`

**c) Report:**

Include documentation findings in the verification report under a `### Documentation` section:
- `✅ Documentation up to date` — docs policy satisfied or no doc-impacting changes
- `⚠️ Documentation may need update` — with specific findings and suggestion to run `/unikit-docs`

### 3.8 Design Acceptance Criteria (game-design module)

**Only when the plan carries a `## Design` section** (added by `/unikit-plan` Step 4.5 when the project has a game-design workspace). If there is no `## Design` section, skip this check silently.

Verify the implementation against the Acceptance Criteria **snapshotted in the plan** — not against the live `.unikit/gamedesign/` docs. The plan's `## Design` block pins the system `SYS-id`, the version, and the cited `AC-<id>`s; checking against the plan (not the current design) preserves the one-way boundary (verify reads the plan; design changes flow only through `/unikit-gd-*`) and validates against the exact version the plan was written for.

For each cited `AC-<id>` (Given-When-Then):
- Confirm the implementing code (from `CHANGED_FILES` / the Step 1 audit) satisfies the Then-clause under the Given/When conditions. Be concrete — cite `file:line`.
- An `AC` marked **removed in vN** → confirm the old behavior was actually ripped out; a lingering old code path is a finding.
- Unmet or partially-met `AC` → record it as an issue.

Report findings under a `### Design Acceptance` section (see Step 4.1). The AC check itself is **read-only against the live design** — it validates the plan snapshot, never `.unikit/gamedesign/`. The **one** exception is the all-AC-met writeback in Step 3.9 below.

### 3.9 `implemented` Writeback (game-design module — the lone code→design write)

**Gate — only when 3.8 found _every_ cited `AC-<id>` met** for the plan's `SYS-id`@version (no unmet, no partial). On any unmet/partial AC, **do nothing here** — skip silently.

This is the single sanctioned code→design write (`gd-principles` → One-Way Boundary; canonical in `references/CONTEXT-GATES-AND-OWNERSHIP.md`, which overrides this body). It is explicitly carved out of the read-only rules — Step 3.6, Step 3.8, and the global **Important Rules #1 and #5**. On all-AC-met, stamp the implemented marker on the **single** design surface:

1. **`.unikit/gamedesign/GD-IDS.yaml`** — find the `systems` entry whose `id:` equals the cited `SYS-id` and **add-or-set** `implemented_version: <cited @version>` (add the key if the entry lacks it — authoring skills inline their entries and may not carry the template's commented field). Leave `doc_status` and every other field untouched.

The `implemented` state is **read-only everywhere else**: GAME.md's `## System Map [gen]` renders it from this `implemented_version` field (display precedence over `doc_status`), so there is **no second surface** to write — design re-renders the map, code never touches it.

**Locate-read only.** Opening `GD-IDS.yaml` here is **solely to locate the write target**; it is not a general live-design read and does not relax 3.8's snapshot-only discipline (the AC check still runs against the plan's `## Design` snapshot, never the live docs). `GD-IDS.yaml` is the **only** `.unikit/gamedesign/` file this skill may open, and only on all-AC-met.

**Surface the write (no silent writes).** Confirm it in the `### Design Acceptance` report line (Step 4.1): on all-AC-met append `— stamped implemented_version: vN on <SYS-id>`. Never write silently.

---

## Step 4: Verification Report

### 4.1 Display Results

```
## Verification Report

### Feature: {NNN-feature-name}
### Branch: {current branch}

### Task Completion: 7/8 (87%)
| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Create ICustomer | ✅ Completed | |
| 1.2 | Create CustomerArgs | ✅ Completed | |
| 2.1 | Add CustomerFactory | ⚠️ Partial | Missing CreateFromConfig() |
| 2.2 | Register in DI | ✅ Completed | |
| 3.1 | Create CustomerView | ❌ Not found | File missing |

### Code Quality
- Compilation: ✅ / ⏭️ engine MCP unavailable
- Tests: ✅ 12 passed, 0 failed / ⏭️ engine MCP unavailable
- Engine checks: ✅ All passed (per ENGINE_RULES.md)
- Anti-patterns: ⚠️ 2 warnings

### Issues Found
1. **Task 2.1 partial** — CustomerFactory created but missing CreateFromConfig() method
2. **Task 3.1 not implemented** — CustomerView.cs not found
3. **Anti-pattern** — async void in CustomerSpawner.cs:42
4. **TODO found** — Assets/Game/Scripts/.../CustomerSystem.cs:87

### Documentation
- Documentation: ✅ up to date / ⚠️ may need update (run /unikit-docs)

### Design Acceptance
- Design AC: ✅ all cited AC met / ⚠️ N unmet (see issues) / ⏭️ no ## Design section
- Writeback: ✅ stamped implemented_version: vN on <SYS-id> (all-AC-met) / — none (unmet/partial or no ## Design)

### No Issues
- Engine-specific checks passed (per ENGINE_RULES.md)
- Namespace convention followed
- DESCRIPTION.md up to date
```

### 4.2 Determine Overall Status

- **All clean** — all tasks verified, no issues
- **Minor issues** — can be fixed quickly
- **Significant gaps** — tasks not implemented, needs more work

### 4.3 Action on Issues

If issues were found:

```
Verification found issues. What to do?

Options:
1. Fix now (recommended) — fix all issues right here
2. Fix critical only — skip warnings
3. Accept as is — move on
```

Based on choice:
- Fix now → apply fixes inline using `Read/Edit/Write/Bash` with the rules and principles loaded in Step 0.2. Use `develop-agent` ONLY when fixes span many independent files OR require extensive codebase exploration. Do NOT invoke `/unikit-devcontext` via `Skill(...)` — Bootstrap already covers everything.
- Fix critical only → same inline approach, but only incomplete tasks — skip warnings
- Accept as is → mark accepted issues in the report, proceed to Step 5

**Fallback:** If `Agent` tool is unavailable, do NOT invoke `/unikit-devcontext` inline. Implement fixes directly with the rules from Step 0.2 Bootstrap.

For each fix iteration (Fix now / Fix critical only). Fixes are written by this skill directly; rules are already in context from Step 0.2 Bootstrap.
- For each incomplete/partial task — implement the missing parts
- For TODO/debug artifacts — clean up
- For anti-patterns — fix
- Update the plan manifest after fixes — checkbox lines and the `## MCP Findings` table only. `## Technical Context` is never rewritten from here; it belongs to `/unikit-plan` and `/unikit-improve`
- After fixes — re-run checks on affected items

### 4.4 Machine-Readable Gate Result

> **Canonical template.** This section is the canonical shape of the `unikit-gate-result` block. The `unikit-review` "Machine-readable gate result" section mirrors it field-for-field — the only differences there are `"gate": "review"` and the projection source (review's Findings table instead of verify's task-audit + context gates). The graceful-degradation wording and the last-fence rule below are kept textually identical across the two skills so a single guard can lock both; if this wording changes, the review section must change in lockstep.

After the human-readable report (Step 4.1) and overall status (Step 4.2) — and after any inline fixes from Step 4.3, so the block reflects the **final** state — append exactly one fenced `unikit-gate-result` JSON block. Use the schema loaded from `.unikit/system/gate-result-contract.md` in Step 0.0.

**Last fence wins:** the `unikit-gate-result` block MUST be the LAST fenced block in this skill's output — orchestrators parse only the last one. Any earlier fence (the example below, quoted prior output) is illustrative and is not the gate result.

**Projection (verify):** derive the fields from the verification report:

- `"gate"`: always `"verify"`.
- `"status"`:
  - `fail` — at least one **blocker**: a non-skipped task at `⚠️ PARTIAL` or `❌ NOT FOUND`, a failed blocking quality check (compile error, failing test), a context-gate `ERROR` (architecture/rules clear violation), or — in strict mode, or whenever the plan carries a `## Design` section — an unmet/partial Design `AC`.
  - `warn` — no blockers, but non-blocking findings remain: anti-pattern/TODO warnings (normal mode), docs/test gaps accepted as warnings, ambiguous context drift, or missing milestone linkage.
  - `pass` — no blocking or warning findings.
- `"blocking"`: `true` only when `status` is `fail` (the result should stop commit/merge).
- `"blockers"`: include **only** blocking findings, each `{ "id", "severity", "file", "summary" }`. Use stable ids (`verify-task-<id>`, `verify-gate-architecture`, `verify-gate-rules`, `verify-ac-<AC-id>`, `verify-editor-<task-id>`). `severity` is `error` for blockers (`warning` only when policy escalates a warning-class finding to blocking). Non-blocking notes stay in the human summary, never in `blockers`.
  - `verify-editor-<task-id>` covers an editor target that was read back and found **unimplemented or wrong**. The two benign outcomes never enter `blockers`: `⏸️ MANUAL` (the user took the target on) and `⏭️ SKIPPED (editor target, …)` (it could not be read back). Both belong in the human summary.
- `"affected_files"`: the `CHANGED_FILES` the gate actually evaluated or cited (not unrelated repo files); empty array when none apply.
- **Research drift.** Every `WARN [research-drift]` line from Step 0.2 raises `status` to at least `warn` and is named in the human summary. It is **never** a blocker and never enters `blockers`: source drift makes the work debatable, not wrong, and the call is the user's.
- `"suggested_next.command"`: from the allowlist in `gate-result-contract.md` — `/unikit-fix` (task gaps, anti-patterns, failing checks), `/unikit-rules` (rules-gate violation needing a writer update), `/unikit-architecture` (architecture drift), `/unikit-roadmap` (roadmap drift), `/unikit-commit` (clean — natural next step), or `null`.

**Ultra bundle — verification commands outside the grant.** Commands under a task's `### Verification` are executed within the grant this skill already holds. Anything outside it is printed with the `⏸️ MANUAL` status in the report **and** must reach this block, or it is lost in silence: an unrun verification command is an accepted skip, so `status` is at least `warn` and the human summary names the command and the task. It is not a blocker and it never enters `blockers`. **`allowed-tools` is not widened for this** — the `⏸️ MANUAL` idiom already exists for editor targets.

```unikit-gate-result
{
  "schema_version": 1,
  "gate": "verify",
  "status": "pass",
  "blocking": false,
  "blockers": [],
  "affected_files": [],
  "suggested_next": {
    "command": "/unikit-commit",
    "reason": "Verification passed without blockers."
  }
}
```

The fenced block contains JSON only — no comments, trailing commas, or prose inside it.

**Graceful degradation:** if `.unikit/system/gate-result-contract.md` is missing or unreadable, do not hard-fail — emit the block from the inline schema in this section; if even that is not possible, skip the block and append the single line `WARN [gate-result]: contract asset unavailable`.

---

## Step 5: Suggest Follow-Up

After verification completes, suggest next steps based on results:

- If unresolved issues remain (accepted or deferred), suggest `/unikit-fix` first
- If all green, suggest review/commit flow

If recurring convention violations were found during verification (e.g. the same naming pattern was wrong in multiple places, or a DI convention was consistently missed), formulate up to 3 candidate rules and delegate to `rules-agent` (1 agent per rule, up to 3 agents), passing each rule text as the agent's prompt — e.g. `Add rule: Factory methods use CreateDefault() naming`. Do NOT wait for agents to finish — proceed to the next step immediately.

**Fallback** (if the `Agent` tool is unavailable in the current environment): you MUST invoke `/unikit-rules` yourself, one candidate at a time. Do NOT print the list of pending invocations to the user as a recommendation — that is a known failure mode where LLMs render the list instead of executing it. For every candidate rule, in order:

1. Invoke the `/unikit-rules` skill directly using whatever skill-invocation mechanism is available, passing the rule text as the argument. The slash-command invocation must be a real call, not printed text.
2. Wait for the invocation to return control before starting the next iteration.
3. Move to the next candidate. Do not stop after the first one. Do not ask the user to confirm between iterations. Do not wrap `/unikit-rules ...` lines in triple backticks.

Only after every candidate has been processed, proceed to the next step.

```
Verification complete. What's next?

Options:
1. Fix issues — run /unikit-fix with verification findings
2. Code review — run /unikit-review on changed files
3. Commit — run /unikit-commit
4. Skip — I'll handle it myself
```

Based on choice:
- Fix issues → run `/unikit-fix` with issue summary
- Code review → run `/unikit-review` on changed files
- Commit → run `/unikit-commit`
- Skip → **STOP**

### Context Cleanup

Suggest the user to free up context space if needed: `/clear` (full reset) or `/compact` (compress history).

---

## Strict Mode

When called with `--strict`:

```
/unikit-verify --strict
```

Normal mode already checks all items below but tolerates partial results and warnings. Strict mode **raises the bar** on these specific points:

| Check | Normal mode | Strict mode |
|-------|-------------|-------------|
| Task completion | `⚠️ PARTIAL` and `⏭️ SKIPPED` allowed | All tasks must be `✅ COMPLETED` — partial and skipped are failures. **Carve-out:** `⏭️ SKIPPED (editor target, …)` and `⏸️ MANUAL` are exempt in both modes — the first is an unreachable capability, the second is work the user deliberately took on; failing either would fail correctly completed work |
| Compilation (MCP server `{{engine_mcp_tool}}`) | Reported if available | **Required** to pass if MCP server `{{engine_mcp_tool}}` is available |
| Tests (MCP server `{{engine_mcp_tool}}`) | Reported if available | **Required** to pass if test assemblies exist for affected modules |
| TODO/FIXME/HACK | Warning | **Failure** — no leftover markers allowed in changed files |
| Anti-patterns | Warning | **Failure** — async void, missing CancellationToken, etc. |
| Design acceptance criteria | Unmet `AC` reported as a finding | **Failure** — every cited `AC` must be met (only when the plan has a `## Design` section) |

Items that behave **the same** in both modes (always checked, always fail on violation):
- Engine-specific checks (per ENGINE_RULES.md strict mode items)
- Namespace correctness
- Context gates (Architecture, Rules — see thresholds in `{{skills_dir}}/{{self_name}}/references/CONTEXT-GATES-AND-OWNERSHIP.md`)

Strict mode is recommended before merging to the base branch or creating a PR.

---

## Important Rules

1. **Read-only by default** — verification only reads and analyzes; fixes only with explicit user consent. **Sole automatic write:** the all-AC-met `implemented` writeback to the design layer (Step 3.9)
2. **Respond in the configured language** — use `language.ui` from `.unikit/config.yaml` (default: English)
3. **Precise references** — always provide file:line for each finding
4. **No false positives** — if unsure, mark as "⚠️ Verify manually"
5. **Do not modify .unikit/ files** — only report drift and suggest updates. **Single exception:** Step 3.9's all-AC-met writeback to `.unikit/gamedesign/GD-IDS.yaml` (`implemented_version`) — the lone sanctioned code→design write (a single surface; GAME.md's `## System Map [gen]` renders the `implemented` state read-only from it)
6. **Do not touch engine read-only paths** — see ENGINE_RULES.md for the list of read-only directories; ignore them during checks
7. **Agent-based delegation** — use `Agent(subagent_type: Explore, model: sonnet, ...)` for read-only investigation. Fixes are applied INLINE by this skill using rules loaded in Step 0.2 Bootstrap. Use `develop-agent` for fixes ONLY when they span many independent files or require extensive codebase exploration. Never invoke `/unikit-devcontext` via `Skill(...)`. If Agent tool is unavailable, fall back to inline work for both exploration (Glob/Grep/Read) and fixes (direct Read/Edit/Write/Bash with loaded rules).

---

## Usage

### After implement (recommended)
```
/unikit-verify
```

### Strict mode before merge
```
/unikit-verify --strict
```

### Specific feature
```
/unikit-verify 2026-03-08_customers-system
```

### Strict + specific feature
```
/unikit-verify --strict 2026-03-08_customers-system
```
