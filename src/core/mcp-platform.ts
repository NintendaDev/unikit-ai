// --- Platform-scoped MCP config resolution ---
//
// Picks the per-OS variant of an MCP server's config and expands the path tokens
// inside it. Kept out of `mcp.ts` for the same reason as `mcp-rules.ts`: that
// module already carries discovery, configuration, rule collection and
// frontmatter injection, and growing it further would repeat the monolith the
// 500-line guard prevents in `installer/` and `registry/`. The dependency runs
// one way — this module imports types from `mcp.ts`, never the reverse.

import os from 'os';
import path from 'path';
import { MCP_PLATFORM_KEYS, MCP_TOKEN_HOME, MCP_TOKEN_LOCALAPPDATA, type McpPlatformKey } from './constants.js';
import type { McpServerEntry } from './mcp.js';

function isMcpPlatformKey(value: string): value is McpPlatformKey {
  return (MCP_PLATFORM_KEYS as readonly string[]).includes(value);
}

/** `%LOCALAPPDATA%` with the conventional fallback for non-Windows hosts. */
function localAppData(): string {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
}

/**
 * Expand the supported path tokens in every string of a config tree.
 *
 * Walks objects and arrays recursively so a token works wherever the server
 * schema puts a path — `command`, an `args` element, an `env` value. Non-string
 * leaves pass through untouched. No existence check is performed on the result:
 * validating a binary the user has not installed yet is the MCP client's job,
 * and a warning here would fire on every `init` of a not-yet-set-up server.
 */
function expandTokens(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .split(MCP_TOKEN_HOME).join(os.homedir())
      .split(MCP_TOKEN_LOCALAPPDATA).join(localAppData());
  }

  if (Array.isArray(value)) {
    return value.map(expandTokens);
  }

  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = expandTokens(v);
    }

    return out;
  }

  return value;
}

/**
 * Resolve the config a writer should persist for one server on this host.
 *
 * `configByPlatform` wins when it carries an entry for the current platform;
 * otherwise the plain `config` is used. An unknown platform therefore degrades
 * to `config` rather than failing — and a server that has neither (a
 * platform-only entry running on a platform it does not support) returns `null`
 * so the caller can skip it, per the null-safe-by-convention rule.
 *
 * @param platform `process.platform` of the host; injected so the guard tests
 *                 can exercise all three branches from one OS.
 */
export function resolvePlatformConfig(
  server: McpServerEntry,
  platform: string = process.platform,
): Record<string, unknown> | null {
  const byPlatform = server.configByPlatform;
  const selected = byPlatform && isMcpPlatformKey(platform) ? byPlatform[platform] : undefined;
  const resolved = selected ?? server.config;

  if (!resolved) return null;

  return expandTokens(resolved) as Record<string, unknown>;
}
