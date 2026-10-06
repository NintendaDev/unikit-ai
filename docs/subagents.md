[← Skills Reference](skills.md) · [Back to README](../README.md) · [Plan Files →](plan-files.md)

# Subagents

UniKit AI ships eight subagents alongside the skill set. They split long-running workflows into single-responsibility roles, so the main conversation stays focused while planning, implementation, and quality checks run in parallel or in background.

Bundled subagents install into `<agent-config>/agents/` during `unikit-ai init` (for agents that support subagents - Claude Code and, through an install-time adapter, Kimi Code, per `AGENT_REGISTRY.supportsSubagents`). Agents without subagent support still get the skill set; the workflows then fall back to inline execution.

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
|  Top-level coordinator (claude|kimi --agent ...)            |
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
|   skill-loading (call head + skill call per agent form)     |
|    - develop-agent   (parallel/deep-dive only after         |
|                       the Bootstrap refactor)               |
|    - docs-agent      (update or create documentation)       |
|   model-carrying (call head from profile, model: config)    |
|    - recon-agent     (read-only parallel reconnaissance)    |
|    - check-agent     (fresh-context findings validator)     |
|    - lens-agent      (adversarial review lens)              |
+-------------------------------------------------------------+
```

| Tier | Members | Launch | Can spawn subagents? |
|------|---------|--------|----------------------|
| Coordinator | `unikit-implement-coordinator`, `unikit-plan-coordinator` | `claude --agent <name>` / `kimi --agent <name>` (top-level session) | Yes |
| Internal worker | `unikit-implement-worker`, `unikit-plan-polisher` | Spawned by coordinator | No |
| Sidecar (background, read-only) | `unikit-review-sidecar`, `unikit-architecture-sidecar`, `unikit-commit-sidecar`, `unikit-docs-sidecar` | Spawned by coordinator (or explicit `Agent(...)` from a user-launched skill) | No |
| Delegation alias | `develop-agent`, `docs-agent` (skill-loading) · `recon-agent`, `check-agent`, `lens-agent`, `recon-writer-agent` (model-carrying) | `Agent(...)` from a skill; the expansion is declared in that skill's `## Delegation agents` | Depends on the skill loaded - aliases do not carry the top-level privilege |

## Top-Level Agent Sessions

Claude Code enforces an important rule: **ordinary subagents cannot spawn other subagents**. Coordinators that need to dispatch workers or run multiple sidecars must therefore start as a **top-level custom agent session**:

```bash
claude --agent unikit-implement-coordinator
claude --agent unikit-plan-coordinator

# Kimi Code
kimi --agent unikit-implement-coordinator
kimi --agent unikit-plan-coordinator
```

