[← Best Practices](best-practices.md) · [Back to README](../README.md) · [Skills Reference →](skills.md)

# Development Workflow

UniKit AI has two phases: **configuration** (one-time project setup) and the **development workflow** (repeatable loop of explore → plan → improve → implement → review → verify → commit → evolve).

## Why Spec-Driven?

- **Predictable results** - AI follows a plan, not random exploration
- **Resumable sessions** - progress saved in plan files, continue anytime
- **Commit discipline** - structured commits at logical checkpoints
- **No scope creep** - AI does exactly what's in the plan, nothing more

## Project Configuration

Run once per project. Sets up context files that all workflow skills depend on.

```
┌───────────────────────────────────────────────────────────────────────┐
│                        PROJECT CONFIGURATION                          │
└───────────────────────────────────────────────────────────────────────┘

 ┌──────────────┐     ┌──────────────┐     ┌─────────────────────────────┐
 │              │     │    claude    │     │          /unikit             │
 │  unikit-ai   │ ──▶ │  (or any AI  │ ──▶ │                             │
 │    init      │     │    agent)    │     │  Scan stack, generate:      │
 │              │     │              │     │    DESCRIPTION.md           │
 └──────────────┘     └──────────────┘     │    AGENTS.md               │
                                           │    ARCHITECTURE.md         │
                                           │    Stack rules for memory  │
                                           └──────────────┬──────────────┘
                                                          │
                          ┌───────────────────────────────┼────────────────────┐
                          │                               │                    │
                          ▼                               ▼                    ▼
             ┌──────────────────────┐      ┌──────────────────┐  ┌──────────────────┐
             │ /unikit-architecture │      │  /unikit-memory  │  │  /unikit-rules   │
             │   (refine arch.)     │      │   (add rules)    │  │   (optional)     │
             └──────────┬───────────┘      └────────┬─────────┘  └──────────────────┘
                        │                           │
                        ▼                           ▼
             ┌──────────────────┐        ┌──────────────────┐
             │  /unikit-roadmap │        │   /unikit-docs   │
             │  (recommended)   │        │   (optional)     │
             └──────────────────┘        └──────────────────┘
```

## Development Workflow

The repeatable development loop. Each skill feeds into the next, sharing context through plan files and patches.

Optional discovery step: use `/unikit-explore` before planning to investigate ideas, compare options, and clarify requirements.

```
┌───────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT WORKFLOW                            │
└───────────────────────────────────────────────────────────────────────┘

     Need to think first?
              │
              ▼
     ┌──────────────────┐
     │  /unikit-explore  │
     │   clarify scope   │
     │   compare paths   │
     └─────────┬────────┘
               │
               ▼
 ┌──────────────────────────┐                ┌────────────────────┐
 │      /unikit-plan        │                │    /unikit-fix     │
 │                          │                │                    │
 │  fast → no branch,       │                │   Bug fixes        │
 │         TASKS.md         │                │   With patches     │
 │  full → git branch,      │                │                    │
 │         TASKS.md         │                └─────────┬──────────┘
 │  add  → extend plan      │                          │
 └─────────────┬────────────┘                          ▼
               │                          ┌────────────────────┐
               │                          │   .unikit/         │
               │                          │     patches/       │
               │                          │   Self-improvement │
               │                          └─────────┬──────────┘
               │                                    │
               ▼                                    │
 ┌──────────────────────────┐                       │
 │   /unikit-improve        │                       │
 │     (optional)           │                       │
 │   Refine plan with       │                       │
 │   deeper analysis        │                       │
 └─────────────┬────────────┘                       │
               │                                    │
               ▼                                    │
 ┌──────────────────────────┐                       │
 │   /unikit-implement      │ ◀── skill-context ───┘
 │     Execute tasks        │
 │     Commit checkpoints   │
 └─────────────┬────────────┘
               │
               ▼
 ┌──────────────────────────┐
 │   /unikit-review         │
 │     (optional)           │
 │   Code review against    │
 │   project rules          │
 └─────────────┬────────────┘
               │
               ▼
 ┌──────────────────────────┐
 │   /unikit-verify         │
 │     (optional)           │
 │   Check completeness     │
 │   against the plan       │
 └─────────────┬────────────┘
               │
               ▼
 ┌──────────────────────────┐
 │   /unikit-commit         │
 └─────────────┬────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
   More work?      Done!
   Loop back ↑        │
                      ▼
          ┌──────────────────────┐
          │   /unikit-evolve     │
          │   Reads new patches  │
          │   Improves skills    │
          └──────────────────────┘
```

## When to Use What?

