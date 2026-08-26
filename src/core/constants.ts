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

// --- Concurrency tuning ---

/**
 * Bounded fan-out width for per-rule network fetches in the rules pipeline.
 * Shared by `syncRegistry` (`rules-sync.ts`) and the `bootstrapModuleRules`
 * prefetch (`rules-bootstrap.ts`) so both overlap GETs against
 * `raw.githubusercontent.com` at the same rate. Kept modest (8) so a full
 * `update --force` sync overlaps its 20-40 round-trips without tripping the
 * host's unauthenticated rate limit or opening an unbounded socket burst.
 * Fetch is the only parallelised step — disk writes / config mutation stay
 * sequential and deterministic in both callers.
 */
export const RULE_FETCH_CONCURRENCY = 8;

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

/**
 * Name of the engine-MCP subdir under `.unikit/system/` — the home for the
 * rules tree of the MCP server the user actually picked. It is a **system
 * asset**, not a memory rule: the content records the exceptions that server
 * imposes (which failure classes are live there, which gates are reachable),
 * not project knowledge the user curates.
 *
 * It lives here rather than inside a skill body because skills are hash-tracked
 * (`computeSourceHashWithTemplate`) while the tree's content varies with the MCP
 * selection — putting it in a SKILL.md would make every skill's source hash a
 * function of the MCP choice's *content*. System assets are outside hash
 * tracking and are flat-rewritten on every init/update, which is exactly the
 * lifecycle a per-selection profile needs.
 */
export const ENGINE_MCP_DIR_NAME = 'engine-mcp';

/**
 * Prefix every MCP-injected frontmatter entry carries: `mcp__<code>__<tool>`,
 * where `code` is the VENDOR code the server is registered under in the agent's
 * settings file — never its `key`, which is the package-internal file id and is
 * written nowhere.
 *
 * It is what makes injection reversible. A skill's `allowed-tools` mixes
 * hand-authored entries (Read, Bash, Agent, …) with generated ones, and only the
 * generated half may be rewritten when the grants of a server change — this
 * prefix is the only thing telling the two apart on disk.
 */
export const MCP_TOOL_ENTRY_PREFIX = 'mcp__';

/**
 * Entry point of a server's rules tree — `mcp/<engine>/rules/<fileId>/INDEX.md`
 * at the source, `.unikit/system/engine-mcp/INDEX.md` once delivered. Its
 * presence is what makes a `rules` pointer usable, so the schema guard keys on
 * this name. A missing INDEX means "no known exceptions", never "no
 * capabilities" — absence of rules never degrades the run.
 */
export const MCP_RULES_INDEX_FILE = 'INDEX.md';

/**
 * The literal a server config carries where a pinned version belongs, until
 * something fills it in.
 *
 * The biome server is installed straight from git, and its server half must
 * match the Unity package half — a mismatch is a protocol mismatch, not a
 * cosmetic one. UniKit cannot know the number: it is whatever the user's Unity
 * package is, and opening the editor writes the pin itself. So the shipped
 * config carries the placeholder and the reconciliation warns while it is still
 * there.
 *
 * Safe to leave in the config: `expandTokens` (`mcp-platform.ts`) substitutes
 * `{{home}}` and `{{localappdata}}` by exact `split`/`join` and passes anything
 * else through untouched — measured, not assumed.
 *
 * A separate `_v` field was rejected: it would be a second copy of the same
 * fact, and `OpenCodeMcpWriter` rebuilds the entry from `command`/`args`/`env`
 * alone, so the copy would silently not survive for one agent in four.
 */
export const MCP_VERSION_PLACEHOLDER = '{{ VERSION }}';

/**
 * Key of the optional hint line a server config may carry inside `config` —
 * `_comment`, always last.
 *
 * A constant rather than a literal for the same reason
 * {@link MCP_VERSION_PLACEHOLDER} standing next to it is one: the string lives
 * in two places at once — in the data (`mcp/universal/context7.json`) and in the
 * code that carries it through (`mcp-writers/opencode-writer.ts`, which builds
 * its output from a whitelist and would drop an unnamed field by construction).
 * With no shared source, renaming one half silently breaks the other, and
 * nothing downstream would fail loudly enough to notice.
 *
 * The field is a hint addressed to the person reading their own settings file —
 * where to get an API key, which header carries it. It is not a mechanism: no
 * consumer reads it, and no behaviour anywhere changes depending on whether it
 * is present, absent, or says something else entirely.
 */
