import path from 'path';
import { readJsonFile, readTextFile, writeTextFile, getMcpDir, ensureDir, fileExists, listFiles } from '../utils/fs.js';
import { getAgentConfig } from './agents.js';
import { type McpPlatformKey } from './constants.js';
import { getEngineConfig } from './engines.js';
import { resolvePlatformConfig } from './mcp-platform.js';
import { isRecord, parseMcpServerEntry } from './mcp-schema.js';
import { getMcpWriter } from './mcp-writers/index.js';
import { logWarn } from '../utils/log.js';

export interface McpAllowedTools {
  agents: Record<string, string[]>;
  skills: Record<string, string[]>;
}

export interface McpServerEntry {
  key: string;
  isEngine: boolean;
  displayName: string;
  /**
   * The platform-independent server config. Optional because a server may ship
   * `configByPlatform` instead (an absolute binary path that differs per OS);
   * exactly one of the two must be present — `scanMcpDirectory` drops entries
   * carrying neither.
   */
  config?: Record<string, unknown>;
  /**
   * Per-OS config variants, keyed by `process.platform`. Resolved by
   * `resolvePlatformConfig` (see `mcp-platform.ts`), which falls back to
   * {@link config} on a platform this map does not cover.
   */
  configByPlatform?: Partial<Record<McpPlatformKey, Record<string, unknown>>>;
  allowedTools?: McpAllowedTools;
  /**
   * Provenance stamp of the last manual audit of this entry's tool names. MCP
   * versions are deliberately not pinned, so a server can rename or drop a tool
   * and silently invalidate `allowed-tools`; the stamp records which version was
   * read, when, and from which registry file, and is printed by `init`.
   */
  verified?: { version: string; date: string; toolRegistry: string };
  /**
   * Presentation order inside a `key` group (ascending, 1-based). Drives the
   * wizard's radio pre-selection — and nothing else since the shard corpus was
   * retired: one engine takes one engine server, so there is no longer any
   * content to concatenate in a defined order. Missing = last. Never affects the
   * order servers are written into a settings file.
   */
  order?: number;
  /**
   * Where this server documents itself: `context7` is a Context7 library id,
   * `repo` the upstream repository URL. Both optional. `repo` is what the `init`
   * summary generates its install line from — the field replaced the
   * hand-written `instruction` prose, which restated vendor documentation and
   * went stale claim by claim.
   */
  docs?: { context7?: string; repo?: string };
  /**
   * Absolute path to this server's rules tree (`INDEX.md` and whatever else it
   * grew) — the exceptions this server imposes, never a list of what it can do.
   * The JSON stores the path relative to the config's own directory; it is
   * resolved here so consumers never need to know which `mcp/<engine>/` dir the
   * entry came from. Absent = no known exceptions, which degrades nothing.
   */
  rulesDir?: string;
}

export type DiscoveredServers = Map<string, McpServerEntry>;

async function scanMcpDirectory(dirPath: string): Promise<Map<string, McpServerEntry>> {
  const servers = new Map<string, McpServerEntry>();
  const files = await listFiles(dirPath);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const raw = await readJsonFile<Record<string, unknown>>(path.join(dirPath, file));
    const entry = parseMcpServerEntry(raw, dirPath, file);
    if (!entry) continue;

    servers.set(file.replace(/\.json$/, ''), entry);
  }

  return servers;
}

export async function discoverMcpServers(engineId: string): Promise<DiscoveredServers> {
  const mcpDir = getMcpDir();
  const merged: DiscoveredServers = new Map();

  // Scan universal servers
  const universalDir = path.join(mcpDir, 'universal');
  const universalServers = await scanMcpDirectory(universalDir);
  for (const [fileId, entry] of universalServers) {
    merged.set(fileId, entry);
  }

  // Scan engine-specific servers (override universal on fileId collision)
  const engineMcpDir = getEngineConfig(engineId).mcpDir;
  const engineDir = path.join(mcpDir, engineMcpDir);
  const engineServers = await scanMcpDirectory(engineDir);
  for (const [fileId, entry] of engineServers) {
    if (merged.has(fileId)) {
      console.log(`MCP: engine server "${fileId}" overrides universal server with same filename`);
    }
    merged.set(fileId, entry);
  }

  // Validate: at least one engine MCP
  const engineMcps = getEngineMcpServers(merged);
  if (engineMcps.length === 0) {
    throw new Error(`MCP: engine "${engineId}" has no MCP server with is_engine=true`);
  }

  // Validate: all is_engine=true entries must share the same key
  const engineKeys = new Set(engineMcps.map(m => m.key));
  if (engineKeys.size > 1) {
    throw new Error(`MCP: engine "${engineId}" has is_engine=true entries with different keys: ${[...engineKeys].join(', ')}`);
  }

  return merged;
}

