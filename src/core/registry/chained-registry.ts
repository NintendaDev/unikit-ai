// --- ChainedRegistry: abstract base for fallback-chain registries ---
//
// Shared resolution contract for registries that iterate over an ordered chain
// of `RulesRegistry` sources (primary → official → bundled, or official →
// bundled). Subclasses describe the chain via `chain()` and the label/origin
// semantics; resolution, fetch*, and the rule accessors come from here.
//
// Resolution is PER MODULE and lazy. Each fetched manifest is normalized to the
// latest schema (`normalizeManifestToLatest`) before it is inspected, so a
// schema:1 source and a schema:2 source resolve identically. The requested
// module decides the gate:
//   - `code` (engine-partitioned) — a source is adopted only if its normalized
//     `modules.code.engines[engineId]` exists.
//   - non-engine modules (`gamedesign`) — adopted as soon as the module is
//     present, WITHOUT an engine gate.
// Resolution keys off the module the CALLER requested for module IDENTITY, so an
// unregistered module still resolves from a source that carries it. The
// resolution STRATEGY is selected from the module descriptor's `coreResolution`
// (`getModule`), defaulting to `module-winner` for unregistered modules — so the
// descriptor only chooses HOW to merge, never WHETHER an unknown module resolves.
//
// Two strategies (see `Module.coreResolution`):
//   - `module-winner` (default, `code`) — the first chain source carrying the
//     module wins outright; that one source provides every rule.
//   - `per-id-merge` (`gamedesign`) — the chain is NOT short-circuited at the
//     first carrier; the `core` tier is merged per rule id (studio override from
//     the custom/primary source over an official→bundled canonical backfill),
//     while non-`core` tiers take the custom source only. The per-id source map
//     drives `fetchRule`/`fetchReferences` and per-rule origin tagging.
//
// Per-module winners are cached in `resolvedByModule` (plus, for per-id-merge, a
// `merged` per-id catalog + source map). The `code` resolution is additionally
// surfaced through `resolvedSource` / `resolvedManifest` so the existing no-arg
// consumers (`getResolvedManifest`, `getEngineRules`, `getResolvedOrigin()`) keep
// working unchanged.
//
// Resolution contract — `module-winner` (per module, first match wins):
//  1. Walk `chain()` in order, normalizing each reachable manifest.
//  2. A source whose schema is newer than `LATEST_SCHEMA` is SKIPPED with a
//     one-shot warning — never silently treated as "module not found".
//  3. The first normalized manifest that carries the requested module is
//     adopted and cached.
//  4. A reachable manifest without the module is kept as `lastSeenManifest` so
//     callers can tell "module/engine missing" (exit 5) from "chain
//     unreachable" (exit 2).
//  5. On exhaustion we return `lastSeenManifest` (possibly null). If every
//     reachable source was rejected purely because its schema was too new, a
//     distinct summary warning is emitted instead of the generic one.

import type { RulesRegistry } from './index.js';
import type { RuleOrigin } from '../config.js';
import type {
  RegistryManifest,
  RegistryRule,
  EngineRules,
  RuleCategory,
  Tier,
  ModuleId,
  FetchedRule,
  FetchedReference,
} from './manifest-types.js';
import { LATEST_SCHEMA } from './manifest-types.js';
import { normalizeManifestToLatest } from './migrations/index.js';
import { CODE_MODULE_ID } from '../constants.js';
import { getModule } from '../modules.js';
import { logInfo, logWarn } from '../../utils/log.js';

/** The `core` tier name subject to per-id B-merge (vs custom-only tiers). */
const MERGE_TIER: Tier = 'core';
/** Key separator for the per-(tier,id) source map (NUL — never in a rule id). */
const RULE_KEY_SEP = '\u0000';
const ruleKey = (tier: Tier, ruleId: string): string => `${tier}${RULE_KEY_SEP}${ruleId}`;

/**
 * Per-id B-merge result for a `per-id-merge` module (e.g. `gamedesign`):
 *  - `rulesByTier` — the merged catalog rows per tier (core = canon list with
 *    studio overrides; non-core = custom-only).
 *  - `sourceByKey` — `ruleKey(tier,id)` → the chain source that provides that
 *    rule's CONTENT (custom for overrides/library, official/bundled for backfill).
 *    Drives per-rule `fetchRule`/`fetchReferences` and per-rule origin tagging.
 */
