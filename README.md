<p align="center">
  <a href="https://www.npmjs.com/package/unikit-ai">
    <img src="https://img.shields.io/npm/v/unikit-ai?label=version" alt="Version" />
  </a>
  <a href="https://github.com/NintendaDev/unikit-ai/actions/workflows/tests.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/NintendaDev/unikit-ai/tests.yml?branch=main&label=tests" alt="Tests" />
  </a>
  <a href="https://github.com/NintendaDev/unikit-ai/blob/main/docs/skills.md">
    <img src="https://img.shields.io/badge/skills-33-8b5cf6" alt="Skills" />
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

> **The AI Development Pipeline for Games: design, code, and the engine editor**

Building a game with AI usually breaks in the same place: the agent writes a class, and then stops. The design lives in someone's head, the scene lives in the editor, and neither is something a prompt can reach. UniKit AI closes that gap and drives the loop end to end - it authors the **game design** into a machine-readable registry, plans and writes the **code** against a memory of your engine and stack, and carries the same plan into the **engine editor** through the engine's MCP server: scenes, prefabs, UI, materials, animation, project settings. Every editor tool the MCP server exposes is on the table, and every result is read back from the editor rather than taken from the response. An engineered pipeline instead of vibe-coded prompts.

## Why UniKit AI?

