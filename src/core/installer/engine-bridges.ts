// --- Engine-bridge delivery ---
//
// Delivers `.unikit/system/engine-bridges/`: `BRIDGES.md` (the SET of selected bridges, the package's
// default order and one block per bridge) and, for every selected bridge that ships one, its rules
// tree under `<bridge id>/`. NOT hash-tracked: every init/update rewrites the folder.
//
// A copy, not a merge: a bridge's tree is copied as it is, subdirectories included. Orphan-delete runs
// over the WHOLE subtree, not just `*.md`, because it is the only thing standing between a project that
// switched engine (or dropped a bridge) and a stale profile — system assets have no migration chain.
// The same sweep removes the 2.x folder `.unikit/system/engine-mcp/` on every run.
//
// A selection without bridges, or a bridge that ships no `rules` pointer, leaves nothing to deliver for
// it. That is a normal state, not a degraded one: no rules means no known exceptions, never no
// capabilities, and skills read a missing file as a silent skip.

import path from 'path';
import {
  fileExists, listDirectories, listEntries, listFilesRecursive, readTextFile, removeDirectory, removeFile, writeTextFile,
} from '../../utils/fs.js';
import { MCP_RULES_INDEX_FILE, systemEngineMcpDir } from '../constants.js';
import {
  BRIDGES_MANIFEST_FILE, BRIDGE_STAMP_LINE_PREFIX, STAMPABLE_EXTENSION, systemEngineBridgesDir,
} from '../constants-bridges.js';
import type { DiscoveredServers } from '../mcp.js';
import { orderBridges } from '../bridges/selection.js';
import { renderBridgesManifest } from '../bridges/manifest.js';
import { logInfo, logWarn } from '../../utils/log.js';

const LOG_COMPONENT = 'installEngineBridges';

/** A block heading of BRIDGES.md that names a bridge: `## <bridge id>`. */
const BRIDGE_HEADING_PATTERN = /^## ([a-z0-9][a-z0-9-]*)$/;

/**
 * Provenance stamp prepended to every delivered markdown file.
 *
 * It records **where this copy came from**, and nothing else. It is deliberately not a statement about
 * the bridge: no tool names, no counters, no list of what is missing — those are the three genres the
 * rules architecture bans, and a header that ships into every project is the easiest place for them to
 * creep back in.
 *
 * The stamp is also the reference point for the notes header: skills compare the `bridge:` recorded
 * here against the one in `.unikit/bridge-notes/<bridge>.md` to tell a finding about this bridge from a
 * finding inherited from another one.
 *
 * It carries the bridge id alone. A `version:` line and a `delivered:` date used to sit here; the date
 * was the one field that changed on every run — each `update` produced a diff on every file of the
 * tree consisting of one date, and nothing read it. What the short stamp buys is worth stating: a
 * delivered file is byte-identical between runs for as long as the tree and the bridge are unchanged,
 * so an unexpected diff is a signal rather than noise to scroll past.
 */
function renderBridgeRulesStamp(fileId: string): string {
  return [
    '<!-- Delivered by unikit-ai from the rules tree of an engine bridge selected for this project. -->',
    '<!-- Fix it at the source (the package\'s `engine-bridges/<engine>/rules/<bridge>/`), not here: -->',
    '<!-- every init / update rewrites this folder. -->',
    '',
    `${BRIDGE_STAMP_LINE_PREFIX}${fileId}`,
    '',
    '---',
    '',
  ].join('\n');
}

/** The engine bridges of the catalog that are not in the selection. */
function unselectedBridgeIds(discovered: DiscoveredServers, selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  return [...discovered].filter(([fileId, entry]) => entry.isEngine && !selected.has(fileId)).map(([fileId]) => fileId);
}

/** Remove every empty directory under `dir`, and `dir` itself when nothing is left in it. */
async function pruneEmptyDirectories(dir: string): Promise<void> {
  for (const name of await listDirectories(dir)) {
    await pruneEmptyDirectories(path.join(dir, name));
  }
  if ((await listEntries(dir)).length === 0) {
    await removeDirectory(dir);
  }
}

