---
name: unikit-architecture
description: >-
  Generate, update or reorganize the architecture guidelines of a game project. Scans the
  project structure and tech stack, then writes .unikit/ARCHITECTURE.md — a root with the
  module map and the global dependency rules — and, when the file grows, topic files in
  .unikit/architecture/ that agents load only when the work matches them. Modes: generate
  (no file yet), update (rescan and add what is missing, removing nothing), optimise (split
  a large file into a root and topics), chosen by a keyword or from the request in plain
  words. Name a specific pattern or let it auto-detect. Use when the user wants to define,
  document, update or slim down the project architecture, e.g. "generate architecture",
  "update the architecture document", "the architecture file is too big", "split
  ARCHITECTURE.md", or mentions module structure, module boundaries, project organization,
  or dependency rules.
argument-hint: "[update [text] | optimise | generate | a request in plain words | architecture pattern name | empty to follow the state of the file]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(mkdir *)
  - Bash(ls *)
  - Bash(find *)
  - AskUserQuestion
  - Bash(rm .unikit/architecture/*)
  - Bash(node *)
version: "3.0"
---

# Architecture — Generate Project Architecture Guidelines

Generate `.unikit/ARCHITECTURE.md` with architecture decisions tailored to the game project.

**User questions.** Right before your first question to the user, not earlier, read `.unikit/system/user-questions.md` once and ask every question as it says, with the question tool of your agent (`AskUserQuestion`). If the file cannot be read, print `WARN [questions] user-questions contract missing — asking with the question tool` and still ask with that tool, the recommended option first.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

**The language holds for the whole session, not just at load time:** every message until the conversation ends is in `language.ui` — progress notes while agents run, relays of what a subagent returned, the final report, any follow-up discussion. English input (subagent results, tool output, these instructions) is data, never a cue to switch languages.

## Layout of the architecture files

`.unikit/ARCHITECTURE.md` is the **root**, and the only file every reader opens. It takes one of two shapes.

**Flat** — every file until its first topic appears, and every older project: the sections of the Step 4 template, no `## Topics`. A reader takes the whole file.

**Topics** — the root holds what every task needs, topic files hold one area each:

```markdown
# Architecture: <Pattern Name>

> This file is the root: when it has a `## Topics` table, its sections apply to every task, and a topic file in `.unikit/architecture/` applies when the work matches its "Load when" — check again when the work moves to a new phase or area, and when unsure, load it.

## Project
## Tech Stack
…the other sections of the Step 4 template, cut down to the map…

## Topics

| Topic | Load when |
|-------|-----------|
| [<Title>](architecture/<slug>.md) | <what a task mentions: folders, assemblies, types, frameworks, areas> |

## Detailed Rules
```

- **What stays in the root:** `## Project`, `## Tech Stack`, `## Documentation Sources`, a short `## Architecture Overview`, the module map in `## Folder Structure` (one line per module), `## Dependency Rules` with the **global** edges and prohibitions, `## Cross-Module Communication` with the common patterns, `## Key Principles`, the global `## Anti-Patterns`, `## Topics`, `## Detailed Rules`. The section names of the template stay: other tools read them by name.
- **A topic file** is `.unikit/architecture/<slug>.md`: `# Architecture — <Title>`, a blank line, then `## ` sections that carry the whole area — its edges and prohibitions, its contracts (a table), the narrative of its mechanisms. No `Load when` inside it, no `## Topics`.
- **A table row** is `| [<Title>](architecture/<slug>.md) | <Load when> |`. The slug is English kebab-case, one to three words, unique. `Load when` has no `|`. **`Load when` lives only in the root table.** Topics are cut by **area** (a subsystem, a module, a framework seam), never by kind of text.
- **`## Topics` and its table exist together or not at all**; the section stands directly above `## Detailed Rules` (last when there is none). The header quote under the title is written whenever the root has a table and removed when it has none.
- **Where a prohibition lives.** One that touches more than one area stays in the root (`## Dependency Rules`, `## Anti-Patterns`); one that touches a single area may live in its topic. When unsure, the root.
- **Priority.** The root and its topics are one level (number 2 of `RULES_INDEX.md`). Inside its own area a topic wins over a root section it contradicts.
- **The `flat` marker** is the line `<!-- unikit:architecture-layout flat -->`, directly under the root's `# Architecture:` line. It records the user's refusal of the topic layout and means nothing to readers. There is no marker for the topic layout: the `## Topics` table is the sign.
- **Anchors** — `## Topics`, the header row `| Topic | Load when |`, the marker, the slugs, the `# Architecture — ` prefix and the header quote — are English, and so is the rest of the document and of every topic file: architecture documentation always stays in English (LANGUAGE_RULES).
- **Not to be confused:** `.unikit/architecture/` holds these topic files; `.unikit/code/architecture/` holds maps a user's own skills may write. This skill reads and writes only the first.

## Modes

The mode comes from the user's request together with the state of the file (below), in this order: **(1) an explicit parameter, (2) the intent of free text, (3) the state.** Both ways stay: the parameter is the stable, deterministic interface (other skills and scripts rely on it — `unikit-rules` prune hands a block over as `update <block>`), free text is for people. **The request** is `$ARGUMENTS`; when that is empty or only a pattern name, it is the message that started this run, which is how the mode is found when the skill was picked by its description with no arguments. Free text may be in any language: read its intent, do not match words, so "the architecture file is too big", "slim it down" and `optimise` all mean the same thing. **Announce the mode first:** the announcement is the run's very first output, before Step 0 (a clarifying question, when rule 3 or 4 below needs one, comes first and the announcement follows the answer); mode names stay English, the sentence is in `language.ui`.

```
1. Parameter — checked first, never interpreted:
   ├── the whole argument is `optimise` / `optimize` (any letter case)  → Mode C
   ├── the first word is `update` (the rest of the line is read as the request, see rule 1)  → Mode B
   └── the whole argument is `generate`  → Mode A
2. Otherwise the intent of the request, free text in any language:
   ├── reorganize, optimise, slim down, shorten, split into topics, "the file is too big"  → Mode C: reorganize into a root and topics
   ├── update, refresh, bring in line with the code, add what is missing, record this fact or block  → Mode B: update
   └── generate, create, write, set up the architecture document  → Mode A: generate
3. No parameter and no intent (an empty request, a pattern name, a question about the architecture)
   → by the state of .unikit/ARCHITECTURE.md: `empty` → Mode A, any other → Mode B — a pattern name is a hint, never an order to regenerate
```

**Rules of the intent.**
1. A request that carries a fact or a block to record ("module X may not depend on Y", or the text `unikit-rules` hands over) is Mode B whether it came as `update <block>` or as free text, and that text is the block (`mode-update.md`, U.4); the text after the word `update` that only describes the wish ("the architecture, we added a module") is a request, not a block.
2. Two intents in one request run in the order given — Mode B before Mode C when both are named, because Mode C restructures what Mode B just wrote.
3. A request that reads as update or as reorganize ("tidy up the architecture") is asked once, with the question tool of your agent (`AskUserQuestion`): `Update` (recommended) / `Reorganize into topics`. It is never guessed.
4. A generate intent — or the `generate` parameter — on a file that has content is asked once, with the same tool: `Update instead` (recommended) / `Rewrite from scratch`. Rewriting replaces what is written — the only path of this skill that removes anything — and it runs only on that answer.
5. `update` on an `empty` file prints `INFO [architecture] update: no file — generating` and runs Mode A; `optimise` on an `empty` file prints `INFO [architecture] optimise: no architecture document — nothing to do` and stops.
6. Whatever the wording or the parameter, Mode C writes nothing before the user confirms its preview.

| Mode | Announcement | Runs |
|------|--------------|------|
| A: generate | `generate: I'll scan the project and write .unikit/ARCHITECTURE.md.` | Steps 0–6 below |
| B: update | `update: I'll rescan the project and add what is missing to .unikit/ARCHITECTURE.md; nothing already written is removed.` | Steps 0–2, then read `{{skills_dir}}/{{self_name}}/references/mode-update.md` and follow it; Steps 3–4 do not run |
| C: optimise | `optimise: I'll sort .unikit/ARCHITECTURE.md into a root and topic files and show you the proposed layout before writing anything.` | read `{{skills_dir}}/{{self_name}}/references/mode-optimise.md` and follow it; Steps 0–4 and 6 do not run, Step 5 (the `AGENTS.md` row) runs when that file says so |

**The state** is decided by the file's content, checked in this order, the first match wins:

| State | Sign |
|-------|------|
| `topics` | a line `## Topics` followed by the table header row `Topic` / `Load when` |
| `flat` | the marker line |
| `empty` | no file, or a file without a single line that starts with `## ` |
| `legacy` | anything else: content, but neither the table nor the marker |

Drift is reported, never fixed silently: a row whose file is missing → `WARN [architecture] topic table: <slug> is listed, .unikit/architecture/<slug>.md does not exist`; a file in `.unikit/architecture/` no row lists → `WARN [architecture] topic table: .unikit/architecture/<file> is not listed under ## Topics — no reader loads it`; marker and table together → `WARN [architecture] layout: flat marker ignored — the file already has a ## Topics table`. A `flat` file is never offered the reorganization again; only `optimise` reorganizes it, and removes the marker when it does.

## Workflow

Determine the mode first (`## Modes`) and print its announcement as the run's first output; Steps 0–2 are shared.

### Step 0: Load Engine Rules

Read `{{skills_dir}}/{{self_name}}/references/ENGINE_RULES.md`. This file is installed by `unikit-ai init`
based on the user's engine choice and contains engine-specific paths, scan targets, framework lists,
and pattern indicators. Use it for all engine-specific details in subsequent steps.

If the file is missing, inform the user: "Engine rules not found. Please run `unikit-ai init` to configure your project."

### Step 1: Load Existing Context

**Read `.unikit/DESCRIPTION.md`** if it exists — project specification, tech stack, constraints.
This gives you the baseline understanding of what technologies are in play before scanning.

**Read `.unikit/memory/code/RULES_INDEX.md`** if it exists — it contains the index of framework-specific
rule files that the project already uses. This tells you which frameworks and patterns are in play.
Do NOT read the individual rule files — only the index to understand what's covered.

**Read `.unikit/RULES.md`** if it exists — naming conventions, class structure, DI rules. **Rule topics:** its `## Topics` table names the topic files in `.unikit/rules/`; open one only when the architecture work at hand touches its `Load when`.
Extract key conventions but do NOT duplicate them into ARCHITECTURE.md — reference the file instead.

**Read the root `.unikit/ARCHITECTURE.md`** if it exists — its state (see `## Modes`) decides the mode. **Architecture topics:** open a topic file only when the work at hand places or checks a fact in its area (Mode B), or when `optimise` reads them all.

**Read `.unikit/skill-context/unikit-architecture/SKILL.md`** if it exists — project-specific rules accumulated by `/unikit-evolve`. Treat as overrides: skill-context wins over general rules on conflict.

<!-- unikit:extension-point:bootstrap -->

### Step 2: Scan the Project

Scan the project to discover the actual tech stack. This is the most important step —
architecture documentation must reflect reality, not assumptions.

Use `ENGINE_RULES.md` file (loaded in Step 0) to determine:
- Which directories to scan and what to look for in each
- Which file extensions indicate project scripts
- How to discover module boundaries (assembly definitions, build files, folder conventions)
- Which DI/IoC frameworks to look for
- Which architectural pattern indicators to check

#### 2.1 Scan Directories

Scan the directories listed in `ENGINE_RULES.md` under "Scan Targets".
For each discovered directory, run `ls` to get subfolder names — this reveals the real building blocks.

#### 2.2 Scan Module Boundaries

Find module boundary definition files as specified in `ENGINE_RULES.md` (e.g., assembly definitions,
build files, or folder-based conventions). Read a representative sample to understand:
- Module boundaries and namespace conventions
- Dependency directions between modules
- Which modules reference which frameworks

#### 2.3 Detect DI/IoC Framework

Look for DI framework indicators listed in `ENGINE_RULES.md`.
Not all engines have standard DI — if none is detected, note "manual DI or none".

#### 2.4 Detect Key Patterns

Look for architectural pattern indicators. These patterns are largely engine-agnostic:

- Files with `View`, `ViewModel`, `Presenter`, `Model` suffixes — reveals MV* pattern
- `Controller` suffixes — may indicate MVC or GRASP controllers
- Folders named `ECS`, `Systems`, `Components`, `Entities` — may indicate ECS
- `SignalBus`, `EventBus`, `MessageBus` — event system
- `SaveSerializer`, `SaveData`, `SaveManager` — save system pattern
- DI installer/module files — as specified in `ENGINE_RULES.md`

### Step 3: Ask About Architecture (if needed)

Mode A only. In Mode B a named pattern is a hint for the rescan, nothing more.

**If `$ARGUMENTS` specifies an architecture pattern** (e.g., `/unikit-architecture modular-monolith`):
- Use that pattern directly, skip to Step 4

**If the project already has code and patterns are detectable from Step 2:**
- Summarize what you found and confirm with the user

**If the project is new or patterns are unclear**, print the message below as plain markdown first, then ask its last question with the question tool of your agent (`AskUserQuestion`): the options are the pattern the scan and the Quick Decision Guide point to (recommended), one or two other likely patterns from the list, and `Document what I found as-is`; the user writes any other pattern or a combination in the free-text answer:

```
Based on the project scan, I found:
- [discovered modules/frameworks/patterns]

Which architectural patterns do you plan to use?

Common game architecture patterns:
1. Modular Monolith — independent modules with enforced boundaries, single deployment
2. Feature-based — code organized by feature (Player/, Inventory/, Combat/)
3. Layered — horizontal layers (Domain → Application → Presentation)
4. MVC / MVP / MVVM — Model-View separation (specify which variant)
5. ECS — Entity Component System for data-oriented design
6. Component-based — engine's native component architecture without extra layers

You can combine patterns (e.g., "Modular Monolith + MVVM for UI").
```

### Step 4: Generate .unikit/ARCHITECTURE.md

```bash
mkdir -p .unikit
```

Generate `.unikit/ARCHITECTURE.md` using the template below. Every section must be adapted
to what was actually discovered in Step 2 — never use placeholder or generic content.

---

**ARCHITECTURE.md Template:**

```markdown
# Architecture: [Pattern Name]

## Project

[1 sentence: what this project is, target platforms]

## Tech Stack

| Category | Technology |
|----------|-----------|
| Engine | [engine name + version / primary language / render pipeline] |
| DI | [DI framework name or "None"] |
| [category] | [technology] |
...

Include only technologies actually found during scanning. Each row must correspond
to a real framework, module, or asset discovered in the project.

## Documentation Sources

When you need up-to-date API docs for these libraries:

[List each major library with its documentation lookup method.
If context7 MCP is available, specify "use context7" with the search query.
If docs are bundled locally, point to the path.]

## Architecture Overview

[2-3 paragraphs explaining the chosen architecture pattern and why it fits this project.
If the pattern was detected from existing code, describe what you found.
If it was chosen by the user, explain the rationale.]

## Folder Structure

```
[Project root]/
├── [scripts directory]/    [describe organization principle]
│   ├── [folder]/           [purpose]
│   └── ...
├── [modules directory]/    [describe module boundaries]
│   ├── [Module1]/          [purpose]
│   └── ...
├── [plugins directory]/    [third-party frameworks]
└── [assets directory]/     [store assets]
```

Describe the actual folder structure found in the project, not an ideal one.

## Dependency Rules

[What depends on what. Use the actual module/folder names from the project.]

- ✅ [allowed dependency direction with real names]
- ❌ [forbidden dependency direction with real names]

## Module Boundary Strategy

[Describe how the project partitions the codebase into modules. Include:
- What mechanism enforces boundaries (assembly definitions, build files, folder conventions)
- Naming convention for modules
- How modules expose their public API
- Test module conventions]

## Cross-Module Communication

[How modules communicate. Describe ONLY patterns that actually exist in the project.
Common patterns: DI interfaces, event/signal bus, reactive properties, direct references.
For each pattern, specify which module or framework provides it.]

## Key Principles

[3-5 principles derived from the project's actual conventions. Examples:]
1. [Principle from the codebase]
2. ...

## Anti-Patterns

- ❌ [What NOT to do — derived from actual project conventions]
- ❌ ...

## Detailed Rules

For framework-specific rules, coding conventions, and implementation details see:

- **`.unikit/RULES.md`** — [brief description of what's there; when it has a `## Topics` table, name its topic files in `.unikit/rules/`]
- **`.unikit/memory/code/RULES_INDEX.md`** — index of all framework-specific rule files
- **`.unikit/architecture/`** — topic files, listed in `## Topics` (only when the file has topics)
```

---

**Rules for generation:**

- Every technology, module, and pattern mentioned must have been found during scanning
- Use code examples in the project's primary language that match the project's actual style
- Folder structure must extend what already exists, not replace it
- If custom modules were found (SignalBus, EventBus, SaveSystem, etc.), document their role
  in the architecture explicitly — they are first-class architectural elements
- The "Detailed Rules" section MUST reference `.unikit/memory/code/RULES_INDEX.md` — that file
  is the single source of truth for which rule files exist and when to load them
- Do NOT duplicate content from RULES.md or memory/code/RULES_INDEX.md —
  reference them and describe what each contains in one line
- **Topics at generation.** Write one root. A subsystem for which the scan found more than one table row of structure — its own edges and prohibitions, a contract catalogue, or a mechanism that needs a paragraph — becomes a topic file (shape: `## Layout of the architecture files`) listed in `## Topics`; everything that fits one line stays in the root. A project with no such subsystem gets the flat shape: no `## Topics`, no header quote.
- Keep the root concise — it's a map, not a manual. What explains how one area works lives in that area's topic file, or in `docs/`, not in the root.

### Step 5: Update AGENTS.md

If `AGENTS.md` exists in the project root, add or update the `.unikit/ARCHITECTURE.md` entry
in the "AI Context Files" table (or equivalent section):

```
| .unikit/ARCHITECTURE.md | Architecture decisions and guidelines |
```

When the file has topics, the row reads `| .unikit/ARCHITECTURE.md | Architecture decisions and guidelines; topic files in .unikit/architecture/ load when their "Load when" matches |`. Modes B and C run this step too whenever the file has topics when they finish, or has just lost its last one: the row is checked every time, so a regenerated `AGENTS.md` gets the topic note back.

If the entry already exists, verify it's accurate. If `AGENTS.md` doesn't exist, skip this step silently.

### Step 6: Confirm

```
✅ Architecture document generated!

Engine: [detected engine]
Pattern: [chosen pattern]
File: .unikit/ARCHITECTURE.md
Topics: [N topic files in .unikit/architecture/ | none — flat]

Discovered:
- [N] modules in [modules directory]
- [N] plugins/addons in [plugins directory]
- [N] third-party assets/packages
- [N] module boundary definitions

Key architectural decisions:
- [decision 1]
- [decision 2]
- [decision 3]

The document references .unikit/memory/code/RULES_INDEX.md for detailed framework rules
and .unikit/RULES.md for coding conventions.
```

## Knowledge Base

Reference material for architecture evaluation. This content informs recommendations —
it is NOT output directly.

### Architecture Decision Matrix

| Factor | Component-Based | Layered | Feature-Based | Modular Monolith | MVC/MVP/MVVM | ECS |
|--------|----------------|---------|---------------|-------------------|--------------|-----|
| Project size | Small | Small-Medium | Medium-Large | Medium-Large | Any with UI | Performance-critical |
| Team size | 1-3 | 1-5 | 3-15 | 5-20 | Any | 3-15 |
| Domain complexity | Low | Low-Medium | Medium-High | High | Medium (UI-focused) | Low-Medium |
| Code reuse across projects | Low | Low | Medium | High | Medium | High |
| Initial velocity | ✅ Fast | ✅ Fast | Medium | Medium | Medium | ❌ Slow |
| Refactoring cost | ❌ High | Medium | Medium | ✅ Low | Medium | Medium |

### Quick Decision Guide

```
Game jam / prototype? → Component-based (engine-native)
Simple mobile game, solo dev? → Layered or Feature-based
Medium project, clear features? → Feature-based
Multiple reusable systems across projects? → Modular Monolith
UI-heavy game (simulator, strategy, RPG)? → Modular Monolith + MVVM/MVP for UI
Performance-critical (thousands of entities)? → ECS
Unclear yet? → Start with Feature-based, refactor when patterns emerge
```

### Pattern Details

#### Component-Based (Engine-Native)
The default architecture of most game engines — entities composed of reusable components.
Good for small projects and prototypes. Scales poorly without additional structure.
See `ENGINE_RULES.md` for the specific component model.

#### Layered Architecture
Horizontal layers: Presentation (Views, UI) → Logic (Services, Controllers) → Data (Models, Persistence).
Each layer depends only on the layer below. Simple but can lead to "god service" classes.

#### Feature-Based Organization
Code organized by game feature: `Player/`, `Inventory/`, `Combat/`, `UI/`.
Each feature folder contains all its scripts. Good balance of simplicity and organization.

#### Modular Monolith
Independent modules with enforced boundaries. Each module has its own namespace, tests, and public API.
Modules communicate through interfaces and DI. High reusability across projects.
Works best when combined with a DI/IoC framework.
See `ENGINE_RULES.md` for how module boundaries are enforced in each engine.

**Typical module structure:**
```
Modules/
├── ModuleName/
│   ├── Scripts/        (or src/, Source/)
│   │   ├── Public/     # Interfaces, DTOs exposed to other modules
│   │   └── Internal/   # Implementation details
│   ├── Tests/
│   └── [boundary file] # .asmdef, BUILD, module.json, etc.
```

#### MVC / MVP / MVVM
Model-View separation patterns. Choose based on UI complexity:
- **MVC** — Controller mediates between Model and View. Simplest, good for basic UI.
- **MVP** — Presenter replaces Controller, owns View reference. Better testability.
- **MVVM** — ViewModel exposes bindable properties, View subscribes. Best for data-driven UI.
  Requires a binding framework — see `ENGINE_RULES.md` for available options.

These patterns typically apply to the UI/presentation layer and combine with another
pattern for overall project organization.

#### ECS (Entity Component System)
Data-oriented design: Components are pure data, Systems process components in bulk.
Maximum performance through cache-friendly memory layout.
Steep learning curve, best for specific performance-critical scenarios.
See `ENGINE_RULES.md` for engine-specific ECS implementations.

### Module Boundary Best Practices

- Each module gets its own boundary definition — this enforces dependency rules at compile/build time
- Test modules reference the module they test + test framework
- Avoid circular dependencies — if two modules need each other, extract a shared interface module
- Root project code can reference all modules, but modules should not reference project code
- Use visibility modifiers to control what's accessible outside the module

See `ENGINE_RULES.md` for engine-specific mechanisms.

### Scene / Level Architecture Patterns

- **Single scene/level** — everything in one scene, simplest approach
- **Bootstrap + Gameplay** — bootstrap scene initializes core systems, loads gameplay scene
- **Additive/streaming** — multiple scenes loaded together, each owning a part of the world
- Scene/level loading orchestrated by an asset management system

### Cross-Module Communication Patterns

These are common patterns found in game projects. Document whichever ones exist:

| Pattern | Mechanism | When to use |
|---------|-----------|-------------|
| DI Interfaces | Module exposes interface, consumer gets it via DI | Direct dependencies between modules |
| Event/Signal Bus | Fire-and-forget events (signal/event structs) | Decoupled communication, no direct dependency |
| Reactive Properties | Observable state (reactive streams/properties) | State observation, View ← Model binding |
| Engine-Native Events | Engine's built-in event/signal system | Designer-friendly, scene-independent events |
| Static Events | Language-level static events/delegates | Simple, but hard to test and creates hidden coupling |

See `ENGINE_RULES.md` for engine-specific communication mechanisms.
