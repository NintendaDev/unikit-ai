import path from 'path';
import { createRequire } from 'module';
import { readJsonFile, writeJsonFile, fileExists } from '../utils/fs.js';
import { AGENT_REGISTRY, getAgentConfig } from './agents.js';
import { CODE_MODULE_ID, CONFIG_FILE, RULE_CATEGORIES, type Tier } from './constants.js';
import { getModule, listModules } from './modules.js';
import { logInfo } from '../utils/log.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

export interface McpConfig {
  /**
   * The project's MCP selection as `key → code`, where `key` is the server's
   * internal identity (the JSON file's basename, never written anywhere) and
   * `code` is the vendor code the server is actually registered under in the
   * agent's settings file (`mcpServers.<code>`, `mcp__<code>__*` grants).
   *
   * The code is stored per project because it is the only record of what UniKit
   * WROTE: on a swap the outgoing entry has to be found by the code that was
   * used at the time, not by the code the package ships today.
   *
   * Pre-2.0.0 configs carry a bare `string[]` of file ids here. `normalizeMcp`
   * does NOT convert that form — the `mcp-servers-map` migration does, straight
   * on the raw JSON (see `mcp-migrations`).
   */
  servers: Record<string, string>;
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

/**
 * One installed genre profile in `.unikit.json`. `version` is a recorded
 * provenance fact (which bundled revision was delivered) — the installer
 * refreshes installed profiles unconditionally (flat rewrite), so `version`
 * does NOT gate refresh. Genres are orthogonal to knowledge modules:
 * `genres.installed` is a flat list keyed by profile id, NOT
 * `rules.installed.modules.*`.
 */
export interface GenreInstallEntry {
  id: string;
  version: number;
}

export interface UniKitConfig {
  version: string;
  engine: string;
  /**
   * The vendor code of the selected ENGINE server — a DERIVED field, kept for
   * back-compat reading (and as the migration's only source of the pre-2.0.0
   * code). It is recomputed from `mcp.servers` + the catalog's `is_engine` flag
   * on every write; never treat it as an independent input.
   */
  engineMcpKey: string | null;
  rulesRegistry: string | null;
  mcp: McpConfig;
  agents: AgentInstallation[];
  extensions?: ExtensionRecord[];
  rules: {
    installed: RulesInstallation;
  };
  /**
   * Selectively installed read-only genre profiles. Optional (additive, like
   * {@link UniKitConfig.extensions}): absent on configs written before the
   * genres feature; `loadConfig` always normalizes it to `{ installed: [] }`.
   */
  genres?: {
    installed: GenreInstallEntry[];
  };
}

const CONFIG_FILENAME = CONFIG_FILE;
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

/**
 * Normalize `mcp` into the `key → code` map form.
 *
 * The legacy array form is deliberately NOT converted here. Building the map
 * needs the OLD vendor code of the engine server (kept in `engineMcpKey`) and
 * the package catalog — knowledge that belongs to a migration step, not to a
 * loader. `loadConfig` therefore reports the legacy form as an empty selection,
 * exactly as it did before this field changed shape, and the `mcp-servers-map`
 * step converts it on raw JSON.
 *
 * The notice is gated on a NON-EMPTY array on purpose, and is `logInfo` rather
 * than `logWarn`: `"servers": []` appears in dozens of test fixtures where
 * there is nothing to migrate, and `logWarn` writes to stderr unconditionally —
 * which the bash harness folds into the log its `--json` assertions parse.
 */
function normalizeMcp(raw: unknown): McpConfig {
  if (!raw || typeof raw !== 'object') {
    return { servers: {} };
  }

  const mcp = raw as Record<string, unknown>;

  if (Array.isArray(mcp.servers)) {
    if (mcp.servers.length > 0) {
      logInfo('config', 'mcp.servers is in the legacy array form — migration pending');
    }
    return { servers: {} };
  }

  if (mcp.servers && typeof mcp.servers === 'object') {
    const servers: Record<string, string> = {};
    for (const [key, code] of Object.entries(mcp.servers as Record<string, unknown>)) {
      if (key && typeof code === 'string' && code.length > 0) {
        servers[key] = code;
      }
    }
    return { servers };
  }

  return { servers: {} };
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

/**
 * Return the LIVE `GenreInstallEntry[]` for `config.genres.installed`, lazily
 * creating the `genres` container when absent. Mirrors {@link getModuleTier}:
 * call sites mutate the returned array in place (`push` / `splice`), so this
 * must hand back the array stored on the config, never a copy.
 */
export function getInstalledGenres(config: UniKitConfig): GenreInstallEntry[] {
  if (!config.genres) {
    config.genres = { installed: [] };
  }
  return config.genres.installed;
}

function normalizeExtensions(raw: unknown): ExtensionRecord[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((ext): ext is ExtensionRecord => {
    if (!ext || typeof ext !== 'object') return false;
    const e = ext as Record<string, unknown>;

    return typeof e.name === 'string' && typeof e.source === 'string' && typeof e.version === 'string';
  });
}

/**
 * Normalize the `genres` install-state. A missing/malformed field yields
 * `{ installed: [] }` (never `undefined`), mirroring
 * {@link normalizeRulesInstallation}'s "always a container" contract so
 * accessors and the installer never branch on absence. A version that isn't a
 * number defaults to `1`.
 */
function normalizeGenres(raw: unknown): { installed: GenreInstallEntry[] } {
  if (!raw || typeof raw !== 'object') return { installed: [] };

  const rawInstalled = (raw as Record<string, unknown>).installed;
  if (!Array.isArray(rawInstalled)) return { installed: [] };

  const installed: GenreInstallEntry[] = [];
  for (const item of rawInstalled) {
    if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string') {
      const entry = item as Record<string, unknown>;
      const version = typeof entry.version === 'number' ? entry.version : 1;
      installed.push({ id: entry.id as string, version });
    }
  }
  return { installed };
}

export async function loadConfig(projectDir: string): Promise<UniKitConfig | null> {
  const configPath = getConfigPath(projectDir);
  const raw = await readJsonFile<Record<string, unknown>>(configPath);
  if (!raw) {
    return null;
  }

  const rawAgents = Array.isArray(raw.agents) ? raw.agents : [];
  const normalizedAgents = rawAgents.flatMap((agent: Record<string, unknown>) => {
    const id = agent.id as string;

    // Tolerate unknown agent ids: a config written for an agent no longer in the
    // registry (e.g. a dropped install target) is filtered out with a warning
    // instead of crashing every CLI command through getAgentConfig's throw. The
    // next saveConfig persists the config without the stale entry (free migration).
    if (!AGENT_REGISTRY[id]) {
      console.warn(`WARN: unknown agent '${id}' in .unikit.json — skipping`);
      return [];
    }

    const agentConfig = getAgentConfig(id);

    return [{
      id,
      skillsDir: (agent.skillsDir as string) || agentConfig.skillsDir,
      subagentsDir: (agent.subagentsDir as string) || (agent.agentsDir as string) || agentConfig.subagentsDir,
      installedSkills: Array.isArray(agent.installedSkills) ? agent.installedSkills as string[] : [],
      installedSubagents: Array.isArray(agent.installedSubagents) ? agent.installedSubagents as string[] : Array.isArray(agent.installedAgents) ? agent.installedAgents as string[] : [],
      managedSkills: normalizeManagedSkills(agent.managedSkills),
      managedSubagents: normalizeManagedSkills(agent.managedSubagents),
    }];
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
    genres: normalizeGenres(raw.genres),
  };
}

export async function saveConfig(projectDir: string, config: UniKitConfig): Promise<void> {
  const configPath = getConfigPath(projectDir);
  await writeJsonFile(configPath, config);
}

/**
 * Read the project's RECORDED version straight off the raw JSON — the version
 * anchor input for the migration chain.
 *
 * Deliberately NOT `loadConfig(...)?.version`: `loadConfig` defaults a missing
 * `version` field to the current package version, which makes the oldest
 * projects in existence — the ones written before the field was introduced —
 * look freshly stamped, and the version half of every migration would go quiet
 * on exactly them. Here a missing FILE and a missing FIELD both return `null`,
 * which the runner reads as "no version signal; `detect` decides".
 *
 * No normalization, no defaulting, no shape validation: an unparseable value is
 * returned as-is and the runner reports it (a warning) rather than this reader
 * inventing a number.
 */
export async function readConfigVersion(projectDir: string): Promise<string | null> {
  const raw = await readJsonFile<Record<string, unknown>>(getConfigPath(projectDir));
  if (!raw) return null;
  return typeof raw.version === 'string' ? raw.version : null;
}

export async function configExists(projectDir: string): Promise<boolean> {
  const configPath = getConfigPath(projectDir);
  return fileExists(configPath);
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