interface MergedModule {
  rulesByTier: Map<Tier, RegistryRule[]>;
  sourceByKey: Map<string, RulesRegistry>;
}

interface ResolvedModule {
  source: RulesRegistry;
  manifest: RegistryManifest;
  /** Present only for `per-id-merge` modules; absent for `module-winner`. */
  merged?: MergedModule;
}

export abstract class ChainedRegistry implements RulesRegistry {
  protected readonly engineId: string;
  /** Per-module resolution cache: module → winning source + its normalized manifest. */
  protected readonly resolvedByModule = new Map<ModuleId, ResolvedModule>();
  // Back-compat shadow of the `code` module's resolution.
  protected resolvedSource: RulesRegistry | null = null;
  protected resolvedManifest: RegistryManifest | null = null;
  // One-shot guard: `getResolvedSource` may re-enter `resolveModule`, so the
  // schema-too-new warning is flagged on the instance to fire at most once.
  private schemaWarned = false;

  protected constructor(engineId: string) {
    this.engineId = engineId;
  }

  abstract readonly label: string;
  protected abstract chain(): RulesRegistry[];
  // Hardcoded per-subclass string, not `this.constructor.name`. Bundlers
  // that mangle class names (terser with `keep_classnames=false`) would
  // otherwise render logs as `[INFO][_]` and break grep triage.
  protected abstract readonly logTag: string;
  // Optional `module` param; the concrete default (`CODE_MODULE_ID`) is supplied
  // by the subclass implementation, so no-arg callers get the code-module origin.
  abstract getResolvedOrigin(module?: ModuleId): RuleOrigin | null;
  // Map a chain source to its origin label. Lives in the subclass because the
  // primary/official/bundled identity is only known there (reference identity).
  // Both `getResolvedOrigin` and the per-rule origin accessor route through it.
  protected abstract originOf(source: RulesRegistry): RuleOrigin;

  /** No-arg fetch resolves the engine-partitioned `code` module (default shape). */
  async fetchManifest(): Promise<RegistryManifest | null> {
    return this.resolveModule(CODE_MODULE_ID);
  }

  /**
   * Module-aware sibling of `fetchManifest()`: resolve and return the
   * normalized manifest carrying `module` (per-module chain walk, cached).
   * Returns the last reachable manifest when no source carries the module —
   * callers distinguish "module missing" (non-null, accessors yield `[]`)
   * from "chain unreachable" (`null`, the exit-2 signal).
   */
  async fetchModuleManifest(module: ModuleId): Promise<RegistryManifest | null> {
    return this.resolveModule(module);
  }

  async fetchRule(
    module: ModuleId,
    engineId: string,
    category: RuleCategory,
    ruleId: string,
  ): Promise<FetchedRule | null> {
    // Per-rule source: for a `per-id-merge` module each id may resolve from a
    // different chain level (override→custom, backfill→official/bundled); for a
    // `module-winner` module this collapses to the single module-wide source.
    const source = await this.getResolvedSourceForRule(module, category, ruleId);
    if (!source) {
      logWarn(this.logTag, `no resolved source for module ${module} engine ${engineId}`);
      return null;
    }
    return source.fetchRule(module, engineId, category, ruleId);
  }

  async fetchReferences(
    module: ModuleId,
    engineId: string,
    category: RuleCategory,
    ruleId: string,
    filenames: string[],
  ): Promise<FetchedReference[]> {
    const source = await this.getResolvedSourceForRule(module, category, ruleId);
    if (!source) {
      logWarn(this.logTag, `no resolved source for module ${module} engine ${engineId}`);
      return [];
    }
    return source.fetchReferences(module, engineId, category, ruleId, filenames);
  }

  /** The `code` module's resolved manifest (back-compat for no-arg consumers). */
  getResolvedManifest(): RegistryManifest | null {
    return this.resolvedManifest;
  }

  /** Code-module rules for a tier — thin alias over `getModuleRules`. */
  getEngineRules(tier: RuleCategory): RegistryRule[] {
    return this.getModuleRules(CODE_MODULE_ID, tier);
  }

