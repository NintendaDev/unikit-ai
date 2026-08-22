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
- Knowledge base lives in `skills/unikit-help/references/`

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

Fast and Full modes explore your codebase for patterns, create dependency-ordered tasks with effort estimates and file paths. Includes commit checkpoints for 5+ tasks. Generates one `PLAN.md` manifest carrying both the checklist and `## Technical Context`. Add mode extends an existing plan folder without re-exploring.

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
- Reads skill-context rules first, then the plan manifest
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
- Checks against: `RULES.md` (highest priority) → `.unikit/memory/code/core/` → `.unikit/memory/code/stack/`
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

The `gamedesign` module adds eleven `unikit-gd-*` skills for authoring a Game Design
Document along three machine-readable axes — **systems** (the rules), **flows** (the
dynamics), and **content** (the catalog) — plus the one-page `GAME.md`. The quick-reference
entries below follow the pipeline order (recon/brainstorm → spec → system/flow/content →
review/verify → apply/docs); see **[Game-Design Module](gamedesign.md)** for the full
treatment - the axis model, the Decision-First authoring contract, review vs. verify, the
genre-profile seed layer, and the brownfield recon/code-lens/docs boundary.

### `/unikit-gd-recon [optional: description, notes, links, or a subsystem to focus on]` - brownfield reconnaissance

```
/unikit-gd-recon                                  # scan the whole project cold-start
/unikit-gd-recon we built a match-3 with a meta-map, focus the economy
```
- **Cold-start only** - for a live codebase with **no GDD yet**; reconstructs candidate design facts into one passive `.unikit/gamedesign/RECON.md`
- Fans out `Agent(subagent_type: Explore)` per subsystem to extract a system roster + `depends_on` graph (P0) and content-type schemas / resources / entities (P1) - flows are excluded, they aren't recoverable from code
- Every extracted fact is tagged `provenance: extracted from code`; a mandatory `## Intent Gap` section records what code cannot reveal (pillars, fantasy, the "why")
- Has no `Skill` tool - only **recommends** `/unikit-gd-spec <RECON.md>` (import) as printed text, never calls it. If a GDD already exists it redirects to the `/unikit-gd-explore` code-grounded lens instead

### `/unikit-gd-brainstorm [hint or theme]` - concept ideation

```
/unikit-gd-brainstorm                             # blank page
/unikit-gd-brainstorm a cozy farming sim with a mystery hook
```
- Structured divergence/convergence dialogue (pillars, loops, pre-mortem) from a blank page or a one-line hint to a finished `CONCEPT.md` card; rejected ideas are parked in `IDEAS.md`
- Auto-resumes an in-progress concept via `concepts/INDEX.md`
- Delegates market validation to `/unikit-gd-explore` at Phase 3.5 (a brief returns into the session - no `researches/` file, avoids anchoring on market data too early)
- Writes a descriptive, CLI-free `genre:` hint into the concept card - see **Genre profiles** in [Game-Design Module](gamedesign.md)

### `/unikit-gd-explore [init | topic | reference | market question | reviews/*.md | RECON.md | "<system> in the code"]` - design research partner

