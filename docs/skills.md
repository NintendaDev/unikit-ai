[← Development Workflow](workflow.md) · [Back to README](../README.md) · [Subagents →](subagents.md)

# Skills Reference

## Help & Navigation

### `/unikit-help` - framework navigator

Not sure what to do next, or which skill to use? Start here.
```
/unikit-help                          # short diagnostic (one question)
/unikit-help how do I start coding     # routed straight to the right flow
/unikit-help which skill fixes a bug
```
- Read-only navigator: diagnoses your intent and points you at the right skill/pipeline — it never does the work itself
- No arguments → asks one short diagnostic question instead of dumping a manual
- Covers the whole framework: setup, the code pipeline, testing, the game-design module, rules/memory, and "which skill for X"
- Knowledge base lives in `skills/unikit-help/references/`; see [unikit-help](unikit-help.md) for details

---

## Setup Skills

### `/unikit` - project setup

Scans your Unity project and sets up AI context:
```
/unikit
```
- Scans `Packages/manifest.json`, `Assets/Plugins/`, `Assets/Third-Party Assets/`, `Assets/Modules/`, `.asmdef` files, and `ProjectSettings/`
- Generates `.unikit/DESCRIPTION.md` (project specification) and `AGENTS.md`
- Invokes `/unikit-architecture` for architecture guidelines
- **Does NOT implement** - only sets up context

### `/unikit-architecture` - architecture analysis

Generates architecture guidelines:
```
/unikit-architecture
```
- Reads `.unikit/DESCRIPTION.md` for project context
- Analyzes folder structure, assembly definitions, dependency patterns
- Generates `.unikit/ARCHITECTURE.md` with folder structure, dependency rules, communication patterns
- Called automatically by `/unikit` during setup, but can also be used standalone

---

## Workflow Skills

These skills form the core development loop. See [Development Workflow](workflow.md) for the full diagram and how they connect.

### `/unikit-explore [init | topic]` - discovery before planning

```
/unikit-explore real-time multiplayer sync
/unikit-explore the inventory system is getting complex
/unikit-explore init                                     # Rebuild researches index
```
- Thinking-partner mode for exploring ideas, constraints, and trade-offs without implementing code
- Reads project context (DESCRIPTION.md, ARCHITECTURE.md, RULES.md) and the knowledge base
- Saves results to `.unikit/code/researches/<date>_<name>/` with `RESEARCH_RESULT.md`, `RESEARCH_BRIEF.md`, and optionally `RESEARCH_SOURCE.md`
- Maintains `researches/INDEX.md`; use `init` to rebuild the index
- When direction is clear, transition to `/unikit-plan`

### `/unikit-plan [fast|full|add|--list] [--base <branch>] <description>` - plan the work

```
/unikit-plan Add item rarity system              # Asks which mode
/unikit-plan fast Add sound effects manager       # Quick plan, no branch
/unikit-plan full Add item rarity system          # Git branch + full plan
/unikit-plan add Add visual effects to rarity     # Extend existing plan
/unikit-plan --list                               # List available plans
/unikit-plan full --base main Add new feature     # Specify base branch for full mode
```

Three modes:
- **Fast** - no git branch, saves plan to `.unikit/code/PLAN.md` (single flat file)
- **Full** - creates git branch, asks about testing/logging, saves plan
- **Add** - extends an existing plan with new tasks

Fast and Full modes explore your codebase for patterns, create dependency-ordered tasks with effort estimates and file paths. Includes commit checkpoints for 5+ tasks. Generates `TASKS.md` (checklist) and `PLAN-BRIEF.md` (technical context). Add mode extends an existing plan folder without re-exploring.

### `/unikit-improve [--list] [@plan-folder] [prompt]` - refine the plan

```
/unikit-improve                                          # Improve latest plan
/unikit-improve add validation and error handling        # Improve with specific focus
/unikit-improve --list                                   # List available plans
/unikit-improve @.unikit/code/plans/2026-03-10_core-loop      # Improve specific plan
```
- Second-pass analysis: finds missing tasks, fixes dependencies, removes redundant work
- Performs deeper codebase analysis than initial `/unikit-plan`
- Shows diff-like report before applying changes
- `--list` shows available plans; `@<path>` targets a specific plan folder

