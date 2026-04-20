import chalk from 'chalk';
import path from 'path';
import { getCurrentVersion, loadConfig, saveConfig } from '../../core/config.js';
import {
  buildManagedSkillsState, buildManagedSubagentsState, getAvailableSkills,
  updateSkills, updateSubagents, installEngineTemplates, injectMcpRules,
  installExtensionSkills, installExtensionSubagents,
  syncRulesState,
  installCliContract,
  installDevPrinciples,
  type SkillUpdateEntry, type SubagentUpdateEntry,
} from '../../core/installer.js';
import { renderSyncRulesEvents } from './rules.js';
import { discoverMcpServers, collectMcpRules } from '../../core/mcp.js';
import { getAgentConfig } from '../../core/agents.js';
import { fileExists } from '../../utils/fs.js';
import { collectReplacedSkills, refreshExtensions } from '../../core/extension-ops.js';
import { loadExtensionManifest, getExtensionDir } from '../../core/extensions.js';
import { createRegistry } from '../../core/registry/index.js';
import { applyAllInjections } from '../../core/injections.js';

interface UpdateCommandOptions {
  force?: boolean;
}

function formatReason(reason: string): string {
  switch (reason) {
    case 'source-hash-changed':
      return 'source changed';
    case 'installed-hash-drift':
      return 'local drift';
    case 'missing-managed-state':
      return 'state missing';
    case 'missing-installed-artifact':
      return 'artifact missing';
    case 'package-removed':
      return 'removed from package';
    case 'new-skill-not-installed':
      return 'new in package';
    case 'force-clean-reinstall':
      return 'force reinstall';
    case 'install-failed':
      return 'install failed';
    case 'source-missing':
      return 'source unavailable';
    case 'replaced-by-extension':
      return 'replaced by extension';
    default:
      return reason;
  }
}

function groupEntriesByStatus(entries: SkillUpdateEntry[]): Record<'changed' | 'unchanged' | 'skipped' | 'removed' | 'replaced', SkillUpdateEntry[]> {
  return {
    changed: entries.filter(entry => entry.status === 'changed').sort((a, b) => a.skill.localeCompare(b.skill)),
    unchanged: entries.filter(entry => entry.status === 'unchanged').sort((a, b) => a.skill.localeCompare(b.skill)),
    skipped: entries.filter(entry => entry.status === 'skipped').sort((a, b) => a.skill.localeCompare(b.skill)),
    removed: entries.filter(entry => entry.status === 'removed').sort((a, b) => a.skill.localeCompare(b.skill)),
    replaced: entries.filter(entry => entry.status === 'replaced').sort((a, b) => a.skill.localeCompare(b.skill)),
  };
}

