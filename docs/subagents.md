[← Skills Reference](skills.md) · [Back to README](../README.md) · [Plan Files →](plan-files.md)

# Subagents

UniKit AI ships eight subagents alongside the skill set. They split long-running workflows into single-responsibility roles, so the main conversation stays focused while planning, implementation, and quality checks run in parallel or in background.

Bundled subagents install into `<agent-config>/agents/` during `unikit-ai init` (for agents that support subagents - Claude Code today, per `AGENT_REGISTRY.supportsSubagents`). Agents without subagent support still get the skill set; the workflows then fall back to inline execution.

## Overview

The subagent layer exists for six reasons:

- **Context hygiene** - keep noisy phase work (exploration, verification, review) out of the main conversation
- **Parallelism** - run independent plan phases side by side via a worker pool, instead of serializing everything
- **Plan refinement** - iterate plan → critique → polish in a tight loop until the plan is implementation-ready
- **Read-only audits** - run review, architecture, docs-drift, and commit checks in background without risk of accidental edits
- **Specialization** - each sidecar loads only the rules it needs (architecture boundaries, commit conventions, doc structure, etc.)
- **Separation of delegation** - pipeline skills (`/unikit-implement`, `/unikit-fix`, `/unikit-verify`) own code-writing inline after Bootstrap; coordinators and sidecars add orchestration and quality signals without replacing the skill's inline work

## Two Tiers + Delegation Aliases

```
+-------------------------------------------------------------+
|  Top-level coordinator (claude --agent ...)                 |
|    - unikit-implement-coordinator                           |
|    - unikit-plan-coordinator                                |
+------+-----------------------------------------------+------+
       |                                               |
       v                                               v
+-------------------+                       +-----------------------+
|  Internal workers |                       |  Read-only sidecars   |
|  - implement-     |                       |  - review-sidecar     |
|    worker         |                       |  - architecture-      |
|  - plan-polisher  |                       |    sidecar            |
+-------------------+                       |  - commit-sidecar     |
                                            |  - docs-sidecar       |
                                            +-----------------------+

+-------------------------------------------------------------+
|  Delegation aliases (from inside pipeline skills)           |
|    - develop-agent   (parallel/deep-dive only after         |
|                       the Bootstrap refactor)               |
|    - rules-agent     (capture a new project rule)           |
|    - docs-agent      (update or create documentation)       |
+-------------------------------------------------------------+
```

| Tier | Members | Launch | Can spawn subagents? |
|------|---------|--------|----------------------|
| Coordinator | `unikit-implement-coordinator`, `unikit-plan-coordinator` | `claude --agent <name>` (top-level session) | Yes |
| Internal worker | `unikit-implement-worker`, `unikit-plan-polisher` | Spawned by coordinator | No |
| Sidecar (background, read-only) | `unikit-review-sidecar`, `unikit-architecture-sidecar`, `unikit-commit-sidecar`, `unikit-docs-sidecar` | Spawned by coordinator (or explicit `Agent(...)` from a user-launched skill) | No |
| Delegation alias | `develop-agent`, `rules-agent`, `docs-agent` | `Agent(subagent_type: "general-purpose", skills: [...])` from a workflow skill | Depends on the skill loaded - aliases do not carry the top-level privilege |

## Top-Level Agent Sessions

Claude Code enforces an important rule: **ordinary subagents cannot spawn other subagents**. Coordinators that need to dispatch workers or run multiple sidecars must therefore start as a **top-level custom agent session**:

```bash
claude --agent unikit-implement-coordinator
claude --agent unikit-plan-coordinator
```

If a coordinator detects that it is running as an ordinary subagent, it must stop immediately - that is how `unikit-plan-coordinator` and `unikit-implement-coordinator` are written.

Everything else (`unikit-implement-worker`, `unikit-plan-polisher`, sidecars, delegation aliases) is spawned automatically from the coordinator or a workflow skill. Users normally never launch those by hand.

## Coordinators

### `unikit-implement-coordinator`

Dependency-aware plan execution.

- Reads `TASKS.md`, builds the phase dependency graph, groups independent phases into layers
- **Single ready phase** → executes tasks directly inside the coordinator (no worker overhead). Bootstraps principles + rules (`dev-principles.md`, `RULES.md`, `RULES_INDEX.md`, core rules) before the phase, then writes code inline
- **Multiple independent phases** → dispatches one `unikit-implement-worker` per phase (up to 3 in parallel per layer)
- After each layer: launches background sidecars (review, architecture, commit, docs), merges material findings, handles commit checkpoints, advances to the next layer
- Annotates `TASKS.md` with layer markers and `[~]` / `[x]` / `[!]` status in real time

Frontmatter highlights: `permissionMode: acceptEdits`, `model: inherit`, `maxTurns: 40`. Can spawn: `unikit-implement-worker`, four sidecars.

### `unikit-plan-coordinator`

Iterative plan polishing.

- Launches `unikit-plan-polisher` in a loop: plan → critique → improve → critique → …
- Stops when the plan meets implementation-readiness criteria or the iteration budget (default: 3) is exhausted
- Detects stagnation (same issues across two iterations) and stops early
- Each iteration spawns a fresh `unikit-plan-polisher` to avoid context bloat

Frontmatter highlights: `permissionMode: acceptEdits`, `model: inherit`, `maxTurns: 30`. Can spawn: `unikit-plan-polisher`.

## Internal Agents

### Workers

#### `unikit-implement-worker`

Executes exactly ONE task from the active plan, then returns control.

