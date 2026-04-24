<p align="center">
  <a href="https://www.npmjs.com/package/unikit-ai">
    <img src="https://img.shields.io/npm/v/unikit-ai?label=version" alt="Version" />
  </a>
  <a href="https://github.com/NintendaDev/unikit-ai/actions/workflows/tests.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/NintendaDev/unikit-ai/tests.yml?branch=main&label=tests" alt="Tests" />
  </a>
  <a href="https://unikit.nintenda.dev/">
    <img src="https://img.shields.io/badge/official%20site-unikit.nintenda.dev-0ea5e9" alt="Official Site" />
  </a>
</p>

<p align="center">
  <a href="https://ko-fi.com/nintendadev">
    <img src="https://img.shields.io/badge/Ko--fi-F16061?style=flat&logo=ko-fi&logoColor=white" alt="Ko-fi" />
  </a>
  <a href="https://boosty.to/nintendadev">
    <img src="https://img.shields.io/badge/Boosty-FF6B00?style=flat&logo=boosty&logoColor=white" alt="Boosty" />
  </a>
</p>

<p align="center">
  <img src="https://github.com/NintendaDev/unikit-ai/blob/main/img/unikit-logo.png" alt="UniKit AI Logo" />
</p>

# UniKit AI

> **AI-Powered Code Toolkit for Game Engines**

You want to write game code with AI, but setting up the right context, rules, and workflows takes time. UniKit AI handles all of that - skills, knowledge base, MCP servers. An engineered pipeline instead of vibe-coded prompts.

## Why UniKit AI?

