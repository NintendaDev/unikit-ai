// --- ChainedRegistry: abstract base for fallback-chain registries ---
//
// Shared resolution contract for registries that iterate over an ordered
// chain of `RulesRegistry` sources (primary → official → bundled, or
// official → bundled). Subclasses describe the chain via `chain()` and
// the label/origin semantics; fetch* and getEngineRules come from here.
//
// Resolution contract (per engine, first match wins):
//  1. Walk `chain()` in order.
//  2. On each step, if the source returns a manifest whose
//     `engines[engineId]` is defined, the source is adopted — cached as
//     `resolvedSource` / `resolvedManifest` and returned immediately.
//  3. If the source returns a non-null manifest without the engine, we
//     keep it as `lastSeenManifest` and continue — callers downstream
//     (e.g. `rulesInstallCommand`) need a non-null manifest to distinguish
//     "engine missing" (exit 5) from "chain unreachable" (exit 2).
//  4. If the source returns null (fetch failed), `lastSeenManifest` is
//     left untouched so a transient failure late in the chain cannot
//     overwrite an earlier success.
//  5. Once the chain is exhausted without a match, we return
//     `lastSeenManifest` (possibly null if every source failed).

import type { RulesRegistry } from './index.js';
import type { RuleOrigin } from '../config.js';
import type {
  RegistryManifest,
  RegistryRule,
  RuleCategory,
  FetchedRule,
  FetchedReference,
} from './manifest-types.js';
import { logInfo, logWarn } from '../../utils/log.js';

export abstract class ChainedRegistry implements RulesRegistry {
  protected readonly engineId: string;
  protected resolvedSource: RulesRegistry | null = null;
  protected resolvedManifest: RegistryManifest | null = null;

  protected constructor(engineId: string) {
    this.engineId = engineId;
  }

  abstract readonly label: string;
  protected abstract chain(): RulesRegistry[];
  // Hardcoded per-subclass string, not `this.constructor.name`. Bundlers
  // that mangle class names (terser with `keep_classnames=false`) would
  // otherwise render logs as `[INFO][_]` and break grep triage.
  protected abstract readonly logTag: string;
  abstract getResolvedOrigin(): RuleOrigin | null;

  async fetchManifest(): Promise<RegistryManifest | null> {
    const tag = this.logTag;
    const sources = this.chain();
    let lastSeenManifest: RegistryManifest | null = null;

    for (const source of sources) {
      logInfo(tag, `trying ${source.label}`);
      const manifest = await source.fetchManifest();

      if (manifest && manifest.engines && manifest.engines[this.engineId]) {
        logInfo(tag, `${source.label} has engine ${this.engineId}, using it`);
        this.resolvedSource = source;
        this.resolvedManifest = manifest;
        return manifest;
      }

      if (manifest) {
        logInfo(tag, `${source.label} reachable but engine ${this.engineId} not found`);
        lastSeenManifest = manifest;
      } else {
        logInfo(tag, `${source.label} unreachable`);
      }
    }

    logWarn(tag, `chain exhausted without engine ${this.engineId}`);
    this.resolvedSource = null;
    this.resolvedManifest = null;
    return lastSeenManifest;
  }

  async fetchRule(engineId: string, category: RuleCategory, ruleId: string): Promise<FetchedRule | null> {
    const source = await this.getResolvedSource();
    if (!source) {
      logWarn(this.logTag, `no resolved source for engine ${engineId}`);
      return null;
    }
    return source.fetchRule(engineId, category, ruleId);
  }

  async fetchReferences(
    engineId: string,
    category: RuleCategory,
    ruleId: string,
    filenames: string[],
  ): Promise<FetchedReference[]> {
    const source = await this.getResolvedSource();
    if (!source) {
      logWarn(this.logTag, `no resolved source for engine ${engineId}`);
      return [];
    }
    return source.fetchReferences(engineId, category, ruleId, filenames);
  }

  getResolvedManifest(): RegistryManifest | null {
    return this.resolvedManifest;
  }

  getEngineRules(category: RuleCategory): RegistryRule[] {
    if (!this.resolvedManifest) return [];
    const engine = this.resolvedManifest.engines[this.engineId];
    if (!engine) return [];
    return engine[category] ?? [];
  }

  protected async getResolvedSource(): Promise<RulesRegistry | null> {
    if (this.resolvedSource) return this.resolvedSource;
    await this.fetchManifest();
    return this.resolvedSource;
  }
}
