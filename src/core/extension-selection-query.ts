// Questions asked of an item list and a selection once they exist: what a `--skip-*` name
// resolves to, what turned on or off between two selections, and the per-kind summary.
//
// Pure, like `extension-selection.ts` (which it imports from); split out of it for the
// 500-line ceiling of `src/core/*.ts`.

import {
  EXTENSION_ITEM_KINDS, EXTENSION_KIND_TITLES, EXTENSION_KIND_SINGULAR, EXTENSION_SKIP_FLAGS,
} from './constants.js';
import {
  itemId, itemLabel, isEnabled,
  type ExtensionItem, type ExtensionItemKind, type ExtensionSelection,
} from './extension-selection.js';

export interface SkipFlags {
  skills: readonly string[];
  subagents: readonly string[];
  mcpServers: readonly string[];
}

export type SkipResolution = { ok: true; ids: Set<string> } | { ok: false; error: string };

export interface KindSummary {
  total: number;
  enabled: string[];
  disabled: string[];
  undecided: string[];
}

// --- Flags ---

/**
 * Resolves the names given to `--skip-skills`, `--skip-subagents` and `--skip-mcp` to item ids.
 * A name is an exact manifest path / key, or a unique `name`. The first problem is returned as
 * the only error, before anything is written.
 */
export function resolveSkipFlags(items: readonly ExtensionItem[], flags: SkipFlags): SkipResolution {
  const ids = new Set<string>();

  for (const kind of EXTENSION_ITEM_KINDS) {
    const names = flags[kind].map(name => name.trim()).filter(name => name !== '');
    if (names.length === 0) continue;

    const flag = EXTENSION_SKIP_FLAGS[kind];
    const ofKind = items.filter(item => item.kind === kind);
    if (ofKind.length === 0) {
      return { ok: false, error: `${flag} given, but the extension offers no ${EXTENSION_KIND_TITLES[kind].toLowerCase()}` };
    }

    for (const name of names) {
      const exact = ofKind.find(item => item.key === name);
      if (exact !== undefined) {
        ids.add(itemId(exact));
        continue;
      }

      const byName = ofKind.filter(item => item.name === name);
      const singular = EXTENSION_KIND_SINGULAR[kind];
      if (byName.length === 0) {
        return {
          ok: false,
          error: `Unknown ${singular} "${name}" for ${flag}. Available: ${ofKind.map(itemLabel).join(', ')}`,
        };
      }
      if (byName.length > 1) {
        return {
          ok: false,
          error: `Ambiguous ${singular} "${name}" for ${flag}: matches ${byName.map(item => item.key).join(', ')}. Use the manifest path.`,
        };
      }
      ids.add(itemId(byName[0]!));
    }
  }

  return { ok: true, ids };
}

// --- Difference and summary ---

/** Items that turn off / turn on between two selections (`before` undefined = legacy, all on). */
export function diffSelection(
  items: readonly ExtensionItem[],
  before: ExtensionSelection | undefined,
  after: ExtensionSelection,
): { enable: ExtensionItem[]; disable: ExtensionItem[] } {
  const enable: ExtensionItem[] = [];
  const disable: ExtensionItem[] = [];
  for (const item of items) {
    const was = isEnabled(before, item);
    const now = isEnabled(after, item);
    if (was && !now) disable.push(item);
    else if (!was && now) enable.push(item);
  }

  return { enable, disable };
}

/** Labels per kind split into enabled / disabled / undecided; no selection means all enabled. */
export function summarizeSelection(
  items: readonly ExtensionItem[],
  selection: ExtensionSelection | undefined,
): Record<ExtensionItemKind, KindSummary> {
  const summary: Record<ExtensionItemKind, KindSummary> = {
    skills: { total: 0, enabled: [], disabled: [], undecided: [] },
    subagents: { total: 0, enabled: [], disabled: [], undecided: [] },
    mcpServers: { total: 0, enabled: [], disabled: [], undecided: [] },
  };

  for (const item of items) {
    const bucket = summary[item.kind];
    bucket.total += 1;
    const label = itemLabel(item);
    if (selection === undefined || isEnabled(selection, item)) bucket.enabled.push(label);
    else if (Object.hasOwn(selection[item.kind], item.key)) bucket.disabled.push(label);
    else bucket.undecided.push(label);
  }

  return summary;
}
