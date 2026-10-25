// --- Engine-bridge selection helpers ---
//
// The selection of a project lives in two persisted maps, `mcp.servers` (universal MCP servers)
// and `engineBridges.selected` (engine bridges), both `fileId → vendor code`. Everything that
// hashes or reconciles the selection takes the pair as one value, and everything that needs "the
// code of the MCP bridge" derives it here, from the catalog and the SET of bridges — never from
// the user's order (`.unikit/config.yaml`, `engine_bridges.order`), which the installer does not
// read: a reorder must not change an installed byte (NFR-1).
//
// Replaces the persisted scalar `engineMcpKey`, which `init` (first in the order of the answer) and
// `update` (lowest `order`) computed differently. One function now serves every path.

import type { UniKitConfig } from '../config.js';
import { discoverMcpServers, type DiscoveredServers, type McpServerEntry } from '../mcp.js';
import { logInfo, logWarn } from '../../utils/log.js';

/** The two persisted maps, side by side. Everything that hashes or reconciles the selection takes this. */
export interface ServerSelection {
  /** universal MCP servers: fileId → vendor code */
  mcp: Record<string, string>;
  /** engine bridges: fileId → vendor code */
  bridges: Record<string, string>;
}

export function selectionOf(config: Pick<UniKitConfig, 'mcp' | 'engineBridges'>): ServerSelection {
  return { mcp: { ...config.mcp.servers }, bridges: { ...config.engineBridges.selected } };
}

export interface OrderedBridge {
  fileId: string;
  entry: McpServerEntry;
}

/**
 * Selected bridges in the PACKAGE order: `order` ascending, a missing one last, ties by fileId.
 * An id the catalog does not know is dropped — a selection can outlive the file that produced it.
 */
export function orderBridges(discovered: DiscoveredServers, bridgeIds: string[]): OrderedBridge[] {
  const selected = new Set(bridgeIds);
  return [...discovered]
    .filter(([fileId]) => selected.has(fileId))
    .map(([fileId, entry]): OrderedBridge => ({ fileId, entry }))
    .sort((a, b) => {
      const orderA = a.entry.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.entry.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.fileId.localeCompare(b.fileId);
    });
}

/**
 * Vendor code of the selected bridge of kind `mcp` that comes first in the package order, or `null`.
 * Feeds `{{engine_mcp_tool}}` (and the variable that replaces it later). Never the USER's order:
 * a reorder must not change the substitution, or the skill hash would have to follow it.
 */
export function resolveMcpBridgeCode(discovered: DiscoveredServers, bridgeIds: string[]): string | null {
  const ordered = orderBridges(discovered, bridgeIds);
  const first = ordered.find(bridge => bridge.entry.kind === 'mcp');
  logInfo('bridges', `mcp bridge code: ${first?.entry.code ?? 'none'} (bridges: ${ordered.map(b => b.fileId).join(', ') || 'none'})`);
  return first?.entry.code ?? null;
}

/**
 * Same, from a loaded config: runs the discovery itself. A catalog that cannot be read yields `null`
 * and one WARN — the commands that call this are not worth stopping over a catalog defect.
 */
export async function resolveMcpBridgeCodeForConfig(config: UniKitConfig): Promise<string | null> {
  try {
    const discovered = await discoverMcpServers(config.engine);
    return resolveMcpBridgeCode(discovered, Object.keys(config.engineBridges.selected));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logWarn('bridges', `catalog unreadable for engine "${config.engine}": ${message}; the MCP bridge code is left unset`);
    return null;
  }
}