  /**
   * Rules for `module`/`tier` from that module's resolved+normalized manifest.
   * Engine-partitioned modules (`code`) read `modules.<module>.engines[engineId]`
   * (falling back to the compat `engines` mirror); non-engine modules read
   * `modules.<module>.tiers`.
   */
  getModuleRules(module: ModuleId, tier: Tier): RegistryRule[] {
    const resolved = this.resolvedByModule.get(module);

    // `per-id-merge` module: the catalog is the merged per-id result, not a
    // single manifest's tier array (core = canon list + studio overrides).
    if (resolved?.merged) {
      return resolved.merged.rulesByTier.get(tier) ?? [];
    }

    const manifest = resolved?.manifest
      ?? (module === CODE_MODULE_ID ? this.resolvedManifest : null);
    if (!manifest) return [];

    const mod = manifest.modules?.[module];
    if (module === CODE_MODULE_ID) {
      const engine: EngineRules | undefined = mod?.engines?.[this.engineId] ?? manifest.engines?.[this.engineId];
      if (!engine) return [];
      return engine[tier as keyof EngineRules] ?? [];
    }
    return mod?.tiers?.[tier] ?? [];
  }

  /** Resolve (or return cached) the winning source for `module`. */
  protected async getResolvedSource(module: ModuleId = CODE_MODULE_ID): Promise<RulesRegistry | null> {
    const cached = this.resolvedByModule.get(module);
    if (cached) return cached.source;
    await this.resolveModule(module);
    return this.resolvedByModule.get(module)?.source ?? null;
  }

  /**
   * The chain source that provides a SPECIFIC rule's content. For a
   * `per-id-merge` module this is the per-id winner (override→custom,
   * backfill→official/bundled); for a `module-winner` module it collapses to
   * the module-wide source. Triggers resolution if not yet cached.
   */
  protected async getResolvedSourceForRule(
    module: ModuleId,
    tier: RuleCategory,
    ruleId: string,
  ): Promise<RulesRegistry | null> {
    const moduleWide = await this.getResolvedSource(module);
    const merged = this.resolvedByModule.get(module)?.merged;
    if (merged) {
      return merged.sourceByKey.get(ruleKey(tier, ruleId)) ?? moduleWide;
    }
    return moduleWide;
  }

  /**
   * Per-rule origin (the chain level a specific rule resolved from). For a
   * `per-id-merge` module distinct rules can carry distinct origins
   * (`primary` for studio overrides, `official`/`bundled` for backfill); for a
   * `module-winner` module every rule shares the module-wide origin. Returns
   * null when the module has not been resolved yet (callers resolve first via
   * `getModuleRules` / `fetchModuleManifest`). Synchronous by design — the
   * origin map is built during resolution.
   */
  getResolvedOriginForRule(module: ModuleId, tier: RuleCategory, ruleId: string): RuleOrigin | null {
    const resolved = this.resolvedByModule.get(module);
    if (!resolved) return null;
    if (resolved.merged) {
      const source = resolved.merged.sourceByKey.get(ruleKey(tier, ruleId)) ?? resolved.source;
      return source ? this.originOf(source) : null;
    }
    // `module-winner`: per-rule origin equals the module-wide origin.
    return this.originOf(resolved.source);
  }

  /**
   * Resolve `module` per its descriptor's `coreResolution` policy:
   *  - `module-winner` (default, `code`) — first chain source carrying the
   *    module wins outright (`resolveModuleWinner`).
   *  - `per-id-merge` (`gamedesign`) — merge the `core` tier per rule id across
   *    the chain (`resolveModulePerIdMerge`).
   * Unknown/foreign modules default to `module-winner` (unchanged behavior).
   */
  protected async resolveModule(module: ModuleId): Promise<RegistryManifest | null> {
    const cached = this.resolvedByModule.get(module);
    if (cached) return cached.manifest;

    const policy = getModule(module)?.coreResolution ?? 'module-winner';
    return policy === 'per-id-merge'
      ? this.resolveModulePerIdMerge(module)
      : this.resolveModuleWinner(module);
  }

