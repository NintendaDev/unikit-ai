// --- MCP JSON schema parsing ---
//
// Turns one raw `mcp/<engine>/<name>.json` object into a typed `McpServerEntry`.
// Split out of `mcp.ts` for the same reason as `mcp-shards.ts` and
// `mcp-platform.ts`: that module carries discovery, configuration, rule
// collection and frontmatter injection, and the schema kept growing a field per
// task. The dependency runs one way — this module imports types from `mcp.ts`,
// never the reverse.
//
// House rule for every optional field: an unparseable value is dropped
// silently, never thrown. A typo in one key is a data defect in one server, not
// a reason to abort the scan of the whole directory.

import path from 'path';
import {
  ENGINE_MCP_SHARDS,
  MCP_PLATFORM_KEYS,
  type EngineMcpShard,
  type McpPlatformKey,
} from './constants.js';
import type { McpAllowedTools, McpServerEntry } from './mcp.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the optional `shards` key of an MCP JSON into absolute paths.
 * Keys outside {@link ENGINE_MCP_SHARDS} and non-string values are dropped.
 * Returns `null` when the entry contributes nothing.
 */
function parseShards(raw: unknown, dirPath: string): Partial<Record<EngineMcpShard, string>> | null {
  if (!isRecord(raw)) return null;

  const resolved: Partial<Record<EngineMcpShard, string>> = {};
  let found = false;

  for (const shard of ENGINE_MCP_SHARDS) {
    const value = raw[shard];
    if (typeof value !== 'string' || value.length === 0) continue;
    resolved[shard] = path.resolve(dirPath, value);
    found = true;
  }

  return found ? resolved : null;
}

/**
 * Read the optional `configByPlatform` key into a typed map. Platforms outside
 * {@link MCP_PLATFORM_KEYS} and non-object values are dropped.
 */
function parseConfigByPlatform(raw: unknown): Partial<Record<McpPlatformKey, Record<string, unknown>>> | null {
  if (!isRecord(raw)) return null;

  const resolved: Partial<Record<McpPlatformKey, Record<string, unknown>>> = {};
  let found = false;

  for (const platform of MCP_PLATFORM_KEYS) {
    const value = raw[platform];
    if (!isRecord(value)) continue;
    resolved[platform] = value;
    found = true;
  }

  return found ? resolved : null;
}

/**
 * Read the optional `verified` audit stamp. All three fields are required — a
 * partial stamp is worse than none, since `init` would print it as if the audit
 * were complete.
 */
function parseVerified(raw: unknown): McpServerEntry['verified'] | null {
  if (!isRecord(raw)) return null;

  const { version, date, toolRegistry } = raw;
  if (typeof version !== 'string' || typeof date !== 'string' || typeof toolRegistry !== 'string') {
    return null;
  }

  return { version, date, toolRegistry };
}

/**
 * Parse one MCP JSON object into an entry.
 *
 * @param raw     the parsed JSON object.
 * @param dirPath directory the JSON was read from — `shards` pointers are
 *                relative to it and are resolved to absolute paths here so no
 *                consumer needs to know which `mcp/<engine>/` dir it came from.
 * @returns `null` when the object cannot describe a usable server: no `key`, no
 *          `displayName`, or neither `config` nor `configByPlatform`. That last
 *          disjunction matters — a server whose binary path differs per OS ships
 *          only `configByPlatform`, and demanding `config` would drop it before
 *          it ever reached the wizard.
 */
export function parseMcpServerEntry(raw: unknown, dirPath: string): McpServerEntry | null {
  if (!isRecord(raw) || !raw.key || !raw.displayName) return null;

  const configByPlatform = parseConfigByPlatform(raw['configByPlatform']);
  if (!raw.config && !configByPlatform) return null;

  const entry: McpServerEntry = {
    key: raw.key as string,
    isEngine: (raw['is_engine'] as boolean) ?? false,
    displayName: raw.displayName as string,
    instruction: (raw.instruction as string) ?? '',
  };

  if (raw.config) {
    entry.config = raw.config as Record<string, unknown>;
  }

  if (configByPlatform) {
    entry.configByPlatform = configByPlatform;
  }

  const verified = parseVerified(raw['verified']);
  if (verified) {
    entry.verified = verified;
  }

  const allowedTools = raw['allowed-tools'] as McpAllowedTools | undefined;
  if (allowedTools) {
    entry.allowedTools = allowedTools;
  }

  if (typeof raw['order'] === 'number') {
    entry.order = raw['order'];
  }

  const shards = parseShards(raw['shards'], dirPath);
  if (shards) {
    entry.shards = shards;
  }

  return entry;
}
