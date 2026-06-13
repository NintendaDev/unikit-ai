// Read-side per-module catalog resolver for the rules CLI.
//
// `rules list/show/install/status` were code-pinned before PR#4; this module
// gives them one shared "active module → registry catalog" resolution step on
// top of the chain's per-module manifest resolution
// (`ChainedRegistry.fetchModuleManifest`). Read-only: it never touches disk or
// `.unikit.json` — sync-side reconciliation stays in `rules-sync.ts`.

import type { ChainedRegistry, RegistryRule } from '../registry/index.js';
import { manifestEngineIds } from '../registry/validator.js';
import type { RuleOrigin } from '../config.js';
import type { Tier } from '../constants.js';
import type { Module } from '../modules.js';

/** One catalog row: a registry rule together with the tier it lives in. */
export interface CatalogRule {
  tier: Tier;
  rule: RegistryRule;
  /**
   * Per-rule B-merge origin: which chain level this specific rule resolved from
   * (`primary` studio override vs `official`/`bundled` canonical backfill). For
   * `module-winner` modules this equals the module-wide origin for every row;
   * for `per-id-merge` modules (gamedesign) it varies per id. The install path
   * stamps `InstalledRuleEntry.origin` from THIS field, not the module-wide one.
   */
  origin: RuleOrigin | undefined;
}

export interface ModuleCatalog {
  module: Module;
  /** False when the registry chain yielded no manifest at all (exit-2 signal). */
  reachable: boolean;
  /**
   * Engine availability. Always true for non-engine modules; for
   * engine-partitioned modules false when the resolved manifest does not
   * carry the requested engine (the exit-1/exit-5 signal — which exit code
   * applies is command-specific).
   */
  engineAvailable: boolean;
  /** Engine ids the resolved manifest carries (error-message material). */
  engines: string[];
  /** Tier-ordered catalog; empty when the module is absent from the chain. */
  rules: CatalogRule[];
  /** Winning chain level for origin tagging (undefined when unresolved). */
  origin: RuleOrigin | undefined;
}

/**
 * Resolve `module`'s catalog through the registry chain. Graceful by design:
 * a module missing from every chain source yields `reachable: true` with an
 * empty `rules` list — the no-args bootstrap and `list --module` must treat
 * "registry has no such module yet" as an empty catalog, not an error
 * (schema:1 registries and code-only custom registries are valid sources).
 *
 * `engineId` must be the same engine the registry chain was created with —
 * the chain's accessors read that engine internally; the parameter here only
 * drives the engine-availability predicate.
 */
export async function resolveModuleCatalog(
  registry: ChainedRegistry,
  module: Module,
  engineId: string,
): Promise<ModuleCatalog> {
  const manifest = await registry.fetchModuleManifest(module.id);
  if (!manifest) {
    return { module, reachable: false, engineAvailable: false, engines: [], rules: [], origin: undefined };
  }

  const engines = manifestEngineIds(manifest);
  const engineAvailable = !module.enginePartitioned || engines.includes(engineId);

  const rules: CatalogRule[] = [];
  if (engineAvailable) {
    for (const tier of module.tiers) {
      for (const rule of registry.getModuleRules(module.id, tier)) {
        rules.push({
          tier,
          rule,
          origin: registry.getResolvedOriginForRule(module.id, tier, rule.id) ?? undefined,
        });
      }
    }
  }

  return {
    module,
    reachable: true,
    engineAvailable,
    engines,
    rules,
    // Module-wide origin summary (back-compat). Per-rule origin lives on each
    // CatalogRule above and is what the install path stamps onto state.
    origin: registry.getResolvedOrigin(module.id) ?? undefined,
  };
}
