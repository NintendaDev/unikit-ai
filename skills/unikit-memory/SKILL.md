---
name: unikit-memory
description: >-
  Curate the project's knowledge base in .unikit/memory/ — the long-term reference library of
  documented coding standards (code style, design, testing, performance) and framework usage
  patterns (Zenject, DOTween, R3, UniTask, Addressables, Odin, etc.), researched and indexed.
  This is the knowledge base, distinct from project rules in .unikit/RULES.md. Use when the user
  wants to document or research how the project uses a framework ("document how we use
  Addressables", "add knowledge for DOTween", "best practices for R3"), add a core or stack entry
  to the knowledge base, or pastes framework docs URLs, files, folders, or PDFs to turn into vetted
  entries. Also: "--migrate-rules" (or passing RULES.md) promotes mature project rules into the
  knowledge base; "validate" re-syncs RULES_INDEX.md; "--module <id>" targets a module, "--into
  <file.md>" a rule file. For a quick project rule,
  override, or "remember this / always-never X" correction use /unikit-rules (RULES.md); for
  architecture decisions use ARCHITECTURE.md.
argument-hint: "[description | URL(s) | file/folder/PDF path | --module <id> | --into <file.md> | --migrate-rules | --skip-registry | validate]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
  - Skill
  - WebFetch
  - WebSearch
  - AskUserQuestion
---

# UniKit Rules — Project Knowledge Base Router

Manage project rules in `.unikit/memory/`. This skill is a **module-agnostic router**:
the knowledge base is partitioned into top-level **modules** (laid out on disk as
`.unikit/memory/<module>/<tier>`), and this skill resolves which module a request
targets, loads that module's **contract**, and then drives the generic
add/research/migrate/validate workflows against the module's tiers.

The list of registered modules and their structural fields (`tiers`,
`enginePartitioned`, `skillPrefix`) comes from `.unikit/system/modules.yml`. Each
module's content semantics, file format, and path conventions come from its
contract file `{{skills_dir}}/{{self_name}}/references/module-<id>.md`.

Today exactly one module is registered: **`code`** (tiers `core` + `stack`). The
router is written so additional modules can be registered later with no change to
this file — only a new `modules.yml` entry and a new `module-<id>.md` contract.

## What Belongs Here

- Content that belongs to one of the registered modules' tiers, as defined by that
  module's contract (`references/module-<id>.md` → "What Belongs Here" /
  "Content Classification").

## What Does NOT Belong Here

- **Architecture decisions** (module boundaries, dependency flow, DI structure) →
  `.unikit/ARCHITECTURE.md`
- **Project-specific overrides** (explicit deviations from base rules) →
  `.unikit/RULES.md` via the `unikit-rules` skill

If the user provides content that falls into these categories, inform them and
suggest the correct destination. For RULES.md content, suggest using the
`unikit-rules` skill instead. The active module's contract may define additional
"does not belong here" cases — honor them too.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

## Workflow

### Step 0: Load Configuration (silent — do NOT print or announce any of these values)

1. Read `.unikit/config.yaml` — extract `language.ui` for user-facing messages (default: `en`)
2. **Read `.unikit/system/modules.yml`** — the authoritative module registry snapshot.
   Parse every entry under `modules:` into `{ id, tiers, enginePartitioned, skillPrefix }`.
   This is the source of truth for which modules exist and what tiers each partitions
   its rules into. If the file is missing (older install), fall back to a single
   module `code` with tiers `core`, `stack` and surface a `WARN` suggesting
   `unikit-ai update` to regenerate it.
3. **Read `.unikit/skill-context/{{self_name}}/SKILL.md`** — MANDATORY if the file exists.

This file contains project-specific workflow rules added by `/unikit-skills-context` or `/unikit-evolve`.
These rules change how this skill operates (research priorities, cross-check behavior, file format conventions, etc.).

**How to apply skill-context rules:**
- Treat them as **project-level overrides** for this skill's general instructions
- When a skill-context rule conflicts with a general rule written in this SKILL.md,
  **the skill-context rule wins** (more specific context takes priority)
