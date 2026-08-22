// MCP migrations — on-disk conversion of the `mcp` section of `.unikit.json`
// and of the file ids stored alongside it.
//
// 2.0.0 splits one identifier into two. `key` becomes the server's INTERNAL
// identity (the JSON file's basename) and never leaves the package; `code` is
// the VENDOR code the server is actually registered under in the agent's
// settings file (`mcpServers.<code>`, `mcp__<code>__*` grants). The project
// therefore has to remember both, and `mcp.servers` turns from a bare list of
// file ids into a `key → code` map.
//
// Every step here works on RAW JSON, deliberately bypassing `loadConfig` /
// `saveConfig`:
//
//   - `normalizeMcp` reports an unrecognized `servers` shape as an EMPTY
//     selection. A `detect` reading through `loadConfig` would therefore never
//     see the legacy array — it would look at an already-empty map and report
//     nothing to do, forever.
//   - the new types do not admit the old shape at all, so a round-trip through
//     them cannot carry the value being migrated.
//
// This matches the rest of the chain, whose steps all move files on disk rather
// than through a typed loader. Lives in its own module (RULES.md: modularity,
// ≤500 lines per file) and is registered in `PROJECT_MEMORY_MIGRATIONS`, so
// `init`/`update` run it and the `rules` staleness guard sees it.

import path from 'path';
import {
  fileExists, listFiles, listFilesRecursive, movePath,
  readJsonFile, readTextFile, writeJsonFile, writeTextFile,
} from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';
import {
  CONFIG_FILE, DEFAULT_ENGINE_ID, MCP_FILE_ID_RENAMES, MCP_RECHECK_NOTES_ARCHIVE_PREFIX,
  MCP_STAMP_SERVER_KEY, MIGRATION_SINCE_MCP_VENDOR_CODES,
  UNIKIT_DIR, mcpRecheckNotesPath, systemEngineMcpDir,
} from '../constants.js';
import { discoverMcpServers } from '../mcp.js';
import type { DiscoveredServers } from '../mcp.js';
import type { Migration } from '../migrations/types.js';

const LOG_TAG = 'mcp:migrate';

/** Extension every findings-log file carries, active or archived. */
const NOTES_EXTENSION = '.md';

/** Index suffix of an archived findings log: `.1`, `.2`, … */
const ARCHIVE_INDEX_PATTERN = /^\.[0-9]+$/;

export interface McpMigrationContext {
  projectDir: string;
}

type RawConfig = Record<string, unknown>;

function configPath(projectDir: string): string {
  return path.join(projectDir, CONFIG_FILE);
}

async function readRawConfig(projectDir: string): Promise<RawConfig | null> {
  return readJsonFile<RawConfig>(configPath(projectDir));
}

/** The `mcp` object of a raw config, or `undefined` when there is none. */
function rawMcp(raw: RawConfig | null): RawConfig | undefined {
  const mcp = raw?.mcp;
  return mcp && typeof mcp === 'object' ? mcp as RawConfig : undefined;
}

/** The legacy shape: `mcp.servers` is still an array of file ids. */
function legacyServerList(raw: RawConfig | null): string[] | null {
  const mcp = rawMcp(raw);
  if (!mcp || !Array.isArray(mcp.servers)) return null;
  return mcp.servers.filter((s): s is string => typeof s === 'string');
}

/** Keys of `mcp.servers` (map form) or its entries (legacy array form). */
function configServerIds(raw: RawConfig | null): string[] {
  const mcp = rawMcp(raw);
  if (!mcp || !mcp.servers) return [];
  if (Array.isArray(mcp.servers)) return mcp.servers.filter((s): s is string => typeof s === 'string');
  if (typeof mcp.servers === 'object') return Object.keys(mcp.servers as RawConfig);
  return [];
}

/**
 * Load the package catalog for the project's engine. Returns `null` when the
 * catalog cannot be read (an unknown engine, or an engine with no `is_engine`
 * server — `discoverMcpServers` throws on both). The caller then leaves the
 * config untouched: without the catalog the codes would have to be invented,
 * and a wrong code is worse than a pending migration.
 */
