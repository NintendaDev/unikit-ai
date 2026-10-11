import chalk from 'chalk';
import { loadConfig, saveConfig } from '../../core/config.js';
import {
  resolveExtension, findExtensionRecord, classifySource,
  loadExtensionManifest, getExtensionDir, type ResolvedExtension,
} from '../../core/extensions.js';
import {
  commitResolvedExtension, removeExtension, restoreBaseSkills, disposeResolvedExtension,
} from '../../core/extension-ops.js';
import { refreshExtensions, pendingLabels } from '../../core/extension-refresh.js';
import {
  listExtensionItems, priorSelectionOf, decideSelection, selectionFromChecked,
  filterManifest, pendingItems, ExtensionSelectionCancelled,
  type ExtensionSelection,
} from '../../core/extension-selection.js';
import { resolveSkipFlags, summarizeSelection } from '../../core/extension-selection-query.js';
import { describeExtensionItems, sanitizeDisplayText } from '../../core/extension-selection-describe.js';
import { EXTENSION_ITEM_KINDS, EXTENSION_KIND_TITLES } from '../../core/constants.js';
import { applyExtensionInjections, injectionInputFromConfig } from '../../core/extension-injections.js';
import { exitOnSharedSkillsDir } from '../guards.js';
import { printInjectionReport } from './injection-report.js';
import {
  isInteractive, shouldShowMenu, skipFlagsOf,
  type ExtensionAddOptions, type ExtensionUpdateOptions,
} from './extension-options.js';
import {
  promptExtensionMenu, formatSelectionSummary, formatPendingNotice, buildNewItemsChooser,
} from './extension-selection-ui.js';

export async function extensionAddCommand(source: string, options: ExtensionAddOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);

  if (!config) {
    console.log(chalk.red('Error: No .unikit.json found. Run "unikit-ai init" first.'));
    process.exit(1);
  }

  exitOnSharedSkillsDir(config.agents);

  const sourceInfo = classifySource(source);
  console.log(chalk.dim(`Resolving extension from ${sourceInfo.type}: ${sourceInfo.resolved}...\n`));

  // Outside the try: the clone of a git source has to be removed on every way out.
  let resolved: ResolvedExtension | null = null;

  try {
    resolved = await resolveExtension(source);
    const manifest = resolved.manifest;

    // Check if already installed
    const existing = findExtensionRecord(config.extensions ?? [], manifest.name);
    if (existing) {
      console.log(chalk.yellow(`Extension "${manifest.name}" is already installed (v${existing.version}).`));
      console.log(chalk.dim('Upgrading to new version...\n'));
    }

    console.log(chalk.dim(`Installing ${manifest.name}@${manifest.version}...`));

    // The selection is settled before anything is written: a wrong name or a closed menu leaves no trace.
    const items = listExtensionItems(manifest);
    const skip = resolveSkipFlags(items, skipFlagsOf(options));
    if (!skip.ok) throw new Error(sanitizeDisplayText(skip.error));

    const previousManifest = existing
      ? await loadExtensionManifest(getExtensionDir(projectDir, manifest.name))
      : null;
    const prior = priorSelectionOf(existing, previousManifest);
    const installed = prior !== null;

    let selection: ExtensionSelection;
    if (shouldShowMenu({ interactive: isInteractive(), itemCount: items.length, installed, options })) {
      const views = await describeExtensionItems(resolved.localPath, items);
      const checked = await promptExtensionMenu({
        name: manifest.name, version: manifest.version, views, prior,
      });
      selection = selectionFromChecked(items, checked);
    } else {
      // On a first install --install-new and --skip-new mean nothing: everything is on.
      selection = decideSelection({
        items,
        prior,
        skip: skip.ids,
        installNew: installed && Boolean(options.installNew),
        skipNew: installed && Boolean(options.skipNew),
      });
    }

    for (const line of formatSelectionSummary(items, selection)) {
      console.log(chalk.dim(`  ${line}`));
    }
    const replaces = Object.values(filterManifest(manifest, selection).replaces ?? {});
    if (replaces.length > 0) {
      console.log(chalk.dim(`  Replaces: ${replaces.map(name => sanitizeDisplayText(name)).join(', ')}`));
    }
    if (manifest.injections?.length) {
      console.log(chalk.dim(`  Injections: ${manifest.injections.length}`));
    }
    if (manifest.commands?.length) {
      console.log(chalk.dim(`  Commands: ${manifest.commands.map(c => c.name).join(', ')}`));
    }

    const record = await commitResolvedExtension(projectDir, config, resolved, selection);
    // One pass over every extension: blocks and reference files go in once the set is final.
    const injections = await applyExtensionInjections(injectionInputFromConfig(projectDir, config));
    await saveConfig(projectDir, config);

    console.log(chalk.green(`\n✓ Extension "${record.name}" installed (v${record.version})`));
    printInjectionReport(injections, { onlyExtension: record.name });

    const undecided = pendingItems(items, selection);
    if (undecided.length > 0) {
      const notice = formatPendingNotice([{ extension: record.name, items: pendingLabels(undecided) }]);
      for (const line of notice) console.log(chalk.yellow(line));
    }
  } catch (error) {
    // `process.exit` below skips `finally`, so the clone goes first.
    if (resolved) await disposeResolvedExtension(resolved);

    if (error instanceof ExtensionSelectionCancelled) {
      console.log(chalk.yellow('Installation cancelled — nothing was changed.'));

      return;
    }

    console.log(chalk.red(`Error installing extension: ${(error as Error).message}`));
    process.exit(1);
  } finally {
    if (resolved) await disposeResolvedExtension(resolved);
  }
}

