import chalk from 'chalk';
import path from 'path';
import { runWizard } from '../wizard/prompts.js';
import { buildManagedSkillsState, installSkills, removeSkillsByName } from '../../core/installer/skills.js';
import { resolveSkillPrune } from '../../core/skill-groups.js';
import { buildManagedSubagentsState, installSubagents } from '../../core/installer/subagents.js';
import { injectMcpRules } from '../../core/installer/mcp-injection.js';
import { installEngineTemplates, installCliContract, installGateResultContract, installDevPrinciples, installEngineMcpRules, installGamedesignSystemAssets, installGenreProfiles, installModulesYml } from '../../core/installer/system-assets.js';
import { memoryDir } from '../../core/constants.js';
import {
  saveConfig, configExists, loadConfig, readConfigVersion, getCurrentVersion, emptyRulesInstallation,
  type AgentInstallation, type UniKitConfig,
} from '../../core/config.js';
import { getMcpDocsLines, getMcpVerifiedStamps, discoverMcpServers, collectMcpRules, buildMcpServerMap } from '../../core/mcp.js';
import { reconcileMcpSettings } from '../../core/mcp-reconcile.js';
import { resolveSelectedEngineServer } from '../../core/mcp-rules.js';
import { swapMcpRecheckNotes } from '../../core/installer/mcp-notes.js';
import { getAgentConfig } from '../../core/agents.js';
import { getAgentOnboarding, cleanupAgentSetup } from '../../core/transformer.js';
import { removeDirectory } from '../../utils/fs.js';
import { runProjectMemoryMigrations } from '../../core/memory-migrations/index.js';
import { logInfo } from '../../utils/log.js';

