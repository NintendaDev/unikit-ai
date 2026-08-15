[← Memory & Skill Evolution](evolve.md) · [Back to README](../README.md) · [Rules Registry →](rules-registry.md)

# Configuration

## `.unikit.json`

Main configuration file, created by `unikit-ai init`:

```json
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": "EngineMCP",
  "mcp": { "servers": ["unity-mcp", "context7"] },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": [
        "unikit", "unikit-architecture", "unikit-commit", "unikit-devcontext",
        "unikit-docs", "unikit-evolve", "unikit-explore", "unikit-fix", "unikit-help",
        "unikit-implement", "unikit-improve", "unikit-memory", "unikit-plan",
        "unikit-review", "unikit-roadmap", "unikit-rules", "unikit-rules-registry",
        "unikit-skills-context", "unikit-todo", "unikit-verify"
      ],
      "installedSubagents": [
        "unikit-architecture-sidecar", "unikit-commit-sidecar",
        "unikit-docs-sidecar", "unikit-review-sidecar",
        "unikit-implement-coordinator", "unikit-implement-worker",
        "unikit-plan-coordinator", "unikit-plan-polisher"
      ],
      "managedSkills": {
        "unikit": { "sourceHash": "abc123", "installedHash": "abc123" }
      },
      "managedSubagents": {
        "unikit-architecture-sidecar": { "sourceHash": "def456", "installedHash": "def456" }
      }
    }
  ],
  "rulesRegistry": "https://raw.githubusercontent.com/NintendaDev/unikit-ai-rules/main",
  "rules": {
    "installed": {
      "version": "1.0.0",
      "core": [
        { "name": "code-style",        "source": "registry", "origin": "official", "version": "1.2.0", "installed_hash": "sha256:..." },
        { "name": "design-principles", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "folders-structure", "source": "registry", "origin": "official", "version": "1.1.0", "installed_hash": "sha256:..." },
        { "name": "performance",       "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "testing",           "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." }
      ],
      "stack": [
        { "name": "aspid-mvvm", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "node-canvas", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "odin",        "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "r3",          "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "unitask",     "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." }
      ]
    }
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `version` | Package version at time of install |
| `engine` | Game engine identifier (`unity`, `godot`, `godot-net`, `unreal-engine-5`) |
| `engineMcpKey` | MCP server key for the selected engine (or `null`) |
| `rulesRegistry` | Rules registry URL or local path. Defaults to the official `NintendaDev/unikit-ai-rules` URL. See [Rules Registry](rules-registry.md) for details. |
| `mcp.servers` | Globally selected MCP server file IDs |
| `agents` | Array of installed agent configurations |
| `agents[].id` | Agent identifier (`claude`) |
| `agents[].skillsDir` | Where skills are installed |
| `agents[].subagentsDir` | Where subagent .md files are installed |
| `agents[].installedSkills` | List of installed skill names |
| `agents[].installedSubagents` | List of installed subagent names |
| `agents[].managedSkills` | SHA-256 hash-based change tracking for skill updates |
| `agents[].managedSubagents` | SHA-256 hash-based change tracking for subagent updates |
| `extensions` | Array of installed extension records (optional) |
| `rules.installed` | Currently installed dynamic memory (core + stack). Each entry is an object `{ name, source, origin?, version?, installed_hash? }`. See [Rules Registry](rules-registry.md#unikitjson-registry-fields) for field descriptions. Legacy `string[]` entries are normalized to `{ name, source: "installer" }` on load. |

## `.unikit/config.yaml`

User-editable configuration bootstrapped by `/unikit`. All sections are optional - defaults are used when not specified. Skills read this file at the start of every command (canonical Step 0) to determine language, workflow, and git behavior.

The full schema with comments lives in `skills/unikit/references/config-template.yaml`.

```yaml
language:
  ui: en
  artifacts: en
  rules: en
  technical_terms: keep

workflow:
  research_relevance_days: 7

git:
  enabled: true
  base_branch: main
  create_branches: true
  branch_prefix: feature/
  skip_push_after_commit: false
