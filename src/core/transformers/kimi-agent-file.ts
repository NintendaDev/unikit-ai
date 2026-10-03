import {
  AGENT_TOOL_NAME, CLAUDE_AGENT_LAUNCH, KIMI_AGENT_LAUNCH,
  KIMI_BASE_PROMPT_PLACEHOLDER, SUBAGENTS_FRONTMATTER_FIELD,
} from '../constants.js';

// The frontmatter shape agent-filter.ts recognises (LF; the repository's working tree is LF).
const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/;
// A list entry under `tools:` — the shape mcp.ts walks when it injects MCP grants.
const LIST_ENTRY_RE = /^\s+-\s+/;
const DISPATCH_ENTRY_RE = new RegExp(`^(\\s+-\\s+)${AGENT_TOOL_NAME}\\(([^)]*)\\)\\s*$`);

interface DispatchRewrite {
  lines: string[];
  /** An `Agent(...)` entry was present — the file is a top-level coordinator. */
  found: boolean;
}

function rewriteDispatchEntry(frontmatterLines: string[]): DispatchRewrite {
  const toolsIndex = frontmatterLines.findIndex(line => line.trimEnd() === 'tools:');
  if (toolsIndex === -1) return { lines: frontmatterLines, found: false };

  const lines = [...frontmatterLines];
  const names: string[] = [];
  let lastEntry = toolsIndex;
  let found = false;

  for (let i = toolsIndex + 1; i < lines.length && LIST_ENTRY_RE.test(lines[i]); i++) {
    lastEntry = i;
    const match = DISPATCH_ENTRY_RE.exec(lines[i]);
    if (match === null) continue;
    found = true;
    names.push(...match[2].split(',').map(name => name.trim()).filter(name => name.length > 0));
    lines[i] = `${match[1]}${AGENT_TOOL_NAME}`;
  }

  if (names.length > 0) {
    lines.splice(lastEntry + 1, 0, `${SUBAGENTS_FRONTMATTER_FIELD}:`, ...names.map(name => `  - ${name}`));
  }
  return { lines, found };
}

/**
 * Adapt a Claude-style subagent file to Kimi Code's agent format.
 *
 *  1. `- Agent(a, b)` in the `tools:` list → `- Agent` plus a `subagents:` list right after the
 *     tools block (Kimi takes the allowed types from `subagents`, not from the tool entry).
 *  2. A file that had such an entry runs as the main agent (`kimi --agent …`), so
 *     `${base_prompt}` becomes the first line of the body — without it the body replaces
 *     Kimi's whole built-in system prompt.
 *  3. `claude --agent` → `kimi --agent` everywhere (description and body).
 *
 * Everything else — other fields, the body's illustrative `Agent(...)` lines — is left byte
 * for byte. Pure and idempotent; a file without frontmatter is returned unchanged. Only the
 * block-list form of `tools:` is handled (every shipped subagent uses it; a guard in
 * scripts/test-skills.sh forbids the inline form in `subagents/*.md`).
 */
export function toKimiAgentFile(content: string): string {
  const match = FRONTMATTER_RE.exec(content);
  if (match === null) return content;

  const frontmatter = match[0];
  const body = content.slice(frontmatter.length);
  const { lines, found } = rewriteDispatchEntry(frontmatter.split('\n'));

  let rewrittenBody = body;
  if (found && !body.trimStart().startsWith(KIMI_BASE_PROMPT_PLACEHOLDER)) {
    // Concatenation, never `.replace(..., '${base_prompt}')`: `$` is special in replacement strings.
    rewrittenBody = KIMI_BASE_PROMPT_PLACEHOLDER + '\n' + (body.startsWith('\n') ? '' : '\n') + body;
  }

  return (lines.join('\n') + rewrittenBody).split(CLAUDE_AGENT_LAUNCH).join(KIMI_AGENT_LAUNCH);
}