export function getEngineMcpServers(discoveredServers: DiscoveredServers): McpServerEntry[] {
  const result: McpServerEntry[] = [];
  for (const entry of discoveredServers.values()) {
    if (entry.isEngine) {
      result.push(entry);
    }
  }

  return result;
}

export async function configureMcp(
  projectDir: string,
  discoveredServers: DiscoveredServers,
  enabledFileIds: string[],
  agentId: string = 'claude',
): Promise<string[]> {
  const agent = getAgentConfig(agentId);

  if (!agent.supportsMcp || !agent.settingsFile) {
    return [];
  }

  const writer = getMcpWriter(agentId);
  const configuredFileIds: string[] = [];
  const settingsPath = path.join(projectDir, agent.settingsFile);
  const settingsDir = path.dirname(settingsPath);

  await ensureDir(settingsDir);

  const settings = await writer.readExisting(settingsPath);

  for (const fileId of enabledFileIds) {
    const server = discoveredServers.get(fileId);
    if (!server) continue;

    const resolvedConfig = resolvePlatformConfig(server);
    if (!resolvedConfig) {
      logWarn(
        'configureMcp',
        `server ${server.key}: no config for platform ${process.platform} and no fallback config, skipping`,
      );
      continue;
    }

    writer.upsert(settings, server.key, resolvedConfig);
    configuredFileIds.push(fileId);
  }

  if (configuredFileIds.length > 0) {
    await writeTextFile(settingsPath, writer.serialize(settings));
    console.log(`[mcp] ${agentId} -> ${settingsPath} (${configuredFileIds.length} servers)`);
  }

  return configuredFileIds;
}

export function collectMcpRules(
  discoveredServers: DiscoveredServers,
  enabledFileIds: string[],
): McpAllowedTools {
  const merged: McpAllowedTools = { agents: {}, skills: {} };
  const enabled = new Set(enabledFileIds);

  for (const [fileId, server] of discoveredServers) {
    if (!enabled.has(fileId) || !server.allowedTools) continue;

    const prefix = `mcp__${server.key}__`;

    for (const [agentName, tools] of Object.entries(server.allowedTools.agents ?? {})) {
      if (!merged.agents[agentName]) merged.agents[agentName] = [];
      const prefixed = tools.map(t => `${prefix}${t}`);
      merged.agents[agentName].push(...prefixed);
    }

    for (const [skillName, tools] of Object.entries(server.allowedTools.skills ?? {})) {
      if (!merged.skills[skillName]) merged.skills[skillName] = [];
      const prefixed = tools.map(t => `${prefix}${t}`);
      merged.skills[skillName].push(...prefixed);
    }
  }

  return merged;
}

export async function injectToolsIntoSkillFrontmatter(filePath: string, tools: string[]): Promise<boolean> {
  const content = await readTextFile(filePath);
  if (!content) return false;

  const lines = content.split('\n');

  // Find frontmatter boundaries
  let fmStart = -1;
  let fmEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (fmStart === -1) fmStart = i;
      else { fmEnd = i; break; }
    }
  }
  if (fmStart === -1 || fmEnd === -1) return false;

  // Find allowed-tools: section
  let fieldLine = -1;
  for (let i = fmStart + 1; i < fmEnd; i++) {
    if (lines[i].startsWith('allowed-tools:')) {
      fieldLine = i;
      break;
    }
  }
  if (fieldLine === -1) return false;

  // Collect existing entries
  const existing = new Set<string>();
  let lastEntryLine = fieldLine;
  for (let i = fieldLine + 1; i < fmEnd; i++) {
    const match = lines[i].match(/^\s+-\s+(.+)$/);
    if (match) {
      existing.add(match[1].trim());
      lastEntryLine = i;
    } else {
      break;
    }
  }

  // Filter to only new tools
  const newTools = tools.filter(t => !existing.has(t));
  if (newTools.length === 0) {
    return false;
  }

  // Insert new entries after the last existing entry
  const newLines = newTools.map(t => `  - ${t}`);
  lines.splice(lastEntryLine + 1, 0, ...newLines);

  await writeTextFile(filePath, lines.join('\n'));

  return true;
}