| Command | Use Case | Creates Branch? | Output |
|---------|----------|-----------------|--------|
| `/unikit-roadmap` | Strategic planning, milestones, long-term vision | No | `.unikit/ROADMAP.md` |
| `/unikit-roadmap check` | Automated progress scan | No | Reads existing roadmap |
| `/unikit-explore` | Research new ideas (broad or focused), option comparison, requirements clarification before planning | No | `.unikit/researches/<date>_<name>/` (optional - output can be used directly in the current session for fast planning) |
| `/unikit-plan fast` | Small tasks, quick fixes, experiments | No | `.unikit/PLAN.md` |
| `/unikit-plan full` | Full features, stories, epics | Yes | `.unikit/plans/{date}_{name}/` |
| `/unikit-plan add` | Extend existing plan with new tasks | No | Modifies existing plan |
| `/unikit-improve` | Refine plan before implementation | No | Improves existing plan |
| `/unikit-implement` | Execute plan tasks one by one | No | Updates `TASKS.md` status |
| `/unikit-fix` | Bug fixes, errors, hotfixes | No | Optional `.unikit/FIX_PLAN.md` |
| `/unikit-verify` | Post-implementation quality check | No | Verification report |
| `/unikit-review` | Code review against rules | No | Review report |
| `/unikit-commit` | Conventional commits with Unity checks | No | Git commit |
| `/unikit-todo` | Lightweight task tracking | No | `.unikit/TODO.md` |

## Self-Learning Memory Through Evolve

UniKit AI has a built-in learning loop that makes skills smarter over time:

```
/unikit-fix → creates patch → /unikit-evolve → classifies → updates rules/skill-context
```

`/unikit-evolve` analyzes accumulated patches from `.unikit/patches/` and classifies them into **two categories**:

1. **Code and architecture rules** - problems in code, architectural patterns, recurring mistakes → written to `RULES.md` and correct the framework's general memory
2. **Skill workflow issues** - when a skill worked incorrectly, gave bad recommendations → written to `skill-context/` as overrides for the specific skill

From `RULES.md`, rules can be migrated to the dynamic memory `memory/` via `/unikit-memory --migrate-rules`. Use `/unikit-memory validate` to check rule health and detect stale or contradicting rules.

**Full chain:** `/unikit-fix` (creates patch) → `/unikit-evolve` (classifies and applies) → `/unikit-memory --migrate-rules` (migrates mature rules from `RULES.md` into permanent dynamic memory - `core/` or `stack/`)

## Artifact Ownership and Context Gates

Ownership is command-scoped to avoid conflicting writers:

| Command | Primary artifact ownership | Notes |
|---------|--------------------------|-------|
| `/unikit` | `.unikit/DESCRIPTION.md`, `AGENTS.md` | Invokes `/unikit-architecture` + rule generation |
| `/unikit-architecture` | `.unikit/ARCHITECTURE.md` | Architecture guidelines |
| `/unikit-roadmap` | `.unikit/ROADMAP.md` | Milestone tracking |
| `/unikit-rules` | `.unikit/RULES.md` | Append/update rules only |
| `/unikit-plan` | `.unikit/plans/*/TASKS.md`, `PLAN-BRIEF.md` | `/unikit-improve` refines |
| `/unikit-explore` | `.unikit/researches/` | Exploration artifacts |
| `/unikit-fix` | `.unikit/FIX_PLAN.md`, `.unikit/patches/*.md` | Bug-fix learning loop |
| `/unikit-evolve` | `.unikit/evolutions/*`, `.unikit/skill-context/*` | Evolution logs + skill overrides |
| `/unikit-memory` | `.unikit/memory/core/`, `stack/`, `RULES_INDEX.md` | Dynamic memory management |
| `/unikit-skills-context` | `.unikit/skill-context/<skill>/SKILL.md` | Skill workflow overrides |
| `/unikit-implement` | `.unikit/plans/*/TASKS.md` (status updates) | Marks tasks complete |
| `/unikit-todo` | `.unikit/TODO.md` | Lightweight task list |
| `/unikit-docs` | `README.md`, `docs/*.md`, `AGENTS.md` | Documentation generation |
| `/unikit-commit` `/unikit-review` `/unikit-verify` | read-only context | Gate and report, no writes |

## Workflow Skills

These skills form the development pipeline. Each one feeds into the next.

### `/unikit-roadmap [check | vision]` - strategic planning

```
/unikit-roadmap                              # Create or update roadmap
/unikit-roadmap Open-world survival RPG       # Create from vision
/unikit-roadmap check                        # Auto-scan: find completed milestones
```

High-level project planning with milestone tracking (5-15 milestones). Recommended for breaking down large goals into smaller pieces of work, understanding what can be done independently, and determining the best execution order.

Creates `.unikit/ROADMAP.md` - a strategic checklist of major milestones (not granular tasks). First run: explores codebase, asks for goals, generates roadmap. Subsequent runs: review progress, add/reprioritize/mark milestones done. `check` mode automatically scans the codebase and git history for evidence of completed milestones. `/unikit-implement` also checks the roadmap after completing plan tasks.

