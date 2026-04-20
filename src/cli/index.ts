import path from 'path';
import { pathToFileURL } from 'url';
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { updateCommand } from './commands/update.js';
import {
  extensionAddCommand, extensionRemoveCommand,
  extensionListCommand, extensionUpdateCommand,
} from './commands/extension.js';
import {
  rulesListCommand, rulesShowCommand, rulesInstallCommand,
  rulesSyncCommand, rulesStatusCommand,
  rulesRegistryShowCommand, rulesRegistrySetCommand,
  rulesRegistryResetCommand, rulesRegistryInitCommand,
} from './commands/rules.js';
import { getCurrentVersion, loadConfig } from '../core/config.js';
import { loadAllExtensions } from '../core/extensions.js';
import { setVerbose } from '../utils/log.js';

const program = new Command();

program
  .name('unikit-ai')
  .description('CLI tool for installing AI agent skills and knowledge base rules for game development projects')
  .version(getCurrentVersion())
  .option('--verbose', 'Enable verbose logging')
  .hook('preAction', () => {
    if (program.opts().verbose) {
      setVerbose(true);
    }
  });

program
  .command('init')
  .description('Initialize UniKit in current project')
  .action(initCommand);

program
  .command('update')
  .description('Update installed skills, agents, and rules to latest version')
  .option('--force', 'Force clean reinstall of currently installed skills and force-refresh every installed rule from registry')
  .action(updateCommand);

const ext = program
  .command('extension')
  .description('Manage extensions');

ext
  .command('add <source>')
  .description('Install an extension from local path, git URL, or GitHub shorthand')
  .action(extensionAddCommand);

ext
  .command('remove <name>')
  .description('Remove an installed extension')
  .action(extensionRemoveCommand);

ext
  .command('list')
  .description('List installed extensions')
  .action(extensionListCommand);

ext
  .command('update')
  .description('Check and update extensions from their sources')
  .option('--force', 'Force reinstall even if version unchanged')
  .action(extensionUpdateCommand);

// --- Rules commands ---

const rules = program
  .command('rules')
  .description('Manage knowledge base rules');

rules
  .command('list')
  .description('List available rules from registry')
  .option('--json', 'Output as JSON')
  .option('--engine <id>', 'Override engine')
  .action(rulesListCommand);

rules
  .command('show <id>')
  .description('Preview a rule from registry')
  .option('--references', 'Include reference files')
  .action(rulesShowCommand);

rules
  .command('install [ids...]')
  .description('Install rules from the registry. Without arguments installs the core whitelist (bootstrap used by /unikit Step 9.2). With one or more ids installs each rule and prints an aggregated report.')
  .option('--force', 'Re-fetch and overwrite rules that are already installed')
  .action((ids: string[], options: { force?: boolean }) => rulesInstallCommand(ids, options));

rules
  .command('sync')
  .description('Reconcile disk state with config and regenerate RULES_INDEX.md')
  .option('--replace', 'Overwrite locally-modified rule files and re-fetch registry-sourced rules at the same version')
  .option('--prune', 'Remove obsolete stack rules that vanished from the registry manifest')
  .action(rulesSyncCommand);

rules
  .command('status')
  .description('Show installed rules and their sources')
  .option('--json', 'Output as JSON')
  .option('--check-updates', 'Check for available updates')
  .action(rulesStatusCommand);

// Nested `registry` command group: show / set / reset / init.
//
// Bare `rules registry` is an alias for `rules registry show` via
// `registry.action(...)`. Running `--help` on the group still lists all four
// subcommands, matching npm-style nesting (`npm run`, `npm config get` ...).
//
// Commander quirk: declaring the same flag (`--json`) on both the parent
// and a subcommand causes commander to drop the flag on both sides when a
// nested call like `rules registry show --json` is parsed. To keep
// `rules registry --json` working as an alias AND `rules registry show --json`
// working on its own, the parent `registry` action does NOT register `--json`
// as a commander option — it peeks at `process.argv` directly, which is safe
// because the action only fires when no subcommand was matched.

const registryCmd = rules
  .command('registry')
  .description('Manage the rules registry URL (nested subcommands: show, set, reset, init). Bare invocation is an alias for `rules registry show`; pass `--json` for JSON output.')
  .allowUnknownOption(true)
  .action(() => {
    const wantsJson = process.argv.includes('--json');
    return rulesRegistryShowCommand({ json: wantsJson });
  });

registryCmd
  .command('show')
  .description('Print the current registry URL and kind')
  .option('--json', 'Output as JSON')
  .action(rulesRegistryShowCommand);

registryCmd
  .command('set <url>')
  .description('Set the rules registry URL. Does NOT sync rules — run `unikit-ai rules sync` afterwards when you want to pull content.')
  .option('--json', 'Output as JSON')
  .action(rulesRegistrySetCommand);

registryCmd
  .command('reset')
  .description('Reset the rules registry to the default (official). Does NOT sync rules.')
  .option('--json', 'Output as JSON')
  .action(rulesRegistryResetCommand);

registryCmd
  .command('init [path]')
  .description('Scaffold a new local rules registry at the target path')
  .action(rulesRegistryInitCommand);

async function loadExtensionCommands(): Promise<void> {
  try {
    const projectDir = process.cwd();
    const config = await loadConfig(projectDir);
    if (!config?.extensions?.length) return;

    const registeredNames = config.extensions.map(e => e.name);
    const extensions = await loadAllExtensions(projectDir, registeredNames);
    for (const { dir, manifest } of extensions) {
      if (!manifest.commands?.length) continue;
      for (const cmd of manifest.commands) {
        try {
          const moduleUrl = pathToFileURL(path.join(dir, cmd.module)).href;
          const mod = await import(moduleUrl);
          if (typeof mod.register === 'function') {
            mod.register(program);
          }
        } catch (err) {
          console.error(`Warning: Failed to load command "${cmd.name}" from extension "${manifest.name}": ${(err as Error).message}`);
        }
      }
    }
  } catch (err) {
    console.error(`Warning: Failed to load extension commands: ${(err as Error).message}`);
  }
}

await loadExtensionCommands();
program.parse();
