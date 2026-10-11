// The one place that decides which items of an extension are on, which are new, and what to
// install or remove. Every call site that reads `skills` / `replaces` / `subagents` /
// `mcpServers` of a manifest for an install or a removal goes through `filterManifest` or
// `manifestSubset` from here.
//
// Pure: no disk, no prompts, no `inquirer`. Runtime imports are `path`, the constants and the
// logger; `ExtensionManifest` is a type-only import because `config.ts` and `extensions.ts`
// import this module (a runtime import back would be a cycle).
//
// The questions asked of a finished selection (`--skip-*` names, difference, summary) live in
// `extension-selection-query.ts`, which imports from here.
//
// Conventions:
//   - an item whose key is absent from the map of its kind is UNDECIDED ("new");
//   - a record without a `selection` field is LEGACY: what is installed counts as enabled;
//   - maps are built with `Object.fromEntries` and read with `Object.hasOwn`, so a key such as
//     `__proto__` from a foreign manifest is kept as an own property.

import path from 'path';
import {
  EXTENSION_ITEM_KINDS, EXTENSION_ITEM_ID_SEPARATOR, EXTENSION_SUBAGENT_FILE_EXTENSION,
  EXTENSION_SELECTION_LOG_COMPONENT,
} from './constants.js';
import { logInfo } from '../utils/log.js';
import type { ExtensionManifest } from './extensions.js';

// --- Types ---

export type ExtensionItemKind = (typeof EXTENSION_ITEM_KINDS)[number];

/** Decisions per kind: manifest path (skills, subagents) or server key (MCP) → enabled. */
export type ExtensionSelection = Record<ExtensionItemKind, Record<string, boolean>>;

export interface ExtensionItem {
  kind: ExtensionItemKind;
  /** Manifest path (skill, subagent) or `key` of the MCP server. */
  key: string;
  /** Directory name of a skill / file name of a subagent without `.md` / MCP server key. */
  name: string;
  /** The skill is also installed under its own name (the key is in `manifest.skills`). True for the other kinds. */
  installsOwn: boolean;
  /** Skill: the base skill this item replaces (the key is in `manifest.replaces`). */
  replaces?: string;
  /** MCP: template path from the manifest. */
  template?: string;
}

export interface NewItemsRequest {
  extension: string;
  version: string;
  sourceDir: string;
  items: readonly ExtensionItem[];
}

/** Asked by core for the decisions on undecided items; the answer maps item id → enabled. */
export type NewItemsChooser = (request: NewItemsRequest) => Promise<ReadonlyMap<string, boolean>>;

export class ExtensionSelectionCancelled extends Error {
  constructor(message = 'Extension selection cancelled') {
    super(message);
    this.name = 'ExtensionSelectionCancelled';
  }
}

export interface DecisionInput {
  items: readonly ExtensionItem[];
  /** Saved decisions of the installed extension; `null` for a first install. */
  prior: ExtensionSelection | null;
  /** Item ids named by `--skip-*`. */
  skip: ReadonlySet<string>;
  installNew: boolean;
  skipNew: boolean;
}

// --- Small helpers ---

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSubagentFile(key: string): boolean {
  return path.basename(key).endsWith(EXTENSION_SUBAGENT_FILE_EXTENSION);
}

function mapOf(selection: ExtensionSelection, kind: ExtensionItemKind): Record<string, boolean> {
  return selection[kind];
}

/** Builds a selection from one `[key, enabled]` list per kind. */
function selectionFromEntries(
  entries: Record<ExtensionItemKind, [string, boolean][]>,
): ExtensionSelection {
  return {
    skills: Object.fromEntries(entries.skills),
    subagents: Object.fromEntries(entries.subagents),
    mcpServers: Object.fromEntries(entries.mcpServers),
  };
}

function emptyEntries(): Record<ExtensionItemKind, [string, boolean][]> {
  return { skills: [], subagents: [], mcpServers: [] };
}

// --- Items ---

