import type inquirer from 'inquirer';
import chalk from 'chalk';
import { getAgentChoices, getAgentConfig } from '../../core/agents.js';
import { getEngineChoices, getAllEngineIds, getEngineConfig } from '../../core/engines.js';
import { describeSharedSkillsDir } from '../../core/agent-skills-dir.js';
import { discoverMcpServers, type BridgeKind } from '../../core/mcp.js';
import { detectBridge, type DetectContext } from '../../core/bridges/detect.js';
import { getAvailableSkills } from '../../core/installer/skills.js';
import { groupSkills, findUngrouped, resolveSkillDefaults } from '../../core/skill-groups.js';
import { normalizeRegistryUrl, validateRegistry, manifestEngineIds } from '../../core/registry/validator.js';
import { OFFICIAL_REGISTRY_URL } from '../../core/registry/index.js';
import { logInfo } from '../../utils/log.js';

// `inquirer` is ~240ms of module graph, and only the interactive prompts below
// ever touch it -- a non-interactive `unikit-ai update` or `rules *` used to pay
// that cost on every invocation just because this module sits on the static
// import chain from `cli/index.ts`. The import above is type-only (erased at
// compile time); the value is pulled in on first prompt and cached for the
// rest of the process, so each consuming function opens with a local
// `const inquirer = await loadInquirer()` and its call sites read unchanged.
let inquirerModule: typeof inquirer | null = null;

async function loadInquirer(): Promise<typeof inquirer> {
  inquirerModule ??= (await import('inquirer')).default;
  return inquirerModule;
}

export interface AgentWizardSelection {
  id: string;
}

export interface WizardAnswers {
  agents: AgentWizardSelection[];
  engine: string;
  selectedSkills: string[];
  /** Universal MCP servers only; the engine's bridges are in {@link WizardAnswers.engineBridges}. */
  mcpServers: string[];
  /** Engine bridges (file ids), any number; the order between them is kept in `.unikit/bridges.yaml`. */
  engineBridges: string[];
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

// Pure helper -- the verdict of the agent checkbox: at least one agent, and no two that would
// install skills into one directory (core/agent-skills-dir.ts). `true` accepts the selection;
// a string is shown to the user and keeps the prompt open.
export function validateAgentSelection(agentIds: string[]): true | string {
  if (agentIds.length === 0) {
    return 'Select at least one agent.';
  }

  return describeSharedSkillsDir(agentIds.map(id => getAgentConfig(id))) ?? true;
}

/** One row of the MCP picker — enough to render a choice and to order it. */
export interface McpChoiceEntry {
  fileId: string;
  displayName: string;
  isEngine: boolean;
  /** Absent = `mcp`. */
  kind?: BridgeKind;
  order?: number;
  /** `false` = unchecked on a fresh install (the catalog's `preselect`). */
  preselect?: boolean;
}

// Pure helper -- orders MCP choices deterministically: ascending `order`,
// entries without one last, ties broken by fileId. It is the presentation order
// of both checkbox groups and, for the bridges, the package default that
// `defaultBridgeIds` reads: without a stable order the bridge checked on a fresh
// install would vary with filesystem readdir order.
export function sortMcpChoices(entries: McpChoiceEntry[]): McpChoiceEntry[] {
  return [...entries].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    return a.fileId.localeCompare(b.fileId);
  });
}

// Pure helper -- checkbox pre-selection for a universal MCP server.
// `null` = fresh install (check everything, the historical default); an array =
// re-init, where we mirror what .unikit.json says is installed. Same semantics
// as existingInstalledSkills for the skill picker. An empty array is NOT
// "fresh": it means nothing was selected before, so nothing is pre-checked.
// `preselect` is the catalog's own field: `false` keeps a server that needs a
// token unchecked on a fresh install; a re-init still mirrors the last choice.
export function isMcpPreselected(fileId: string, existingMcpServers: string[] | null, preselect?: boolean): boolean {
  return existingMcpServers ? existingMcpServers.includes(fileId) : preselect !== false;
}