async function loadCatalog(raw: RawConfig): Promise<DiscoveredServers | null> {
  // A config predating the `engine` field falls back to the SAME default the
  // loader applies (`normalizeConfig`). Bailing out instead would strand the
  // oldest configs in the array form for good — and those are precisely the
  // ones this step exists for.
  const engineId = typeof raw.engine === 'string' && raw.engine.length > 0
    ? raw.engine
    : DEFAULT_ENGINE_ID;
  try {
    return await discoverMcpServers(engineId);
  } catch (error) {
    logWarn(
      LOG_TAG,
      `cannot scan the MCP catalog for engine "${engineId}" (${(error as Error).message}) — leaving mcp.servers untouched`,
    );
    return null;
  }
}

/**
 * `mcp.servers`: `string[]` (file ids) → `Record<string, string>` (key → code).
 */
const mcpServersMapMigration: Migration<McpMigrationContext> = {
  id: 'mcp-servers-map',
  since: MIGRATION_SINCE_MCP_VENDOR_CODES,

  async detect({ projectDir }) {
    return legacyServerList(await readRawConfig(projectDir)) !== null;
  },

  async apply({ projectDir }) {
    const raw = await readRawConfig(projectDir);
    const legacy = legacyServerList(raw);

    // NOT a duplicate of `detect`. The runner ORs the version half with
    // `detect`, so this step is also entered when the version alone is pending
    // — including on a project whose `update` already built the map and then
    // died before the version stamp was written (`saveConfig` is the last call
    // in the command). Such a project reports `versionPending === true` with
    // `detect === false`, and an unguarded `apply` would rebuild the map from
    // an object, producing an empty selection: the whole MCP choice, silently
    // erased. The shape check is the guard.
    if (!raw || legacy === null) return;

    const catalog = await loadCatalog(raw);
    if (!catalog) return;

    const previousEngineCode = typeof raw.engineMcpKey === 'string' ? raw.engineMcpKey : null;
    const servers: Record<string, string> = {};

    for (const fileId of legacy) {
      // `mcp-fileid-rename` runs AFTER this step, so a legacy config still names
      // servers by their pre-2.0.0 file ids while the catalog on disk is already
      // renamed. Resolve through the table rather than dropping the entry —
      // dropping would erase the user's whole MCP selection on exactly the
      // projects this migration exists for. The KEY stays as found; renaming
      // keys is the next step's single job.
      const entry = catalog.get(fileId) ?? catalog.get(MCP_FILE_ID_RENAMES[fileId] ?? '');
      if (!entry) {
        // A selection can outlive the file that produced it (a vendor dropped,
        // an engine switched).
        logWarn(LOG_TAG, `dropping "${fileId}": no such server in the package catalog`);
        continue;
      }

      // The ENGINE server takes the code that was actually written into the
      // agent's settings file, which `engineMcpKey` preserved — NOT the code
      // the package ships today. This is the point of the whole step: the two
      // differ exactly for the servers whose registration is wrong, and the
      // reconciliation compares "stored code" against "current code" to find
      // the orphan entry and remove it. Write the NEW code here and the two
      // sides match, no swap happens, and the orphan (`UnityMCP`) survives in
      // `.mcp.json` with grants pointing at a server that is not running.
      if (entry.isEngine && previousEngineCode) {
        servers[fileId] = previousEngineCode;
        logInfo(LOG_TAG, `key=${fileId} code=${previousEngineCode} source=engineMcpKey`);
        continue;
      }

      // Non-engine servers: the pre-2.0.0 schema stored no code for them at
      // all, so the code the package ships today is the only available value. It
      // carries the assumption that their code never changed — true for the one
      // universal server that exists today (`context7`), which registered under
      // that same name before the field was split out. A vendor renaming a
      // universal server needs its own step; there is no record here to migrate
      // from.
      servers[fileId] = entry.code;
      logInfo(LOG_TAG, `key=${fileId} code=${entry.code} source=package`);
    }

    const mcp = rawMcp(raw) ?? {};
    await writeJsonFile(configPath(projectDir), { ...raw, mcp: { ...mcp, servers } });
    logInfo(LOG_TAG, `servers array -> map: ${Object.keys(servers).length} entries`);
  },
};

/** `<prefix><fileId>` — an archive name without its index and extension. */
function archiveStem(fileId: string): string {
  return `${MCP_RECHECK_NOTES_ARCHIVE_PREFIX}${fileId}`;
}

