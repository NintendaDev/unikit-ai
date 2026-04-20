// --- HybridRegistry: primary → official → bundled chain with coarse per-engine fallback ---
//
// Resolution chain (per engine):
//  1. Try primary (user-configured URL from .unikit.json.rulesRegistry)
//     - manifest.engines[engineId] exists? → use primary for ALL rules of this engine
//     - engine missing in primary → fallthrough to official
//     - fetch failed → fallthrough to official
//  2. Try official (hardcoded OFFICIAL_REGISTRY_URL)
//     - engine exists → use official
//     - fetch failed → fallthrough to bundled
//  3. Try bundled (FsRegistry over ./rules-registry, cloned at publish/CI/dev)
//     - engine exists → use bundled
//     - missing → null (no more fallbacks, caller decides)
//
// CRITICAL: coarse per-engine fallback, NOT per-rule.
// If primary covers an engine, ALL rules come from primary. No mixing.

import type { RulesRegistry } from './index.js';
import type { RegistryManifest, RegistryRule, RuleCategory, FetchedRule, FetchedReference } from './manifest-types.js';
import type { RuleOrigin } from '../config.js';
import { logInfo, logWarn } from '../../utils/log.js';

const TAG = 'HybridRegistry';

export class HybridRegistry implements RulesRegistry {
  readonly label: string;
  private readonly primary: RulesRegistry;
  private readonly official: RulesRegistry;
  private readonly bundled: RulesRegistry | null;
  private readonly engineId: string;

  // Cached decision: which registry won for this engine.
  private resolvedSource: RulesRegistry | null = null;
  private resolvedManifest: RegistryManifest | null = null;

  constructor(primary: RulesRegistry, official: RulesRegistry, engineId: string, bundled?: RulesRegistry) {
    this.primary = primary;
    this.official = official;
    this.bundled = bundled ?? null;
    this.engineId = engineId;
    const bundledLabel = this.bundled ? `→${this.bundled.label}` : '';
    this.label = `hybrid:[${primary.label}→${official.label}${bundledLabel}]`;
  }

  async fetchManifest(): Promise<RegistryManifest | null> {
    // Try primary first
    logInfo(TAG, `trying primary: ${this.primary.label}`);
    const primaryManifest = await this.primary.fetchManifest();

    if (primaryManifest && primaryManifest.engines && primaryManifest.engines[this.engineId]) {
      logInfo(TAG, `primary has engine ${this.engineId}, using primary`);
      this.resolvedSource = this.primary;
      this.resolvedManifest = primaryManifest;
      return primaryManifest;
    }

    if (primaryManifest) {
      logInfo(TAG, `primary reachable but engine ${this.engineId} not found, falling through to official`);
    } else {
      logInfo(TAG, `primary unreachable, falling through to official`);
    }

    // Fall through to official
    logInfo(TAG, `trying official: ${this.official.label}`);
    const officialManifest = await this.official.fetchManifest();

    if (officialManifest && officialManifest.engines && officialManifest.engines[this.engineId]) {
      logInfo(TAG, `official has engine ${this.engineId}, using official`);
      this.resolvedSource = this.official;
      this.resolvedManifest = officialManifest;
      return officialManifest;
    }

    if (officialManifest) {
      logInfo(TAG, `official reachable but engine ${this.engineId} not found, falling through to bundled`);
    } else {
      logInfo(TAG, `official unreachable, falling through to bundled`);
    }

    // Fall through to bundled (cloned ./rules-registry snapshot)
    if (this.bundled) {
      logInfo(TAG, `trying bundled: ${this.bundled.label}`);
      const bundledManifest = await this.bundled.fetchManifest();

      if (bundledManifest && bundledManifest.engines && bundledManifest.engines[this.engineId]) {
        logInfo(TAG, `bundled has engine ${this.engineId}, using bundled`);
        this.resolvedSource = this.bundled;
        this.resolvedManifest = bundledManifest;
        return bundledManifest;
      }

      logWarn(TAG, `bundled does not have engine ${this.engineId}`);
      this.resolvedSource = null;
      this.resolvedManifest = null;
      return bundledManifest ?? officialManifest ?? primaryManifest ?? null;
    }

    logWarn(TAG, `no bundled registry available, and neither primary nor official have engine ${this.engineId}`);
    this.resolvedSource = null;
    this.resolvedManifest = null;
    return officialManifest ?? primaryManifest ?? null;
  }

  async fetchRule(engineId: string, category: RuleCategory, ruleId: string): Promise<FetchedRule | null> {
    const source = await this.getResolvedSource();
    if (!source) {
      logWarn(TAG, `no resolved source for engine ${engineId}`);
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
      return [];
    }

    return source.fetchReferences(engineId, category, ruleId, filenames);
  }

  /** Get the registry that won for this engine. Calls fetchManifest() if not yet resolved. */
  private async getResolvedSource(): Promise<RulesRegistry | null> {
    if (this.resolvedSource) {
      return this.resolvedSource;
    }

    // Force resolution by fetching manifest
    await this.fetchManifest();
    return this.resolvedSource;
  }

  /** Returns which registry won: "primary", "official", "bundled", or null if all failed. */
  getResolvedOrigin(): RuleOrigin | null {
    if (!this.resolvedSource) return null;
    // When primary and official are the same instance (no custom URL), prefer "official" over "primary".
    if (this.resolvedSource === this.bundled) return 'bundled';
    if (this.primary === this.official) return 'official';
    if (this.resolvedSource === this.primary) return 'primary';
    return 'official';
  }

  /** Returns the cached manifest from the resolved source. */
  getResolvedManifest(): RegistryManifest | null {
    return this.resolvedManifest;
  }

  /** Get rules for the target engine from the resolved manifest. */
  getEngineRules(category: RuleCategory): RegistryRule[] {
    if (!this.resolvedManifest) return [];
    const engine = this.resolvedManifest.engines[this.engineId];
    if (!engine) return [];
    return engine[category] ?? [];
  }
}
