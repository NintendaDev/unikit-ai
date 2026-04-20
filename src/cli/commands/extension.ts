import chalk from 'chalk';
import { loadConfig, saveConfig } from '../../core/config.js';
import {
  resolveExtension, findExtensionRecord, classifySource,
} from '../../core/extensions.js';
import {
  commitResolvedExtension, removeExtension, refreshExtensions,
  restoreBaseSkills,
} from '../../core/extension-ops.js';

export async function extensionAddCommand(source: string): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);

  if (!config) {
    console.log(chalk.red('Error: No .unikit.json found. Run "unikit-ai init" first.'));
    process.exit(1);
  }

  const sourceInfo = classifySource(source);
  console.log(chalk.dim(`Resolving extension from ${sourceInfo.type}: ${sourceInfo.resolved}...\n`));

  try {
    const resolved = await resolveExtension(source);
    const manifest = resolved.manifest;

    // Check if already installed
    const existing = findExtensionRecord(config.extensions ?? [], manifest.name);
    if (existing) {
      console.log(chalk.yellow(`Extension "${manifest.name}" is already installed (v${existing.version}).`));
      console.log(chalk.dim('Upgrading to new version...\n'));
    }

    console.log(chalk.dim(`Installing ${manifest.name}@${manifest.version}...`));

    if (manifest.skills?.length) {
      console.log(chalk.dim(`  Skills: ${manifest.skills.length}`));
    }
    if (manifest.subagents?.length) {
      console.log(chalk.dim(`  Subagents: ${manifest.subagents.length}`));
    }
    if (manifest.replaces && Object.keys(manifest.replaces).length > 0) {
      console.log(chalk.dim(`  Replaces: ${Object.values(manifest.replaces).join(', ')}`));
    }
    if (manifest.injections?.length) {
      console.log(chalk.dim(`  Injections: ${manifest.injections.length}`));
    }
    if (manifest.mcpServers?.length) {
      console.log(chalk.dim(`  MCP servers: ${manifest.mcpServers.map(s => s.key).join(', ')}`));
    }
    if (manifest.commands?.length) {
      console.log(chalk.dim(`  Commands: ${manifest.commands.map(c => c.name).join(', ')}`));
    }

    const record = await commitResolvedExtension(projectDir, config, resolved);
    await saveConfig(projectDir, config);

    console.log(chalk.green(`\n✓ Extension "${record.name}" installed (v${record.version})`));
  } catch (error) {
    console.log(chalk.red(`Error installing extension: ${(error as Error).message}`));
    process.exit(1);
  }
}

export async function extensionRemoveCommand(name: string): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);

  if (!config) {
    console.log(chalk.red('Error: No .unikit.json found.'));
    process.exit(1);
  }

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

    console.log(chalk.green(`✓ Extension "${name}" removed`));
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
  }

  console.log('');
}

interface ExtensionUpdateOptions {
  force?: boolean;
}

export async function extensionUpdateCommand(options: ExtensionUpdateOptions = {}): Promise<void> {
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

  console.log(chalk.dim(`Checking ${extensions.length} extension(s) for updates...\n`));

  try {
    const { updated, failed } = await refreshExtensions(projectDir, config, { force: options.force });
    await saveConfig(projectDir, config);

    if (updated.length > 0) {
      console.log(chalk.green(`✓ Updated: ${updated.join(', ')}`));
    } else {
      console.log(chalk.dim('All extensions are up to date.'));
    }

    if (failed.length > 0) {
      console.log(chalk.yellow(`⚠ Failed to update: ${failed.join(', ')}`));
    }
  } catch (error) {
    console.log(chalk.red(`Error updating extensions: ${(error as Error).message}`));
    process.exit(1);
  }
}
