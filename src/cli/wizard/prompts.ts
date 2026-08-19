import type inquirer from 'inquirer';
import chalk from 'chalk';
import { getAgentChoices } from '../../core/agents.js';
import { getEngineChoices, getAllEngineIds, getEngineConfig } from '../../core/engines.js';
import { discoverMcpServers } from '../../core/mcp.js';
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

/** One row of the MCP picker — enough to render a choice and to order it. */
export interface McpChoiceEntry {
  fileId: string;
  displayName: string;
  isEngine: boolean;
  order?: number;
}

// Pure helper -- orders MCP choices deterministically: ascending `order`,
// entries without one last, ties broken by fileId. Since the shard corpus was
// retired this is the ONLY thing `order` still drives: one engine takes one
// engine server, so there is no longer any content to concatenate in a defined
// order. It matters more than cosmetics: inquirer's `type: 'list'` pre-selects
// the FIRST choice, so without a stable order the wizard's default MCP would
// vary with filesystem readdir order.
export function sortMcpChoices(entries: McpChoiceEntry[]): McpChoiceEntry[] {
  return [...entries].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    return a.fileId.localeCompare(b.fileId);
  });
}

// Pure helper -- checkbox pre-selection for a unique-key MCP server.
// `null` = fresh install (check everything, the historical default); an array =
// re-init, where we mirror what .unikit.json says is installed. Same semantics
// as existingInstalledSkills for the skill picker. An empty array is NOT
// "fresh": it means nothing was selected before, so nothing is pre-checked.
export function isMcpPreselected(fileId: string, existingMcpServers: string[] | null): boolean {
  return existingMcpServers ? existingMcpServers.includes(fileId) : true;
}

// Pure helper -- radio `default` for one duplicate-key group, as an INDEX into
// the already-sorted entries (inquirer accepts either the value or the index;
// the index keeps this independent of the choice-value encoding).
// `undefined` = do not pass a default, which lets inquirer pre-select the first
// choice, i.e. the `order: 1` recommendation. Returned both for a fresh install
// and when nothing from this group was previously installed -- "the user skipped
// this group last time" and "there was no choice to make last time" are
// indistinguishable on disk, and silently pre-selecting Skip (thereby disabling
// an MCP on a blind Enter) is worse than re-offering the recommended server.
export function resolveMcpGroupDefault(
  sortedEntries: McpChoiceEntry[],
  existingMcpServers: string[] | null,
): number | undefined {
  if (!existingMcpServers) return undefined;

  const index = sortedEntries.findIndex(entry => existingMcpServers.includes(entry.fileId));

  return index === -1 ? undefined : index;
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
  existingMcpServers: string[] | null = null,
): Promise<WizardAnswers> {
  const inquirer = await loadInquirer();
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

  // Step 5: MCP servers (global, not per-agent)
  const discoveredServers = await discoverMcpServers(engine);
  const mcpServers: string[] = [];
  let engineMcpKey: string | null = null;

  if (discoveredServers.size > 0) {
    // The picker has exactly two shapes, and the split is `is_engine` + the
    // catalog directory the server was scanned out of:
    //
    //   - ENGINE servers of one directory are alternatives — a project takes one
    //     of them — so they render as a radio with a Skip. `mcp/godot/` holds
    //     three, and `godot` / `godot-net` share that directory, which is why the
    //     grouping is by directory and not by engine id.
    //   - everything else is additive and renders as a checkbox.
    //
    // Before 1.2.0 the axis was `server.key`, which worked only while the
    // alternatives of one engine were made to share a key by hand. Since `key`
    // became each JSON's own basename that is no longer true of any of them, and
    // grouping on it would put every engine server in its own group of one — a
    // checkbox offering three mutually exclusive Godot servers at once.
    const engineGroups = new Map<string, McpChoiceEntry[]>();
    const standaloneEntries: McpChoiceEntry[] = [];

    for (const [fileId, server] of discoveredServers) {
      const entry: McpChoiceEntry = {
        fileId,
        displayName: server.displayName,
        isEngine: server.isEngine,
        ...(server.order === undefined ? {} : { order: server.order }),
      };

      if (!server.isEngine || server.originDir === null) {
        standaloneEntries.push(entry);
        continue;
      }

      const group = engineGroups.get(server.originDir);
      if (group) {
        group.push(entry);
      } else {
        engineGroups.set(server.originDir, [entry]);
      }
    }

    // A directory holding exactly one engine server has no choice to offer:
    // fold it into the checkbox rather than rendering a one-option radio.
    const uniqueKeyEntries: McpChoiceEntry[] = [...standaloneEntries];
    const duplicateKeyGroups: Array<{ entries: McpChoiceEntry[] }> = [];

    for (const [dir, entries] of engineGroups) {
      logInfo('wizard:mcp', `engine group "${dir}": ${entries.map(e => e.fileId).join(', ')}`);
      if (entries.length === 1) {
        uniqueKeyEntries.push(entries[0]);
      } else {
        // Sorted here, once: the radio's `default` (Task 23) is an INDEX into
        // this array, so ordering must be settled before it is computed.
        duplicateKeyGroups.push({ entries: sortMcpChoices(entries) });
      }
    }
    logInfo('wizard:mcp', `checkbox group: ${uniqueKeyEntries.map(e => e.fileId).join(', ') || '(empty)'}`);

    // Unique keys: checkbox (multi-select), all checked by default
    if (uniqueKeyEntries.length > 0) {
      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: 'Configure MCP servers:',
          choices: sortMcpChoices(uniqueKeyEntries).map(entry => ({
            name: entry.displayName,
            value: entry.fileId,
            checked: isMcpPreselected(entry.fileId, existingMcpServers),
          })),
        },
      ]);

      mcpServers.push(...(selected as string[]));
    }

    // Engine alternatives: radio per group + Skip
    for (const group of duplicateKeyGroups) {
      // `default` is omitted (not set to undefined explicitly) when there is
      // nothing to restore, so inquirer falls back to the first choice -- the
      // `order: 1` recommendation.
      const groupDefault = resolveMcpGroupDefault(group.entries, existingMcpServers);
      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          // The label is the ENGINE's display name, assigned rather than
          // derived. It used to be the shared `key` ("UnityMCP"), which no
          // longer exists as a concept; the directory that replaced it as the
          // grouping axis is a package-layout detail ("mcp/unity") and printing
          // it would leak our folder names at the user. `engine` is the id the
          // user just picked, so this is the one name in play they already know.
          message: `Select MCP server for "${getEngineConfig(engine).displayName}":`,
          choices: [
            ...group.entries.map(entry => ({
              name: entry.displayName,
              value: entry.fileId,
            })),
            { name: chalk.dim('Skip'), value: '__skip__' },
          ],
          ...(groupDefault === undefined ? {} : { default: groupDefault }),
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
        engineMcpKey = server.code;
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
    selectedSkills: selectedSkills as string[],
    mcpServers,
    engineMcpKey,
    rulesRegistry,
  };
}