/** @public A selection with no decision at all — every item undecided (used by the unit tests). */
export function emptySelection(): ExtensionSelection {
  return { skills: {}, subagents: {}, mcpServers: {} };
}

export function itemId(item: Pick<ExtensionItem, 'kind' | 'key'>): string {
  return `${item.kind}${EXTENSION_ITEM_ID_SEPARATOR}${item.key}`;
}

export function itemLabel(item: ExtensionItem): string {
  if (item.kind !== 'skills' || item.replaces === undefined) return item.name;
  if (!item.installsOwn) return `${item.name} → ${item.replaces}`;

  return `${item.name} (+ ${item.replaces})`;
}

/**
 * The universe of items a manifest offers: skills (own, then replacement-only), subagents, MCP
 * servers. A path in both `skills` and `replaces` is ONE item; a repeated key is listed once; a
 * `subagents` entry that is not a markdown file is not an item (the installer ignores it).
 */
export function listExtensionItems(manifest: ExtensionManifest): ExtensionItem[] {
  const items: ExtensionItem[] = [];
  const replaces = manifest.replaces;
  const replacementOf = (key: string): string | undefined =>
    replaces !== undefined && Object.hasOwn(replaces, key) ? replaces[key] : undefined;

  const seenSkills = new Set<string>();
  for (const key of manifest.skills ?? []) {
    if (seenSkills.has(key)) continue;
    seenSkills.add(key);
    items.push({
      kind: 'skills', key, name: path.basename(key), installsOwn: true, replaces: replacementOf(key),
    });
  }
  for (const key of Object.keys(replaces ?? {})) {
    if (seenSkills.has(key)) continue;
    seenSkills.add(key);
    items.push({
      kind: 'skills', key, name: path.basename(key), installsOwn: false, replaces: replacementOf(key),
    });
  }

  const seenSubagents = new Set<string>();
  for (const key of manifest.subagents ?? []) {
    if (seenSubagents.has(key) || !isSubagentFile(key)) continue;
    seenSubagents.add(key);
    items.push({
      kind: 'subagents',
      key,
      name: path.basename(key, EXTENSION_SUBAGENT_FILE_EXTENSION),
      installsOwn: true,
    });
  }

  const seenServers = new Set<string>();
  for (const server of manifest.mcpServers ?? []) {
    if (seenServers.has(server.key)) continue;
    seenServers.add(server.key);
    items.push({
      kind: 'mcpServers', key: server.key, name: server.key, installsOwn: true, template: server.template,
    });
  }

  return items;
}

// --- Reading and normalizing a stored selection ---

/**
 * Reads a stored value as a selection. Anything that is not an object with at least one object
 * map is "no selection"; inside the maps only boolean values survive.
 */
export function normalizeSelection(raw: unknown): ExtensionSelection | undefined {
  if (!isPlainObject(raw)) return undefined;

  const entries = emptyEntries();
  let any = false;
  for (const kind of EXTENSION_ITEM_KINDS) {
    const map = raw[kind];
    if (!isPlainObject(map)) continue;
    any = true;
    for (const [key, value] of Object.entries(map)) {
      if (typeof value === 'boolean') entries[kind].push([key, value]);
    }
  }

  return any ? selectionFromEntries(entries) : undefined;
}

export function allEnabled(items: readonly ExtensionItem[]): ExtensionSelection {
  const entries = emptyEntries();
  for (const item of items) entries[item.kind].push([item.key, true]);

  return selectionFromEntries(entries);
}

/** A legacy record (`selection === undefined`) counts everything installed as enabled. */
export function isEnabled(
  selection: ExtensionSelection | undefined,
  item: Pick<ExtensionItem, 'kind' | 'key'>,
): boolean {
  if (selection === undefined) return true;
  const map = mapOf(selection, item.kind);

  return Object.hasOwn(map, item.key) && map[item.key] === true;
}

/** Items the selection has no decision for. */
export function pendingItems(
  items: readonly ExtensionItem[],
  selection: ExtensionSelection,
): ExtensionItem[] {
  return items.filter(item => !Object.hasOwn(mapOf(selection, item.kind), item.key));
}

