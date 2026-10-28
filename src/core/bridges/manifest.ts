// --- BRIDGES.md renderer ---
//
// `.unikit/system/engine-bridges/BRIDGES.md` is what the skills read instead of grepping the agent's
// settings file for a server name (DEC-5): the SET of selected bridges, the default order of the
// package, and one block per bridge. It is Markdown tables wherever a line is a name and a value:
// a table of the default order, a `field | value` table per bridge, a `who | what to do` table for the
// preparation, a table of the bridges not selected. A pure function of its input — same input, same
// text — so it can be checked without a disk, and a delivered file is byte-identical between runs
// while nothing changed.
//
// It carries NOTHING the user chose beyond the set: the order the user picked lives in
// `.unikit/bridges.yaml`, and the routing rules in `.unikit/bridge-routing.md`; this file only points
// at them. Putting either here would put it into an installed text, and a reorder would then have to
// reinstall.

import type { McpServerEntry } from '../mcp.js';
import { CODE_MODULE_ID, MCP_RULES_INDEX_FILE, MEMORY_DIR_NAME, SYSTEM_DIR_NAME, UNIKIT_DIR } from '../constants.js';
import {
  BRIDGE_NOTES_DIR_NAME, BRIDGE_NOTES_EXTENSION, BRIDGE_ORDER_FILE, BRIDGE_ROUTING_FILE, BRIDGE_RULE_TIER, BRIDGE_VERIFICATION_FILE,
  BRIDGES_MANIFEST_HEADER, ENGINE_BRIDGES_DIR_NAME, NOT_SELECTED_HEADING,
} from '../constants-bridges.js';
import { getBridgeAdapter } from './adapter.js';
import type { BridgeSetupLine } from './types.js';

export interface ManifestBridge {
  fileId: string;
  entry: McpServerEntry;
  /** Whether a rules tree was delivered for this bridge. */
  hasRulesTree: boolean;
}

export interface ManifestInput {
  engineId: string;
  /** Already in PACKAGE order (`orderBridges`). */
  bridges: ManifestBridge[];
  /** Bridges of the catalog that the project did not select, in package order. */
  unselected: Array<{ fileId: string; entry: McpServerEntry }>;
  /** Project-relative MCP settings files of the agents of this project, each once, in agent order; none when omitted. */
  settingsFiles?: string[];
}

const NO_RULES = 'none';
const GUIDE_ROW_NOTE = '(the stack rule of this bridge, when it is installed)';
const NOTES_LABEL = 'Notes:';
const SETUP_LABEL = 'Setup:';
const DEFAULT_ORDER_LABEL = 'default order:';
const FIELD_TABLE_HEADER = ['field', 'value'];
const ORDER_TABLE_HEADER = ['#', 'bridge', 'kind'];
const SETUP_TABLE_HEADER = ['who', 'what to do'];
const NOT_SELECTED_TABLE_HEADER = ['bridge', 'name', 'probe'];
/** Who performs a preparation line: the words the readers of BRIDGES.md rely on. */
const SETUP_WHO: Record<BridgeSetupLine['by'], string> = { human: 'human', 'agent-confirmed': 'agent, confirm first' };

/** Project-relative path with forward slashes: BRIDGES.md is text for agents on every platform. */
function posixPath(...segments: string[]): string {
  return segments.join('/');
}

/** Static text: it does not depend on what the order file holds or whether the routing file exists (NFR-1). */
const ORDER_POINTER_LINE = `order: ${posixPath(UNIKIT_DIR, BRIDGE_ORDER_FILE)} - kept by unikit-ai init and update (edit the list to reorder); a missing file means the default order above`;
const ROUTING_POINTER_LINE = `routing: ${posixPath(UNIKIT_DIR, BRIDGE_ROUTING_FILE)} - optional rules per case, written by /unikit-bridge-route; a row decides only the steps of its own area, every other step follows the order; a missing file means no routing rules`;

