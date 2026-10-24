// The selection menu and the text the extension commands print about a selection.
//
// The rows, the summary and the notices are pure functions (testable without a terminal); the
// two prompts are thin wrappers around `inquirer`, loaded lazily — it is ~240 ms of module graph
// and only a run that really asks pays for it. The decision whether to ask at all is the
// command's (`shouldShowMenu`), never made here.

import {
  EXTENSION_ITEM_KINDS, EXTENSION_KIND_TITLES, EXTENSION_MENU_PAGE_SIZE,
  EXTENSION_CANCEL_MESSAGE_MARKER, EXTENSION_SELECTION_LOG_COMPONENT,
  EXTENSION_MENU_SECTION_PREFIX, EXTENSION_MENU_SECTION_SUFFIX, EXTENSION_MENU_DESCRIPTION_SEPARATOR,
  EXTENSION_MENU_QUESTION_HINT, EXTENSION_NEW_ITEMS_QUESTION_HINT,
  EXTENSION_SUMMARY_SKIPPED_PREFIX, EXTENSION_SUMMARY_UNDECIDED_PREFIX,
  EXTENSION_NOTICE_MARK, EXTENSION_NOTICE_UNDECIDED, EXTENSION_NOTICE_ITEM_SEPARATOR,
} from '../../core/constants.js';
import {
  itemId, ExtensionSelectionCancelled,
  type ExtensionItem, type ExtensionSelection, type NewItemsChooser, type NewItemsRequest,
} from '../../core/extension-selection.js';
import { summarizeSelection } from '../../core/extension-selection-query.js';
import {
  describeExtensionItems, sanitizeDisplayText, type ExtensionItemView,
} from '../../core/extension-selection-describe.js';
import type { PendingExtensionItems } from '../../core/extension-refresh.js';
import { logInfo } from '../../utils/log.js';
import { isInteractive } from './extension-options.js';

export type MenuRow =
  | { type: 'separator'; text: string }
  | { type: 'item'; id: string; name: string; checked: boolean; disabled?: string };

/**
 * One section per kind that has rows, in the order of `EXTENSION_ITEM_KINDS`. An item is checked
 * unless the prior decision turned it off or it cannot be installed; an undecided item is checked.
 */
export function buildMenuRows(
  views: readonly ExtensionItemView[],
  prior: ExtensionSelection | null,
): MenuRow[] {
  const rows: MenuRow[] = [];

  for (const kind of EXTENSION_ITEM_KINDS) {
    const ofKind = views.filter(view => view.kind === kind);
    if (ofKind.length === 0) continue;

    rows.push({
      type: 'separator',
      text: `${EXTENSION_MENU_SECTION_PREFIX}${EXTENSION_KIND_TITLES[kind]}${EXTENSION_MENU_SECTION_SUFFIX}`,
    });
    for (const view of ofKind) {
      const decided = prior !== null && Object.hasOwn(prior[kind], view.key);
      const row: MenuRow = {
        type: 'item',
        id: view.id,
        name: view.description === undefined ? view.label : `${view.label}${EXTENSION_MENU_DESCRIPTION_SEPARATOR}${view.description}`,
        checked: view.unusable !== undefined ? false : decided ? prior![kind][view.key] === true : true,
      };
      if (view.unusable !== undefined) row.disabled = view.unusable;
      rows.push(row);
    }
  }

  return rows;
}

/** One line per kind that has items: `Skills: 3 of 5 — skipped: a, b — not installed (undecided): c`. */
export function formatSelectionSummary(
  items: readonly ExtensionItem[],
  selection: ExtensionSelection | undefined,
): string[] {
  const summary = summarizeSelection(items, selection);
  const clean = (labels: readonly string[]): string => labels.map(label => sanitizeDisplayText(label)).join(', ');
  const lines: string[] = [];

  for (const kind of EXTENSION_ITEM_KINDS) {
    const bucket = summary[kind];
    if (bucket.total === 0) continue;

    let line = `${EXTENSION_KIND_TITLES[kind]}: ${bucket.enabled.length} of ${bucket.total}`;
    if (bucket.disabled.length > 0) line += `${EXTENSION_SUMMARY_SKIPPED_PREFIX}${clean(bucket.disabled)}`;
    if (bucket.undecided.length > 0) line += `${EXTENSION_SUMMARY_UNDECIDED_PREFIX}${clean(bucket.undecided)}`;
    lines.push(line);
  }

  return lines;
}

