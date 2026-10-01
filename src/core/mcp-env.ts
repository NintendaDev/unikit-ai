// --- MCP env references ---
//
// The catalog stores a secret header as a REFERENCE to an environment variable,
// `{{env:NAME}}`, never as a value: the settings files these writers produce are
// routinely committed. Every client spells the reference differently, so the
// translation lives here once and each writer picks its style.
//
// Which style belongs to which client is measured, not guessed: Claude Code and
// Qwen expand `${NAME}`, Cursor `${env:NAME}`, OpenCode `{env:NAME}`, Codex takes
// the variable NAME in dedicated fields, and Antigravity documents no syntax at
// all — it gets a `YOUR_NAME` placeholder the user replaces by hand.
//
// A wrong first write is permanent: reconciliation keeps an existing entry as it
// is ("present → keep"), so nothing downstream ever corrects the syntax.

import { AGENT_REGISTRY } from './agents.js';
import {
  AUTHORIZATION_HEADER, BEARER_PREFIX, GITHUB_TOKEN_LITERAL_PREFIXES, MCP_ENTRY_URL_FIELDS,
  MCP_ENV_PLACEHOLDER_PREFIX, MCP_ENV_TOKEN_PATTERN,
} from './constants.js';
import type { DiscoveredServers } from './mcp.js';
import { logWarn } from '../utils/log.js';

export type EnvRefStyle = 'dollar-brace' | 'env-colon' | 'opencode' | 'placeholder';

const ALL_STYLES: readonly EnvRefStyle[] = ['dollar-brace', 'env-colon', 'opencode', 'placeholder'];

/** A fresh global matcher per call: a shared `g` regex carries `lastIndex` between calls. */
function tokenMatcher(): RegExp {
  return new RegExp(MCP_ENV_TOKEN_PATTERN, 'g');
}

function renderName(name: string, style: EnvRefStyle): string {
  switch (style) {
    case 'dollar-brace': return `\${${name}}`;
    case 'env-colon': return `\${env:${name}}`;
    case 'opencode': return `{env:${name}}`;
    case 'placeholder': return `${MCP_ENV_PLACEHOLDER_PREFIX}${name}`;
  }
}

/** Replace every `{{env:NAME}}` in `value` with the client's own spelling; a string without one is returned as is. */
export function renderEnvRefs(value: string, style: EnvRefStyle): string {
  return value.replace(tokenMatcher(), (_match, name: string) => renderName(name, style));
}

export interface RenderedHeaders {
  headers: Record<string, unknown>;
  /** References replaced — not unique names. OpenCode sets `oauth: false` on it, writers log it. */
  count: number;
}

/** Render the references of every string header value; non-string values are copied untouched. */
export function renderHeaderEnvRefs(headers: Record<string, unknown>, style: EnvRefStyle): RenderedHeaders {
  const rendered: Record<string, unknown> = {};
  let count = 0;
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== 'string') {
      rendered[name] = value;
      continue;
    }
    count += value.match(tokenMatcher())?.length ?? 0;
    rendered[name] = renderEnvRefs(value, style);
  }
  return { headers: rendered, count };
}

export interface CodexHeaderSplit {
  staticHeaders: Record<string, unknown>;
  bearerTokenEnvVar?: string;
  envHttpHeaders: Record<string, string>;
  /** Header names whose value mixes text and a reference — Codex cannot express those. */
  dropped: string[];
}

/**
 * Codex takes a variable NAME, never a reference inside a string: `Authorization:
 * Bearer {{env:X}}` becomes `bearer_token_env_var = "X"`, a header whose whole
 * value is `{{env:X}}` becomes an `env_http_headers` entry, and anything else
 * carrying a reference cannot be written at all.
 */