- When there is no conflict, apply both: general rules from SKILL.md + project rules from skill-context
- Do NOT ignore skill-context rules even if they seem to contradict this skill's defaults —
  they exist because the project's experience proved the default insufficient

Do NOT output status messages like "Язык: X" or "Module: X". Proceed directly to Step 0.5.

### Step 0.5: Resolve the Active Module

Determine which module this request targets **before** classifying input. Never
guess silently when the target is ambiguous.

**Resolution policy (in order):**

1. **Explicit `--module <id>` flag.** Scan `$ARGUMENTS` for `--module <id>`. If
   present:
   - Validate `<id>` against the ids parsed from `modules.yml`.
   - Valid → set `moduleId = <id>`, strip the `--module <id>` tokens from
     `$ARGUMENTS`, and skip the remaining resolution steps.
   - Invalid (no such module) → report the unknown id and the list of registered
     module ids via `AskUserQuestion` (options = registered modules), then use the
     chosen id. Strip the flag tokens regardless.
2. **No flag → infer from prompt context.** Match the request (rule content, URL,
   file path, stated intent) against each registered module's **domain**. The
   domain of a module is described in its contract file
   `{{skills_dir}}/{{self_name}}/references/module-<id>.md` (its "What Belongs
   Here" / "Content Classification" sections) plus the `modules.yml` metadata. Read
   the candidate contract files as needed to judge fit.
3. **Confident single match → use it silently.** If exactly one module's domain
   plausibly covers the request, set `moduleId` to it and continue without asking.
   A neutral or code-oriented request when `code` is the only registered module
   resolves silently to `code`.
4. **Ambiguity → ALWAYS ask.** If zero modules fit, the content fits none of the
   registered modules, or two or more modules are plausible, ask the user via
   `AskUserQuestion`. Options = every registered module id (with a one-line domain
   summary) + a final "help me choose — I'll describe what this is" option. Never
   fall back to a default module to avoid the question.
   - Edge case with a single registered module: a request that is **explicitly not
     about that module's domain** (and fits no registered module) must still trigger
     the question — do not dump unrelated content into `code` just because it is the
     only module.

**`--into <file.md>` path override (if present).** Scan `$ARGUMENTS` for
`--into <path>`. When present, the target rule file is pinned to that path and its
**module and tier are derived from the path** — `.unikit/memory/<module>/<tier>/<file>.md`.
Use it to resolve the module deterministically:

- `--module` **not** given → set `moduleId` to the `<module>` segment of the `--into`
  path (validate it against `modules.yml`).
- `--module` given and it **matches** the `--into` `<module>` segment → consistent; keep it.
- `--module` given but it **disagrees** with the `--into` `<module>` segment → the
  explicit `--module` wins; surface the conflict and confirm via `AskUserQuestion`
  before proceeding (never silently pick one), so Step 0.5 stays deterministic.

Do **not** strip `--into` here — Step 1 Phase A strips the flag and its value after the
target is recorded. Remember the derived `<tier>` and target filename for Step 2.

After resolution, the following are fixed for the rest of the run:

- `moduleId` — the resolved module id.
- `tiers` — that module's ordered tier list from `modules.yml` (for `code`: `core`, `stack`).
- **Module contract** — read `{{skills_dir}}/{{self_name}}/references/module-<moduleId>.md`
  now. It defines tier semantics, content classification, scope rules, and all file
  formats. Apply it throughout the rest of the workflow.
- **Memory root** — `.unikit/memory/<moduleId>/`.
- **Tier directories** — `.unikit/memory/<moduleId>/<tier>/` for each tier.
- **Index file** — `.unikit/memory/<moduleId>/RULES_INDEX.md`. Read it now for the
  current index of all rule files in this module.

Everywhere below, `<module>` means `moduleId` and `<tier>` means one of the resolved
module's tiers. Concrete tier names, the "what goes in which tier" decision, and the
file-format templates are **always** taken from the module contract — this router
never hardcodes them.

### Step 1: Parse Input & Classify Intent

Two-phase classification determines both input type and user intent.

**Phase A — Input type:**

```
First, strip the already-parsed flags from $ARGUMENTS before classifying input type:
├── --skip-registry present → Remember skipRegistry=true, strip the flag (absent → false).
│   The remaining text is classified normally.
├── --into <file.md> present → its value was already read in Step 0.5 (module/tier
│   derivation) and recorded as the Step 2 target. Strip the flag AND its value HERE,
│   BEFORE the input-type cascade below. Critical ordering: if `--into x.md` is left in,
│   the `.md` value matches "Ends with … (.md, …) → File input" and Phase B routes the
│   request to RESEARCH ("File/Folder path → RESEARCH (always)"), defeating the whole
│   point of --into (pin an existing file).
└── (The --module flag, if any, was already stripped in Step 0.5.)

Then classify the (possibly stripped) $ARGUMENTS:
├── Equals "validate" (case-insensitive) → VALIDATE INDEX (jump to Branch D)
├── Contains "--migrate-rules" →
│   ├── $ARGUMENTS is exactly "--migrate-rules" (no other text) → MIGRATE RULES (jump to Branch C)
│   └── $ARGUMENTS has additional text besides "--migrate-rules" →
│       Report to user: "--migrate-rules must be used alone without additional arguments."
│       STOP. Do not proceed.
├── Matches RULES.md path (case-insensitive):
│   "RULES.md", "rules.md", ".unikit/RULES.md",
│   ".unikit/rules.md", or any path ending with /RULES.md
│   → MIGRATE RULES (jump to Branch C)
├── Contains BOTH http(s):// tokens AND file extension / path tokens → Mixed input (URL + File)
├── Starts with http:// or https:// → URL input (can be multiple, space-separated)
├── Ends with a known file extension (.md, .txt, .json, .yaml, .pdf), or names an
│   existing file OR folder → File input (a folder, a PDF, or an oversized text file is
│   a LARGE source — see the note below; B.1 routes it through large-sources.md, not a
│   naive Read)
├── Has text content → Description input
└── No arguments → Interactive mode: ask user what to document, then re-classify
```

**Large sources (folder / PDF / oversized file).** When the File-input branch matches a
**folder**, a **PDF**, or a text file too large to read in one pass, the RESEARCH
pipeline does **not** `Read` it naively. The actual gathering is delegated to the
large-source workflow at `{{skills_dir}}/{{self_name}}/references/large-sources.md`
(TOC-first → topic-map → chunk → cleanup), which uses the **probe-gated** Python 3 helper
`{{skills_dir}}/{{self_name}}/scripts/material-prep.py` when a Python 3 interpreter is
available and falls back to a manual extraction strategy otherwise. Step 1 only
*classifies* the input here; B.1 ("File input") performs the delegation.

The `--skip-registry` flag is an escape hatch for callers that have already performed a registry lookup at a higher level and do not want this skill to repeat it. When the flag is present, Step 1.5 is bypassed entirely and the skill proceeds directly to content classification (Step 2) and generation.

**Phase B — Determine intent based on input type:**

```
Intent?
├── MIGRATE RULES   → Branch C (always — explicit migration request)
├── Mixed (URL + File) → RESEARCH (always — both inputs processed together)
├── URL(s)           → RESEARCH (always — URLs signal delegation)
├── File/Folder path → RESEARCH (always — user provides source material for analysis)
├── Description      → Analyze tone ↓
│   ├── Exploratory  → RESEARCH
│   └── Concrete     → ADD RULE
└── Interactive      → Ask user, then re-classify
```

**Tone signals for Description input:**

| Signal | Intent | Examples |
|--------|--------|----------|
| Vague topic, delegation words | **Research** | "add rules for DOTween", "document how we use Addressables", "figure out best practices for R3" |
| Imperative, specific convention, code examples | **Add Rule** | "add rule: always use `.SetEase(Ease.OutQuad)`", "never use coroutines", "use `NonLazy()` for controllers" |

**Phase C — Detect integration intent (contract-defined):**

If the active module's contract defines integration-gated tiers, detect
`integrationIntent` per the contract's "Integration Intent" section and store it
alongside the classified intent to thread into Branch A / Branch B. The `code`
contract defines this for its `stack` tier (detection signals T1/T2, plus T3
post-fetch in the Research pipeline). Modules with no integration-gated tier skip
this phase and leave `integrationIntent=false`.

### Step 1.5: Registry-first Lookup

**Always try the registry before generating a rule from scratch.** If a matching rule already exists in the remote catalog, the user gets a vetted version by installing it via CLI — much better than spending tokens generating a local copy that duplicates upstream work.

#### 1.5.1: Read CLI contract

Read `.unikit/system/cli-contract.md` to confirm available `unikit-ai rules *` commands and exit codes.

#### 1.5.2: Fetch catalog and installed state

Run two CLI commands (sequential is fine). **Always pass `--module <moduleId>`** —
the router already resolved the active module (Step 0.5), and every machine consumer
sends its `--module` so the CLI returns the stable flat-single form no matter how
many modules the registry carries (no-`--module` `rules list` now defaults to **all
modules** blocked + a flat-all JSON, which this skill does not want):

```bash
unikit-ai rules list --module <moduleId> --json
```
```bash
unikit-ai rules status --module <moduleId> --json
```

`rules list --module <moduleId> --json` returns the flat-single shape
`{ engine, module, rules: [...] }` — parse `catalog.rules` exactly as before (the
scoped form carries **no** per-row `module` key, so the parser is unchanged).
`rules status` **does** accept `--module` (it scopes the reported rows to that
module); pass it so `status.rules[]` is already limited to the active module — no
client-side filtering needed.

Exit code handling:
- `rules list` exit 2 (registry chain unreachable) → skip to Step 2 silently, proceed without registry
- `rules list` exit 1 → **strictly** "no `.unikit.json`" (not a UniKit project) → skip to Step 2. Engine-missing is **no longer** exit 1: a valid project whose engine is absent from the registry now exits **0** with an empty `catalog.rules`, which flows normally into Step 2.
- `rules list` exit 3 (unknown `--module`) → the resolved module id is not registered; report the error and skip to Step 2
- any other non-zero → report the error and skip to Step 2

Parse `rules list --module <moduleId> --json` into `catalog.rules[]` and `rules status --module <moduleId> --json` into `status.rules[]`.

#### 1.5.3: Semantic matching

Match the user's intent against `catalog.rules[]`:

- **Exact id match (case-insensitive):** `"DOTween"` → `dotween`
- **Description match:** `"tweening library"` → `dotween` via the `description` field
- **Synonyms and localized names:** `"контейнер внедрения зависимостей"` → `zenject`

Collect 0..N candidates. If N > 1, treat all as possible matches for the user prompt below.

#### 1.5.4: Join with installed state

For each candidate, look it up in `status.rules[]` by `name` (case-insensitive):
- **Already installed** → note `source`, `version`, and tier so the prompt can show accurate state.
- **Not installed** → candidate is offerable as a fresh install.

#### 1.5.5: Decision tree

```
Match result?
├── Exactly 1 match + already installed
│   → Inform user: "{name} is already installed (source={source}, v{version})"
│   → AskUserQuestion: What should we do?
│   │  Options:
│   │  1. Leave as is         → STOP
│   │  2. Edit manually       → Continue to Step 2
│   │  3. Reinstall from registry → Bash: unikit-ai rules install <id> --force → STOP
│
├── Exactly 1 match + NOT installed
│   → AskUserQuestion: Matching rule "{name}" v{version} found in registry. Install it?
│   │  Options:
│   │  1. Yes, install from registry  → install path (below)
│   │  2. Preview before deciding     → preview path (below)
│   │  3. No, generate a new rule     → Continue to Step 2 (research/manual generation)
│   │
│   ├── install path:
│   │   Bash: unikit-ai rules install <id>
│   │   → Report "✓ Installed <id> from registry" and STOP. The CLI already
│   │     regenerates RULES_INDEX.md — no extra sync needed.
│   │
│   └── preview path:
│       Bash: unikit-ai rules show <id> --module <moduleId> --references
│       (rules show is module-agnostic: a bare id that collides across modules
│        exits 3, so the already-resolved router always scopes with --module)
│       → Show content to user, then AskUserQuestion again:
│         1. Install → install path above
│         2. Generate a new rule → Step 2
│
├── Multiple matches
│   → AskUserQuestion: present all candidates + a "none of these, generate a new rule" option
│   → If user picks a candidate → treat as "exactly 1 match" (installed or not)
│   → If "none" → Continue to Step 2
│
└── Zero matches
    → Continue to Step 2 (research/manual generation)
```

**Key behavior guarantees:**
- Agreeing to install always ends with `rules install <id>` and terminates the skill. The content in the registry is the source of truth; the skill does not second-guess it.
- Declining the registry version always routes to Step 2, where the skill generates the rule from the user's description, URL, or file input as usual. No partial install, no mix of registry + local content.

#### When to skip Step 1.5 entirely

Bypass the lookup completely when any of the following is true:

- **`--skip-registry` flag** was present in $ARGUMENTS (a higher-level caller already queried the catalog and does not want redundant prompts)
- **Intent is VALIDATE INDEX** (Branch D) or **MIGRATE RULES** (Branch C) — neither installs new rules, so registry lookup is irrelevant
- **Input is a file path** — the user explicitly wants to process a specific file, not search the catalog
- **`cli-contract.md` doesn't exist** — the UniKit CLI is not available in this project, so `rules *` commands cannot be used

---

### Step 2: Classify Content Category

Use the **active module's contract** (`references/module-<moduleId>.md` →
"Content Classification") to:

