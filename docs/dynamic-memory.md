[← Plan Files](plan-files.md) · [Back to README](../README.md) · [Memory & Skill Evolution →](evolve.md)

# Dynamic Memory

UniKit AI's key differentiator - a dynamic knowledge base with a unified development entry point, designed specifically for the complexity of Unity game projects.

## The Problem

Unity game development involves many frameworks, each with its own rules and conventions:
- **DI**: Zenject bindings, lifecycle, factory patterns
- **Async**: UniTask patterns, CancellationToken propagation
- **Reactive**: R3 subscriptions, disposal, observable chains
- **UI**: ASPID MVVM binding, ViewModel lifecycle
- **AI**: NodeCanvas behaviour trees, FSM, ActionTask patterns
- **Inspector**: Odin attributes, validation, editor tools
- **Probability**: RNGNeeds weighted lists

Loading all framework rules into context at once wastes tokens. Creating separate skills per framework loses shared context. UniKit AI solves both problems.

## Knowledge Base Structure

A two-tier storage of proven development rules that carry across projects:

- `memory/core/` - **core rules**, always loaded
- `memory/stack/` - **stack rules**, loaded on demand
- `RULES.md` - **staging buffer** for new rules under validation (highest priority)

The developer iteratively improves permanent memory over time by testing rules in `RULES.md` first. Only validated, battle-tested rules get promoted to `memory/core/` or `memory/stack/` - and once there, they travel with the developer to any Unity project.

### Core Rules

5 files in `memory/core/`, loaded on every invocation:

| File | Coverage |
|------|----------|
| `code-style.md` | Naming, access modifiers, member ordering, class structure |
| `design-principles.md` | SOLID, GRASP, KISS/DRY, SRP decision framework |
| `folders-structure.md` | Project folder structure, file placement conventions |
| `performance.md` | ZLinq, pooling, caching, hot path optimization, mobile |
| `testing.md` | NUnit, AAA pattern, test doubles, boundary conditions |

### Stack Rules

Files in `memory/stack/`, loaded selectively based on the task. The set is not fixed - it is driven by the **rules registry**, which the community extends over time with rules for new frameworks and libraries. See [Rules Registry](rules-registry.md) for details.

Below is an example of what a project's stack rules might look like after initialization:

| File | Loaded When |
|------|-------------|
| `aspid-mvvm.md` | UI views, ViewModel, MonoView, data binding |
| `imgui-editor-tools.md` | Creating editor windows with IMGUI |
| `node-canvas.md` | AI behaviour trees, FSM, ActionTask, ConditionTask |
| `odin-editor-tools.md` | Creating editor windows with OdinEditorWindow |
| `odin.md` | Inspector attributes, [ShowIf], [Required], validation |
| `r3.md` | Reactive streams, Observable, Subscribe, ReactiveProperty |
| `rngneeds.md` | Weighted random selection, ProbabilityList |
| `unitask.md` | Async code, CancellationToken, async UniTask |

Each stack rule may have associated reference files (e.g., `aspid-mvvm-binders-full.md`, `node-canvas-tasks-quickref.md`) that provide detailed API information loaded alongside the rule.

### RULES_INDEX.md

A compact auto-generated index that tells pipeline skills (and `/unikit-devcontext` in standalone mode) when to load each stack rule:

```markdown
## Stack Rules

| Rule | Description | Load When |
|------|-------------|-----------|
| unitask | UniTask async/await, CancellationToken... | Async code, UniTask, CancellationToken... |
| r3 | R3 reactive programming... | Reactive streams, Observable, Subscribe... |
| node-canvas | NodeCanvas ActionTask... | AI behaviour trees, FSM, ActionTask... |
```

Generated automatically by `unikit-ai init`, `unikit-ai update`, `unikit-ai rules sync`, and `/unikit-memory`. Never edit it manually.

## Dynamic Loading

### How Workflow Skills Load Rules

Pipeline skills (`/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-improve`) Bootstrap the knowledge base once at the start of execution and implement tasks inline against the loaded rules. `/unikit-devcontext` remains available as a standalone skill for one-off work outside a plan.

```
┌──────────────────────────────────────────────┐
│  Pipeline skill (e.g. /unikit-implement)     │
│                                              │
│  Step 1.5 Bootstrap:                         │
│  1. Read dev-principles.md                   │  ← .unikit/system/ (always)
│  2. Read RULES.md                            │  ← project overrides
│  3. Read RULES_INDEX.md                      │
│  4. Read core rules                          │  ← memory/core/ (always)
│                                              │
│  Step 3.0 Phase Rules Refresh (per phase):   │
│  5. Re-read RULES_INDEX.md                   │
│  6. Load stack rules needed for this phase   │  ← memory/stack/ (delta)
│                                              │
│  Step 3.2 Implement the task (per task):     │
│  7. Write code inline (Read/Edit/Write/Bash) │
│     with the rules already loaded            │
└──────────────────────────────────────────────┘
```

Steps 5-6 in detail:
- Examines phase name and task descriptions - files involved, frameworks referenced
- Loads only the stack rules needed for the upcoming phase, based on "Load When" triggers from `RULES_INDEX.md`
- If a stack rule has references, loads the appropriate quickref or full reference alongside it

**Example:** `/unikit-implement` entering a phase whose tasks reference NodeCanvas ActionTasks with UniTask async patterns runs the delta load:
- All 5 core rules (already loaded in Bootstrap)
- `node-canvas.md` + relevant NodeCanvas references (loaded now)
- `unitask.md` (loaded now)
- But NOT `aspid-mvvm.md`, `r3.md`, `odin.md`, etc.

`/unikit-devcontext` is a **standalone skill** for one-off file-level work without a plan: a quick review, a single refactor, or answering an architecture question. Pipeline skills no longer delegate every task to it:

