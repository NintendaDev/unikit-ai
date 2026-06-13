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
//   - non-engine modules (a future `gamedesign`) — adopted as soon as the module
//     is present, WITHOUT an engine gate. Resolution keys off the module the
//     CALLER requested, never `MODULE_REGISTRY`, so an unregistered module still
//     resolves from a source that carries it.
//
// Per-module winners are cached in `resolvedByModule`. The `code` resolution is
// additionally surfaced through `resolvedSource` / `resolvedManifest` so the
// existing no-arg consumers (`getResolvedManifest`, `getEngineRules`,
// `getResolvedOrigin()`) keep working unchanged.
//
// Resolution contract (per module, first match wins):
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
import { logInfo, logWarn } from '../../utils/log.js';

interface ResolvedModule {
  source: RulesRegistry;
  manifest: RegistryManifest;
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
    const source = await this.getResolvedSource(module);
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
    const source = await this.getResolvedSource(module);
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
    const manifest = this.resolvedByModule.get(module)?.manifest
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
   * Walk the chain and adopt the first source carrying `module`. Returns the
   * adopted (normalized) manifest, or the last reachable manifest seen, or null.
   */
  protected async resolveModule(module: ModuleId): Promise<RegistryManifest | null> {
    const cached = this.resolvedByModule.get(module);
    if (cached) return cached.manifest;

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

    // Schema-exhaustion vs ordinary module-missing exhaustion. The former is
    // the upgrade signal for a future schema bump where even bundled is too new.
    if (!anyUsableSource && maxSchemaSeen > LATEST_SCHEMA) {
      logWarn(
        tag,
        `all reachable registry sources are schema:${maxSchemaSeen}, this CLI supports up to ${LATEST_SCHEMA} — upgrade unikit-ai`,
      );
    } else {
      logWarn(tag, `chain exhausted without module ${module}`);
    }

    if (module === CODE_MODULE_ID) {
      this.resolvedSource = null;
      this.resolvedManifest = null;
    }
    return lastSeenManifest;
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