> **`--into` override:** when `--into <file.md>` was supplied (Step 0.5 / Step 1), the
> module, tier, and target file are already fixed from the path — skip the tier and
> filename derivation in steps 1–2 and only run the file-exists check in step 3.

1. **Pick the target tier** for the content among the module's tiers, or determine
   the content belongs to **none** of the module's tiers.
   - If the content fits none of the tiers, redirect the user to the correct
     destination named in the contract's "What Does NOT Belong" section
     (architecture → `.unikit/ARCHITECTURE.md`; project-specific overrides →
     `.unikit/RULES.md` via `unikit-rules`). **Stop here. Do NOT create any files.**
   - If the content fits none of the tiers **and** seems to belong to a *different
     module* than the one resolved in Step 0.5, return to Step 0.5 and re-ask the
     module question rather than forcing a tier.
2. **Identify the target file** within the chosen tier, following the contract's
   filename conventions.
3. **Check whether the file already exists** under `.unikit/memory/<module>/<tier>/`.

### Step 3: Route by Intent

Based on intent (Step 1) and classification (Step 2), follow the appropriate branch:

```
Intent?
├── VALIDATE INDEX → Branch D (inline below; skip Steps 2-3 entirely)
├── MIGRATE RULES  → read references/migrate-rules.md and follow it (skip Step 2)
├── ADD RULE       → Branch A (inline below)
└── RESEARCH       → read references/research-pipeline.md and follow it
```