- **Spec-driven development cycle** - explore the idea, plan, implement, review, verify, document. Each step reads the artifact the previous one wrote, so nothing is re-derived from a prompt: no prompt engineering, no re-explaining the project every session, and a plan you can read and correct *before* a line is written. Predictable enough that a small model can execute a bundle a large one planned
- **Almost the whole cycle, not just the code** - design the game, write the code, work in the editor. One pipeline covers all three, and a single plan can mix code tasks with editor tasks - `/unikit-implement` executes both
- **The engine MCP is used to the full, and checked** - the agent gets real-time feedback from the running editor: console, compilation errors, test runs, and the editor state itself. Candidate operations come from the server's **live catalog**, asked per task, never from a stored list of names. On top of that UniKit installs the selected server's **rules tree** - a short list of *exceptions*, checks to perform where that server has been observed to mislead (a call that reports success and changes nothing, an argument silently dropped). Findings you hit during a run are recorded in the plan and curated into a durable project log
- **Framework rules out of the box** - ready-made rules for engine modules and popular frameworks from the [official registry](https://github.com/NintendaDev/unikit-ai-rules). Plug in your own Git registry to carry a private rule library across projects, or generate fresh rules from your codebase on the fly
- **Dynamic memory** - one memory for all engine frameworks instead of a separate skill per library. Core rules always loaded, stack rules loaded dynamically by task context - only relevant rules are pulled in, saving tokens and keeping the context window lean
- **Self-learning memory** - during development the agent creates patches from bug fixes and code reviews, then distills them into improved project rules and dynamic memory. The system gets smarter with every fix

## Scope

UniKit AI covers three layers of game development:

| Layer             | What it covers                                                                                                                  | Where it lives                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Game design**   | concept, pillars, systems, flows, content schemas - authored into `GD-IDS.yaml`, a registry that code plans read from            | `gamedesign` module, 11 `/unikit-gd-*` skills           |
| **Game code**     | architecture, systems, tests, refactoring, review, documentation                                                                 | `code` module, 22 code-pipeline skills                  |
| **Engine editor** | scenes, prefabs, UI, materials, animation, assets, project settings - planned as explicit targets, executed through the engine MCP | `/unikit-plan` → `/unikit-implement` → `/unikit-verify` |

Editor work is a **first-class part of a plan**, not an afterthought. `/unikit-plan` writes an `Editor: [kind] container → target : action` line next to `Files:` for every task that changes the editor's serialized state, aggregates them into an `### EDITOR TARGETS` table, and one `Editor tasks` setting decides how they run:

- **`mcp`** - through the engine MCP server. Chosen silently whenever an engine MCP is configured
- **`manual`** - nothing is touched: the task is marked `⏸️ MANUAL` and you get the exact instruction to carry out yourself
- **`direct`** - the serialized file is edited as text, offered only where the engine's format tolerates it, and always after a commit

`/unikit-verify` then reads editor targets back **through the MCP** rather than looking for source files that do not exist. See [Editor tasks](docs/plan-files.md#editor-tasks) for the full grammar.

**Editor targets are planned on Unity today.** The planning vocabulary that turns a `kind` into an engine concept ships for Unity; on Godot and Unreal Engine 5 `/unikit-plan` generates no `Editor:` fields and says so at confirmation - plans degrade to code-only, which is a normal path, not an error. The engine MCP itself is used on every engine - for compilation and run feedback during `/unikit-implement` and `/unikit-verify`, and for whatever else that particular server's live catalog turns out to offer.

Art production, audio authoring, and store/build pipelines are **not** covered.

## Supported Engines

Each engine ships one or more MCP servers. Where several are listed, they are alternatives - `unikit-ai init` offers them as a radio group and you pick one. They are shown here in the order the wizard presents them; the first is the default offer on a fresh install. The versions below are each vendor's own **floor**, and the default is not the most permissive choice - on Godot it has the highest floor of the three - so check yours before accepting it. UniKit AI does not detect your engine version.

| Engine                 | MCP servers (in wizard order)                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unity                  | [Unity Biome](https://github.com/german-krasnikov/unity-biome-mcp) (Unity 6000.0+) · [MCP for Unity](https://github.com/CoplayDev/unity-mcp) (Coplay, Unity 2021.3 LTS → 6.x)                                                                                                              |
| Godot 4 / Godot 4 .NET | [Fennara Godot AI](https://github.com/fennaraOfficial/fennara-godot-ai) - free (Godot 4.5+) · [GDAI Godot MCP](https://github.com/3ddelano/gdai-mcp-plugin-godot) - paid (Godot 4.1+) · [Coding-Solo Godot MCP](https://github.com/Coding-Solo/godot-mcp) - free (no declared minimum) |
| Unreal Engine 5        | [ChiR24 Unreal MCP](https://github.com/ChiR24/Unreal_mcp) (Unreal Engine 5.0+)                                                                                                                                                                                                          |

These servers are not interchangeable, and UniKit AI does not keep a table of who can do what - such a table is a claim about six moving targets and goes wrong quietly. What an agent may attempt comes from the server's **live catalog**, asked per task. On top of that, UniKit AI installs the selected server's **rules tree** into `.unikit/system/engine-mcp/`: a short list of *exceptions* - checks to perform where this server has been observed to mislead. All six engine servers above ship one today. A rules tree only ever adds an obligation; it never removes a right, and its absence means no known exceptions rather than no capabilities. See [docs/configuration.md](docs/configuration.md#engine-mcp-rules-tree) for the per-server detail.

---

## Supported Agents

**Claude Code** is the recommended agent.

- **Full native support** - primary development and optimization of UniKit AI are focused on Claude Code
- **Advanced orchestration** - only Claude Code provides full support for dev subagents and complex task orchestration

| Agent       | Config Directory | MCP Support                     | Status |
| ----------- | ---------------- | ------------------------------- | ------ |
| Claude Code | `.claude/`       | Yes (`.mcp.json`)               | Stable |
| Codex CLI   | `.codex/`        | Yes (`.codex/config.toml`)      | Beta   |
| Cursor      | `.cursor/`       | Yes (`.cursor/mcp.json`)        | Beta   |
| Qwen Code   | `.qwen/`         | Yes (`.qwen/settings.json`)     | Beta   |
| OpenCode    | `.opencode/`     | Yes (`opencode.json`)           | Beta   |
| Antigravity | `.agents/`       | Yes (`.agents/mcp_config.json`) | Beta   |

Select one or more during `unikit-ai init`. The wizard renders a single flat checkbox list with a right-aligned `[Stable]` / `[Beta]` tag next to each agent (stable agents listed first). Beta agents are fully wired in but rough edges are still possible. See [docs/agents.md](docs/agents.md) for agent-specific caveats and [docs/configuration.md](docs/configuration.md) for configuration details.

---

## Educational materials on YouTube (Russian)

🎞 [Как мы пишем игру на Unity полностью с AI](https://youtu.be/vAjTv0E4slo)

🎞 [От установки в проект Unity до первого AI коммита](https://youtu.be/YPwjqy6Uc_M)

🎞 [Как заставить ИИ-агента перестать угадывать архитектуру для игры в Unity](https://youtu.be/i0pY65_gNoI)

🎞 [От ИИ-плана до закоммиченной фичи на Unity](https://youtu.be/IFdmcxNRPZE)

🎞 [Память AI-агента под свой Unity проект](https://youtu.be/gAXAx7RNgC0)

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

It's highly recommended to install an MCP server for your engine before running `unikit-ai init`. The engine MCP is what turns the agent from a code generator into something that works *inside* your project - it reads the console, catches compilation errors, runs tests, and carries out editor tasks, so the agent can close the loop without developer involvement. See the [Supported Engines](#supported-engines) table for available MCP servers.

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

The plan carries both code tasks and, where the feature needs them, editor tasks - the rarity badge on the item widget, the tint material, the VFX prefab - each as an explicit `Editor:` target.

**3. Improve** - refine the plan (run 2-3 times for complex features):

```
/unikit-improve
```

**4. Implement** - execute tasks phase by phase, code and editor alike, test in-game after each one:

```
/unikit-implement
```

**5. Review & Verify** - check code against project rules, verify completeness (editor targets are read back through the MCP):

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
               │                       │                                 │
         design brief         code + editor tasks      fix ──▶ patch ────┤
         (GD-IDS.yaml)      through the engine MCP                       │
                                                                         │
                                     evolve ◀────────────────────────────┘
                           distill patches into rules
```

The development loop runs through exploration, planning, implementation, and review. Plans pull a design brief from the GDD registry when there is one, execute code and editor work through the same pipeline, and bug fixes along the way generate patches that feed into the evolution step - distilling real project experience into permanent rules.

### The engine editor and its MCP server

Everything the engine MCP exposes is on the table, and nothing about it is trusted blindly:

- **The live catalog is the authority** - candidate operations are asked from the server per task, never recalled from a stored list of tool names. Names rot faster than anything else about an MCP server
- **Rules trees add checks, never permissions** - the selected server's tree (`.unikit/system/engine-mcp/`) is keyed by *area* (`ui`, `console`, `rollback`, `batch`, `compile`, `transport`, `visual`, …) and says what to confirm, not what the server can do. A missing tree changes no rights
- **Results are read back** - a response code is not evidence that the world changed; the editor state is
- **Findings are kept** - when a server reports success and changes nothing, the executor records it in the plan's `## MCP Findings` table. `/unikit-mcp-trap` moves it into `.unikit/MCP-RECHECK-NOTES.md`, the project's durable log, and `/unikit-mcp-audit` curates it later: re-stamp when the server moves, replay in a sandbox, retire what was fixed, upstream what generalizes

→ [Editor tasks](docs/plan-files.md#editor-tasks) · [Engine-MCP rules tree](docs/configuration.md#engine-mcp-rules-tree)

### Dynamic Memory and Remote Rules Registry

Every code task runs through a two-tier knowledge base:

- **Core rules** - always loaded: code style, design principles, folder structure, performance, testing
- **Stack rules** - loaded dynamically: only the rules relevant to the current task context (DI, async, reactive, UI, etc.)

Rules are fetched from the **[official remote registry](https://github.com/NintendaDev/unikit-ai-rules)**, versioned independently of the npm package. You can configure a custom or private registry to carry your team's rule library across projects.

→ [Dynamic Memory](docs/dynamic-memory.md) · [Rules Registry](docs/rules-registry.md)

### Game design (GDD authoring)

Beyond code, UniKit ships a second knowledge module, `gamedesign`, for authoring a Game
Design Document along three machine-readable axes plus the one-page whole:

| Axis        | Skill                | Answers                                             |
| ----------- | -------------------- | --------------------------------------------------- |
| **whole**   | `/unikit-gd-spec`    | the premise, pillars, loops, win/lose               |
| **systems** | `/unikit-gd-system`  | "what are the rules"                                |
| **flows**   | `/unikit-gd-flow`    | "what the player does over time" (dynamics)         |
| **content** | `/unikit-gd-content` | "what content exists, by what schema" (the catalog) |

Ideation (`/unikit-gd-brainstorm`), research (`/unikit-gd-explore`), a review/verify pair (`/unikit-gd-review`, `/unikit-gd-verify`), a multi-zone edit dispatcher (`/unikit-gd-apply`) and a human-readable render (`/unikit-gd-docs`) round out the module. Already have a codebase and no GDD? `/unikit-gd-recon` reconstructs candidate design facts out of the existing project. It is one of the two read-only verbs allowed to cross into code (the other is the code-grounded lens of `/unikit-gd-explore`), and every fact either of them lifts is tagged as *extracted from code* rather than decided.

A **bundled genre-profile catalog** (`unikit-ai genres list/show/install`) seeds new projects from the industry genre matrix - `/unikit-gd-brainstorm` infers the genre, `/unikit-gd-spec` best-fits it to a read-only profile and seeds the GDD.

**Design ↔ code is a one-way boundary.** Design writes `GD-IDS.yaml`; code only reads
it - `/unikit-plan` pulls a `## Design` (plus `## Flow Context` / `## Content Context`) brief from the registry when planning a feature, and code never edits the GDD. There is exactly one sanctioned code → design **write**: once `/unikit-verify` confirms every acceptance
criterion is met, it stamps `implemented_version` back into the registry, so the next
planning pass - and the `GAME.md` `## System Map [gen]` - knows what's actually built.

```
  design zones ──▶ GD-IDS.yaml ──▶ plan ──▶ implement ──▶ verify
                        │                                    │
                        └──────── implemented_version ◀──────┘
                           (the one sanctioned code → design write)
```

→ [Game-Design Module](docs/gamedesign.md)

## Self-Learning

Every bug fix and code review creates a patch - a record of what went wrong and how it was fixed. When patches accumulate, `/unikit-evolve` analyzes them and distills patterns into project rules and skill-context overrides.

```
  bug found ──▶ /unikit-fix ──▶ patch created ──▶ /unikit-evolve ──▶ new rule
                                                                        │
                                                          next session uses it
```

The agent doesn't repeat the same mistakes. The more you fix and evolve, the smarter the framework becomes for your specific project. The same principle runs one level lower for the engine MCP: a server that misleads once is trapped into `.unikit/MCP-RECHECK-NOTES.md` and checked from then on.

Learn more: [Dynamic Memory](docs/dynamic-memory.md) | [Memory & Skill Evolution](docs/evolve.md)

### Zero conflicts with other tools

Uses its own config directory and skill format, never touches standard agent files like CLAUDE.md or .cursorrules. Works alongside any other AI framework without file or skill collisions.

---

## Documentation

### Start Here

| Guide                                      | Description                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| [Getting Started](docs/getting-started.md) | What is UniKit AI, supported agents, CLI commands                           |
| [Help Navigator](docs/skills.md)           | `/unikit-help` - not sure what to do next or which skill to use? Start here |
| [Agents](docs/agents.md)                   | Supported AI agents and their known limitations                             |
| [Best Practices](docs/best-practices.md)   | Practical tips for working with the agent effectively                       |

### Daily Workflow

| Guide                                    | Description                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Development Workflow](docs/workflow.md) | Workflow diagram, skill pipeline, spec-driven approach                                                                             |
| [Skills Reference](docs/skills.md)       | All 33 skills - 22 code-pipeline + 11 game-design, explore, plan, implement, verify, evolve, and more                              |
| [Subagents](docs/subagents.md)           | Coordinators, workers, sidecars, delegation aliases                                                                                |
| [Plan Files](docs/plan-files.md)         | Plan files, editor tasks, self-improvement patches, artifact ownership                                                             |
| [Game-Design Module](docs/gamedesign.md) | GDD authoring - the system / flow / content axes, the `## Content Map [gen]`, and the bundled genre-profile catalog (`genres` CLI) |

### Deep Dive

| Guide                                      | Description                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| [Dynamic Memory](docs/dynamic-memory.md)   | Dynamic memory, memory pipeline, unified entry point                     |
| [Memory & Skill Evolution](docs/evolve.md) | How /unikit-fix patches feed into /unikit-evolve to generate rules        |
| [Configuration](docs/configuration.md)     | `.unikit.json`, MCP servers, the engine-MCP rules tree, project structure |
| [Rules Registry](docs/rules-registry.md)   | Remote rules registry, CLI commands, state schema                        |
| [Extensions](docs/extensions.md)           | Third-party skills, injections, replacements, MCP servers                |

---

## Community

- [Telegram Community](https://t.me/nintendadev_community) - chat with other users, share your rules, get quick help
- [Github Discussions](https://github.com/NintendaDev/unikit-ai/discussions) - deeper technical discussions and framework proposals
- [Github Issues](https://github.com/NintendaDev/unikit-ai/issues) - bug reports and feature requests

## Links

- [Author Official Site](https://nintenda.dev) - personal website and hub for all author's projects
- [Author Telegram Channel](https://t.me/nintendadev_channel) - follow updates, roadmap previews, and dev blog posts
- [Unity](https://unity.com) | [Godot](https://godotengine.org) | [Unreal Engine](https://www.unrealengine.com) - Supported game engines
- [Unity Biome](https://github.com/german-krasnikov/unity-biome-mcp) | [MCP for Unity](https://github.com/CoplayDev/unity-mcp) - Unity MCP servers
- [Fennara Godot AI](https://github.com/fennaraOfficial/fennara-godot-ai) | [GDAI Godot MCP](https://github.com/3ddelano/gdai-mcp-plugin-godot) | [Coding-Solo Godot MCP](https://github.com/Coding-Solo/godot-mcp) - Godot MCP servers
- [ChiR24 Unreal MCP](https://github.com/ChiR24/Unreal_mcp) - Unreal Engine MCP server
- [Context7](https://github.com/upstash/context7) - library documentation MCP server
- [Claude Code](https://claude.ai/code) - Anthropic's AI coding agent
- [Qwen Code](https://github.com/QwenLM/qwen-code) - Alibaba's AI coding agent
- [OpenCode](https://opencode.ai) - Open-source AI coding agent

## License

MIT License. See [LICENSE](LICENSE) for details.
