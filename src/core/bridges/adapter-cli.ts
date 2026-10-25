// --- Adapter of the `cli` kind ---
//
// A command-line bridge is an executable the agent runs through its shell tool. It has no entry in the
// agent's settings file, its tools are granted as narrow shell patterns (`Bash(<binary> <verb> *)`,
// one per shell the card names), and the forms of calling it, listing its catalog and probing it live
// on the card. Every flag and argument order of the executable is DATA of the card: nothing here knows
// what the binary is called, only how a grant for it is spelled.

import type { McpServerEntry } from '../mcp.js';
import { logWarn } from '../../utils/log.js';
import type { BridgeAdapter } from './adapter.js';
import type { BridgeCli } from './types.js';

const LOG_COMPONENT = 'adapter-cli';
const WILDCARD = '*';

/** The `cli` block of an entry of this kind. A parsed entry of kind `cli` always has one; the opposite is a programmer error. */
function cliOf(entry: McpServerEntry): BridgeCli {
  if (!entry.cli) {
    throw new Error(`bridge "${entry.key}" is of kind cli but carries no cli block`);
  }
  return entry.cli;
}

export const cliAdapter: BridgeAdapter = {
  kind: 'cli',
  registersInSettings: false,
  grantEntries: (entry, names) => {
    const cli = cliOf(entry);
    return names.flatMap(name => {
      // A name is a verb (`command`, `self-update --check`), never a mask: the adapter writes the mask itself.
      if (name.includes(WILDCARD)) {
        logWarn(LOG_COMPONENT, `a wildcard is not a verb; no grant written for ${name}`);
        return [];
      }
      return cli.shells.map(shell => `${shell}(${cli.binary} ${name} ${WILDCARD})`);
    });
  },
  managedGrantPrefixes: entry => {
    const cli = cliOf(entry);
    return cli.shells.map(shell => `${shell}(${cli.binary} `);
  },
  // A minimal block so that the build is green after this task; the full block (forms, probes, floor)
  // replaces it with the BRIDGES.md work.
  describe: ({ entry }) => ['- kind: cli', `- call: \`${cliOf(entry).forms.call}\``],
};