```

### `language` section

| Key | Description | Default |
|-----|-------------|---------|
| `ui` | Language for AI-agent communication (prompts, questions, explanations). Options: `en`, `ru`, `de`, `fr`, `es`, `zh`, `ja`, `ko`, `pt`, `it` | `en` |
| `artifacts` | Language for generated artifacts (plans, specs, documentation). Same options as `ui`. | same as `ui` |
| `rules` | Language for knowledge base rule files: everything under `.unikit/memory/` (`core/`, `stack/`, `references/`, `RULES_INDEX.md`), `.unikit/RULES.md`, and skill-context rules. Intentionally decoupled from `ui` and `artifacts` - rule files are consumed by AI agents for prompt matching; keeping them in a stable language reduces semantic drift across agents and teams. Changing `ui` or `artifacts` does NOT change the language of existing rule files. **Strongly not recommended to change from `en`** - non-English rule files cause semantic drift and inconsistent agent behavior. Default is always `en`; can only be changed by manually editing this file (skills never write to this key). | `en` |
| `technical_terms` | How to handle technical terms in translations. `keep` - preserve English terms (API, prefab, shader, ECS). `translate` - translate where a common translation exists. **Strongly not recommended to change from `keep`** - translating technical terms degrades agent accuracy. Default is always `keep`; can only be changed by manually editing this file (skills never write to this key). | `keep` |

### `workflow` section

| Key | Description | Default |
|-----|-------------|---------|
| `research_relevance_days` | Maximum age (in days) for research notes to be considered fresh by `/unikit-plan`. Older research is flagged as stale and a refresh is suggested. | `30` |

### `git` section

| Key | Description | Default |
|-----|-------------|---------|
| `enabled` | Whether this project uses git-aware workflows. If `false`, `/unikit-plan full` does not create branches, and `/unikit-review`/`/unikit-verify` do not assume a base branch exists. | auto-detected from `.git` presence |
| `base_branch` | Default branch for diff/review/merge targets (e.g. `main`, `master`, `develop`). | auto-detected, fallback `main` |
| `create_branches` | Automatically create feature branches for plans. Applies only when `git.enabled = true`. | `true` |
| `branch_prefix` | Branch name prefix for new features. Applies only when `create_branches = true`. | `feature/` |
| `skip_push_after_commit` | If `true`, `/unikit-commit` ends after a successful local commit with no push prompt. | `false` |

## MCP Configuration

UniKit AI writes MCP server configuration into the file selected per agent: `.mcp.json` (Claude Code), `.codex/config.toml` (Codex CLI), `.cursor/mcp.json` (Cursor), `.qwen/settings.json` (Qwen Code), `opencode.json` (OpenCode), or `.agents/mcp_config.json` (Antigravity).

Servers that share one `key` are **alternative implementations of the same engine integration** — the wizard offers them as a radio group and you pick exactly one. Servers with a unique key are offered as a checkbox and can be combined freely.

### UnityMCP

Two servers compete under this key. The wizard lists them in `order`, so **Unity Biome** is the default offer on a fresh install.

#### Unity Biome MCP (`order: 1`)

```json
{
  "command": "uvx",
  "args": ["--from", "git+https://github.com/german-krasnikov/unity-biome-mcp.git#subdirectory=server", "unity-biome-mcp"]
}
```

Backed by [unity-biome-mcp](https://github.com/german-krasnikov/unity-biome-mcp). Requires **Unity 6 (6000.0+)** and [`uv`](https://docs.astral.sh/uv/). Install the Unity package from the git URL `https://github.com/german-krasnikov/unity-biome-mcp.git?path=unity-plugin`, then run `MCP > Setup Wizard` in Unity. The Editor must be running — the server finds its port through `~/.unity-biome-mcp/ports/*.port`, so no env vars are needed.

The most capable of the four engine servers: transactional scene edits (`scene_change_plan` → `apply_scene_change`), a real console watermark (`console_mark` + `get_console_since`), visual regression baselines, and uGUI / Timeline / Shader Graph authoring. It is stdio, so unlike the HTTP servers it also reaches the OpenCode agent.

