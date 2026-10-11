// Options of the extension commands and the decisions about the interface that do not need a
// terminal to test: is there a terminal, does the menu show, did the flags ask for a change.

import { EXTENSION_FLAG_LIST_SEPARATOR } from '../../core/constants.js';
import type { SkipFlags } from '../../core/extension-selection-query.js';

export interface ExtensionAddOptions {
  skipSkills?: string[];
  skipSubagents?: string[];
  skipMcp?: string[];
  yes?: boolean;
  installNew?: boolean;
  skipNew?: boolean;
}

export type ExtensionSelectOptions = ExtensionAddOptions;

export interface ExtensionUpdateOptions {
  force?: boolean;
  installNew?: boolean;
  skipNew?: boolean;
}

/** Commander accumulator for a repeatable, comma-separated list of names. */
export function collectNameList(value: string, previous: string[] = []): string[] {
  const names = value
    .split(EXTENSION_FLAG_LIST_SEPARATOR)
    .map(name => name.trim())
    .filter(name => name !== '');

  return [...previous, ...names];
}

export function skipFlagsOf(options: ExtensionAddOptions): SkipFlags {
  return {
    skills: options.skipSkills ?? [],
    subagents: options.skipSubagents ?? [],
    mcpServers: options.skipMcp ?? [],
  };
}

export function hasSkipFlags(options: ExtensionAddOptions): boolean {
  const flags = skipFlagsOf(options);

  return flags.skills.length > 0 || flags.subagents.length > 0 || flags.mcpServers.length > 0;
}

/**
 * True when both streams are terminals. `update` checks stdout only for the prompt about new
 * package skills; a prompt with no input terminal would hang, so the extension commands need both.
 */
export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY);
}

/**
 * Whether the selection menu is shown. Not without a terminal, not with nothing to choose, not
 * when `--yes` or a `--skip-*` flag already decided, and — for an installed extension — not when
 * `--install-new` or `--skip-new` already decided the undecided items.
 */
export function shouldShowMenu(args: {
  interactive: boolean;
  itemCount: number;
  installed: boolean;
  options: ExtensionAddOptions;
}): boolean {
  const { interactive, itemCount, installed, options } = args;
  if (!interactive || itemCount === 0) return false;
  if (options.yes || hasSkipFlags(options)) return false;
  if (installed && (options.installNew || options.skipNew)) return false;

  return true;
}

/** Whether the flags ask for any change: `--yes` and `--skip-new` alone change nothing. */
export function hasSelectionChange(options: ExtensionAddOptions): boolean {
  return hasSkipFlags(options) || Boolean(options.installNew);
}