### `/unikit-implement [--list] [@folder] [selector]` - execute the plan

```
/unikit-implement                    # Continue all pending tasks
/unikit-implement --list             # List available plans
/unikit-implement status             # Show progress without executing
/unikit-implement Phase 3            # Execute only Phase 3
/unikit-implement Phases 1-3         # Execute Phases 1 through 3
/unikit-implement Tasks 2.1 2.3 5.2  # Execute specific tasks
/unikit-implement core-loop          # Find plan by name
/unikit-implement @.unikit/code/plans/2026-03-10_core-loop  # Explicit plan path
```
- Reads skill-context rules first, then plan TASKS.md
- Executes tasks one by one with commit checkpoints
- Bootstraps rules and engine principles once (`.unikit/system/dev-principles.md` + core rules) and implements tasks inline with `Read/Edit/Write/Bash`. The `develop-agent` alias is used only for true parallel scopes or deep-dive single tasks
- Supports selective execution by phase, task numbers, or feature name
- `@<path>` bypasses auto-detection for explicit plan targeting

### `/unikit-fix [bug description]` - fix and learn

```
/unikit-fix NullReferenceException in CustomerItemView.OnInit
```
- Two modes: **Fix now** (immediate) or **Plan first** (creates `.unikit/code/FIX_PLAN.md`)
- Investigates codebase to find root cause
- Applies fix and suggests test coverage
- Creates a **self-improvement patch** in `.unikit/code/patches/`
- Every fix makes the AI smarter through `/unikit-evolve`

### `/unikit-verify [--strict] [feature-name]` - check completeness

```
/unikit-verify                           # Verify implementation against plan
/unikit-verify --strict                  # Strict mode - zero tolerance for gaps
/unikit-verify 2026-03-08_customers      # Verify specific feature
```
- Goes through every task in the plan and verifies the code actually implements it
- Checks build, tests, looks for leftover TODOs, plan-vs-code drift
- Context gates: checks architecture/rules alignment
- If gaps found, suggests `/unikit-fix <issue summary>`
- Strict mode recommended before merging

### `/unikit-commit [scope]` - conventional commits

```
/unikit-commit
/unikit-commit inventory
```
Creates conventional commits with Unity-specific checks:
- Analyzes staged changes (`git status` + `git diff --cached`)
- Verifies `.meta` file pairing
- Checks for binary assets, secrets, Unity-ignored directories
- References plan tasks in commit message when applicable
- Follows conventional commits format (feat, fix, refactor, etc.)
- Suggests commit splitting for unrelated changes
- Offers to push after commit

### `/unikit-evolve` - improve skills from experience

```
/unikit-evolve
```
- Reads patches from `.unikit/code/patches/` incrementally using an evolve cursor
- Extracts prevention points from each patch (multiple per patch)
- Classifies: code/architecture rules → `RULES.md`; skill workflow issues → `skill-context/`
- Cross-checks against existing rules and knowledge base to avoid duplicates
- Proposes targeted improvements with user approval
- Closes the learning loop: **fix → patch → evolve → better skills → fewer bugs**

### `/unikit-roadmap [check | vision]` - strategic planning

```
/unikit-roadmap                              # Create or update roadmap
/unikit-roadmap SaaS pawnshop management     # Create from vision
/unikit-roadmap check                        # Automated progress scan
```
- High-level project planning with milestone tracking (5-15 milestones recommended)
- Creates `.unikit/ROADMAP.md` - strategic checklist of major milestones
- First run: explores codebase, asks for goals, generates roadmap
- Subsequent runs: review progress, add/reprioritize/mark milestones done
- `check` mode: automated progress scan without interactive prompts

### `/unikit-review` - code review

Reviews code against the project's rule hierarchy. Four modes:
```
/unikit-review                         # Staged changes (default)
/unikit-review PlayerController.cs     # Specific file(s)
/unikit-review @Assets/Scripts/Player  # Folder (all .cs files)
/unikit-review 123                     # PR by number (#42 or URL also work)
/unikit-review master                  # Commits vs branch/tag
```
- Checks against: `RULES.md` (highest priority) → `memory/core/` → `memory/stack/`
- Loads stack rules selectively based on frameworks detected in target code
- Severity scale: Critical, Warning, Medium, Suggestion
- Reports include concrete code fixes for Critical/Warning items

