// Shared constants for the installer modules and the CLI command handlers.
//
// Single source of truth for runtime path segments, file names, rule
// tiers, template markers, module identifiers, and the default engine id.
// Centralizing these here removes the duplicated string literals that were
// previously scattered across the installer modules and the CLI commands, and
// keeps the on-disk module layout (.unikit/memory/<module>/<tier>,
// .unikit/system, RULES_INDEX.md) derivable from one place.
//
// This file is a leaf: it imports only `path` and is imported by `modules.ts`,
// `config.ts`, the installer modules, and the CLI commands. It must NEVER import
// `modules.ts` — the module registry depends on these constants, not the other
// way around, which keeps the dependency acyclic.

import path from 'path';

// --- Default engine ---

export const DEFAULT_ENGINE_ID = 'unity';

// --- Module identifiers ---

/**
 * Id of the single built-in module shipped in PR#1 (engine-partitioned code
 * rules). It is the directory segment under `.unikit/memory/` and the key in
 * `MODULE_REGISTRY`. Every module-id reference outside `constants.ts` /
 * `modules.ts` MUST use this constant — never a raw `'code'` literal.
 */
export const CODE_MODULE_ID = 'code';

// --- Rule tiers ---

/**
 * A rule tier within a module. Deliberately a narrow union (`'core' | 'stack'`)
 * rather than `string`: it stays structurally assignable to the registry's
 * `RuleCategory`, so `registry.fetchRule(engineId, tier, id)` type-checks
 * without touching the registry transport signatures (that widening is PR#2).
 */
export type Tier = 'core' | 'stack';

/**
 * Canonical ordered tier list. `MODULE_REGISTRY.code.tiers` aliases this array
 * (modules.ts → constants.ts), so the two are always the same value and the
 * dependency stays one-directional.
 */
export const RULE_CATEGORIES = ['core', 'stack'] as const;

// --- Project-relative directory segments ---

export const UNIKIT_DIR = '.unikit';
export const MEMORY_DIR_NAME = 'memory';
export const SYSTEM_DIR_NAME = 'system';
export const REFERENCES_DIR_NAME = 'references';

// --- File names ---

export const SKILL_FILE = 'SKILL.md';
export const RULES_INDEX_FILE = 'RULES_INDEX.md';
export const RULES_INDEX_TEMPLATE_FILE = 'RULES_INDEX_TEMPLATE.md';
export const RULES_MANIFEST_FILE = 'rules-manifest.json';
export const CLI_CONTRACT_FILE = 'cli-contract.md';
export const DEV_PRINCIPLES_FILE = 'dev-principles.md';
export const MODULES_YML_FILE = 'modules.yml';
export const ENGINE_RULES_FILE = 'ENGINE_RULES.md';

// --- RULES_INDEX template markers ---

export const CORE_TABLE_MARKER = '<!-- CORE_TABLE -->';
export const STACK_TABLE_MARKER = '<!-- STACK_TABLE -->';

/** Per-tier template marker map, so index generation stays tier-generic. */
export const TIER_TABLE_MARKERS: Record<Tier, string> = {
  core: CORE_TABLE_MARKER,
  stack: STACK_TABLE_MARKER,
};

// --- Path helpers ---

/** `<projectDir>/.unikit/memory` — root of all installed modules. */
export function memoryDir(projectDir: string): string {
  return path.join(projectDir, UNIKIT_DIR, MEMORY_DIR_NAME);
}

/** `<projectDir>/.unikit/memory/<module>` — root of one module's rules. */
export function moduleDir(projectDir: string, module: string): string {
  return path.join(memoryDir(projectDir), module);
}

/** `<projectDir>/.unikit/memory/<module>/<tier>` — a module tier's rule dir. */
export function moduleTierDir(projectDir: string, module: string, tier: Tier): string {
  return path.join(moduleDir(projectDir, module), tier);
}

/** `<projectDir>/.unikit/system` — root of cli-contract / dev-principles. */
export function systemDir(projectDir: string): string {
  return path.join(projectDir, UNIKIT_DIR, SYSTEM_DIR_NAME);
}