### `/unikit-explore [init | topic]` - discovery before planning

```
/unikit-explore real-time multiplayer sync
/unikit-explore the inventory system is getting complex
/unikit-explore init
```

Thinking-partner mode for exploring ideas, constraints, and trade-offs without implementing code. Reads project context (DESCRIPTION.md, ARCHITECTURE.md, RULES.md) and the full knowledge base at startup. Saves results to `.unikit/researches/YYYY-MM-DD_name/` with three files:

- `RESEARCH_RESULT.md` - structured research output with comparison tables, ASCII diagrams, and trade-off analysis
- `RESEARCH_BRIEF.md` - agent-optimized summary designed for downstream workflow skills to consume efficiently
- `RESEARCH_SOURCE.md` - aggregation of original prompts, agent questions, and all user answers that drove the research

All three files are automatically picked up by `/unikit-plan` - the planner reads them, incorporates context from all angles (structured analysis, agent-readable brief, raw decision history), and links the research as a source in the generated plan. Saving artifacts is the recommended approach for maximum code quality, but not mandatory. For quick, straightforward solutions you can skip saving and call `/unikit-plan` directly in the current explore session - the planner will use the conversation context instead.

Maintains `RESEARCHES_INDEX.md`; use `init` to rebuild the index from disk. When direction is clear, transition to `/unikit-plan`. Uses parallel Explore agents for deep codebase investigation.

### `/unikit-plan [fast|full|add|--list] <description>` - plan the work

```
/unikit-plan Add item rarity system              # Asks which mode
/unikit-plan fast Add sound effects manager       # Quick plan, no branch
/unikit-plan full Add item rarity system          # Git branch + full plan
/unikit-plan add Add visual effects to rarity     # Extend existing plan
/unikit-plan --list                               # Show available plans
```

Three planning modes plus list:

- **Fast** - no git branch, saves to `.unikit/PLAN.md` (single flat file)
- **Full** - optional branch creation, asks about testing/docs/roadmap linkage, saves to `.unikit/plans/YYYY-MM-DD_name/` with `TASKS.md` + `PLAN-BRIEF.md`
- **Add** - extends an existing plan with new tasks

Runs 2-4 parallel Explore agents for architecture analysis, pattern discovery, and dependency mapping. Links to related researches if found. For 5+ tasks, includes commit checkpoints. Uses `--base <branch>` to specify a custom base branch.

### `/unikit-improve [--list] [@plan-folder] [prompt]` - refine the plan

```
/unikit-improve                                          # Improve latest plan
/unikit-improve add validation and error handling        # Improve with specific focus
/unikit-improve --list                                   # List available plans
/unikit-improve @.unikit/plans/2026-03-10_core-loop      # Improve specific plan
```

Optional but recommended step. For complex tasks the agent rarely produces a complete plan on the first attempt - edge cases, risks, and dependencies get missed. Improve lets the agent review the finished plan from multiple angles and refine it. Recommended to run at least once after planning; for complex tasks - 2-3 times.

Second-pass analysis. Runs 2-3 deep Explore agents to:

- Find missing tasks
- Fix dependencies
- Remove redundant work
- Check architectural consistency

Plan resolution priority: `@<path>` argument, feature name match, git branch match, latest by date. Shows a diff-like improvement report before applying changes. Preserves completed tasks (`- [x]`) - never modifies them. Updates both TASKS.md and PLAN-BRIEF.md in sync.

### `/unikit-implement [--list] [@folder] [selector]` - execute the plan

```
/unikit-implement                    # Continue all pending tasks
/unikit-implement --list             # List available plans
/unikit-implement status             # Show progress without executing
/unikit-implement Phase 3            # Execute only Phase 3
/unikit-implement Phases 1-3         # Execute Phases 1 through 3
/unikit-implement Tasks 2.1 2.3 5.2  # Execute specific tasks
/unikit-implement @.unikit/plans/2026-03-10_core-loop  # Explicit plan path
```

Reads skill-context rules first, then plan TASKS.md. Bootstraps rules and engine principles once (`.unikit/system/dev-principles.md` + core rules) and executes tasks inline with `Read/Edit/Write/Bash`, marking progress in real time. Spawns the `develop-agent` alias only for true parallel scopes or deep-dive single tasks. Checks for FIX_PLAN.md first - if found, redirects to `/unikit-fix`. Supports selective execution by phase, task numbers, or feature name.

After phase completion:

- Runs compilation check (UnityMCP)
- Runs tests if `Testing: yes`
- Creates commit checkpoint

Post-completion:

- Checks TODO.md for resolved tasks
- Proposes new rules via background agents
- Triggers documentation checkpoint if `Docs: yes`

### `/unikit-fix [bug description]` - fix and learn

