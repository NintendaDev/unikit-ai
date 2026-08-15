# Plan File Templates

> **Engine placeholders.** These templates are engine-neutral. Four placeholders resolve from `references/ENGINE_RULES.md` §2 (Language & layout) for the active engine — substitute them when writing the plan, never copy them verbatim:
>
> | Placeholder | Resolves to |
> |-------------|-------------|
> | `<lang>` | the markdown code-fence identifier (§2 "code fence") |
> | `<ext>` | the source-file extension |
> | `<content-root>` | the project's content root path |
> | `{DI binding per ENGINE_RULES.md §2}` | the engine's DI binding form |
>
> When `ENGINE_RULES.md` is absent for the active engine, keep the sections but leave the engine-specific bodies out rather than guessing.

## Tasks Template (`TASKS.md` / `PLAN.md`)

```markdown
# {Feature Name} — Tasks

## Overview
What is being built, why, and what goal it serves. 3-5 sentences maximum.
Answer: WHAT is done, WHY it is needed, WHAT GOAL it pursues.

## Based on
(Optional) Use Research Reference Format from the main skill file to link researches.

Full mode: if no research — technical context is in `PLAN-BRIEF.md` next to this file.
Fast mode: if no research — see `## Technical Context` section below.

## Settings
- Testing: yes/no
- Docs: yes/no (full mode only)
- Visual regression: yes/no (default: no)
- Editor tasks: mcp | manual | direct

## Roadmap Linkage (optional)
Milestone: "[milestone name]" | "none"
Rationale: [1 short sentence]

## Checklist

Tasks are ordered by dependencies. Each phase includes effort estimate and dependency list.

> **Commit-checkpoint markers (decorative).** For plans with a `## Commit Plan` (5+ tasks), insert one `<!-- Commit checkpoint: tasks X-Y -->` HTML comment at each commit boundary — right after the last task of that commit's range. The `X-Y` range MUST mirror the matching `### Commit N: after tasks X-Y` heading in the `## Commit Plan` below (single source of truth — derive the marker from the Commit Plan, never the other way round). These markers are **decorative only**: they document where a commit naturally falls. `/unikit-implement` does **not** parse them and they never alter its behavior.

### Phase 1: {Phase Name}
**Effort:** S / M / L / XL (S = hours, M = 1-2 days, L = 3-5 days, XL = 1+ week)
**Dependencies:** None (first phase) | Phase N, Phase M
**Status:** [ ] Not started

- [ ] Task 1.1 — brief description of what to do
  WHY: one-line reason why this task is needed in the context of the feature
  Files: `path/to/file.<ext>`
- [ ] Task 1.2 — brief description
  WHY: reason
  Files: `path/to/file1.<ext>`, `path/to/file2.<ext>`
  Editor: [ui] <container> → <target> : <action>
<!-- Commit checkpoint: tasks 1.1-1.6 -->

### Phase 2: {Phase Name}
**Effort:** M
**Dependencies:** Phase 1
**Status:** [ ] Not started

- [ ] Task 2.1 — brief description
  WHY: reason
  Files: `path/to/file.<ext>`
<!-- Commit checkpoint: tasks 2.1-2.4 -->

...

### Phase N: {Phase Name}
**Effort:** L
**Dependencies:** Phase 2, Phase 3
**Status:** [ ] Not started

- [ ] Task N.1 — brief description
  WHY: reason

## Commit Plan

(Only for plans with 5+ tasks total)

Each `### Commit N: after tasks X-Y` heading is the single source of truth for the decorative `<!-- Commit checkpoint: tasks X-Y -->` markers placed in the `## Checklist` above — keep the ranges in sync (Checklist marker derives from the heading here).

### Commit 1: after tasks 1.1-1.6
feat(<module>): <description>

### Commit 2: after tasks 2.1-2.4
feat(<module>): <description>

...

## Dependency Graph

Phase 1 → Phase 2 → Phase 4
Phase 1 → Phase 3 → Phase 4
              ↘ Phase 5

## Total Estimated Effort
Sum of all phases: ~X days
```

### Editor task grammar

Some tasks change the engine editor's **serialized state** (scenes, UI, VFX, animation, assets, input maps, project settings) rather than source files. Such a task carries one or more `Editor:` lines:

```
Editor: [kind] <container> → <target> : <action>
kind ∈ scene | ui | vfx | anim | asset | input | settings   (default: scene)
```

Rules:

- **One line per target** — repeat the field when a task touches several targets.
- The field goes **after** `Files:`.
- Naming of `<container>` and `<target>` is engine-specific — see `references/ENGINE_RULES.md` (§1 kind → concept, §2 language & layout).
- **Pure code tasks omit the field entirely.** Editing a plain text or config file stays in `Files:`.
- When `references/ENGINE_RULES.md` is absent for the active engine, the field is **not generated at all** — the plan degrades to code-only tasks and `## Settings` carries no `Editor tasks` line.

The targets are aggregated into an `## EDITOR TARGETS` table (`PLAN-BRIEF.md` in full mode, `## Technical Context` in fast mode). **Both are omitted entirely when the plan carries no `Editor:` task.**

### Fast mode differences

- Title: `# {Feature Name} — Plan` (instead of `— Tasks`)
- Settings: no `Docs` line
- Append `## Technical Context` after `Total Estimated Effort`:

```markdown
---

## Technical Context

### CONSTRAINTS
- MUST: {constraint with rationale}
- FORBIDDEN: {anti-pattern with rationale}

### INTERFACES
​```<lang>
public interface IExample { }
​```

### KEY PATTERNS
​```<lang>
// Pattern example
​```

### FILES
| Path | Type | Notes |
|------|------|-------|
| `<content-root>/...` | interface | description |

### EDITOR TARGETS
| Kind | Container | Target | Change |
|------|-----------|--------|--------|

### DI BINDINGS
​```<lang>
{DI binding per ENGINE_RULES.md §2}
​```

### OUT OF SCOPE
- What is NOT part of this plan
```

## Plan Brief Template

```markdown
# {Feature Name}

## CONTEXT
Project: {{engine_name}} / {stack from `.unikit/DESCRIPTION.md`}
Feature: {brief description}
Scope: {list of key components/modules affected}
Stop condition: {what is explicitly NOT implemented in this plan}

## CONSTRAINTS
- MUST: {constraint with rationale}
- MUST: {constraint with rationale}
- FORBIDDEN: {anti-pattern with rationale}
- FORBIDDEN: {anti-pattern with rationale}

## INTERFACES

### {InterfaceName} [NEW | MODIFY]
​```<lang>
// Namespace
public interface IExample
{
    // Key methods with signatures
}
​```

## KEY PATTERNS

### {Pattern Name}
​```<lang>
// Code example showing the pattern in context
​```

## DEPENDENCY GRAPH

ComponentA
  <- IDependency (ctor inject)
  <- IOtherDependency (ctor inject)

ComponentB
  <- ComponentA (ctor inject)

## FILES

### CREATE
| Path | Type | Notes |
|------|------|-------|
| `<content-root>/...` | interface | description |

### MODIFY
| Path | Change |
|------|--------|
| `<content-root>/...` | what to change |

## EDITOR TARGETS
| Kind | Container | Target | Change |
|------|-----------|--------|--------|

## DI BINDINGS
​```<lang>
{DI binding per ENGINE_RULES.md §2} — one line per installer binding
​```

## OUT OF SCOPE
- What is explicitly NOT part of this plan
```
