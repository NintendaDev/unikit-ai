[← Getting Started](getting-started.md) · [Back to README](../README.md) · [Best Practices →](best-practices.md)

# Agents

## Supported Agents

**Claude Code** is the recommended agent.

- **Full native support** - primary development and optimization of UniKit AI are focused on Claude Code
- **Advanced orchestration** - Claude Code provides full support for dev subagents and complex task orchestration; Kimi Code receives the same subagents through an install-time adapter

| Agent | Config Directory | MCP Support |
|-------|-----------------|-------------|
| Claude Code | `.claude/` | Yes (`.mcp.json`) |
| Codex CLI | `.codex/` | Yes (`.codex/config.toml`) |
| Cursor | `.cursor/` | Yes (`.cursor/mcp.json`) |
| Qwen Code | `.qwen/` | Yes (`.qwen/settings.json`) |
| OpenCode | `.opencode/` | Yes (`opencode.json`) |
| Antigravity | `.agents/` | Yes (`.agents/mcp_config.json`) |
| Kimi Code | `.kimi-code/` | Yes (`.kimi-code/mcp.json`) |
| Universal / Other | `.agents/` | Yes (`.mcp.json`) |

Select one or more during `unikit-ai init`. The wizard renders a single flat checkbox list with one row per agent. Two agents that would write skills into the same directory cannot be selected together - today that is Antigravity and Universal / Other. See [configuration.md](configuration.md) for details.

## Known Limitations

The issues below are recurring rough edges we see in practice. Claude Code is not listed - it is the reference agent that primary development targets.

### Codex CLI

