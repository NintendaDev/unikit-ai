import type inquirer from 'inquirer';
import type { UniKitConfig } from '../../core/config.js';
import type { ChainedRegistry } from '../../core/registry/index.js';
import type { DiscoveredServers } from '../../core/mcp.js';
import { activeProviderIds } from '../../core/provider-rule-selection.js';
import { PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES, PROVIDER_RULE_PENDING, providerRulePath } from '../../core/constants-provider-rules.js';
import { chooseProviderRules, collectProviderCandidates, isPromptCancellation, providerRuleChoices } from '../wizard/provider-rules.js';
import { isFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

export interface UpdateProviderDependencies {
  stdinTTY?: boolean;
  stdoutTTY?: boolean;
  prompt?: typeof inquirer.prompt;
}

/** Read-only preparation before extension/skill mutation. Choices are applied by the lifecycle later. */
export async function prepareUpdateProviderRules(projectDir: string, config: UniKitConfig, registry: ChainedRegistry,
  catalog: DiscoveredServers, deps: UpdateProviderDependencies = {}) {
  const ids = activeProviderIds(config).filter(id => config.rules.providerSelection?.[id] !== false);
  const candidates = await collectProviderCandidates(registry, config.engine, ids);
  const missing: string[] = [];
  for (const id of ids) {
    if (!(await isFile(providerRulePath(projectDir, id)))) missing.push(id);
  }
  const choices = providerRuleChoices(candidates, config.engine, missing, catalog);
  const interactive = Boolean(deps.stdinTTY ?? process.stdin.isTTY) && Boolean(deps.stdoutTTY ?? process.stdout.isTTY);
  logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.updatePending(interactive, choices.length));
  if (!choices.length) return { cancelled: false, decisions: {}, candidates };
  if (!interactive) {
    logWarn(PROVIDER_RULE_LOG, PROVIDER_RULE_PENDING);
    return { cancelled: false, decisions: {}, candidates };
  }
  try {
    const prompt = deps.prompt ?? (await import('inquirer')).default.prompt;
    const decisions = await chooseProviderRules(choices, prompt);
    return { cancelled: false, decisions, candidates };
  } catch (error) {
    if (!isPromptCancellation(error)) throw error;
    logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.updateCancelled);
    return { cancelled: true, decisions: {}, candidates };
  }
}
