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
 * Id of the engine-partitioned code-rules module (shipped in PR#1). It is the
 * directory segment under `.unikit/memory/` and the key in `MODULE_REGISTRY`.
 * Every module-id reference outside `constants.ts` / `modules.ts` MUST use
 * this constant — never a raw `'code'` literal.
 */
export const CODE_MODULE_ID = 'code';

/**
 * Game-design module id (registered in `MODULE_REGISTRY` since PR#4). The
 * directory segment under `.unikit/memory/` and in the registry layout
 * (`gamedesign/<tier>`). `rules registry init` scaffolds its directory tree so
 * a fresh schema:2 registry carries the full layout.
 */
export const GAMEDESIGN_MODULE_ID = 'gamedesign';

/**
 * Tiers of the game-design module (`core` + `library`). Unlike the `code`
 * module it is NOT engine-partitioned, so both the registry and the on-disk
 * memory lay it out as `gamedesign/<tier>` with no engine segment.
 */
export const GAMEDESIGN_TIERS = ['core', 'library'] as const;

// --- Rule tiers ---

/**
 * A rule tier within a module. Deliberately a narrow union rather than
 * `string`: it stays structurally assignable to the registry's `RuleCategory`
 * (which is `string`), so `registry.fetchRule(engineId, tier, id)` type-checks
 * without touching the registry transport signatures, while config/module
 * state stays gated to known tiers. `core`/`stack` belong to the `code`
 * module; `library` is the game-design module's on-demand tier (PR#4).
 */
export type Tier = 'core' | 'stack' | 'library';

/**
 * Canonical ordered tier list of the `code` module.
 * `MODULE_REGISTRY.code.tiers` aliases this array (modules.ts → constants.ts),
 * so the two are always the same value and the dependency stays
 * one-directional.
 */
export const RULE_CATEGORIES = ['core', 'stack'] as const;

// --- Project-relative directory segments ---

export const UNIKIT_DIR = '.unikit';
export const MEMORY_DIR_NAME = 'memory';
export const SYSTEM_DIR_NAME = 'system';
export const REFERENCES_DIR_NAME = 'references';
/**
 * Name of the game-design subdir under `.unikit/system/` — the home for shared
 * game-design contracts read by code-side skills (currently `design-read.md`;
 * later the `gd-principles` shards in plan (b)). It matches the module id by
 * construction, so it sources the literal from {@link GAMEDESIGN_MODULE_ID}
 * rather than re-hardcoding it. Distinct concept from the memory/data
 * `gamedesign` dirs — this is the system-asset home. Module-local (only
 * {@link systemGamedesignDir} consumes it) so it does not duplicate the
 * `GAMEDESIGN_MODULE_ID` export.
 */
const SYSTEM_GAMEDESIGN_DIR_NAME = GAMEDESIGN_MODULE_ID;

/**
 * Name of the `genres` subdir under both `data/gamedesign/` (the bundled
 * read-only profile catalog) and `.unikit/system/gamedesign/` (the selectively
 * installed profiles). Single literal so the data-side accessor
 * ({@link import('./genres.js')}) and the install-side path
 * ({@link systemGamedesignGenresDir}) never drift.
 */
export const GAMEDESIGN_GENRES_DIR_NAME = 'genres';

// --- File names ---

export const SKILL_FILE = 'SKILL.md';
export const RULES_INDEX_FILE = 'RULES_INDEX.md';
/** Data-dir-relative RULES_INDEX template of the `code` module. */
export const RULES_INDEX_TEMPLATE_FILE = 'RULES_INDEX_TEMPLATE.md';
/** Data-dir-relative RULES_INDEX template of the `gamedesign` module. */
export const GAMEDESIGN_RULES_INDEX_TEMPLATE_FILE = path.join('gamedesign', 'templates', 'GD_RULES_INDEX.md');
export const RULES_MANIFEST_FILE = 'rules-manifest.json';
export const CLI_CONTRACT_FILE = 'cli-contract.md';
export const DEV_PRINCIPLES_FILE = 'dev-principles.md';
/**
 * Game-design principles **core** system-asset basename. Installed into
 * `.unikit/system/gamedesign/gd-principles.md` from
 * `data/<gamedesign>/gd-principles.md`, alongside its shards (`gd-authoring`,
 * `gd-lifecycle`, `gd-flow-axis`, `gd-provenance`, `gd-critique`) and the shared
 * `design-read` contract — all copied by {@link systemGamedesignDir} as flat
 * files. Engine-agnostic (no `{{engine_*}}` substitution, unlike
 * `dev-principles.md`) and NOT hash-tracked — rewritten on every init/update. The
 * `unikit-gd-*` skills read the core (plus the shards they need) on Bootstrap. It
 * is a system asset, NOT a memory rule: the game-design collaboration/authoring
 * contract lives here, not in `gamedesign/core/`. Also reused as the basename of
 * the orphan-delete target for the pre-split flat `.unikit/system/gd-principles.md`.
 */
export const GD_PRINCIPLES_FILE = 'gd-principles.md';
/**
 * Machine-readable quality-gate result contract system-asset basename.
 * Installed flat into `.unikit/system/gate-result-contract.md` from
 * `data/gate-result-contract.md`. Engine-agnostic (no `{{engine_*}}`
 * substitution) and NOT hash-tracked — rewritten on every init/update.
 * `unikit-verify` and `unikit-review` read it on Bootstrap to emit/recompute
 * the `unikit-gate-result` fenced block.
 */
export const GATE_RESULT_CONTRACT_FILE = 'gate-result-contract.md';
export const MODULES_YML_FILE = 'modules.yml';
export const ENGINE_RULES_FILE = 'ENGINE_RULES.md';

// --- RULES_INDEX template markers ---

export const CORE_TABLE_MARKER = '<!-- CORE_TABLE -->';
export const STACK_TABLE_MARKER = '<!-- STACK_TABLE -->';
export const LIBRARY_TABLE_MARKER = '<!-- LIBRARY_TABLE -->';

/** Per-tier template marker map, so index generation stays tier-generic. */
export const TIER_TABLE_MARKERS: Record<Tier, string> = {
  core: CORE_TABLE_MARKER,
  stack: STACK_TABLE_MARKER,
  library: LIBRARY_TABLE_MARKER,
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

/**
 * `<projectDir>/.unikit/memory/<module>/<tier>` — a module tier's rule dir.
 * `tier` is widened to `string` (not the narrow `Tier` union) so registry-layer
 * tiers — which are `string` (`manifest-types.Tier`) to allow non-engine modules
 * extra tiers — can reach the on-disk path without a cast. The path join is
 * tier-agnostic; the narrow `Tier` union still gates config/module state.
 */
export function moduleTierDir(projectDir: string, module: string, tier: string): string {
  return path.join(moduleDir(projectDir, module), tier);
}

/** `<projectDir>/.unikit/system` — root of cli-contract / dev-principles. */
export function systemDir(projectDir: string): string {
  return path.join(projectDir, UNIKIT_DIR, SYSTEM_DIR_NAME);
}

/**
 * `<projectDir>/.unikit/system/gamedesign` — home for shared game-design
 * contracts read by code-side skills (currently `design-read.md`). A sibling
 * concept to the flat system assets in {@link systemDir}; plan (b) will later
 * fill it with the `gd-principles` shards.
 */
export function systemGamedesignDir(projectDir: string): string {
  return path.join(systemDir(projectDir), SYSTEM_GAMEDESIGN_DIR_NAME);
}

/**
 * `<projectDir>/.unikit/system/gamedesign/genres` — home for the SELECTIVELY
 * installed read-only genre profiles (`<id>.json`). Unlike the gd-principles
 * shards (which {@link systemGamedesignDir} delivers wholesale every
 * init/update), profiles land here one-by-one per `config.genres.installed`.
 */
export function systemGamedesignGenresDir(projectDir: string): string {
  return path.join(systemGamedesignDir(projectDir), GAMEDESIGN_GENRES_DIR_NAME);
}

/**
 * `<projectDir>/.unikit/<module>` — root of one module's working files
 * (plans, patches, researches, the plan/fix-plan documents), as opposed to its
 * rules under `memory/<module>` (see `moduleDir`). The two are siblings under
 * `.unikit/`. Assemble every workspace path through this helper so the layout
 * stays derivable from one place — never a raw `.unikit/code` literal.
 */
export function workspaceDir(projectDir: string, module: string): string {
  return path.join(projectDir, UNIKIT_DIR, module);
}

// --- Workspace artifacts (module-scoped project working files) ---
//
// Single source of truth for the flat→module relocation: pre-modular projects
// keep these directly under `.unikit/`; the workspace migration moves each one
// under `.unikit/<code-module>/`. The same inventory backs (a) the migration
// (`workspace-migrations`), (b) the skill-layer path references that now carry
// the `code/` segment, and (c) the golden-guard #3 regex that forbids the bare
// form from reappearing in tracked content.

/** Directory artifacts that relocate 1:1 (same basename under the module dir). */
export const WORKSPACE_ARTIFACT_DIRS = ['plans', 'patches', 'researches'] as const;

/** File artifacts that relocate 1:1 (same basename under the module dir). */
export const WORKSPACE_ARTIFACT_FILES = ['PLAN.md', 'FIX_PLAN.md'] as const;

/**
 * Artifacts that relocate AND change name. The legacy top-level researches
 * index (`RESEARCHES_INDEX.md`) becomes the per-directory `researches/INDEX.md`,
 * matching the convention that an index lives inside the directory it indexes.
 */
export const WORKSPACE_ARTIFACT_RENAMES: readonly { from: string; to: string }[] = [
  { from: 'RESEARCHES_INDEX.md', to: path.join('researches', 'INDEX.md') },
];