```
/unikit-gd-explore how do roguelike deckbuilders handle run-modifiers
/unikit-gd-explore improve the crafting system                    # internal-design lens
/unikit-gd-explore how is the inventory system actually built in the code   # code-grounded lens
/unikit-gd-explore init                                           # rebuild researches index
```
- Read-only research partner - studies references, market fit, or the existing GDD/code; **never authors** the design itself
- Four lenses: reference & market (dissection, market signal), internal design (improve a system / work out a new mechanic, closes with a mode-aware brief), code-grounded (the sanctioned one-way-boundary exception - reads a named code slice, tags findings `provenance: extracted from code`), and research-bucket (develops a review's open questions in place)
- Saves to `.unikit/gamedesign/researches/<date>_<slug>/`; a review file is mutated in place instead of getting a new folder
- Routes onward without asking based on the target's `doc_status` (no doc → spec add-system; `skeleton` → system; `detailed`+ → system as a delta)

### `/unikit-gd-spec [path-to-existing-GDD | URL | free-form description]` - the master GDD + registry

```
/unikit-gd-spec A roguelike deckbuilder about a traveling merchant
/unikit-gd-spec ./old-gdd.docx                    # import an existing GDD
/unikit-gd-spec add a crafting system              # Add-System mode
```
- Owns `GAME.md` (the authored one-pager - pillars, loop stack, win/lose, monetization stance, non-goals) plus its generated `## System Map [gen]` / `## Flow Map [gen]` / `## Funnel [gen]` / `## Content Map [gen]`, and `GD-IDS.yaml` (the facts registry code reads)
- Mode inferred from the argument: Create, Import (path/URL), Pitch (→ `PITCH.md`), Remap (rebuild the map), Add-System (graft one system onto an existing map)
- The **only** writer of the system roster - a flow/content type naming a missing system routes back here
- On Create, best-fits a genre hint to the bundled genre-profile catalog and runs a seed interview (see [Game-Design Module](gamedesign.md#genre-profiles-the-seed-layer))

### `/unikit-gd-system <system name | SYS-slug> ["<what to change>"]` - the systems (rules) axis

```
/unikit-gd-system add a crafting system            # create
/unikit-gd-system crafting                         # fill in placeholders
/unikit-gd-system crafting buff success rate to 70%  # revise (tune/tweak/rework)
```
- Owns one system's full A-K doc at `systems/SYS-<slug>.md` for its whole lifecycle - create skeleton, fill via Decision-First (Depth → Fork scan → Decision interview → Generation → Group review → Final), and revise under the version+changelog delta discipline
- Auto-attaches domain section-packs (combat, economy, progression, narrative, UX, AI-behavior, persistence, ...) inferred from the system's name/overview
- Requires the system to already be on the `GAME.md` roster - a missing one routes to `/unikit-gd-spec` add-system first

### `/unikit-gd-flow <flow name | FLOW-slug> ["<what to change>"]` - the flows (dynamics) axis

```
/unikit-gd-flow the first-session onboarding flow   # create
/unikit-gd-flow onboarding retune the pacing after level 3  # revise
```
- Owns one flow's doc at `flows/FLOW-<slug>.md` - what the player does over time: objective flow, pacing, dependencies, funnel events - for its whole lifecycle (create/fill/revise, same delta discipline as systems)
- Picks the **wiring mode** (`linear` / `conditional` / `emergent`, inferred from genre/pillars) which dictates the doc's section B/C structure
- Self-registering - writes its own `flows:`/`events:` GD-IDS rows and re-renders `## Flow Map [gen]` / `## Funnel [gen]`; there is no add-flow step in `/unikit-gd-spec`

### `/unikit-gd-content <content type name | CT-slug> ["<what to change>"]` - the content (catalog) axis

```
/unikit-gd-content add an item content type     # create / fill / revise a CT-<slug>
```
- Owns one content type's `CONTENT-TYPE.md` for its full lifecycle (schema + descriptor)
- `CT.fields` is a typed schema; `ref<>` makes a content↔X link a field; `scale` is `bulk` (a `count`+`spec` descriptor) or `curated` (`fields` rows in the registry)
- Registers itself (`content_types:` / `content:` + RES/TRACK/KNOB) and re-renders `## Content Map [gen]`
- `belongs_to` names the consuming system (one-way); a missing system routes to `/unikit-gd-spec` add-system

### `/unikit-gd-review [system name | SYS-slug | path | "all"]` - qualitative design review

```
/unikit-gd-review crafting
/unikit-gd-review all
```
- Answers "is this design **good** - fun, balanced, coherent with the pillars?" via a parallel adversarial lens fan-out (fantasy-delivery, systems-math, provenance, feasibility, and domain lenses)
- Only write: `.unikit/gamedesign/reviews/<date>_review-<scope>.md` - never edits GDD content or `doc_status`; findings get a stable `RF-<date>-n` id and **can be declined**
- Sorts findings into two buckets and prints the handoff command - apply-ready → `/unikit-gd-apply`, needs-research → `/unikit-gd-explore`

### `/unikit-gd-verify [system name | SYS-slug | question]` - mechanical consistency check

```
/unikit-gd-verify
/unikit-gd-verify crafting
```
- Answers "is the design **consistent with itself**?" - grep-first checks against `GD-IDS.yaml`: IDs, terminology, dangling/unregistered facts, roster↔disk + map freshness, Depends 3-way, status/version coherence, AC presence, placeholder leaks
- Fully read-only - no report file, no changelog, no `doc_status` bump; prints an inline conflict report and hands apply-ready fixes to `/unikit-gd-apply`
- Unlike review, a conflict is a fact, not a finding - you only choose *how* to fix it, not whether

### `/unikit-gd-apply ["<changes>"] | <reviews/*_review-*.md>` - multi-zone edit dispatcher

```
/unikit-gd-apply "buff combat 10%, add a loot rarity field, retune onboarding pacing"   # one multi-zone edit
/unikit-gd-apply reviews/2026-07-01_review-crafting.md   # apply-ready bucket from a review
```
- Carries out an explicit, **multi-zone** GDD edit you have already decided - it owns nothing and writes nothing (only `Skill` in its tool list)
- Resolves each delta to its `(target, zone)` and dispatches **system-before-sinks** (`/unikit-gd-spec` → `/unikit-gd-system` → `/unikit-gd-content` → `/unikit-gd-flow`), then closes with one bare `/unikit-gd-verify`
- A **single-zone** edit goes straight to the owner; an open question to research goes to `/unikit-gd-explore` first
- A new system a delta needs is created via `/unikit-gd-spec` add-system in the first tier (create + dependent revise in one pass)

### `/unikit-gd-docs [--web]` - GDD to human-readable docs

```
/unikit-gd-docs          # render docs/design/*.md
/unikit-gd-docs --web    # also render an HTML site
```
- Read-only leaf renderer (no `Skill` tool) - turns the design workspace into `docs/design/{index,systems,flows,content,economy,glossary}.md`, resolving facts inline from `GD-IDS.yaml`; drafts are flagged 🚧
- `--web` additionally renders HTML from the `unikit-docs` template (falls back to Markdown-only + a `WARN` if the template is absent)
- The design-doc mirror of `/unikit-docs` - that skill owns top-level `docs/*.md` (the code project's docs), this one owns `docs/design/**`

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

### `/unikit-mcp-trap [finding | plan path]` - record an MCP finding

```
/unikit-mcp-trap                                 # Harvest findings from the current session
/unikit-mcp-trap the snapshot reported ready with zero files
/unikit-mcp-trap .unikit/code/plans/2026-08-18_ui/PLAN.md   # Take this plan's table, nothing else
```
- Writes `.unikit/MCP-RECHECK-NOTES.md` - the project's log of what has to be re-checked about the **engine MCP server it actually talks to**
- Zero MCP calls, no editor required: a finding was already observed, and re-observing it could record the wrong thing
- Three input forms. **A finding in one line** is recorded directly. **A path to a plan file** harvests that plan's `## MCP Findings` table and nothing else — the session is not consulted at all, which matters because the caller is usually the run that just produced those rows. **No argument** takes findings from the session first, then offers to scan the tables of plans touched since the last audit
- Reads **the table only**, never the plan body: a window from the heading to the next `##`, with a 30-line cap that applies only to the multi-plan scan — and a table outgrowing it is announced, not truncated in silence
- `/unikit-implement` offers the transfer at the end of a run (Step 5.5), passing the plan path, so findings recorded per task reach the durable log while the context is still there
- Every note is written in one genre - **a check to perform**. A lifted gate or a "use Y instead of X" is refused: a stale check costs one call and fails safe, a lifted obligation never comes back
- The executor that hit the trap does not write here - one observation is a bad sample, and a bad line lives for months, so the durable surface passes through a human

### `/unikit-mcp-audit [R2 | stamp | replay | retire | upstream]` - curate the MCP notes

```
/unikit-mcp-audit                                # Full pass: stamp, replay, retire, upstream
/unikit-mcp-audit R2                             # One note
/unikit-mcp-audit upstream                       # Only print the diff for the packaged rules tree
```
- Four jobs: **re-stamp** (the server moved → every entry is suspect, and offered first), **replay** (`replay: safe` rows reproduced in a disposable sandbox), **retire** (offer to drop what was fixed or went upstream), **upstream** (print a ready diff for the packaged `INDEX.md`)
- Replaying mutates a live editor, so it runs behind a six-step envelope whose only gate is **you**: it opens by telling you how to prepare the editor (save your scene, open an empty one, no compile and no Play Mode), names every object it will create, and asks once. It works only inside a `UNIKIT_AUDIT_<runid>` sandbox, deletes it in one action, and **never saves the scene** - so even a failed sweep leaves nothing on disk
- **It takes no pre-flight measurements, on purpose.** The previous gate refused on a dirty scene - and a fresh empty untitled scene, the one safe place to run this, is dirty by default, so the gate rejected the only correct state every time while a configured production scene passed. Such a check is not portable either: across the catalog, one server reports no scene-dirty state, one does not document editor state, and one runs an engine with no concept of compiling
- The sweep is proved, not announced: a prefix search returning zero plus a clean console delta, or a loud `ERROR` listing what remains - never a blind repeat of the deletion
- Deletes only what it created in this run. Leftovers from an aborted earlier run are recognisable by their `<runid>` and swept only under a separate confirmation
- A **project** tool, not a release tool: it never edits the packaged rules tree (`init`/`update` rewrite it), it prints a PR diff instead

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
