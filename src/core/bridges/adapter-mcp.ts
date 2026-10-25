// --- Adapter of the `mcp` kind ---
//
// An MCP bridge is a server the agent's client already talks to: it is registered in the agent's
// settings file, its tools are granted as `mcp__<code>__<tool>`, the client lists them itself, and
// the server counts as available when the client lists its tools.

import { MCP_TOOL_ENTRY_PREFIX } from '../constants.js';
import type { BridgeAdapter } from './adapter.js';

export const mcpAdapter: BridgeAdapter = {
  kind: 'mcp',
  registersInSettings: true,
  grantEntries: (entry, names) => names.map(name => `${MCP_TOOL_ENTRY_PREFIX}${entry.code}__${name}`),
  managedGrantPrefixes: () => [MCP_TOOL_ENTRY_PREFIX],
  describe: ({ entry }) => [
    '- kind: mcp',
    `- call: MCP server \`${entry.code}\`; the client calls its tools directly`,
    "- catalog: the client's tool list",
    "- available when: the client lists the server's tools",
  ],
};
