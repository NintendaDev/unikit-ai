import inquirer from 'inquirer';
import chalk from 'chalk';
import { getAgentChoices } from '../../core/agents.js';
import { getEngineChoices, getAllEngineIds } from '../../core/engines.js';
import { discoverMcpServers } from '../../core/mcp.js';
import { normalizeRegistryUrl, validateRegistry } from '../../core/registry/validator.js';
import { OFFICIAL_REGISTRY_URL } from '../../core/registry/index.js';

export interface AgentWizardSelection {
  id: string;
}

export interface WizardAnswers {
  agents: AgentWizardSelection[];
  engine: string;
  mcpServers: string[];
  engineMcpKey: string | null;
  rulesRegistry: string;
}

export type EngineResolution =
  | { action: 'use'; engine: string }
  | { action: 'reselect'; warning: string }
  | { action: 'prompt' };

// Pure helper -- decides whether the init wizard should prompt for an engine,
// reuse the engine already stored in .unikit.json, or warn the user that the
// stored id is unknown and re-select. No I/O, no inquirer calls -- all side
// effects happen in runWizard based on the returned verdict.
// Whitespace around the stored id is tolerated because loadConfig does not
// trim this field on disk; the returned engine is always the trimmed form.
export function resolveExistingEngine(existingEngine: string | null): EngineResolution {
  if (existingEngine === null) {
    return { action: 'prompt' };
  }

  const trimmed = existingEngine.trim();
  const known = new Set(getAllEngineIds());
  if (known.has(trimmed)) {
    return { action: 'use', engine: trimmed };
  }

  return {
    action: 'reselect',
    warning: `Unknown engine "${existingEngine}" in .unikit.json -- please re-select.`,
  };
}

function isCustomRegistry(stored: string | null | undefined): boolean {
  if (!stored) return false;
  const trimmed = stored.trim();
  return trimmed.length > 0 && trimmed !== OFFICIAL_REGISTRY_URL;
}

// When the user declines a custom registry (or skips after a failed
// validation), `.unikit.json.rulesRegistry` is initialized with the literal
// official URL — NOT `null`. That way `rules status` / `rules registry show`
// always advertise a concrete source and users do not have to guess what
// "not configured" means. `unikit-ai rules registry reset` follows the same
// convention — after reset the field holds the official URL literal too.
// Legacy `null` values (from older projects) still load correctly because
// `resolveRegistryUrl()` maps them to the official URL at runtime; no
// migration is needed.
async function promptRulesRegistry(engineId: string, existingRegistry: string | null): Promise<string> {
  const isCustom = isCustomRegistry(existingRegistry);

  const { useCustom } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useCustom',
      message: 'Use a custom rules registry?',
      default: isCustom,
    },
  ]);

  if (!useCustom) {
    return OFFICIAL_REGISTRY_URL;
  }

  let firstAttempt = true;
  while (true) {
    const { rawSource } = await inquirer.prompt([
      {
        type: 'input',
        name: 'rawSource',
        message: 'Rules registry source (URL or absolute local path):',
        default: firstAttempt && isCustom ? existingRegistry : undefined,
        validate: (val: string) => val.trim().length > 0 || 'Source cannot be empty',
      },
    ]);
    firstAttempt = false;

    const normalized = await normalizeRegistryUrl((rawSource as string).trim());
    const result = await validateRegistry(normalized, engineId, 'soft');

    if (result.valid) {
      console.log(chalk.green(`✓ Registry is valid: ${normalized}`));
      return normalized;
    }

    if (result.code === 'ENGINE_NOT_FOUND' && result.manifest) {
      const available = Object.keys(result.manifest.engines).join(', ');
      console.log(chalk.red(
        `! This registry does not contain rules for engine "${engineId}". Available engines: ${available}.`,
      ));
    } else {
      console.log(chalk.red(`! Registry validation failed: ${result.error}`));
    }

    const { nextAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'nextAction',
        message: 'What next?',
        choices: [
          { name: 'Retry with a different source', value: 'retry' },
          { name: 'Skip (use the official registry)', value: 'skip' },
        ],
        default: 'retry',
      },
    ]);

    if (nextAction === 'skip') {
      return OFFICIAL_REGISTRY_URL;
    }
  }
}