/**
 * The decisions the installed extension carries into a new run: `null` for a first install
 * (nothing recorded), the saved selection, or — for a legacy record — "everything the previous
 * manifest on disk offered is on". A legacy record with no previous manifest cannot tell old
 * items from new ones and reads as a first install (everything is installed, as before).
 */
export function priorSelectionOf(
  record: { selection?: unknown } | undefined,
  previousManifest: ExtensionManifest | null,
): ExtensionSelection | null {
  if (record === undefined) {
    logInfo(EXTENSION_SELECTION_LOG_COMPONENT, 'prior selection: first install');

    return null;
  }

  const saved = normalizeSelection(record.selection);
  if (saved !== undefined) {
    logInfo(EXTENSION_SELECTION_LOG_COMPONENT, 'prior selection: saved selection');

    return saved;
  }

  if (previousManifest !== null) {
    logInfo(EXTENSION_SELECTION_LOG_COMPONENT, 'prior selection: legacy record, previous manifest items are on');

    return allEnabled(listExtensionItems(previousManifest));
  }

  logInfo(EXTENSION_SELECTION_LOG_COMPONENT, 'prior selection: legacy record without a previous manifest, read as first install');

  return null;
}

/** Keeps only the decisions whose key is an item of the given list; key order follows `items`. */
export function normalizeToItems(
  selection: ExtensionSelection,
  items: readonly ExtensionItem[],
): ExtensionSelection {
  const entries = emptyEntries();
  for (const item of items) {
    const map = mapOf(selection, item.kind);
    if (Object.hasOwn(map, item.key)) entries[item.kind].push([item.key, map[item.key]!]);
  }

  return selectionFromEntries(entries);
}

// --- Deciding ---

function countEnabled(selection: ExtensionSelection, items: readonly ExtensionItem[], kind: ExtensionItemKind): string {
  const ofKind = items.filter(item => item.kind === kind);
  const on = ofKind.filter(item => isEnabled(selection, item)).length;

  return `${on}/${ofKind.length}`;
}

/**
 * Turns flags and saved decisions into the selection of one run. Order of the checks matters:
 * a name given to `--skip-*` is off whatever else is set; a first install turns everything else
 * on and ignores `--install-new`/`--skip-new`; a saved decision is never changed by a flag;
 * only an undecided item is affected by `--skip-new` (stays undecided, wins over
 * `--install-new`) and `--install-new` (on). Without either the item stays undecided.
 */
export function decideSelection(input: DecisionInput): ExtensionSelection {
  const { items, prior, skip, installNew, skipNew } = input;
  const entries = emptyEntries();

  for (const item of items) {
    const id = itemId(item);
    const previous = prior !== null && Object.hasOwn(mapOf(prior, item.kind), item.key)
      ? mapOf(prior, item.kind)[item.key]
      : undefined;

    let value: boolean | undefined;
    if (skip.has(id)) value = false;
    else if (prior === null) value = true;
    else if (previous !== undefined) value = previous;
    else if (skipNew) value = undefined;
    else if (installNew) value = true;
    else value = undefined;

    if (value !== undefined) entries[item.kind].push([item.key, value]);
  }

  const result = selectionFromEntries(entries);
  const undecided = pendingItems(items, result).length;
  logInfo(
    EXTENSION_SELECTION_LOG_COMPONENT,
    `decided (${prior === null ? 'first install' : 'installed'}): `
    + `${EXTENSION_ITEM_KINDS.map(kind => `${kind} ${countEnabled(result, items, kind)}`).join(', ')}, undecided ${undecided}`,
  );

  return result;
}

/** Every listed item is decided: on when its id is in `checked`. */
export function selectionFromChecked(
  items: readonly ExtensionItem[],
  checked: ReadonlySet<string>,
): ExtensionSelection {
  const entries = emptyEntries();
  for (const item of items) entries[item.kind].push([item.key, checked.has(itemId(item))]);

  return selectionFromEntries(entries);
}

