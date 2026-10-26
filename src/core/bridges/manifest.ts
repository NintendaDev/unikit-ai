// --- BRIDGES.md renderer ---
//
// `.unikit/system/engine-bridges/BRIDGES.md` is what the skills read instead of grepping the agent's
// settings file for a server name (DEC-5): the SET of selected bridges, the default order of the
// package, and one block per bridge. A pure function of its input — same input, same text — so it can
// be checked without a disk, and a delivered file is byte-identical between runs while nothing changed.
//
// It carries NOTHING the user chose beyond the set: the order the user picked lives in
// `.unikit/config.yaml` (`engine_bridges.order`), which the installer never reads. Putting it here
// would put it into an installed text, and a reorder would then have to reinstall.

import type { McpServerEntry } from '../mcp.js';
import { MCP_RULES_INDEX_FILE, SYSTEM_DIR_NAME, UNIKIT_DIR } from '../constants.js';
import {
  BRIDGE_NOTES_DIR_NAME, BRIDGE_NOTES_EXTENSION, BRIDGE_REFERENCES_DIR, BRIDGE_VERIFICATION_FILE,
  BRIDGE_ORDER_SEPARATOR, BRIDGES_MANIFEST_HEADER, ENGINE_BRIDGES_DIR_NAME, ENGINE_DOCS_HEADING, ENGINE_REFERENCES_DIR_NAME,
  NOT_SELECTED_HEADING,
} from '../constants-bridges.js';
import { getBridgeAdapter } from './adapter.js';
import type { DocsSource } from './types.js';

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
  engineDocSources: DocsSource[];
  engineContext7: string[];
  /** Bridges of the catalog that the project did not select, in package order. */
  unselected: Array<{ fileId: string; entry: McpServerEntry }>;
}

const NO_RULES = 'none';
const DOCS_SOURCES_LABEL = '- docs sources:';

/** Project-relative path with forward slashes: BRIDGES.md is text for agents on every platform. */
function posixPath(...segments: string[]): string {
  return segments.join('/');
}

function jsonBlock(value: unknown): string[] {
  return ['```json', JSON.stringify(value, null, 2), '```'];
}

function setupLines(entry: McpServerEntry): string[] {
  if (entry.setup && entry.setup.length > 0) {
    return entry.setup.map(line => (line.by === 'human'
      ? `- setup (human): ${line.run}`
      : `- setup (agent, confirm first): ${line.run}`));
  }
  return entry.docs?.repo ? [`- setup: see ${entry.docs.repo}`] : [];
}

function bridgeBlock(bridge: ManifestBridge): string[] {
  const { fileId, entry, hasRulesTree } = bridge;
  const treeDir = posixPath(UNIKIT_DIR, SYSTEM_DIR_NAME, ENGINE_BRIDGES_DIR_NAME, fileId);
  const lines = [
    `## ${fileId}`,
    ...getBridgeAdapter(entry.kind).describe({ fileId, entry }),
    `- rules: ${hasRulesTree ? posixPath(treeDir, MCP_RULES_INDEX_FILE) : NO_RULES}`,
    `- verification: ${hasRulesTree ? posixPath(treeDir, BRIDGE_VERIFICATION_FILE) : NO_RULES}`,
    `- notes: ${posixPath(UNIKIT_DIR, BRIDGE_NOTES_DIR_NAME, `${fileId}${BRIDGE_NOTES_EXTENSION}`)}`,
    `- docs: ${posixPath(UNIKIT_DIR, BRIDGE_REFERENCES_DIR, fileId)}/`,
  ];
  if (entry.docs?.context7) lines.push(`- context7: ${entry.docs.context7}`);
  lines.push(...setupLines(entry));
  if (entry.docs?.sources && entry.docs.sources.length > 0) {
    lines.push(DOCS_SOURCES_LABEL, ...jsonBlock(entry.docs.sources));
  }
  return lines;
}

function engineBlock(input: ManifestInput): string[] {
  if (input.engineDocSources.length === 0 && input.engineContext7.length === 0) return [];

  const lines = [
    `## ${ENGINE_DOCS_HEADING}`,
    `- docs: ${posixPath(UNIKIT_DIR, BRIDGE_REFERENCES_DIR, ENGINE_REFERENCES_DIR_NAME)}/`,
  ];
  if (input.engineContext7.length > 0) lines.push(`- context7: ${input.engineContext7.join(', ')}`);
  if (input.engineDocSources.length > 0) lines.push(DOCS_SOURCES_LABEL, ...jsonBlock(input.engineDocSources));
  return lines;
}

/**
 * The bridges the project did not select that can be told apart on this machine by a probe. `/unikit`
 * runs the probe and, when the bridge answers, asks the user to re-run `init` and tick it (Q12).
 * Empty when no unselected bridge has a probe: a section with nothing in it would only be noise.
 */
function notSelectedBlock(input: ManifestInput): string[] {
  const lines = input.unselected.flatMap(({ fileId, entry }) => {
    const probe = getBridgeAdapter(entry.kind).probeLine(entry);
    return probe === null ? [] : [`- ${fileId} - ${entry.displayName} - ${probe}`];
  });
  return lines.length > 0 ? [`## ${NOT_SELECTED_HEADING}`, ...lines] : [];
}

export function renderBridgesManifest(input: ManifestInput): string {
  const sections: string[][] = [
    [
      BRIDGES_MANIFEST_HEADER,
      '# Engine bridges',
      '',
      `engine: ${input.engineId}`,
      `default order: ${input.bridges.map(bridge => bridge.fileId).join(BRIDGE_ORDER_SEPARATOR)}`,
      'user order: the list under engine_bridges.order in .unikit/config.yaml (ids from the blocks below); a missing or empty list means the default order',
    ],
    ...input.bridges.map(bridgeBlock),
  ];
  const notSelected = notSelectedBlock(input);
  if (notSelected.length > 0) sections.push(notSelected);
  const engine = engineBlock(input);
  if (engine.length > 0) sections.push(engine);

  return `${sections.map(section => section.join('\n')).join('\n\n')}\n`;
}
