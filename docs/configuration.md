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
        "unikit-docs", "unikit-evolve", "unikit-explore", "unikit-fix",
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
| `rules.installed` | Currently installed dynamic memory (core + stack). Each entry is an object `{ name, source, origin?, version?, installed_hash? }`. See [Rules Registry](rules-registry.md#unikit-json-registry-fields) for field descriptions. Legacy `string[]` entries are normalized to `{ name, source: "installer" }` on load. |

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

UniKit AI writes MCP server configuration into the file selected per agent: `.mcp.json` (Claude Code), `.codex/config.toml` (Codex CLI), `.cursor/mcp.json` (Cursor), `.gemini/settings.json` (Gemini CLI), `.qwen/settings.json` (Qwen Code), or `opencode.json` (OpenCode).

### Known limitation - Gemini CLI and HTTP MCP transport

The UniKit source MCP config for `UnityMCP` uses the Claude Code transport key shape `{ "type": "http", "url": "..." }`. When this config is written into `.gemini/settings.json`, Gemini CLI picks a transport based on which key is present - `command` for stdio, `url` for SSE, or `httpUrl` for streamable HTTP. Because the UniKit config ships `url` (not `httpUrl`), Gemini CLI will try to connect over SSE rather than streamable HTTP. The other four shipped MCP configs (`context7`, both Godot servers, Unreal) are stdio and work as-is on Gemini CLI. If you need streamable HTTP for `UnityMCP` on Gemini specifically, rename the `url` key to `httpUrl` in your local `.gemini/settings.json` after `unikit-ai init`.

### UnityMCP

```json
{
  "type": "http",
  "url": "http://localhost:8085/mcp"
}
```

Requires the UnityMCP package installed in your Unity project. Provides real-time access to:
- Compile and check for errors
- Run NUnit tests
- Inspect scene hierarchy
- Read Unity console logs

### Context7

```json
{
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp@latest"]
}
```

Provides up-to-date documentation for any library. Used by `/unikit-memory` to enrich dynamic memory.

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
| Gemini CLI | `.gemini` | `.gemini/skills` | Yes (`.gemini/settings.json`) |
| Qwen Code | `.qwen` | `.qwen/skills` | Yes (`.qwen/settings.json`) |
| OpenCode | `.opencode` | `.opencode/skills` | Yes (`opencode.json`) |

## Project Structure

After initialization (example for Claude Code):

```
your-unity-project/
├── .claude/                      # Agent config dir
│   ├── skills/                   # 19 skills
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
│   │   └── unikit-verify/
│   │       └── references/
│   └── agents/                    # Subagents directory
│       └── unikit-architecture-sidecar.md    # 8 subagent files (sidecars, coordinators, workers)
├── .unikit/                      # UniKit AI working directory
│   ├── config.yaml               # User-editable config (language, workflow, git)
│   ├── memory/                   # Dynamic memory
│   │   ├── RULES_INDEX.md        # Auto-generated rule index
│   │   ├── core/                 # 5 always-loaded rules
│   │   │   ├── code-style.md
│   │   │   ├── design-principles.md
│   │   │   ├── folders-structure.md
│   │   │   ├── performance.md
│   │   │   └── testing.md
│   │   └── stack/                # On-demand rules
│   │       ├── aspid-mvvm.md
│   │       ├── node-canvas.md
│   │       ├── imgui-editor-tools.md
│   │       ├── r3.md
│   │       ├── unitask.md
│   │       └── references/       # 9 detailed reference files
│   ├── DESCRIPTION.md            # Project spec (generated by /unikit)
│   ├── ARCHITECTURE.md           # Architecture guidelines (generated by /unikit-architecture)
│   ├── RULES.md                  # Project-specific rules (managed by /unikit-rules)
│   ├── ROADMAP.md                # Strategic roadmap (managed by /unikit-roadmap)
│   ├── TODO.md                   # Task checklist (managed by /unikit-todo)
│   ├── plans/                    # Feature plans (managed by /unikit-plan)
│   ├── patches/                  # Fix patches (created by /unikit-fix)
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
