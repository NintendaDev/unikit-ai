[← Subagents](subagents.md) · [Back to README](../README.md) · [Game-Design Module →](gamedesign.md)

# Plan Files

UniKit AI uses markdown files to track implementation plans, self-improvement patches, and skill overrides.

## Plan Structure

Plans are stored in two locations depending on mode:

| Source | Plan Location | Contents |
|--------|--------------|----------|
| `/unikit-plan fast` | `.unikit/code/PLAN.md` | Single flat file: overview, settings, checklist, commit plan, and `## Technical Context` inline |
| `/unikit-plan full` | `.unikit/code/plans/{YYYY-MM-DD}_{feature-name}/` | `TASKS.md` + `PLAN-BRIEF.md` |
| `/unikit-plan add` | Existing plan location | Modifies existing plan in-place |
| `/unikit-fix` (plan mode) | `.unikit/code/FIX_PLAN.md` | Single file with analysis + fix steps |

### TASKS.md - Task Checklist

Dependency-ordered checklist with WHY context, effort estimates, and file paths:

```markdown
# Tasks: Item Rarity System

Created: 2026-03-15
Branch: feature/item-rarity

## Settings
- Testing: no
- Docs: no
- Visual regression: no
- Editor tasks: mcp

## Commit Plan
- **Commit 1** (tasks 1-3): "feat(items): add rarity enum and data model"
- **Commit 2** (tasks 4-6): "feat(items): implement rarity visual effects"

## Phase 1: Data Model

### Task 1: Create RarityType enum
**WHY:** Need a typed rarity classification before any visual or gameplay logic
**Effort:** S
**Files:** `<content-root>/Gameplay/Core/Items/RarityType.<ext>`
- [ ] Create enum: Common, Uncommon, Rare, Epic, Legendary
- [ ] Add the serialization attribute for inspector support

### Task 2: Add rarity field to ItemDefinition
**WHY:** Items need a rarity property for filtering and display
**Effort:** S
**Files:** `<content-root>/Inventory/ItemDefinition.<ext>`
- [ ] Add a serialized rarity field
- [ ] Add public RarityType Rarity property

### Task 3: Tint the rarity badge in the item widget
**WHY:** The rarity has to be readable at a glance in the inventory grid
**Effort:** S
**Files:** `<content-root>/UI/ItemWidget.<ext>`
**Editor:** `[ui] ItemWidget → RarityBadge : bind tint to Rarity`
- [ ] Add the badge colour lookup
```