export const MCP_COMMENT_KEY = '_comment';

/**
 * Project-local log of MCP findings — `.unikit/MCP-RECHECK-NOTES.md`. It sits at
 * the root of `.unikit/` rather than under `system/` **by construction**: every
 * system asset is flat-rewritten on init/update, and this file is user-owned
 * (written by `/unikit-mcp-trap`, curated by `/unikit-mcp-audit`). The installer
 * only ever renames it — see {@link MCP_RECHECK_NOTES_ARCHIVE_PREFIX}.
 */
export const MCP_RECHECK_NOTES_FILE = 'MCP-RECHECK-NOTES.md';

/**
 * Prefix of a parked notes file: `MCP-RECHECK-NOTES.archive.<fileId>.md`.
 * Switching the engine MCP server parks the active notes under the id of the
 * server that produced them, because a finding is a statement about one server
 * and means nothing against another. Invariant: one file per server — active
 * **or** archived, never both.
 */
export const MCP_RECHECK_NOTES_ARCHIVE_PREFIX = 'MCP-RECHECK-NOTES.archive.';

/**
 * Key of the line naming the server a file belongs to. It appears in two
 * places that are compared against each other: the delivery stamp at the top of
 * every file in `.unikit/system/engine-mcp/`, and the header of the project's
 * `.unikit/MCP-RECHECK-NOTES.md`. Both carry a FILE ID, which is why renaming a
 * file id has to rewrite both — a stamp updated alone turns every pipeline
 * skill's Bootstrap into a permanent "notes header ≠ configured server" warning
 * that nothing but a human can clear.
 */
export const MCP_STAMP_SERVER_KEY = 'server:';

/**
 * Pre-2.0.0 MCP file id → its 2.0.0 name.
 *
 * The file id used to be a descriptive filename; from 2.0.0 it IS the server's
 * `key` — its internal identity — so the two had to be brought into line. The
 * table is the only place the old names survive, and four surfaces read it: the
 * keys of `config.mcp.servers`, the archived findings logs
 * (`MCP-RECHECK-NOTES.archive.<fileId>.md`), the `server:` line of the delivered
 * rules tree, and the `server:` header inside the findings logs themselves.
 */
export const MCP_FILE_ID_RENAMES: Readonly<Record<string, string>> = {
  'unity-mcp-biome': 'unity-biome-mcp',
  'unity-mcp-coplay': 'coplay-unity-mcp',
  'godot-mcp-fennara': 'fennara-godot-mcp',
  'godot-mcp-gdai': 'gdai-godot-mcp',
  'godot-mcp-coding-solo': 'coding-solo-godot-mcp',
  'unreal-mcp-chir24': 'chir24-unreal-mcp',
};

/**
 * Platforms an MCP JSON may declare a `configByPlatform` entry for. The values
 * are `process.platform` ids, so the lookup is a direct index — a platform
 * outside this tuple (freebsd, aix, …) falls back to the plain `config` key.
 */
export const MCP_PLATFORM_KEYS = ['win32', 'darwin', 'linux'] as const;

/** One of the {@link MCP_PLATFORM_KEYS} ids. */
export type McpPlatformKey = (typeof MCP_PLATFORM_KEYS)[number];

/**
 * Path tokens expanded inside a resolved MCP config. They exist because some
 * servers ship an absolute binary path that differs per OS; the token keeps the
 * JSON machine-independent. Expansion is best-effort by design — no existence
 * check, no warning when the target is absent (the MCP client reports that).
 */
export const MCP_TOKEN_HOME = '{{home}}';
export const MCP_TOKEN_LOCALAPPDATA = '{{localappdata}}';

// --- File names ---

/**
 * The project config. Named here rather than in `config.ts` because the
 * migration chain reaches the same file as RAW JSON — `config.ts` cannot be the
 * owner of a path its own bypass route needs.
 */