export function splitCodexHeaderEnvRefs(headers: Record<string, unknown>): CodexHeaderSplit {
  const split: CodexHeaderSplit = { staticHeaders: {}, envHttpHeaders: {}, dropped: [] };
  const whole = new RegExp(`^${MCP_ENV_TOKEN_PATTERN}$`);
  const bearer = new RegExp(`^${BEARER_PREFIX}${MCP_ENV_TOKEN_PATTERN}$`);

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== 'string' || !new RegExp(MCP_ENV_TOKEN_PATTERN).test(value)) {
      split.staticHeaders[name] = value;
      continue;
    }
    const bearerMatch = name.toLowerCase() === AUTHORIZATION_HEADER ? value.match(bearer) : null;
    if (bearerMatch && split.bearerTokenEnvVar === undefined) {
      split.bearerTokenEnvVar = bearerMatch[1];
      continue;
    }
    const wholeMatch = value.match(whole);
    if (wholeMatch) {
      split.envHttpHeaders[name] = wholeMatch[1];
      continue;
    }
    split.dropped.push(name);
  }

  return split;
}

/** Every referenced variable name in a config tree, unique, in order of appearance. */
export function collectEnvVarNames(config: unknown): string[] {
  const names: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      for (const match of node.matchAll(tokenMatcher())) {
        if (!names.includes(match[1])) names.push(match[1]);
      }
    } else if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (node !== null && typeof node === 'object') {
      Object.values(node).forEach(visit);
    }
  };
  visit(config);
  return names;
}

/**
 * The `init` summary lines a user has to act on: which variables to set, and —
 * when Antigravity is installed — that its settings file carries a placeholder
 * which becomes a secret once filled in. Servers in the order they were chosen;
 * a server that references no variable contributes nothing.
 */
export function getMcpEnvLines(discoveredServers: DiscoveredServers, enabledFileIds: string[], agentIds: string[]): string[] {
  const antigravity = AGENT_REGISTRY.antigravity;
  const withAntigravity = agentIds.includes(antigravity.id) && antigravity.settingsFile !== null;
  const lines: string[] = [];

  for (const fileId of enabledFileIds) {
    const server = discoveredServers.get(fileId);
    if (!server) continue;

    const names = collectEnvVarNames([server.config, ...Object.values(server.configByPlatform ?? {})]);
    if (names.length === 0) continue;

    lines.push(`${server.displayName} — set ${names.join(', ')} in the environment your agent starts from`);
    if (withAntigravity) {
      const placeholders = names.map((name) => renderName(name, 'placeholder')).join(', ');
      lines.push(
        `${server.displayName} — ${antigravity.displayName}: ${antigravity.settingsFile} holds the placeholder `
        + `${placeholders}; replace it with the token and never commit that file`,
      );
    }
  }

  return lines;
}

/**
 * An existing settings entry UniKit keeps "as is" but did not write the way the
 * catalog asks: a literal GitHub token in it, a local server where the catalog
 * names a URL, or no reference to the catalog's variables in any client's form.
 */
function isEntryOffCatalog(entry: Record<string, unknown>, catalogConfig: Record<string, unknown>, names: string[]): boolean {
  const text = JSON.stringify(entry);
  if (GITHUB_TOKEN_LITERAL_PREFIXES.some((prefix) => text.includes(prefix))) return true;
  if (typeof catalogConfig['url'] === 'string' && !MCP_ENTRY_URL_FIELDS.some((field) => typeof entry[field] === 'string')) {
    return true;
  }
  // Codex keeps the bare NAME as a field value, every other client one of the rendered forms.
  return !names.every((name) => text.includes(`"${name}"`) || ALL_STYLES.some((style) => text.includes(renderName(name, style))));
}

/**
 * Warn — once per server and agent, never with the entry's value — when a kept
 * entry of a server that references environment variables does not match the
 * catalog. Antigravity is exempt: a filled-in placeholder is its documented state.
 */
export function warnOnKeptEnvEntry(
  agentId: string,
  key: string,
  entry: Record<string, unknown> | null,
  catalogConfig: Record<string, unknown>,
): void {
  if (entry === null || agentId === AGENT_REGISTRY.antigravity.id) return;
  const names = collectEnvVarNames(catalogConfig);
  if (names.length === 0 || !isEntryOffCatalog(entry, catalogConfig, names)) return;
  logWarn('mcp', `${agentId}: ${key} — the existing entry is kept as is and does not match the catalog; delete it and re-run init`);
}