- **Spec-driven development cycle** - explore idea, plan, implement, review, generate and update documentation - without writing complex prompts, everything works through the framework's pipeline
- **Framework rules out of the box** - ready-made rules for engine modules and popular frameworks from the [official registry](https://github.com/NintendaDev/unikit-ai-rules). Plug in your own Git registry to carry a private rule library across projects, or generate fresh rules from your codebase on the fly
- **Dynamic memory** - one memory for all engine frameworks instead of a separate skill per library. Core rules always loaded, stack rules loaded dynamically by task context - only relevant rules are pulled in, saving tokens and keeping the context window lean
- **Self-learning memory** - during development the agent creates patches from bug fixes and code reviews, then distills them into improved project rules and dynamic memory. The system gets smarter with every fix
- **Flexible, not rigid** - full spec-driven pipeline when you need predictability, or classic prompt-based work when you need speed. In both modes the agent has the full framework memory - core rules, architecture, stack - and loads stack-specific rules dynamically
- **Built for game engines, by a game developer** - no generic boilerplate from general-purpose frameworks. Every skill, rule, and workflow is designed specifically for game code development with native support for each engine

## Scope

UniKit AI focuses on **game code** - architecture, systems, tests, refactoring. 
Scene setup, prefabs, and assets are not covered yet - asset-level workflows 
are on the roadmap.

## Supported Engines

| Engine | Console Reading | Test Running |
|--------|----------------|--------------|
| Unity | Yes | Yes (requires [UnityMCP](https://github.com/CoplayDev/unity-mcp)) |
| Godot 4 | Yes | Yes (requires [Godot MCP](https://github.com/Coding-Solo/godot-mcp)) |
| Unreal Engine 5 | Yes | Yes (requires [Unreal MCP](https://github.com/ChiR24/Unreal_mcp)) |

---

## Supported Agents

**Claude Code** is the recommended agent.

- **Full native support** - primary development and optimization of UniKit AI are focused on Claude Code
- **Advanced orchestration** - only Claude Code provides full support for dev subagents and complex task orchestration

| Agent | Config Directory | MCP Support | Status |
|-------|-----------------|-------------|--------|
| Claude Code | `.claude/` | Yes (`.mcp.json`) | Stable |
| Codex CLI | `.codex/` | Yes (`.codex/config.toml`) | Beta |
| Cursor | `.cursor/` | Yes (`.cursor/mcp.json`) | Beta |
| Gemini CLI | `.gemini/` | Yes (`.gemini/settings.json`) | Beta |
| Qwen Code | `.qwen/` | Yes (`.qwen/settings.json`) | Beta |
| OpenCode | `.opencode/` | Yes (`opencode.json`) | Beta |

Select one or more during `unikit-ai init`. The wizard renders a single flat checkbox list with a right-aligned `[Stable]` / `[Beta]` tag next to each agent (stable agents listed first). Beta agents are fully wired in but rough edges are still possible. See [docs/agents.md](docs/agents.md) for agent-specific caveats and [docs/configuration.md](docs/configuration.md) for configuration details.

---

## Installation & Updating

```bash
# install
npm install -g unikit-ai

# update the CLI package itself to the latest version from npm
unikit-ai self-update

# reinstall only what changed in the user project (hash-based detection)
unikit-ai update

# clean reinstall
unikit-ai update --force
```

## Quick Start

```bash
unikit-ai init              # In your game project directory
```

This will:
- Ask which AI agent you use
- Select your game engine
- Configure MCP servers
- Install skills, subagents, and engine templates

Rules (core + stack) are installed separately by `/unikit` - after `init` finishes, run `/unikit` in your AI agent. It bootstraps `.unikit/memory/` via the registry chain and generates stack-specific rules for whatever it finds in your project.

It's highly recommended to install an MCP server for your engine before running `unikit-ai init`. Engine MCP servers give the agent real-time feedback - reading console logs, catching compilation errors, and running tests - so the agent can fix issues without developer involvement. See the [Supported Engines](#supported-engines) table for available MCP servers.

**[Context7](https://github.com/upstash/context7)** is also recommended - the agent uses it for generating framework rules and deep research of libraries and APIs.

Then open your AI agent and start working:

```
/unikit
```

`/unikit` scans your game project, detects the full tech stack, asks targeted questions to fill in gaps, generates project description and architecture files, then bootstraps starter rules for every framework in your stack so the agent is ready to write idiomatic code from the first prompt.

### Example Workflow

Say you want to add an item rarity system with visual effects.

**1. Explore** - research the idea, analyze the codebase, find integration points:
```
/unikit-explore Add item rarity system with rarity tiers and drop logic
```
The agent produces a research document with diagrams, option comparisons, and architectural recommendations. Save it or feed it directly into the next step.

**2. Plan** - turn research into concrete tasks:
```
/unikit-plan
```

**3. Improve** - refine the plan (run 2-3 times for complex features):
```
/unikit-improve
```

**4. Implement** - execute tasks phase by phase, test in-game after each one:
```
/unikit-implement
```

**5. Review & Verify** - check code against project rules, verify completeness:
```
/unikit-review
```
```
/unikit-verify
```

**6. Commit**:
```
/unikit-commit
```

See the full [Development Workflow](docs/workflow.md) with diagram and decision table.

---

## How It Works

```
  explore ──▶ plan ──▶ improve ──▶ implement ──▶ review ──▶ verify ──▶ commit
                                       │                                  │
                                       │            fix ──▶ patch ────────┤
                                       │                                  │
                                       └──────────── evolve ◀─────────────┘
                                              distill patches into rules
```

The development loop runs through exploration, planning, implementation, and review. Bug fixes along the way generate patches that feed into the evolution step - distilling real project experience into permanent rules.

### Dynamic Memory and Remote Rules Registry

Every code task runs through a two-tier knowledge base:

- **Core rules** - always loaded: code style, design principles, folder structure, performance, testing
- **Stack rules** - loaded dynamically: only the rules relevant to the current task context (DI, async, reactive, UI, etc.)

Rules are fetched from the **[official remote registry](https://github.com/NintendaDev/unikit-ai-rules)**, versioned independently of the npm package. You can configure a custom or private registry to carry your team's rule library across projects.

→ [Dynamic Memory](docs/dynamic-memory.md) · [Rules Registry](docs/rules-registry.md)

## Self-Learning

Every bug fix and code review creates a patch - a record of what went wrong and how it was fixed. When patches accumulate, `/unikit-evolve` analyzes them and distills patterns into project rules and skill-context overrides.

```
  bug found ──▶ /unikit-fix ──▶ patch created ──▶ /unikit-evolve ──▶ new rule
                                                                        │
                                                          next session uses it
```

The agent doesn't repeat the same mistakes. The more you fix and evolve, the smarter the framework becomes for your specific project.

Learn more: [Dynamic Memory](docs/dynamic-memory.md) | [Memory & Skill Evolution](docs/evolve.md)

### Zero conflicts with other tools

Uses its own config directory and skill format, never touches standard agent files like CLAUDE.md or .cursorrules. Works alongside any other AI framework without file or skill collisions.

---

## Documentation

### Start Here

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | What is UniKit AI, supported agents, CLI commands |
| [Agents](docs/agents.md) | Supported AI agents and their known limitations |
| [Best Practices](docs/best-practices.md) | Practical tips for working with the agent effectively |

### Daily Workflow

| Guide | Description |
|-------|-------------|
| [Development Workflow](docs/workflow.md) | Workflow diagram, skill pipeline, spec-driven approach |
| [Skills Reference](docs/skills.md) | All 19 skills - explore, plan, implement, verify, evolve, and more |
| [Subagents](docs/subagents.md) | Coordinators, workers, sidecars, delegation aliases |
| [Plan Files](docs/plan-files.md) | Plan files, self-improvement patches, artifact ownership |

### Deep Dive

| Guide | Description |
|-------|-------------|
| [Dynamic Memory](docs/dynamic-memory.md) | Dynamic memory, memory pipeline, unified entry point |
| [Memory & Skill Evolution](docs/evolve.md) | How /unikit-fix patches feed into /unikit-evolve to generate rules |
| [Configuration](docs/configuration.md) | `.unikit.json`, MCP servers, project structure |
| [Rules Registry](docs/rules-registry.md) | Remote rules registry, CLI commands, state schema |
| [Extensions](docs/extensions.md) | Third-party skills, injections, replacements, MCP servers |

---

## Community
- [Telegram Community](https://t.me/nintendadev_community) - chat with other users, share your rules, get quick help
- [Github Discussions](https://github.com/NintendaDev/unikit-ai/discussions) - deeper technical discussions and framework proposals
- [Github Issues](https://github.com/NintendaDev/unikit-ai/issues) - bug reports and feature requests

## Links
- [Author Official Site](https://nintenda.dev) - personal website and hub for all author's projects
- [Author Telegram Channel](https://t.me/nintendadev_channel) - follow updates, roadmap previews, and dev blog posts
- [Unity](https://unity.com) | [Godot](https://godotengine.org) | [Unreal Engine](https://www.unrealengine.com) - Supported game engines
- [UnityMCP](https://github.com/CoplayDev/unity-mcp) | [Godot MCP](https://github.com/Coding-Solo/godot-mcp) | [Unreal MCP](https://github.com/ChiR24/Unreal_mcp) - Engine MCP servers
- [Claude Code](https://claude.ai/code) - Anthropic's AI coding agent
- [Qwen Code](https://github.com/QwenLM/qwen-code) - Alibaba's AI coding agent
- [OpenCode](https://opencode.ai) - Open-source AI coding agent

## License

MIT License. See [LICENSE](LICENSE) for details.