- Implements the task, verifies it, runs local quality checks via skill knowledge (no Agent delegation - workers cannot spawn children)
- Does not create commits; the coordinator owns git state
- Carries `skills: [unikit-devcontext, unikit-verify]` so it has full access to the pipeline knowledge base without spawning anything

Frontmatter highlights: `permissionMode: acceptEdits`, `maxTurns: 16`.

#### `unikit-plan-polisher`

Single refinement pass over a plan, then hand back.

- Creates or refreshes the active plan artifact
- Critiques it against implementation-readiness criteria
- Runs at most **one** improvement pass, then returns a structured summary to the coordinator
- Carries `skills: [unikit-plan, unikit-improve]`
- Returns the summary in English (structured output), while plan artifacts themselves (`TASKS.md`, `PLAN-BRIEF.md`) stay in the configured project language

Frontmatter highlights: `permissionMode: acceptEdits`, `maxTurns: 12`.

### Sidecars (background, read-only)

Sidecars share the same shape: read-only tools (`Read`, `Glob`, `Grep`), `background: true`, `permissionMode: dontAsk`, `maxTurns: 6`. They return structured findings (JSON or markdown) and never mutate state.

| Sidecar | Purpose | Rules loaded |
|---------|---------|--------------|
| `unikit-review-sidecar` | Surfaces correctness, regression, and performance risks in the diff - only material findings, no cosmetic nits | `ARCHITECTURE.md`, `RULES.md`, core rules, relevant stack rules |
| `unikit-architecture-sidecar` | Checks module boundaries and dependency directions | `ARCHITECTURE.md`, `RULES.md`, core rules |
| `unikit-commit-sidecar` | Inspects the diff, drafts the safest next commit action (message + readiness) without touching git state | `RULES.md`, recent `git log` |
| `unikit-docs-sidecar` | Classifies documentation drift as `no_action` / `safe_update` / `needs_user_choice` | `RULES.md`, `RULES_INDEX.md`, skill-context for `unikit-docs` |

All sidecars return their findings in English so the coordinator can parse them consistently across projects.

## Delegation Aliases

Workflow skills expose three named aliases that expand to `Agent(subagent_type: "general-purpose", skills: [...])` calls. They are **not** subagent files on disk - they live inside the skill prompts and point at existing skills.

| Alias | Expands to | Used by | When to use |
|-------|------------|---------|-------------|
| `develop-agent` | `Agent(..., skills: ["unikit-devcontext"])` | `/unikit-implement`, `/unikit-fix`, `/unikit-verify` | **Only** for true parallel scopes or deep-dive single tasks after the Bootstrap refactor. Default sequential/fallback work stays inline in the calling skill |
| `rules-agent` | `Agent(..., skills: ["unikit-rules"])` | `/unikit-implement` (and other pipeline skills) | Capture a new project rule without bloating the calling context |
| `docs-agent` | `Agent(..., skills: ["unikit-docs"])` | Pipeline skills at docs checkpoints | Update or create documentation pages |

Fallback: if `Agent` is unavailable, `rules-agent` and `docs-agent` invoke their skills inline. `develop-agent` does **not** fall back to inline `/unikit-devcontext` - after the Bootstrap refactor, the calling skill already has rules and engine principles loaded and continues inline itself.

## Design Principles

1. **Read-only where possible.** All four sidecars declare only `Read/Glob/Grep`. They exist to observe the codebase after a change, not to mutate it.
2. **Writers are few.** Only `unikit-implement-coordinator`, `unikit-implement-worker`, and `unikit-plan-polisher` carry `Write/Edit`. `unikit-plan-coordinator` can edit plan artifacts via its polisher, not directly.
3. **Model inheritance.** Most subagents use `model: inherit` so the project's default model applies. `unikit-commit-sidecar` pins `model: sonnet` for consistent message drafting.
4. **Strict output contracts.** Sidecars return structured JSON or markdown the coordinator can parse. Workers return a single task result block. Coordinators are the only place free-form prose appears.
5. **English output for parsing, project language for artifacts.** Sidecars and workers return English summaries; plan and documentation artifacts they write follow `language.artifacts` from `.unikit/config.yaml`.
6. **Rules loaded inside the subagent.** Every subagent with domain concerns (architecture, review, implement, plan) reads its own slice of `RULES_INDEX.md` - there is no implicit inheritance from the caller's context.
7. **No child spawning from workers/sidecars.** Workers and sidecars do their quality checks inline. Only coordinators may fan out.

## Quick Start

Launch the plan coordinator for a new feature:

```bash
claude --agent unikit-plan-coordinator "add item rarity system with visual effects"
```

This creates a plan in `.unikit/plans/<date>_<feature>/`, critiques it, refines it, and stops when it is implementation-ready (or after the iteration budget).

Execute the resulting plan:

```bash
claude --agent unikit-implement-coordinator
```

The coordinator parses the latest plan, builds the phase graph, dispatches workers for parallel phases, runs background sidecars between layers, and advances to commit checkpoints.

Day-to-day work through slash commands (`/unikit-implement`, `/unikit-fix`, `/unikit-verify`) does not require manual coordinator launches - the slash commands run inline with Bootstrap and use `develop-agent` only when a phase or task truly needs parallelism.

## See Also

- [Skills Reference](skills.md) - the 19 skills that workflow skills delegate to or compose over
- [Development Workflow](workflow.md) - where coordinators and sidecars fit in the end-to-end flow
- [Plan Files](plan-files.md) - the `TASKS.md` / `PLAN-BRIEF.md` artifacts coordinators read and workers update