```
/unikit-fix NullReferenceException in CustomerItemView.OnInit
/unikit-fix                        # Execute existing FIX_PLAN.md
```

Two modes - choose when you invoke:

- **Fix now** - investigates codebase with 2-3 Explore agents, applies the fix inline after Bootstrap (rules + engine principles loaded in Step 0.2), verifies (compilation, tests, .meta, asmdef)
- **Plan first** - creates `.unikit/FIX_PLAN.md` with root cause analysis, fix steps, affected files, risks, and test coverage suggestions, then stops for review. When a plan exists, run without arguments to execute it

Recommended to always fix bugs through this skill - every fix creates a **self-improvement patch** in `.unikit/patches/` (mandatory), enabling the system to learn from mistakes via `/unikit-evolve`. Can be used during `/unikit-implement` while working through plan phases, or independently when a bug is found in existing functionality - no prior planning stages required. Always suggests NUnit test coverage.

### `/unikit-evolve` - improve skills from experience

```
/unikit-evolve
```

Reads patches incrementally using an evolve cursor (`.unikit/evolutions/patch-cursor.json`). Extracts multiple prevention points per patch, then classifies each:

- **Code/architecture rules** -> `RULES.md` (via `/unikit-rules`)
- **Skill workflow issues** -> `.unikit/skill-context/<skill>/SKILL.md`

Cross-checks against existing rules and knowledge base to avoid duplicates. Presents candidates grouped by type for user approval. Saves evolution log to `.unikit/evolutions/YYYY-MM-DD-HH.mm.md`. 

Mature rules from `RULES.md` can be migrated into permanent dynamic memory (`core/` or `stack/`) via `/unikit-memory --migrate-rules`. 

Closes the learning loop: **fix -> patch -> evolve -> better skills -> fewer bugs**.

### `/unikit-review [target]` - code review

```
/unikit-review                         # Staged changes (default)
/unikit-review PlayerController.cs     # Specific file(s)
/unikit-review @Assets/Scripts/Player  # Folder (all .cs files)
/unikit-review 123                     # PR by number (#42 or URL also work)
/unikit-review master                  # Commits vs branch/tag
```

Reviews Unity C# code against the project's full rule hierarchy. Four modes: staged changes, file/folder, PR, commits.

Loads rules in priority order: RULES.md (highest) -> skill-context -> core rules -> stack rules (loaded selectively based on frameworks detected in target code). Severity scale:

- Critical (crashes, leaks)
- Warning (bugs)
- Medium (perf, smell)
- Suggestion

Reports include concrete code fixes for Critical/Warning items. Commits mode also checks message accuracy and atomicity. After review, run `/unikit-fix` to address found issues - it automatically picks up the review results and offers to fix everything or select specific problems. Then proceeds as usual: fix now or plan first.

### `/unikit-verify [--strict] [feature-name]` - check completeness

```
/unikit-verify                           # Verify implementation against plan
/unikit-verify --strict                  # Strict mode - zero tolerance for gaps
/unikit-verify 2026-03-08_customers      # Verify specific feature
```

Goes through every task in the plan and verifies the code actually implements it. Runs per-phase Explore agents for completion audit. Checks:

- Unity compilation (UnityMCP)
- Tests
- `.meta` file pairing
- Asmdef boundaries (Modules -> Game FORBIDDEN)
- Leftover TODOs/FIXMEs
- Plan-vs-code drift
- DESCRIPTION.md/ARCHITECTURE.md sync
- Context gates (architecture, rules, roadmap alignment)

Strict mode raises the bar: partial completion is a failure, compilation and tests are required, leftover TODOs are blocking. If gaps are found, suggests `/unikit-fix`.

### `/unikit-commit [scope]` - conventional commits

```
/unikit-commit
/unikit-commit inventory
```

Creates conventional commits with Unity-specific safety checks. Analyzes staged changes and verifies:

- `.meta` file pairing
- Binary assets and secrets
- Unity-ignored directories (Library, Temp, Logs)

Runs read-only context gates against ARCHITECTURE.md and RULES.md. References plan task numbers in commit message when an active plan exists. Suggests commit splitting for unrelated staged changes. Offers to push after commit. Conventional prefix is always in English; description uses the configured language.

---

For full details on all skills including development (`/unikit-devcontext`), knowledge base (`/unikit-memory`, `/unikit-rules`, `/unikit-skills-context`), documentation (`/unikit-docs`), and utility (`/unikit-todo`) commands, see [Skills Reference](skills.md).

## See Also

- [Skills Reference](skills.md) - detailed reference for all workflow and utility skills
- [Subagents](subagents.md) - coordinators, workers, and sidecars the pipeline orchestrates
- [Dynamic Memory](dynamic-memory.md) - how the dynamic memory powers development
- [Plan Files](plan-files.md) - how plan artifacts are stored and managed
