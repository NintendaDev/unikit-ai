// --- The grant space the installer owns ---
//
// A frontmatter tool list mixes entries the installer wrote (the grants a bridge confers) with entries
// an author wrote (`Read`, `Bash(git *)`, `Agent`). Only the first kind may be removed when a grant
// narrows or a bridge is deselected, so the installer must know which entries are its own. They are
// recognised by prefix, and each kind of bridge names its own prefixes (adapter point 2): `mcp__` for
// an MCP server, `<Shell>(<binary> ` for a command line.

import { MCP_TOOL_ENTRY_PREFIX } from '../constants.js';
import type { DiscoveredServers } from '../mcp.js';
import { getBridgeAdapter } from './adapter.js';

/**
 * The prefixes of every entry the installer may have written, over the WHOLE catalog of the current
 * engine — selected bridges or not, because a bridge that was deselected must leave a clean list
 * behind. Always holds `mcp__`.
 */
export function collectManagedGrantPrefixes(discovered: DiscoveredServers): string[] {
  const prefixes = new Set<string>([MCP_TOOL_ENTRY_PREFIX]);
  for (const entry of discovered.values()) {
    for (const prefix of getBridgeAdapter(entry.kind).managedGrantPrefixes(entry)) {
      prefixes.add(prefix);
    }
  }
  return [...prefixes];
}
