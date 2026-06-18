// Module registry — single source of truth for the modular memory layout.
//
// A "module" is a top-level partition of the knowledge base on disk, laid out
// as `.unikit/memory/<module>/<tier>`. PR#1 shipped a single module, `code`
// (engine-partitioned, tiers core/stack); PR#4 registers `gamedesign`
// (non-engine, tiers core/library). No other file should hardcode a module id
// or its tier list. Pure data + accessors; no logging, no I/O.
//
// Dependency direction is one-way: `modules.ts` → `constants.ts`. The registry
// pulls `CODE_MODULE_ID` and the canonical `RULE_CATEGORIES` tier list from the
// leaf constants module, so `MODULE_REGISTRY.code.tiers` is an alias of
// `RULE_CATEGORIES` and the two never drift.

import {
  CODE_MODULE_ID, GAMEDESIGN_MODULE_ID, GAMEDESIGN_TIERS, RULE_CATEGORIES,
  RULES_INDEX_TEMPLATE_FILE, GAMEDESIGN_RULES_INDEX_TEMPLATE_FILE,
  type Tier,
} from './constants.js';

/**
 * Policy of the no-args `rules install` bootstrap for one module:
 *
 *  - `always-core` — install only the rules the registry marks `always: true`
 *    (the `code` module: its stack catalog is opt-in per project).
 *  - `all-rules`   — install every rule of every tier regardless of the
 *    `always` flag (the `gamedesign` module: its library is a compact
 *    domain-expertise set that ships whole).
 *
 * TS-only field: consumed by `rulesInstallCommand` directly from
 * `MODULE_REGISTRY`. Deliberately NOT emitted into `modules.yml` — the
 * skill-side routers never read it.
 */
export type BootstrapPolicy = 'always-core' | 'all-rules';

/**
 * How the `core` tier is resolved across the registry fallback chain:
 *
 *  - `module-winner` — the whole module resolves to the FIRST chain source that
 *    carries it (primary → official → bundled); that one source provides every
 *    rule. This is the `code` module's behavior and the historical default.
 *  - `per-id-merge`  — the `core` tier is merged PER RULE ID: the canonical id
 *    list comes from the official→bundled sources, and for each id a studio's
 *    own (primary/custom) version overrides the canonical one while missing ids
 *    backfill from official→bundled. Non-`core` tiers (e.g. `library`) resolve
 *    from the custom source only, with no official/bundled backfill. This is the
 *    `gamedesign` module's behavior (canonical knowledge + studio overrides).
 *
 * TS-only field consumed by the resolver in `registry/chained-registry.ts`;
 * deliberately NOT emitted into `modules.yml` (the skill-side routers never read
 * it) — same convention as `bootstrap`.
 */
export type CoreResolution = 'module-winner' | 'per-id-merge';

export interface Module {
  /** Stable module id; also the directory segment under `.unikit/memory/`. */
  id: string;
  /** Ordered tiers this module partitions its rules into. */
  tiers: readonly Tier[];
  /** Whether the registry partitions this module's rules per engine. */
  enginePartitioned: boolean;
  /** Skill-name prefix associated with this module's skills. */
  skillPrefix: string;
  /** No-args `rules install` bootstrap policy (TS-only, not in modules.yml). */
  bootstrap: BootstrapPolicy;
  /** Core-tier registry resolution strategy (TS-only, not in modules.yml). */
  coreResolution: CoreResolution;
  /** Data-dir-relative path of the module's RULES_INDEX.md template. */
  rulesIndexTemplate: string;
}

export const MODULE_REGISTRY: Record<string, Module> = {
  [CODE_MODULE_ID]: {
    id: CODE_MODULE_ID,
    tiers: RULE_CATEGORIES,
    enginePartitioned: true,
    skillPrefix: 'unikit',
    bootstrap: 'always-core',
    coreResolution: 'module-winner',
    rulesIndexTemplate: RULES_INDEX_TEMPLATE_FILE,
  },
  [GAMEDESIGN_MODULE_ID]: {
    id: GAMEDESIGN_MODULE_ID,
    tiers: GAMEDESIGN_TIERS,
    enginePartitioned: false,
    skillPrefix: 'unikit-gd',
    bootstrap: 'all-rules',
    coreResolution: 'per-id-merge',
    rulesIndexTemplate: GAMEDESIGN_RULES_INDEX_TEMPLATE_FILE,
  },
};

/** Look up a module descriptor by id, or `undefined` when unknown. */
export function getModule(id: string): Module | undefined {
  return MODULE_REGISTRY[id];
}

/** All registered module descriptors, in registry order. */
export function listModules(): Module[] {
  return Object.values(MODULE_REGISTRY);
}

/**
 * Resolve the knowledge module a skill belongs to by LONGEST matching
 * `skillPrefix`, or `undefined` when none match.
 *
 * Longest-prefix is required, not a convenience: the `code` module's prefix is
 * `unikit` and `gamedesign`'s is `unikit-gd`, and every gamedesign skill id
 * (`unikit-gd-*`) also starts with `unikit`. A naive
 * `startsWith(code.skillPrefix)` would mis-assign gamedesign skills to `code`.
 * A skill matches a module when it equals the prefix exactly (the `unikit`
 * orchestrator) or begins with `<prefix>-` (a hyphen boundary, so `unikit-gd`
 * never swallows an unrelated `unikit-gdx`).
 */
export function resolveSkillModule(skill: string): Module | undefined {
  let best: Module | undefined;
  for (const module of listModules()) {
    const matches = skill === module.skillPrefix || skill.startsWith(`${module.skillPrefix}-`);
    if (matches && (!best || module.skillPrefix.length > best.skillPrefix.length)) {
      best = module;
    }
  }
  return best;
}

/** Minimal shape of the config fields {@link moduleHasInstalledSkills} reads. */
interface InstalledSkillsConfig {
  agents: ReadonlyArray<{ installedSkills: string[] }>;
}

/**
 * Whether any skill installed across all agents resolves (by longest-prefix,
 * via {@link resolveSkillModule}) to the given module. This is the invariant
 * driver for rule bootstrap: a module's rules are bootstrapped because its
 * SKILLS are installed, not because the module is registered.
 */
export function moduleHasInstalledSkills(config: InstalledSkillsConfig, module: Module): boolean {
  const installed = config.agents.flatMap(a => a.installedSkills);
  return installed.some(s => resolveSkillModule(s)?.id === module.id);
}
