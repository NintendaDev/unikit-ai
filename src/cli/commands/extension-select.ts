import chalk from 'chalk';
import { loadConfig, saveConfig } from '../../core/config.js';
import { findExtensionRecord, getExtensionDir, loadExtensionManifest } from '../../core/extensions.js';
import { applyExtensionSelectionChange } from '../../core/extension-select-ops.js';
import { pendingLabels } from '../../core/extension-refresh.js';
import { applyExtensionInjections, injectionInputFromConfig } from '../../core/extension-injections.js';
import {
  listExtensionItems, priorSelectionOf, allEnabled, decideSelection,
  selectionFromChecked, pendingItems, ExtensionSelectionCancelled, type ExtensionSelection,
} from '../../core/extension-selection.js';
import { resolveSkipFlags } from '../../core/extension-selection-query.js';
import { describeExtensionItems, sanitizeDisplayText } from '../../core/extension-selection-describe.js';
import {
  EXTENSION_SELECT_CANCELLED_MESSAGE, EXTENSION_SELECT_UNCHANGED_MESSAGE,
  EXTENSION_SELECT_NOTHING_TO_CHANGE_MESSAGE,
} from '../../core/constants.js';
import { exitOnSharedSkillsDir } from '../guards.js';
import { printInjectionReport } from './injection-report.js';
import {
  skipFlagsOf, hasSelectionChange, isInteractive, shouldShowMenu,
  type ExtensionSelectOptions,
} from './extension-options.js';
import { promptExtensionMenu, formatSelectionSummary, formatPendingNotice } from './extension-selection-ui.js';

/** Prints one red line and ends the process — every check below runs before anything is changed. */
function fail(message: string): never {
  console.log(chalk.red(message));
  process.exit(1);
}

/**
 * `extension select <name>`: change which skills, subagents and MCP servers of an installed
 * extension are installed. Works on the copy in `.unikit/extensions/<name>/`, so the source is
 * not needed and nothing is fetched.
 */
export async function extensionSelectCommand(name: string, options: ExtensionSelectOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);

  if (!config) fail('Error: No .unikit.json found.');

  exitOnSharedSkillsDir(config.agents);

  const record = findExtensionRecord(config.extensions ?? [], name);
  if (!record) fail(`Extension "${sanitizeDisplayText(name)}" is not installed.`);

  const extensionDir = getExtensionDir(projectDir, name);
  const manifest = await loadExtensionManifest(extensionDir);
  if (!manifest) fail(`Extension "${sanitizeDisplayText(name)}": manifest not found in ${extensionDir}`);

  const items = listExtensionItems(manifest);
  if (items.length === 0) {
    fail(`Extension "${sanitizeDisplayText(name)}" has no skills, subagents or MCP servers to select.`);
  }

  const skip = resolveSkipFlags(items, skipFlagsOf(options));
  if (!skip.ok) fail(sanitizeDisplayText(skip.error));

  const prior = priorSelectionOf(record, manifest) ?? allEnabled(items);

  try {
    let next: ExtensionSelection;
    if (shouldShowMenu({ interactive: isInteractive(), itemCount: items.length, installed: true, options })) {
      const views = await describeExtensionItems(extensionDir, items);
      const checked = await promptExtensionMenu({
        name: manifest.name, version: manifest.version, views, prior,
      });
      next = selectionFromChecked(items, checked);
    } else {
      if (!hasSelectionChange(options)) {
        fail(EXTENSION_SELECT_NOTHING_TO_CHANGE_MESSAGE);
      }
      next = decideSelection({
        items,
        prior,
        skip: skip.ids,
        installNew: Boolean(options.installNew),
        skipNew: Boolean(options.skipNew),
      });
    }

    const change = await applyExtensionSelectionChange(projectDir, config, name, next);
    // Order: files (above), then the injection pass, then the config — saved last.
    const injections = await applyExtensionInjections(injectionInputFromConfig(projectDir, config));
    await saveConfig(projectDir, config);

    const labels = (list: readonly string[]): string => list.map(label => sanitizeDisplayText(label)).join(', ');
    if (change.enabled.length > 0) console.log(chalk.green(`Enabled: ${labels(change.enabled)}`));
    if (change.disabled.length > 0) console.log(chalk.yellow(`Disabled: ${labels(change.disabled)}`));
    if (change.restoredBase.length > 0) {
      console.log(chalk.dim(`Restored base skills: ${labels(change.restoredBase)}`));
    }
    if (change.enabled.length === 0 && change.disabled.length === 0 && change.restoredBase.length === 0) {
      console.log(chalk.dim(EXTENSION_SELECT_UNCHANGED_MESSAGE));
    }

    for (const line of formatSelectionSummary(items, record.selection)) {
      console.log(chalk.dim(`  ${line}`));
    }
    printInjectionReport(injections);

    const undecided = pendingItems(items, record.selection ?? next);
    if (undecided.length > 0) {
      for (const line of formatPendingNotice([{ extension: name, items: pendingLabels(undecided) }])) {
        console.log(chalk.yellow(line));
      }
    }
  } catch (error) {
    if (error instanceof ExtensionSelectionCancelled) {
      console.log(chalk.yellow(EXTENSION_SELECT_CANCELLED_MESSAGE));

      return;
    }

    console.log(chalk.red(`Error selecting extension items: ${(error as Error).message}`));
    process.exit(1);
  }
}