export async function injectToolsIntoAgentFrontmatter(filePath: string, tools: string[]): Promise<boolean> {
  const content = await readTextFile(filePath);
  if (!content) return false;

  const lines = content.split('\n');

  // Find frontmatter boundaries
  let fmStart = -1;
  let fmEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (fmStart === -1) fmStart = i;
      else { fmEnd = i; break; }
    }
  }
  if (fmStart === -1 || fmEnd === -1) return false;

  // Find tools: section
  let fieldLine = -1;
  for (let i = fmStart + 1; i < fmEnd; i++) {
    if (lines[i].startsWith('tools:')) {
      fieldLine = i;
      break;
    }
  }
  if (fieldLine === -1) return false;

  // Collect existing entries
  const existing = new Set<string>();
  let lastEntryLine = fieldLine;
  for (let i = fieldLine + 1; i < fmEnd; i++) {
    const match = lines[i].match(/^\s+-\s+(.+)$/);
    if (match) {
      existing.add(match[1].trim());
      lastEntryLine = i;
    } else {
      break;
    }
  }

  // Filter to only new tools
  const newTools = tools.filter(t => !existing.has(t));
  if (newTools.length === 0) {
    return false;
  }

  // Insert new entries after the last existing entry
  const newLines = newTools.map(t => `  - ${t}`);
  lines.splice(lastEntryLine + 1, 0, ...newLines);

  await writeTextFile(filePath, lines.join('\n'));

  return true;
}

// --- Extension MCP ---

export function validateMcpTemplate(template: unknown, key: string): string | null {
  if (!isRecord(template)) {
    return `MCP template for key "${key}" must be a JSON object`;
  }

  if (!template['command'] && !template['url']) {
    return `MCP template for key "${key}" must have "command" or "url" field`;
  }

  return null;
}

export async function configureExtensionMcpServers(
  projectDir: string,
  agentId: string,
  servers: Array<{ key: string; config: Record<string, unknown> }>,
): Promise<string[]> {
  const agent = getAgentConfig(agentId);

  if (!agent.supportsMcp || !agent.settingsFile) {
    return [];
  }

  const writer = getMcpWriter(agentId);
  const settingsPath = path.join(projectDir, agent.settingsFile);
  const settingsDir = path.dirname(settingsPath);
  await ensureDir(settingsDir);

  const settings = await writer.readExisting(settingsPath);
  const configured: string[] = [];

  for (const server of servers) {
    writer.upsert(settings, server.key, server.config);
    configured.push(server.key);
  }

  if (configured.length > 0) {
    await writeTextFile(settingsPath, writer.serialize(settings));
  }

  return configured;
}

export async function removeExtensionMcpServers(
  projectDir: string,
  agentId: string,
  keys: string[],
): Promise<string[]> {
  const agent = getAgentConfig(agentId);

  if (!agent.supportsMcp || !agent.settingsFile) {
    return [];
  }

  const settingsPath = path.join(projectDir, agent.settingsFile);
  if (!(await fileExists(settingsPath))) {
    return [];
  }

  const writer = getMcpWriter(agentId);
  const settings = await writer.readExisting(settingsPath);
  const removed: string[] = [];

  for (const key of keys) {
    if (writer.remove(settings, key)) {
      removed.push(key);
    }
  }

  if (removed.length > 0) {
    await writeTextFile(settingsPath, writer.serialize(settings));
  }

  return removed;
}

/**
 * One human-readable audit line per selected server that carries a `verified`
 * stamp — the counterpart of {@link getMcpInstructions}. Servers without a stamp
 * contribute nothing (no "unverified" noise). Lives here rather than in `init.ts`
 * so the CLI layer never has to know the shape of {@link McpServerEntry}.
 */
export function getMcpVerifiedStamps(discoveredServers: DiscoveredServers, enabledFileIds: string[]): string[] {
  const selected = new Set(enabledFileIds);
  const stamps: string[] = [];

  for (const [fileId, server] of discoveredServers) {
    if (!selected.has(fileId) || !server.verified) continue;
    stamps.push(`${server.displayName}: verified v${server.verified.version} (${server.verified.date})`);
  }

  return stamps;
}

/**
 * One install line per selected server, generated from {@link McpServerEntry.docs}.
 *
 * Replaces the retired per-server `instruction` prose. The template is fixed and
 * the only variable part is a URL, so there is nothing here that can quietly go
 * stale: a dead repository answers 404 loudly, where prose walks the user
 * through outdated steps in silence. A server without `docs.repo` contributes
 * nothing — deliberate for a server that needs no setup at all.
 */
export function getMcpDocsLines(discoveredServers: DiscoveredServers, enabledFileIds: string[]): string[] {
  const selected = new Set(enabledFileIds);
  const lines: string[] = [];

  for (const [fileId, server] of discoveredServers) {
    if (!selected.has(fileId) || !server.docs?.repo) continue;
    lines.push(`${server.displayName} — setup and requirements: ${server.docs.repo}`);
  }

  return lines;
}
