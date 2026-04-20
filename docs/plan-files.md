[← Subagents](subagents.md) · [Back to README](../README.md) · [Dynamic Memory →](dynamic-memory.md)

# Plan Files

UniKit AI uses markdown files to track implementation plans, self-improvement patches, and skill overrides.

## Plan Structure

Plans are stored in two locations depending on mode:

| Source | Plan Location | Contents |
|--------|--------------|----------|
| `/unikit-plan fast` | `.unikit/PLAN.md` | Single flat file: overview, settings, checklist, commit plan, and `## Technical Context` inline |
| `/unikit-plan full` | `.unikit/plans/{YYYY-MM-DD}_{feature-name}/` | `TASKS.md` + `PLAN-BRIEF.md` |
| `/unikit-plan add` | Existing plan location | Modifies existing plan in-place |
| `/unikit-fix` (plan mode) | `.unikit/FIX_PLAN.md` | Single file with analysis + fix steps |

### TASKS.md - Task Checklist

Dependency-ordered checklist with WHY context, effort estimates, and file paths:

```markdown
# Tasks: Item Rarity System

Created: 2026-03-15
Branch: feature/item-rarity

## Settings
- Testing: no
- Docs: no

## Commit Plan
- **Commit 1** (tasks 1-3): "feat(items): add rarity enum and data model"
- **Commit 2** (tasks 4-6): "feat(items): implement rarity visual effects"

## Phase 1: Data Model

### Task 1: Create RarityType enum
**WHY:** Need a typed rarity classification before any visual or gameplay logic
**Effort:** S
**Files:** `Assets/Game/Scripts/Gameplay/Core/Items/RarityType.cs`
- [ ] Create enum: Common, Uncommon, Rare, Epic, Legendary
- [ ] Add [Serializable] attribute for inspector support

### Task 2: Add rarity field to ItemDefinition
**WHY:** Items need a rarity property for filtering and display
**Effort:** S
**Files:** `Assets/Modules/Pawnshop/Inventory/ItemDefinition.cs`
- [ ] Add [SerializeField] RarityType _rarity field
- [ ] Add public RarityType Rarity property
```

### PLAN-BRIEF.md - Technical Context (full mode)

Technical context that doesn't belong in the task checklist. Always created in full mode - even when a research's `RESEARCH_BRIEF.md` exists, the plan generates its own brief based on the current codebase state. The research brief is used as input, not a replacement.

In fast mode, this content is included inline as `## Technical Context` inside `PLAN.md`.

```markdown
# Plan Brief: Item Rarity System

## Constraints
- Must work with existing Opsive Ultimate Inventory System
- Rarity colors must be configurable via ScriptableObject

## Interfaces
- IItemView already has SetData() - extend, don't replace
- Existing ItemDefinition is in Modules/Pawnshop/Inventory/

## Patterns to Follow
- Use Zenject for DI, not service locators
- Visual effects via DOTween, not Animator
```

## Plan Discovery

`/unikit-implement` finds plans in this order:
1. **Fast plan** → `.unikit/PLAN.md` (if exists, used directly)
2. **Git branch match** → `.unikit/plans/` directory matching current `feature/*` branch name
3. **Latest by date** → most recent `{YYYY-MM-DD}_{name}/` directory (lexicographic sort)
4. **Fix plan fallback** → `.unikit/FIX_PLAN.md` → redirects to `/unikit-fix`

If both `.unikit/PLAN.md` and a matching folder plan exist, the user is asked which one to use.

## Artifact Ownership

To avoid ownership conflicts, artifact writers are command-scoped:

| Artifact | Primary owner | Notes |
|----------|--------------|-------|
| `.unikit/PLAN.md` | `/unikit-plan` | Fast-mode plan (temporary, single file) |
| `.unikit/DESCRIPTION.md` | `/unikit` | Project specification |
| `.unikit/ARCHITECTURE.md` | `/unikit-architecture` | Architecture guidelines |
| `.unikit/ROADMAP.md` | `/unikit-roadmap` | Milestone tracking |
| `.unikit/RULES.md` | `/unikit-rules` | Convention source of truth |
| `.unikit/plans/*/TASKS.md` | `/unikit-plan` | `/unikit-improve` refines existing |
| `.unikit/plans/*/PLAN-BRIEF.md` | `/unikit-plan` | Always created; research used as input, not replacement |
| `.unikit/FIX_PLAN.md` | `/unikit-fix` | Bug-fix analysis and steps |
| `.unikit/patches/*.md` | `/unikit-fix` | Self-improvement patches |
| `.unikit/skill-context/*` | `/unikit-evolve` | Project-specific skill overrides |
| `.unikit/evolutions/*` | `/unikit-evolve` | Evolution logs + patch cursor |

