// Module registry — single source of truth for the modular memory layout.
//
// A "module" is a top-level partition of the knowledge base on disk, laid out
// as `.unikit/memory/<module>/<tier>`. PR#1 ships a single module, `code`
// (engine-partitioned, tiers core/stack). Future modules (`gamedesign`,
// `library`) are registered here in later PRs — no other file should hardcode a
// module id or its tier list. Pure data + accessors; no logging, no I/O.
//
// Dependency direction is one-way: `modules.ts` → `constants.ts`. The registry
// pulls `CODE_MODULE_ID` and the canonical `RULE_CATEGORIES` tier list from the
// leaf constants module, so `MODULE_REGISTRY.code.tiers` is an alias of
// `RULE_CATEGORIES` and the two never drift.

import { CODE_MODULE_ID, RULE_CATEGORIES, type Tier } from './constants.js';

export interface Module {
  /** Stable module id; also the directory segment under `.unikit/memory/`. */
  id: string;
  /** Ordered tiers this module partitions its rules into. */
  tiers: readonly Tier[];
  /** Whether the registry partitions this module's rules per engine. */
  enginePartitioned: boolean;
  /** Skill-name prefix associated with this module's skills. */
  skillPrefix: string;
}

export const MODULE_REGISTRY: Record<string, Module> = {
  [CODE_MODULE_ID]: {
    id: CODE_MODULE_ID,
    tiers: RULE_CATEGORIES,
    enginePartitioned: true,
    skillPrefix: 'unikit',
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
