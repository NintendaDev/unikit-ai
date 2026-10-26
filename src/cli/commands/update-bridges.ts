// --- Recompute of the persisted selection for `update` ---
//
// Lifted out of `update.ts`, which sits close to the 500-line ceiling, and widened from one map to
// two: the universal servers (`mcp.servers`) and the engine bridges (`engineBridges.selected`) both
// persist `fileId → vendor code`, and both can be stale after a package update.

import type { UniKitConfig } from '../../core/config.js';
import { discoverMcpServers, type DiscoveredServers } from '../../core/mcp.js';
import { resolveMcpBridgeCode } from '../../core/bridges/selection.js';
import { logInfo } from '../../utils/log.js';

const LOG_COMPONENT = 'update';

export interface RecomputedSelection {
  discoveredServers: DiscoveredServers;
  /** The codes as PERSISTED, both maps merged — the orphan removal compares them with the new ones. */
  storedCodes: Record<string, string>;
  /** Code `{{engine_bridge_mcp_code}}` is substituted with: derived from the catalog and the SET of bridges. */
  mcpBridgeCode: string | null;
  /** The file ids of both maps: what the settings reconciliation and the grants are driven by. */
  enabledIds: string[];
}

/**
 * Bring the vendor codes of the persisted selection in line with the catalog, BEFORE anything reads
 * them.
 *
 * `update` never re-asks for servers, so the codes it finds on disk are whatever the last write left
 * there — and after the `mcp-servers-map` migration that is deliberately the OLD code (`UnityMCP`),
 * preserved so the reconciliation can recognise the orphan entry it has to remove. Every artifact
 * the command installs then substitutes the code into itself, and the source hash is computed from
 * the same pairs. `saveConfig` is the LAST call in the command, so without a recompute here the
 * stale code lands in every installed skill — and the failure does not heal on the next run: the
 * hash is computed from the same stale value, the following `update` sees no divergence and
 * reinstalls nothing.
 *
 * Mutates both maps of `config` in place and returns the snapshot of the codes before the rewrite:
 * exactly one consumer needs it (the orphan removal in `reconcileMcpSettings`), and after the loop
 * that information exists nowhere else.
 */
export async function recomputeSelection(engineId: string, config: UniKitConfig): Promise<RecomputedSelection> {
  const discoveredServers = await discoverMcpServers(engineId);
  const storedCodes: Record<string, string> = { ...config.mcp.servers, ...config.engineBridges.selected };

  for (const selected of [config.mcp.servers, config.engineBridges.selected]) {
    for (const [key, storedCode] of Object.entries(selected)) {
      const server = discoveredServers.get(key);
      // A selection can outlive the file that produced it (a vendor dropped, an engine switched).
      // Leave the entry alone: dropping it here would erase a selection the user may still restore
      // by switching back.
      if (!server) continue;
      if (server.code === storedCode) {
        logInfo(LOG_COMPONENT, `mcp code unchanged: key=${key} code=${storedCode}`);
        continue;
      }
      selected[key] = server.code;
      logInfo(LOG_COMPONENT, `mcp code rewritten: key=${key} ${storedCode} -> ${server.code}`);
    }
  }

  const bridgeIds = Object.keys(config.engineBridges.selected);
  return {
    discoveredServers,
    storedCodes,
    mcpBridgeCode: resolveMcpBridgeCode(discoveredServers, bridgeIds),
    enabledIds: [...Object.keys(config.mcp.servers), ...bridgeIds],
  };
}
