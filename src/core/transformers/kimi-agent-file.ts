import { AGENT_REGISTRY } from '../agents.js';
import {
  AGENT_TOOL_NAME, CLAUDE_AGENT_LAUNCH, KIMI_AGENT_LAUNCH,
  KIMI_BASE_PROMPT_PLACEHOLDER, KIMI_SKILLS_PREAMBLE, SKILL_FILE,
  SUBAGENT_SKILLS_FIELD, SUBAGENTS_FRONTMATTER_FIELD,
} from '../constants.js';

// The frontmatter shape agent-filter.ts recognises (LF; the repository's working tree is LF).
const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/;
// A list entry under `tools:` — the shape mcp.ts walks when it injects MCP grants.
const LIST_ENTRY_RE = /^\s+-\s+/;
const DISPATCH_ENTRY_RE = new RegExp(`^(\\s+-\\s+)${AGENT_TOOL_NAME}\\(([^)]*)\\)\\s*$`);
// The top-level `skills:` key and what follows it on the same line (empty for the block form).
const SKILLS_FIELD_RE = new RegExp(`^${SUBAGENT_SKILLS_FIELD}:\\s*(.*?)\\s*$`);
const INLINE_LIST_RE = /^\[(.*)\]$/;
const SURROUNDING_QUOTES_RE = /^['"]|['"]$/g;
const LEADING_NEWLINES_RE = /^\n+/;
const TRAILING_SLASHES_RE = /\/+$/;

interface DispatchRewrite {
  lines: string[];
  /** An `Agent(...)` entry was present — the file is a top-level coordinator. */
  found: boolean;
}

interface SkillsExtraction {
  lines: string[];
  /** A `skills:` field in the block or the inline form was present (and has been removed from `lines`). */
  found: boolean;
  names: string[];
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

function cleanSkillName(raw: string): string {
  return raw.trim().replace(SURROUNDING_QUOTES_RE, '').trim();
}

/**
 * Take the `skills:` field out of the frontmatter lines and return the names it listed. The block
 * form (`skills:` + `  - name` entries) and the inline form (`skills: [a, b]`) are recognised; any
 * other shape (a bare scalar) is not ours to interpret and the lines come back untouched.
 */
function extractSkillsField(frontmatterLines: string[]): SkillsExtraction {
  for (let i = 0; i < frontmatterLines.length; i++) {
    const match = SKILLS_FIELD_RE.exec(frontmatterLines[i]);
    if (match === null) continue;

    const value = match[1];
    const inline = INLINE_LIST_RE.exec(value);
    if (inline !== null) {
      const lines = [...frontmatterLines.slice(0, i), ...frontmatterLines.slice(i + 1)];
      return { lines, found: true, names: inline[1].split(',').map(cleanSkillName).filter(name => name.length > 0) };
    }
    if (value !== '') return { lines: frontmatterLines, found: false, names: [] };

    let end = i + 1;
    const names: string[] = [];
    while (end < frontmatterLines.length && LIST_ENTRY_RE.test(frontmatterLines[end])) {
      names.push(cleanSkillName(frontmatterLines[end].replace(LIST_ENTRY_RE, '')));
      end++;
    }
    const lines = [...frontmatterLines.slice(0, i), ...frontmatterLines.slice(end)];
    return { lines, found: true, names: names.filter(name => name.length > 0) };
  }
  return { lines: frontmatterLines, found: false, names: [] };
}

/**
 * Put the read list at the top of the body. A body that opens with the built-in prompt
 * placeholder keeps it as its first line and the list follows right after; otherwise the list is
 * the first thing in the body. The placement is decided by the body's state, not by whether this
 * pass wrote the placeholder, so a second pass over a coordinator never puts the list ahead of it.
 */
function insertSkillList(body: string, skillPaths: string[]): string {
  const block = `${KIMI_SKILLS_PREAMBLE}\n\n${skillPaths.map(skillPath => `- ${skillPath}`).join('\n')}\n`;
  const placeholderAt = body.indexOf(KIMI_BASE_PROMPT_PLACEHOLDER);
  const opensWithPlaceholder = placeholderAt !== -1 && body.slice(0, placeholderAt).trim() === '';

  let head = '';
  let rest = body;
  if (opensWithPlaceholder) {
    const lineEnd = body.indexOf('\n', placeholderAt);
    head = lineEnd === -1 ? body : body.slice(0, lineEnd);
    rest = lineEnd === -1 ? '' : body.slice(lineEnd);
  }
  rest = rest.replace(LEADING_NEWLINES_RE, '');

  const opening = opensWithPlaceholder ? `${head}\n\n` : '\n';
  return opening + block + (rest === '' ? '' : `\n${rest}`);
}

/**
 * Adapt a Claude-style subagent file to Kimi Code's agent format.
 *
 *  1. `- Agent(a, b)` in the `tools:` list → `- Agent` plus a `subagents:` list right after the
 *     tools block (Kimi takes the allowed types from `subagents`, not from the tool entry).
 *  2. A file that had such an entry runs as the main agent (`kimi --agent …`), so
 *     `${base_prompt}` becomes the first line of the body — without it the body replaces
 *     Kimi's whole built-in system prompt.
 *  3. `skills:` (Claude Code preloads these; Kimi Code does not read the field) is removed and
 *     becomes a list of `<skillsDir>/<name>/SKILL.md` paths at the top of the body, behind the
 *     placeholder when there is one, under an intro line telling the agent to read them.
 *  4. `claude --agent` → `kimi --agent` everywhere (description and body).
 *
 * Everything else — other fields, the body's illustrative `Agent(...)` lines — is left byte
 * for byte. Pure and idempotent (a second pass finds no `skills:` field and no `Agent(...)`
 * entry); a file without frontmatter is returned unchanged. Only the block-list form of
 * `tools:` is handled (every shipped subagent uses it; a guard in scripts/test-skills.sh
 * forbids the inline form in `subagents/*.md`).
 *
 * `onSkills` is called once when a `skills:` field was found, with the paths written — an empty
 * array when the field named no skills, in which case no list is written. The adapter itself
 * stays free of logging; the caller decides what to say about it.
 */
export function toKimiAgentFile(
  content: string,
  skillsDir: string = AGENT_REGISTRY.kimi.skillsDir,
  onSkills?: (skillPaths: readonly string[]) => void,
): string {
  const match = FRONTMATTER_RE.exec(content);
  if (match === null) return content;

  const frontmatter = match[0];
  const body = content.slice(frontmatter.length);
  const dispatch = rewriteDispatchEntry(frontmatter.split('\n'));
  const skills = extractSkillsField(dispatch.lines);

  let rewrittenBody = body;
  if (dispatch.found && !body.trimStart().startsWith(KIMI_BASE_PROMPT_PLACEHOLDER)) {
    // Concatenation, never `.replace(..., '${base_prompt}')`: `$` is special in replacement strings.
    rewrittenBody = KIMI_BASE_PROMPT_PLACEHOLDER + '\n' + (body.startsWith('\n') ? '' : '\n') + body;
  }

  if (skills.found) {
    const root = skillsDir.replace(TRAILING_SLASHES_RE, '');
    const skillPaths = skills.names.map(name => `${root}/${name}/${SKILL_FILE}`);
    if (skillPaths.length > 0) rewrittenBody = insertSkillList(rewrittenBody, skillPaths);
    onSkills?.(skillPaths);
  }

  return (skills.lines.join('\n') + rewrittenBody).split(CLAUDE_AGENT_LAUNCH).join(KIMI_AGENT_LAUNCH);
}