Branches B (Research) and C (Migrate) are intent-gated and live in dedicated
reference files loaded relative to this skill
(`{{skills_dir}}/{{self_name}}/references/`): open the matching file only when its
intent is selected, then return here for the **Final Step: Confirm**. Branch A and
Branch D stay inline below since they are short and on the common path.

---

## Branch A: Add Rule

The user has a concrete rule to save. No research, no enrichment — just store what the user explicitly stated.

### A.1: Check Target File

```
File exists?
├── YES → A.2 (Cross-Check & Append)
└── NO
    ├── Tier is framework-agnostic (per the module contract, e.g. `code`/core) → A.3 (Create File)
    └── Tier may need research (per the module contract, e.g. `code`/stack)     → A.4 (Ask About Research)
```

### A.2: Cross-Check, Gap List & Append (file exists)

Before appending, compare the new content against existing rules:

1. **Read the target file.**
2. **Read related files** — scan `RULES_INDEX.md` for files with overlapping keywords, then read those too (across all tiers of the module). Also read `.unikit/RULES.md` for project-specific overrides.
3. **Compare each new rule against existing formulations.** A contradiction is when the new content prescribes something different from an existing rule — e.g., "use `await` directly" vs existing "always wrap in `UniTask.Create`", or "bind as Transient" vs existing "bind as Singleton".
4. **Build the gap list (the default for every update).** Classify the new material against what the file already says, and show the result to the user as the summary of what the update will do:
   - **Add** — genuinely new rules not yet present in the file.
   - **Change** — rules that refine or supersede an existing formulation (these are the contradictions resolved below).
   - **Unchanged** — material the file already covers; skip it, do not restate.
   This gap-list discipline is the **canonical cross-check/update behaviour** that `research-pipeline.md` B.4 defers to ("Same logic as A.2"). It runs on every existing-file update regardless of input; a pinned `--into <file.md>` does not change it — `--into` only fixes *which* file is the target.

