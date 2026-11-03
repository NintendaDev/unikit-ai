import type { UniKitConfig } from './config.js';
import { CODE_MODULE_ID } from './constants.js';
import { PROVIDER_ID_PATTERN, PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES, PROVIDER_RULE_TIER, PROVIDER_RULE_EXTENSION, providerRulePath } from './constants-provider-rules.js';
import { isFile } from '../utils/fs.js';
import { logInfo } from '../utils/log.js';

export type ProviderRuleSelection = Record<string, boolean>;

/** Pure JSON normalization. Missing/malformed means undecided, never approval. */
export function normalizeProviderSelection(raw: unknown): ProviderRuleSelection | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.malformedSelection);
    return undefined;
  }
  const selection: ProviderRuleSelection = {};
  for (const [id, enabled] of Object.entries(raw)) {
    if (!PROVIDER_ID_PATTERN.test(id) || typeof enabled !== 'boolean') {
      logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.malformedDecision(id));
      continue;
    }
    Object.defineProperty(selection, id, { value: enabled, enumerable: true, writable: true, configurable: true });
  }
  return selection;
}

export function activeProviderIds(config: Pick<UniKitConfig, 'mcp' | 'engineBridges'>): string[] {
  return [...new Set([...Object.keys(config.mcp.servers), ...Object.keys(config.engineBridges.selected)])]
    .filter(id => PROVIDER_ID_PATTERN.test(id));
}

/** Disk-based legacy adoption is separate from config parsing; ownership comes from state. */
export async function adoptLegacyProviderSelection(projectDir: string, config: UniKitConfig): Promise<boolean> {
  let changed = false;
  for (const id of activeProviderIds(config)) {
    if (Object.hasOwn(config.rules.providerSelection ?? {}, id)) continue;
    const entry = config.rules.installed.modules[CODE_MODULE_ID]?.[PROVIDER_RULE_TIER]?.find(row => row.name === id || row.name === `${id}${PROVIDER_RULE_EXTENSION}`);
    if (entry?.source !== 'registry' || !(await isFile(providerRulePath(projectDir, id)))) continue;
    config.rules.providerSelection ??= {};
    config.rules.providerSelection[id] = true;
    changed = true;
    logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.legacyApproved(id));
  }
  return changed;
}