/**
 * Archived findings logs whose name carries a pre-2.0.0 file id, paired with
 * the name they should take. The index suffix (`.1`, `.2`, … — allocated when a
 * previous run was interrupted mid-swap) is preserved verbatim: it distinguishes
 * two real sessions' findings and is not ours to renumber.
 */
async function legacyArchiveRenames(projectDir: string): Promise<{ from: string; to: string }[]> {
  const unikitDir = path.join(projectDir, UNIKIT_DIR);
  const renames: { from: string; to: string }[] = [];

  for (const name of await listFiles(unikitDir)) {
    if (!name.endsWith(NOTES_EXTENSION)) continue;
    for (const [oldId, newId] of Object.entries(MCP_FILE_ID_RENAMES)) {
      const stem = archiveStem(oldId);
      if (!name.startsWith(stem)) continue;
      // Only an index may follow the id: `…archive.unity-mcp-biome-x.md` is
      // another server's archive, not an indexed slot of this one.
      const tail = name.slice(stem.length, name.length - NOTES_EXTENSION.length);
      if (tail !== '' && !ARCHIVE_INDEX_PATTERN.test(tail)) continue;
      renames.push({ from: name, to: `${archiveStem(newId)}${tail}${NOTES_EXTENSION}` });
      break;
    }
  }

  return renames;
}

/** Every file whose `server:` line may still name a pre-2.0.0 id. */
async function serverLineFiles(projectDir: string): Promise<string[]> {
  const unikitDir = path.join(projectDir, UNIKIT_DIR);
  // Markdown only — the stamp is prepended to `.md` files, and the rules tree
  // is free to carry other assets that must not be read as text.
  const files = (await listFilesRecursive(systemEngineMcpDir(projectDir)))
    .filter(file => file.endsWith(NOTES_EXTENSION));

  const activeNotes = mcpRecheckNotesPath(projectDir);
  if (await fileExists(activeNotes)) files.push(activeNotes);

  for (const name of await listFiles(unikitDir)) {
    if (name.startsWith(MCP_RECHECK_NOTES_ARCHIVE_PREFIX) && name.endsWith(NOTES_EXTENSION)) {
      files.push(path.join(unikitDir, name));
    }
  }

  return files;
}

/**
 * Rewrite a `server: <old id>` line in `content`, or return `null` when there is
 * nothing to rewrite. Anchored on the line start and on an exact value match:
 * the value is a bare token, and a substring rewrite would corrupt prose that
 * merely mentions the old name.
 */
function rewriteServerLine(content: string): string | null {
  const lines = content.split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith(MCP_STAMP_SERVER_KEY)) continue;

    // A CRLF file splits into lines ending in `\r`; carry it over so the
    // rewrite does not leave one line with a different ending than its file.
    const eol = line.endsWith('\r') ? '\r' : '';
    const rest = line.slice(MCP_STAMP_SERVER_KEY.length, line.length - eol.length);
    const value = rest.trim();
    const renamed = MCP_FILE_ID_RENAMES[value];
    if (!renamed) continue;

    // Keep the original spacing: the delivery stamp writes one space, the
    // findings-log template writes two, and neither is ours to normalize.
    const spacing = rest.slice(0, rest.length - rest.trimStart().length);
    lines[i] = `${MCP_STAMP_SERVER_KEY}${spacing}${renamed}${eol}`;
    changed = true;
  }

  return changed ? lines.join('\n') : null;
}

/** Rename the pre-2.0.0 ids stored as keys (or legacy entries) of `mcp.servers`. */
async function renameConfigServerIds(projectDir: string, raw: RawConfig | null): Promise<void> {
  const mcp = rawMcp(raw);
  if (!raw || !mcp || !mcp.servers) return;

  const affected = configServerIds(raw).filter(id => MCP_FILE_ID_RENAMES[id]);
  if (affected.length === 0) return;

  let servers: unknown;
  if (Array.isArray(mcp.servers)) {
    // Only reachable when `mcp-servers-map` bailed out (an unreadable catalog).
    // Renaming the ids anyway leaves the next run a config it can convert.
    servers = mcp.servers
      .filter((s): s is string => typeof s === 'string')
      .map(id => MCP_FILE_ID_RENAMES[id] ?? id);
  } else {
    const renamed: Record<string, unknown> = {};
    for (const [key, code] of Object.entries(mcp.servers as RawConfig)) {
      renamed[MCP_FILE_ID_RENAMES[key] ?? key] = code;
    }
    servers = renamed;
  }

  await writeJsonFile(configPath(projectDir), { ...raw, mcp: { ...mcp, servers } });
  for (const oldId of affected) {
    logInfo(LOG_TAG, `renamed fileId ${oldId} -> ${MCP_FILE_ID_RENAMES[oldId]}`);
  }
}

