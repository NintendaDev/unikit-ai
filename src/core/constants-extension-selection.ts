// Extension item selection: the kinds of items an extension offers, their titles, the flag names
// that switch them off, and the limits of the selection menu.
//
// Split out of `constants.ts` for the same mechanical reason as `constants-extension-points.ts`:
// that file sits at the Part 7i ceiling (`SIZE_LIMIT=500` over `src/core/*.ts`). `constants.ts`
// re-exports this module, so call sites keep one import path.
//
// The golden-guard #1 Part C exclusion is by FILE NAME (`constants\.ts|modules\.ts`) and
// `constants-extension-selection.ts` does not match it — no module id, tier path or modules
// registry file name may live here, for the reason `constants-artifacts.ts` spells out.

import { SUBAGENT_SKILLS_FIELD } from './constants-transform.js';

/**
 * The kinds of item an extension offers a user to switch on or off. The array is the one list of
 * kinds: its elements are the keys of `ExtensionRecord.selection`, and its order is the order of
 * the menu sections and of the summary.
 */
export const EXTENSION_ITEM_KINDS = ['skills', 'subagents', 'mcpServers'] as const;

/** Section titles of the selection menu and the summary, one per kind. */
export const EXTENSION_KIND_TITLES = {
  skills: 'Skills',
  subagents: 'Subagents',
  mcpServers: 'MCP servers',
} as const;

/** Singular noun per kind, for messages that name one item. */
export const EXTENSION_KIND_SINGULAR = {
  skills: 'skill',
  subagents: 'subagent',
  mcpServers: 'MCP server',
} as const;

/** The flag that switches items of a kind off, per kind. */
export const EXTENSION_SKIP_FLAGS = {
  skills: '--skip-skills',
  subagents: '--skip-subagents',
  mcpServers: '--skip-mcp',
} as const;

/** An item id is `<kind><separator><key>`; the key of a skill or subagent is a manifest path. */
export const EXTENSION_ITEM_ID_SEPARATOR = ':';

/** Separator of the names given to one `--skip-*` flag. */
export const EXTENSION_FLAG_LIST_SEPARATOR = ',';

/** A subagent file is a markdown file; the installer ignores any other `subagents` entry. */
export const EXTENSION_SUBAGENT_FILE_EXTENSION = '.md';

/** Rows of the selection menu shown at once. */
export const EXTENSION_MENU_PAGE_SIZE = 15;

/** Longest description shown next to an item in the menu, ellipsis included. */
export const EXTENSION_MENU_TEXT_MAX_LENGTH = 100;

/** Appended to a description cut at {@link EXTENSION_MENU_TEXT_MAX_LENGTH}. */
export const EXTENSION_MENU_ELLIPSIS = '…';

/** Text `inquirer` puts in the error it throws when the user closes a prompt (Ctrl+C). */
export const EXTENSION_CANCEL_MESSAGE_MARKER = 'User force closed';

/** Log component of the extension commands. */
export const EXTENSION_LOG_COMPONENT = 'extension';

/** Log component of the selection resolver. */
export const EXTENSION_SELECTION_LOG_COMPONENT = 'extension-selection';

// --- Reading the frontmatter of a skill or subagent file (item descriptions, preloads) ---

/** The line that opens and closes a frontmatter block. */
export const EXTENSION_FRONTMATTER_FENCE = '---';

/** The field a description is read from. */
export const EXTENSION_FRONTMATTER_DESCRIPTION_FIELD = 'description:';

/** The field a subagent lists the skills it preloads in (with its colon). */
export const EXTENSION_FRONTMATTER_SKILLS_FIELD = `${SUBAGENT_SKILLS_FIELD}:`;

/** A YAML block-scalar indicator after `description:`: `>`, `>-`, `|`, `|2`, `>+1`... */
export const EXTENSION_BLOCK_SCALAR_INDICATOR = /^[>|](?:[+-]?\d?|\d[+-]?)$/;

/** One `- name` line of a block list. */
export const EXTENSION_BLOCK_LIST_ITEM = /^\s*-\s*(.+?)\s*$/;

/**
 * Control characters, ESC included, that must not reach a terminal from a foreign file. Built
 * from a string: a control-character class written as a literal trips `no-control-regex`.
 */
export const EXTENSION_CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');

/** A run of whitespace, collapsed to one space in displayed text. */
export const EXTENSION_WHITESPACE_RUN = /\s+/g;

/** Byte-order mark some editors put in front of a file. */
export const EXTENSION_BOM = '﻿';

// --- Menu, summary and notice text of the selection commands ---

/** A section row of the menu is `PREFIX + title + SUFFIX`. */
export const EXTENSION_MENU_SECTION_PREFIX = '-- ';
export const EXTENSION_MENU_SECTION_SUFFIX = ' --';

/** Between an item's label and its description in a menu row. */
export const EXTENSION_MENU_DESCRIPTION_SEPARATOR = ' — ';

/** Tail of the menu question; the head names the extension and its version. */
export const EXTENSION_MENU_QUESTION_HINT = '(all are checked; space toggles, enter confirms):';

/** Tail of the question about the new items of an installed extension. */
export const EXTENSION_NEW_ITEMS_QUESTION_HINT = 'Deselect any you do not want, then confirm:';

/** Fragments of a summary line: `Skills: 3 of 5 — skipped: a, b — not installed (undecided): c`. */
export const EXTENSION_SUMMARY_SKIPPED_PREFIX = ' — skipped: ';
export const EXTENSION_SUMMARY_UNDECIDED_PREFIX = ' — not installed (undecided): ';

/** Fragments of the notice that items of an extension are still undecided. */
export const EXTENSION_NOTICE_MARK = '⚠';
export const EXTENSION_NOTICE_UNDECIDED = 'not installed (undecided): ';
export const EXTENSION_NOTICE_ITEM_SEPARATOR = '; ';

/** Labels of the lines `extension list` prints for an installed extension. */
export const EXTENSION_LIST_SKIPPED_LABEL = 'Skipped:';
export const EXTENSION_LIST_UNDECIDED_LABEL = 'Not decided:';

/** Fixed outcomes of the commands. */
export const EXTENSION_ADD_CANCELLED_MESSAGE = 'Installation cancelled — nothing was changed.';
export const EXTENSION_UPDATE_CANCELLED_MESSAGE =
  'Update cancelled — the extension being asked about and the ones after it were left as they were.';
export const EXTENSION_SELECT_CANCELLED_MESSAGE = 'Selection cancelled — nothing was changed.';
export const EXTENSION_SELECT_UNCHANGED_MESSAGE = 'Selection unchanged.';
export const EXTENSION_SELECT_NOTHING_TO_CHANGE_MESSAGE =
  'Nothing to change: pass --skip-skills, --skip-subagents, --skip-mcp or --install-new, '
  + 'or run in a terminal to choose from the menu.';
