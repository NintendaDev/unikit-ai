// --- Engine-MCP rules-tree resolution ---
//
// Answers one question for the delivery layer: which of the servers the user
// selected is the *engine* one, and where does its rules tree live. Kept out of
// `mcp.ts` for the same reason as `mcp-platform.ts` — that module already
// carries discovery, configuration, rule collection and frontmatter injection,
// and it sits close enough to the 500-line ceiling that one more concern would
// push it over. The dependency runs one way: this module imports types from
// `mcp.ts`, never the reverse.
//
// Replaces the retired `mcp-shards.ts`. There is nothing left to concatenate:
// one engine ships one engine MCP server, so the tree is copied, not merged, and
// the `order` field went back to being a wizard-presentation concern only.

import type { DiscoveredServers, McpServerEntry } from './mcp.js';
import { logWarn } from '../utils/log.js';

/** The selected engine server, paired with the file id it was discovered under. */
export interface SelectedEngineServer {
  fileId: string;
  entry: McpServerEntry;
}

/**
 * Pick the engine MCP server out of the current selection.
 *
 * One engine takes one engine server, so the expected result is zero or one
 * match. A selection carrying two is a data defect rather than a supported
 * shape; it is resolved deterministically (lowest `order`, ties by `fileId`)
 * with a warning instead of an abort — the house rule is that a defect in the
 * server catalog degrades one thing, never the whole install.
 *
 * @returns `null` when the selection holds no engine server at all — a normal
 *          state for a project that took only universal servers.
 */
export function resolveSelectedEngineServer(
  discoveredServers: DiscoveredServers,
  enabledFileIds: string[],
): SelectedEngineServer | null {
  const enabled = new Set(enabledFileIds);
  const engines = [...discoveredServers]
    .filter(([fileId, entry]) => enabled.has(fileId) && entry.isEngine)
    .sort(([fileIdA, entryA], [fileIdB, entryB]) => {
      const orderA = entryA.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = entryB.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return fileIdA.localeCompare(fileIdB);
    });

  if (engines.length === 0) return null;

  if (engines.length > 1) {
    logWarn(
      'resolveSelectedEngineServer',
      `selection holds ${engines.length} engine servers (${engines.map(([id]) => id).join(', ')}), using ${engines[0][0]}`,
    );
  }

  const [fileId, entry] = engines[0];
  return { fileId, entry };
}