export const CONFIG_FILE = '.unikit.json';


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
/** Reader contract for an ultra plan bundle; rationale on `installUltraPlanReadContract`. */
export const ULTRA_PLAN_READ_FILE = 'ultra-plan-read.md';
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
 * `<projectDir>/.unikit/system/engine-mcp` — home for the rules tree of the
 * selected engine MCP server. Written by `installEngineMcpRules` as a recursive
 * copy of that server's `rules` directory; outside hash tracking and
 * flat-rewritten on every init/update, so a MCP or engine switch never leaves a
 * stale profile behind (the installer orphan-deletes everything the new
 * selection did not contribute).
 */
export function systemEngineMcpDir(projectDir: string): string {
  return path.join(systemDir(projectDir), ENGINE_MCP_DIR_NAME);
}

/**
 * `<projectDir>/.unikit/MCP-RECHECK-NOTES.md` — the active findings log. Note
 * the level: `.unikit/` root, deliberately outside {@link systemDir}, so no
 * installer sweep can reach it (see {@link MCP_RECHECK_NOTES_FILE}).
 */
export function mcpRecheckNotesPath(projectDir: string): string {
  return path.join(projectDir, UNIKIT_DIR, MCP_RECHECK_NOTES_FILE);
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

// Workspace- and plan-artifact names live in `constants-artifacts.ts` (Part 7i
// ceiling). Re-exported here rather than imported at each call site: this module
// is the declared single point of the no-hardcode rule, and golden-guard #1 Part C
// excludes it BY FILE NAME (`grep -vE 'constants\.ts|modules\.ts'`) — a name the
// sibling does not match, so no literal Part C bans may live over there.
//
// `export *` re-exports the names but does NOT bind them locally: a helper in
// THIS file that referenced one would get `TS2304`, not working code. Anything
// a helper here needs is therefore also imported by name, right here.
//
// There is no such helper at the moment. A `researchesDir(projectDir, module)`
// briefly lived below this line; it went when the folder walk was generalised
// over a DIRECTORY NAME in `workspace-migrations/workspace-folders.ts`, which
// composes `workspaceDir` with `RESEARCHES_DIR_NAME` itself and left this one
// without a caller. Restoring it means restoring the `import` line too.
export * from './constants-artifacts.js';

// --- Migration version anchors (`Migration.since`) ---
//
// The release each project-migration step ships in. A project whose recorded
// `.unikit.json.version` is strictly below the anchor has not seen that step,
// whatever the disk says — which is the coarse half of the run condition
// (`src/core/migrations/runner.ts` documents why the two halves are OR-ed).
//
// An anchor names a RELEASE, not a feature: if the release these steps go out
// in is renumbered, the anchor moves with it. Leaving it behind switches the
// version half off for exactly the users sitting on the previous number.

/** Modular `memory/<module>` layout + module-scoped workspace (PR#1 / PR#4). */
export const MIGRATION_SINCE_MODULAR_LAYOUT = '1.1.0';

/** MCP vendor codes: `mcp.servers` key→code map + renamed server file ids. */
export const MIGRATION_SINCE_MCP_VENDOR_CODES = '2.0.0';

/**
 * Plan folder carries one `PLAN.md` manifest (TASKS.md + PLAN-BRIEF.md merged).
 *
 * Same value as {@link MIGRATION_SINCE_MCP_VENDOR_CODES} because an anchor names
 * a RELEASE, not a feature, and both steps go out in 2.0.0. Kept as its own
 * constant rather than reusing that one: the two are independent changes that
 * happen to share a release, and a plan migration importing an MCP-named anchor
 * would read as a dependency it does not have.
 */
export const MIGRATION_SINCE_PLAN_MANIFEST = '2.0.0';

/**
 * Research folder carries one `RESEARCH.md` manifest (RESULT + BRIEF merged).
 *
 * Same value as {@link MIGRATION_SINCE_PLAN_MANIFEST} because an anchor names a
 * RELEASE and 2.0.0 is not published yet (npm knows 1.1.0 as the newest). Its own
 * constant for the same reason the plan anchor is its own: two independent
 * changes that happen to share a release.
 */
export const MIGRATION_SINCE_RESEARCH_MANIFEST = '2.0.0';

/** Plan manifest carries `Created:` / `Updated:` header fields (REQ-14). */
export const MIGRATION_SINCE_PLAN_TIMESTAMPS = '2.0.0';