/** One table cell: a pipe would end it and a line break would end the row. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ').trim();
}

function tableRow(cells: string[]): string {
  return `| ${cells.map(cell).join(' | ')} |`;
}

/** A GitHub-flavoured Markdown table: the header, the rule under it, the rows. */
function table(header: string[], rows: string[][]): string[] {
  return [tableRow(header), `|${header.map(() => '---').join('|')}|`, ...rows.map(tableRow)];
}

function setupRows(entry: McpServerEntry): string[][] {
  if (entry.setup && entry.setup.length > 0) {
    return entry.setup.map(line => [SETUP_WHO[line.by], line.run]);
  }
  return entry.docs?.repo ? [[SETUP_WHO.human, `see ${entry.docs.repo}`]] : [];
}

function bridgeBlock(bridge: ManifestBridge, settingsFiles: string[]): string[] {
  const { fileId, entry, hasRulesTree } = bridge;
  const treeDir = posixPath(UNIKIT_DIR, SYSTEM_DIR_NAME, ENGINE_BRIDGES_DIR_NAME, fileId);
  const parts = getBridgeAdapter(entry.kind).describe({ fileId, entry, settingsFiles });
  const rows: string[][] = [
    ...parts.rows,
    ['rules', hasRulesTree ? posixPath(treeDir, MCP_RULES_INDEX_FILE) : NO_RULES],
    ['verification', hasRulesTree ? posixPath(treeDir, BRIDGE_VERIFICATION_FILE) : NO_RULES],
    ['guide', `${posixPath(UNIKIT_DIR, MEMORY_DIR_NAME, CODE_MODULE_ID, BRIDGE_RULE_TIER, `${fileId}.md`)} ${GUIDE_ROW_NOTE}`],
    ['notes', posixPath(UNIKIT_DIR, BRIDGE_NOTES_DIR_NAME, `${fileId}${BRIDGE_NOTES_EXTENSION}`)],
    ...(entry.docs?.context7 ? [['context7', entry.docs.context7]] : []),
  ];

  const lines = [`## ${fileId}`, '', ...table(FIELD_TABLE_HEADER, rows)];
  if (parts.notes.length > 0) lines.push('', NOTES_LABEL, ...parts.notes.map(note => `- ${note}`));
  const setup = setupRows(entry);
  if (setup.length > 0) lines.push('', SETUP_LABEL, '', ...table(SETUP_TABLE_HEADER, setup));
  return lines;
}

/**
 * The bridges the project did not select that can be told apart on this machine by a probe. `/unikit`
 * runs the probe and, when the bridge answers, asks the user to re-run `init` and tick it (Q12).
 * Empty when no unselected bridge has a probe: a section with nothing in it would only be noise.
 */
function notSelectedBlock(input: ManifestInput): string[] {
  const rows = input.unselected.flatMap(({ fileId, entry }) => {
    const probe = getBridgeAdapter(entry.kind).probeLine(entry);
    return probe === null ? [] : [[fileId, entry.displayName, `\`${probe}\``]];
  });
  return rows.length > 0 ? [`## ${NOT_SELECTED_HEADING}`, '', ...table(NOT_SELECTED_TABLE_HEADER, rows)] : [];
}

export function renderBridgesManifest(input: ManifestInput): string {
  const settingsFiles = input.settingsFiles ?? [];
  const sections: string[][] = [
    [
      BRIDGES_MANIFEST_HEADER,
      '# Engine bridges',
      '',
      `engine: ${input.engineId}`,
      DEFAULT_ORDER_LABEL,
      '',
      ...table(ORDER_TABLE_HEADER, input.bridges.map((bridge, index) => [String(index + 1), bridge.fileId, bridge.entry.kind])),
      '',
      ORDER_POINTER_LINE,
      '',
      ROUTING_POINTER_LINE,
    ],
    ...input.bridges.map(bridge => bridgeBlock(bridge, settingsFiles)),
  ];
  const notSelected = notSelectedBlock(input);
  if (notSelected.length > 0) sections.push(notSelected);

  return `${sections.map(section => section.join('\n')).join('\n\n')}\n`;
}