/**
 * Rename the pre-2.0.0 MCP file ids across the four surfaces that store one:
 * the keys of `config.mcp.servers`, the names of the archived findings logs,
 * the delivery stamp of the installed rules tree, and the `server:` header
 * inside the findings logs themselves.
 *
 * The last two are the easy ones to miss, and both fail loudly in production
 * rather than at compile time:
 *
 *  - the DELIVERY STAMP in `.unikit/system/engine-mcp/*.md`. `update` reads the
 *    previous server out of it (`readDeliveredEngineMcpServer`) and compares it
 *    against the newly resolved one. Leave the old id there and this rename
 *    looks exactly like a server switch, so `swapMcpRecheckNotes` parks the
 *    ACTIVE findings log as an archive of a server that no longer exists — a
 *    live log vanishing silently, with its real archive already renamed and
 *    nothing left to identify the active file by.
 *  - the NOTES HEADER inside the findings log, which stores a file id too and is
 *    compared against that same stamp on Bootstrap by four pipeline skills.
 *    Rewrite the stamp without it and every run prints "notes header ≠
 *    configured server" — caused by this rename, not by a switch — and nothing
 *    clears it: the trap never rewrites the header of an existing file. The
 *    entries stay valid (suspect, not void), so this is noise rather than loss;
 *    but permanent noise makes a real switch indistinguishable from this one.
 *
 * Ordering: same `since` as `mcp-servers-map`, later in declaration order, so
 * the map exists before its keys are renamed — and both run before `update`
 * reaches the stamp.
 */
const mcpFileIdRenameMigration: Migration<McpMigrationContext> = {
  id: 'mcp-fileid-rename',
  since: MIGRATION_SINCE_MCP_VENDOR_CODES,

  async detect({ projectDir }) {
    if (configServerIds(await readRawConfig(projectDir)).some(id => MCP_FILE_ID_RENAMES[id])) return true;
    if ((await legacyArchiveRenames(projectDir)).length > 0) return true;

    for (const file of await serverLineFiles(projectDir)) {
      const content = await readTextFile(file);
      if (content && rewriteServerLine(content) !== null) return true;
    }
    return false;
  },

  async apply({ projectDir }) {
    // Every branch re-checks its own surface and writes nothing when there is
    // no work, so an `apply` entered on the version half alone (see the
    // runner's OR) is a clean no-op.
    await renameConfigServerIds(projectDir, await readRawConfig(projectDir));

    const unikitDir = path.join(projectDir, UNIKIT_DIR);
    for (const { from, to } of await legacyArchiveRenames(projectDir)) {
      const target = path.join(unikitDir, to);
      if (await fileExists(target)) {
        // Merging two real sessions' findings is a curation call
        // (`/unikit-mcp-audit`), never an installer's.
        logWarn(LOG_TAG, `skip archive ${from}: ${to} already exists`);
        continue;
      }
      await movePath(path.join(unikitDir, from), target);
      logInfo(LOG_TAG, `renamed findings archive ${from} -> ${to}`);
    }

    for (const file of await serverLineFiles(projectDir)) {
      const content = await readTextFile(file);
      if (!content) continue;
      const rewritten = rewriteServerLine(content);
      if (rewritten === null) continue;
      await writeTextFile(file, rewritten);
      logInfo(LOG_TAG, `rewrote the ${MCP_STAMP_SERVER_KEY} line in ${path.relative(projectDir, file)}`);
    }
  },
};

export const PROJECT_MCP_MIGRATIONS: readonly Migration<McpMigrationContext>[] = [
  // Declaration order is the tie-break for equal `since`: the map conversion
  // runs first, then the ids inside it are renamed.
  mcpServersMapMigration,
  mcpFileIdRenameMigration,
];