export async function updateCommand(options: UpdateCommandOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const force = Boolean(options.force);

  console.log(chalk.bold.blue('\n🎮 UniKit — Update\n'));

  const config = await loadConfig(projectDir);

  if (!config) {
    console.log(chalk.red('Error: No .unikit.json found.'));
    console.log(chalk.dim('Run "unikit-ai init" to set up your project first.'));
    process.exit(1);
  }

  const currentVersion = getCurrentVersion();
  const engineId = config.engine;

  console.log(chalk.dim(`Config version: ${config.version}`));
  console.log(chalk.dim(`Package version: ${currentVersion}`));
  console.log(chalk.dim(`Engine: ${engineId}\n`));

  if (force) {
    console.log(chalk.yellow('⚠ Force mode enabled: clean reinstall of installed skills\n'));
  }

  try {
    // Refresh extensions from sources (check for updates)
    let extensions = config.extensions ?? [];
    if (extensions.length > 0) {
      console.log(chalk.dim('Checking extensions for updates...\n'));
      const extRefresh = await refreshExtensions(projectDir, config, { force });
      if (extRefresh.updated.length > 0) {
        console.log(chalk.green(`✓ Extensions updated: ${extRefresh.updated.join(', ')}`));
      }
      if (extRefresh.failed.length > 0) {
        console.log(chalk.yellow(`⚠ Extension update failed: ${extRefresh.failed.join(', ')}`));
      }
      await saveConfig(projectDir, config);
      // Re-read extensions after refresh (commitResolvedExtension replaces config.extensions)
      extensions = config.extensions ?? [];
    }

    // Collect replaced skills from extensions
    const replacedSkills = collectReplacedSkills(config.extensions ?? []);

    // Update skills per agent
    console.log(chalk.dim('Updating skills...\n'));

    const entriesByAgent = new Map<string, SkillUpdateEntry[]>();

    for (const agent of config.agents) {
      const result = await updateSkills(agent, projectDir, { force, engineId, engineMcpKey: config.engineMcpKey, replacedSkills });
      agent.installedSkills = result.installedSkills;
      entriesByAgent.set(agent.id, result.entries);
    }

    // Install/refresh engine templates
    await installEngineTemplates(projectDir, engineId, config.agents);

    // Update subagents per agent
    console.log(chalk.dim('Updating subagents...\n'));

    const subagentEntriesByAgent = new Map<string, SubagentUpdateEntry[]>();

    for (const agent of config.agents) {
      const agentCfg = getAgentConfig(agent.id);
      if (agentCfg.supportsSubagents) {
        const result = await updateSubagents(agent, projectDir, { force, engineId, engineMcpKey: config.engineMcpKey });
        agent.installedSubagents = result.installedSubagents;
        subagentEntriesByAgent.set(agent.id, result.entries);
      }
    }

    // Reinstall extension skills and subagents (recover if missing after base updates)
    if (extensions.length > 0) {
      for (const ext of extensions) {
        const extManifest = await loadExtensionManifest(getExtensionDir(projectDir, ext.name));
        if (!extManifest) continue;

        const extensionDir = getExtensionDir(projectDir, ext.name);
        for (const agent of config.agents) {
          if (extManifest.skills?.length) {
            await installExtensionSkills(projectDir, agent, extensionDir, extManifest.skills, engineId, config.engineMcpKey);
          }
          if (extManifest.subagents?.length) {
            await installExtensionSubagents(projectDir, agent, extensionDir, extManifest.subagents, engineId, config.engineMcpKey);
          }
        }
      }
    }

    // Inject MCP tool permissions (after all skills — base + extension — are installed)
    console.log(chalk.dim('Injecting MCP tool permissions...\n'));
    const discoveredServers = await discoverMcpServers(engineId);
    const mcpAllowedTools = collectMcpRules(discoveredServers, config.mcp.servers);
    await injectMcpRules(projectDir, config.agents, mcpAllowedTools);

    // Re-apply extension injections (after base skills updated + MCP injected)
    if (extensions.length > 0) {
      console.log(chalk.dim('Re-applying extension injections...\n'));

      for (const ext of extensions) {
        const extManifest = await loadExtensionManifest(getExtensionDir(projectDir, ext.name));
        if (!extManifest?.injections?.length) continue;

        const extensionDir = getExtensionDir(projectDir, ext.name);
        for (const agent of config.agents) {
          await applyAllInjections(projectDir, agent, ext.name, extManifest.injections, extensionDir);
        }
      }
    }

    // Sync rules (shared) — single call into syncRulesState handles Phase 1-3
    // (disk↔state reconciliation, registry sync, RULES_INDEX.md regeneration).
    // `update --force` propagates as `{ replace: true, prune: true }` — the
    // exact composition that used to be called `sync --force`: overwrite local
    // modifications AND remove obsolete stack rules. Normal `update` (no
    // `--force`) maps to `{ replace: false, prune: false }` and behaves like
    // the lean `rules sync`.
    console.log(chalk.dim('Syncing rules...\n'));

    const registry = createRegistry(config.rulesRegistry, engineId);
    const syncResult = await syncRulesState(projectDir, engineId, config, registry, {
      replace: force,
      prune: force,
    });
    renderSyncRulesEvents(syncResult.events);

    // Update CLI contract
    await installCliContract(projectDir);

    // Update engine development principles (shared system file, plain rewrite)
    await installDevPrinciples(projectDir, engineId, config.engineMcpKey);

    // Rebuild managed state per agent (exclude replaced skills)
    const availableSkills = await getAvailableSkills();
    for (const agent of config.agents) {
      const managedSkills = agent.installedSkills.filter(s => availableSkills.includes(s) && !replacedSkills.has(s));
      agent.managedSkills = await buildManagedSkillsState(projectDir, agent, managedSkills, engineId);
      agent.managedSubagents = await buildManagedSubagentsState(projectDir, agent, agent.installedSubagents, engineId);
    }

    config.version = currentVersion;
    await saveConfig(projectDir, config);

    console.log(chalk.green('✓ Skills updated'));
    console.log(chalk.green('✓ Subagents updated'));
    console.log(chalk.green('✓ Configuration saved'));

    // Per-agent status
    for (const agent of config.agents) {
      const entries = entriesByAgent.get(agent.id) ?? [];
      const grouped = groupEntriesByStatus(entries);
      const changedWithContextWarnings: string[] = [];

      for (const entry of grouped.changed) {
        const skillContextPath = path.join(projectDir, '.unikit', 'skill-context', entry.skill, 'SKILL.md');
        if (await fileExists(skillContextPath)) {
          changedWithContextWarnings.push(entry.skill);
        }
      }

      console.log(chalk.bold(`\n[${agent.id}] Skills status:`));
      console.log(chalk.dim(`  changed: ${grouped.changed.length}`));
      console.log(chalk.dim(`  unchanged: ${grouped.unchanged.length}`));
      console.log(chalk.dim(`  skipped: ${grouped.skipped.length}`));
      console.log(chalk.dim(`  removed: ${grouped.removed.length}`));

      if (grouped.changed.length > 0) {
        console.log(chalk.bold('  Changed:'));
        for (const entry of grouped.changed) {
          console.log(chalk.dim(`    - ${entry.skill} (${formatReason(entry.reason)})`));
        }
      }

      if (grouped.skipped.length > 0) {
        console.log(chalk.bold('  Skipped:'));
        for (const entry of grouped.skipped) {
          console.log(chalk.dim(`    - ${entry.skill} (${formatReason(entry.reason)})`));
        }
      }

      if (grouped.removed.length > 0) {
        console.log(chalk.bold('  Removed:'));
        for (const entry of grouped.removed) {
          console.log(chalk.dim(`    - ${entry.skill} (${formatReason(entry.reason)})`));
        }
      }

      const recoveryEntries = grouped.changed.filter(entry => [
        'missing-managed-state',
        'missing-installed-artifact',
        'source-missing',
      ].includes(entry.reason));
      if (recoveryEntries.length > 0) {
        console.log(chalk.yellow('  WARN: managed state recovered for:'));
        for (const entry of recoveryEntries) {
          console.log(chalk.yellow(`    - ${entry.skill} (${formatReason(entry.reason)})`));
        }
      }

      if (changedWithContextWarnings.length > 0) {
        console.log(chalk.yellow('  WARN: skill-context override may need review for changed skills:'));
        for (const skill of changedWithContextWarnings) {
          console.log(chalk.yellow(`    - ${skill} (.unikit/skill-context/${skill}/SKILL.md)`));
        }
      }
    }

    // Rules summary — syncRulesState already printed per-event detail via
    // renderSyncRulesEvents; here we just emit a one-line status marker.
    const rulesUpdated = syncResult.events.filter(e =>
      e.kind === 'phase2:updating' || e.kind === 'phase1:untracked-found' ||
      e.kind === 'phase1:missing-removed' || e.kind === 'phase2:obsolete-removed',
    ).length;

    if (syncResult.changed) {
      console.log(chalk.green(`\n✓ Rules synced (${rulesUpdated} change${rulesUpdated === 1 ? '' : 's'})`));
    } else {
      console.log(chalk.green('\n✓ Rules up to date'));
    }

    console.log('');

  } catch (error) {
    console.log(chalk.red(`Error updating: ${(error as Error).message}`));
    process.exit(1);
  }
}
