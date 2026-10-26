// --- Adapter of the `mcp` kind ---
//
// An MCP bridge is a server the agent's client already talks to: it is registered in the agent's
// settings file, its tools are granted as `mcp__<code>__<tool>`, the client lists them itself, and
// the server counts as available when the client lists its tools.

import type { McpServerEntry } from '../mcp.js';
import { MCP_TOOL_ENTRY_PREFIX, MCP_VERSION_PLACEHOLDER } from '../constants.js';
import type { BridgeAdapter, BridgeBlockParts } from './adapter.js';

const NO_SETTINGS_FILES = 'none';

/**
 * The value of the `probe version` row of an MCP bridge, which is an instruction for the reader: the release the
 * server is started from is pinned in the arguments of its entry in the agent's settings file, and the card says
 * which part of them is the number (`versionProbe.pattern`). A file with no such entry, or one that still holds
 * the version placeholder, has no number and is skipped; two files with different numbers leave the version unknown.
 * `null` for a card that declares no `versionProbe`.
 */
function versionProbeValue(entry: McpServerEntry, settingsFiles: string[]): string | null {
  const probe = entry.versionProbe;
  if (!probe) return null;
  const files = settingsFiles.length > 0 ? settingsFiles.map(file => `\`${file}\``).join(', ') : NO_SETTINGS_FILES;
  return `read the entry \`${entry.code}\` in the MCP settings files of this project (${files}) and take what the pattern \`${probe.pattern}\` finds in its \`${probe.in}\`; the first file with a number wins, a file with no such entry or with the version placeholder \`${MCP_VERSION_PLACEHOLDER}\` still in it is skipped, and two files with different numbers leave the version unknown`;
}

export const mcpAdapter: BridgeAdapter = {
  kind: 'mcp',
  registersInSettings: true,
  grantEntries: (entry, names) => names.map(name => `${MCP_TOOL_ENTRY_PREFIX}${entry.code}__${name}`),
  managedGrantPrefixes: () => [MCP_TOOL_ENTRY_PREFIX],
  describe: ({ entry, settingsFiles }): BridgeBlockParts => {
    const versionProbe = versionProbeValue(entry, settingsFiles);
    return {
      rows: [
        ['kind', 'mcp'],
        ['call', `MCP server \`${entry.code}\`; the client calls its tools directly`],
        ['catalog', "the client's tool list"],
        ...(versionProbe === null ? [] : [['probe version', versionProbe] as [string, string]]),
        ['available when', "the client lists the server's tools"],
      ],
      notes: [],
    };
  },
  probeLine: () => null,
};