**If contradictions found:**

- Report **each** contradiction to the user, quoting both the new statement and the existing rule with its source file.
- For each contradiction, ask via `AskUserQuestion` (batch up to 3 contradictions per question):

  Options:
  1. Replace — update existing rule with new formulation
  2. Keep existing — discard the conflicting part
  3. Keep both — document both with a note on when each applies

  Based on choice:
  - Replace → overwrite the existing rule text in the target file with the new formulation
  - Keep existing → discard the conflicting part from the new content, keep existing rule unchanged
  - Keep both → add the new rule alongside the existing one with a note clarifying when each applies

**After resolution (or if no contradictions):**

- Apply the gap list: append the **Add** items and apply the **Change** items, merging into the appropriate sections. Skip **Unchanged** material. Do not overwrite useful existing content.
- → Go to **Final Step: Confirm**

### A.3: Create New File (framework-agnostic tier, no existing file)

1. Create the rule file following the **File Format Template** from the module contract.
2. Write the user's rule(s) as-is — no enrichment, no synthesis.
3. Update `RULES_INDEX.md` — add a new row to the appropriate table in alphabetical order.
4. → Go to **Final Step: Confirm**

### A.4: Ask About Research (research-eligible tier, no existing file)

Ask the user: *"I don't have a rules file for {framework/topic} yet. Would you like me to research this and create a comprehensive document, or just save your rule as-is?"*

