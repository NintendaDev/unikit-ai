// --- The adapter seam of the bridge layer ---
//
// One mechanism, two kinds of bridge: an MCP server the agent talks to, and a command line the agent
// runs. They differ in exactly five places, and this interface is those places — nothing else in the
// core may branch on `kind` (guard BR-2b):
//
//   1. registration  — does the bridge get an entry in the agent's settings file?
//   2. grant         — what the frontmatter entries that confer its tools look like
//   3. call          — how the agent invokes it
//   4. catalog       — where the live list of what it can do comes from
//   5. availability  — the signal that it is usable right now
//
// Preparing the environment (installing the CLI, the package, the plugin) is not a sixth point: it is
// data of the catalog entry (`setup[]`), the same shape for every kind.

import type { BridgeKind, McpServerEntry } from '../mcp.js';
import { cliAdapter } from './adapter-cli.js';
import { mcpAdapter } from './adapter-mcp.js';

/** Everything the renderer knows about one bridge when it asks the adapter to describe it. */
export interface BridgeBlockInput {
  fileId: string;
  entry: McpServerEntry;
  /** Project-relative MCP settings files of the agents of this project, each once, in agent order. */
  settingsFiles: string[];
}

/**
 * What an adapter says about its kind in the block of a bridge: the rows of the `field | value` table, in
 * the order the readers rely on, and the free-text cautions printed as a list under the table.
 */
export interface BridgeBlockParts {
  rows: Array<[field: string, value: string]>;
  notes: string[];
}

export interface BridgeAdapter {
  readonly kind: BridgeKind;
  /** 1. registration: does the bridge get an entry in the agent's settings file? */
  readonly registersInSettings: boolean;
  /** 2. grants: frontmatter entries for one artifact, from the names the card lists for it. */
  grantEntries(entry: McpServerEntry, names: string[]): string[];
  /** 2. grants, removal: prefixes of the entries this kind owns, so a grant that narrowed later can be removed. */
  managedGrantPrefixes(entry: McpServerEntry): string[];
  /** 3-5. call form, catalog source, availability signal: the first rows of the bridge's block in BRIDGES.md. */
  describe(input: BridgeBlockInput): BridgeBlockParts;
  /**
   * 5. availability, before the bridge is selected: the command a `Not selected` entry of BRIDGES.md carries as its
   * probe so that `/unikit` can tell whether a bridge the project did not select is installed on this machine.
   * `null` for a kind with no such probe (an MCP server is "installed" when the client lists it).
   */
  probeLine(entry: McpServerEntry): string | null;
}

const ADAPTERS: Partial<Record<BridgeKind, BridgeAdapter>> = {
  mcp: mcpAdapter,
  cli: cliAdapter,
};

/** The adapter of a kind. An unregistered kind is a programmer error, not a data defect: it throws. */
export function getBridgeAdapter(kind: BridgeKind): BridgeAdapter {
  const adapter = ADAPTERS[kind];
  if (!adapter) {
    throw new Error(`no bridge adapter for kind "${kind}"`);
  }
  return adapter;
}
