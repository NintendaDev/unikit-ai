import chalk from 'chalk';
import path from 'path';
import { getCurrentVersion, loadConfig, readConfigVersion, saveConfig } from '../../core/config.js';
import {
  buildManagedSkillsState, getAvailableSkills, updateSkills,
  type SkillUpdateEntry,
} from '../../core/installer/skills.js';
import {
  buildManagedSubagentsState, updateSubagents,
  type SubagentUpdateEntry,
} from '../../core/installer/subagents.js';
import { installEngineTemplates, installCliContract, installGateResultContract, installUltraPlanReadContract, installResearchLinkContract, installPlanBoundariesContract, installMergeAnalysisContract, installBalanceHandbackContract, installPrototypeProfileContract, installDevPrinciples, installGamedesignSystemAssets, installGenreProfiles, installModulesYml } from '../../core/installer/system-assets.js';
import { installSubagentArgumentsContract, installSubagentRolesContract, installUserQuestionsContract } from '../../core/installer/system-contracts.js';
import { injectMcpRules } from '../../core/installer/mcp-injection.js';
import { installExtensionSkills, installExtensionSubagents } from '../../core/installer/extensions.js';
import { syncAllModules } from '../../core/installer/rules-sync.js';
import { runProjectMemoryMigrations } from '../../core/memory-migrations/index.js';
import { renderSyncRulesEvents } from './rules.js';
import { collectMcpRules } from '../../core/mcp.js';
import { catalogBridgeIds, selectionOf } from '../../core/bridges/selection.js';
import { reconcileMcpSettings } from '../../core/mcp-reconcile.js';
import { installEngineBridges, readPreviousBridgeSet } from '../../core/installer/engine-bridges.js';
import { swapBridgeNotes } from '../../core/installer/bridge-notes.js';
import { getAgentConfig } from '../../core/agents.js';
import { exitOnSharedSkillsDir } from '../guards.js';
import { fileExists } from '../../utils/fs.js';
import { collectReplacedSkills } from '../../core/extension-ops.js';
import { refreshExtensions } from '../../core/extension-refresh.js';
import { filterManifest, ExtensionSelectionCancelled } from '../../core/extension-selection.js';
import { loadExtensionManifest, getExtensionDir } from '../../core/extensions.js';
import { createRegistry } from '../../core/registry/index.js';
import { logInfo } from '../../utils/log.js';
import { applyExtensionInjections, injectionInputFromConfig } from '../../core/extension-injections.js';
import { reinstallExtensionAssets } from '../../core/extension-ops.js';
import {
  formatReason, groupEntriesByStatus, bootstrapNewSkillModuleRules,
  withoutRenameTargets, warnRenamedSkillContext, extensionsReplacingRenamedSkills,
} from './update-helpers.js';
import { recomputeSelection } from './update-bridges.js';
import { printInjectionReport } from './injection-report.js';
import { buildNewItemsChooser, formatPendingNotice } from './extension-selection-ui.js';

interface UpdateCommandOptions {
  force?: boolean;
  installNew?: boolean;
  skipNew?: boolean;
}

