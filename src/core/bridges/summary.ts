// --- Preparation lines of the init summary ---
//
// What the user has to do after `init` to make the selected bridges work: install an executable, add
// a package to the project, upgrade an older one. The lines come from the DATA of each card
// (`requires`, `setup[]`), so they read the same for a bridge of any kind and no engine or tool is
// named here. `update` does not print them: the user did this once, on `init`.

import fs from 'fs';
import path from 'path';
import { BRIDGE_ORDER_SEPARATOR } from '../constants-bridges.js';
import type { DiscoveredServers, McpServerEntry } from '../mcp.js';
import { orderBridges } from './selection.js';

const LINE_INDENT = '  ';
const ACTOR_LABELS: Record<'human' | 'agent-confirmed', string> = {
  human: '[you]',
  'agent-confirmed': '[asks first]',
};
const PROJECT_ROOT_SLOT = '<project-root>';
const UNKNOWN_PROJECT_ROOT = '<your engine project root>';
const ORDER_HINT = 'Set your own with /unikit or in .unikit/config.yaml (engine_bridges.order).';

/** `CLI >= 1.0.0-beta.14; package >= 0.9.1-exp.1; engine >= 6000.0` from the floors the card sets, or `null`. */
function floorText(entry: McpServerEntry): string | null {
  const requires = entry.requires;
  if (!requires) return null;
  const parts = [
    requires.cli === undefined ? null : `CLI >= ${requires.cli}`,
    requires.package === undefined ? null : `package >= ${requires.package}`,
    requires.engineVersion === undefined ? null : `engine >= ${requires.engineVersion}`,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join('; ') : null;
}

/**
 * The slot is filled with the folder `init` runs in only when that folder is the engine project the
 * card describes (its own project file is there); otherwise the user is told to put their own.
 */
function projectRootFor(entry: McpServerEntry, projectRoot: string): string {
  const marker = entry.detect?.projectVersionFile;
  return marker !== undefined && fs.existsSync(path.join(projectRoot, marker)) ? projectRoot : UNKNOWN_PROJECT_ROOT;
}

/**
 * Preparation lines for the selected bridges, in the package order: a header with the floors, then one
 * line per `setup[]` item saying who performs it; with two bridges or more, a closing line about the order.
 */
export function getBridgeSetupLines(discovered: DiscoveredServers, bridgeIds: string[], projectRoot: string): string[] {
  const ordered = orderBridges(discovered, bridgeIds);
  const lines: string[] = [];

  for (const { entry } of ordered) {
    const floors = floorText(entry);
    const setup = entry.setup ?? [];
    if (floors === null && setup.length === 0) continue;

    lines.push(floors === null ? entry.displayName : `${entry.displayName} — requires: ${floors}`);
    const root = projectRootFor(entry, projectRoot);
    for (const item of setup) {
      lines.push(`${LINE_INDENT}${ACTOR_LABELS[item.by]} ${item.run.replaceAll(PROJECT_ROOT_SLOT, root)}`);
    }
  }

  if (ordered.length >= 2) {
    lines.push(`Order: ${ordered.map(bridge => bridge.fileId).join(BRIDGE_ORDER_SEPARATOR)} (package default). ${ORDER_HINT}`);
  }
  return lines;
}
