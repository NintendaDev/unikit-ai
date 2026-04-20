[Back to README](../README.md) · [Agents →](agents.md)

# Getting Started

## What is UniKit AI?

UniKit AI is an **AI-powered game code development toolkit**. It bootstraps an AI coding agent for your game project by:

1. **Detecting the engine** - Unity, Godot 4, Godot 4 .NET, or Unreal Engine 5
2. **Installing skills and subagents** - 19 workflow skills + 8 background agents (sidecars, coordinators, workers) tailored to the selected engine
3. **Wiring the knowledge base** - a remote rules registry feeds dynamic memory (core rules always loaded, stack rules loaded by task context)
4. **Configuring MCP servers** - engine MCP (real-time console / tests) + Context7 (up-to-date library docs) for agents that support MCP
5. **Providing a spec-driven workflow** - explore → plan → improve → implement → review → verify → commit, with self-learning patches feeding back into the rules

## Supported Agents

UniKit supports six AI coding agents. Select one or more during `unikit-ai init` - the CLI installs skills with per-agent path rewriting so every selected agent receives the correct format.

| Agent | Config Directory | Skills Directory | MCP Support | Status |
|-------|-----------------|-----------------|-------------|--------|
| Claude Code | `.claude/` | `.claude/skills/` | Yes (`.mcp.json`) | Stable |
| Codex CLI | `.codex/` | `.codex/skills/` | Yes (`.codex/config.toml`) | Beta |
| Cursor | `.cursor/` | `.cursor/skills/` | Yes (`.cursor/mcp.json`) | Beta |
| Gemini CLI | `.gemini/` | `.gemini/skills/` | Yes (`.gemini/settings.json`) | Beta |
| Qwen Code | `.qwen/` | `.qwen/skills/` | Yes (`.qwen/settings.json`) | Beta |
| OpenCode | `.opencode/` | `.opencode/skills/` | Yes (`opencode.json`) | Beta |

The wizard renders a single flat selection checkbox with a right-aligned `[Stable]` / `[Beta]` tag next to each agent (stable agents listed first). Beta agents are fully wired in (skills + subagents + MCP where supported), but the adapters are newer and rough edges are still possible - use them and report issues.

## Prerequisites