---

## Development Skills

### `/unikit-devcontext` - standalone development skill

A standalone skill for writing, reviewing, or refactoring a single file or fragment without a plan:
- Senior engine/language developer persona with full knowledge base access
- Loads `dev-principles.md`, `RULES.md`, core rules from `RULES_INDEX.md`, and stack rules on demand
- Used when working outside a pipeline (for example, a one-off file edit)
- Pipeline skills (`/unikit-implement`, `/unikit-fix`, `/unikit-verify`) no longer delegate every task here - they Bootstrap the same rules once and implement inline. Use `/unikit-devcontext` when you have no plan, or spawn it through the `develop-agent` alias for true parallel scopes or deep-dive single tasks

---

## Dynamic Memory Skills

### `/unikit-memory` - manage knowledge base rules

```
/unikit-memory add stack rule for DOTween           # Add rule from description
/unikit-memory https://docs.example.com/guide       # Research from URL
/unikit-memory Assets/Plugins/MyLib/README.md        # Research from file
/unikit-memory migrate-rules                         # Migrate RULES.md to memory
/unikit-memory validate                              # Sync RULES_INDEX.md with actual files
/unikit-memory --skip-registry add rule for DOTween  # Skip registry lookup, generate directly
```
- Four branches: Add Rule (direct), Research (URL/file + Context7 enrichment), Migrate (`migrate-rules`), Validate (`validate` - syncs index with actual files)
- **Registry-first lookup** - before generating a rule, checks the remote registry catalog for an existing match; offers to install the vetted version instead of generating a local copy
- `--skip-registry` - bypass the registry lookup (used by higher-level callers that already queried the catalog)
- Add or update rules in `.unikit/memory/` (core and stack)
- Cross-checks against existing rules to detect duplicates and contradictions
- Maintains `RULES_INDEX.md` after changes

### `/unikit-rules` - project-specific rules

```
/unikit-rules Always use UniTask instead of coroutines
/unikit-rules
```
- Saves rules to `.unikit/RULES.md` (highest priority in rule hierarchy)
- Cross-checks against knowledge base in `memory/` via `RULES_INDEX.md`
- Rules loaded automatically by `/unikit-implement` before task execution

### `/unikit-rules-registry` - external registry orchestrator

```
/unikit-rules-registry create   # Scaffold a new local registry seeded from .unikit/memory/
/unikit-rules-registry update   # Push changes from .unikit/memory/ into the local registry
/unikit-rules-registry sync     # Pull registry updates back into .unikit/memory/
/unikit-rules-registry          # Interactive mode selector
```

Three modes (direction matters):

- **`create`** - scaffolds a new local registry repository and seeds it with rules from `.unikit/memory/` (memory → registry). Injects `version: 1.0.0` into rule frontmatter. Optionally switches the project to use the new registry via `unikit-ai rules registry set` + `rules sync --replace --prune`
- **`update`** - diffs `.unikit/memory/` against the currently configured local registry, computes automatic semver bumps (major/minor/patch), writes changed rules back to the registry, cleans up orphaned reference files via reference-graph check, regenerates `manifest.json`, and reconciles `.unikit.json` state via `rules install --force` (memory → registry)
- **`sync`** - pulls registry-side updates into `.unikit/memory/` via `unikit-ai rules sync` with a choice of intensity: Safe (version-changed only), Replace (also overwrites local modifications), Mirror (replace + prune obsolete stack rules) (registry → memory)

This skill is the counterpart to `unikit-ai rules *` CLI - it orchestrates the full registry lifecycle. See [Rules Registry](rules-registry.md) for the underlying CLI commands.

---

## Game Design Skills

The `gamedesign` module adds eight `unikit-gd-*` skills for authoring a Game Design
Document along three machine-readable axes — **systems** (the rules), **flows** (the
dynamics), and **content** (the catalog) — plus the one-page `GAME.md`. See
**[Game-Design Module](gamedesign.md)** for the full treatment.

### `/unikit-gd-content` - the content (catalog) axis