```
User answer?
├── YES (research) → read references/research-pipeline.md and follow it (start at B.1)
└── NO (save as-is)
    ├── Create the rule file with user's rule(s) only
    ├── Update RULES_INDEX.md — add to the tier's table
    └── → Go to Final Step: Confirm
```

---

## Branch B: Research

Full research pipeline — gather material, enrich, synthesize, then write into the
active module's tier. The complete workflow (B.1–B.5: gather → integration upgrade →
Context7 → synthesize → reference candidates → cross-check → write) lives in
`{{skills_dir}}/{{self_name}}/references/research-pipeline.md`. Read that file and
follow it, then return here for the **Final Step: Confirm**. All file-format and
scope decisions in it defer to the module contract.

---

## Branch C: Migrate Rules from RULES.md

Transfer mature entries from `.unikit/RULES.md` (the quick-capture staging area owned
by `unikit-rules`) into permanent rule files under `.unikit/memory/<module>/`. The
complete workflow (C.1–C.4: load → classify → present candidates → rephrase → apply)
lives in `{{skills_dir}}/{{self_name}}/references/migrate-rules.md`. Read that file
and follow it, then return here for the **Final Step: Confirm**.

---

## Branch D: Validate Index

Sync `.unikit/memory/<module>/RULES_INDEX.md` with the actual files on disk. No user interaction — fully automatic.

### D.1: Scan Actual Files

1. For each `<tier>` of the resolved module: `Glob: .unikit/memory/<module>/<tier>/*.md` — collect all real rule files in that tier.
2. Read `.unikit/memory/<module>/RULES_INDEX.md` — parse every table (one per tier), extract filenames from each row.

### D.2: Diff

Compare the two sets:

- **Missing from index** — files that exist on disk but have no row in RULES_INDEX.md
- **Phantom in index** — rows in RULES_INDEX.md whose files don't exist on disk

