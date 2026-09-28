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
|  Delegation aliases (from inside skills)                    |
|   skill-loading (general-purpose + skills: [...])           |
|    - develop-agent   (parallel/deep-dive only after         |
|                       the Bootstrap refactor)               |
|    - docs-agent      (update or create documentation)       |
|   model-carrying (declared behind an agent-filter branch)   |
|    - recon-agent     (read-only parallel reconnaissance)    |
|    - check-agent     (fresh-context findings validator)     |
|    - lens-agent      (adversarial review lens)              |
+-------------------------------------------------------------+
```

| Tier | Members | Launch | Can spawn subagents? |
|------|---------|--------|----------------------|
| Coordinator | `unikit-implement-coordinator`, `unikit-plan-coordinator` | `claude --agent <name>` (top-level session) | Yes |
| Internal worker | `unikit-implement-worker`, `unikit-plan-polisher` | Spawned by coordinator | No |
| Sidecar (background, read-only) | `unikit-review-sidecar`, `unikit-architecture-sidecar`, `unikit-commit-sidecar`, `unikit-docs-sidecar` | Spawned by coordinator (or explicit `Agent(...)` from a user-launched skill) | No |
| Delegation alias | `develop-agent`, `docs-agent` (skill-loading) · `recon-agent`, `check-agent`, `lens-agent` (model-carrying) | `Agent(...)` from a skill; the expansion is declared in that skill's `## Delegation agents` | Depends on the skill loaded - aliases do not carry the top-level privilege |

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

- Reads the plan manifest, builds the phase dependency graph, groups independent phases into layers
- With `Testing: yes` and two or more test-checkpoint tasks in its scope, asks once before the first layer whether to merge their test runs (the same question as `/unikit-implement`; no answer in a non-interactive run → runs as written)
- **Single ready phase** → executes tasks directly inside the coordinator (no worker overhead). Bootstraps principles + rules (`dev-principles.md`, `RULES.md`, `RULES_INDEX.md`, core rules) before the phase, then writes code inline
- **Multiple independent phases** → dispatches one `unikit-implement-worker` per phase (up to 3 in parallel per layer)
- After each layer: launches background sidecars (review, architecture, commit, docs), merges material findings, hands commit checkpoints to the `unikit-commit` skill (it never writes a commit message itself), advances to the next layer
- Annotates the manifest with layer markers and `[~]` / `[x]` / `[!]` status in real time
- **Is itself a writer of `## MCP Findings`** in the single-phase branch, where no worker exists to do it - same rules as everywhere else (`F<n>` = highest present + 1, `observed` = the date, semantic dedup), and never touches `.unikit/MCP-RECHECK-NOTES.md`
- Ends by **printing** a `/unikit-mcp-trap <plan path>` recommendation when the table has rows. Printed rather than invoked because this agent closes the session on exit, and the trap is interactive - it would be cut off mid-question

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
- **Writes its own row into the plan's `## MCP Findings` table** when an engine MCP call misled it, rather than returning a candidate to the coordinator. Workers have no worktree isolation, so they all edit the same plan file - which is safe only because a phase carrying an `Editor:` line is alone in its execution layer, leaving one writer at a time. Handing the row back instead would defer the write to the end of the layer and lose it if the coordinator failed
- Carries `skills: [unikit-devcontext, unikit-verify]` so it has full access to the pipeline knowledge base without spawning anything

Frontmatter highlights: `permissionMode: acceptEdits`, `maxTurns: 16`.

#### `unikit-plan-polisher`

Single refinement pass over a plan, then hand back.

- Creates or refreshes the active plan artifact
- Critiques it against implementation-readiness criteria
- Runs at most **one** improvement pass, then returns a structured summary to the coordinator
- Carries `skills: [unikit-plan, unikit-improve]`
- Returns the summary in English (structured output), while the plan manifest (`PLAN.md`) itself stays in the configured project language

Frontmatter highlights: `permissionMode: acceptEdits`, `maxTurns: 20`.

#### `unikit-plan-module-planner`

Plans one module of an ultra plan, called by `/unikit-plan ultra` through the `module-planner` alias.