  /**
   * Walk the chain and adopt the first source carrying `module`. Returns the
   * adopted (normalized) manifest, or the last reachable manifest seen, or null.
   */
  private async resolveModuleWinner(module: ModuleId): Promise<RegistryManifest | null> {
    const tag = this.logTag;
    let lastSeenManifest: RegistryManifest | null = null;
    let maxSchemaSeen = 0;
    let anyUsableSource = false;

    for (const source of this.chain()) {
      logInfo(tag, `trying ${source.label} for module ${module}`);
      const raw = await source.fetchManifest();

      if (!raw) {
        logInfo(tag, `${source.label} unreachable`);
        continue;
      }

      if (typeof raw.schema === 'number' && raw.schema > LATEST_SCHEMA) {
        maxSchemaSeen = Math.max(maxSchemaSeen, raw.schema);
        this.warnSchemaUnsupported(source.label, raw.schema);
        continue;
      }

      anyUsableSource = true;
      const manifest = normalizeManifestToLatest(raw);

      if (this.manifestHasModule(manifest, module)) {
        logInfo(tag, `${source.label} has module ${module}, using it`);
        this.cacheResolved(module, source, manifest);
        return manifest;
      }

      logInfo(tag, `${source.label} reachable but module ${module} not resolvable`);
      lastSeenManifest = manifest;
    }

    this.warnChainExhausted(module, anyUsableSource, maxSchemaSeen);

    if (module === CODE_MODULE_ID) {
      this.resolvedSource = null;
      this.resolvedManifest = null;
    }
    return lastSeenManifest;
  }

  /**
   * Per-id B-merge resolution for a `per-id-merge` module. Unlike the winner
   * walk it does NOT stop at the first carrying source: it collects EVERY
   * reachable source carrying the module (chain order: primary → official →
   * bundled) so the `core` tier can merge per id — studio overrides from the
   * custom (primary) source on top of an official→bundled canonical backfill.
   * Non-`core` tiers (`library`) take the custom source only, no backfill.
   *
   * Caches the merged result plus the first carrying source as the module-wide
   * `source`/`manifest` (back-compat for `getResolvedOrigin(module)` and
   * `fetchModuleManifest`). When no source carries the module, returns the last
   * reachable manifest WITHOUT caching — the module then reads as an empty
   * catalog (graceful no-op for code-only / schema:1 registries).
   */
  private async resolveModulePerIdMerge(module: ModuleId): Promise<RegistryManifest | null> {
    const tag = this.logTag;
    const entries: { source: RulesRegistry; manifest: RegistryManifest }[] = [];
    let lastSeenManifest: RegistryManifest | null = null;
    let maxSchemaSeen = 0;
    let anyUsableSource = false;

    for (const source of this.chain()) {
      logInfo(tag, `trying ${source.label} for module ${module} (per-id-merge)`);
      const raw = await source.fetchManifest();

      if (!raw) {
        logInfo(tag, `${source.label} unreachable`);
        continue;
      }

      if (typeof raw.schema === 'number' && raw.schema > LATEST_SCHEMA) {
        maxSchemaSeen = Math.max(maxSchemaSeen, raw.schema);
        this.warnSchemaUnsupported(source.label, raw.schema);
        continue;
      }

      anyUsableSource = true;
      const manifest = normalizeManifestToLatest(raw);
      lastSeenManifest = manifest;

      if (this.manifestHasModule(manifest, module)) {
        logInfo(tag, `${source.label} carries module ${module}, collecting for merge`);
        entries.push({ source, manifest });
      } else {
        logInfo(tag, `${source.label} reachable but module ${module} not present`);
      }
    }

    if (entries.length === 0) {
      this.warnChainExhausted(module, anyUsableSource, maxSchemaSeen);
      return lastSeenManifest;
    }

    const merged = this.buildPerIdMerge(module, entries);
    const winner = entries[0];
    this.resolvedByModule.set(module, { source: winner.source, manifest: winner.manifest, merged });
    return winner.manifest;
  }