On Kimi Code the dispatch right comes from the agent file instead: only an agent whose `tools` carries `Agent` can dispatch, and the subagent types it may start are its `subagents` list, which the installer writes for the two coordinators - see [agents.md](agents.md#kimi-code).

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
- Under `Testing: yes`, carries the `Full run:` anchor over every commit it makes (the same rule as `/unikit-implement`), and reports a final run closed by reuse apart from a performed one (`Test runs: <n> performed · <m> merged · <r> reused`)
- **Is itself a writer of `## MCP Findings`** in the single-phase branch, where no worker exists to do it - same rules as everywhere else (`F<n>` = highest present + 1, `observed` = the date, semantic dedup), and never touches `.unikit/MCP-RECHECK-NOTES.md`
- Ends by **printing** a `/unikit-mcp-trap <plan path>` recommendation when the table has rows. Printed rather than invoked because this agent closes the session on exit, and the trap is interactive - it would be cut off mid-question

Frontmatter highlights: `permissionMode: acceptEdits`, `model: inherit`, `maxTurns: 40`. Can spawn: `unikit-implement-worker`, four sidecars. Lists `unikit-implement`, `unikit-verify`, `unikit-commit`, `unikit-review`, `unikit-docs` and `unikit-mcp-trap` under `skills:` - see [Skills listed in an agent file](#skills-listed-in-an-agent-file).

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
- Lists `unikit-devcontext` and `unikit-verify` under `skills:` so it has full access to the pipeline knowledge base without spawning anything - Claude Code preloads them, on Kimi Code the installed file starts with a read list (see [Skills listed in an agent file](#skills-listed-in-an-agent-file))

Frontmatter highlights: `permissionMode: acceptEdits`, `maxTurns: 16`.

#### `unikit-plan-polisher`

Single refinement pass over a plan, then hand back.

- Creates or refreshes the active plan artifact
- Critiques it against implementation-readiness criteria
- Runs at most **one** improvement pass, then returns a structured summary to the coordinator
- Lists `unikit-plan` and `unikit-improve` under `skills:` (preloaded by Claude Code; a read list on Kimi Code - see [Skills listed in an agent file](#skills-listed-in-an-agent-file))
- Returns the summary in English (structured output), while the plan manifest (`PLAN.md`) itself stays in the configured project language

Frontmatter highlights: `permissionMode: acceptEdits`, `maxTurns: 20`.

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

Skills expose six named aliases in two families. The **skill-loading** two expand to `Agent(<call head>, prompt: "<skill call> <arguments>", …)` calls whose prompt makes the subagent load the skill - a Skill-tool call on Claude Code, a read of the skill file on every other agent, see [How a skill reaches a subagent](#how-a-skill-reaches-a-subagent); `<call head>` is the type argument and the agent's extra arguments, built from the agent profile (see [Subagent profile per agent](#subagent-profile-per-agent)); the other four launch a subagent whose model comes from `subagents.model` in `.unikit/config.yaml`; each row below states its own read-only expectation. Neither family is a subagent file on disk - they live inside the skill prompts. `/unikit-plan ultra` spawns no planning subagents: the session writes every phase; reconnaissance goes through `recon-agent`, and under the saved-state protocol through `recon-writer-agent`.

| Alias | Expands to | Used by | When to use |
|-------|------------|---------|-------------|
| `develop-agent` | `Agent(<call head>, prompt: "<skill call: unikit-devcontext> <task details>", …)` | `/unikit-implement`, `/unikit-fix`, `/unikit-verify` | **Only** for true parallel scopes or deep-dive single tasks after the Bootstrap refactor. Default sequential/fallback work stays inline in the calling skill |
| `docs-agent` | `Agent(<call head>, prompt: "<skill call: unikit-docs> <context>", …)` | Pipeline skills at docs checkpoints | Update or create documentation pages |
| `recon-agent` | `Agent(<reader call head>, prompt: "<focused question> You are read-only: edit and write nothing.")` | `/unikit-docs`, `/unikit-explore`, `/unikit-fix`, `/unikit-plan`, `/unikit-verify`, `/unikit-improve`, `/unikit-gd-explore`, `/unikit-gd-recon` | Read-only parallel reconnaissance of a codebase or a reference corpus |
| `check-agent` | `Agent(<reader call head>, …)` in a fresh context | `/unikit-improve`, `/unikit-review` (`+check`), `/unikit-explore` (coherence gate) | Validate findings, or a written artifact, from a context that saw none of the work |
| `lens-agent` | `Agent(<worker call head>, …)` | `/unikit-gd-review` | One adversarial review lens, findings only, never a write |
| `recon-writer-agent` | `Agent(<worker call head>, …)`; if the call fails or the runtime has no subagent tool, `recon-agent` plus a write by the session | `/unikit-plan ultra` (saved-state protocol) | One reconnaissance question answered straight into its `recon/` file in the form of `references/RECON-TEMPLATE.md`, replying with the file's `## Summary` only, so the full answer never passes through the planning context; the only file it may write is that one, and `/unikit-plan` checks `git status` / `git diff` before and after the batch |

Rule capture has no alias: `/unikit-implement` Step 5.2 and `/unikit-verify` Step 5 put the candidates to the user in the calling session and invoke `/unikit-rules` only with the batch the user selected — a background agent could not have asked.

Fallback: if `Agent` is unavailable, `docs-agent` invokes its skill inline. `develop-agent` does **not** fall back to inline `/unikit-devcontext` - after the Bootstrap refactor, the calling skill already has rules and engine principles loaded and continues inline itself. The model-carrying four fall back per skill: `recon-agent` degrades to inline `Glob`/`Grep`/`Read`, `check-agent` is skipped in `+check` (one `WARN [+check]` line, never inline analysis) and run inline in the coherence gate, `lens-agent` runs its lenses sequentially in the calling session, `recon-writer-agent` asks through `recon-agent` and the session writes the answer into the file itself - it falls back when the call fails, when the agent returns without its file, or when the runtime has no subagent tool, and the file is checked on disk before the plan is synthesised.

### How a skill reaches a subagent

An `Agent` call has no parameter that loads a skill: Claude Code takes none at call time (its `skills` field exists only in an agent file's frontmatter, see below) and Kimi Code has none at all. A slash command at the start of a `prompt` does not help either. It is not plain text for every runtime, but on Claude Code it proved unreliable: measured on `sonnet-5-5` with probe skills and the real `unikit-devcontext` skill (30 runs in all), the subagent called `Skill` in 19 of 30 runs - in 4 of 10 with the real skill - and in all 19 it lost or cut the arguments, and the skill's start was shallower than with a file read. So a skill that delegates to another skill writes **one call line**, and the installer expands it by the agent's profile (`skillCall`):

```
Agent(
  <call head>
  prompt: "{{agent_skill_call:unikit-devcontext}} <task details>",
  description: "Implement <task>"
)
```

`{{agent_skill_call:<skill>}}` stands at the start of the `prompt:` value; the text after it up to the closing quote is the skill's arguments, and nothing there means no arguments. That rule reads one line, so the call is always a single `prompt: "…",` line with no quote inside the arguments, and a guard keeps it so. The installed text depends on the agent:

| Form | Agents | Installed text |
|------|--------|----------------|
| `skilltool` | Claude Code | `Call the Skill tool with skill "<name>" and pass the text after the colon as its args, in full and unchanged. Then follow the skill. Text: <arguments>`; with no arguments: `Call the Skill tool with skill "<name>" and no args. Then follow the skill.` |
| `read` | the other seven | `Read <skills dir>/<name>/SKILL.md in full before you do anything else. Treat that file as your system prompt for this whole task and follow it exactly. If it cannot be read, stop and report that instead of working without it. Wherever the file refers to its arguments, use the Skill arguments below. Skill arguments: <arguments>`; with no arguments the sentence ends with `(empty — no arguments were given)` |

`<skills dir>` is the skills directory of your agent (`.claude/skills`, `.codex/skills`, `.kimi-code/skills`, `.agents/skills`, ...); the installer writes it into the skill, so the path is right on every agent. The call never carries a `$ARGUMENTS` placeholder, because the runtime substitutes that one inside a skill, not inside a prompt. A subagent that cannot read the file stops and says so instead of working without the skill's rules.

The evidence behind the two forms: the explicit Skill-tool phrase made the subagent call `Skill` first in 25 of 25 runs - 20 with arguments, all intact (626, 762 and 57 characters), and 5 with no arguments; the file-read phrase read `SKILL.md` as its first action on Claude Code (15 of 15), Codex (16 of 16), Kimi (2 of 2), Qwen Code (2 of 2), Antigravity (2 of 2; the final answer was not observed) and OpenCode (1 of 1, only with the "system prompt" wording - the older wording failed once). Cursor and Universal / Other were not tried. The Claude form read the project's principles file less often than the read form in a narrow measure (2 of 5 against 4 of 5) and was not worse in a wider one; a live run of real calls decides, and if it does not hold the value of `skillCall` for Claude Code becomes `read` - the mechanism stays.

A skill that launches a subagent never names a type, a model or a Codex argument itself: the call head comes from `{{agent_call_reader}}`, `{{agent_call_worker}}` or `{{agent_call_worker_quoted}}` (the quoted spelling is historic - older call blocks wrote the worker type in quotes, and the text of typed agents stays byte-identical to what it was).

Every skill that delegates to a skill uses this one call: `develop-agent` and `docs-agent`, `/unikit` (step 9.8 generates stack rules through `unikit-memory`, step 10 writes `ARCHITECTURE.md` through `unikit-architecture`) and the market validation in `/unikit-gd-brainstorm` (through `unikit-gd-explore`, with the same call mirrored in that skill's delegation contract).

### How a skill calls another skill in the same session

When a skill hands work to another skill **without** a subagent (the next step of a pipeline, a commit, a review), the call site says ``invoke `<skill>` `` - with the argument where there is one - and the skill carries one recipe in its own `## Skill calls` section, the same text for every agent:

1. If you have a `Skill` tool that accepts arguments, call it with that skill and the arguments, in full and unchanged, then follow the skill.
2. Otherwise read `<skills dir>/<skill>/SKILL.md` in full, treat it as the instructions of this step and carry them out here, in this session, now, with the arguments of the call site.
3. When the skill has run, go on to the step the call site names. Never print a command for the user to run and never stop.
4. Only if the file cannot be read, print `Run: /unikit-<skill> <arguments>` and stop.

There is no substitution by profile here. On Claude Code the first branch applies; on Antigravity, Cursor and Universal / Other (no documented `Skill` tool) the second is expected. The recipe was checked in single live runs on Claude Code and OpenCode; Codex, Kimi and Qwen Code passed an earlier two-step variant of it, and the unreadable-file clause was not tested. In an agent file (`unikit-implement-coordinator`) the recipe names no path, because `{{skills_dir}}` is empty there. This is not a delegation: the called skill runs in the caller's context, interactive questions included, and takes context from it. `/unikit-gd-review` and `/unikit-gd-verify` only recommend `/unikit-gd-apply`; on Codex a marked block runs it by the same recipe. A skill that is hidden from the model (`disable-model-invocation: true`) cannot be loaded through the Skill tool, so no delegation target and no call target is one, and a guard keeps it so.

### Skills listed in an agent file

The `skills:` field in the frontmatter of an agent file (`unikit-implement-worker`, `unikit-plan-polisher`, `unikit-implement-coordinator`) is a different mechanism: Claude Code preloads the listed skills into the agent when it starts. Agent files are installed only for Claude Code and Kimi Code. Kimi Code does not read the field (live check, Kimi 2.1.1), so on install the Kimi adapter removes it and writes the same skills as a read list at the top of the file: a line asking the agent to read each file, then the `.kimi-code/skills/<name>/SKILL.md` paths. A coordinator keeps `${base_prompt}` as its first line and the list follows it. The files installed for Claude Code are not touched.

### Subagent profile per agent

Which type a skill launches and how it reaches a skill is data, not text: every agent in `AGENT_REGISTRY` (`src/core/agents.ts`) carries a profile - reader type, worker type, built-in model, skill-call form and extra call arguments - and the installer substitutes it into the skills (`{{agent_call_reader}}`, `{{agent_call_worker}}`, `{{agent_call_worker_quoted}}`, `{{agent_skill_call:<skill>}}`, `{{agent_model_default}}`). The reader type is a read-only agent (reconnaissance, validation); the worker type can create files. The values were built from each runtime's documentation and source and are not confirmed in a live session, except for Claude Code and, for the call forms and the Codex arguments, the probes of 2026-10-06.

| Agent | Reader | Worker | Built-in model | Skill call | Notes |
|-------|--------|--------|----------------|------------|-------|
| Claude Code | `Explore` | `general-purpose` | `sonnet` | `skilltool` | takes a model argument in the call |
| Codex CLI | none | none | none | `read` | the tool is `spawn_agent`, which has no type parameter: every call carries `fork_turns: "none"` (no inherited history) and a `task_name` of its own (a repeated name is rejected); read-only for a reader rests on the prompt; Codex turns an `Agent(...)` call into its own `spawn_agent` call and starts a subagent whenever a skill step asks for one (10 of 10 launches in the probes of 2026-10-06, no extra block in the skill), but its system message allows spawns only on an explicit instruction, so an optional `recon-agent` may be done by the session itself - the alias fallback allows that |
| Cursor | `explore` | `generalPurpose` | none | `read` | the worker type is inferred from the docs |
| Qwen Code | `Explore` | `general-purpose` | none | `read` | a subagent runs in the background by default |
| OpenCode | `explore` | `general` | none | `read` | there is no default type: an unknown type is an error |
| Antigravity | `research` | `self` | `flash` | `read` | the model argument comes from a third-party description of `invoke_subagent` |
| Kimi Code | `explore` | `coder` | none | `read` | the type is matched by exact name, case included |
| Universal / Other | `Explore` | `general-purpose` | none | `read` | Claude Code's type names for a runtime that is not known in advance; a runtime that does not know them returns an unknown-type error |

A skill body names none of these - no type, no model, no Codex argument, no call form: adding an agent means one registry entry (plus one key in the config template), with no edit under `skills/`.

Every `recon-agent` call also says in words that it only reads (`You are read-only: edit and write nothing.`): for Codex, which has no read-only type, that sentence is the only protection against a write.

Codex needs no text of its own to launch a subagent: a skill step that names an alias is enough, so no skill carries a Codex-only delegation block. What Codex does decide itself is `fork_turns` when the call leaves it open (it chose "all" in one probe of three with the same skill text), which is why every Codex call carries `fork_turns: "none"`.

### Model argument

The four model-carrying aliases settle the model once per skill, before the first dispatch, by reading `subagents.model.<agent>` in `.unikit/config.yaml` (a missing file, block or key is not an error):

1. a model name - passed with every call, exactly as written;
2. `inherit`, or present and empty - no model argument; the subagent runs on the model of the session;
3. the key is absent - the built-in default of the agent (Claude Code `sonnet`, Antigravity `flash`, none elsewhere).

If the runtime rejects the name, the skill repeats the call once without a model and reports `WARN [delegation] model "<name>" rejected - retried on the session model`. UniKit keeps no list of model names: a version-specific id goes stale, so you write it into the config yourself. See [Configuration](configuration.md#subagents-section).

## Design Principles

1. **Read-only where possible.** All four sidecars declare only `Read/Glob/Grep`. They exist to observe the codebase after a change, not to mutate it.
2. **Writers are few.** Only `unikit-implement-coordinator`, `unikit-implement-worker`, and `unikit-plan-polisher` carry `Write/Edit`. `unikit-plan-coordinator` can edit plan artifacts via its polisher, not directly.
3. **Model inheritance.** Most subagents use `model: inherit` so the project's default model applies. `unikit-commit-sidecar` and `unikit-docs-sidecar` pin `model: sonnet`. A subagent definition file is the **right** place for a model name - it is runtime-native and reaches only the agents that receive subagent files (Claude Code, and Kimi Code, which ignores the `model` field). A skill body reaches all eight runtimes, so it names no model at all: the type comes from the agent profile in `src/core/agents.ts`, the model from `subagents.model` in `.unikit/config.yaml`, with a built-in default only where the vendor keeps a stable alias (Claude Code `sonnet`, Antigravity `flash`). A version-specific model id is never written into UniKit - you write it into the config yourself.
4. **Strict output contracts.** Sidecars return structured JSON or markdown the coordinator can parse. Workers return a single task result block. Coordinators are the only place free-form prose appears.
5. **English output for parsing, project language for artifacts.** Sidecars and workers return English summaries; plan and documentation artifacts they write follow `language.artifacts` from `.unikit/config.yaml`.
6. **Rules loaded inside the subagent.** Every subagent with domain concerns (architecture, review, implement, plan) reads its own slice of `RULES_INDEX.md` - there is no implicit inheritance from the caller's context.
7. **No child spawning from workers/sidecars.** Workers and sidecars do their quality checks inline. Only coordinators may fan out.

## Quick Start

Launch the plan coordinator for a new feature:

```bash
claude --agent unikit-plan-coordinator "add item rarity system with visual effects"
```

On Kimi Code: `kimi --agent unikit-plan-coordinator "add item rarity system with visual effects"`.

This creates a plan in `.unikit/code/plans/<feature>/`, critiques it, refines it, and stops when it is implementation-ready (or after the iteration budget).

Execute the resulting plan:

```bash
claude --agent unikit-implement-coordinator
```

On Kimi Code: `kimi --agent unikit-implement-coordinator`.

The coordinator parses the latest plan, builds the phase graph, dispatches workers for parallel phases, runs background sidecars between layers, and advances to commit checkpoints.

Day-to-day work through slash commands (`/unikit-implement`, `/unikit-fix`, `/unikit-verify`) does not require manual coordinator launches - the slash commands run inline with Bootstrap and use `develop-agent` only when a phase or task truly needs parallelism.

## See Also

- [Skills Reference](skills.md) - the 24 code-pipeline skills that workflow skills delegate to or compose over
- [Development Workflow](workflow.md) - where coordinators and sidecars fit in the end-to-end flow
- [Plan Files](plan-files.md) - the `PLAN.md` manifest coordinators read and workers update