// Pure helper -- the bridge checkbox on a fresh install: the first MCP-kind bridge in the package
// order is checked, the others are not. That is what the radio's `order: 1` used to mean. A bridge of
// another kind is never checked by position; it is checked when detection found it on this machine
// (`detected`, from `detectBridge`), and then in addition to the first MCP bridge.
export function defaultBridgeIds(entries: McpChoiceEntry[], detected: ReadonlySet<string> = new Set()): Set<string> {
  const first = sortMcpChoices(entries).find(entry => (entry.kind ?? 'mcp') === 'mcp');
  return new Set([...(first ? [first.fileId] : []), ...detected]);
}

/** Added to the label of a bridge that detection found, so the user sees why it is already ticked. */
const DETECTED_LABEL_SUFFIX = ' — found on this machine';

// Pure helper -- checkbox pre-selection for one bridge. `null` = fresh install (the defaults); an
// array = re-init, where we mirror what .unikit.json says the project had. An empty array is NOT
// "fresh": it means no bridge was selected before, so none is pre-checked.
export function isBridgePreselected(fileId: string, existingBridges: string[] | null, defaults: Set<string>): boolean {
  return existingBridges ? existingBridges.includes(fileId) : defaults.has(fileId);
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
  const inquirer = await loadInquirer();
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
      const available = manifestEngineIds(result.manifest).join(', ');
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
  existingInstalledSkills: string[] | null = null,
  existingSelection: { mcp: string[]; bridges: string[] } | null = null,
): Promise<WizardAnswers> {
  const inquirer = await loadInquirer();
  console.log(chalk.dim('\n\u{1F4A1} Run /unikit after setup to analyze your project and generate project-relevant skills.\n'));

  const selectedByDefault = new Set(defaultAgentIds);

  // Step 1: Select agents (checkbox - multi-agent)
  // One flat list in registry order. There is no stability tag: every supported agent is
  // treated as stable.
  type AgentChoice = { name: string; value: string; checked: boolean };
  const agentChoices: AgentChoice[] = getAgentChoices().map<AgentChoice>(a => ({
    name: a.name,
    value: a.value,
    checked: selectedByDefault.has(a.value),
  }));

  const { selectedAgents } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedAgents',
      message: 'Target AI agents:',
      choices: agentChoices,
      validate: validateAgentSelection,
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

  // Step 3: Select skills (grouped checkbox)
  // All interactivity lives here in the wizard layer; installer/skills.ts stays
  // prompt-free and receives an already-resolved skill set. Group membership and
  // default selection are pure functions (skill-groups.ts) so the risky default/
  // prune logic stays guard-testable. `existingInstalledSkills === null` means a
  // fresh install (everything checked); an array means re-init (mirror what was
  // installed). An empty array is NOT "fresh" -- it means the user previously
  // had nothing selected, so nothing is pre-checked.
  const availableSkills = await getAvailableSkills();
  const defaultChecked = new Set(resolveSkillDefaults(availableSkills, existingInstalledSkills));

  type SkillChoice = { name: string; value: string; checked: boolean };
  const skillChoices: Array<SkillChoice | InstanceType<typeof inquirer.Separator>> = [];
  for (const { group, skills } of groupSkills(availableSkills)) {
    skillChoices.push(new inquirer.Separator(`-- ${group.title} --`));
    for (const skill of skills) {
      skillChoices.push({ name: skill, value: skill, checked: defaultChecked.has(skill) });
    }
  }

  // Defensive: a skill shipped without a group assignment must never be
  // silently hidden from the picker. The guard test keeps this set empty, but
  // if it ever fires we surface the stragglers under an "Other" section rather
  // than dropping them.
  const ungroupedSkills = findUngrouped(availableSkills);
  if (ungroupedSkills.length > 0) {
    console.log(chalk.yellow(`Note: ungrouped skills listed under "Other": ${ungroupedSkills.join(', ')}`));
    skillChoices.push(new inquirer.Separator('-- Other --'));
    for (const skill of ungroupedSkills) {
      skillChoices.push({ name: skill, value: skill, checked: defaultChecked.has(skill) });
    }
  }

  const { selectedSkills } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSkills',
      message: 'Skills to install:',
      choices: skillChoices,
      validate: (value: string[]) => value.length > 0 || 'Select at least one skill.',
    },
  ]);

  console.log('');

  // Step 4: Rules registry (optional custom source)
  const rulesRegistry = await promptRulesRegistry(engine, existingRulesRegistry);

  console.log('');

  // Step 5: universal MCP servers and engine bridges (global, not per-agent)
  //
  // Two groups of checkboxes, split by `is_engine`: the universal servers (Context7, GitHub) and the
  // bridges of the engine. A project takes any number of bridges, so there is no radio and no Skip;
  // the order between them is not asked here -- it lives in `.unikit/bridges.yaml`, which init and
  // update keep in step with the selection. The catalog folder an entry came from
  // no longer groups anything: the bridges of one engine are one group by construction.
  const discoveredServers = await discoverMcpServers(engine);
  const mcpServers: string[] = [];
  const engineBridges: string[] = [];

  if (discoveredServers.size > 0) {
    const universal: McpChoiceEntry[] = [];
    const bridges: McpChoiceEntry[] = [];

    for (const [fileId, server] of discoveredServers) {
      const entry: McpChoiceEntry = {
        fileId,
        displayName: server.displayName,
        isEngine: server.isEngine,
        kind: server.kind,
        ...(server.order === undefined ? {} : { order: server.order }),
        ...(server.preselect === undefined ? {} : { preselect: server.preselect }),
      };
      (server.isEngine ? bridges : universal).push(entry);
    }
    logInfo('wizard:mcp', `universal: ${universal.map(e => e.fileId).join(', ') || '(none)'}; bridges: ${bridges.map(e => e.fileId).join(', ') || '(none)'}`);

    const uncheckedIds = universal.filter(e => e.preselect === false).map(e => e.fileId);
    if (uncheckedIds.length > 0) {
      logInfo('wizard:mcp', `unchecked by default: ${uncheckedIds.join(', ')}`);
    }

    // Universal servers: checkbox, all checked by default except those that ask for a token
    if (universal.length > 0) {
      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: 'Configure universal MCP servers:',
          choices: sortMcpChoices(universal).map(entry => ({
            name: entry.displayName,
            value: entry.fileId,
            checked: isMcpPreselected(entry.fileId, existingSelection?.mcp ?? null, entry.preselect),
          })),
        },
      ]);

      mcpServers.push(...(selected as string[]));
    }

    // Engine bridges: checkbox; a fresh install checks the first MCP bridge of the package order
    if (bridges.length > 0) {
      // Detection only reads PATH and the version file of the project; it runs nothing (REQ-5).
      const context: DetectContext = { projectDir: process.cwd(), env: process.env, platform: process.platform };
      const detected = new Set<string>();
      for (const bridge of bridges) {
        const server = discoveredServers.get(bridge.fileId);
        if (server && await detectBridge(server, context)) detected.add(bridge.fileId);
      }
      logInfo('wizard:mcp', `detected: ${[...detected].join(', ') || '(none)'}`);

      const defaults = defaultBridgeIds(bridges, detected);
      logInfo('wizard:mcp', `bridges checked by default: ${[...defaults].join(', ') || '(none)'}`);
      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          // The label is the ENGINE's display name, assigned rather than derived: `engine` is the id
          // the user just picked, the one name in play they already know. The package folder
          // ("engine-bridges/unity") is a layout detail and stays out of the prompt.
          message: `Engine bridges for "${getEngineConfig(engine).displayName}" (pick any number; the order is kept in .unikit/bridges.yaml):`,
          choices: sortMcpChoices(bridges).map(entry => ({
            name: detected.has(entry.fileId) ? `${entry.displayName}${DETECTED_LABEL_SUFFIX}` : entry.displayName,
            value: entry.fileId,
            checked: isBridgePreselected(entry.fileId, existingSelection?.bridges ?? null, defaults),
          })),
        },
      ]);

      engineBridges.push(...(selected as string[]));
    }
  }

  // Rules (core + stack) are no longer installed by the wizard — the /unikit
  // skill Step 9 runs `unikit-ai rules install` (no args) silently for the
  // core whitelist and then drives stack rule selection through registry
  // lookup + /unikit-memory generators.

  return {
    agents: agentSelections,
    engine,
    selectedSkills: selectedSkills as string[],
    mcpServers,
    engineBridges,
    rulesRegistry,
  };
}