- **`/unikit-implement`** - Bootstraps rules once, then writes each task inline
- **`/unikit-fix`** - Bootstraps rules in Step 0.2, then applies the fix inline
- **`/unikit-verify`** - Bootstraps rules in Step 0.2, then applies fixes from Step 4.3 inline

Calling `/unikit-devcontext` directly is still the right move for ad-hoc work, but it does not create patches or track memory improvements.

### Parallel Execution via the `develop-agent` alias

Workflow skills expose a named delegation alias - `develop-agent` - that expands to an `Agent(subagent_type: "general-purpose", skills: ["unikit-devcontext"])` call. After the Bootstrap refactor this alias is reserved for **true parallel scopes** (independent phases that can run simultaneously) and **deep-dive single tasks** that would otherwise bloat the parent context:

```
┌───────────────────────────────┐    ┌───────────────────────────────┐
│  /unikit-implement · Phase 3  │    │  /unikit-implement · Phase 4  │
│  (main context · Bootstrap)   │    │  (main context · Bootstrap)   │
│                               │    │                               │
│  Agent(develop-agent) ────────┼───►│  unikit-devcontext            │
│  → Phase 4 runs in parallel   │    │  (loads its own knowledge base)│
└───────────────────────────────┘    └───────────────────────────────┘
```

Default sequential work stays inline - `develop-agent` is only spawned when the dependency graph proves two scopes are independent, or when a single task needs exploration that would crowd out the main context.

## Managing Rules

### Installing from the Registry

Stack rules are installed from the **rules registry** (default: `NintendaDev/unikit-ai-rules`):

- **`/unikit`** - on initialization, scans the project's tech stack (package manifest, plugins folder, third-party assets, engine-specific Q&A selections) and treats every detected framework as a candidate for `memory/stack/`. Registry-backed rules are installed directly; anything without a registry counterpart is generated on the fly via `/unikit-memory`.
- **`unikit-ai rules install <id>`** - installs any rule from the registry by ID at any time.
- **`unikit-ai update`** - pulls newer versions of already-installed registry rules.

You can also maintain a **custom registry** with private or team-specific rules, carried from project to project. See [Rules Registry](rules-registry.md) for details.

### Adding Rules Outside the Registry

If a framework isn't in the registry yet, or you need a fully custom rule:

- **`/unikit-memory`** - generate a rule from scratch: the skill interviews you, reads existing code, and synthesizes the document directly into `memory/stack/`.
- **Manual** - add a rule file directly to `memory/core/` or `memory/stack/`, then run `unikit-ai rules sync` to rebuild `RULES_INDEX.md` and register it in `.unikit.json` as `source: local`.
- **Custom registry** - promote locally-authored rules into a registry with `/unikit-rules-registry create` so they can be reused across projects. See [Rules Registry](rules-registry.md).

## Rule Lifecycle

New rules should be validated before being promoted to permanent memory. Three layers with clear priority:

```
RULES.md (project-specific, highest priority)
    ↓ fallback
memory/core/ (always loaded)
    ↓ fallback
memory/stack/ (loaded on demand)
```

### Stage 1: Draft in RULES.md

New rules land in `RULES.md` via `/unikit-rules`:

```
/unikit-rules "Always use UniTask.WhenAll for parallel async operations instead of sequential awaits"
```

The skill checks for conflicts with existing rules in `RULES.md` and permanent memory, then adds the rule where it takes priority over everything else. Use the rule on real tasks and refine it with `/unikit-rules` until stable.

### Stage 2: Auto-extraction from Patches

`/unikit-evolve` analyzes patches created by `/unikit-fix`, extracts recurring patterns, and adds new rules to `RULES.md` for validation:

```
patches/fix-async-leak.patch
    ↓ classify
RULES.md (new rule: "Always pass CancellationToken to UniTask.Delay")
```

### Stage 3: Migration to Permanent Memory

When rules in `RULES.md` are proven and stable:

```
/unikit-memory --migrate-rules
```

Migration is **interactive** - the skill asks which rules to migrate and which to skip:

- **Migrate** - the rule moves to `memory/core/` or `memory/stack/`, conflicts with existing permanent rules are resolved interactively, and the rule is removed from `RULES.md`
- **Skip** - the rule stays in `RULES.md` as-is. Skipped rules are tagged with `<!-- no-migrate -->` and won't be proposed again in future runs

For each migrated rule, the skill:
1. **Classifies** - determines whether the rule belongs to `memory/core/` or `memory/stack/`
2. **Finds target** - searches for an existing file that matches the rule's topic
3. **Validates** - if a matching file exists, checks for intersections and contradictions
4. **Creates or merges** - creates a new file if none exists, or merges into the existing one

```
RULES.md (rule: "Always use UniTask.WhenAll for parallel async")
    ↓ classify → stack
    ↓ find target → memory/stack/unitask.md exists
    ↓ validate → no contradictions
    ↓ merge into unitask.md
```

### Full Cycle

```
/unikit-fix                          /unikit-evolve
┌──────────────────┐                ┌──────────────────┐
│ Find bug         │                │ Read new patches │
│ Fix it           │ ──patches──▶  │ Extract patterns  │
│ Create patch     │                │  → RULES.md      │
│                  │                │                   │
└──────────────────┘                └────────┬─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │ /unikit-memory   │
                                    │ Migrate mature   │
                                    │ rules to memory/ │
                                    └──────────────────┘
```

## See Also

- [Skills Reference](skills.md) - full reference for pipeline skills, the standalone `/unikit-devcontext`, and delegation aliases
- [Memory & Skill Evolution](evolve.md) - detailed evolve workflow and stale rule cleanup
- [Configuration](configuration.md) - rules-manifest.json and memory structure
