import type inquirer from 'inquirer';
import type { ChainedRegistry } from '../../core/registry/index.js';
import type { ProviderRuleSelection } from '../../core/provider-rule-selection.js';
import { candidateKey, type RuleCandidateSnapshot } from '../../core/registry/rule-candidate.js';
import { CODE_MODULE_ID, RULE_FETCH_CONCURRENCY } from '../../core/constants.js';
import {
  PROVIDER_RULE_TIER, PROVIDER_RULE_LOG, PROVIDER_RULE_PROMPT, PROVIDER_RULE_CANCELLED,
  PROVIDER_RULE_MESSAGES, PROVIDER_PROMPT_EXIT_ERROR, PROVIDER_PROMPT_CANCEL_MARKER,
} from '../../core/constants-provider-rules.js';
import { logInfo } from '../../utils/log.js';
import { mapWithConcurrency } from '../../utils/concurrency.js';

export class ProviderRuleSelectionCancelled extends Error {
  constructor() { super(PROVIDER_RULE_CANCELLED); }
}

export function isPromptCancellation(error: unknown): boolean {
  return error instanceof ProviderRuleSelectionCancelled || (error instanceof Error
    && (error.name === PROVIDER_PROMPT_EXIT_ERROR || error.message.includes(PROVIDER_PROMPT_CANCEL_MARKER)));
}

export async function collectProviderCandidates(registry: ChainedRegistry, engine: string, ids: string[]): Promise<RuleCandidateSnapshot> {
  const uniqueIds = [...new Set(ids)];
  const started = Date.now();
  logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.collecting(uniqueIds));
  const candidates = await mapWithConcurrency(uniqueIds, RULE_FETCH_CONCURRENCY,
    id => registry.resolveRuleCandidate(CODE_MODULE_ID, engine, PROVIDER_RULE_TIER, id));
  logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.collected(candidates.filter(Boolean).length, Date.now() - started));
  return new Map(uniqueIds.map((id, index) => [candidateKey(CODE_MODULE_ID, engine, PROVIDER_RULE_TIER, id), candidates[index]]));
}

export function providerRuleChoices(snapshot: RuleCandidateSnapshot, engine: string, ids: string[], catalog: ReadonlyMap<string, { shortName: string }>) {
  return [...new Set(ids)].flatMap(id => {
    const candidate = snapshot.get(candidateKey(CODE_MODULE_ID, engine, PROVIDER_RULE_TIER, id));
    return candidate ? [{ name: catalog.get(id)?.shortName ?? id, value: id, checked: true }] : [];
  });
}

/** No candidates is a confirmed no-op; a closed prompt never becomes a refusal. */
export async function chooseProviderRules(choices: ReturnType<typeof providerRuleChoices>, prompt: typeof inquirer.prompt): Promise<ProviderRuleSelection> {
  if (!choices.length) {
    logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.emptyChoices);
    return {};
  }
  logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.offering(choices.map(row => row.value)));
  const { providerRules } = await prompt<{ providerRules: string[] }>([
    { type: 'checkbox', name: 'providerRules', message: PROVIDER_RULE_PROMPT, choices },
  ]);
  if (!Array.isArray(providerRules)) throw new ProviderRuleSelectionCancelled();
  const selected = new Set(providerRules);
  const decisions = Object.fromEntries(choices.map(row => [row.value, selected.has(row.value)]));
  logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.confirmed(decisions));
  return decisions;
}