### D.3: Fix Index

**For each missing file** — read the file, extract the `> **Scope**:` and `> **Load when**:` lines from the header. Add a row to the appropriate tier's table in RULES_INDEX.md (alphabetical order), following the contract's "RULES_INDEX.md Format":

```
| {FILENAME}.md | {Scope value} | {Load when value} |
```

If the file has no Scope/Load when header, use the first heading and first paragraph to generate a brief description and keywords.

**For each phantom entry** — remove the row from RULES_INDEX.md using `Edit`.

### D.4: Report

Output a short validation report (in user's configured language):

```
RULES_INDEX.md validation complete.

{per-tier counts, e.g. Core: {N} files, Stack: {M} files}
✅ Added to index: {X}
🔄 Removed from index: {Y}

{If X > 0: list added filenames}
{If Y > 0: list removed filenames}
```

Stop. Do not proceed to any other step.

---

## File Formats

All file-format specifications — the **File Format Template** (rule files, with
`Scope`/`Load when` prose guidance), the **Reference File Format**, the
**Reference Candidate Extraction** strategies, and the **RULES_INDEX.md Format** —
live in the active module's contract:
`{{skills_dir}}/{{self_name}}/references/module-<moduleId>.md`.

Always read the contract for the resolved module and follow its formats exactly.
This router intentionally does not restate them, so a new module can define its own
conventions without touching this file.

## Quality Gate (run before the Final Step)

A cheap, automatic self-check that runs **after a branch finishes writing** and
**before** the Final Step report. It is gated by intent: run it only for **ADD RULE**
(Branch A, including the existing-file update path) and **RESEARCH** (Branch B). **Skip
it entirely** for **MIGRATE RULES** (Branch C), **VALIDATE INDEX** (Branch D — it
already exited and never reaches here), and the Step 1.5 install-from-registry
short-circuit — none of those produce freshly synthesized content to grade (Migrate
rephrases existing entries, Validate only reconciles the index, an install pulls a
vetted upstream file). This is a checklist, not a new approval prompt: run it silently
and only surface a ⚠️ line if a check fails.

**Always check (every gated write — cheap structural checks):**

- The rule file carries a `> **Scope**:` and a `> **Load when**:` line, both written as
  **prose** (not a bare dump of identifiers), per the module contract.
- No placeholder leak — no `{Framework Name}`, `{Section 1}`, `TODO`, or other template
  scaffolding survived into the written file.
- `RULES_INDEX.md` has a row for the file (new files only).

**Additionally — only when the branch actually synthesized content**, i.e. **Branch B
(Research)** or **Branch A → A.4 with research**. Do **not** run these on the as-is
paths (A.2 cross-check-append, A.3 create-as-is, A.4 save-as-is) — those write the
user's exact words with no synthesis, so there is no coverage or distillation to grade:

- **Example coverage (#2)** — the major code-facing topics the rule raises are each
  illustrated by an example (or explicitly waived with a stated reason), per the
  example inventory from `research-pipeline.md` B.3. Many topics raised + only one or
  two examples shown = fail. "Example" means whatever the active module contract
  defines (code snippets for `code`; numeric tables / worked formulas for `gamedesign`).
- **Distilled, not copied (#8)** — no long verbatim source passages; guidance is
  rewritten as actionable rules; any code snippets are original.
- **Source Map (#6)** — when the rule was built from sources, the Source Inventory was
  persisted into the rule file per the module contract's Source Map / provenance format.

If any check fails, fix the written file before the Final Step report (or, when a
coverage gap is intentional, record the reason in the rule). Then continue to the
Final Step.

## Final Step: Confirm

**First, run the Quality Gate above** (ADD RULE / RESEARCH only — skip for Migrate,
Validate, and the install short-circuit), then produce the report below.



**Reconcile `.unikit.json` state with disk (after Branch A / B / C only):**

If the just-completed branch was **Branch A** (Add Rule), **Branch B** (Research), or **Branch C** (Migrate Rules) — i.e. anything that wrote a new or updated rule file into `.unikit/memory/<module>/` — run the CLI sync command so the generated file is registered in `.unikit.json.rules.installed` and `RULES_INDEX.md` is regenerated from authoritative state + disk:

```bash
unikit-ai rules sync
```

Why this matters: Branches A/B/C write files via `Write`/`Edit` directly and never touch `.unikit.json`. Without a sync pass, the new rule lives on disk but remains invisible to `rules status`, `rules install <id> --force`, and — most importantly — to `/unikit` Step 9.3, which builds its "already installed" set from `.unikit.json` state. Skipping sync here means the next `/unikit` run can try to reinstall the same rule from the registry and fail with exit 4 ("already installed"). `syncRulesState` Phase 1 picks up untracked `.unikit/memory/**/*.md` files and registers them as `source: local` entries; Phase 3 regenerates `RULES_INDEX.md`. That is exactly the reconciliation the skill needs before printing the report.

Treat a non-zero exit code as non-fatal for the skill: log the CLI output to the report and continue. The file is still on disk — the user can re-run `unikit-ai rules sync` manually.

**Skip the sync entirely when:**
- The branch was **Branch D** (Validate Index) — Branch D already exited with `Stop. Do not proceed to any other step.` and never reaches this Final Step at all.
- An install-from-registry short-circuit ran in Step 1.5 — `rules install` already updated state and regenerated the index, and the short-circuit terminates the skill before reaching Final Step.

**Report to the user (in their configured language):**
- Which module was targeted and which file was created or updated
- Summary of what was added
- Which branch was used (Add Rule / Research)
- Whether Context7 enrichment was applied (Research branch only)
- Whether `.unikit.json` state was reconciled via `rules sync` (and whether the index was regenerated)
- Whether RULES_INDEX.md was updated
- If any content was redirected elsewhere (architecture, RULES.md)

**Offer rules-registry promotion (after Branch A / B / C only):**

If the just-completed branch was **Branch A** (Add Rule), **Branch B** (Research), or **Branch C** (Migrate Rules) — i.e. anything that actually wrote into `.unikit/memory/<module>/` — check whether the project's registry is local:

```bash
unikit-ai rules registry show --json
```

Parse the JSON. If `.kind == "local"`, ask the user whether to promote the memory changes into the registry **now** via `AskUserQuestion`:

```
AskUserQuestion: A local rules registry is configured at <.url from the JSON>.
Promote the memory changes into the registry now by running /unikit-rules-registry update?

Options:
1. Yes — run /unikit-rules-registry update after the Final Step report
2. No  — skip promotion, keep the changes in memory only
```

- **Yes** → finish the Final Step report first (the user must see exactly what changed in memory before promotion), then transition to `/unikit-rules-registry update` as the next action. Do not collapse the memory report into the promotion run — they are separate, ordered events.
- **No** → finish the Final Step report without adding any promotion hint. The user can always run `/unikit-rules-registry update` manually later; do not repeat the question or nag on the next invocation.

Skip the question entirely (do not ask, do not print a fallback hint) when:
- The branch was **Branch D** (Validate Index) — no memory writes happened.
- An install-from-registry short-circuit ran in Step 1.5 — the registry is already the source of truth for that rule.
- `rules registry show --json` returned a non-zero exit code or `.kind` is not `"local"`.

## Access Rules

**Writable** (this skill can create and edit, for the resolved module):
- `.unikit/memory/<module>/<tier>/` — rule files in each of the module's tiers
- `.unikit/memory/<module>/<tier>/references/` — supplementary reference docs, where the module contract allows them
- `.unikit/memory/<module>/RULES_INDEX.md` — index of all rule files in the module

**Writable only during Branch C (Migrate Rules):**
- `.unikit/RULES.md` — removal of migrated entries only; adding new entries goes through `unikit-rules` skill

**Read-only** (this skill must NEVER modify these files):
- `.unikit/config.yaml` — project settings (language). Read-only for this skill.
- `.unikit/system/modules.yml` — module registry snapshot. Generated by `unikit-ai`; read-only here.
- `{{skills_dir}}/{{self_name}}/references/module-<id>.md` — module contracts. Read-only here.
