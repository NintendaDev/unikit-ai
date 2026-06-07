// --- Registry Manifest Types ---
// Mirrors the manifest.json structure produced by CI in NintendaDev/unikit-ai-rules.
//
// Two on-disk schema versions are recognised:
//   schema 1 — flat per-engine core/stack arrays at the manifest root
//              (`engines.<id>.{core,stack}`); physical layout `<engine>/<tier>/`.
//   schema 2 — module-keyed map (`modules.<module>...`); the engine-partitioned
//              `code` module carries `modules.code.engines.<id>.{core,stack}` and
//              its physical layout is `code/<engine>/<tier>/`. Non-engine modules
//              (e.g. a future `gamedesign`) carry tier arrays directly.
//
// In memory the registry always works with a NORMALIZED schema:2 manifest
// (`normalizeManifestToLatest`, see ./migrations). Normalization populates
// `modules.code` and, for backward compatibility with consumers that still read
// the flat `engines` map directly, mirrors `modules.code.engines` back onto the
// top-level `engines` field. That mirror is retired once those consumers migrate
// to the registry accessors (`getEngineRules`/`getModuleRules`).

/** Latest on-disk schema version the CLI understands. */
export const LATEST_SCHEMA = 2;

/**
 * A rule tier within a module — registry-layer alias, deliberately widened to
 * `string`. schema:2 lets non-engine modules introduce tiers beyond
 * `core`/`stack` (a future `gamedesign` module uses `core`/`library`), so the
 * registry transports cannot assume the narrow `'core' | 'stack'` union.
 *
 * This is intentionally a SEPARATE alias from `constants.Tier` (the installer's
 * narrow union): the registry layer stays self-contained and the dependency
 * direction stays one-way (`modules.ts` → `constants.ts`), never the registry
 * reaching back into `constants` for a type.
 */
export type Tier = string;

/**
 * Historical name for a rule tier used by the transport methods. Kept as an
 * alias of `Tier` so existing imports (`RuleCategory`) keep working without a
 * rename churn across the CLI/installer call sites.
 */
export type RuleCategory = Tier;

/** Module id — the directory segment under the registry root (`code`, …). */
export type ModuleId = string;

export interface RegistryRule {
  id: string;
  description: string;
  version: string;
  references?: string[];
  /**
   * Whether this rule is part of the always-installed core bootstrap. Injected
   * by the 1→2 normalization (`always = tier === 'core'`) for rules that lack
   * the field; schema:2 sources emit it directly. The core-gate keys off this
   * flag instead of a hardcoded whitelist.
   */
  always?: boolean;
}

export interface EngineRules {
  core: RegistryRule[];
  stack: RegistryRule[];
}

/**
 * One module's rules in a schema:2 manifest.
 *  - Engine-partitioned modules (`code`): `engines` map of engineId → tier arrays.
 *  - Non-engine modules (a future `gamedesign`): `tiers` map of tierName → rules.
 * Exactly one of the two is populated per module; `gamedesign` is reserved and
 * not fetched in PR#2.
 */
export interface ModuleManifest {
  engines?: Record<string, EngineRules>;
  tiers?: Record<string, RegistryRule[]>;
}

export interface RegistryManifest {
  /**
   * On-disk schema version. Typed `number` (not the `1 | 2` literal union)
   * because a raw fetched manifest may carry any integer; the validator gates
   * `schema > LATEST_SCHEMA` and normalization brings everything to schema:2.
   */
  schema: number;
  generated: string;
  /**
   * schema:1 sources populate this directly. On a NORMALIZED schema:2 manifest
   * it is the compat mirror of `modules.code.engines` (see file header). A raw
   * schema:2 manifest read straight off disk has no `engines` — only internal
   * raw accesses touch it, and they guard with `?? {}`.
   */
  engines: Record<string, EngineRules>;
  /** schema:2 canonical module map; populated by normalization. */
  modules?: Record<string, ModuleManifest>;
}

/**
 * Schema-aware one-line summary of a raw manifest for verbose transport logs.
 * schema:1 lists engines; schema:2 lists modules — so a schema:2 manifest no
 * longer logs a misleading empty `engines=[]` (its `engines` field is absent).
 */
export function manifestSummary(manifest: RegistryManifest): string {
  const m = manifest as unknown as Record<string, unknown>;
  if (typeof manifest.schema === 'number' && manifest.schema >= 2) {
    const modules = (m.modules as Record<string, unknown>) ?? {};
    return `modules=[${Object.keys(modules).join(', ')}]`;
  }
  const engines = (m.engines as Record<string, unknown>) ?? {};
  return `engines=[${Object.keys(engines).join(', ')}]`;
}

// Result of fetching a single rule file.
export interface FetchedRule {
  id: string;
  category: RuleCategory;
  content: string;
}

// Result of fetching reference files for a rule.
export interface FetchedReference {
  filename: string;
  content: string;
}
