[← Game-Design Module](gamedesign.md) · [Back to README](../README.md) · [Memory & Skill Evolution →](evolve.md)

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

The knowledge base is **modular** - partitioned into top-level **modules**, each owning its own tier semantics. `code` (this page's main focus - Unity/Godot/Unreal framework rules) is always installed; the optional `gamedesign` module installs alongside the `unikit-gd-*` skills. Every module lives under `.unikit/memory/<module>/<tier>/` on the same physical layout, but each module keeps its **own** `RULES_INDEX.md` (see below) - there is no single shared index across modules.

### Modules: `code` vs `gamedesign`

| | `code` | `gamedesign` |
|---|---|---|
| Tiers | `core` (always loaded) / `stack` (on demand) | `core` (canonical domain knowledge, loaded by `Load when`) / `library` (empty studio slot) |
| Engine-partitioned | Yes - rules differ by engine | No - design theory doesn't depend on the engine |
| Resolution | `module-winner` - first registry in the chain that carries the module wins wholesale | `per-id-merge` - a studio override wins per rule id, missing ids backfill from official → bundled |
| Bootstrap installs | `core` only | the whole catalog (`core` + `library`) |
| CLI scope | `--module code` (default for most commands) | `--module gamedesign` |

Below, "`code` module rules" and "`gamedesign` module rules" break out what each module actually stores. The Bootstrap load sequence ([Dynamic Loading](#dynamic-loading)) and the `RULES.md` staging stages ([Rule Lifecycle](#rule-lifecycle)) are written from the `code` pipeline skills' point of view, since every project installs `code` and those mechanics are easiest to show concretely - but they apply to `gamedesign` identically wherever noted inline, just scoped with `--module gamedesign` and rooted at `.unikit/memory/gamedesign/`. For the full write-up of what each `gamedesign` core rule actually teaches, see [Game-Design Module](gamedesign.md#domain-knowledge-rules).

### The module registry

Which modules exist, and the shape each one partitions into, is data - not something hardcoded per skill. `MODULE_REGISTRY` (in the CLI source) is the single source of truth: for every module it records the tier list, whether it's engine-partitioned, its skill prefix (`unikit` for `code`, `unikit-gd` for `gamedesign`), its Bootstrap policy (`always-core` vs `all-rules`), and its core-tier resolution strategy (`module-winner` vs `per-id-merge`). `unikit-ai init`/`update` render the **structural** subset of it - tier list, engine-partitioning, skill prefix, nothing CLI-only like Bootstrap policy - to `.unikit/system/modules.yml`, the file two AI skills read at runtime to stay module-agnostic:

- **`/unikit-memory`** - the router that adds, researches, migrates, and optimises rules (see [Managing Rules](#managing-rules) below)
- **`/unikit-rules-registry`** - the orchestrator that creates, updates, and syncs a custom registry

Neither skill hardcodes a module id, a tier name, or a path segment - both resolve `--module <id>` (or infer the target from context, asking via `AskUserQuestion` on ambiguity) from `modules.yml`'s structural fields alone. `/unikit-memory` additionally reads the resolved module's **content contract** (`skills/unikit-memory/references/module-<id>.md`) for tier semantics and file formats - `/unikit-rules-registry` only needs the structural shape to mirror the on-disk/registry layout, never the content rules. This is what makes the knowledge base extensible: registering a third module needs a new `MODULE_REGISTRY` entry, a registry-side folder, and a `module-<id>.md` contract - no change to either router skill.

### `code` module rules

The `code` module stores a two-tier collection of proven development rules that carry across projects:

- `.unikit/memory/code/core/` - **core rules**, always loaded
- `.unikit/memory/code/stack/` - **stack rules**, loaded on demand
- `RULES.md` - **staging buffer** for new rules under validation (highest priority), shared across modules - see [Rule Lifecycle](#rule-lifecycle) below

The developer iteratively improves permanent memory over time by testing rules in `RULES.md` first. Only validated, battle-tested rules get promoted to `.unikit/memory/code/core/` or `.unikit/memory/code/stack/` - and once there, they travel with the developer to any Unity project.

#### Core rules

5 files in `.unikit/memory/code/core/`, loaded on every invocation:

| File | Coverage |
|------|----------|
| `code-style.md` | Naming, access modifiers, member ordering, class structure |
| `design-principles.md` | SOLID, GRASP, KISS/DRY, SRP decision framework |
| `folders-structure.md` | Project folder structure, file placement conventions |
| `performance.md` | ZLinq, pooling, caching, hot path optimization, mobile |
| `testing.md` | NUnit, AAA pattern, test doubles, boundary conditions |

#### Stack rules

Files in `.unikit/memory/code/stack/`, loaded selectively based on the task. The set is not fixed - it is driven by the **rules registry**, which the community extends over time with rules for new frameworks and libraries. See [Rules Registry](rules-registry.md) for details.

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

Each stack rule may have associated reference files (e.g., `aspid-mvvm-binders-full.md`, `node-canvas-tasks-quickref.md`) that provide detailed API information loaded alongside the rule. Reference files live beside the rule in the **same tier's** `references/` subfolder (`.unikit/memory/code/core/references/` or `.unikit/memory/code/stack/references/`) - `core` rules can carry references too, not just `stack`.

### `gamedesign` module rules

The `gamedesign` module stores its own two-tier collection of design domain knowledge, resolved per rule id rather than as a whole tier (see the `per-id-merge` row above):

- `.unikit/memory/gamedesign/core/` - **core rules**, canonical domain knowledge, loaded by `Load when` match rather than always-on
- `.unikit/memory/gamedesign/library/` - **library rules**, an empty studio slot for house design conventions
- `RULES.md` - the same project-level staging buffer `code` uses, classified into this module when its content is design-specific

#### Core rules

Twelve rules the design-track skills (`unikit-gd-*`) load by `Load when` match, not "always" like `code`'s core tier - each is a compact method reference, not a knowledge dump:

| Rule | Scope |
|------|-------|
| `frameworks` | MDA aesthetics, SDT/PENS motivation needs, the flow channel, game-feel responsiveness budgets |
| `player-motivation` | The Quantic Foundry 12-motivation model, audience definition, system-coverage checks |
| `core-loops` | Loop anatomy (action → reward → investment → re-entry), timescale layering, retention triggers |
| `balance` | Cost curves, payoff matrices for intransitive systems, power/difficulty curves, tuning-knob discipline |
| `economy` | Faucet/sink conservation, currency taxonomy, value chains, gacha/pity math, inflation guardrails |
| `progression` | Progression axes, XP curve families, unlock pacing, skill trees, power-vs-content coupling |
| `level-design` | Bubble diagrams, pacing beat sheets, the "gym" teaching pattern, movement/combat metrics |
| `narrative` | The story bible as canon, branching structures and their cost, reactive dialogue, ludonarrative consonance |
| `ux-onboarding` | Teach-by-doing onboarding, the FTUE funnel as a telemetry contract, cognitive-load budgets |
| `accessibility` | Game Accessibility Guidelines tiers, impairment categories, the legal floor, high-impact features |
| `liveops` | Battle-pass anatomy, content calendars vs team capacity, the engagement-vs-exploitation line |
| `monetization-ethics` | Dark-pattern taxonomy, loot-box/gacha odds disclosure, legal landscape, designing for minors |

Full descriptions and the per-id-merge resolution mechanics live in [Game-Design Module](gamedesign.md#domain-knowledge-rules).

#### Library rules

Ships empty. Recurring review/verify conflicts, or house design conventions, land here via `/unikit-memory --module gamedesign` - the same authoring skill that maintains `code` stack rules, scoped to this module (see [Managing Rules](#managing-rules) below).

### RULES_INDEX.md

A compact auto-generated index that tells pipeline skills (and `/unikit-devcontext` in standalone mode) when to load each stack rule. **Each module keeps its own index** - `.unikit/memory/code/RULES_INDEX.md` for the `code` module, `.unikit/memory/gamedesign/RULES_INDEX.md` for `gamedesign` - there is no single shared file across modules:

```markdown
## Stack Rules

| Rule | Description | Load When |
|------|-------------|-----------|
| unitask | UniTask async/await, CancellationToken... | Async code, UniTask, CancellationToken... |
| r3 | R3 reactive programming... | Reactive streams, Observable, Subscribe... |
| node-canvas | NodeCanvas ActionTask... | AI behaviour trees, FSM, ActionTask... |
```

The column scheme is module-specific: the `code` module's `core` table carries a **Required By** column (which pipeline skills need that rule loaded - see `data/rules-manifest.json`), because its core rules are mandatory-gated. The `gamedesign` module's `core` table carries an **Origin** column instead (`primary` / `official` / `bundled`), because its core tier resolves per rule id (see the `per-id-merge` row above) and there is no mandatory-gate concept there. Non-core tiers (`stack`, `library`) never carry an extra column - they're load-on-demand either way.

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
│  4. Read core rules                          │  ← .unikit/memory/code/core/ (always)
│                                              │
│  Step 3.0 Phase Rules Refresh (per phase):   │
│  5. Re-read RULES_INDEX.md                   │
│  6. Load stack rules needed for this phase   │  ← .unikit/memory/code/stack/ (delta)
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

`code` stack rules are installed from the **rules registry** (default: `NintendaDev/unikit-ai-rules`):

- **`/unikit`** - on initialization, scans the project's tech stack (package manifest, plugins folder, third-party assets, engine-specific Q&A selections) and treats every detected framework as a candidate for `.unikit/memory/code/stack/`. Registry-backed rules are installed directly; anything without a registry counterpart is generated on the fly via `/unikit-memory`.
- **`unikit-ai rules install <id>`** - installs any rule from the registry by ID at any time.
- **`unikit-ai update`** - pulls newer versions of already-installed registry rules.

`gamedesign` rules install differently, since there is no "detected framework" concept for design theory: as soon as the `unikit-gd-*` skills are installed, `/unikit`'s bootstrap step (and `unikit-ai rules install defaults`) installs the module's **entire catalog** - all twelve `core` rules plus anything already in `library` - rather than a per-framework subset. `unikit-ai rules install <id> --module gamedesign` and `unikit-ai update` work the same way as for `code`.

You can also maintain a **custom registry** with private or team-specific rules, carried from project to project - for either module. See [Rules Registry](rules-registry.md) for details on the transport chain, schema, and CLI surface.

### `/unikit-memory` - the Knowledge-Base Router

`/unikit-memory` is the single entry point for everything that isn't a plain registry install: adding a rule you already know, researching one from scratch, migrating staged rules, reconciling the index, or shrinking a rule that grew too large. It is **module-agnostic** - it reads `.unikit/system/modules.yml`, resolves the target module from an explicit `--module <id>` flag or from the content itself (asking via `AskUserQuestion` on ambiguity), then loads that module's content contract and drives the same generic workflow against it.

**`--module` is usually optional - the skill auto-detects `code` vs `gamedesign` from the prompt.** With no flag, it matches the request (a rule's topic, a URL, a file path) against each registered module's domain: "add a rule for DOTween tweening" reads as `code` (a framework), "document our economy's faucet/sink balance" reads as `gamedesign` (design theory) - both resolve silently with no question asked. `AskUserQuestion` only fires when the wording genuinely fits more than one module, or none at all; `--module <id>` is there for the rare case where you want to force the target instead of relying on inference.

**Registry-first, always.** Before generating anything, the skill checks the registry catalog (`unikit-ai rules list` / `rules status`) for a matching rule. A hit is offered as a direct install - faster and more battle-tested than a freshly generated document. Only a decline, or a genuine miss, falls through to synthesis.

Five workflows, selected from phrasing or input shape:

| Intent | Trigger | What happens |
|--------|---------|--------------|
| **Add Rule** | A concrete, already-known convention ("always use X", "never do Y") | Stored verbatim - no research, no enrichment. Cross-checked against the target file and `RULES.md` for contradictions before appending. |
| **Research** | A URL, a file/folder/PDF/EPUB/FB2 path, or an exploratory description ("add rules for DOTween") | Full pipeline: gather material, enrich (Context7 + targeted `WebSearch`), synthesize, then write. See below. |
| **Migrate Rules** | `migrate-rules`, or a `RULES.md` path | Moves proven entries from the staging buffer into permanent memory - see [Rule Lifecycle](#rule-lifecycle) below. |
| **Validate** | `validate` | Reconciles `RULES_INDEX.md` against the files actually on disk - no user interaction. |
| **Optimise** | `optimise` (bare keyword, optionally naming specific rules) | Retroactively shrinks existing rules by moving large/optional sections into reference files - see below. Relocates content only; never rewrites or deletes it. |

**The Research pipeline** builds a **Source Inventory** (one row per URL/file/folder/Context7 library, with what it covers and any coverage gaps) before synthesizing, so multi-source research stays honest about what it actually read. Folders, PDFs, and EPUB/FB2 books are not read naively - they route through a dedicated large-source workflow (TOC-first → topic map → chunk → cleanup) backed by a self-contained, probe-gated Python 3 helper (`scripts/material-prep.py`) when a Python interpreter is available. The synthesized rule keeps a `## Source Map` section mapping each source to what it informed - conditional, and only when the rule was actually built from external material.

**The Candidate Analyzer** decides what belongs in the main rule versus a reference file - it runs both after synthesis (on-add) and during a later `optimise` pass, so the two paths are judged identically. Each content block is scored on size (≳ 40 lines), optionality, and lookup-shape, and sorted into **Tier 1** (clear wins - large lookup tables, independently-used subsystems, exhaustive variant indexes) and **Tier 2** (borderline calls). The user picks Tier 1 only, Tier 1 + Tier 2, or leaves everything inline; before proposing a new reference file, the analyzer checks for an existing one covering the same topic and extends it instead of forking a near-duplicate.

**A Quality Gate** runs automatically before the skill's final report (for Add Rule and Research; a structural-only pass for Optimise) - it confirms the `Scope`/`Load when` header is prose (not an identifier dump), no template placeholders leaked into the file, `RULES_INDEX.md` has a row for it, and - for freshly synthesized content - that every major topic the rule raises is illustrated by an example and that guidance was distilled rather than copied verbatim.

Whichever branch ran, the skill finishes by running `unikit-ai rules sync` to register the change in `.unikit.json` state and regenerate `RULES_INDEX.md`, then - if the project's registry is local - offers to promote the change into it via `/unikit-rules-registry update`.

### Adding Rules Outside the Registry

If a `code` framework isn't in the registry yet, you need a fully custom `code` rule, or you want a house design convention that isn't part of the canonical `gamedesign` catalog:

- **`/unikit-memory`** - as described above: research from scratch or save a rule as-is, synthesizing directly into `.unikit/memory/code/stack/` for `code`, or `.unikit/memory/gamedesign/library/` for a house design rule via `/unikit-memory --module gamedesign`.
- **Manual** - add a rule file directly to `.unikit/memory/code/core/`, `.unikit/memory/code/stack/`, `.unikit/memory/gamedesign/core/`, or `.unikit/memory/gamedesign/library/`, then run `unikit-ai rules sync` to rebuild that module's `RULES_INDEX.md` and register it in `.unikit.json` as `source: local`.
- **Custom registry** - promote locally-authored rules (either module) into a registry with `/unikit-rules-registry create` so they can be reused across projects. See [Rules Registry](rules-registry.md).

## Rule Lifecycle

New rules should be validated before being promoted to permanent memory. Three layers with clear priority:

```
RULES.md (project-specific, highest priority)
    ↓ fallback
.unikit/memory/code/core/ (always loaded)
    ↓ fallback
.unikit/memory/code/stack/ (loaded on demand)
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
/unikit-memory migrate-rules
```

Migration is **interactive** - the skill asks which rules to migrate and which to skip:

- **Migrate** - the rule moves to `.unikit/memory/code/core/` or `.unikit/memory/code/stack/`, conflicts with existing permanent rules are resolved interactively, and the rule is removed from `RULES.md`
- **Skip** - the rule stays in `RULES.md` as-is. Skipped rules are tagged with `<!-- no-migrate -->` and won't be proposed again in future runs

For each migrated rule, the skill:
1. **Classifies** - determines whether the rule belongs to `.unikit/memory/code/core/` or `.unikit/memory/code/stack/`
2. **Finds target** - searches for an existing file that matches the rule's topic
3. **Validates** - if a matching file exists, checks for intersections and contradictions
4. **Creates or merges** - creates a new file if none exists, or merges into the existing one

```
RULES.md (rule: "Always use UniTask.WhenAll for parallel async")
    ↓ classify → stack
    ↓ find target → .unikit/memory/code/stack/unitask.md exists
    ↓ validate → no contradictions
    ↓ merge into unitask.md
```

The same migration runs for the `gamedesign` module (`/unikit-memory migrate-rules --module gamedesign`) - it classifies staged entries into `core`/`library` instead of `core`/`stack`, per that module's content contract.

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
                                    │ rules to .unikit/│
                                    │ memory/code/     │
                                    └──────────────────┘
```

## See Also

- [Skills Reference](skills.md) - full reference for pipeline skills, the standalone `/unikit-devcontext`, and delegation aliases
- [Game-Design Module](gamedesign.md) - the `gamedesign` module's domain-knowledge rules and its own pipeline
- [Memory & Skill Evolution](evolve.md) - detailed evolve workflow and stale rule cleanup
- [Rules Registry](rules-registry.md) - the registry chain, schema, CLI commands, and `.unikit.json` state fields
- [Configuration](configuration.md) - rules-manifest.json and memory structure