/** The prior decisions narrowed to `items`, with `decisions` (item id → enabled) laid over them. */
export function applyDecisions(
  items: readonly ExtensionItem[],
  prior: ExtensionSelection,
  decisions: ReadonlyMap<string, boolean>,
): ExtensionSelection {
  const entries = emptyEntries();
  for (const item of items) {
    const id = itemId(item);
    const map = mapOf(prior, item.kind);
    if (decisions.has(id)) entries[item.kind].push([item.key, decisions.get(id)!]);
    else if (Object.hasOwn(map, item.key)) entries[item.kind].push([item.key, map[item.key]!]);
  }

  return selectionFromEntries(entries);
}

// --- Manifest views ---

/**
 * The manifest narrowed to the enabled items; `injections`, `commands` and the identity fields
 * are untouched. With no selection (a legacy record) it is the same object.
 */
export function filterManifest(
  manifest: ExtensionManifest,
  selection: ExtensionSelection | undefined,
): ExtensionManifest {
  if (selection === undefined) return manifest;

  const on = (kind: ExtensionItemKind, key: string): boolean => isEnabled(selection, { kind, key });
  const narrowed: ExtensionManifest = { ...manifest };

  if (manifest.skills !== undefined) {
    narrowed.skills = manifest.skills.filter(key => on('skills', key));
  }
  if (manifest.replaces !== undefined) {
    narrowed.replaces = Object.fromEntries(
      Object.entries(manifest.replaces).filter(([key]) => on('skills', key)),
    );
  }
  if (manifest.subagents !== undefined) {
    narrowed.subagents = manifest.subagents.filter(key => isSubagentFile(key) && on('subagents', key));
  }
  if (manifest.mcpServers !== undefined) {
    narrowed.mcpServers = manifest.mcpServers.filter(server => on('mcpServers', server.key));
  }

  return narrowed;
}

/**
 * The manifest narrowed to exactly the given items, without `injections` and `commands`: the
 * view used to apply a DIFFERENCE, where removing by it must not erase the extension's injections.
 */
export function manifestSubset(
  manifest: ExtensionManifest,
  items: readonly ExtensionItem[],
): ExtensionManifest {
  const entries = emptyEntries();
  for (const item of items) entries[item.kind].push([item.key, true]);

  return {
    ...filterManifest(manifest, selectionFromEntries(entries)),
    injections: undefined,
    commands: undefined,
  };
}

/** `base skill name → replacement path` for the enabled replacements; `undefined` when none. */
export function deriveReplacedSkills(
  manifest: ExtensionManifest,
  selection: ExtensionSelection | undefined,
): Record<string, string> | undefined {
  const replaces = filterManifest(manifest, selection).replaces;
  if (replaces === undefined) return undefined;

  const pairs = Object.entries(replaces);
  if (pairs.length === 0) return undefined;

  return Object.fromEntries(pairs.map(([skillPath, baseName]) => [baseName, skillPath]));
}

/**
 * Names under which the extension would install its OWN skills / subagents that are off or
 * undecided. A name an enabled item of the same kind also installs is not listed (same name
 * under different directories). Replacements are not listed: the base skill is restored.
 */
export function disabledOwnTargets(
  manifest: ExtensionManifest,
  selection: ExtensionSelection | undefined,
): { skills: Set<string>; subagents: Set<string> } {
  const result = { skills: new Set<string>(), subagents: new Set<string>() };
  if (selection === undefined) return result;

  const items = listExtensionItems(manifest);
  for (const kind of ['skills', 'subagents'] as const) {
    const own = items.filter(item => item.kind === kind && item.installsOwn);
    const enabledNames = new Set(own.filter(item => isEnabled(selection, item)).map(item => item.name));
    for (const item of own) {
      if (!isEnabled(selection, item) && !enabledNames.has(item.name)) result[kind].add(item.name);
    }
  }

  return result;
}