- Reads the planning state (`.unikit/code/.planning/<name>/STATE.md`), the ultra format and the module procedure — their paths arrive in its prompt, since a subagent has no skill directory of its own to compute them from
- Finishes the module's code evidence, writes its phase files and, last, its fragment — a fragment present means the module is done, which is what a resume after a compaction rests on
- Returns exactly three lines (`tasks:`, `gaps:`, `blocking:`) — the only thing that reaches the planning session's context
- Writes only inside the working folder; never invents a cross-module contract — it records a gap and returns it; never calls other agents

Frontmatter highlights: `permissionMode: acceptEdits`, `model: inherit`, `maxTurns: 80`.

#### `unikit-plan-recon-writer`

Answers one reconnaissance question for `/unikit-plan ultra`, through the `recon-writer` alias, and writes the answer into the `recon/` file named in its prompt — the built-in `Explore` agent is read-only and cannot. The file opens with the `HEAD:` it was measured at; the reply is the path and at most five lines.

Frontmatter highlights: `permissionMode: acceptEdits`, `model: sonnet`, `maxTurns: 40`.

**Both are Claude Code only**, like every subagent. On the other runtimes the same work runs in the planning session itself, by the same procedure — the bundle comes out the same shape. **An existing project gets them with a re-run of `unikit-ai init`**: `update` installs only the subagents already listed in `.unikit.json`, and `update --install-new` adds skills only. Until then `/unikit-plan` plans each module in the session and says so in one line.

`permissionMode: acceptEdits` does not bound the path a subagent writes to, so `/unikit-plan` compares the project before and after each executor (`git status --porcelain --untracked-files=all` plus a hash of `git diff`) and stops on any change outside the working folder.

### Sidecars (background, read-only)

Sidecars share the same shape: read-only tools (`Read`, `Glob`, `Grep`), `background: true`, `permissionMode: dontAsk`, `maxTurns: 6`. They return structured findings (JSON or markdown) and never mutate state.

| Sidecar | Purpose | Rules loaded |
|---------|---------|--------------|
| `unikit-review-sidecar` | Surfaces correctness, regression, and performance risks in the diff - only material findings, no cosmetic nits | `ARCHITECTURE.md`, `RULES.md` (+ topic files matching the changed files), core rules, relevant stack rules |
| `unikit-architecture-sidecar` | Checks module boundaries and dependency directions | `ARCHITECTURE.md`, `RULES.md` (+ topic files matching the changed files), core rules |
| `unikit-commit-sidecar` | Assesses commit readiness, the split into groups and the files to leave out, from the files the coordinator passes - writes no commit message and never touches git state | `RULES.md` (+ topic files matching the files passed) |
| `unikit-docs-sidecar` | Classifies documentation drift as `no_action` / `safe_update_existing` / `needs_new_docs` / `needs_user_choice` | `RULES.md`, `RULES_INDEX.md`, skill-context for `unikit-docs` |

All sidecars return their findings in English so the coordinator can parse them consistently across projects.

## Delegation Aliases

Skills expose seven named aliases in three families. The **skill-loading** two expand to `Agent(subagent_type: "general-purpose", skills: [...])` calls; the **model-carrying** three expand to a dispatch that names the model on Claude Code and omits it everywhere else; the **subagent-backed** two expand to one of the subagent files above on Claude Code and to an inline procedure everywhere else. Each row below states its own read-only expectation. The first two families are not subagent files on disk - they live inside the skill prompts.

| Alias | Expands to | Used by | When to use |
|-------|------------|---------|-------------|
| `develop-agent` | `Agent(..., skills: ["unikit-devcontext"])` | `/unikit-implement`, `/unikit-fix`, `/unikit-verify` | **Only** for true parallel scopes or deep-dive single tasks after the Bootstrap refactor. Default sequential/fallback work stays inline in the calling skill |
| `docs-agent` | `Agent(..., skills: ["unikit-docs"])` | Pipeline skills at docs checkpoints | Update or create documentation pages |
| `recon-agent` | `Agent(subagent_type: Explore, …)` | `/unikit-docs`, `/unikit-explore`, `/unikit-fix`, `/unikit-plan`, `/unikit-verify`, `/unikit-improve`, `/unikit-gd-explore`, `/unikit-gd-recon` | Read-only parallel reconnaissance of a codebase or a reference corpus |
| `check-agent` | `Agent(subagent_type: Explore, …)` in a fresh context | `/unikit-improve`, `/unikit-review` (`+check`), `/unikit-explore` (coherence gate) | Validate findings, or a written artifact, from a context that saw none of the work |
| `lens-agent` | `Agent(subagent_type: general-purpose, …)` | `/unikit-gd-review` | One adversarial review lens, findings only, never a write |
| `module-planner` | `Agent(subagent_type: unikit-plan-module-planner, …)` on Claude Code; the module procedure inline elsewhere | `/unikit-plan ultra` | Plan one module into the planning working folder; writes files, returns three lines |
| `recon-writer` | `Agent(subagent_type: unikit-plan-recon-writer, …)` on Claude Code; `recon-agent` plus a file write elsewhere | `/unikit-plan ultra` | One reconnaissance question answered into a `recon/` file |

