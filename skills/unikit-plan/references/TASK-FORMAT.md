# Plan File Templates

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

## Roadmap Linkage (optional)
Milestone: "[milestone name]" | "none"
Rationale: [1 short sentence]

## Checklist

Tasks are ordered by dependencies. Each phase includes effort estimate and dependency list.

### Phase 1: {Phase Name}
**Effort:** S / M / L / XL (S = hours, M = 1-2 days, L = 3-5 days, XL = 1+ week)
**Dependencies:** None (first phase) | Phase N, Phase M
**Status:** [ ] Not started

- [ ] Task 1.1 — brief description of what to do
  WHY: one-line reason why this task is needed in the context of the feature
  Files: `path/to/file.cs`
- [ ] Task 1.2 — brief description
  WHY: reason
  Files: `path/to/file1.cs`, `path/to/file2.cs`

### Phase 2: {Phase Name}
**Effort:** M
**Dependencies:** Phase 1
**Status:** [ ] Not started

- [ ] Task 2.1 — brief description
  WHY: reason
  Files: `path/to/file.cs`

...

### Phase N: {Phase Name}
**Effort:** L
**Dependencies:** Phase 2, Phase 3
**Status:** [ ] Not started

- [ ] Task N.1 — brief description
  WHY: reason

## Commit Plan

(Only for plans with 5+ tasks total)

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
​```csharp
public interface IExample { }
​```

### KEY PATTERNS
​```csharp
// Pattern example
​```

### FILES
| Path | Type | Notes |
|------|------|-------|
| `Assets/...` | interface | description |

### DI BINDINGS
​```csharp
Container.Bind<IExample>().To<Example>().AsSingle();
​```

### OUT OF SCOPE
- What is NOT part of this plan
```

## Plan Brief Template

```markdown
# {Feature Name}

## CONTEXT
Project: {{engine_name}} 6 / Zenject / UniTask / R3 / ASPID MVVM / NodeCanvas
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
​```csharp
// Namespace
public interface IExample
{
    // Key methods with signatures
}
​```

## KEY PATTERNS

### {Pattern Name}
​```csharp
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
| `Assets/Modules/...` | interface | description |

### MODIFY
| Path | Change |
|------|--------|
| `Assets/Modules/...` | what to change |

## DI BINDINGS
​```csharp
// Installer bindings
Container.Bind<IExample>().To<Example>().AsSingle();
​```

## OUT OF SCOPE
- What is explicitly NOT part of this plan
```
