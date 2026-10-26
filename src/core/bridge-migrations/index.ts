// Engine-bridge migrations — on-disk conversion of a 2.x project to the 3.0.0 layout.
//
// 3.0.0 lifts the "one engine server per project" invariant: the engine's servers become BRIDGES,
// a project selects any number of them, and the selection gets a map of its own. `mcp.servers`
// keeps only the universal servers (Context7, GitHub); the engine's go to `engineBridges.selected`.
// The scalar `engineMcpKey` (the vendor code of the one engine server) is gone — the code of the MCP
// bridge is derived from the catalog now.
//
// Every step here works on RAW JSON, for the reason the 2.0.0 steps do: a round-trip through the
// typed loader would normalize the very shape being migrated, and `detect` would look at the
// converted result forever.
//
// Registered in `PROJECT_MEMORY_MIGRATIONS`, so `init`/`update` run it and the `rules` staleness
// guard sees it. The anchor is 3.0.0: the runner applies steps in ascending `since`, so this one
// runs after every 2.0.0 step — a 1.x project has its array converted to a map first.

import path from 'path';
import { readJsonFile, writeJsonFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';
import { CONFIG_FILE, DEFAULT_ENGINE_ID } from '../constants.js';
import { BRIDGE_MIGRATE_LOG_TAG, MIGRATION_SINCE_ENGINE_BRIDGES } from '../constants-bridges.js';
import { discoverMcpServers } from '../mcp.js';
import type { Migration } from '../migrations/types.js';
import { PROJECT_NOTES_MIGRATIONS } from './notes.js';
import { PROJECT_PLANS_MIGRATIONS } from './plans.js';

export interface BridgeMigrationContext {
  projectDir: string;
}

type RawConfig = Record<string, unknown>;

/** The scalar the 2.x installer wrote next to the maps; 3.0.0 neither writes nor reads it. */
const LEGACY_SCALAR_KEY = 'engineMcpKey';
const BRIDGES_KEY = 'engineBridges';

function configPath(projectDir: string): string {
  return path.join(projectDir, CONFIG_FILE);
}

async function readRawConfig(projectDir: string): Promise<RawConfig | null> {
  return readJsonFile<RawConfig>(configPath(projectDir));
}

function hasOwn(raw: RawConfig, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(raw, key);
}

/**
 * `mcp.servers` as a `key → code` map, `{}` when there is none, or `null` while it is still the
 * legacy array of file ids — the 2.0.0 steps own that form and have not converted it.
 */
function rawServerMap(raw: RawConfig): Record<string, string> | null {
  const mcp = raw.mcp;
  if (!mcp || typeof mcp !== 'object') return {};
  const servers = (mcp as RawConfig).servers;
  if (Array.isArray(servers)) return null;
  if (!servers || typeof servers !== 'object') return {};

  const map: Record<string, string> = {};
  for (const [key, code] of Object.entries(servers as RawConfig)) {
    if (key && typeof code === 'string' && code.length > 0) map[key] = code;
  }
  return map;
}

/**
 * The config with the selection split, key order kept: the scalar is dropped, `mcp.servers` is
 * replaced by the universal servers and `engineBridges` follows `mcp` straight away. A config
 * that had no `mcp` gets both at the end.
 */
function withBridges(raw: RawConfig, universal: Record<string, string>, bridges: Record<string, string>): RawConfig {
  const out: RawConfig = {};
  let placed = false;

  for (const [key, value] of Object.entries(raw)) {
    if (key === LEGACY_SCALAR_KEY || key === BRIDGES_KEY) continue;
    if (key === 'mcp') {
      const rawMcp = value && typeof value === 'object' ? value as RawConfig : {};
      out.mcp = { ...rawMcp, servers: universal };
      out[BRIDGES_KEY] = { selected: bridges };
      placed = true;
      continue;
    }
    out[key] = value;
  }

  if (!placed) {
    out.mcp = { servers: universal };
    out[BRIDGES_KEY] = { selected: bridges };
  }
  return out;
}

const engineBridgesConfigSplit: Migration<BridgeMigrationContext> = {
  id: 'engine-bridges-config-split',
  since: MIGRATION_SINCE_ENGINE_BRIDGES,

  // The old scalar is present in EVERY saved 2.x config (`saveConfig` wrote it even as null) and
  // 3.0.0 never writes it, so `detect` turns false as soon as `apply` has run. `engineBridges`
  // alone would not do: a hand-written config may lack both.
  async detect({ projectDir }) {
    const raw = await readRawConfig(projectDir);
    return !!raw && hasOwn(raw, LEGACY_SCALAR_KEY) && !hasOwn(raw, BRIDGES_KEY);
  },

  async apply({ projectDir }) {
    const raw = await readRawConfig(projectDir);
    // `apply` can be entered at `detect === false` (the version half of the runner): re-check the
    // SHAPE of the state and write nothing when there is no work. The scalar is NOT part of this
    // gate: a config from 1.x may lack it while its map holds an engine server (the 2.0.0 step
    // tolerates a missing scalar), and gating on it would leave that server among the universal ones.
    if (!raw || hasOwn(raw, BRIDGES_KEY)) return;

    const servers = rawServerMap(raw);
    if (servers === null) {
      logWarn(BRIDGE_MIGRATE_LOG_TAG, 'mcp.servers is still the legacy array; the 2.0.0 steps own it - left untouched');
      return;
    }

    // The catalog is read BEFORE anything is written, and a catalog that cannot be read stops the
    // run: `update` would otherwise save the normalized config (no scalar, an empty `engineBridges`)
    // and the selection would be gone for good with nothing left for `detect` to find.
    const engineId = typeof raw.engine === 'string' && raw.engine.length > 0 ? raw.engine : DEFAULT_ENGINE_ID;
    let catalog;
    try {
      catalog = await discoverMcpServers(engineId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`engine-bridges-config-split: cannot read the catalog for engine "${engineId}" (${reason}); ${CONFIG_FILE} was not changed`);
    }

    const oldCode = typeof raw[LEGACY_SCALAR_KEY] === 'string' ? raw[LEGACY_SCALAR_KEY] as string : null;
    const bridges: Record<string, string> = {};
    const universal: Record<string, string> = {};
    for (const [key, code] of Object.entries(servers)) {
      // A selection can outlive the file that produced it, so the catalog alone is not enough: the
      // entry whose code is the old scalar was the engine server even when its file is gone.
      const isBridge = catalog.get(key)?.isEngine === true || (oldCode !== null && code === oldCode && !catalog.has(key));
      (isBridge ? bridges : universal)[key] = code;
    }

    await writeJsonFile(configPath(projectDir), withBridges(raw, universal, bridges));
    logInfo(BRIDGE_MIGRATE_LOG_TAG, `config split: bridges=[${Object.keys(bridges).join(', ')}] universal=[${Object.keys(universal).join(', ')}]`);
  },
};

export const PROJECT_BRIDGE_MIGRATIONS: readonly Migration<BridgeMigrationContext>[] = [
  engineBridgesConfigSplit,
  ...PROJECT_NOTES_MIGRATIONS,
  ...PROJECT_PLANS_MIGRATIONS,
];
