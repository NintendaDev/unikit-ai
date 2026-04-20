import path from 'path';
import { createRequire } from 'module';
import { readJsonFile, writeJsonFile, fileExists } from '../utils/fs.js';
import { getAgentConfig } from './agents.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

export interface McpConfig {
  servers: string[];
}

export interface ManagedSkillState {
  sourceHash: string;
  installedHash: string;
}

export interface AgentInstallation {
  id: string;
  skillsDir: string;
  subagentsDir: string;
  installedSkills: string[];
  installedSubagents: string[];
  managedSkills?: Record<string, ManagedSkillState>;
  managedSubagents?: Record<string, ManagedSkillState>;
}

export interface ExtensionRecord {
  name: string;
  source: string;
  version: string;
  replacedSkills?: Record<string, string>;
}

export type RuleSource = 'registry' | 'installer' | 'local';
export type RuleOrigin = 'primary' | 'official' | 'bundled';

export interface InstalledRuleEntry {
  name: string;
  source: RuleSource;
  origin?: RuleOrigin;
  version?: string;
  installed_hash?: string;
}

export interface RulesInstallation {
  version: string;
  core: InstalledRuleEntry[];
  stack: InstalledRuleEntry[];
}

export interface UniKitConfig {
  version: string;
  engine: string;
  engineMcpKey: string | null;
  rulesRegistry: string | null;
  mcp: McpConfig;
  agents: AgentInstallation[];
  extensions?: ExtensionRecord[];
  rules: {
    installed: RulesInstallation;
  };
}

const CONFIG_FILENAME = '.unikit.json';
const CURRENT_VERSION: string = pkg.version;

function getConfigPath(projectDir: string): string {
  return path.join(projectDir, CONFIG_FILENAME);
}

function normalizeManagedSkills(raw: unknown): Record<string, ManagedSkillState> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const result: Record<string, ManagedSkillState> = {};

  for (const [skillName, state] of Object.entries(raw as Record<string, unknown>)) {
    if (!skillName || typeof state !== 'object' || !state) {
      continue;
    }

    const sourceHash = (state as { sourceHash?: unknown }).sourceHash;
    const installedHash = (state as { installedHash?: unknown }).installedHash;

    if (typeof sourceHash === 'string' && sourceHash.length > 0 && typeof installedHash === 'string' && installedHash.length > 0) {
      result[skillName] = { sourceHash, installedHash };
    }
  }

  return result;
}

function normalizeMcp(raw: unknown): McpConfig {
  if (!raw || typeof raw !== 'object') {
    return { servers: [] };
  }

  const mcp = raw as Record<string, unknown>;
  if (Array.isArray(mcp.servers)) {
    return { servers: mcp.servers.filter((s): s is string => typeof s === 'string') };
  }

  return { servers: [] };
}

function normalizeRuleEntries(raw: unknown): InstalledRuleEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item): InstalledRuleEntry => {
    // Legacy format: plain string → convert to InstalledRuleEntry with source "installer"
    if (typeof item === 'string') {
      return { name: item, source: 'installer' };
    }

    // New format: object with name + source
    if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).name === 'string') {
      const entry = item as Record<string, unknown>;
      return {
        name: entry.name as string,
        source: (entry.source as RuleSource) ?? 'installer',
        origin: entry.origin as RuleOrigin | undefined,
        version: entry.version as string | undefined,
        installed_hash: entry.installed_hash as string | undefined,
      };
    }

    return { name: String(item), source: 'installer' };
  });
}

function normalizeRulesInstallation(raw: unknown): RulesInstallation {
  if (!raw || typeof raw !== 'object') {
    return { version: CURRENT_VERSION, core: [], stack: [] };
  }

  const inst = raw as Record<string, unknown>;
  return {
    version: (inst.version as string) ?? CURRENT_VERSION,
    core: normalizeRuleEntries(inst.core),
    stack: normalizeRuleEntries(inst.stack),
  };
}

function normalizeExtensions(raw: unknown): ExtensionRecord[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((ext): ext is ExtensionRecord => {
    if (!ext || typeof ext !== 'object') return false;
    const e = ext as Record<string, unknown>;

    return typeof e.name === 'string' && typeof e.source === 'string' && typeof e.version === 'string';
  });
}

export async function loadConfig(projectDir: string): Promise<UniKitConfig | null> {
  const configPath = getConfigPath(projectDir);
  const raw = await readJsonFile<Record<string, unknown>>(configPath);
  if (!raw) {
    return null;
  }

  const rawAgents = Array.isArray(raw.agents) ? raw.agents : [];
  const normalizedAgents = rawAgents.map((agent: Record<string, unknown>) => {
    const agentConfig = getAgentConfig(agent.id as string);

    return {
      id: agent.id as string,
      skillsDir: (agent.skillsDir as string) || agentConfig.skillsDir,
      subagentsDir: (agent.subagentsDir as string) || (agent.agentsDir as string) || agentConfig.subagentsDir,
      installedSkills: Array.isArray(agent.installedSkills) ? agent.installedSkills as string[] : [],
      installedSubagents: Array.isArray(agent.installedSubagents) ? agent.installedSubagents as string[] : Array.isArray(agent.installedAgents) ? agent.installedAgents as string[] : [],
      managedSkills: normalizeManagedSkills(agent.managedSkills),
      managedSubagents: normalizeManagedSkills(agent.managedSubagents),
    };
  });

  const rawRules = raw.rules as Record<string, unknown> | undefined;

  return {
    version: (raw.version as string) ?? CURRENT_VERSION,
    engine: (raw.engine as string) ?? 'unity',
    engineMcpKey: (raw.engineMcpKey as string) ?? null,
    rulesRegistry: (raw.rulesRegistry as string) ?? null,
    mcp: normalizeMcp(raw.mcp),
    agents: normalizedAgents,
    extensions: normalizeExtensions(raw.extensions),
    rules: {
      // Legacy `declined` field (pre-refactor) is silently dropped on load; the next
      // saveConfig will persist the config without it so the migration is seamless.
      installed: normalizeRulesInstallation(rawRules?.installed),
    },
  };
}

export async function saveConfig(projectDir: string, config: UniKitConfig): Promise<void> {
  const configPath = getConfigPath(projectDir);
  await writeJsonFile(configPath, config);
}

export async function configExists(projectDir: string): Promise<boolean> {
  const configPath = getConfigPath(projectDir);
  return fileExists(configPath);
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