export async function runWizard(
  defaultAgentIds: string[] = [],
  existingRulesRegistry: string | null = null,
  existingEngine: string | null = null,
): Promise<WizardAnswers> {
  console.log(chalk.dim('\n\u{1F4A1} Run /unikit after setup to analyze your project and generate project-relevant skills.\n'));

  const selectedByDefault = new Set(defaultAgentIds);

  // Step 1: Select agents (checkbox - multi-agent)
  // Render a single flat stable-first list. Stability is declared in
  // AgentConfig.isStable -- wizard reads the flag but does not classify
  // agents itself. Each row is `<padded name>   <colored tag>`, where the
  // tag is chalk.green('[Stable]') or chalk.yellow('[Beta]'). Padding is
  // computed against raw names (pre-chalk) so ANSI escape codes do not
  // skew String.length. The tag itself is not padded -- '[Beta]' ends two
  // columns left of '[Stable]' on purpose: the tag column aligns on its
  // LEFT edge (where the eye lands), so a ragged right edge is accepted.
  // Explicit pick of { name, value, checked } keeps the extra isStable
  // field from leaking into inquirer choice objects.
  const allChoices = getAgentChoices();
  const sorted = [...allChoices].sort((a, b) => Number(b.isStable) - Number(a.isStable));
  // Guard against an empty registry: Math.max(...[]) returns -Infinity and
  // would make padEnd a no-op without error, producing a silently misaligned
  // list. The validate() hook below already rejects zero selections, but
  // defending here keeps the render path total.
  const maxNameLen = sorted.length > 0 ? Math.max(...sorted.map(a => a.name.length)) : 0;

  type AgentChoice = { name: string; value: string; checked: boolean };
  const agentChoices: AgentChoice[] = sorted.map<AgentChoice>(a => {
    const padded = a.name.padEnd(maxNameLen, ' ');
    const tag = a.isStable ? chalk.green('[Stable]') : chalk.yellow('[Beta]');
    return {
      name: `${padded}   ${tag}`,
      value: a.value,
      checked: selectedByDefault.has(a.value),
    };
  });

  const { selectedAgents } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedAgents',
      message: 'Target AI agents:',
      choices: agentChoices,
      validate: (value: string[]) => {
        if (value.length === 0) {
          return 'Select at least one agent.';
        }

        return true;
      },
    },
  ]);

  const agentSelections: AgentWizardSelection[] = (selectedAgents as string[]).map(id => ({ id }));

  // Step 2: Select engine (list - mandatory, exactly one)
  // Reuse the engine already stored in .unikit.json when it is valid -- only
  // fresh inits or unknown ids trigger an interactive prompt. Changing the
  // engine retroactively is unsafe (rules/mcp/subagents/engine-templates are
  // engine-scoped), so the escape hatch is deleting .unikit.json.
  const engineResolution = resolveExistingEngine(existingEngine);
  let engine: string;

  if (engineResolution.action === 'use') {
    engine = engineResolution.engine;
    console.log(chalk.dim(`Engine: ${engine} (from .unikit.json)`));
  } else {
    if (engineResolution.action === 'reselect') {
      console.log(chalk.yellow(engineResolution.warning));
    }

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'engine',
        message: 'Game engine:',
        choices: getEngineChoices(),
        default: 'unity',
      },
    ]);
    engine = answer.engine as string;
  }

  console.log('');

  // Step 3: Rules registry (optional custom source)
  const rulesRegistry = await promptRulesRegistry(engine, existingRulesRegistry);

  console.log('');

  // Step 4: MCP servers (global, not per-agent)
  const discoveredServers = await discoverMcpServers(engine);
  const mcpServers: string[] = [];
  let engineMcpKey: string | null = null;

  if (discoveredServers.size > 0) {
    // Group servers by server.key (duplicate keys = alternative implementations)
    const groupedByKey = new Map<string, Array<{ fileId: string; displayName: string; isEngine: boolean }>>();
    for (const [fileId, server] of discoveredServers) {
      const group = groupedByKey.get(server.key);
      if (group) {
        group.push({ fileId, displayName: server.displayName, isEngine: server.isEngine });
      } else {
        groupedByKey.set(server.key, [{ fileId, displayName: server.displayName, isEngine: server.isEngine }]);
      }
    }

    // Separate unique keys (checkbox) from duplicate keys (radio groups)
    const uniqueKeyEntries: Array<{ fileId: string; displayName: string }> = [];
    const duplicateKeyGroups: Array<{ key: string; entries: Array<{ fileId: string; displayName: string }> }> = [];

    for (const [key, entries] of groupedByKey) {
      if (entries.length === 1) {
        uniqueKeyEntries.push(entries[0]);
      } else {
        duplicateKeyGroups.push({ key, entries });
      }
    }

    // Unique keys: checkbox (multi-select), all checked by default
    if (uniqueKeyEntries.length > 0) {
      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: 'Configure MCP servers:',
          choices: uniqueKeyEntries.map(entry => ({
            name: entry.displayName,
            value: entry.fileId,
            checked: true,
          })),
        },
      ]);

      mcpServers.push(...(selected as string[]));
    }

    // Duplicate keys: radio per group + Skip
    for (const group of duplicateKeyGroups) {
      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: `Select MCP server for "${group.key}":`,
          choices: [
            ...group.entries.map(entry => ({
              name: entry.displayName,
              value: entry.fileId,
            })),
            { name: chalk.dim('Skip'), value: '__skip__' },
          ],
        },
      ]);

      if (selected !== '__skip__') {
        mcpServers.push(selected as string);
      }
    }

    // Derive engineMcpKey from selected servers with isEngine=true
    for (const fileId of mcpServers) {
      const server = discoveredServers.get(fileId);
      if (server?.isEngine) {
        engineMcpKey = server.key;
        break;
      }
    }
  }

  // Rules (core + stack) are no longer installed by the wizard — the /unikit
  // skill Step 9 runs `unikit-ai rules install` (no args) silently for the
  // core whitelist and then drives stack rule selection through registry
  // lookup + /unikit-memory generators.

  return {
    agents: agentSelections,
    engine,
    mcpServers,
    engineMcpKey,
    rulesRegistry,
  };
}