  /**
   * Build the per-id B-merge from the carrying chain entries (chain order).
   * `core` = canonical id list (official→bundled, first-wins) with per-id
   * override from the custom (`primary`-origin) source, plus any custom-only
   * core ids; every other tier = custom-only. `sourceByKey` records which
   * source provides each rule's content for `fetchRule`/origin tagging.
   */
  private buildPerIdMerge(
    module: ModuleId,
    entries: { source: RulesRegistry; manifest: RegistryManifest }[],
  ): MergedModule {
    const tierRules = (m: RegistryManifest, tier: Tier): RegistryRule[] =>
      m.modules?.[module]?.tiers?.[tier] ?? [];

    const classified = entries.map(e => ({ ...e, origin: this.originOf(e.source) }));
    const custom = classified.find(e => e.origin === 'primary');
    // Canonical sources in chain order (official before bundled): official wins.
    const canonical = classified.filter(e => e.origin === 'official' || e.origin === 'bundled');

    const tiers = getModule(module)?.tiers ?? [MERGE_TIER];
    const rulesByTier = new Map<Tier, RegistryRule[]>();
    const sourceByKey = new Map<string, RulesRegistry>();

    for (const tier of tiers) {
      if (tier === MERGE_TIER) {
        // Canonical id list (first source wins for a duplicate id).
        const canon = new Map<string, { rule: RegistryRule; source: RulesRegistry }>();
        for (const c of canonical) {
          for (const rule of tierRules(c.manifest, tier)) {
            if (!canon.has(rule.id)) canon.set(rule.id, { rule, source: c.source });
          }
        }
        const customRules = new Map<string, RegistryRule>();
        if (custom) for (const rule of tierRules(custom.manifest, tier)) customRules.set(rule.id, rule);

        const list: RegistryRule[] = [];
        for (const [id, { rule, source }] of canon) {
          if (customRules.has(id)) {
            // Override: studio's own version wins (content from custom).
            list.push(customRules.get(id)!);
            sourceByKey.set(ruleKey(tier, id), custom!.source);
          } else {
            // Backfill: canonical version from official→bundled.
            list.push(rule);
            sourceByKey.set(ruleKey(tier, id), source);
          }
        }
        // Studio-added core ids that are not in the canonical list.
        for (const [id, rule] of customRules) {
          if (!canon.has(id)) {
            list.push(rule);
            sourceByKey.set(ruleKey(tier, id), custom!.source);
          }
        }
        rulesByTier.set(tier, list);
      } else {
        // Non-core tier: custom-only, no official/bundled backfill.
        const list: RegistryRule[] = [];
        if (custom) {
          for (const rule of tierRules(custom.manifest, tier)) {
            list.push(rule);
            sourceByKey.set(ruleKey(tier, rule.id), custom.source);
          }
        }
        rulesByTier.set(tier, list);
      }
    }

    return { rulesByTier, sourceByKey };
  }

  /** Shared chain-exhaustion warning (schema-too-new vs ordinary module-missing). */
  private warnChainExhausted(module: ModuleId, anyUsableSource: boolean, maxSchemaSeen: number): void {
    if (!anyUsableSource && maxSchemaSeen > LATEST_SCHEMA) {
      logWarn(
        this.logTag,
        `all reachable registry sources are schema:${maxSchemaSeen}, this CLI supports up to ${LATEST_SCHEMA} — upgrade unikit-ai`,
      );
    } else {
      logWarn(this.logTag, `chain exhausted without module ${module}`);
    }
  }

  /** Whether `manifest` carries installable rules for `module`. */
  private manifestHasModule(manifest: RegistryManifest, module: ModuleId): boolean {
    const mod = manifest.modules?.[module];
    if (module === CODE_MODULE_ID) {
      const engines = mod?.engines ?? manifest.engines;
      return !!engines && !!engines[this.engineId];
    }
    // Non-engine module: present is enough (no engine gate).
    return !!mod;
  }

  private cacheResolved(module: ModuleId, source: RulesRegistry, manifest: RegistryManifest): void {
    this.resolvedByModule.set(module, { source, manifest });
    if (module === CODE_MODULE_ID) {
      this.resolvedSource = source;
      this.resolvedManifest = manifest;
    }
  }

  private warnSchemaUnsupported(label: string, schema: number): void {
    if (this.schemaWarned) return;
    this.schemaWarned = true;
    logWarn(
      this.logTag,
      `source ${label} is schema:${schema}, this CLI supports up to ${LATEST_SCHEMA} — skipping `
        + `(run 'unikit-ai rules registry migrate' for a local registry, or upgrade unikit-ai)`,
    );
  }
}
