// --- Adapter of the `cli` kind ---
//
// A command-line bridge is an executable the agent runs through its shell tool. It has no entry in the
// agent's settings file, its tools are granted as narrow shell patterns (`Bash(<binary> <verb> *)`,
// one per shell the card names), and the forms of calling it, listing its catalog and probing it live
// on the card. Every flag and argument order of the executable is DATA of the card: nothing here knows
// what the binary is called, only how a grant for it is spelled and how its block in BRIDGES.md reads.

import type { McpServerEntry } from '../mcp.js';
import { logWarn } from '../../utils/log.js';
import type { BridgeAdapter } from './adapter.js';
import type { BridgeCli, BridgeFileProbe } from './types.js';

const LOG_COMPONENT = 'adapter-cli';
const WILDCARD = '*';
const KEY_PATH_SEPARATOR = ' > ';

/** The `cli` block of an entry of this kind. A parsed entry of kind `cli` always has one; the opposite is a programmer error. */
function cliOf(entry: McpServerEntry): BridgeCli {
  if (!entry.cli) {
    throw new Error(`bridge "${entry.key}" is of kind cli but carries no cli block`);
  }
  return entry.cli;
}

/** `CLI >= 1.0.0-beta.14; package >= 0.9.1-exp.1; engine >= 6000.0` from the floors the card sets, as a block line; `null` without any. */
function floorLine(entry: McpServerEntry): string | null {
  const requires = entry.requires;
  if (!requires) return null;
  const parts = [
    requires.cli === undefined ? null : `CLI >= ${requires.cli}`,
    requires.package === undefined ? null : `package >= ${requires.package}`,
    requires.engineVersion === undefined ? null : `engine >= ${requires.engineVersion}`,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? `- floor: ${parts.join('; ')}` : null;
}

/**
 * The block line of a probe that READS a project file: no shell, no grant, works with the editor
 * closed. The key `- probe package: ` is a contract with the readers of BRIDGES.md.
 */
export function probePackageLine(probe: BridgeFileProbe): string {
  const read = (file: string, keyPath: string[]) => `read \`${file}\`, key path ${keyPath.join(KEY_PATH_SEPARATOR)}`;
  const fallback = probe.fallback
    ? `; when the file or the key is missing, ${read(probe.fallback.file, probe.fallback.path)} (the requested version: an open editor loads it only after it refreshes the project)`
    : '';
  return `- probe package: ${read(probe.file, probe.path)}${fallback}`;
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
  describe: ({ entry }) => {
    const cli = cliOf(entry);
    const forms = cli.forms;
    const floor = floorLine(entry);
    const versionIsFloored = forms.version !== undefined && entry.requires?.cli !== undefined;
    return [
      '- kind: cli',
      `- call: \`${forms.call}\``,
      ...(forms.groups ? [`- catalog groups: \`${forms.groups}\``] : []),
      ...(forms.group ? [`- catalog group: \`${forms.group}\``] : []),
      ...(forms.search ? [`- catalog search: \`${forms.search}\``] : []),
      ...(forms.list ? [`- catalog list: \`${forms.list}\``] : []),
      ...(forms.schema ? [`- schema of one command: \`${forms.schema}\``] : []),
      ...(forms.compile ? [`- compile: \`${forms.compile}\``] : []),
      ...(forms.status ? [`- status: \`${forms.status}\``] : []),
      ...(forms.ready ? [`- ready: \`${forms.ready}\``] : []),
      ...(forms.version ? [`- probe version: \`${forms.version}\``] : []),
      ...(cli.probes?.package ? [probePackageLine(cli.probes.package)] : []),
      ...(floor ? [floor] : []),
      `- available when: the status form answers without an error${versionIsFloored ? ' and the version probe is at or above the floor' : ''}`,
      ...(cli.notes ?? []).map(note => `- note: ${note}`),
    ];
  },
  probeLine: entry => {
    const version = entry.cli?.forms.version;
    return version ? `probe: \`${version}\`` : null;
  },
};
