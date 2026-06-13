import path from 'path';
import { createRequire } from 'module';
import { readJsonFile, writeJsonFile, fileExists } from '../utils/fs.js';
import { getAgentConfig } from './agents.js';
import { CODE_MODULE_ID, RULE_CATEGORIES, type Tier } from './constants.js';
import { getModule, listModules } from './modules.js';

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

/**
 * Installed-rule state, keyed by module then tier:
 * `modules[<module>][<tier>]`. Replaces the legacy flat `{ core, stack }`
 * shape; `normalizeRulesInstallation` migrates legacy configs in place on load.
 */
export interface RulesInstallation {
  version: string;
  modules: Record<string, Record<Tier, InstalledRuleEntry[]>>;
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

/**
 * The tier list used to (de)serialize one module's state. Registered modules
 * use their own `tiers` (the gamedesign module persists `library`, not
 * `stack`); unknown module ids in a loaded config fall back to the `code`
 * tier list so foreign entries survive a round-trip unchanged in shape.
 */
function tiersOf(moduleId: string): readonly Tier[] {
  return getModule(moduleId)?.tiers ?? RULE_CATEGORIES;
}

/** A fresh, empty per-tier container for one module. */
function emptyTierMap(tiers: readonly Tier[]): Record<Tier, InstalledRuleEntry[]> {
  const map = {} as Record<Tier, InstalledRuleEntry[]>;
  for (const tier of tiers) {
    map[tier] = [];
  }
  return map;
}

/** Empty module-keyed rules state with every registered module pre-created. */
export function emptyRulesInstallation(): RulesInstallation {
  const modules: Record<string, Record<Tier, InstalledRuleEntry[]>> = {};
  for (const module of listModules()) {
    modules[module.id] = emptyTierMap(module.tiers);
  }
  return { version: CURRENT_VERSION, modules };
}

/** Normalize one module's tier map from raw JSON, filling missing tiers. */
function normalizeModuleTiers(moduleId: string, raw: unknown): Record<Tier, InstalledRuleEntry[]> {
  const tiers = tiersOf(moduleId);
  const map = emptyTierMap(tiers);
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const tier of tiers) {
      map[tier] = normalizeRuleEntries(obj[tier]);
    }
  }
  return map;
}

function normalizeRulesInstallation(raw: unknown): RulesInstallation {
  if (!raw || typeof raw !== 'object') {
    return emptyRulesInstallation();
  }

  const inst = raw as Record<string, unknown>;
  const version = (inst.version as string) ?? CURRENT_VERSION;

  // New module-keyed format: { version, modules: { <module>: { <tier>: [] } } }.
  // Idempotent — re-normalizing an already-migrated config returns the same shape.
  if (inst.modules && typeof inst.modules === 'object') {
    const rawModules = inst.modules as Record<string, unknown>;
    const modules: Record<string, Record<Tier, InstalledRuleEntry[]>> = {};
    for (const [moduleId, tiers] of Object.entries(rawModules)) {
      modules[moduleId] = normalizeModuleTiers(moduleId, tiers);
    }
    // Guarantee every registered module's container exists so accessors never
    // miss it (configs written before a module was registered lack its key).
    for (const module of listModules()) {
      if (!modules[module.id]) {
        modules[module.id] = emptyTierMap(module.tiers);
      }
    }
    return { version, modules };
  }

  // Legacy flat format: { version, core, stack } → wrap under the code module.
  // `normalizeModuleTiers` reads `inst.core` / `inst.stack` directly off the
  // top-level object, so the legacy entries land in `modules.code`; the other
  // registered modules get fresh empty containers.
  const modules = emptyRulesInstallation().modules;
  modules[CODE_MODULE_ID] = normalizeModuleTiers(CODE_MODULE_ID, inst);
  return { version, modules };
}

/**
 * Return the LIVE `InstalledRuleEntry[]` for `modules[module][tier]`, lazily
 * creating the module/tier containers when absent. Call sites mutate the
 * returned array in place (`push` / `splice`), so a copy would silently break
 * them — this must always hand back the array stored on the config.
 */
export function getModuleTier(
  config: UniKitConfig,
  module: string,
  tier: Tier,
): InstalledRuleEntry[] {
  const installed = config.rules.installed;
  let moduleMap = installed.modules[module];
  if (!moduleMap) {
    moduleMap = emptyTierMap(tiersOf(module));
    installed.modules[module] = moduleMap;
  }
  if (!moduleMap[tier]) {
    moduleMap[tier] = [];
  }
  return moduleMap[tier];
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
