import chalk from 'chalk';
import path from 'path';
import { runWizard } from '../wizard/prompts.js';
import { buildManagedSkillsState, installSkills, removeSkillsByName } from '../../core/installer/skills.js';
import { resolveSkillPrune } from '../../core/skill-groups.js';
import { renameSkillNames } from '../../core/skill-renames.js';
import { buildManagedSubagentsState, installSubagents } from '../../core/installer/subagents.js';
import { injectMcpRules } from '../../core/installer/mcp-injection.js';
import { collectManagedGrantPrefixes } from '../../core/bridges/grants.js';
import { getBridgeSetupLines } from '../../core/bridges/summary.js';
import { installEngineTemplates, installCliContract, installGateResultContract, installUltraPlanReadContract, installResearchLinkContract, installPlanBoundariesContract, installMergeAnalysisContract, installBalanceHandbackContract, installPrototypeProfileContract, installDevPrinciples, installGamedesignSystemAssets, installGenreProfiles, installModulesYml } from '../../core/installer/system-assets.js';
import { installSubagentArgumentsContract, installSubagentRolesContract, installUserQuestionsContract } from '../../core/installer/system-contracts.js';
import { memoryDir } from '../../core/constants.js';
import {
  saveConfig, configExists, loadConfig, readConfigVersion, getCurrentVersion, emptyRulesInstallation,
  type AgentInstallation, type UniKitConfig,
} from '../../core/config.js';
import { getMcpDocsLines, discoverMcpServers, collectMcpRules, buildMcpServerMap } from '../../core/mcp.js';
import { catalogBridgeIds, resolveMcpBridgeCode, type ServerSelection } from '../../core/bridges/selection.js';
import { reconcileMcpSettings } from '../../core/mcp-reconcile.js';
import { getMcpEnvLines } from '../../core/mcp-env.js';
import { installEngineBridges } from '../../core/installer/engine-bridges.js';
import { swapBridgeNotes } from '../../core/installer/bridge-notes.js';
import { getAgentConfig } from '../../core/agents.js';
import { collectExtensionSkillNames, removeAgentSetup } from '../../core/installer/agent-removal.js';
import { getAgentOnboarding } from '../../core/transformer.js';
import { runProjectMemoryMigrations } from '../../core/memory-migrations/index.js';
import { reinstallExtensionAssets } from '../../core/extension-ops.js';
import { applyExtensionInjections } from '../../core/extension-injections.js';
import { printInjectionReport } from './injection-report.js';
import { logInfo } from '../../utils/log.js';