export async function updateCommand(options: UpdateCommandOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const force = Boolean(options.force);
  const installNew = Boolean(options.installNew);
  const skipNew = Boolean(options.skipNew);

  console.log(chalk.bold.blue('\n🎮 UniKit — Update\n'));

  let config = await loadConfig(projectDir);

  if (!config) {
    console.log(chalk.red('Error: No .unikit.json found.'));
    console.log(chalk.dim('Run "unikit-ai init" to set up your project first.'));
    process.exit(1);
  }

  exitOnSharedSkillsDir(config.agents);

  const currentVersion = getCurrentVersion();
  const engineId = config.engine;

  console.log(chalk.dim(`Config version: ${config.version}`));
  console.log(chalk.dim(`Package version: ${currentVersion}`));
  console.log(chalk.dim(`Engine: ${engineId}\n`));

  if (force) {
    console.log(chalk.yellow('⚠ Force mode enabled: clean reinstall of installed skills\n'));
  }

  try {
    // Migrate the on-disk `.unikit/` layout BEFORE anything reads it. The chain
    // relocates the legacy flat `.unikit/memory/{core,stack}` under `code/` AND
    // the flat project workspace (plans/patches/researches + PLAN/FIX_PLAN docs)
    // under `.unikit/code/`, so the skill reinstall and (later) `syncAllModules`
    // Phase 1 reconciliation both operate on the modular layout. Idempotent: a
    // no-op once already migrated. Runs before the `config.version` stamp below.
    const projectVersion = await readConfigVersion(projectDir);
    logInfo('update', `running project migrations (currentVersion=${projectVersion ?? 'null'})`);
    const migrated = await runProjectMemoryMigrations(projectDir, projectVersion);
    logInfo('update', migrated.applied.length > 0
      ? `applied: [${migrated.applied.join(', ')}]`
      : 'no pending migrations');

    // Re-read the config: from Phase 1 on the chain rewrites `.unikit.json`
    // itself (the MCP steps convert `mcp.servers` and rename its keys), so the
    // object loaded above is a snapshot of the PRE-migration file. Every
    // consumer below — `resolveSelectedEngineServer`, the engine-MCP tree
    // delivery, the settings reconciliation — must see the migrated form.
    //
    // This is the same class of ordering bug as the `swapMcpRecheckNotes` call
    // order (read the previous selection BEFORE persisting the new one): a step
    // reading an in-memory copy of a file another step has already rewritten.
    // Re-reading (rather than hoisting the chain above `loadConfig`) keeps the
    // "no config → exit 1" guard and the version banner on the values that were
    // actually on disk when the command started.
    config = (await loadConfig(projectDir)) ?? config;
    logInfo('update', 'config re-read after migrations');

    // Recompute the vendor codes of BOTH persisted maps before anything reads them: every artifact
    // below substitutes a code into itself and the source hash is computed from the same pairs, so a
    // stale code would land in every skill and not heal on the next run. The pass lives in
    // `update-bridges.ts` (this file is at its size ceiling); it also derives the code of the MCP
    // bridge from the catalog, which replaced the persisted scalar.
    const { discoveredServers, storedCodes: storedMcpCodes, mcpBridgeCode, enabledIds } = await recomputeSelection(engineId, config);
    const selection = selectionOf(config);

    // Refresh extensions from sources (check for updates)
    let extensions = config.extensions ?? [];
    if (extensions.length > 0) {
      console.log(chalk.dim('Checking extensions for updates...\n'));
      // Items an extension offers that have no decision yet are handled like new package skills:
      // a terminal gets a list (all checked), no terminal installs them only with --install-new.
      const extRefresh = await refreshExtensions(projectDir, config, {
        force,
        chooseNewItems: buildNewItemsChooser({ installNew, skipNew }),
      });
      if (extRefresh.updated.length > 0) {
        console.log(chalk.green(`✓ Extensions updated: ${extRefresh.updated.join(', ')}`));
      }
      if (extRefresh.failed.length > 0) {
        console.log(chalk.yellow(`⚠ Extension update failed: ${extRefresh.failed.join(', ')}`));
      }
      for (const line of formatPendingNotice(extRefresh.pending)) {
        console.log(chalk.yellow(line));
      }
      await saveConfig(projectDir, config);
      // Same outcome as closing the prompt about new package skills: the run stops (what was
      // committed before the cancel is already saved above).
      if (extRefresh.cancelled) throw new ExtensionSelectionCancelled();
      // Re-read extensions after refresh (commitResolvedExtension replaces config.extensions)
      extensions = config.extensions ?? [];
    }

    // Collect replaced skills from extensions
    const replacedSkills = collectReplacedSkills(config.extensions ?? []);

    // Snapshot the skills newly added to the package BEFORE the update loop
    // mutates agent.installedSkills below. A skill is "new" when the package
    // ships it but it is installed for NO agent yet (union across all agents).
    const packageSkills = await getAvailableSkills();
    const installedUnion = new Set(config.agents.flatMap(a => a.installedSkills));
    // A rename target whose old name is installed is seeded by updateSkills: it is not "new" and is not asked about.
    const newSkills = withoutRenameTargets(packageSkills.filter(s => !installedUnion.has(s)), installedUnion);

    // Resolve the opt-in install set for new skills. Lifted to function scope so
    // the rules-bootstrap step (after createRegistry below) can target the
    // modules these new skills belong to. Conflict policy: --skip-new wins over
    // --install-new (never install silently when the user asked to skip). With
    // neither flag, prompt only on a TTY; non-TTY stays a no-op (CI-safe
    // back-compat). Empty newSkills short-circuits to a no-op without rendering
    // an empty checkbox prompt.
    const installNewSkills = new Set<string>();
    if (!skipNew && newSkills.length > 0) {
      if (installNew) {
        for (const skill of newSkills) installNewSkills.add(skill);
      } else if (process.stdout.isTTY) {
        // Lazy: `inquirer` is ~240ms of module graph and this is the only branch
        // in the whole command that needs it. Every non-TTY run (the entire test
        // suite, and CI) used to pay for it at import time.
        const { default: inquirer } = await import('inquirer');
        const { chosen } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'chosen',
            message: 'New skills are available in this package version. Deselect any you do not want, then confirm:',
            // Default CHECKED: new skills are opt-out. The common case after an
            // update is "give me the new stuff", so pressing Enter installs all
            // of them; uncheck the ones you deliberately want to skip.
            choices: newSkills.map(skill => ({ name: skill, value: skill, checked: true })),
          },
        ]);
        for (const skill of chosen as string[]) installNewSkills.add(skill);
      }
    }

    // Update skills per agent
    console.log(chalk.dim('Updating skills...\n'));

    const entriesByAgent = new Map<string, SkillUpdateEntry[]>();

    for (const agent of config.agents) {
      const result = await updateSkills(agent, projectDir, { force, engineId, mcpBridgeCode, selection, replacedSkills, installNewSkills });
      agent.installedSkills = result.installedSkills;
      entriesByAgent.set(agent.id, result.entries);
    }

    // Install/refresh engine templates
    await installEngineTemplates(projectDir, engineId, config.agents);
    await warnRenamedSkillContext(projectDir, installedUnion);

    // Update subagents per agent
    console.log(chalk.dim('Updating subagents...\n'));

    const subagentEntriesByAgent = new Map<string, SubagentUpdateEntry[]>();

    for (const agent of config.agents) {
      const agentCfg = getAgentConfig(agent.id);
      if (agentCfg.supportsSubagents) {
        const result = await updateSubagents(agent, projectDir, { force, engineId, mcpBridgeCode, selection });
        agent.installedSubagents = result.installedSubagents;
        subagentEntriesByAgent.set(agent.id, result.entries);
      }
    }

    // Reinstall extension skills and subagents (recover if missing after base updates)
    if (extensions.length > 0) {
      for (const ext of extensions) {
        const extManifest = await loadExtensionManifest(getExtensionDir(projectDir, ext.name));
        if (!extManifest) continue;

        // Only what the selection left on: a skill or subagent the user switched off stays out.
        const selected = filterManifest(extManifest, ext.selection);
        const extensionDir = getExtensionDir(projectDir, ext.name);
        for (const agent of config.agents) {
          if (selected.skills?.length) {
            await installExtensionSkills(projectDir, agent, extensionDir, selected.skills, engineId, mcpBridgeCode);
          }
          if (selected.subagents?.length) {
            await installExtensionSubagents(projectDir, agent, extensionDir, selected.subagents, engineId, mcpBridgeCode);
          }
        }
      }
    }

    // A base skill that was renamed lost the replacement an extension had put into its directory: put it back
    // under the new base name (the extension's own manifest and record already read the new name).
    const renamedReplacements = extensionsReplacingRenamedSkills(extensions, installedUnion);
    if (renamedReplacements.length > 0) {
      await reinstallExtensionAssets({ projectDir, engine: engineId, mcpBridgeCode, agents: config.agents, extensions: renamedReplacements });
    }

    // Inject MCP tool permissions (after all skills — base + extension — are installed)
    console.log(chalk.dim('Injecting MCP tool permissions...\n'));
    const mcpAllowedTools = collectMcpRules(discoveredServers, enabledIds);
    await injectMcpRules(projectDir, config.agents, mcpAllowedTools);

    // Reconcile the agents' MCP settings files. Until 2.0.0 `update` never wrote
    // them at all — `configureMcp` was reachable only from `init` — so the `env`
    // overlay, the orphan removal and the placeholder detector fired exactly
    // once in a project's life. They are needed HERE: `init` is run once, while
    // the Unity plugin rewrites its own entry between runs and carries our `env`
    // away with it.
    //
    // `storedMcpCodes` is the pre-recompute snapshot taken above, not
    // `config.mcp.servers` — by this point the map in memory already holds the
    // new codes, and comparing it against itself would make every swap a no-op.
    // The pass is idempotent: with nothing to change it does not touch the file.
    await reconcileMcpSettings(
      projectDir,
      discoveredServers,
      enabledIds,
      config.agents.map(agent => agent.id),
      config,
      storedMcpCodes,
    );

    // Re-render the extension injections (after the base skills are updated and MCP grants injected):
    // ONE project-level pass over every extension and agent — the function init and `extension *` call.
    if (extensions.length > 0) {
      console.log(chalk.dim('Re-applying extension injections...\n'));
      const injectionReport = await applyExtensionInjections(injectionInputFromConfig(projectDir, config, mcpBridgeCode));
      printInjectionReport(injectionReport);
    }

    // Sync rules (shared) — single call into syncAllModules runs each module's
    // Phase 1-3 (disk↔state reconciliation, registry sync, RULES_INDEX.md regen).
    // `update --force` propagates as `{ replace: true, prune: true }` — the
    // exact composition that used to be called `sync --force`: overwrite local
    // modifications AND remove obsolete stack rules. Normal `update` (no
    // `--force`) maps to `{ replace: false, prune: false }` and behaves like
    // the lean `rules sync`.
    console.log(chalk.dim('Syncing rules...\n'));

    const registry = createRegistry(config.rulesRegistry, engineId);

    // Bootstrap rules for modules whose FIRST skill was installed this run
    // (close the gap: opting into a module's skills via update must deliver its
    // rules — Phase 2 sync only carries already-installed rules). Runs BEFORE
    // syncAllModules so Phase 1 keeps them (source:registry), Phase 2 skips them
    // (version equal), and Phase 3 regenerates the index including them.
    await bootstrapNewSkillModuleRules(projectDir, config, registry, engineId, installNewSkills);

    const syncResult = await syncAllModules(projectDir, engineId, config, registry, {
      replace: force,
      prune: force,
    });
    renderSyncRulesEvents(syncResult.events);

    // Update CLI contract
    await installCliContract(projectDir);

    // Refresh machine-readable gate-result contract (read by verify + review)
    await installGateResultContract(projectDir);

    // Refresh the ultra plan bundle reader contract (read by implement/verify/improve/commit)
    await installUltraPlanReadContract(projectDir);

    // Refresh the research-link contract (read by plan/improve/implement/verify when a plan links a research)
    await installResearchLinkContract(projectDir);
    await installPlanBoundariesContract(projectDir);

    // Refresh the merge-analysis protocol (read by explore and plan when asked to merge a branch)
    await installMergeAnalysisContract(projectDir);

    // Refresh the balance hand-back report contract (read by plan/implement/verify and unikit-gd-balance)
    await installBalanceHandbackContract(projectDir);

    // Refresh the prototype-profile contract (read by the executors of a plan built from experiment cards)
    await installPrototypeProfileContract(projectDir);

    // Refresh the subagent-arguments contract (read by the skills that launch a model-carrying subagent: how its model and effort are settled)
    await installSubagentArgumentsContract(projectDir);

    // Refresh the subagent-roles table (read together with the contract above: which role each launch has)
    await installSubagentRolesContract(projectDir);

    // Refresh the user-questions contract (read before their first question by the skills that carry its pointer)
    await installUserQuestionsContract(projectDir);

    // `update` does not re-ask for servers, but the selection still moves under it: editing
    // `.unikit.json` and re-running is how an engine switch reaches this command, and everything else
    // here already honours it (skills are reinstalled, stale grants cleared, the trees swept). The
    // findings logs have to follow the same switch, or a note about a dropped bridge stays active and
    // reads as evidence about the ones that are left.
    //
    // The previous set comes from the BRIDGES.md currently on disk — the only before-state this command
    // has, since the config is already the new answer. Read it BEFORE installEngineBridges rewrites it.
    const previousBridges = await readPreviousBridgeSet(projectDir);
    await swapBridgeNotes(projectDir, previousBridges, Object.keys(config.engineBridges.selected), catalogBridgeIds(discoveredServers));

    // Refresh BRIDGES.md and the rules trees (orphan-deletes a dropped bridge's tree and the 2.x folder)
    await installEngineBridges(projectDir, engineId, discoveredServers, Object.keys(config.engineBridges.selected));

    // Update engine development principles (shared system file, plain rewrite)
    await installDevPrinciples(projectDir, engineId, mcpBridgeCode);

    // Refresh module registry snapshot (flat rewrite, forward-compat SSOT)
    await installModulesYml(projectDir);

    // Refresh game-design system assets — gd-principles core + shards +
    // shared design-read contract (engine-agnostic flat rewrites under gamedesign/);
    // also orphan-deletes the pre-split flat .unikit/system/gd-principles.md
    await installGamedesignSystemAssets(projectDir);

    // Refresh selectively installed genre profiles (flat rewrite of state set)
    await installGenreProfiles(projectDir, config);

    // Rebuild managed state per agent (exclude replaced skills)
    const availableSkills = await getAvailableSkills();
    for (const agent of config.agents) {
      const managedSkills = agent.installedSkills.filter(s => availableSkills.includes(s) && !replacedSkills.has(s));
      agent.managedSkills = await buildManagedSkillsState(projectDir, agent, managedSkills, engineId, selection);
      agent.managedSubagents = await buildManagedSubagentsState(projectDir, agent, agent.installedSubagents, engineId, selection);
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

    // Rules summary — syncAllModules already printed per-event detail via
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