`<content-root>` and `<ext>` are engine placeholders — see [Editor tasks](#editor-tasks) below.

### PLAN-BRIEF.md - Technical Context (full mode)

Technical context that doesn't belong in the task checklist. Always created in full mode - even when a research's `RESEARCH_BRIEF.md` exists, the plan generates its own brief based on the current codebase state. The research brief is used as input, not a replacement.

In fast mode, this content is included inline as `## Technical Context` inside `PLAN.md`.

```markdown
# Plan Brief: Item Rarity System

## Constraints
- Must work with the project's existing inventory package
- Rarity colors must be configurable as a data asset

## Interfaces
- IItemView already has SetData() - extend, don't replace
- Existing ItemDefinition is in the inventory module

## EDITOR TARGETS
| Kind | Container | Target | Change |
|------|-----------|--------|--------|
| ui | ItemWidget | RarityBadge | bind tint to Rarity |

## Patterns to Follow
- Use the project's DI container, not service locators
- Visual effects via the project's tweening library, not the animator
```

`## EDITOR TARGETS` aggregates every `Editor:` line in the checklist. It is omitted entirely when a plan has no editor work, and `/unikit-improve` keeps it in sync when it adds or removes tasks.

## Editor tasks

Most tasks change source files. Some change the **serialized state of the engine editor** — a scene, a prefab, a UI document, a material, an animation clip, a project setting. Those cannot be expressed as a file edit, so they get an `Editor:` line in addition to (or instead of) `Files:`:

```
Editor: [kind] <container> → <target> : <action>
```

`kind` is one of six: `scene` · `ui` · `vfx` · `anim` · `asset` · `settings` (default `scene`). One line per target; the field is omitted for pure code tasks. Input is not a kind of its own — an input-map asset is an `asset`, a legacy input axis is `settings`, and the handling code stays in `Files:`.

The naming of `<container>` and `<target>` is engine-specific and comes from the planning vocabulary described below — which is also where the `<content-root>`, `<ext>` and code-fence placeholders in the templates resolve.

### The two settings

| Setting | Written by | Read by |
|---------|-----------|---------|
| `Editor tasks: mcp \| manual \| direct` | `/unikit-plan` | `/unikit-implement` |
| `Visual regression: yes/no` (default `no`) | `/unikit-plan` | **both** — `/unikit-implement` takes the baseline before the change and compares after; `/unikit-verify` gates the result |

`Editor tasks` decides how the editor work is actually carried out:

- **`mcp`** — through the engine MCP server. Chosen **silently** when an engine MCP is configured; you are not asked.
- **`manual`** — nothing is touched. The task is marked `⏸️ MANUAL` and you get the exact instruction in `[kind] container → target : action` form. `/unikit-verify` reports these but never treats them as blockers.
- **`direct`** — the serialized file is edited as text. Offered **only** where the engine's format tolerates it, and `/unikit-implement` always commits to git first.

When no engine MCP is configured, `/unikit-plan` asks which of `manual` / `direct` you want.

### Actual coverage per engine MCP server

`Editor tasks: mcp` is not universally available — it depends on which server your project has configured:

| Server | Engine | Editor authoring |
|--------|--------|------------------|
| Unity Biome MCP | Unity | ✅ full — the strongest of the six |
| Coplay Unity MCP | Unity | ✅ most kinds; no Input System, no Timeline, no Shader Graph |
| Fennara Godot MCP | Godot | ✅ full, via GDScript worker scripts |
| GDAI Godot MCP | Godot | ❌ none — degrades to `manual` |
| Coding-Solo Godot MCP | Godot | ❌ none declared — degrades to `manual` |
| ChiR24 Unreal MCP | Unreal Engine 5 | ✅ full, through the single `unreal` tool |

A server that declares no per-kind tool table degrades to `manual` and says so, rather than guessing tool names.

Visual regression is narrower still: only **Unity Biome** implements it. The other five lift that gate, and `/unikit-verify` reports it as `gate lifted` with the reason quoted from the server's profile — not as a failure.

### `<ENGINE>_RULES.md` — the planning vocabulary

Each engine can ship a planning vocabulary that `/unikit-plan` loads at bootstrap:

- **Source:** `data/engine-templates/skills/unikit-plan/<ENGINE>_RULES.md`
- **Installed to:** `<agent-skills-dir>/unikit-plan/references/ENGINE_RULES.md`

It carries six sections: kind → engine concept, language & layout placeholders, when a change counts as editor state, engine planning pitfalls, the scope boundary, and direct-edit feasibility.

The boundary against the rules registry is exact: **the registry says HOW to write code for the engine; this file says HOW to write a plan for it.**

**Current coverage: Unity only.** On Godot and Unreal Engine 5 no vocabulary ships yet, so `/unikit-plan` generates no `Editor:` fields at all, omits the `Editor tasks` setting, and tells you so at confirmation: `Engine rules: ENGINE_RULES.md not found, Editor: fields skipped`. That is a normal path, not an error.

## Plan Discovery

`/unikit-implement` finds plans in this order:
1. **Fast plan** → `.unikit/code/PLAN.md` (if exists, used directly)
2. **Git branch match** → `.unikit/code/plans/` directory matching current `feature/*` branch name
3. **Latest by date** → most recent `{YYYY-MM-DD}_{name}/` directory (lexicographic sort)
4. **Fix plan fallback** → `.unikit/code/FIX_PLAN.md` → redirects to `/unikit-fix`

If both `.unikit/code/PLAN.md` and a matching folder plan exist, the user is asked which one to use.

## Artifact Ownership

To avoid ownership conflicts, artifact writers are command-scoped:

| Artifact | Primary owner | Notes |
|----------|--------------|-------|
| `.unikit/code/PLAN.md` | `/unikit-plan` | Fast-mode plan (temporary, single file) |
| `.unikit/DESCRIPTION.md` | `/unikit` | Project specification |
| `.unikit/ARCHITECTURE.md` | `/unikit-architecture` | Architecture guidelines |
| `.unikit/ROADMAP.md` | `/unikit-roadmap` | Milestone tracking |
| `.unikit/RULES.md` | `/unikit-rules` | Convention source of truth |
| `.unikit/code/plans/*/TASKS.md` | `/unikit-plan` | `/unikit-improve` refines existing |
| `.unikit/code/plans/*/PLAN-BRIEF.md` | `/unikit-plan` | Always created; research used as input, not replacement |
| `.unikit/code/FIX_PLAN.md` | `/unikit-fix` | Bug-fix analysis and steps |
| `.unikit/code/patches/*.md` | `/unikit-fix` | Self-improvement patches |
| `.unikit/skill-context/*` | `/unikit-evolve` | Project-specific skill overrides |
| `.unikit/evolutions/*` | `/unikit-evolve` | Evolution logs + patch cursor |

Quality commands (`/unikit-commit`, `/unikit-review`, `/unikit-verify`) treat these files as read-only context by default.

## Self-Improvement Patches

UniKit AI has a built-in learning loop. Every bug fix creates a **patch** - a structured knowledge artifact that helps AI avoid the same mistakes in the future.

```
/unikit-fix → finds bug → fixes it → creates patch → /unikit-evolve distills patches into rules → smarter future runs
```

**How it works:**

1. `/unikit-fix` fixes a bug and creates a patch file in `.unikit/code/patches/YYYY-MM-DD-HH.mm.md`
2. Each patch documents: **Problem**, **Root Cause**, **Solution**, **Prevention**, and **Tags**
3. `/unikit-evolve` reads patches incrementally using `.unikit/evolutions/patch-cursor.json`
4. Evolve classifies patches and writes rules to `RULES.md` or `skill-context/`

**Example patch** (`.unikit/code/patches/2026-03-15-14.30.md`) — a real artifact from a Unity project, so the paths and package names below are that project's, not a template to copy:

```markdown
# NullReferenceException in CustomerItemView.OnInit

**Date:** 2026-03-15 14:30
**Files:** Assets/Game/Scripts/Gameplay/View/CustomerItemView.cs
**Severity:** medium

## Problem
NullReferenceException when DiResolver.Resolve<IItemService>() returns null in NodeCanvas OnInit.

## Root Cause
DiResolver.Resolve() can return null for mandatory dependencies - no null check in OnInit.

## Solution
Added null check with throw: `if (service == null) throw new InvalidOperationException(...)`.

## Prevention
- Always throw exception when DiResolver.Resolve returns null for mandatory dependencies in NodeCanvas OnInit
- Check all ActionTask/ConditionTask OnInit methods for unguarded Resolve calls

## Tags
`#null-check` `#node-canvas` `#di-resolve` `#mandatory-dependency`
```

The more you use `/unikit-fix`, the smarter AI becomes on your project.

## Skill-Context Overrides

Built-in `unikit-*` skills get overwritten on `unikit-ai update`. To keep project-specific rules stable, `/unikit-evolve` writes them to:

```
.unikit/skill-context/<skill-name>/SKILL.md
```

These files:
- **Survive updates** - live in your project, not in the package
- **Have higher priority** than base SKILL.md rules
- **Are cumulative** - each `/unikit-evolve` run adds, updates, or removes rules

## Skill Interconnections

Plan files are the shared state between exploration, planning, implementation, and bug-fix skills. Here is how they hand off context to each other:

```
     Main flow                            Fix flow

  ┌──────────────────┐
  │  /unikit-explore  │
  └────────┬─────────┘
           │
           ▼
    .unikit/code/researches/
           │
           ▼
  ┌──────────────────┐
  │   /unikit-plan    │
  └────────┬─────────┘
           │                          ┌──────────────────┐
           ▼                          │   /unikit-fix    │
  .unikit/code/plans/                      └────────┬─────────┘
  .unikit/code/PLAN.md                              │
           │                                   ▼
           ▼                            .unikit/code/patches/
  ┌──────────────────┐                         │
  │ /unikit-implement │                        ▼
  └────────┬─────────┘                ┌──────────────────┐
           │                          │  /unikit-evolve  │
           ▼                          └──────────────────┘
      TASKS.md [x]
```

### /unikit-explore → /unikit-plan

Explore saves research artifacts to `.unikit/code/researches/<date>_<name>/` (three files: `RESEARCH_RESULT.md`, `RESEARCH_BRIEF.md`, `RESEARCH_SOURCE.md`). When planning begins, `/unikit-plan` reads `researches/INDEX.md` and offers to link relevant researches. If linked, the plan reads `RESEARCH_BRIEF.md` as a starting point for its own `PLAN-BRIEF.md` - verifying and extending the research against the current codebase state. The plan references linked research via a `## Based on` section.

### /unikit-plan → /unikit-implement

Plan creates the task checklist (`TASKS.md` or `PLAN.md`) and technical context (`PLAN-BRIEF.md` or inline `## Technical Context`). Implement discovers plans via the [Plan Discovery](#plan-discovery) priority order, reads the checklist for task ordering and the brief for technical context, Bootstraps rules + engine principles once, then executes tasks sequentially inline (`Read/Edit/Write/Bash`). Parallel phases and deep-dive tasks are offloaded to the `develop-agent` alias. After each task, implement marks `- [x]` in the plan file. After phase completion: compilation check (engine MCP), optional tests, commit checkpoint.

### /unikit-fix ↔ /unikit-implement

If implement finds `FIX_PLAN.md` but no feature plan, it redirects to `/unikit-fix` for execution. Fix can create `FIX_PLAN.md` (plan-first mode) for later execution via either `/unikit-fix` (without arguments) or `/unikit-implement` (which detects and redirects). Both skills Bootstrap rules and engine principles once, then write code inline; they spawn `develop-agent` only for complex multi-file or deep-dive work.

### /unikit-fix → /unikit-evolve

Every fix creates a mandatory patch in `.unikit/code/patches/`. Evolve reads patches incrementally (via `patch-cursor.json`) and distills prevention rules: code/architecture rules go to `RULES.md`, skill workflow issues go to `.unikit/skill-context/`. These improved rules make future runs of `/unikit-fix`, `/unikit-implement`, and `/unikit-plan` smarter - closing the learning loop.

### /unikit-explore → /unikit-fix

If explore discovers a bug or broken behavior during investigation, it routes the finding to `/unikit-fix` via the insight routing table in the research's `## Next Steps` section. This enables a natural transition from "I found something broken" to "let me fix it properly".

## See Also

- [Development Workflow](workflow.md) - how plan files fit into the development loop
- [Skills Reference](skills.md) - full reference for `/unikit-fix`, `/unikit-evolve`, and other skills
- [Memory & Skill Evolution](evolve.md) - detailed evolve workflow and stale rule cleanup
