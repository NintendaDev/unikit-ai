import path from 'path';
import semver from 'semver';
import type { UniKitConfig } from '../config.js';
import { getModuleTier } from '../config.js';
import { activeProviderIds } from '../provider-rule-selection.js';
import { CODE_MODULE_ID, REFERENCES_DIR_NAME } from '../constants.js';
import { PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES, PROVIDER_RULE_TIER, providerRulePath } from '../constants-provider-rules.js';
import type { ChainedRegistry } from '../registry/index.js';
import { candidateKey, type RuleCandidateSnapshot } from '../registry/rule-candidate.js';
import { getModule } from '../modules.js';
import { readTextFile } from '../../utils/fs.js';
import { logInfo } from '../../utils/log.js';
import { computeContentHash } from './shared.js';
import { installOneRule } from './rules-bootstrap.js';
import type { SyncRulesEvent } from './rules-sync.js';

export function approvedProviderIds(config: UniKitConfig): Set<string> {
  return new Set(activeProviderIds(config).filter(id => config.rules.providerSelection?.[id] === true));
}

/** Refresh existing files only. A snapshot's negative result is authoritative for this run. */
export async function syncApprovedProviderRules(projectDir: string, engine: string, config: UniKitConfig,
  registry: ChainedRegistry, events: SyncRulesEvent[], replace: boolean, snapshot?: RuleCandidateSnapshot): Promise<boolean> {
  let changed = false;
  const module = getModule(CODE_MODULE_ID)!;
  for (const id of approvedProviderIds(config)) {
    const entry = getModuleTier(config, CODE_MODULE_ID, PROVIDER_RULE_TIER).find(row => row.name === id);
    const file = providerRulePath(projectDir, id);
    const disk = await readTextFile(file);
    if (!entry || disk === null || (!replace && entry.source !== 'registry')) continue;
    const key = candidateKey(CODE_MODULE_ID, engine, PROVIDER_RULE_TIER, id);
    const candidate = snapshot?.has(key) ? snapshot.get(key) : await registry.resolveRuleCandidate(CODE_MODULE_ID, engine, PROVIDER_RULE_TIER, id);
    if (!candidate) {
      events.push({ kind: 'phase2:fetch-failed', tier: PROVIDER_RULE_TIER, name: id });
      logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.retainingFile(id));
      continue;
    }
    const diskHash = computeContentHash(disk);
    const modified = !entry.installed_hash || diskHash !== entry.installed_hash;
    if (modified && !replace) {
      events.push({ kind: 'phase2:skipped-local-mod', tier: PROVIDER_RULE_TIER, name: id });
      continue;
    }
    const refsMatch = (await Promise.all(candidate.references.map(async ref =>
      await readTextFile(path.join(path.dirname(file), REFERENCES_DIR_NAME, ref.filename)) === ref.content))).every(Boolean);
    if (!replace && diskHash === computeContentHash(candidate.content) && entry.origin === candidate.origin
      && entry.version === candidate.rule.version && refsMatch) {
      logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.unchangedBundle(id, candidate.origin));
      continue;
    }
    if (modified) events.push({ kind: 'phase2:overwrite-local-mod', tier: PROVIDER_RULE_TIER, name: id });
    if (replace && entry.version && semver.valid(entry.version) && semver.valid(candidate.rule.version)
      && semver.lt(candidate.rule.version, entry.version)) {
      events.push({ kind: 'phase2:downgrade', tier: PROVIDER_RULE_TIER, name: id,
        fromVersion: entry.version, toVersion: candidate.rule.version });
    }
    events.push({ kind: 'phase2:updating', tier: PROVIDER_RULE_TIER, name: id,
      fromVersion: entry.version, toVersion: candidate.rule.version, action: 'update' });
    await installOneRule(projectDir, config, registry, module,
      [{ tier: PROVIDER_RULE_TIER, rule: candidate.rule, origin: candidate.origin }], engine, id,
      { force: true, preferredTier: PROVIDER_RULE_TIER, prefetched: candidate });
    changed = true;
    logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.refreshedBundle(id, candidate.origin));
  }
  if (changed) events.push({ kind: 'phase2:updated' });
  return changed;
}