- **Node.js** >= 18
- A supported game project: **Unity**, **Godot 4**, **Godot 4 .NET**, or **Unreal Engine 5**
- An AI coding agent (Claude Code, Codex CLI, Cursor, Gemini CLI, Qwen Code, or OpenCode)
- Recommended: an engine MCP server installed (see [MCP Servers](#mcp-servers) below)

## Your First Project

```bash
# 1. Install UniKit AI
npm install -g unikit-ai

# 2. Go to your game project root
cd my-game-project

# 3. Initialize
unikit-ai init
```

The `init` wizard asks only about installation concerns - it does **not** generate project context or install rules. Specifically:

1. **Agents** - multi-select checkbox where each agent is shown with a right-aligned `[Stable]` / `[Beta]` tag (stable agents listed first): `[Stable]` for Claude Code; `[Beta]` for Codex CLI, Cursor, Gemini CLI, Qwen Code, OpenCode. Pick one or more; each selected agent gets its own skills / subagents / MCP files written in the correct per-agent format
2. **Engine** - Unity / Godot 4 / Godot 4 .NET / Unreal Engine 5. On a repeat `init` the engine is reused from `.unikit.json` and the prompt is skipped
3. **Custom rules registry** - confirm Y/N. If yes, enter a URL or local path; invalid registries offer retry / skip (skip falls back to the official registry `NintendaDev/unikit-ai-rules`)
4. **MCP servers** - discovered automatically for the selected engine (engine MCP + Context7). For MCP keys with multiple implementations you pick one from a radio list, for the rest it is a checkbox

After `init` finishes, open your AI agent and run `/unikit`:

```bash
/unikit
```

`/unikit` is where the AI context actually gets generated:

- scans the game project, detects the full tech stack, asks targeted questions to fill in gaps
- generates `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`, `AGENTS.md`, and `.unikit/config.yaml`
- calls `unikit-ai rules install` to bootstrap the core rules from the registry
- drives stack rule selection - for each detected framework it either pulls a pre-built rule from the registry or generates one on the fly via `/unikit-memory` (Context7 + web research)

From then on, the dynamic memory is ready and you can start building features:

```bash
# 1. Optional discovery before planning
/unikit-explore Add item rarity system

# 2. Create a plan
/unikit-plan Add item rarity system

# 3. Implement the latest plan
/unikit-implement
```

## CLI Commands

### Installation lifecycle

```bash
unikit-ai init                 # Run the wizard, install skills / subagents / MCP
unikit-ai update               # Re-install only changed skills (hash-based) and sync rules
unikit-ai update --force       # Clean reinstall of skills and force-refresh every installed rule
```

`update` uses SHA-256 hashes on every skill directory + engine template to detect drift, and reconciles `.unikit/memory/` against the configured registry (pulling newer versions of rules already marked `source: registry` and regenerating `RULES_INDEX.md`).

### Rules management

Rules are first-class and have their own subcommand group. Full reference lives in [Rules Registry](rules-registry.md); the common commands:

```bash
unikit-ai rules list                     # List available rules from the registry
unikit-ai rules show <id>                # Preview a rule (frontmatter + body)
unikit-ai rules install                  # Install the core bootstrap (no args)
unikit-ai rules install <id> [<id>...]   # Install specific rules
unikit-ai rules sync                     # Reconcile disk ↔ state, regenerate RULES_INDEX.md
unikit-ai rules sync --replace --prune   # Overwrite local edits and drop obsolete stack rules
unikit-ai rules status                   # Show installed rules and their sources
unikit-ai rules registry [show|set|reset|init]  # Manage the registry URL
```

### Extensions

```bash
unikit-ai extension add <source>         # Install from local path, git URL, or GitHub shorthand
unikit-ai extension list                 # List installed extensions
unikit-ai extension update [--force]     # Check and update extensions
unikit-ai extension remove <name>        # Remove an installed extension
```

See [Extensions](extensions.md) for authoring guidelines.

## What Gets Installed

### Skills (19)

All skills use the `unikit-` prefix and are installed to the agent's skills directory:

| Category | Skills |
|----------|--------|
| **Setup** | `unikit`, `unikit-architecture` |
| **Workflow** | `unikit-explore`, `unikit-plan`, `unikit-improve`, `unikit-implement`, `unikit-fix`, `unikit-verify`, `unikit-commit`, `unikit-evolve`, `unikit-roadmap`, `unikit-review` |
| **Development** | `unikit-devcontext` |
| **Dynamic memory** | `unikit-memory`, `unikit-rules`, `unikit-rules-registry` |
| **Knowledge base** | `unikit-docs` |
| **Skill overrides** | `unikit-skills-context` |
| **Utility** | `unikit-todo` |

### Subagents (8)

Background sidecars and coordinators for parallel execution and read-only audits:

| Subagent | Role |
|-------|------|
| `unikit-implement-coordinator` | Dependency-aware plan execution coordinator |
| `unikit-implement-worker` | Single-task worker spawned by the coordinator |
| `unikit-plan-coordinator` | Feature-plan polishing coordinator |
| `unikit-plan-polisher` | Single-pass plan refiner spawned by the coordinator |
| `unikit-architecture-sidecar` | Read-only architecture audit |
| `unikit-commit-sidecar` | Commit preparation (diff inspection, message draft) |
| `unikit-review-sidecar` | Read-only code review |
| `unikit-docs-sidecar` | Documentation drift detection |

Workflow skills (`/unikit-implement`, `/unikit-fix`, `/unikit-verify`) own code-writing directly. They load rules and engine principles once at the start of execution (Bootstrap) and then implement tasks inline with `Read/Edit/Write/Bash`. The named delegation aliases - `develop-agent`, `rules-agent`, `docs-agent` - still expand to `Agent(subagent_type: "general-purpose", skills: [...])` calls, but `develop-agent` is now reserved for true parallel scopes or deep-dive single tasks, not for every task.

### Dynamic Memory Rules

Rules are **not shipped inside the npm package**. They are fetched from a remote **rules registry** on first use and cached under `.unikit/memory/`:

- **Core** - five fixed ids always loaded: `code-style`, `design-principles`, `folders-structure`, `performance`, `testing`. Installed by `/unikit` during setup (and re-checked on every `update`)
- **Stack** - framework-specific, loaded on demand (UniTask, R3, NodeCanvas, Odin, DOTween, Zenject, …). You only get the rules matching your project's tech stack

The registry chain is: **primary** (custom URL from `init`, if any) → **official** (`NintendaDev/unikit-ai-rules`) → **bundled snapshot** shipped inside the npm tarball as last-resort fallback.

You are not limited to what the registry ships. Use `/unikit-memory` to generate a rule for **any** framework or library in your stack - it uses Context7 and web search to produce accurate, up-to-date rules you can start developing with immediately.

A `RULES_INDEX.md` file is auto-generated with descriptions and "Load when" triggers for each rule.

### MCP Servers

For agents with MCP support, the wizard configures:

| Engine | Engine MCP | General |
|--------|-----------|---------|
| Unity | [UnityMCP](https://github.com/CoplayDev/unity-mcp) | [Context7](https://github.com/upstash/context7) |
| Godot 4 / Godot 4 .NET | [Godot MCP](https://github.com/Coding-Solo/godot-mcp) | [Context7](https://github.com/upstash/context7) |
| Unreal Engine 5 | [Unreal MCP](https://github.com/ChiR24/Unreal_mcp) | [Context7](https://github.com/upstash/context7) |

Engine MCP servers give the agent real-time feedback - compilation errors, tests, logs - so it can fix issues without developer involvement. Context7 is used by `/unikit-memory` and other skills for up-to-date library documentation lookup.

## Project Structure After Init

Example for a Unity project with Claude Code (full schema in [Configuration](configuration.md)):

```
your-game-project/
├── .claude/                      # Agent config dir (varies by agent)
│   ├── skills/                   # 19 skills
│   └── agents/                   # 8 subagents (sidecars, coordinators, workers)
├── .unikit/                      # UniKit AI working directory
│   ├── config.yaml               # User-editable config (language, workflow, git) - written by /unikit
│   ├── DESCRIPTION.md            # Project spec - generated by /unikit
│   ├── ARCHITECTURE.md           # Architecture guidelines - generated by /unikit-architecture
│   ├── RULES.md                  # Project-specific rules - managed by /unikit-rules
│   ├── ROADMAP.md                # Strategic roadmap - managed by /unikit-roadmap
│   ├── TODO.md                   # Task checklist - managed by /unikit-todo
│   ├── memory/                   # Dynamic memory (populated from the rules registry)
│   │   ├── RULES_INDEX.md        # Auto-generated rule index
│   │   ├── core/                 # Always-loaded rules
│   │   └── stack/                # On-demand rules (+ references/)
│   ├── plans/                    # Feature plans - managed by /unikit-plan
│   ├── patches/                  # Fix patches - created by /unikit-fix
│   ├── skill-context/            # Skill overrides - /unikit-evolve, /unikit-skills-context
│   └── evolutions/               # Evolution logs - /unikit-evolve
├── AGENTS.md                     # Project structure map - generated by /unikit
├── .mcp.json                     # MCP config (Claude Code)
└── .unikit.json                  # UniKit AI installation config
```

## See Also

- [Best Practices](best-practices.md) - practical tips for working with the agent effectively
- [Development Workflow](workflow.md) - the full flow from explore to commit
- [Rules Registry](rules-registry.md) - how rules are fetched and cached
- [Configuration](configuration.md) - full `.unikit.json` and `.unikit/config.yaml` schema