export async function initCommand(): Promise<void> {
  const projectDir = process.cwd();

  console.log(chalk.bold.blue('\n🎮 UniKit — AI-powered game development toolkit\n'));

  // Migrate the on-disk layout BEFORE the config is read. `init` is a full
  // migrator too, not only `update`: re-running it on an old project is the
  // most common way users upgrade, and until now the chain never ran here at
  // all. Placement is load-bearing — the chain rewrites `.unikit.json` itself
  // (the MCP steps convert `mcp.servers` and rename its keys), and the wizard
  // below receives `existingConfig?.mcp.servers` as its pre-selection. Read the
  // config first and the wizard pre-selects from the pre-migration form.
  //
  // The anchor comes from `readConfigVersion`, not from the loaded config:
  // `loadConfig` defaults a missing `version` to the current package version.
  // A fresh project (no config at all) yields `null` → the version half is off,
  // `detect` finds nothing, and the chain is a no-op.
  //
  // A step may refuse to run (the 3.0.0 config split throws when it cannot read the catalog, so the
  // selection is never lost). Outside the `try` below that would surface as an unhandled rejection:
  // say what happened, and that nothing was changed by the step that threw.
  const projectVersion = await readConfigVersion(projectDir);
  logInfo('init', `running project migrations (currentVersion=${projectVersion ?? 'null'})`);
  try {
    const migrated = await runProjectMemoryMigrations(projectDir, projectVersion);
    logInfo('init', migrated.applied.length > 0
      ? `applied: [${migrated.applied.join(', ')}]`
      : 'no pending migrations');
  } catch (error) {
    console.error(chalk.red(`Error: project migration failed: ${error instanceof Error ? error.message : String(error)}`));
    console.error('The project files were left as they were. Fix the cause and run init again.');
    process.exit(1);
  }

  const hasExistingConfig = await configExists(projectDir);
  const existingConfig = hasExistingConfig ? await loadConfig(projectDir) : null;
  // A re-init rebuilds the config from the wizard's answers; the extensions are not among them and
  // must be carried over by hand, or the next `update` no longer knows they exist.
  const preservedExtensions = existingConfig?.extensions ?? [];
  if (preservedExtensions.length > 0) {
    logInfo('init', `extensions preserved: ${preservedExtensions.length}`);
  }

  if (hasExistingConfig) {
    console.log(chalk.yellow('Warning: .unikit.json already exists.'));
    console.log('Running init will reconfigure selected agents (add/remove) and reinstall all components.\n');
  }

  try {
    const existingAgentIds = existingConfig?.agents.map(a => a.id) ?? [];
    // null = fresh install (the wizard checks every skill); an array = re-init,
    // where the wizard mirrors the previously installed set. The union is built
    // ONLY from a successfully loaded config, so a fresh project stays null and
    // we never conflate "deselected everything on re-init" with "fresh".
    // Renamed skills are shown under their new names, so the wizard checks them and the prune below does not
    // keep the old directory.
    const existingInstalledSkills = existingConfig
      ? renameSkillNames([...new Set(existingConfig.agents.flatMap(a => a.installedSkills))])
      : null;
    const answers = await runWizard(
      existingAgentIds,
      existingConfig?.rulesRegistry ?? null,
      existingConfig?.engine ?? null,
      existingInstalledSkills,
      // Same null-vs-array contract as existingInstalledSkills: a re-init mirrors both groups of
      // the previous choice instead of falling back to the defaults.
      existingConfig
        ? { mcp: Object.keys(existingConfig.mcp.servers), bridges: Object.keys(existingConfig.engineBridges.selected) }
        : null,
    );
    const engineId = answers.engine;

    // Rules registry comes from the wizard (answers.rulesRegistry); validation was done there.

    // Remove deselected agents
    const selectedAgentIds = new Set(answers.agents.map(a => a.id));
    const removedAgents = (existingConfig?.agents ?? []).filter(a => !selectedAgentIds.has(a.id));

    if (removedAgents.length > 0) {
      console.log(chalk.dim('\nRemoving deselected agent setups...\n'));
      const extensionSkills = await collectExtensionSkillNames(projectDir, existingConfig);
      for (const removedAgent of removedAgents) {
        const removal = await removeAgentSetup(projectDir, removedAgent, extensionSkills);
        console.log(chalk.yellow(`  Removed: ${removedAgent.id}`));
        if (removal.keptEntries.length > 0) {
          console.log(chalk.dim(`    Kept ${removal.keptEntries.length} item(s) in ${removedAgent.skillsDir} that UniKit did not install`));
        }
      }
    }

    // Re-init prune: for agents that remain selected, remove the skills the
    // user de-selected this run. Deselected agents are already removed
    // above (removeAgentSetup takes out every skill UniKit installed for them); the install loop
    // below only (re)installs the selected set and never removes, so without
    // this step deselected skills would linger on retained agents. The prune
    // set is the pure resolveSkillPrune(baseline, selected) per agent.
    const retainedExistingAgents = (existingConfig?.agents ?? []).filter(a => selectedAgentIds.has(a.id));
    for (const agent of retainedExistingAgents) {
      const toPrune = resolveSkillPrune(agent.installedSkills, answers.selectedSkills);
      if (toPrune.length > 0) {
        await removeSkillsByName(projectDir, agent, toPrune);
        console.log(chalk.yellow(`  Pruned ${toPrune.length} deselected skill(s) from ${agent.id}`));
      }
    }

    // Install skills & agents per agent
    console.log(chalk.dim('\nInstalling skills and agents...\n'));

    const installedAgents: AgentInstallation[] = [];

    // Discover MCP servers for the selected engine
    const discoveredServers = await discoverMcpServers(engineId);

    // The persisted form of the selection: `key → vendor code`, one map per group. Built once,
    // here, so the source hashes and the config write cannot disagree about which code each
    // selected server was registered under.
    const mcpServerMap = buildMcpServerMap(discoveredServers, answers.mcpServers);
    const bridgeMap = buildMcpServerMap(discoveredServers, answers.engineBridges);
    const selection: ServerSelection = { mcp: mcpServerMap, bridges: bridgeMap };
    // Derived from the catalog and the SET of bridges, the way `update` derives it: one function.
    const mcpBridgeCode = resolveMcpBridgeCode(discoveredServers, answers.engineBridges);
    const enabledIds = [...answers.mcpServers, ...answers.engineBridges];

    for (const agentSelection of answers.agents) {
      const agentConfig = getAgentConfig(agentSelection.id);

      const installedSkills = await installSkills({
        projectDir,
        skillsDir: agentConfig.skillsDir,
        skills: answers.selectedSkills,
        agentId: agentSelection.id,
        engineId,
        mcpBridgeCode,
      });

      const subagentFiles = agentConfig.supportsSubagents
        ? await installSubagents(projectDir, agentConfig.subagentsDir, { agentId: agentSelection.id, engineId, mcpBridgeCode })
        : [];

      installedAgents.push({
        id: agentSelection.id,
        skillsDir: agentConfig.skillsDir,
        subagentsDir: agentConfig.subagentsDir,
        installedSkills,
        installedSubagents: subagentFiles,
      });
    }

    // The loop above reinstalled the base skills over whatever an extension had replaced and wiped
    // its blocks: put the extensions' own skills, their replacement skills and subagents back.
    if (preservedExtensions.length > 0) {
      console.log(chalk.dim('\nRestoring extensions...\n'));
      const restored = await reinstallExtensionAssets({
        projectDir, engine: engineId, mcpBridgeCode,
        agents: installedAgents, extensions: preservedExtensions,
      });
      if (restored.missing.length > 0) {
        console.log(chalk.yellow(`⚠ Extension files not found, skipped: ${restored.missing.join(', ')}`));
      }
    }

    // Write the MCP settings file of every installed agent. Lifted out of the
    // per-agent install loop above so `init` and `update` drive one and the same
    // pass — see `mcp-reconcile.ts`.
    await reconcileMcpSettings(
      projectDir,
      discoveredServers,
      enabledIds,
      installedAgents.map(agent => agent.id),
      // Re-init on a project that installed extensions: their settings keys must
      // stay off limits to the normalisation scan. `null` on a fresh install,
      // which has no extensions by definition.
      existingConfig,
      // The codes as they stand on disk RIGHT NOW — `saveConfig` below has not
      // run yet, which is the whole point: it is what lets the pass recognise a
      // server whose code moved and delete the entry left under the old one.
      // Hoisting the config write above this call makes every swap a no-op.
      { ...(existingConfig?.mcp.servers ?? {}), ...(existingConfig?.engineBridges.selected ?? {}) },
    );

    // Install engine templates
    await installEngineTemplates(projectDir, engineId, installedAgents);

    // Inject MCP tool permissions
    console.log(chalk.dim('Injecting MCP tool permissions...\n'));
    const mcpAllowedTools = collectMcpRules(discoveredServers, enabledIds);
    await injectMcpRules(projectDir, installedAgents, mcpAllowedTools, collectManagedGrantPrefixes(discoveredServers));

    // The same project-level pass `update` and `extension *` run, after the MCP grants like in `update`.
    if (preservedExtensions.length > 0) {
      const injectionReport = await applyExtensionInjections({
        projectDir, engine: engineId, mcpBridgeCode,
        agents: installedAgents, extensions: preservedExtensions,
      });
      printInjectionReport(injectionReport);
    }

    // Rules installation is deferred to the /unikit skill Step 9, which calls
    // `unikit-ai rules install` (no args — core whitelist bootstrap) and then
    // drives stack rule selection through registry lookup + /unikit-memory
    // generators. init only records an empty rules state so the skill can
    // populate it.

    // Build managed skills and subagents state per agent
    for (const agent of installedAgents) {
      agent.managedSkills = await buildManagedSkillsState(projectDir, agent, agent.installedSkills, engineId, selection);
      agent.managedSubagents = await buildManagedSubagentsState(projectDir, agent, agent.installedSubagents, engineId, selection);
    }

    // Save config — rules.installed starts empty; /unikit Step 9 fills it.
    // genres.installed also starts empty; /unikit-gd-spec installs profiles later.
    const config: UniKitConfig = {
      version: getCurrentVersion(),
      engine: engineId,
      rulesRegistry: answers.rulesRegistry,
      mcp: {
        servers: mcpServerMap,
      },
      engineBridges: {
        selected: bridgeMap,
      },
      agents: installedAgents,
      extensions: preservedExtensions,
      rules: {
        installed: emptyRulesInstallation(),
      },
      genres: {
        installed: [],
      },
    };
    // Park / restore the findings logs of the bridges that left / came back BEFORE the config write:
    // the previous set is read from `existingConfig`, and `saveConfig` overwrites it. Running this
    // afterwards makes the swap a no-op and leaves a dropped bridge's findings active. The previous
    // ids are file ids, so an engine switch needs no catalog of the previous engine to park them.
    await swapBridgeNotes(
      projectDir,
      existingConfig ? Object.keys(existingConfig.engineBridges.selected) : null,
      answers.engineBridges,
      catalogBridgeIds(discoveredServers),
    );

    await saveConfig(projectDir, config);

    console.log(chalk.green('✓ Configuration saved to .unikit.json'));

    // Install CLI contract for skill consumption
    await installCliContract(projectDir);

    // Install machine-readable gate-result contract (read by verify + review)
    await installGateResultContract(projectDir);

    // Install the ultra plan bundle reader contract (read by implement/verify/improve/commit)
    await installUltraPlanReadContract(projectDir);

    // Install the research-link contract (read by plan/improve/implement/verify when a plan links a research)
    await installResearchLinkContract(projectDir);
    await installPlanBoundariesContract(projectDir);

    // Install the merge-analysis protocol (read by explore and plan when asked to merge a branch)
    await installMergeAnalysisContract(projectDir);

    // Install the balance hand-back report contract (read by plan/implement/verify and unikit-gd-balance)
    await installBalanceHandbackContract(projectDir);

    // Install the prototype-profile contract (read by the executors of a plan built from experiment cards)
    await installPrototypeProfileContract(projectDir);

    // Install the subagent-arguments contract (read by the skills that launch a model-carrying subagent: how its model and effort are settled)
    await installSubagentArgumentsContract(projectDir);

    // Install the subagent-roles table (read together with the contract above: which role each launch has)
    await installSubagentRolesContract(projectDir);

    // Install the user-questions contract (read before their first question by the skills that carry its pointer)
    await installUserQuestionsContract(projectDir);

    // Deliver BRIDGES.md and the rules tree of every selected bridge (sweeps the 2.x engine-mcp folder)
    await installEngineBridges(projectDir, engineId, discoveredServers, answers.engineBridges, installedAgents.map(agent => agent.id));

    // Install engine development principles (shared system file)
    await installDevPrinciples(projectDir, engineId, mcpBridgeCode);

    // Install module registry snapshot (forward-compat SSOT)
    await installModulesYml(projectDir);

    // Install game-design system assets — gd-principles core + shards +
    // shared design-read contract (engine-agnostic flat copies under gamedesign/)
    await installGamedesignSystemAssets(projectDir);

    // Deliver selectively installed genre profiles (no-op at init — state is empty)
    await installGenreProfiles(projectDir, config);

    // Summary
    console.log(chalk.bold.green('\n✅ Setup complete!\n'));

    for (const agent of installedAgents) {
      const agentConfig = getAgentConfig(agent.id);

      console.log(chalk.bold(`${agentConfig.displayName}:`));
      console.log(chalk.dim(`  Skills directory: ${path.join(projectDir, agent.skillsDir)}`));
      console.log(chalk.dim(`  Installed skills: ${agent.installedSkills.length}`));
      if (agentConfig.supportsSubagents) {
        console.log(chalk.dim(`  Subagents directory: ${path.join(projectDir, agent.subagentsDir)}`));
        console.log(chalk.dim(`  Installed subagents: ${agent.installedSubagents.length}`));
      }
      console.log('');
    }

    // Global MCP summary: the universal servers, then the engine bridges, one docs/env block for both
    if (enabledIds.length > 0) {
      if (answers.mcpServers.length > 0) {
        console.log(chalk.green(`  MCP servers configured: ${answers.mcpServers.join(', ')}`));
      }
      if (answers.engineBridges.length > 0) {
        console.log(chalk.green(`  Engine bridges: ${answers.engineBridges.join(', ')}`));
      }
      for (const line of getMcpDocsLines(discoveredServers, enabledIds)) {
        console.log(chalk.dim(`    ${line}`));
      }
      // What to prepare for the bridges (install the tool, add the package) and where the order is set.
      const setupLines = getBridgeSetupLines(discoveredServers, answers.engineBridges, projectDir);
      if (setupLines.length > 0) {
        console.log(chalk.bold('  Engine bridges:'));
        for (const line of setupLines) {
          console.log(chalk.dim(`    ${line}`));
        }
      }
      // Yellow, not dim: these are things the user has to do, not reference.
      for (const line of getMcpEnvLines(discoveredServers, enabledIds, answers.agents.map(a => a.id))) {
        console.log(chalk.yellow(`    ${line}`));
      }
      console.log('');
    }

    console.log(chalk.dim(`  Memory directory: ${memoryDir(projectDir)}`));
    console.log(chalk.dim(`  Rules: run /unikit to install (core + stack via registry)`));
    console.log(chalk.dim(`  Engine: ${engineId}`));
    console.log(chalk.dim(`  Note: run /unikit (in your AI agent) to bootstrap .unikit/config.yaml — it will ask for language and write paths/git/workflow defaults.`));
    console.log('');

    console.log(chalk.bold('Next steps:'));
    const onboardingByAgent = installedAgents.map(agent => ({
      agent,
      onboarding: getAgentOnboarding(agent.id),
    }));

    for (const [index, { agent, onboarding }] of onboardingByAgent.entries()) {
      const agentConfig = getAgentConfig(agent.id);

      console.log(chalk.dim(`  ${index + 1}. ${agentConfig.displayName}`));
      for (const line of onboarding.welcomeMessage) {
        console.log(chalk.dim(`     ${line}`));
      }
    }

    const invocationHints = onboardingByAgent
      .map(({ onboarding }) => onboarding.invocationHint)
      .filter(Boolean)
      .join('; ');

    console.log(chalk.dim(`  ${installedAgents.length + 1}. Use /unikit-plan and /unikit-commit for daily workflow${invocationHints ? ` (${invocationHints})` : ''}`));
    console.log('');

  } catch (error) {
    if ((error as Error).message?.includes('User force closed')) {
      console.log(chalk.yellow('\nSetup cancelled.'));
      return;
    }
    throw error;
  }
}