Codex CLI turns an `Agent(...)` call of a skill into its own `spawn_agent` call and starts a subagent whenever a skill step names an alias - no Codex-only block in the skills is needed for that (10 of 10 launches in the probes of 2026-10-06). Its system message allows spawns only on an explicit instruction, so an optional `recon-agent` may be done by the session itself - the alias fallback allows that. `spawn_agent` has no subagent type parameter, so every call carries `fork_turns: "none"` (no inherited history) and a `task_name` of its own; see [Subagents](subagents.md#subagent-profile-per-agent).

### Cursor

Skills install and work normally. **Subagents are not installed** - `AGENT_REGISTRY.cursor` carries `supportsSubagents: false`, so `unikit-ai init` writes nothing into a `.cursor/agents/` directory. Claude Code and Kimi Code are the only agents that currently receive the bundled subagents; on Cursor, and on every other agent in the table, a skill that would normally delegate to a coordinator, worker, or sidecar does the work inline instead.

### OpenCode and Qwen Code

When launching some skills, the agent may pause at the very start and do nothing until the user types something like "Continue" or "Proceed". The root cause is still unclear - the behaviour reproduces on both Windows and macOS.

### Qwen Code

UniKit is written for the current Qwen Code, where a skill is started as `/<name>` (for example `/unikit-plan`). Skills are installed exactly as written - nothing rewrites their invocations. In the current Qwen Code `/skills <name>` only opens the skills panel and drops the argument; an older Qwen Code that knew only that form will not recognise the commands in the skill texts. The version from which `/<name>` works is not recorded.

### Antigravity

Antigravity (the IDE and CLI share one `.agents/` workspace, so UniKit treats them as a single agent) installs every UniKit skill as an Antigravity **skill** - a `.agents/skills/<name>/` directory with `SKILL.md` and `references/`. In Antigravity 2.0 a skill is invoked with `/<skill-name>`, and the CLI turns every skill into a slash command (for example `/unikit-plan`); the IDE documents no slash invocation, so there a skill is picked by its `description`. A `Skill` tool is not documented for Antigravity, so a skill that calls another skill (`/unikit`, `/unikit-gd-apply`) reads that skill's `SKILL.md` and carries it out in the same session instead of calling a tool; only when the file cannot be read does it print the command for you to run by hand.

MCP is configured automatically into `.agents/mcp_config.json`, same as other agents; a separate global `~/.gemini/config/mcp_config.json` remains available for user-wide servers, untouched by UniKit.

Antigravity is also the one agent with an install-time side effect outside the skills directory: a `postInstall` step writes UniKit guardrails to `.agents/rules/unikit.md`, and the matching `cleanup` removes that file again when you deselect Antigravity on a repeat `init`. The file is rewritten whenever UniKit installs skills for Antigravity; in a project that already has it, `unikit-ai update --force` brings its text up to date. No other agent writes a rules file of its own.

### Kimi Code

Kimi Code (the v2 CLI, command `kimi`, npm package `@moonshot-ai/kimi-code`) keeps its own `.kimi-code/` directory, so UniKit never writes into the shared `.agents/` directory for it - installing Kimi Code next to Antigravity gives two independent copies of the skills. The legacy Python `kimi-cli` (`~/.kimi/`) is not supported.

Skills are invoked as `/unikit-plan` - Kimi accepts `/<name>` as a shorthand for `/skill:<name>` - and, like every agent except Claude Code, a skill reaches a subagent by a read of its SKILL.md (see [Subagents](subagents.md#how-a-skill-reaches-a-subagent)). The subagent types the skills launch come from the agent profile: the reader is `explore` and the worker is `coder` (Kimi's only built-in type that edits files); Kimi matches types by exact name, so the case matters. See [Subagents](subagents.md#subagent-profile-per-agent).

Subagents install into `.kimi-code/agents/` through an adapter: a coordinator's `Agent(a, b, …)` tool entry becomes `Agent` plus a `subagents:` list, `claude --agent` becomes `kimi --agent`, and the two coordinators get `${base_prompt}` as the first line of their body so they keep Kimi's built-in system prompt. Start them with `kimi --agent unikit-implement-coordinator` or `kimi --agent unikit-plan-coordinator`. Frontmatter fields Kimi does not know (`maxTurns`, `permissionMode`, `background`) are left in place and expected to be ignored. The `skills:` field is the exception: Kimi does not read it either (observed 2026-10-06, Kimi 2.1.1), so the adapter removes it and writes the same skills as a read list at the top of the agent file - a line asking the agent to read each file, then the `.kimi-code/skills/<name>/SKILL.md` paths (a coordinator keeps `${base_prompt}` as its first line, the list follows it). A skill that delegates to another skill does not use a `skills` argument of the `Agent` call - no agent has one - but names the skill file in the call's prompt; see [Subagents](subagents.md#how-a-skill-reaches-a-subagent). Kimi 2.1.1 also does not confine a `kimi --agent` session to the `tools:` and `subagents:` lists of its agent file, so read those lists as the intended set rather than as a restriction. The adapter's output is part of what `unikit-ai update` tracks: when a release changes it, the next plain `update` reinstalls the Kimi agent files.

MCP servers are written to the project file `.kimi-code/mcp.json`. Kimi enables project-level MCP servers only after you trust the folder, so a freshly initialised project can show no servers until you confirm the trust prompt. A header such as `Authorization: Bearer {{env:GITHUB_PAT}}` is written as `"bearerTokenEnvVar": "GITHUB_PAT"` - set that variable in the environment `kimi` starts from; Kimi does not expand `${VAR}` inside headers. UniKit does not touch `~/.kimi-code/`, Kimi's `config.toml`/`local.toml`, or its plugins.

This integration was built from Kimi Code's documentation and package source and has not yet been confirmed in a live session.

### Universal / Other

Universal / Other is for an AI agent UniKit does not support by name. It installs the skills into `.agents/skills/` - the project directory that, by the `vercel-labs/skills` agent table, more than twenty runtimes list as their own - and writes MCP servers to `.mcp.json`, the file Claude Code uses. UniKit does not check that a given runtime really reads `.agents/skills/`: the documentation confirms it for Antigravity and the source for Kimi Code, the rest is inferred from that table.

The skill text is the same as for the other agents; the subagent types it launches are Claude Code's names, `Explore` and `general-purpose`, no model argument is passed (`subagents.model.universal` is empty by default), and a skill reaches a subagent by a read of its `SKILL.md` - there is no Skill tool to rely on. A runtime that does not know those types answers with an unknown-type error; what the model does next has not been observed yet. No subagent files are installed (`supportsSubagents: false`), and no Codex-only text is installed for it - on Codex, select Codex CLI instead. See [Subagents](subagents.md#subagent-profile-per-agent).

**It cannot be selected together with Antigravity.** Both write skills into `.agents/skills/`; with different text in one directory they would overwrite each other on every `update`, and removing one would remove the other's skills. The `init` wizard refuses the pair before anything is installed, and `update` and the `extension` commands stop with the same message (exit code 1) if `.unikit.json` was edited into that state. To move from Antigravity to Universal / Other, deselect Antigravity and select Universal / Other in one repeat `init`. Next to Codex CLI, Cursor, OpenCode or Kimi Code it is allowed, but those agents may see UniKit skills twice - once from their own directory and once from `.agents/skills/`. Next to Claude Code it is allowed too: both write the same `.mcp.json` with the same writer.

`.mcp.json` is read by the runtimes that follow Claude Code's convention. If your agent reads another MCP file, add the servers there by hand - `init` ends with the same hint.

This integration's values were taken from the `Universal / Other` agent of AI Factory and from the `vercel-labs/skills` README, and have not been confirmed in a live session.

## See Also

- [Getting Started](getting-started.md) - installation and first-run wizard
- [Subagents](subagents.md) - coordinators, workers, and sidecars that agents orchestrate
- [Configuration](configuration.md) - `.unikit.json`, MCP servers, project structure