/** One warning line per extension that still has undecided items. */
export function formatPendingNotice(pending: readonly PendingExtensionItems[]): string[] {
  return pending.map(entry => (
    `${EXTENSION_NOTICE_MARK} ${sanitizeDisplayText(entry.extension)}: ${EXTENSION_NOTICE_UNDECIDED}`
    + `${entry.items.map(item => sanitizeDisplayText(item)).join(EXTENSION_NOTICE_ITEM_SEPARATOR)}. `
    + `Run "unikit-ai extension select ${sanitizeDisplayText(entry.extension)}" in a terminal, or pass --install-new.`
  ));
}

function isCancellation(error: unknown): boolean {
  return error instanceof Error && error.message.includes(EXTENSION_CANCEL_MESSAGE_MARKER);
}

type CheckboxChoice = { name: string; value: string; checked: boolean; disabled?: string };

async function promptCheckbox(
  message: string,
  rows: readonly MenuRow[],
): Promise<Set<string>> {
  const { default: inquirer } = await import('inquirer');
  const choices = rows.map(row => {
    if (row.type === 'separator') return new inquirer.Separator(row.text);
    const choice: CheckboxChoice = { name: row.name, value: row.id, checked: row.checked };
    if (row.disabled !== undefined) choice.disabled = row.disabled;

    return choice;
  });

  try {
    const { chosen } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'chosen',
        message,
        choices,
        pageSize: EXTENSION_MENU_PAGE_SIZE,
      },
    ]);

    return new Set(chosen as string[]);
  } catch (error) {
    if (isCancellation(error)) throw new ExtensionSelectionCancelled();
    throw error;
  }
}

/**
 * The full menu of an extension: everything the version offers, the earlier decisions pre-set,
 * new items checked. An empty answer is allowed — the extension then stays installed with none
 * of these items. Returns the ids of the checked items.
 */
export async function promptExtensionMenu(args: {
  name: string;
  version: string;
  views: ExtensionItemView[];
  prior: ExtensionSelection | null;
}): Promise<Set<string>> {
  const rows = buildMenuRows(args.views, args.prior);
  const checked = rows.filter(row => row.type === 'item' && row.checked).length;
  logInfo(EXTENSION_SELECTION_LOG_COMPONENT, `menu: ${args.views.length} item(s), ${checked} checked`);

  return promptCheckbox(
    `Select what to install from "${sanitizeDisplayText(args.name)}" ${sanitizeDisplayText(args.version)} `
    + EXTENSION_MENU_QUESTION_HINT,
    rows,
  );
}

/**
 * The chooser `update` and `extension update` hand to the core. `--skip-new` answers nothing,
 * `--install-new` answers yes to every item, no terminal answers nothing; otherwise it asks, with
 * everything checked, and an unchecked item is remembered as "off" (the user said no).
 */
export function buildNewItemsChooser(
  options: { installNew?: boolean; skipNew?: boolean },
  deps: { interactive: () => boolean } = { interactive: isInteractive },
): NewItemsChooser {
  return async (request: NewItemsRequest): Promise<ReadonlyMap<string, boolean>> => {
    if (options.skipNew) return new Map();
    if (options.installNew) return new Map(request.items.map(item => [itemId(item), true] as const));
    if (!deps.interactive()) return new Map();

    const views = await describeExtensionItems(request.sourceDir, request.items);
    const rows = buildMenuRows(views, null);
    const chosen = await promptCheckbox(
      `New items in "${sanitizeDisplayText(request.extension)}" ${sanitizeDisplayText(request.version)}. `
      + EXTENSION_NEW_ITEMS_QUESTION_HINT,
      rows,
    );

    return new Map(request.items.map(item => [itemId(item), chosen.has(itemId(item))] as const));
  };
}