Only **38 of 163** tools are visible up front; the rest unlock per category via `discover_tools`. The delivered `capabilities.md` shard explains the protocol — see [Engine-MCP shards](#engine-mcp-shards) below.

#### Coplay Unity MCP (`order: 2`)

```json
{
  "type": "http",
  "url": "http://127.0.0.1:8080/mcp"
}
```

Backed by the [MCP for Unity](https://github.com/CoplayDev/unity-mcp) package (Coplay). Requires the package installed in your Unity project and the Unity Editor running. 48 tools in 10 groups; only `core` is active by default, the rest unlock via `manage_tools(action="activate", group=…)`. Provides:
- Read Unity console logs
- Trigger a domain reload / asset refresh
- Run EditMode and PlayMode tests
- A brace-balance sanity check for scripts
- Editor authoring — scenes and GameObjects, components, prefabs, assets and ScriptableObjects, UI Toolkit documents, materials/textures/VFX, AnimatorControllers, and project settings (tags, layers, physics matrix, render pipeline)

**Not covered at all:** the Input System, Timeline, Shader Graph, and visual baselines. Editor tasks of those kinds degrade to `⏸️ MANUAL` rather than being attempted — see [Editor tasks](plan-files.md#editor-tasks).

Two caveats worth knowing before you rely on it:

- **The HTTP server does not start on its own.** Start it manually via `Window > MCP for Unity > Start Server`. Until it is running, every tool call fails to connect.
- **The Unity package manages MCP client configs itself.** On editor load it rewrites (and can remove) MCP entries written by other tools, including the ones UniKit AI installs. Disable that behavior with the EditorPref `MCPForUnity.AutoRegisterEnabled=false` if you want UniKit AI to stay the owner of your agent config.

### GodotMCP

Three servers compete under this key; **Fennara** is the default offer on a fresh install.

#### Fennara Godot AI (`order: 1`, free)

```json
{
  "configByPlatform": {
    "win32":  { "command": "{{localappdata}}\\Fennara\\bin\\fennara-mcp.exe", "args": [], "env": {} },
    "darwin": { "command": "{{home}}/Library/Application Support/Fennara/bin/fennara-mcp", "args": [], "env": {} },
    "linux":  { "command": "{{home}}/.local/share/fennara/bin/fennara-mcp", "args": [], "env": {} }
  }
}
```

Backed by [fennara-godot-ai](https://github.com/fennaraOfficial/fennara-godot-ai). Requires **Godot 4.5+**, x86_64 on Windows/Linux or arm64 on macOS; on Windows also the MSVC Redistributable 2015-2022 x64. Before the first run: install the CLI, run `fennara install` inside the Godot project, then enable the addon.

- **The editor must be open** — there is no headless mode.
- One daemon serves the account (port 41287). With two projects open, the target is chosen in the Fennara dock, not by the MCP call.
- Telemetry is enabled by default.

All 14 tools are visible immediately (no bootstrap). Its shape is a code executor rather than an operation catalog: one `run_scene_edit_script` covers scene, UI, VFX and animation work. It is the only Godot server with real run feedback (full stdout+stderr behind a cursor) and version-accurate API docs via `get_class_info`.

This is the only config using [`configByPlatform`](#per-platform-configs) — its binary is an absolute path that differs on each OS.

#### GDAI Godot MCP (`order: 2`, paid) · Coding-Solo Godot MCP (`order: 3`, free)

Both are stdio servers and both work; neither ships an engine-MCP shard yet, so agents fall back to the generic development principles when driving them.

Neither is capable of **editor authoring**: GDAI exposes no authoring tool at all, and Coding-Solo offers only raw `execute_in_editor` with no audited per-kind protocol. With either selected, tasks carrying an `Editor:` line degrade to `⏸️ MANUAL` — you get the exact instruction and carry it out yourself, rather than the agent guessing tool names. See [Editor tasks](plan-files.md#editor-tasks).

### Engine-MCP shards

When you select an engine MCP, UniKit AI writes a **capability profile** for that specific server into `.unikit/system/engine-mcp/`:

| File | Read by |
|------|---------|
| `capabilities.md` | `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-devcontext` |
| `scene-authoring.md` | `/unikit-implement`, `/unikit-fix`, `/unikit-devcontext`, `unikit-implement-worker` |
| `verification.md` | `/unikit-verify` |

They exist because the four engine servers are genuinely different tools: four incompatible bootstrap protocols, four rollback models, and verification gates that are real on some servers and impossible on others. `verification.md` can mark a gate **GATE LIFTED**, which overrides the compile/test steps of `/unikit-verify` and item 5 of the development principles — without it, verify would demand a test result from a server that cannot produce one.

Mechanics worth knowing:

- The content comes from the `shards` key of the MCP JSON you selected, so it changes when your MCP choice changes. A server without a `shards` key contributes nothing, and skills skip a missing shard file silently.
- Like `cli-contract.md` and `dev-principles.md`, shards are **system assets — not hash-tracked**. Every `init` / `update` rewrites them from source, so local edits are lost. Put durable project knowledge in `.unikit/memory/` instead.
- Orphan files are deleted, not just overwritten. Switching engines (or deselecting a server) clears the stale profile rather than leaving a Unity profile in a Godot project.

### MCP JSON schema fields

Beyond `key` / `displayName` / `config`, an MCP JSON may declare three optional fields. All are backward compatible — a config without them behaves exactly as before.

| Field | Purpose |
|-------|---------|
| `order` | Presentation order within a `key` group (ascending, 1-based; missing sorts last). Drives the wizard's pre-selection and the order contributions are concatenated into a shard. It does **not** affect the order servers are written into a settings file. |
| `verified` | `{ version, date, toolRegistry }` — which server version the `allowed-tools` names were last audited against, and the registry file they were read from. Printed in the `init` summary. MCP versions are deliberately not pinned, so this stamp is how you tell whether a tool list may have drifted. |
| `configByPlatform` | Per-OS config variants keyed by `win32` / `darwin` / `linux`, for servers whose binary path differs per platform. |

#### Per-platform configs

`configByPlatform` wins when it has an entry for the current platform; otherwise the plain `config` is used. A platform outside the three known ids therefore falls back to `config` — and a server that has neither is skipped with a warning rather than failing the install.

Two path tokens are expanded recursively through the selected config (in `command`, in any `args` element, in `env` values):

| Token | Expands to |
|-------|-----------|
| `{{home}}` | `os.homedir()` |
| `{{localappdata}}` | `%LOCALAPPDATA%`, falling back to `~/AppData/Local` |

No existence check is performed on the result — if the binary is not installed yet, your MCP client reports that, not UniKit AI.

### Re-running `init`

On a re-init the wizard mirrors what `.unikit.json` already records:

- **Checkbox groups** (unique keys) pre-check the servers you had installed.
- **Radio groups** (competing keys) pre-select your previous choice.
- `Skip` is never pre-selected — "you skipped it last time" and "there was no choice last time" are indistinguishable on disk, so the wizard re-offers the recommended server rather than silently disabling an MCP.

`order: 1` therefore decides the default only on a **fresh** install.

Changing your MCP selection reinstalls all skills and subagents: the selection is part of their source hash, which is how stale `mcp__<Key>__*` entries get cleared from the installed frontmatter.

### UnrealMCP

```json
{
  "type": "http",
  "url": "http://localhost:3000/mcp"
}
```

Backed by [ChiR24 Unreal MCP](https://github.com/ChiR24/Unreal_mcp) over its **native** transport (no Node.js bridge process). Setup:

- Enable **Enable Native MCP** in the plugin settings (`bEnableNativeMCP` defaults to `false`; the server then listens on port 3000).
- A C++ project is required: copy `plugins/McpAutomationBridge` into `<Project>/Plugins/` and build it.
- Enable `PythonScriptPlugin`, `EditorScriptingUtilities`, `Niagara`, `GameplayAbilities` and `SmartObjects`.
- The Unreal Editor must be running.

The server exposes exactly **one** tool name — `unreal` — which dispatches to every underlying action. There is no per-action granularity, so `allowed-tools` cannot narrow what an agent may do with this server: granting `unreal` grants everything the plugin implements.

### Context7

```json
{
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp@latest"]
}
```

Provides up-to-date documentation for any library. Used by `/unikit-memory` to enrich dynamic memory.

### Known limitation: OpenCode does not receive HTTP servers

`src/core/mcp-writers/opencode-writer.ts` only supports stdio servers — those whose config carries a string `command`. Servers declared with `{ "type": "http", "url": ... }` are skipped with a `console.warn`; installation itself does not fail.

In practice this means **UnityMCP (Coplay) and UnrealMCP (ChiR24) are not configured for the OpenCode agent**. All other agents (Claude Code, Codex CLI, Cursor, Qwen Code, Antigravity) receive them normally. If you use OpenCode with Unity or Unreal, add the HTTP server to `opencode.json` by hand.

## Rules Manifest

`data/rules-manifest.json` contains a `requiredBy` map only. It maps each core rule id (canonical lowercase-hyphen, no `.md`) to either `"all"` or an array of skill names that must load that rule. Example:

```json
{
  "requiredBy": {
    "code-style": "all",
    "pipeline": ["unikit-explore", "unikit-plan", "unikit-improve"]
  }
}
```

Rule metadata (`id`, `description`, `version`, `references`) lives in the remote registry `manifest.json`; the `Load when` text stays exclusively inside each rule `.md` file and is parsed at runtime by `parseRuleMetadataFromContent()` when building `RULES_INDEX.md` and when `rules show` prints the header. See `CLAUDE.md` → **Content Layers** for the full split.

## Supported Agents

| Agent | Config Dir | Skills Dir | MCP Support |
|-------|-----------|------------|-------------|
| Claude Code | `.claude` | `.claude/skills` | Yes (`.mcp.json`) |
| Codex CLI | `.codex` | `.codex/skills` | Yes (`.codex/config.toml`) |
| Cursor | `.cursor` | `.cursor/skills` | Yes (`.cursor/mcp.json`) |
| Qwen Code | `.qwen` | `.qwen/skills` | Yes (`.qwen/settings.json`) |
| OpenCode | `.opencode` | `.opencode/skills` | Yes (`opencode.json`) |
| Antigravity | `.agents` | `.agents/skills` | Yes (`.agents/mcp_config.json`) |

## Project Structure

After initialization (example for Claude Code):

```
your-unity-project/
├── .claude/                      # Agent config dir
│   ├── skills/                   # 20 code-pipeline skills (+ 11 unikit-gd-* if the Game Design group was selected)
│   │   ├── unikit/
│   │   │   └── references/
│   │   ├── unikit-architecture/
│   │   ├── unikit-commit/
│   │   ├── unikit-devcontext/
│   │   ├── unikit-docs/
│   │   │   ├── references/
│   │   │   └── templates/
│   │   ├── unikit-evolve/
│   │   ├── unikit-explore/
│   │   │   └── references/
│   │   ├── unikit-fix/
│   │   ├── unikit-help/
│   │   │   └── references/
│   │   ├── unikit-implement/
│   │   ├── unikit-improve/
│   │   ├── unikit-memory/
│   │   ├── unikit-plan/
│   │   │   └── references/
│   │   ├── unikit-review/
│   │   ├── unikit-roadmap/
│   │   ├── unikit-rules/
│   │   ├── unikit-rules-registry/
│   │   ├── unikit-skills-context/
│   │   ├── unikit-todo/
│   │   │   └── assets/
│   │   ├── unikit-verify/
│   │   │   └── references/
│   │   └── unikit-gd-*/          # 11 game-design skills, one dir each - see Game-Design Module
│   └── agents/                    # Subagents directory
│       └── unikit-architecture-sidecar.md    # 8 subagent files (sidecars, coordinators, workers)
├── .unikit/                      # UniKit AI working directory
│   ├── config.yaml               # User-editable config (language, workflow, git)
│   ├── memory/                   # Dynamic memory, partitioned per knowledge module
│   │   ├── RULES_INDEX.md        # Auto-generated rule index
│   │   ├── code/
│   │   │   ├── core/              # 5 always-loaded rules
│   │   │   │   ├── code-style.md
│   │   │   │   ├── design-principles.md
│   │   │   │   ├── folders-structure.md
│   │   │   │   ├── performance.md
│   │   │   │   └── testing.md
│   │   │   └── stack/             # On-demand rules
│   │   │       ├── aspid-mvvm.md
│   │   │       ├── node-canvas.md
│   │   │       ├── imgui-editor-tools.md
│   │   │       ├── r3.md
│   │   │       ├── unitask.md
│   │   │       └── references/    # 9 detailed reference files
│   │   └── gamedesign/            # only if the Game Design skills are installed
│   │       ├── core/               # canonical domain knowledge (frameworks, balance, economy, ...)
│   │       └── library/            # empty studio slot for project-specific rules
│   ├── DESCRIPTION.md            # Project spec (generated by /unikit)
│   ├── ARCHITECTURE.md           # Architecture guidelines (generated by /unikit-architecture)
│   ├── RULES.md                  # Project-specific rules (managed by /unikit-rules)
│   ├── ROADMAP.md                # Strategic roadmap (managed by /unikit-roadmap)
│   ├── TODO.md                   # Task checklist (managed by /unikit-todo)
│   ├── code/                     # Dev-pipeline workspace
│   │   ├── plans/                 # Feature plans (managed by /unikit-plan)
│   │   ├── patches/               # Fix patches (created by /unikit-fix)
│   │   └── researches/            # Discovery output (created by /unikit-explore)
│   ├── gamedesign/                # GDD workspace (GAME.md, GD-IDS.yaml, systems/, flows/, ...) - created on first /unikit-gd-spec use
│   ├── skill-context/            # Skill overrides (/unikit-evolve, /unikit-skills-context)
│   └── evolutions/               # Evolution logs (generated by /unikit-evolve)
├── AGENTS.md                     # Project structure map (generated by /unikit)
├── .mcp.json                     # MCP config (Claude Code)
└── .unikit.json                  # UniKit AI installation config
```

## See Also

- [Getting Started](getting-started.md) - installation, supported agents, first project
- [Development Workflow](workflow.md) - how to use the workflow skills
- [Dynamic Memory](dynamic-memory.md) - how the dynamic memory works