Rule capture has no alias: `/unikit-implement` Step 5.2 and `/unikit-verify` Step 5 put the candidates to the user in the calling session and invoke `/unikit-rules` only with the batch the user selected — a background agent could not have asked.

Fallback: if `Agent` is unavailable, `docs-agent` invokes its skill inline. `develop-agent` does **not** fall back to inline `/unikit-devcontext` - after the Bootstrap refactor, the calling skill already has rules and engine principles loaded and continues inline itself. The model-carrying three fall back per skill: `recon-agent` degrades to inline `Glob`/`Grep`/`Read`, `check-agent` is skipped in `+check` (one `WARN [+check]` line, never inline analysis) and run inline in the coherence gate, `lens-agent` runs its lenses sequentially in the calling session.

## Design Principles

1. **Read-only where possible.** All four sidecars declare only `Read/Glob/Grep`. They exist to observe the codebase after a change, not to mutate it.
2. **Writers are few.** Only `unikit-implement-coordinator`, `unikit-implement-worker`, `unikit-plan-polisher`, `unikit-plan-module-planner` and `unikit-plan-recon-writer` carry `Write` (the last without `Edit`), and the two planning writers are bounded by a change guard in `/unikit-plan`. `unikit-plan-coordinator` can edit plan artifacts via its polisher, not directly.
3. **Model inheritance.** Most subagents use `model: inherit` so the project's default model applies. `unikit-commit-sidecar` and `unikit-docs-sidecar` pin `model: sonnet`. A subagent definition file is the **right** place for a model name - it is runtime-native and reaches Claude Code only. A skill body is not: it reaches all six runtimes, of which only Claude Code has a dispatch-time model argument at all. That is why the model-carrying aliases declare their model behind an agent-filter branch instead of writing it at the call site, and why the value is always a tier alias (`sonnet`) and never a versioned model id.
4. **Strict output contracts.** Sidecars return structured JSON or markdown the coordinator can parse. Workers return a single task result block. Coordinators are the only place free-form prose appears.
5. **English output for parsing, project language for artifacts.** Sidecars and workers return English summaries; plan and documentation artifacts they write follow `language.artifacts` from `.unikit/config.yaml`.
6. **Rules loaded inside the subagent.** Every subagent with domain concerns (architecture, review, implement, plan) reads its own slice of `RULES_INDEX.md` - there is no implicit inheritance from the caller's context.
7. **No child spawning from workers/sidecars.** Workers and sidecars do their quality checks inline. Only coordinators may fan out.

## Quick Start

Launch the plan coordinator for a new feature:

```bash
claude --agent unikit-plan-coordinator "add item rarity system with visual effects"
```

This creates a plan in `.unikit/code/plans/<feature>/`, critiques it, refines it, and stops when it is implementation-ready (or after the iteration budget).

Execute the resulting plan:

```bash
claude --agent unikit-implement-coordinator
```

The coordinator parses the latest plan, builds the phase graph, dispatches workers for parallel phases, runs background sidecars between layers, and advances to commit checkpoints.

Day-to-day work through slash commands (`/unikit-implement`, `/unikit-fix`, `/unikit-verify`) does not require manual coordinator launches - the slash commands run inline with Bootstrap and use `develop-agent` only when a phase or task truly needs parallelism.

## See Also

- [Skills Reference](skills.md) - the 24 code-pipeline skills that workflow skills delegate to or compose over
- [Development Workflow](workflow.md) - where coordinators and sidecars fit in the end-to-end flow
- [Plan Files](plan-files.md) - the `PLAN.md` manifest coordinators read and workers update
