// --- Engine-MCP shard collection ---
//
// Assembles the `.unikit/system/engine-mcp/<shard>.md` bodies from the `shards`
// key of the MCP JSONs the user selected. Kept out of `mcp.ts` on purpose: that
// module already carries discovery, configuration, rule collection and
// frontmatter injection, and growing it further would repeat the monolith the
// 500-line guard prevents in `installer/` and `registry/`. The dependency runs
// one way — this module imports types from `mcp.ts`, never the reverse.

import { ENGINE_MCP_SHARDS, type EngineMcpShard } from './constants.js';
import type { DiscoveredServers, McpServerEntry } from './mcp.js';
import { readTextFile } from '../utils/fs.js';
import { logWarn } from '../utils/log.js';

/** Separator between two servers' contributions inside one shard file. */
const SHARD_SEPARATOR = '\n\n---\n\n';

/**
 * Order contributions deterministically: ascending `order`, entries without one
 * last, ties broken by `fileId`. `config.mcp.servers` comes out of the wizard in
 * answer order, so without this the concatenated shard would differ run to run.
 */
function compareContributors(
  a: [string, McpServerEntry],
  b: [string, McpServerEntry],
): number {
  const orderA = a[1].order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b[1].order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return a[0].localeCompare(b[0]);
}

/**
 * Collect the shard bodies contributed by the selected MCP servers.
 *
 * Each contribution is prefixed with a `## <displayName>` heading so a shard
 * assembled from two competing servers (Unity ships both biome and coplay under
 * one key) stays attributable. Unreadable shard files are warned about and
 * skipped — a broken pointer degrades that one contribution, it does not abort
 * the install (null-safe by convention).
 *
 * @returns a map of shard name → assembled markdown; shards nobody contributed
 *          to are absent from the map entirely.
 */
export async function collectMcpShards(
  discoveredServers: DiscoveredServers,
  enabledFileIds: string[],
): Promise<Map<EngineMcpShard, string>> {
  const enabled = new Set(enabledFileIds);
  const contributors = [...discoveredServers]
    .filter(([fileId, server]) => enabled.has(fileId) && server.shards)
    .sort(compareContributors);

  const collected = new Map<EngineMcpShard, string>();

  for (const shard of ENGINE_MCP_SHARDS) {
    const parts: string[] = [];

    for (const [fileId, server] of contributors) {
      const sourcePath = server.shards?.[shard];
      if (!sourcePath) continue;

      const content = await readTextFile(sourcePath);
      if (content === null) {
        logWarn('collectMcpShards', `shard file not found: ${sourcePath} (server ${fileId})`);
        continue;
      }

      parts.push(`## ${server.displayName}\n\n${content.trim()}`);
    }

    if (parts.length > 0) {
      collected.set(shard, parts.join(SHARD_SEPARATOR));
    }
  }

  return collected;
}