Quality commands (`/unikit-commit`, `/unikit-review`, `/unikit-verify`) treat these files as read-only context by default.

## Self-Improvement Patches

UniKit AI has a built-in learning loop. Every bug fix creates a **patch** - a structured knowledge artifact that helps AI avoid the same mistakes in the future.

```
/unikit-fix → finds bug → fixes it → creates patch → /unikit-evolve distills patches into rules → smarter future runs
```

**How it works:**

1. `/unikit-fix` fixes a bug and creates a patch file in `.unikit/patches/YYYY-MM-DD-HH.mm.md`
2. Each patch documents: **Problem**, **Root Cause**, **Solution**, **Prevention**, and **Tags**
3. `/unikit-evolve` reads patches incrementally using `.unikit/evolutions/patch-cursor.json`
4. Evolve classifies patches and writes rules to `RULES.md` or `skill-context/`

**Example patch** (`.unikit/patches/2026-03-15-14.30.md`):

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
    .unikit/researches/
           │
           ▼
  ┌──────────────────┐
  │   /unikit-plan    │
  └────────┬─────────┘
           │                          ┌──────────────────┐
           ▼                          │   /unikit-fix    │
  .unikit/plans/                      └────────┬─────────┘
  .unikit/PLAN.md                              │
           │                                   ▼
           ▼                            .unikit/patches/
  ┌──────────────────┐                         │
  │ /unikit-implement │                        ▼
  └────────┬─────────┘                ┌──────────────────┐
           │                          │  /unikit-evolve  │
           ▼                          └──────────────────┘
      TASKS.md [x]
```

### /unikit-explore → /unikit-plan

Explore saves research artifacts to `.unikit/researches/<date>_<name>/` (three files: `RESEARCH_RESULT.md`, `RESEARCH_BRIEF.md`, `RESEARCH_SOURCE.md`). When planning begins, `/unikit-plan` reads `RESEARCHES_INDEX.md` and offers to link relevant researches. If linked, the plan reads `RESEARCH_BRIEF.md` as a starting point for its own `PLAN-BRIEF.md` - verifying and extending the research against the current codebase state. The plan references linked research via a `## Based on` section.

### /unikit-plan → /unikit-implement

Plan creates the task checklist (`TASKS.md` or `PLAN.md`) and technical context (`PLAN-BRIEF.md` or inline `## Technical Context`). Implement discovers plans via the [Plan Discovery](#plan-discovery) priority order, reads the checklist for task ordering and the brief for technical context, Bootstraps rules + engine principles once, then executes tasks sequentially inline (`Read/Edit/Write/Bash`). Parallel phases and deep-dive tasks are offloaded to the `develop-agent` alias. After each task, implement marks `- [x]` in the plan file. After phase completion: compilation check (engine MCP), optional tests, commit checkpoint.

### /unikit-fix ↔ /unikit-implement

If implement finds `FIX_PLAN.md` but no feature plan, it redirects to `/unikit-fix` for execution. Fix can create `FIX_PLAN.md` (plan-first mode) for later execution via either `/unikit-fix` (without arguments) or `/unikit-implement` (which detects and redirects). Both skills Bootstrap rules and engine principles once, then write code inline; they spawn `develop-agent` only for complex multi-file or deep-dive work.

### /unikit-fix → /unikit-evolve

Every fix creates a mandatory patch in `.unikit/patches/`. Evolve reads patches incrementally (via `patch-cursor.json`) and distills prevention rules: code/architecture rules go to `RULES.md`, skill workflow issues go to `.unikit/skill-context/`. These improved rules make future runs of `/unikit-fix`, `/unikit-implement`, and `/unikit-plan` smarter - closing the learning loop.

### /unikit-explore → /unikit-fix

If explore discovers a bug or broken behavior during investigation, it routes the finding to `/unikit-fix` via the insight routing table in the research's `## Next Steps` section. This enables a natural transition from "I found something broken" to "let me fix it properly".

## See Also

- [Development Workflow](workflow.md) - how plan files fit into the development loop
- [Skills Reference](skills.md) - full reference for `/unikit-fix`, `/unikit-evolve`, and other skills
- [Memory & Skill Evolution](evolve.md) - detailed evolve workflow and stale rule cleanup