async function removeAgentSetup(projectDir: string, agent: AgentInstallation): Promise<void> {
  await removeDirectory(path.join(projectDir, agent.skillsDir));
  await cleanupAgentSetup(agent.id, projectDir, agent.skillsDir);
}

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
  const projectVersion = await readConfigVersion(projectDir);
  logInfo('init', `running project migrations (currentVersion=${projectVersion ?? 'null'})`);
  const migrated = await runProjectMemoryMigrations(projectDir, projectVersion);
  logInfo('init', migrated.applied.length > 0
    ? `applied: [${migrated.applied.join(', ')}]`
    : 'no pending migrations');

  const hasExistingConfig = await configExists(projectDir);
  const existingConfig = hasExistingConfig ? await loadConfig(projectDir) : null;

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
    const existingInstalledSkills = existingConfig
      ? [...new Set(existingConfig.agents.flatMap(a => a.installedSkills))]
      : null;
    const answers = await runWizard(
      existingAgentIds,
      existingConfig?.rulesRegistry ?? null,
      existingConfig?.engine ?? null,
      existingInstalledSkills,
      // Same null-vs-array contract as existingInstalledSkills: without this a
      // re-init of a project that picked one engine MCP would silently switch to
      // whichever alternative sorts first once a second server ships under the
      // same key.
      existingConfig ? Object.keys(existingConfig.mcp.servers) : null,
    );
    const engineId = answers.engine;

    // Rules registry comes from the wizard (answers.rulesRegistry); validation was done there.

    // Remove deselected agents
    const selectedAgentIds = new Set(answers.agents.map(a => a.id));
    const removedAgents = (existingConfig?.agents ?? []).filter(a => !selectedAgentIds.has(a.id));

    if (removedAgents.length > 0) {
      console.log(chalk.dim('\nRemoving deselected agent setups...\n'));
      for (const removedAgent of removedAgents) {
        await removeAgentSetup(projectDir, removedAgent);
        console.log(chalk.yellow(`  Removed: ${removedAgent.id}`));
      }
    }

    // Re-init prune: for agents that remain selected, remove the skills the
    // user de-selected this run. Deselected agents are already fully removed
    // above (removeAgentSetup wipes the whole skillsDir); the install loop
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

    // The persisted form of the selection: `key → vendor code`. Built once,
    // here, so the source hashes and the config write cannot disagree about
    // which code each selected server was registered under.
    const mcpServerMap = buildMcpServerMap(discoveredServers, answers.mcpServers);

    for (const agentSelection of answers.agents) {
      const agentConfig = getAgentConfig(agentSelection.id);

      const installedSkills = await installSkills({
        projectDir,
        skillsDir: agentConfig.skillsDir,
        skills: answers.selectedSkills,
        agentId: agentSelection.id,
        engineId,
        engineMcpKey: answers.engineMcpKey,
      });

      const subagentFiles = agentConfig.supportsSubagents
        ? await installSubagents(projectDir, agentConfig.subagentsDir, { agentId: agentSelection.id, engineId, engineMcpKey: answers.engineMcpKey })
        : [];

      installedAgents.push({
        id: agentSelection.id,
        skillsDir: agentConfig.skillsDir,
        subagentsDir: agentConfig.subagentsDir,
        installedSkills,
        installedSubagents: subagentFiles,
      });
    }

    // Write the MCP settings file of every installed agent. Lifted out of the
    // per-agent install loop above so `init` and `update` drive one and the same
    // pass — see `mcp-reconcile.ts`.
    await reconcileMcpSettings(
      projectDir,
      discoveredServers,
      answers.mcpServers,
      installedAgents.map(agent => agent.id),
      // Re-init on a project that installed extensions: their settings keys must
      // stay off limits to the normalisation scan. `null` on a fresh install,
      // which has no extensions by definition.
      existingConfig,
    );

    // Install engine templates
    await installEngineTemplates(projectDir, engineId, installedAgents);

    // Inject MCP tool permissions
    console.log(chalk.dim('Injecting MCP tool permissions...\n'));
    const mcpAllowedTools = collectMcpRules(discoveredServers, answers.mcpServers);
    await injectMcpRules(projectDir, installedAgents, mcpAllowedTools);

    // Rules installation is deferred to the /unikit skill Step 9, which calls
    // `unikit-ai rules install` (no args — core whitelist bootstrap) and then
    // drives stack rule selection through registry lookup + /unikit-memory
    // generators. init only records an empty rules state so the skill can
    // populate it.

    // Build managed skills and subagents state per agent
    for (const agent of installedAgents) {
      agent.managedSkills = await buildManagedSkillsState(projectDir, agent, agent.installedSkills, engineId, answers.engineMcpKey, mcpServerMap);
      agent.managedSubagents = await buildManagedSubagentsState(projectDir, agent, agent.installedSubagents, engineId, answers.engineMcpKey, mcpServerMap);
    }

    const selectedEngineServer = resolveSelectedEngineServer(discoveredServers, answers.mcpServers);

    // Save config — rules.installed starts empty; /unikit Step 9 fills it.
    // genres.installed also starts empty; /unikit-gd-spec installs profiles later.
    const config: UniKitConfig = {
      version: getCurrentVersion(),
      engine: engineId,
      engineMcpKey: answers.engineMcpKey,
      rulesRegistry: answers.rulesRegistry,
      mcp: {
        servers: mcpServerMap,
      },
      agents: installedAgents,
      rules: {
        installed: emptyRulesInstallation(),
      },
      genres: {
        installed: [],
      },
    };
    // Park / restore the MCP findings log BEFORE the config write: the previous
    // selection is read from `existingConfig`, and `saveConfig` overwrites it.
    // Running this afterwards makes the swap a no-op and leaves the outgoing
    // server's findings active under the incoming one.
    //
    // The previous id is resolved against the PREVIOUS engine's catalog, not
    // `discoveredServers` (which was scanned for the newly chosen engine). An
    // engine switch is precisely the case the swap exists for, and resolving it
    // against the new catalog would find nothing and park nothing.
    const previousEngineServer = existingConfig
      ? resolveSelectedEngineServer(
          await discoverMcpServers(existingConfig.engine),
          Object.keys(existingConfig.mcp?.servers ?? {}),
        )
      : null;

    await swapMcpRecheckNotes(
      projectDir,
      previousEngineServer?.fileId ?? null,
      selectedEngineServer?.fileId ?? null,
    );

    await saveConfig(projectDir, config);

    console.log(chalk.green('✓ Configuration saved to .unikit.json'));

    // Install CLI contract for skill consumption
    await installCliContract(projectDir);

    // Install machine-readable gate-result contract (read by verify + review)
    await installGateResultContract(projectDir);

    // Deliver the rules tree of the selected engine MCP server
    await installEngineMcpRules(projectDir, selectedEngineServer);

    // Install engine development principles (shared system file)
    await installDevPrinciples(projectDir, engineId, answers.engineMcpKey);

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

    // Global MCP summary
    if (answers.mcpServers.length > 0) {
      console.log(chalk.green(`  MCP servers configured: ${answers.mcpServers.join(', ')}`));
      for (const line of getMcpDocsLines(discoveredServers, answers.mcpServers)) {
        console.log(chalk.dim(`    ${line}`));
      }
      // MCP versions are deliberately not pinned. Surfacing which version the
      // rules tree was measured against lets the user judge how far the server
      // has moved since — provenance, not a staleness warning.
      for (const stamp of getMcpVerifiedStamps(discoveredServers, answers.mcpServers)) {
        console.log(chalk.dim(`    ${stamp}`));
      }
      if (answers.engineMcpKey) {
        console.log(chalk.dim(`  Engine MCP: ${answers.engineMcpKey}`));
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
