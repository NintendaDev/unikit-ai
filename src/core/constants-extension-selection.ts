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
