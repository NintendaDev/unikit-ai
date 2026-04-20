import { readTextFile } from '../utils/fs.js';
import { AGENT_REGISTRY } from './agents.js';
import { logInfo } from '../utils/log.js';

// Markdown preprocessor that keeps or drops blocks guarded by
// <!-- unikit:agents ... --> / <!-- unikit:end --> markers based on the
// target agent id. Scope is intentionally limited to markdown body —
// YAML frontmatter is split off and passed through unchanged.

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/;
const START_STANDALONE_RE = /^\s*<!-- unikit:agents ([^>]+) -->\s*$/;
const END_STANDALONE_RE = /^\s*<!-- unikit:end -->\s*$/;
const START_FRAGMENT = '<!-- unikit:agents ';
const END_FRAGMENT = '<!-- unikit:end -->';

interface BlockDecision {
  names: string[];
  exclude: boolean;
}

function knownAgentIds(): string {
  return Object.keys(AGENT_REGISTRY).join(', ');
}

function parseMarkerTokens(raw: string): BlockDecision {
  const tokens = raw
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (tokens.length === 0) {
    throw new Error(`Empty agent list in <!-- unikit:agents ${raw.trim()} -->`);
  }

  const excludes = tokens.filter(t => t.startsWith('!'));
  const includes = tokens.filter(t => !t.startsWith('!'));

  if (excludes.length > 0 && includes.length > 0) {
    throw new Error(`Mixed include/exclude in <!-- unikit:agents ${raw.trim()} -->`);
  }

  const names = tokens.map(t => (t.startsWith('!') ? t.slice(1) : t));
  for (const name of names) {
    if (!(name in AGENT_REGISTRY)) {
      throw new Error(
        `Unknown agent "${name}" in <!-- unikit:agents ${raw.trim()} --> ` +
        `(known: ${knownAgentIds()})`,
      );
    }
  }

  return { names, exclude: excludes.length > 0 };
}

function shouldKeep(decision: BlockDecision, agentId: string): boolean {
  const listed = decision.names.includes(agentId);
  return decision.exclude ? !listed : listed;
}

export function applyAgentFilter(content: string, agentId: string): string {
  if (!(agentId in AGENT_REGISTRY)) {
    throw new Error(
      `Unknown agent "${agentId}" passed to applyAgentFilter ` +
      `(known: ${knownAgentIds()})`,
    );
  }

  const fmMatch = content.match(FRONTMATTER_RE);
  const frontmatter = fmMatch ? fmMatch[0] : '';
  const body = content.slice(frontmatter.length);

  // Fast path: no markers in body — return content untouched.
  if (!body.includes(START_FRAGMENT) && !body.includes(END_FRAGMENT)) {
    return content;
  }

  const lines = body.split('\n');
  const out: string[] = [];
  let cutBlocks = 0;
  let cutLines = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    assertStandalone(line, i);

    const endMatch = line.match(END_STANDALONE_RE);
    if (endMatch) {
      throw new Error(`Unmatched <!-- unikit:end --> at line ${i + 1} (no open block)`);
    }

    const startMatch = line.match(START_STANDALONE_RE);
    if (!startMatch) {
      out.push(line);
      i++;
      continue;
    }

    const startIdx = i;
    const decision = parseMarkerTokens(startMatch[1]);
    const endIdx = findMatchingEnd(lines, startIdx);

    if (shouldKeep(decision, agentId)) {
      for (let k = startIdx + 1; k < endIdx; k++) {
        out.push(lines[k]);
      }
    } else {
      cutBlocks++;
      cutLines += endIdx - startIdx + 1;
    }

    i = endIdx + 1;
  }

  let processedBody = out.join('\n');
  if (cutBlocks > 0) {
    processedBody = processedBody.replace(/\n{3,}/g, '\n\n');
    logInfo('agent-filter', `${agentId}: cut ${cutBlocks} block(s), ${cutLines} line(s)`);
  }

  return frontmatter + processedBody;
}

function assertStandalone(line: string, idx: number): void {
  const hasStart = line.includes(START_FRAGMENT);
  const hasEnd = line.includes(END_FRAGMENT);
  if (hasStart && !START_STANDALONE_RE.test(line)) {
    throw new Error(
      `Inline <!-- unikit:agents --> marker at line ${idx + 1}: ${JSON.stringify(line)} ` +
      `(markers must occupy the whole line)`,
    );
  }
  if (hasEnd && !END_STANDALONE_RE.test(line)) {
    throw new Error(
      `Inline <!-- unikit:end --> marker at line ${idx + 1}: ${JSON.stringify(line)} ` +
      `(markers must occupy the whole line)`,
    );
  }
}

function findMatchingEnd(lines: string[], startIdx: number): number {
  for (let j = startIdx + 1; j < lines.length; j++) {
    assertStandalone(lines[j], j);
    if (START_STANDALONE_RE.test(lines[j])) {
      throw new Error(
        `Nested <!-- unikit:agents --> block at line ${j + 1} ` +
        `(outer block opened at line ${startIdx + 1}) — nesting is not allowed`,
      );
    }
    if (END_STANDALONE_RE.test(lines[j])) {
      return j;
    }
  }
  throw new Error(`Unclosed <!-- unikit:agents --> block opened at line ${startIdx + 1}`);
}

export async function readSourceForAgent(absPath: string, agentId: string): Promise<string | null> {
  const raw = await readTextFile(absPath);
  if (raw === null) return null;
  try {
    return applyAgentFilter(raw, agentId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`agent-filter failed for ${absPath}: ${msg}`);
  }
}
