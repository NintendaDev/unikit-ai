import type { RulesRegistry } from './index.js';
import type { FetchedReference, RegistryManifest, RegistryRule } from './manifest-types.js';
import { LATEST_SCHEMA } from './manifest-types.js';
import type { RuleOrigin } from '../config.js';
import { normalizeManifestToLatest } from './migrations/index.js';
import { CODE_MODULE_ID } from '../constants.js';
import { PROVIDER_CANDIDATE_SEPARATOR, PROVIDER_ID_PATTERN, PROVIDER_REFERENCE_PATTERN, PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES } from '../constants-provider-rules.js';
import { logInfo, logWarn } from '../../utils/log.js';

export interface RuleCandidate {
  rule: RegistryRule;
  origin: RuleOrigin;
  content: string;
  references: FetchedReference[];
}
export type RuleCandidateSnapshot = Map<string, RuleCandidate | null>;
export const candidateKey = (module: string, engine: string, tier: string, id: string): string =>
  [module, engine, tier, id].join(PROVIDER_CANDIDATE_SEPARATOR);

/** An operation-scoped cache, including failed manifests and negative candidate lookups. */
export class RuleCandidateResolver {
  readonly snapshot: RuleCandidateSnapshot = new Map();
  private readonly manifests = new Map<RulesRegistry, Promise<RegistryManifest | null>>();
  private readonly pending = new Map<string, Promise<RuleCandidate | null>>();

  constructor(private readonly sources: () => RulesRegistry[], private readonly originOf: (source: RulesRegistry) => RuleOrigin,
    private readonly fetchManifest: (source: RulesRegistry) => Promise<RegistryManifest | null> = source => source.fetchManifest()) {}

  async resolve(module: string, engine: string, tier: string, id: string): Promise<RuleCandidate | null> {
    const key = candidateKey(module, engine, tier, id);
    if (this.snapshot.has(key)) return this.snapshot.get(key)!;
    let pending = this.pending.get(key);
    if (!pending) {
      pending = this.find(module, engine, tier, id);
      this.pending.set(key, pending);
    }
    const candidate = await pending;
    this.snapshot.set(key, candidate);
    return candidate;
  }

  private manifest(source: RulesRegistry): Promise<RegistryManifest | null> {
    let result = this.manifests.get(source);
    if (!result) {
      result = this.fetchManifest(source).then(raw => {
        if (!raw || !Number.isInteger(raw.schema) || raw.schema < 1 || raw.schema > LATEST_SCHEMA) return null;
        return normalizeManifestToLatest(raw);
      }).catch(() => {
        logWarn(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.manifestUnavailable(this.originOf(source)));
        return null;
      });
      this.manifests.set(source, result);
    }
    return result;
  }

  private async find(module: string, engine: string, tier: string, id: string): Promise<RuleCandidate | null> {
    if (![module, engine, tier, id].every(part => PROVIDER_ID_PATTERN.test(part))) return null;
    for (const source of this.sources()) {
      const origin = this.originOf(source);
      logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.tryingOrigin(id, origin));
      try {
        const manifest = await this.manifest(source);
        const mod = manifest?.modules?.[module];
        const rows = module === CODE_MODULE_ID ? mod?.engines?.[engine]?.[tier as 'stack'] : mod?.tiers?.[tier];
        const rule = Array.isArray(rows) ? rows.find(row => row.id === id) : undefined;
        if (!rule || typeof rule.version !== 'string' || typeof rule.description !== 'string') {
          logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.noUsableRow(id, origin));
          continue;
        }
        const names = rule.references ?? [];
        if (!Array.isArray(names) || !names.every(name => typeof name === 'string' && PROVIDER_REFERENCE_PATTERN.test(name))) continue;
        const body = await source.fetchRule(module, engine, tier, id);
        const references = body ? await source.fetchReferences(module, engine, tier, id, names) : [];
        if (!body || typeof body.content !== 'string' || !names.every(name => references.some(ref => ref.filename === name && typeof ref.content === 'string'))) {
          logWarn(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.incompleteBundle(id, origin));
          continue;
        }
        logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.resolvedBundle(id, origin, names.length));
        return { rule: { ...rule, references: [...names] }, origin, content: body.content,
          references: names.map(name => ({ ...references.find(ref => ref.filename === name)! })) };
      } catch {
        logWarn(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.fetchFailed(id, origin));
      }
    }
    logInfo(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.noInstallableBundle(id));
    return null;
  }
}