export async function extensionRemoveCommand(name: string): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);

  if (!config) {
    console.log(chalk.red('Error: No .unikit.json found.'));
    process.exit(1);
  }

  exitOnSharedSkillsDir(config.agents);

  const existing = findExtensionRecord(config.extensions ?? [], name);
  if (!existing) {
    console.log(chalk.red(`Extension "${name}" is not installed.`));
    process.exit(1);
  }

  console.log(chalk.dim(`Removing extension "${name}"...\n`));

  try {
    // Collect replaced skills before removal
    const replacedBaseSkills = existing.replacedSkills
      ? Object.keys(existing.replacedSkills)
      : [];

    await removeExtension(projectDir, config, name);
    await saveConfig(projectDir, config);

    // Restore base skills that were replaced
    if (replacedBaseSkills.length > 0) {
      console.log(chalk.dim(`Restoring base skills: ${replacedBaseSkills.join(', ')}`));
      await restoreBaseSkills(projectDir, config, replacedBaseSkills);
      await saveConfig(projectDir, config);
    }

    // Always: takes the removed extension's blocks and reference directories out of the skills.
    const injections = await applyExtensionInjections(injectionInputFromConfig(projectDir, config));

    console.log(chalk.green(`✓ Extension "${name}" removed`));
    printInjectionReport(injections);
  } catch (error) {
    console.log(chalk.red(`Error removing extension: ${(error as Error).message}`));
    process.exit(1);
  }
}

export async function extensionListCommand(): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);

  if (!config) {
    console.log(chalk.red('Error: No .unikit.json found.'));
    process.exit(1);
  }

  const extensions = config.extensions ?? [];

  if (extensions.length === 0) {
    console.log(chalk.dim('No extensions installed.'));

    return;
  }

  console.log(chalk.bold(`Installed extensions (${extensions.length}):\n`));

  for (const ext of extensions) {
    console.log(`  ${chalk.bold(ext.name)} ${chalk.dim(`v${ext.version}`)}`);
    console.log(chalk.dim(`    Source: ${ext.source}`));
    if (ext.replacedSkills && Object.keys(ext.replacedSkills).length > 0) {
      console.log(chalk.dim(`    Replaces: ${Object.keys(ext.replacedSkills).join(', ')}`));
    }

    // What the user left out or has not decided on (a legacy record has neither).
    if (ext.selection) {
      const manifest = await loadExtensionManifest(getExtensionDir(projectDir, ext.name));
      if (manifest) {
        const summary = summarizeSelection(listExtensionItems(manifest), ext.selection);
        const section = (field: 'disabled' | 'undecided'): string => EXTENSION_ITEM_KINDS
          .filter(kind => summary[kind][field].length > 0)
          .map(kind => `${EXTENSION_KIND_TITLES[kind]}: ${summary[kind][field].map(label => sanitizeDisplayText(label)).join(', ')}`)
          .join('; ');

        const skipped = section('disabled');
        if (skipped) console.log(chalk.dim(`    Skipped: ${skipped}`));
        const undecided = section('undecided');
        if (undecided) console.log(chalk.dim(`    Not decided: ${undecided}`));
      }
    }
  }

  console.log('');
}

export async function extensionUpdateCommand(options: ExtensionUpdateOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);

  if (!config) {
    console.log(chalk.red('Error: No .unikit.json found.'));
    process.exit(1);
  }

  exitOnSharedSkillsDir(config.agents);

  const extensions = config.extensions ?? [];

  if (extensions.length === 0) {
    console.log(chalk.dim('No extensions installed.'));

    return;
  }

  console.log(chalk.dim(`Checking ${extensions.length} extension(s) for updates...\n`));

  try {
    const { updated, failed, pending, cancelled } = await refreshExtensions(projectDir, config, {
      force: options.force,
      chooseNewItems: buildNewItemsChooser({ installNew: options.installNew, skipNew: options.skipNew }),
    });
    // Saved even after a cancel: the extensions committed before it are on disk.
    await saveConfig(projectDir, config);

    if (updated.length > 0) {
      const injections = await applyExtensionInjections(injectionInputFromConfig(projectDir, config));
      console.log(chalk.green(`✓ Updated: ${updated.join(', ')}`));
      printInjectionReport(injections);
    } else if (pending.length === 0 && !cancelled) {
      console.log(chalk.dim('All extensions are up to date.'));
    }

    for (const line of formatPendingNotice(pending)) console.log(chalk.yellow(line));

    if (failed.length > 0) {
      console.log(chalk.yellow(`⚠ Failed to update: ${failed.join(', ')}`));
    }
    if (cancelled) {
      console.log(chalk.yellow('Update cancelled — the extension being asked about and the ones after it were left as they were.'));
    }
  } catch (error) {
    console.log(chalk.red(`Error updating extensions: ${(error as Error).message}`));
    process.exit(1);
  }
}
