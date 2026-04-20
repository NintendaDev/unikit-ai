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
| Gemini CLI | `.gemini/` | Yes (`.gemini/settings.json`) | Beta |
| Qwen Code | `.qwen/` | Yes (`.qwen/settings.json`) | Beta |
| OpenCode | `.opencode/` | Yes (`opencode.json`) | Beta |

Select one or more during `unikit-ai init`. The wizard renders a single flat checkbox list with a right-aligned `[Stable]` / `[Beta]` tag next to each agent (stable agents listed first). Beta agents are fully wired in but rough edges are still possible. See [configuration.md](configuration.md) for details.

## Known Limitations

The issues below are recurring rough edges we see with beta agents in practice. Claude Code is not listed - it is the reference agent that primary development targets.

### Codex CLI

Codex CLI is the only supported agent that blocks automatic subagent launches at the system-prompt level - no other agent in the table above has this restriction. As a result, there is currently no reliable way to launch a subagent from a skill automatically. UniKit AI skills include dedicated instructions to try launching a subagent automatically and, if that is not possible, to ask the user. In practice this does not always work: the agent often takes the fallback branch - doing the work itself without a subagent, or just printing recommendations on which commands the user should run manually.

### Cursor

Subagents work well, but there is no Skill Tool available to them. To run a subagent against a skill, the subagent's instruction includes an explicit step to read the target skill's `SKILL.md` and follow it. Overall this works acceptably.

### Gemini CLI

When launching some skills, the agent may stall at the very start and do nothing until the user types something like "Continue" or "Proceed". The root cause is still unclear - the behaviour reproduces on both Windows and macOS.

### OpenCode and Qwen Code

Same "Continue" issue as Gemini CLI: the agent may pause at the beginning of a skill and only resume after an explicit user nudge.

## See Also

- [Getting Started](getting-started.md) - installation and first-run wizard
- [Subagents](subagents.md) - coordinators, workers, and sidecars that agents orchestrate
- [Configuration](configuration.md) - `.unikit.json`, MCP servers, project structure
