import chalk from 'chalk';
import path from 'path';
import { runWizard } from '../wizard/prompts.js';
import {
  buildManagedSkillsState, buildManagedSubagentsState,
  installSkills, installSubagents, injectMcpRules,
  installEngineTemplates, getAvailableSkills, installCliContract, installDevPrinciples,
} from '../../core/installer.js';
import {
  saveConfig, configExists, loadConfig, getCurrentVersion,
  type AgentInstallation,
} from '../../core/config.js';
import { configureMcp, getMcpInstructions, discoverMcpServers, collectMcpRules } from '../../core/mcp.js';
import { getAgentConfig } from '../../core/agents.js';
import { getAgentOnboarding, cleanupAgentSetup } from '../../core/transformer.js';
import { removeDirectory } from '../../utils/fs.js';

async function removeAgentSetup(projectDir: string, agent: AgentInstallation): Promise<void> {
  await removeDirectory(path.join(projectDir, agent.skillsDir));
  await cleanupAgentSetup(agent.id, projectDir, agent.skillsDir);
}

export async function initCommand(): Promise<void> {
  const projectDir = process.cwd();

  console.log(chalk.bold.blue('\n🎮 UniKit — AI-powered game development toolkit\n'));

  const hasExistingConfig = await configExists(projectDir);
  const existingConfig = hasExistingConfig ? await loadConfig(projectDir) : null;

  if (hasExistingConfig) {
    console.log(chalk.yellow('Warning: .unikit.json already exists.'));
    console.log('Running init will reconfigure selected agents (add/remove) and reinstall all components.\n');
  }

  try {
    const existingAgentIds = existingConfig?.agents.map(a => a.id) ?? [];
    const answers = await runWizard(
      existingAgentIds,
      existingConfig?.rulesRegistry ?? null,
      existingConfig?.engine ?? null,
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

    // Install skills & agents per agent
    console.log(chalk.dim('\nInstalling skills and agents...\n'));

    const availableSkills = await getAvailableSkills();
    const installedAgents: AgentInstallation[] = [];

    // Discover MCP servers for the selected engine
    const discoveredServers = await discoverMcpServers(engineId);

    for (const agentSelection of answers.agents) {
      const agentConfig = getAgentConfig(agentSelection.id);

      const installedSkills = await installSkills({
        projectDir,
        skillsDir: agentConfig.skillsDir,
        skills: availableSkills,
        agentId: agentSelection.id,
        engineId,
        engineMcpKey: answers.engineMcpKey,
      });

      const subagentFiles = agentConfig.supportsSubagents
        ? await installSubagents(projectDir, agentConfig.subagentsDir, { agentId: agentSelection.id, engineId, engineMcpKey: answers.engineMcpKey })
        : [];

      // Configure MCP per agent (writes to agent's settings file)
      await configureMcp(
        projectDir,
        discoveredServers,
        answers.mcpServers,
        agentSelection.id,
      );

      installedAgents.push({
        id: agentSelection.id,
        skillsDir: agentConfig.skillsDir,
        subagentsDir: agentConfig.subagentsDir,
        installedSkills,
        installedSubagents: subagentFiles,
      });
    }

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
      agent.managedSkills = await buildManagedSkillsState(projectDir, agent, agent.installedSkills, engineId);
      agent.managedSubagents = await buildManagedSubagentsState(projectDir, agent, agent.installedSubagents, engineId);
    }

    // Save config — rules.installed starts empty; /unikit Step 9 fills it.
    await saveConfig(projectDir, {
      version: getCurrentVersion(),
      engine: engineId,
      engineMcpKey: answers.engineMcpKey,
      rulesRegistry: answers.rulesRegistry,
      mcp: {
        servers: answers.mcpServers,
      },
      agents: installedAgents,
      rules: {
        installed: {
          version: getCurrentVersion(),
          core: [],
          stack: [],
        },
      },
    });

    console.log(chalk.green('✓ Configuration saved to .unikit.json'));

    // Install CLI contract for skill consumption
    await installCliContract(projectDir);

    // Install engine development principles (shared system file)
    await installDevPrinciples(projectDir, engineId, answers.engineMcpKey);

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
      const instructions = getMcpInstructions(discoveredServers, answers.mcpServers);
      for (const instruction of instructions) {
        console.log(chalk.dim(`    ${instruction}`));
      }
      if (answers.engineMcpKey) {
        console.log(chalk.dim(`  Engine MCP: ${answers.engineMcpKey}`));
      }
      console.log('');
    }

    console.log(chalk.dim(`  Memory directory: ${path.join(projectDir, '.unikit', 'memory')}`));
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