```
/unikit-gd-content add an item content type     # create / fill / revise a CT-<slug>
```
- Owns one content type's `CONTENT-TYPE.md` for its full lifecycle (schema + descriptor)
- `CT.fields` is a typed schema; `ref<>` makes a content↔X link a field; `scale` is `bulk` (a `count`+`spec` descriptor) or `curated` (`fields` rows in the registry)
- Registers itself (`content_types:` / `content:` + RES/TRACK/KNOB) and re-renders `## Content Map [gen]`
- `belongs_to` names the consuming system (one-way); a missing system routes to `/unikit-gd-spec` add-system

### `genres` (CLI) - bundled genre-profile catalog

```
unikit-ai genres list                 # the §4.1-4.6 genre catalog (with an installed marker)
unikit-ai genres show <id|alias>      # one profile (--json = the full object)
unikit-ai genres install <id|alias…>  # selectively install profile(s)
```
- A **bundled, read-only** catalog (no registry, no network) that seeds GDD authoring: default flow-mode, packs, and *suggested* systems / content types / entities / resources
- **Skill-driven**, not user-typed: `/unikit-gd-brainstorm` writes a descriptive `genre:` hint; `/unikit-gd-spec` best-fits it to a profile, installs it, and runs a seed interview
- `/unikit-gd-review` reads the profile for a genre-completeness lens; `/unikit-gd-verify` stays **genre-blind**. The profile is read-only — divergence lands in `GD-IDS.yaml`
- Exit codes are a subset of the rules CLI: `0`/`1`/`3`

---

## Knowledge Base Skills

### `/unikit-docs [--web]` - documentation generation

```
/unikit-docs          # Generate or improve documentation
/unikit-docs --web    # Also generate HTML version
```
- Analyzes codebase and creates README + `docs/` directory with topic pages
- Auto-detects Unity tech stack (DI, async, event systems, UI frameworks)
- Reads language setting from `.unikit/config.yaml` (`language.ui` / `language.artifacts`) - documentation generated in the configured language
- Supports `docs-config.json` for path and document customization
- Generates HTML documentation site with `--web` flag

---

## Skill Overrides

### `/unikit-skills-context` - skill overrides

```
/unikit-skills-context review "Always check null-check symmetry first"  # Add rule to specific skill
/unikit-skills-context                                                  # Interactive mode
/unikit-skills-context validate                                         # Check all skills for stale rules
/unikit-skills-context validate review                                  # Check specific skill
```
- Manage project-specific workflow rules for any `unikit-*` skill
- Overrides live in `.unikit/skill-context/<skill>/SKILL.md`
- Higher priority than base SKILL.md instructions
- `validate` mode checks for stale rules against updated base skills

---

## Utility Skills

### `/unikit-todo` - task management

```
/unikit-todo Refactor inventory save system      # Add task
/unikit-todo complete refactor inventory         # Mark task complete by description
/unikit-todo complete                            # Auto-verify: scan codebase for resolved tasks
/unikit-todo list                                # Show pending and completed tasks
/unikit-todo purge                               # Remove completed tasks
```
- Manages TODO list in `.unikit/TODO.md`
- Add tasks (deduplicates, refines verbose descriptions), mark complete, view status
- Also triggered by "remind me to...", "don't forget to...", "we need to..."

---

## Agents

UniKit ships two tiers of agents - top-level **coordinators** (launched via `claude --agent <name>`) and **internal workers/sidecars** spawned by them - plus three **delegation aliases** (`develop-agent`, `rules-agent`, `docs-agent`) that workflow skills expand into `Agent(subagent_type: "general-purpose", skills: [...])` calls.

After the Bootstrap refactor, pipeline skills (`/unikit-implement`, `/unikit-fix`, `/unikit-verify`) own code-writing inline and use `develop-agent` only for true parallel scopes or deep-dive single tasks. `rules-agent` and `docs-agent` keep their usual role of capturing rules and documentation.

For the full reference - frontmatter, launch commands, design principles, sidecar output contracts - see [Subagents](subagents.md).

## See Also

- [Subagents](subagents.md) - coordinators, workers, sidecars, delegation aliases
- [Development Workflow](workflow.md) - how workflow skills connect end-to-end
- [Dynamic Memory](dynamic-memory.md) - Bootstrap pattern, how pipeline skills load rules, standalone unikit-devcontext
- [Plan Files](plan-files.md) - where workflow artifacts are stored