/**
 * The bridge ids the previous run delivered, read from the previous BRIDGES.md — the `update` path's
 * only record of the PREVIOUS selection (`init` reads it from the config it is about to overwrite).
 * Call it BEFORE {@link installEngineBridges}, which rewrites the file.
 *
 * @returns the ids in file order, or `null` when there is no BRIDGES.md.
 */
export async function readPreviousBridgeSet(projectDir: string): Promise<string[] | null> {
  const content = await readTextFile(path.join(systemEngineBridgesDir(projectDir), BRIDGES_MANIFEST_FILE));
  if (content === null) return null;

  const ids: string[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = BRIDGE_HEADING_PATTERN.exec(line);
    if (match) ids.push(match[1]);
  }
  return ids;
}

export async function installEngineBridges(
  projectDir: string,
  engineId: string,
  discovered: DiscoveredServers,
  bridgeIds: string[],
): Promise<void> {
  const bridges = orderBridges(discovered, bridgeIds);
  const destRoot = systemEngineBridgesDir(projectDir);
  const wanted = new Set<string>();
  const withTree = new Set<string>();

  for (const { fileId, entry } of bridges) {
    const sourceDir = entry.rulesDir;
    if (!sourceDir) continue;

    const sourceFiles = await listFilesRecursive(sourceDir);
    if (sourceFiles.length === 0) {
      logWarn(LOG_COMPONENT, `rules tree is empty or unreadable: ${sourceDir}`);
    }

    for (const absSource of sourceFiles) {
      const relPath = path.join(fileId, path.relative(sourceDir, absSource));
      const content = await readTextFile(absSource);
      if (content === null) {
        logWarn(LOG_COMPONENT, `unreadable rules file, skipped: ${absSource}`);
        continue;
      }

      const stamped = relPath.endsWith(STAMPABLE_EXTENSION)
        ? renderBridgeRulesStamp(fileId) + content.trim() + '\n'
        : content;

      await writeTextFile(path.join(destRoot, relPath), stamped);
      wanted.add(relPath);
      logInfo(LOG_COMPONENT, `stamped ${relPath} with bridge=${fileId}`);
    }

    // A tree without an entry point is a data defect worth naming: every skill that reads the profile
    // enters through INDEX.md, so the rest of the tree is delivered but unreachable. Still a warn, not
    // an abort — the run degrades to "no known exceptions", which is a supported state.
    if (wanted.has(path.join(fileId, MCP_RULES_INDEX_FILE))) {
      withTree.add(fileId);
    } else if (sourceFiles.length > 0) {
      logWarn(LOG_COMPONENT, `rules tree of ${fileId} has no ${MCP_RULES_INDEX_FILE} — skills enter through it`);
    }
  }

  // BRIDGES.md is written for every selected bridge, with a tree or without one: it is the answer to
  // "is a bridge configured?" and the record `update` reads the previous set from.
  if (bridges.length > 0) {
    await writeTextFile(path.join(destRoot, BRIDGES_MANIFEST_FILE), renderBridgesManifest({
      engineId,
      bridges: bridges.map(bridge => ({ ...bridge, hasRulesTree: withTree.has(bridge.fileId) })),
      unselected: orderBridges(discovered, unselectedBridgeIds(discovered, bridgeIds)),
    }));
    wanted.add(BRIDGES_MANIFEST_FILE);
  }

  // Orphan-delete the whole subtree, not just markdown: anything the current selection did not
  // contribute is by definition left over from a previous one.
  for (const absInstalled of await listFilesRecursive(destRoot)) {
    const relPath = path.relative(destRoot, absInstalled);
    if (wanted.has(relPath)) continue;
    await removeFile(absInstalled);
    logInfo(LOG_COMPONENT, `removed orphan ${relPath}`);
  }
  await pruneEmptyDirectories(destRoot);

  // The folder of the single-server era. System assets have no migration chain, so the sweep is here.
  const legacyDir = systemEngineMcpDir(projectDir);
  if (await fileExists(legacyDir)) {
    await removeDirectory(legacyDir);
    logInfo(LOG_COMPONENT, 'removed legacy .unikit/system/engine-mcp/');
  }

  logInfo(LOG_COMPONENT, `installed ${wanted.size} file(s) into .unikit/system/engine-bridges/ (bridges: ${bridges.map(b => b.fileId).join(', ') || 'none'})`);
}
