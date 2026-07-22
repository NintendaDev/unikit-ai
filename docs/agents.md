[← Getting Started](getting-started.md) · [Back to README](../README.md) · [Best Practices →](best-practices.md)

# Agents

## Supported Agents

**Claude Code** is the recommended agent.

- **Full native support** - primary development and optimization of UniKit AI are focused on Claude Code
- **Advanced orchestration** - only Claude Code provides full support for dev subagents and complex task orchestration

| Agent | Config Directory | MCP Support | Status |
|-------|-----------------|-------------|--------|
| Claude Code | `.claude/` | Yes (`.mcp.json`) | Stable |
| Codex CLI | `.codex/` | Yes (`.codex/config.toml`) | Beta |
| Cursor | `.cursor/` | Yes (`.cursor/mcp.json`) | Beta |
| Qwen Code | `.qwen/` | Yes (`.qwen/settings.json`) | Beta |
| OpenCode | `.opencode/` | Yes (`opencode.json`) | Beta |
| Antigravity | `.agents/` | Yes (`.agents/mcp_config.json`) | Beta |

Select one or more during `unikit-ai init`. The wizard renders a single flat checkbox list with a right-aligned `[Stable]` / `[Beta]` tag next to each agent (stable agents listed first). Beta agents are fully wired in but rough edges are still possible. See [configuration.md](configuration.md) for details.

## Known Limitations

The issues below are recurring rough edges we see with beta agents in practice. Claude Code is not listed - it is the reference agent that primary development targets.

### Codex CLI

Codex CLI is the only supported agent that blocks automatic subagent launches at the system-prompt level - no other agent in the table above has this restriction. As a result, there is currently no reliable way to launch a subagent from a skill automatically. UniKit AI skills include dedicated instructions to try launching a subagent automatically and, if that is not possible, to ask the user. In practice this does not always work: the agent often takes the fallback branch - doing the work itself without a subagent, or just printing recommendations on which commands the user should run manually.

### Cursor

Subagents work well, but there is no Skill Tool available to them. To run a subagent against a skill, the subagent's instruction includes an explicit step to read the target skill's `SKILL.md` and follow it. Overall this works acceptably.

### OpenCode and Qwen Code

When launching some skills, the agent may pause at the very start and do nothing until the user types something like "Continue" or "Proceed". The root cause is still unclear - the behaviour reproduces on both Windows and macOS.

### Antigravity

Antigravity (the IDE and CLI share one `.agents/` workspace, so UniKit treats them as a single agent) installs every UniKit skill as an Antigravity **skill** - a `.agents/skills/<name>/` directory triggered by its `description`, like Claude Code. There is no `/unikit-*` slash command and no `Skill` tool, so multi-skill orchestration (`/unikit`, `/unikit-gd-apply`) degrades to the Tier 3 "print & ask" path: the skill prints the ordered commands for you to run by hand instead of chaining them automatically.

MCP is configured automatically into `.agents/mcp_config.json`, same as other agents; a separate global `~/.gemini/config/mcp_config.json` remains available for user-wide servers, untouched by UniKit.

## See Also

- [Getting Started](getting-started.md) - installation and first-run wizard
- [Subagents](subagents.md) - coordinators, workers, and sidecars that agents orchestrate
- [Configuration](configuration.md) - `.unikit.json`, MCP servers, project structure
