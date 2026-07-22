// --- CLI: unikit rules <subcommand> ---
// 6 subcommands: list, show, install, sync, status, registry
// `registry` is a command group with nested subcommands: show, set, reset, init

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import semver from 'semver';
import { loadConfig, saveConfig, getModuleTier } from '../../core/config.js';
import type { UniKitConfig, RuleOrigin } from '../../core/config.js';
import { planMigrationChain } from '../../core/migrations/runner.js';
import { PROJECT_MEMORY_MIGRATIONS, MEMORY_MODULAR_MIN_VERSION } from '../../core/memory-migrations/index.js';
import {
  createRegistry, detectRegistryKind, resolveRegistryUrl, resolveRegistryPath,
  OFFICIAL_REGISTRY_URL, LATEST_SCHEMA, GitRegistry, FsRegistry,
} from '../../core/registry/index.js';
import type { RulesRegistry, ChainedRegistry, RegistryManifest, RegistryKind } from '../../core/registry/index.js';
import { validateRegistry, validateUrlFormat, normalizeRegistryUrl, validateManifestShape } from '../../core/registry/validator.js';
import { runRegistryDiskMigration } from '../../core/registry/migrations/index.js';
import { getAllEngineIds } from '../../core/engines.js';
import {
  generateRulesIndex, loadRequiredByMap,
  parseRuleMetadataFromContent, normalizeRuleId, type InstalledByTier,
} from '../../core/installer/rules-index.js';
import { syncAllModules, type SyncRulesEvent } from '../../core/installer/rules-sync.js';
import { resolveModuleCatalog, type ModuleCatalog, type CatalogRule } from '../../core/installer/module-catalog.js';
import { installOneRule, bootstrapModuleRules, type InstallReportLine } from '../../core/installer/rules-bootstrap.js';
import {
  CODE_MODULE_ID, GAMEDESIGN_MODULE_ID, GAMEDESIGN_TIERS,
  RULE_CATEGORIES, type Tier,
} from '../../core/constants.js';
import { MODULE_REGISTRY, getModule, listModules, moduleHasInstalledSkills, type Module } from '../../core/modules.js';
import { fileExists, readJsonFile, writeJsonFile, getBundledRegistryDir } from '../../utils/fs.js';
import { logInfo, logWarn, logError } from '../../utils/log.js';

// --- Exit codes (unified for all unikit rules *) ---
export const EXIT = {
  SUCCESS: 0,
  NOT_FOUND: 1,
  NETWORK_ERROR: 2,
  INVALID_ARGS: 3,
  NOT_PERMITTED: 4,
  VALIDATION_FAILED: 5,
  REGISTRY_ALREADY_INITIALIZED: 6,
  PATH_OCCUPIED: 7,
  PROJECT_OUT_OF_DATE: 8,
} as const;

function exitWithCode(code: number): never {
  process.exit(code);
}

async function loadConfigOrExit(projectDir: string): Promise<UniKitConfig> {
  const config = await loadConfig(projectDir);
  if (!config) {
    console.error(chalk.red('Not a UniKit project. Run `unikit-ai init` first.'));
    exitWithCode(EXIT.NOT_FOUND);
  }
  return config;
}

function buildRegistry(config: UniKitConfig): ChainedRegistry {
  return createRegistry(config.rulesRegistry, config.engine);
}

/**
 * True when the project's memory layout has not been migrated to the modular
 * `code/` module. Two signals, OR-combined (defense-in-depth — they answer
 * different questions):
 *
 *   - versionStale: `.unikit.json.version` is a valid semver below
 *     `MEMORY_MODULAR_MIN_VERSION`. Broad staleness — the CLI was upgraded but
 *     `update` (the sole migrator) never ran, so skills/system are stale too.
 *     A missing or unparseable `version` cannot signal staleness here (a bare
 *     `semver.lt` would THROW on garbage); `diskPending` is the ground-truth
 *     fallback in that case.
 *   - diskPending: the project migration chain still reports pending work —
 *     legacy flat `memory/{core,stack}` not yet wrapped under `code/`, OR the
 *     flat workspace (`plans/`, `patches/`, `researches/`, `PLAN.md`,
 *     `FIX_PLAN.md`) not yet relocated under `.unikit/code/`. Operational
 *     hazard — a sync now reconciles against the empty new path and splices
 *     every rule out of `.unikit.json` state. This signal, not `versionStale`,
 *     is what gates the workspace relocation (it ships to 1.1.0 projects).
 *
 * Truth table (ver × disk): ok/ok → false; ok/pending → true (disk is ground
 * truth); stale/modular → true (accepted false-positive: cost = run `update`
 * once); stale/pending → true. OR (not AND) keeps the two mixed rows true.
 */
async function isProjectStale(projectDir: string, config: UniKitConfig): Promise<boolean> {
  const version = config.version;
  const versionStale = !!semver.valid(version) && semver.lt(version, MEMORY_MODULAR_MIN_VERSION);
  const diskPending = (await planMigrationChain({ projectDir }, PROJECT_MEMORY_MIGRATIONS)).length > 0;
  return versionStale || diskPending;
}

/**
 * Refuse `rules sync` / `rules install` on a stale project (exit 8). `update`
 * is the sole migrator — running sync/install first would reconcile against the
 * empty modular path and wipe the installed-rule state. Refuse-over-autofix:
 * point the user at `update` rather than silently migrating inside a command
 * that is not the migrator. Must be called AFTER `loadConfigOrExit` but BEFORE
 * the registry is built/fetched, so a stale project fails fast with exit 8 and
 * never surfaces an unrelated exit 2 from an unreachable registry.
 */
async function assertProjectMigrated(projectDir: string, config: UniKitConfig): Promise<void> {
  if (await isProjectStale(projectDir, config)) {
    console.error(chalk.red('Project is out of date'));
    console.error(chalk.yellow(
      'Run `unikit-ai update` in the current project folder first, then retry.',
    ));
    exitWithCode(EXIT.PROJECT_OUT_OF_DATE);
  }
}

// =====================================================================
// Shared `--module` resolution
// =====================================================================

/**
 * Resolve the `--module` flag to a registered module descriptor (default:
 * `code`, the back-compat scope of every `rules` command). Unknown ids are an
 * argument error (exit 3) — the available set is `MODULE_REGISTRY`.
 */
function resolveModuleOptionOrExit(moduleOpt: string | undefined): Module {
  const id = moduleOpt ?? CODE_MODULE_ID;
  const module = getModule(id);
  if (!module) {
    console.error(chalk.red(`Unknown module "${id}". Available: ${Object.keys(MODULE_REGISTRY).join(', ')}`));
    exitWithCode(EXIT.INVALID_ARGS);
  }
  return module;
}

/** Capitalized tier label for human tables (`core` → `Core`). */
function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

// =====================================================================
// list — lean catalog from registry (multi-module)
// =====================================================================
//
// Scope resolution (mirrors `rulesStatusCommand`): no `--module` → every
// registered module as blocks; `--module X` → one module (bad id → exit 3).
//
// Exit / empty-catalog contract — THREE distinct per-catalog branches that must
// not be collapsed into one (each module resolves its own reachability):
//   (a) EVERY catalog `!reachable`            → exit 2 (the ONLY path to exit 2)
//   (b) catalog reachable && !engineAvailable → warning (stderr) + empty
//                                               contribution + exit 0
//   (c) catalog `!reachable`                  → silent skip (no block, no rows),
//                                               still counted toward (a)
// `exit 1` is reserved exclusively for "no `.unikit.json`" (loadConfigOrExit);
// engine-missing is NO LONGER an exit-1 path.

/** One rendered catalog row, tagged with its module + tier. */
interface ListRow {
  id: string;
  module: string;
  category: Tier;
  description: string;
  version: string;
}

/**
 * A surviving (reachable) module's contribution to the listing. Absent
 * (`!reachable`) modules are dropped before this stage (branch (c)).
 */
type ListSection =
  | { kind: 'rules'; module: Module; rows: ListRow[] }
  | { kind: 'engine-missing'; module: Module; engines: string[] };

export async function rulesListCommand(options: { json?: boolean; engine?: string; module?: string }): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = options.engine ?? config.engine;

  // Scope: a single module with `--module`, every registered module otherwise.
  // Registry order keeps `code` first so the flat-all JSON stays stable.
  const singleModule = options.module !== undefined;
  const scope: Module[] = singleModule
    ? [resolveModuleOptionOrExit(options.module)]
    : listModules();

  logInfo('rules:list', `scope=${options.module ?? 'all'}, modules=[${scope.map(m => m.id).join(', ')}]`);

  // Build the registry ONCE keyed to the (possibly overridden) engine, then
  // resolve one catalog per module from it. `--engine` must keep working, so
  // this uses createRegistry(config.rulesRegistry, engineId) — NOT install's
  // buildRegistry (which has no engine override). Resolution is sequential to
  // avoid racing the ChainedRegistry's shared per-instance resolution state.
  const registry = createRegistry(config.rulesRegistry, engineId);
  const catalogs: { module: Module; catalog: ModuleCatalog }[] = [];
  for (const module of scope) {
    catalogs.push({ module, catalog: await resolveModuleCatalog(registry, module, engineId) });
  }

  logInfo('rules:list', `catalogs=[${catalogs.map(c => `${c.module.id}:${c.catalog.reachable ? 'reachable' : 'absent'}`).join(', ')}]`);

  // (a) Every catalog unreachable → exit 2 (the ONLY path to exit 2). A module
  // merely absent from the chain (branch (c)) is also `!reachable`, so this
  // fires only when NOTHING in scope resolved from any chain source.
  if (catalogs.every(({ catalog }) => !catalog.reachable)) {
    console.error(chalk.red('Registry chain unreachable. No catalog available.'));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  // Classify each catalog into the three branches above. The SAME `sections`
  // set feeds both the human render and the JSON branch (#json-parity — never
  // count the rule set twice in two different ways).
  const sections: ListSection[] = [];
  for (const { module, catalog } of catalogs) {
    // (c) module absent from the whole chain → silent skip.
    if (!catalog.reachable) continue;
    // (b) engine-partitioned module whose engine is missing → warning + empty
    // contribution + exit 0. The warning goes to stderr (logWarn) so `--json`
    // stdout stays a clean, parseable document.
    if (!catalog.engineAvailable) {
      logWarn('rules:list', `engine "${engineId}" not in registry for module "${module.id}" — section empty (available: ${catalog.engines.join(', ')})`);
      sections.push({ kind: 'engine-missing', module, engines: catalog.engines });
      continue;
    }
    // (a-survivor) normal: tier-ordered rows tagged with module + category.
    const rows: ListRow[] = catalog.rules.map(({ tier, rule }) => ({
      id: rule.id,
      module: module.id,
      category: tier,
      description: rule.description,
      version: rule.version,
    }));
    sections.push({ kind: 'rules', module, rows });
  }

  const allRows = sections.flatMap(s => (s.kind === 'rules' ? s.rows : []));

  // ── JSON ──
  if (options.json) {
    if (singleModule) {
      // FLAT-SINGLE (back-compat, byte-for-byte): a scoped `--module` request
      // returns `{ engine, module, rules:[{ id, category, description, version }] }`
      // with NO per-row `module` key — machine consumers always send `--module`
      // and rely on this exact shape.
      const output = {
        engine: engineId,
        module: scope[0].id,
        rules: allRows.map(r => ({ id: r.id, category: r.category, description: r.description, version: r.version })),
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    // FLAT-ALL: `{ engine, rules:[{ id, module, category, description, version }] }`
    // — every row carries its `module` (key placement mirrors `rules status`).
    const output = {
      engine: engineId,
      rules: allRows.map(r => ({ id: r.id, module: r.module, category: r.category, description: r.description, version: r.version })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // ── Human ──
  // Shared column widths so every per-module table aligns identically.
  const idWidth = Math.max(4, ...allRows.map(r => r.id.length));
  const verWidth = Math.max(7, ...allRows.map(r => `v${r.version}`.length));
  const termWidth = process.stdout.columns || 120;
  const prefixLen = 2 + idWidth + 2 + verWidth + 2;
  const descMax = Math.max(20, termWidth - prefixLen);

  const truncate = (text: string, max: number): string =>
    text.length <= max ? text : text.slice(0, max - 1) + '…';

  const printRuleTable = (title: string, rows: ListRow[]): void => {
    if (rows.length === 0) return;
    console.log(chalk.bold.cyan(title));
    const header = `  ${'ID'.padEnd(idWidth)}  ${'Version'.padEnd(verWidth)}  Description`;
    console.log(chalk.dim(truncate(header, termWidth)));
    console.log(chalk.dim(`  ${'─'.repeat(idWidth)}  ${'─'.repeat(verWidth)}  ${'─'.repeat(Math.min(40, descMax))}`));
    for (const row of rows) {
      const id = chalk.bold(row.id.padEnd(idWidth));
      const ver = chalk.dim(`v${row.version}`.padEnd(verWidth));
      const desc = truncate(row.description, descMax);
      console.log(`  ${id}  ${ver}  ${desc}`);
    }
    console.log('');
  };

  const tierCountsFor = (module: Module, rows: ListRow[]): string =>
    module.tiers.map(tier => `${rows.filter(r => r.category === tier).length} ${tier}`).join(', ');

  if (singleModule) {
    // Single-module human render — byte-for-byte the pre-multimodule format so
    // `--module <id>` stays back-compatible (Sc.9 gamedesign asserts on it).
    const section = sections[0];
    const module = scope[0];
    const catalogLabel = module.enginePartitioned ? engineId : module.id;
    console.log(chalk.bold(`\nRules catalog for ${catalogLabel}:\n`));
    if (section.kind === 'engine-missing') {
      console.log(chalk.yellow(`Engine "${engineId}" not in registry — catalog empty.`));
      console.log(chalk.dim(`Available engines: ${section.engines.join(', ')}`));
      console.log(chalk.dim(`\nTotal: 0 rules (${module.tiers.map(t => `0 ${t}`).join(', ')})`));
      return;
    }
    for (const tier of module.tiers) {
      printRuleTable(`${tierLabel(tier)} rules:`, section.rows.filter(r => r.category === tier));
    }
    console.log(chalk.dim(`Total: ${section.rows.length} rules (${tierCountsFor(module, section.rows)})`));
    return;
  }

  // Multi-module human render — one block per surviving module.
  console.log(chalk.bold(`\nRules catalog (engine: ${engineId}):\n`));
  const footerParts: string[] = [];
  for (const section of sections) {
    const module = section.module;
    const header = module.enginePartitioned ? `── ${module.id} (${engineId}) ──` : `── ${module.id} ──`;
    console.log(chalk.bold(header));
    if (section.kind === 'engine-missing') {
      console.log(chalk.yellow(`  engine "${engineId}" not in registry — section empty`));
      console.log(chalk.dim(`  available: ${section.engines.join(', ')}\n`));
      footerParts.push(`${module.id}: engine missing`);
      continue;
    }
    for (const tier of module.tiers) {
      printRuleTable(`${tierLabel(tier)} rules:`, section.rows.filter(r => r.category === tier));
    }
    footerParts.push(`${module.id}: ${tierCountsFor(module, section.rows)}`);
  }
  console.log(chalk.dim(`Total: ${allRows.length} rules (${footerParts.join('; ')})`));
}

// =====================================================================
// show — preview a single rule from registry (module-agnostic)
// =====================================================================
//
// Scope: no `--module` → search the id across EVERY registered module;
// `--module X` → search one module only. Exit contract:
//   - ALL catalogs `!reachable`                 → exit 2 (network guard, parity
//                                                 with list (a) + install)
//   - exactly 1 hit                             → fetch + print (exit 0)
//   - >1 hits (same id in multiple modules)     → exit 3 (ambiguous — pass
//                                                 --module to disambiguate)
//   - 0 hits while ≥1 catalog is reachable      → exit 1 (not found anywhere)
// Engine-missing for `code` is NOT a hard fail — it just yields no `code` hits
// (other modules are still searched).

export async function rulesShowCommand(id: string, options: { references?: boolean; module?: string }): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = config.engine;

  const scope: Module[] = options.module !== undefined
    ? [resolveModuleOptionOrExit(options.module)]
    : listModules();

  logInfo('rules:show', `searching ${id} across modules=[${scope.map(m => m.id).join(', ')}]`);

  const registry = buildRegistry(config);
  const catalogs: { module: Module; catalog: ModuleCatalog }[] = [];
  for (const module of scope) {
    catalogs.push({ module, catalog: await resolveModuleCatalog(registry, module, engineId) });
  }

  // Network guard FIRST (do not lose it in the multi-catalog refactor): only
  // when EVERY catalog is unreachable is this a network error. As long as one
  // catalog is reachable, 0 hits means "not found", not "unreachable".
  if (catalogs.every(({ catalog }) => !catalog.reachable)) {
    console.error(chalk.red('Registry unreachable.'));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  // Gather hits across reachable + engine-available catalogs by canonical id.
  // An engine-missing `code` catalog simply contributes no hits (skipped here)
  // rather than hard-failing the whole lookup.
  const normalizedId = normalizeRuleId(id);
  const hits: { module: Module; tier: Tier; rule: CatalogRule['rule'] }[] = [];
  for (const { module, catalog } of catalogs) {
    if (!catalog.reachable || !catalog.engineAvailable) continue;
    const hit = catalog.rules.find(r => normalizeRuleId(r.rule.id) === normalizedId);
    if (hit) hits.push({ module, tier: hit.tier, rule: hit.rule });
  }

  if (hits.length === 0) {
    const where = options.module !== undefined ? `module "${scope[0].id}"` : 'any module';
    console.error(chalk.red(`Rule "${id}" not found in registry for ${where}.`));
    exitWithCode(EXIT.NOT_FOUND);
  }

  if (hits.length > 1) {
    const mods = hits.map(h => h.module.id).join(', ');
    logWarn('rules:show', `ambiguous id "${id}" across modules: ${mods}`);
    console.error(chalk.red(`Rule "${id}" found in multiple modules: ${mods} — pass --module to disambiguate.`));
    exitWithCode(EXIT.INVALID_ARGS);
  }

  const { module, tier, rule: found } = hits[0];
  const fetched = await registry.fetchRule(module.id, engineId, tier, found.id);

  if (!fetched) {
    console.error(chalk.red(`Failed to fetch rule content for "${found.id}".`));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  const { loadWhen } = parseRuleMetadataFromContent(fetched.content);

  console.log(chalk.bold(`\n${found.id} (${tier}) v${found.version}\n`));
  console.log(chalk.dim(`Description: ${found.description}`));
  console.log(chalk.dim(`Load when:   ${loadWhen}`));
  if (found.references && found.references.length > 0) {
    console.log(chalk.dim(`References:  ${found.references.join(', ')}`));
  }
  console.log(chalk.dim('---'));
  console.log(fetched.content);

  if (options.references && found.references && found.references.length > 0) {
    const refs = await registry.fetchReferences(module.id, engineId, tier, found.id, found.references);
    for (const ref of refs) {
      console.log(chalk.bold(`\n--- Reference: ${ref.filename} ---\n`));
      console.log(ref.content);
    }
  }
}

// =====================================================================
// install — variadic fetch + write + state update (+ no-args bootstrap)
// =====================================================================
//
// `unikit-ai rules install`              — no args: walk every registered
//                                          module and install rules by its
//                                          bootstrap policy (`code` →
//                                          always-tagged set, `gamedesign` →
//                                          every core+library rule). This is
//                                          the bootstrap used by /unikit
//                                          Step 9.2.
// `unikit-ai rules install <id>...`      — variadic: install one or more
//                                          user-specified rules in one call,
//                                          fetching each module manifest once.
//                                          Scope defaults to the `code` module;
//                                          pass `--module <id>` to target
//                                          another module's catalog.
// `unikit-ai rules install <id> --force` — re-fetch even rules already in state
//                                          (per-rule force; NOT the same as the
//                                          old `sync --force`, which has been
//                                          decomposed into `sync --replace`
//                                          `--prune`).
//
// Exit-code contract (shared by no-args + variadic):
//   0  at least one rule installed/already-installed, no fatal errors
//   1  every requested id failed (fetch-failed or not-found)
//   2  registry chain unreachable (fatal — abort partition, nothing installed)
//   3  unknown `--module` value
//   5  engine missing from manifest OR no-args call where the SUMMED bootstrap
//      set across all target modules is empty. A module that is merely absent
//      from the registry (schema:1 source, code-only custom registry) yields
//      an empty per-module catalog and is skipped gracefully — never an error.
//
//   "Already installed" is absorbed into the aggregated report as a per-rule
//   `↻` line and does NOT emit exit 4 — that keeps `/unikit` Step 9.2 idempotent
//   across re-runs and matches the old core-install behaviour. Exit 4 is still
//   reserved in the EXIT enum for other operations (file-exists guards, etc.).
//
// Aggregated report format (one line per rule + one summary line):
//   ✓ installed core/<id> v<ver>      — fresh install or `--force` overwrite
//   ↻ already installed core/<id>     — idempotent skip (hash + state match)
//   ✗ failed core/<id>: <reason>      — fetch/lookup error, continues loop
//   Rules: N installed, M already-installed, K failed
//
// Non-code modules prefix their label with the module id
// (`✓ installed gamedesign/library/<id> v<ver>`); the code module keeps the
// bare `<tier>/<id>` form. The `/unikit` Step 9.7 skill-side update parses
// this format — keep the per-rule prefix characters (`✓` / `↻` / `✗`), the
// code-module label shape, and the summary wording stable.

function printInstallReport(lines: InstallReportLine[]): void {
  for (const line of lines) {
    const base = line.category === 'unknown' ? line.id : `${line.category}/${line.id}`;
    const label = line.module === CODE_MODULE_ID ? base : `${line.module}/${base}`;
    switch (line.status) {
      case 'installed':
        console.log(chalk.green(`✓ installed ${label}${line.version ? ` v${line.version}` : ''}`));
        break;
      case 'already-installed':
        console.log(chalk.dim(`↻ already installed ${label}`));
        break;
      case 'failed':
        console.log(chalk.red(`✗ failed ${label}${line.reason ? `: ${line.reason}` : ''}`));
        break;
    }
  }
  const installed = lines.filter(l => l.status === 'installed').length;
  const already = lines.filter(l => l.status === 'already-installed').length;
  const failed = lines.filter(l => l.status === 'failed').length;
  console.log(chalk.bold(`Rules: ${installed} installed, ${already} already-installed, ${failed} failed`));
}

function printRulesInstallHelp(): void {
  console.log('Usage: unikit-ai rules install [defaults | <id>...]');
  console.log('');
  console.log('  defaults        Bootstrap rules for every module whose skills are installed.');
  console.log('                  code: the registry always-tagged (core) set; gamedesign: all');
  console.log('                  core + library rules. This is the bootstrap used by /unikit');
  console.log('                  Step 9.2. ("defaults" is a reserved token; a rule literally');
  console.log('                  named "defaults" cannot be installed by id.)');
  console.log('  <id>...         Install one or more specific rules by id (code module by');
  console.log('                  default; pass --module to target another module).');
  console.log('');
  console.log('Options:');
  console.log('  --force         Re-fetch and overwrite rules already installed.');
  console.log('  --module <id>   Scope to a knowledge module.');
  console.log('');
  console.log('Examples:');
  console.log('  unikit-ai rules install defaults');
  console.log('  unikit-ai rules install code-style r3');
  console.log('  unikit-ai rules install defaults --module gamedesign');
}

export async function rulesInstallCommand(ids: string[], options: { force?: boolean; module?: string } = {}): Promise<void> {
  // Bare `rules install` (no ids) prints help and exits 0. This MUST run before
  // loadConfigOrExit / assertProjectMigrated so it works outside a project too —
  // bootstrap now lives behind the explicit `defaults` keyword, not no-args.
  if (ids.length === 0) {
    printRulesInstallHelp();
    return;
  }

  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = config.engine;

  // Refuse on a stale (un-migrated) project BEFORE touching the registry, so a
  // stale project fails fast with exit 8 instead of an unreachable-registry
  // exit 2. `update` is the sole migrator.
  await assertProjectMigrated(projectDir, config);

  const registry = buildRegistry(config);

  // `defaults` is a reserved keyword: it triggers the module-aware bootstrap and
  // cannot be combined with explicit ids.
  const isDefaults = ids[0] === 'defaults';
  if (isDefaults && ids.length > 1) {
    console.error(chalk.red('`rules install defaults` does not take rule ids.'));
    console.error(chalk.dim('Use `rules install <id>...` for specific rules, or `rules install defaults` to bootstrap.'));
    exitWithCode(EXIT.INVALID_ARGS);
  }

  // Target modules: an explicit `--module` wins everywhere. Otherwise `defaults`
  // bootstraps every module whose SKILLS are installed (the invariant: a
  // module's rules follow its installed skills, not its registration), while a
  // variadic id list keeps the back-compat `code` scope.
  const targetModules: Module[] = options.module !== undefined
    ? [resolveModuleOptionOrExit(options.module)]
    : isDefaults
      ? listModules().filter(m => moduleHasInstalledSkills(config, m))
      : [resolveModuleOptionOrExit(undefined)];

  // Resolve each target module's catalog once per invocation. The catalogs are
  // resolved (and gated) here, by the CLI wrapper, so the pre-install exit gates
  // can run BEFORE the exit-free bootstrapModuleRules installs anything.
  const catalogs = new Map<string, ModuleCatalog>();
  for (const module of targetModules) {
    catalogs.set(module.id, await resolveModuleCatalog(registry, module, engineId));
  }

  // Pre-install gate 1 — reachability (exit 2). Only fires when there ARE
  // catalogs in scope and every one is unreachable (the chain is down). With no
  // target modules (e.g. `defaults` where no installed skill resolves to a
  // module) there is nothing to reach — fall through to the empty gate below.
  if (catalogs.size > 0 && [...catalogs.values()].every(c => !c.reachable)) {
    console.error(chalk.red('Registry chain unreachable.'));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  // Pre-install gate 2 — engine existence (exit 5, engine-partitioned targets).
  // The accessors collapse "engine missing" and "tier empty" to `[]`, so the
  // exit-5 contract is re-established here before any install. A module merely
  // ABSENT from the registry is NOT an error — its catalog is empty and the
  // bootstrap skips it gracefully (schema:1 and code-only custom registries
  // stay valid sources).
  for (const catalog of catalogs.values()) {
    if (catalog.reachable && !catalog.engineAvailable) {
      console.error(chalk.red(`Engine "${engineId}" not found in registry.`));
      console.error(chalk.dim(`Available: ${catalog.engines.join(', ')}`));
      exitWithCode(EXIT.VALIDATION_FAILED);
    }
  }

  let report: InstallReportLine[];
  if (isDefaults) {
    // Module-aware bootstrap via the exit-free primitive. Catalogs were resolved
    // + gated above; bootstrapModuleRules only builds work items by each
    // module's policy (always-core / all-rules) and installs them.
    const result = await bootstrapModuleRules(
      projectDir, config, registry, engineId, [...catalogs.values()], { force: options.force === true },
    );
    report = result.report;

    // Post-call gate 3 — empty bootstrap (exit 5). An empty report means no
    // module in scope contributed a work item (no always-tagged code rules, no
    // gamedesign rules, or no module had installed skills). "Gate before
    // install" holds: an empty work set installs nothing. The legacy
    // code-engine-missing path still exits 5 earlier via the engine gate.
    if (report.length === 0) {
      console.error(chalk.red('No bootstrap rules found for any module whose skills are installed.'));
      exitWithCode(EXIT.VALIDATION_FAILED);
    }
  } else {
    // Variadic: install each user-specified id on the single target module
    // (code by default), fetching the module manifest once. No allowAlready /
    // preferredTier — matches the legacy per-id behaviour exactly.
    const module = targetModules[0];
    report = [];
    for (const id of ids) {
      const catalog = catalogs.get(module.id);
      const line = await installOneRule(
        projectDir, config, registry, module, catalog?.rules ?? [], engineId, id,
        { force: options.force === true },
      );
      report.push(line);
    }
  }

  const anyStateChange = report.some(l => l.status === 'installed');
  if (anyStateChange) {
    await saveConfig(projectDir, config);
  }

  // Regenerate RULES_INDEX.md on every invocation — matches the old
  // `core-install` contract (Phase 3 of sync) so /unikit Step 9.2 always sees
  // a fresh index after the bootstrap, even when every always-tagged rule was
  // already on disk. Walks EVERY registered module (not just the targets):
  // the generator skips/removes empty indexes on its own, so untouched
  // modules stay consistent at no cost.
  const requiredBy = await loadRequiredByMap();
  for (const module of listModules()) {
    const installedByTier: InstalledByTier = {};
    const originByRule: Record<string, RuleOrigin> = {};
    for (const tier of module.tiers) {
      const entries = getModuleTier(config, module.id, tier);
      installedByTier[tier] = entries.map(e => e.name);
      for (const e of entries) {
        if (e.origin) originByRule[e.name] = e.origin;
      }
    }
    await generateRulesIndex(projectDir, module, installedByTier, requiredBy, originByRule);
  }

  printInstallReport(report);
  console.log(chalk.dim('✓ RULES_INDEX.md regenerated'));

  // Post-call gate 4 — all-failed (exit 1). Distinct from the empty gate: here
  // work items existed (manifest present) but every fetch failed. Without this,
  // an all-failed bootstrap on a flaky registry would silently exit 0.
  const anySuccessful = report.some(l => l.status === 'installed' || l.status === 'already-installed');
  if (!anySuccessful) {
    exitWithCode(EXIT.NOT_FOUND);
  }
}

// =====================================================================
// sync — reconcile disk ↔ .unikit.json + regenerate RULES_INDEX.md
// =====================================================================

/**
 * Human-readable renderer for SyncRulesEvent[] — keeps the sync-command and
 * `unikit-ai update` output consistent. Both paths render the same events.
 */
export function renderSyncRulesEvents(events: SyncRulesEvent[]): void {
  for (const ev of events) {
    switch (ev.kind) {
      case 'phase1:untracked-found':
        console.log(chalk.yellow(`Found untracked rule: ${ev.tier}/${ev.name} — registering as local`));
        break;
      case 'phase1:missing-removed':
        console.log(chalk.yellow(`Rule ${ev.tier}/${ev.name} missing from disk — removing from state`));
        break;
      case 'phase1:state-reconciled':
        console.log(chalk.green('✓ State reconciled'));
        break;
      case 'phase1:state-in-sync':
        logInfo('rules:sync', 'state is in sync with disk');
        break;
      case 'phase2:registry-unreachable':
        logInfo('rules:sync', 'registry unreachable, skipping registry sync');
        break;
      case 'phase2:engine-missing':
        logInfo('rules:sync', `engine ${ev.engineId} not found in registry`);
        break;
      case 'phase2:updating': {
        const verb = ev.action === 'install' ? 'Installing' : 'Updating';
        const from = ev.fromVersion ? `v${ev.fromVersion}` : '—';
        console.log(chalk.cyan(`${verb} ${ev.tier}/${ev.name}: ${from} → v${ev.toVersion}`));
        break;
      }
      case 'phase2:fetch-failed':
        console.log(chalk.yellow(`  Failed to fetch ${ev.name}, skipping`));
        break;
      case 'phase2:skipped-local-mod':
        console.log(chalk.yellow(`  ${ev.name} has local modifications — skipping (use --replace to overwrite)`));
        break;
      case 'phase2:overwrite-local-mod':
        console.log(chalk.yellow(`  ${ev.name} has local modifications — overwriting from registry (--replace)`));
        break;
      case 'phase2:override-retained':
        console.log(chalk.dim(`  ${ev.name}: keeping studio override (custom) — not overwriting with official (use --replace to force)`));
        break;
      case 'phase2:downgrade':
        console.log(chalk.yellow(`  ${ev.name} downgraded: v${ev.fromVersion} → v${ev.toVersion}`));
        break;
      case 'phase2:updated':
        console.log(chalk.green('✓ Registry rules updated'));
        break;
      case 'phase2:up-to-date':
        logInfo('rules:sync', 'all registry rules are up to date');
        break;
      case 'phase2:obsolete-removed':
        console.log(chalk.yellow(`Removed obsolete stack rule: ${ev.name}`));
        break;
      case 'phase3:index-regenerated':
        console.log(chalk.green('✓ RULES_INDEX.md regenerated'));
        break;
      case 'phase3:index-skipped-empty':
        logInfo('rules:sync', 'no rules on disk/in state — RULES_INDEX.md skipped');
        break;
      case 'phase3:index-removed-empty':
        console.log(chalk.yellow('Removed stale RULES_INDEX.md (no rules remain)'));
        break;
    }
  }
}

export interface RulesSyncOptions {
  /**
   * Overwrite locally-modified rule files and re-fetch rules whose registry
   * version matches the installed one. Does NOT remove obsolete stack rules
   * on its own — combine with `--prune` for the full "mirror the registry"
   * behaviour of the old `sync --force`.
   */
  replace?: boolean;
  /**
   * Remove obsolete stack rules that vanished from the registry manifest.
   * Scoped to stack (core rules are always-tagged). Composable with
   * `--replace`: `sync --replace --prune` is the old `sync --force`.
   */
  prune?: boolean;
}

export async function rulesSyncCommand(options: RulesSyncOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = config.engine;

  // Refuse on a stale (un-migrated) project BEFORE touching the registry — a
  // sync against the empty modular path would splice every rule out of state.
  // `update` is the sole migrator.
  await assertProjectMigrated(projectDir, config);

  const registry = buildRegistry(config);
  const result = await syncAllModules(projectDir, engineId, config, registry, {
    replace: options.replace === true,
    prune: options.prune === true,
  });

  renderSyncRulesEvents(result.events);

  if (result.changed) {
    await saveConfig(projectDir, config);
  }
}

// =====================================================================
// status — installed rules with source/origin/version/hash
// =====================================================================

export async function rulesStatusCommand(options: { json?: boolean; checkUpdates?: boolean; module?: string }): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);

  // Scope: one module with `--module`, every registered module otherwise.
  // Registry order keeps `code` first, so the JSON rules array stays
  // back-compatible (code core, code stack, then other modules).
  const scope: Module[] = options.module !== undefined
    ? [resolveModuleOptionOrExit(options.module)]
    : listModules();

  const allRules = scope.flatMap(module =>
    module.tiers.flatMap(tier =>
      getModuleTier(config, module.id, tier).map(e => ({ ...e, module: module.id, category: tier })),
    ));

  // Resolve null/empty `rulesRegistry` to the official URL — the runtime
  // does this anyway in `createRegistry()`, and exposing the resolved value
  // here keeps `rules status` and `rules registry` honest about which source
  // the CLI will hit.
  const effectiveRegistry = resolveRegistryUrl(config.rulesRegistry);
  const registryConfigured = config.rulesRegistry !== null && config.rulesRegistry.trim().length > 0;

  // Non-blocking staleness probe. `rules status` is a read — it never refuses,
  // so this is surfaced as a warning (human) / `outOfDate` field (JSON), NOT an
  // exit code. It uses the same signal `rules sync` / `rules install` refuse on.
  const outOfDate = await isProjectStale(projectDir, config);

  if (options.json) {
    const output = {
      engine: config.engine,
      registry: effectiveRegistry,
      registryKind: detectRegistryKind(effectiveRegistry),
      registryConfigured,
      outOfDate,
      rules: allRules.map(r => ({
        name: r.name,
        module: r.module,
        category: r.category,
        source: r.source,
        origin: r.origin ?? null,
        version: r.version ?? null,
        installed_hash: r.installed_hash ?? null,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(chalk.bold(`\nInstalled rules (engine: ${config.engine}):\n`));

  if (outOfDate) {
    console.log(chalk.yellow(
      '⚠ Project is out of date — `.unikit/` layout (memory and/or workspace) not migrated to the modular `code/` module.',
    ));
    console.log(chalk.yellow('  Run `unikit-ai update` before `rules sync` / `rules install`.'));
    console.log('');
  }

  if (registryConfigured) {
    console.log(chalk.dim(`Registry: ${effectiveRegistry}`));
  } else {
    console.log(chalk.dim(`Registry: ${effectiveRegistry} ${chalk.gray('(default — official)')}`));
  }
  console.log('');

  // Compute column widths
  const nameWidth = Math.max(4, ...allRules.map(r => r.name.length));
  const verWidth = Math.max(7, ...allRules.map(r => (r.version ? `v${r.version}` : '—').length));
  const srcWidth = Math.max(6, ...allRules.map(r => (r.source + (r.origin ? `:${r.origin}` : '')).length));

  function printStatusTable(title: string, rules: typeof allRules): void {
    if (rules.length === 0) return;

    console.log(chalk.bold.cyan(title));
    const header = `  ${'Name'.padEnd(nameWidth)}  ${'Version'.padEnd(verWidth)}  ${'Source'.padEnd(srcWidth)}`;
    console.log(chalk.dim(header));
    console.log(chalk.dim(`  ${'─'.repeat(nameWidth)}  ${'─'.repeat(verWidth)}  ${'─'.repeat(srcWidth)}`));

    for (const rule of rules) {
      const name = chalk.bold(rule.name.padEnd(nameWidth));
      const ver = rule.version ? chalk.dim(`v${rule.version}`.padEnd(verWidth)) : chalk.dim('—'.padEnd(verWidth));
      const src = chalk.dim((rule.source + (rule.origin ? `:${rule.origin}` : '')).padEnd(srcWidth));
      console.log(`  ${name}  ${ver}  ${src}`);
    }
    console.log('');
  }

  // Per-(module, tier) tables. The code module keeps the bare `Core:`/`Stack:`
  // titles (back-compat output shape); other modules qualify the tier with
  // their id (`gamedesign core:`) so two same-named tiers stay distinguishable.
  const tierCounts: string[] = [];
  for (const module of scope) {
    for (const tier of module.tiers) {
      const rules = allRules.filter(r => r.module === module.id && r.category === tier);
      const isCode = module.id === CODE_MODULE_ID;
      printStatusTable(isCode ? `${tierLabel(tier)}:` : `${module.id} ${tier}:`, rules);
      // The code module always shows its counts (legacy shape, zeros included);
      // in the all-modules scope other modules appear only when they hold
      // rules, while an explicit single-module `--module` scope always shows
      // its tiers (a bare `Total: 0 rules ()` would be malformed otherwise).
      if (isCode || rules.length > 0 || scope.length === 1) {
        tierCounts.push(`${rules.length} ${isCode ? tier : `${module.id}/${tier}`}`);
      }
    }
  }

  console.log(chalk.dim(`\nTotal: ${allRules.length} rules (${tierCounts.join(', ')})`));
}

// (The old `rulesCoreInstallCommand` has been merged into the variadic
// `rulesInstallCommand` above — see "install — variadic fetch + write + state
// update (+ no-args core bootstrap)".)

// =====================================================================
// registry — nested subcommands: show, set, reset, init
// =====================================================================
//
// `unikit-ai rules registry [show]`         — print current registry URL
// `unikit-ai rules registry set <url>`      — write rulesRegistry, do NOT sync
// `unikit-ai rules registry reset`          — clear rulesRegistry, do NOT sync
// `unikit-ai rules registry init [path]`    — scaffold a local registry
//
// None of the write subcommands trigger rule synchronisation. Users run
// `unikit-ai rules sync [--replace] [--prune]` afterwards when they want
// to pull content from the freshly-configured registry. The post-change
// hints block (see `printRegistryHints`) nudges the user toward the right
// next step without silently rewriting their rule files.

export interface RulesRegistryShowOptions {
  json?: boolean;
}

export interface RulesRegistrySetOptions {
  json?: boolean;
}

export interface RulesRegistryResetOptions {
  json?: boolean;
}

function printRegistryHints(changeKind: 'set' | 'reset'): void {
  const lines = changeKind === 'set'
    ? [
      'Rule content on disk was left untouched. Next steps:',
      '  • `unikit-ai rules sync`            — fetch updates for rules already installed',
      '  • `unikit-ai rules sync --replace`  — also overwrite local modifications',
      '  • `unikit-ai rules sync --prune`    — remove obsolete stack rules',
      '  • `unikit-ai rules install <id>...` — explicitly install additional rules',
    ]
    : [
      'Registry reset to the default (official). Rule content on disk was left untouched.',
      '  • `unikit-ai rules sync` — reconcile against the default registry',
    ];
  for (const line of lines) {
    console.log(chalk.dim(line));
  }
}

export async function rulesRegistryShowCommand(options: RulesRegistryShowOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);

  const configured = !!config.rulesRegistry;
  const resolved = resolveRegistryUrl(config.rulesRegistry);
  const kind: RegistryKind | null = detectRegistryKind(resolved);

  if (options.json) {
    console.log(JSON.stringify({ configured, url: resolved, kind }, null, 2));
    return;
  }

  if (configured) {
    console.log(`Registry: ${resolved}${kind ? chalk.dim(` [${kind}]`) : ''}`);
  } else {
    console.log(`Registry: ${resolved} ${chalk.dim('(default — official)')}${kind ? chalk.dim(` [${kind}]`) : ''}`);
  }
}

export async function rulesRegistrySetCommand(url: string, options: RulesRegistrySetOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);

  // Detect kind BEFORE normalization — normalization is URL-specific
  const rawKind = detectRegistryKind(url);
  if (!rawKind) {
    console.error(chalk.red(`Invalid registry input: "${url}" — use absolute path, file://, http(s)://, or ~/`));
    exitWithCode(EXIT.INVALID_ARGS);
  }

  // Normalize GitHub URLs only for url kind
  let normalized = url;
  if (rawKind === 'url') {
    normalized = await normalizeRegistryUrl(url);
    if (normalized !== url) {
      logInfo('rules:registry', `normalized: ${url} → ${normalized}`);
    }
  }

  const formatError = validateUrlFormat(normalized);
  if (formatError) {
    console.error(chalk.red(`Invalid registry input: ${formatError}`));
    exitWithCode(EXIT.INVALID_ARGS);
  }

  const validation = await validateRegistry(normalized, config.engine, 'strict');
  if (!validation.valid) {
    console.error(chalk.red(`Registry validation failed: ${validation.error}`));
    exitWithCode(EXIT.VALIDATION_FAILED);
  }

  config.rulesRegistry = normalized;
  await saveConfig(projectDir, config);

  if (options.json) {
    console.log(JSON.stringify({
      configured: true,
      url: normalized,
      kind: detectRegistryKind(normalized),
    }, null, 2));
    return;
  }

  console.log(chalk.green(`✓ Registry set to: ${normalized}`));
  printRegistryHints('set');
}

export async function rulesRegistryResetCommand(options: RulesRegistryResetOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);

  // [FIX] Store the literal `OFFICIAL_REGISTRY_URL` instead of `null`. Before
  // this change, `reset` left `.unikit.json.rulesRegistry: null` and relied on
  // the runtime to resolve null → official on every lookup. That produced a
  // confusing file: users opened `.unikit.json` after a reset and saw `null`
  // even though the wizard (when declining a custom registry) writes the
  // official URL literal in the same field. The two paths now converge:
  // both wizard-declined-custom and `registry reset` store the same concrete
  // URL. Legacy `null` values still load correctly via `resolveRegistryUrl`
  // — no migration needed.
  logInfo('rules:registry-reset', `writing OFFICIAL_REGISTRY_URL literal to .unikit.json (was: ${config.rulesRegistry === null ? 'null' : JSON.stringify(config.rulesRegistry)})`);
  config.rulesRegistry = OFFICIAL_REGISTRY_URL;
  await saveConfig(projectDir, config);

  const resolved = resolveRegistryUrl(config.rulesRegistry);

  if (options.json) {
    console.log(JSON.stringify({
      configured: true,
      url: resolved,
      kind: detectRegistryKind(resolved),
    }, null, 2));
    return;
  }

  console.log(chalk.green(`✓ Registry reset to default (official): ${resolved}`));
  printRegistryHints('reset');
}

// =====================================================================
// registry init — scaffold a new local rules registry
// =====================================================================
//
// Moved from src/cli/commands/rules-registry-init.ts (now deleted). The
// scaffold copies the minimal template set (package.json, RULE_TEMPLATE.md,
// scripts/build-manifest.js) from the bundled `rules-registry/` snapshot
// and creates empty `<engineId>/{core,stack}/` directories.
//
// Engine selection:
//   - If the caller's CWD contains `.unikit.json`, scaffold only that engine.
//   - Otherwise, scaffold all 4 engines from ENGINE_REGISTRY.
//
// Does NOT:
//   - run `git init`
//   - touch `.unikit.json` of the caller's project
//   - copy LICENSE, README.md, CONTRIBUTING.md, or .github/

const REGISTRY_INIT_TAG = 'rules:registry-init';

// The maintainer's schema:2 manifest regeneration tool, relative to a registry
// root. Copied on `registry init` and refreshed on `registry migrate` so a
// migrated registry never keeps a stale schema:1 build script (which would
// rebuild the flat layout and throw on the now-expected `gamedesign` module).
const BUILD_MANIFEST_SCRIPT_REL = path.join('scripts', 'build-manifest.js');

const REGISTRY_TEMPLATE_FILES = [
  'package.json',
  'RULE_TEMPLATE.md',
  BUILD_MANIFEST_SCRIPT_REL,
];

async function classifyRegistryInitTarget(targetDir: string): Promise<'ok' | 'already-registry' | 'occupied'> {
  const exists = await fs.pathExists(targetDir);
  if (!exists) return 'ok';

  const stat = await fs.stat(targetDir);
  if (!stat.isDirectory()) return 'occupied';

  const entries = await fs.readdir(targetDir);
  if (entries.length === 0) return 'ok';

  if (entries.includes('manifest.json')) return 'already-registry';

  // schema:2 layout: a `code/` module directory signals an initialized registry.
  if (entries.includes(CODE_MODULE_ID)) {
    const codeDir = path.join(targetDir, CODE_MODULE_ID);
    const s = await fs.stat(codeDir);
    if (s.isDirectory()) return 'already-registry';
  }

  return 'occupied';
}

async function copyRegistryTemplateFiles(bundledDir: string, targetDir: string): Promise<void> {
  for (const rel of REGISTRY_TEMPLATE_FILES) {
    const src = path.join(bundledDir, rel);
    const dst = path.join(targetDir, rel);
    if (!(await fs.pathExists(src))) {
      logError(REGISTRY_INIT_TAG, `bundled template missing: ${rel}`);
      exitWithCode(EXIT.VALIDATION_FAILED);
    }
    await fs.ensureDir(path.dirname(dst));
    await fs.copy(src, dst, { overwrite: true });
  }
}

async function createRegistryEngineDirs(targetDir: string, engineIds: string[]): Promise<void> {
  // Code module — engine-partitioned: `code/<engine>/<tier>`.
  for (const engineId of engineIds) {
    for (const tier of RULE_CATEGORIES) {
      await fs.ensureDir(path.join(targetDir, CODE_MODULE_ID, engineId, tier));
    }
  }
  // Reserved game-design module — non-engine: `gamedesign/<tier>`. Scaffolded
  // so a fresh registry matches the full D8 layout, even though it is not yet
  // fetched or registered as a module.
  for (const tier of GAMEDESIGN_TIERS) {
    await fs.ensureDir(path.join(targetDir, GAMEDESIGN_MODULE_ID, tier));
  }
}

async function resolveRegistryInitEngines(): Promise<string[]> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);
  if (config?.engine) {
    return [config.engine];
  }
  return getAllEngineIds();
}

function isInsideUnikitDir(targetDir: string): boolean {
  const unikitDir = path.join(process.cwd(), '.unikit');
  const rel = path.relative(unikitDir, targetDir);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export async function rulesRegistryInitCommand(pathArg?: string): Promise<void> {
  const targetDir = pathArg
    ? path.resolve(process.cwd(), pathArg)
    : process.cwd();

  if (isInsideUnikitDir(targetDir)) {
    logWarn(
      REGISTRY_INIT_TAG,
      `target "${targetDir}" is inside .unikit/ — this will conflict with 'rules sync'`,
    );
  }

  const classification = await classifyRegistryInitTarget(targetDir);
  if (classification === 'already-registry') {
    logError(REGISTRY_INIT_TAG, `registry already initialized at ${targetDir}`);
    exitWithCode(EXIT.REGISTRY_ALREADY_INITIALIZED);
  }
  if (classification === 'occupied') {
    logError(REGISTRY_INIT_TAG, `target path is not empty and does not look like a registry: ${targetDir}`);
    exitWithCode(EXIT.PATH_OCCUPIED);
  }

  const bundledDir = getBundledRegistryDir();
  if (!(await fs.pathExists(path.join(bundledDir, 'manifest.json')))) {
    logError(REGISTRY_INIT_TAG, `bundled registry snapshot missing at ${bundledDir}`);
    exitWithCode(EXIT.VALIDATION_FAILED);
  }

  await fs.ensureDir(targetDir);

  const engineIds = await resolveRegistryInitEngines();

  await copyRegistryTemplateFiles(bundledDir, targetDir);
  await createRegistryEngineDirs(targetDir, engineIds);

  // Write a schema:2 manifest directly. `init` only runs on an empty/ok target
  // (see `classifyRegistryInitTarget`), so every tier array is empty — this is
  // self-contained local CLI code, independent of the (cross-repo) schema of the
  // copied build-manifest.js. The copied build-manifest.js stays as the
  // maintainer's regeneration tool once they add rule files.
  await writeJsonFile(path.join(targetDir, 'manifest.json'), {
    schema: LATEST_SCHEMA,
    generated: new Date().toISOString(),
    modules: {
      [CODE_MODULE_ID]: {
        engines: Object.fromEntries(
          engineIds.map(engineId => [
            engineId,
            Object.fromEntries(RULE_CATEGORIES.map(tier => [tier, []])),
          ]),
        ),
      },
      [GAMEDESIGN_MODULE_ID]: {
        tiers: Object.fromEntries(GAMEDESIGN_TIERS.map(tier => [tier, []])),
      },
    },
  });

  logInfo(
    REGISTRY_INIT_TAG,
    `initialized at ${targetDir} (schema:${LATEST_SCHEMA}, engines: ${engineIds.join(', ')})`,
  );
  console.log(chalk.green(`✓ Registry scaffold created at ${targetDir} (schema:${LATEST_SCHEMA})`));
  console.log(chalk.dim(`  Engines: ${engineIds.join(', ')}`));
  console.log(chalk.dim(`  Files:   package.json, RULE_TEMPLATE.md, scripts/build-manifest.js, manifest.json`));
}

// =====================================================================
// registry migrate — maintainer on-disk schema:1 → schema:2 relocation
// =====================================================================
//
// `unikit-ai rules registry migrate [path]`
//
// Physically relocates a LOCAL registry from the flat schema:1 layout
// (`<engine>/<tier>/`) to the schema:2 layout (`code/<engine>/<tier>/`) and
// rewrites manifest.json to a clean schema:2. On a real migration it also
// refreshes the registry's `scripts/build-manifest.js` to the current schema:2
// builder — the schema:1 one ships with a schema:1 registry, rebuilds the flat
// layout, and throws on the now-expected `gamedesign` module. Idempotent: a
// second run is a sha-stable no-op (the migration's `detect` treats schema ≥ 2
// as "no work", so the build script is touched only when a relocation runs).
//
// Target resolution (no UniKit project required — registries are standalone
// repos, not `unikit-ai init` projects):
//   - an explicit `path` argument wins;
//   - otherwise the current directory WHEN it is itself a registry (a
//     `manifest.json` at its root) — the common maintainer case of running
//     `migrate` from inside a cloned/local registry checkout;
//   - otherwise the configured `rulesRegistry`, but ONLY when it is local AND a
//     UniKit project is present — remote registries cannot be migrated by the
//     CLI (clone locally first).
//
// Exit codes: 0 (migrated or already-latest), 1 (target manifest missing OR
//   the current directory is not a registry and not a UniKit project),
//   3 (no local target to migrate), 5 (resulting manifest fails validation —
//   e.g. an unsupported schema the migration could not lower).

const REGISTRY_MIGRATE_TAG = 'rules:registry-migrate';

/**
 * Refresh the migrated registry's `scripts/build-manifest.js` from the bundled
 * snapshot (the same source `registry init` copies). A schema:1 registry still
 * carries its OLD schema:1 build script after the on-disk relocation; left in
 * place it would regenerate the flat layout and throw on the now-expected
 * `gamedesign` module. The bundled schema:2 builder is itself tolerant of a
 * missing `gamedesign/` directory, so the refreshed script is safe to run on a
 * registry that has no game-design rules.
 *
 * Best-effort: a missing bundled snapshot warns but never fails the migration —
 * the schema relocation already succeeded and is the command's contract.
 */
async function refreshBuildManifestScript(targetDir: string): Promise<void> {
  const src = path.join(getBundledRegistryDir(), BUILD_MANIFEST_SCRIPT_REL);
  if (!(await fileExists(src))) {
    logWarn(
      REGISTRY_MIGRATE_TAG,
      `bundled ${BUILD_MANIFEST_SCRIPT_REL} missing — left the existing build script untouched`,
    );
    return;
  }
  const dst = path.join(targetDir, BUILD_MANIFEST_SCRIPT_REL);
  await fs.ensureDir(path.dirname(dst));
  await fs.copy(src, dst, { overwrite: true });
  logInfo(REGISTRY_MIGRATE_TAG, `refreshed ${BUILD_MANIFEST_SCRIPT_REL} to the schema:${LATEST_SCHEMA} builder`);
}

/**
 * Ensure the migrated registry's `package.json` declares `type: "module"`.
 * A schema:1 registry's original `package.json` (if any) predates the ESM
 * `build-manifest.js` refreshed alongside it — without `type: "module"`,
 * Node < 22 throws `SyntaxError: Cannot use import statement outside a
 * module` the moment the maintainer runs it. Non-destructive: existing
 * fields are preserved, only `type` is corrected.
 */
async function ensureRegistryModulePackageJson(targetDir: string): Promise<void> {
  const pkgPath = path.join(targetDir, 'package.json');
  const existing = await readJsonFile<Record<string, unknown>>(pkgPath);

  if (!existing) {
    const bundledPkg = path.join(getBundledRegistryDir(), 'package.json');
    if (await fileExists(bundledPkg)) {
      await fs.copy(bundledPkg, pkgPath, { overwrite: true });
    } else {
      await writeJsonFile(pkgPath, { private: true, type: 'module' });
    }
    logInfo(REGISTRY_MIGRATE_TAG, `ensured package.json type:module at ${pkgPath}`);
    return;
  }

  if (existing.type !== 'module') {
    await writeJsonFile(pkgPath, { ...existing, type: 'module' });
    logInfo(REGISTRY_MIGRATE_TAG, `ensured package.json type:module at ${pkgPath}`);
  }
}

async function resolveMigrateTarget(pathArg: string | undefined, projectDir: string): Promise<string> {
  if (pathArg) {
    return path.resolve(projectDir, pathArg);
  }

  // No path: prefer the current directory when it is itself a registry. A
  // registry is identified by a `manifest.json` at its root — independent of
  // any `.unikit.json`, because a rules-registry checkout is not a UniKit
  // project and must not require `unikit-ai init`.
  if (await fileExists(path.join(projectDir, 'manifest.json'))) {
    logInfo(REGISTRY_MIGRATE_TAG, `using current directory as registry target: ${projectDir}`);
    return projectDir;
  }

  // Fall back to the configured `rulesRegistry`. This path needs a UniKit
  // project (the registry URL lives in `.unikit.json`); when neither a
  // manifest nor a project is present, report that the current directory is
  // not a registry rather than the misleading "run `unikit-ai init`".
  const config = await loadConfig(projectDir);
  if (!config) {
    console.error(chalk.red(
      'Current directory is not a rules registry (no manifest.json) and not a UniKit project. '
      + 'Run `rules registry migrate` from inside a registry, or pass a path: '
      + '`rules registry migrate <path>`.',
    ));
    exitWithCode(EXIT.NOT_FOUND);
  }
  if (detectRegistryKind(config.rulesRegistry) !== 'local') {
    console.error(chalk.red(
      'No local registry to migrate. The configured registry is remote (or unset) — '
      + 'pass a path, or clone the registry locally and run `rules registry migrate <path>`.',
    ));
    exitWithCode(EXIT.INVALID_ARGS);
  }
  const resolved = resolveRegistryPath(config.rulesRegistry as string);
  if (!resolved) {
    console.error(chalk.red(`Could not resolve a local path from registry: ${config.rulesRegistry}`));
    exitWithCode(EXIT.INVALID_ARGS);
  }
  return resolved;
}

export async function rulesRegistryMigrateCommand(pathArg?: string): Promise<void> {
  const projectDir = process.cwd();
  const targetDir = await resolveMigrateTarget(pathArg, projectDir);

  const manifestPath = path.join(targetDir, 'manifest.json');
  if (!(await fileExists(manifestPath))) {
    logError(REGISTRY_MIGRATE_TAG, `no registry manifest found at ${manifestPath}`);
    exitWithCode(EXIT.NOT_FOUND);
  }

  const result = await runRegistryDiskMigration(targetDir);

  // Validate the on-disk manifest AFTER migration. A schema the migration could
  // not bring down to LATEST (e.g. schema:99) surfaces here as exit 5.
  const migrated = await readJsonFile<RegistryManifest>(manifestPath);
  const shapeError = validateManifestShape(migrated);
  if (shapeError) {
    console.error(chalk.red(`Registry manifest invalid after migrate: ${shapeError}`));
    exitWithCode(EXIT.VALIDATION_FAILED);
  }

  if (result.applied.length === 0) {
    console.log(chalk.dim(`✓ Registry already at schema:${LATEST_SCHEMA} — nothing to migrate (${targetDir})`));
  } else {
    await refreshBuildManifestScript(targetDir);
    await ensureRegistryModulePackageJson(targetDir);
    console.log(chalk.green(`✓ Registry migrated to schema:${LATEST_SCHEMA} (${targetDir})`));
    console.log(chalk.dim(`  Applied:   ${result.applied.join(', ')}`));
    console.log(chalk.dim(`  Refreshed: ${BUILD_MANIFEST_SCRIPT_REL}, package.json (type:module)`));
  }
}

// =====================================================================
// registry status — writability / migrate-capability introspection
// =====================================================================
//
// `unikit-ai rules registry status [target] [--json]`
//
// Distinct from the top-level `rules status` (which reports the project's
// INSTALLED rules). This reports whether the configured (or a passed `target`)
// registry is reachable, what PHYSICAL schema it carries, and whether the CLI
// can migrate/write it. The raw physical schema is read from a SINGLE-source
// transport (no fallback chain) so the verdict reflects that exact registry.
//
// JSON shape is 6 facts only — derived signals (a `migrate?` hint, action
// strings) are the consumer's job:
//   { target, kind: 'local'|'remote', schema: int|null, isLatestSchema,
//     readable, writable }
//
// Exit codes: 0 (reachable, schema ≤ LATEST), 2 (unreachable),
//   5 (schema > LATEST — unsupported).

export interface RulesRegistryStatusOptions {
  json?: boolean;
}

interface RegistryStatusFacts {
  target: string;
  kind: 'local' | 'remote';
  schema: number | null;
  isLatestSchema: boolean;
  readable: boolean;
  writable: boolean;
}

function registryStatusVerdict(facts: RegistryStatusFacts): string {
  if (facts.schema === null) {
    return chalk.red(`✗ unreachable`);
  }
  if (facts.schema > LATEST_SCHEMA) {
    return chalk.red(`✗ unsupported schema ${facts.schema} (max ${LATEST_SCHEMA}), upgrade unikit-ai`);
  }
  if (facts.isLatestSchema) {
    // `•` (bullet, punctuation) rather than a letter-like info glyph (U+2139):
    // src/ is guarded against non-Latin letters (test-skills.sh Part 14), which
    // `\p{Letter}` would flag. Decorative symbol glyphs (check/cross/warn/bullet)
    // are exempt because they are not letters.
    return facts.kind === 'local'
      ? chalk.green(`✓ up to date and writable`)
      : chalk.cyan(`• remote, read-only via CLI`);
  }
  // Readable but behind the latest schema.
  return facts.kind === 'local'
    ? chalk.yellow(`⚠ run \`rules registry migrate\``)
    : chalk.yellow(`⚠ remote — migrate can't write; clone/upstream`);
}

function printRegistryStatusHuman(facts: RegistryStatusFacts): void {
  const glyph = (ok: boolean): string => (ok ? chalk.green('✓') : chalk.red('✗'));
  const rows: [string, string][] = [
    ['Target', facts.target],
    ['Kind', facts.kind],
    ['Schema', facts.schema === null ? chalk.dim('unknown') : String(facts.schema)],
    ['Is Latest Schema', glyph(facts.isLatestSchema)],
    ['Readable', glyph(facts.readable)],
    ['Writable', glyph(facts.writable)],
  ];
  const keyWidth = Math.max(...rows.map(([k]) => k.length));

  console.log(chalk.bold('\nRegistry status\n'));
  for (const [key, value] of rows) {
    console.log(`  ${chalk.dim(key.padEnd(keyWidth))}  ${value}`);
  }
  console.log(`\n${registryStatusVerdict(facts)}`);
}

export async function rulesRegistryStatusCommand(
  targetArg?: string,
  options: RulesRegistryStatusOptions = {},
): Promise<void> {
  const projectDir = process.cwd();

  // An explicit target needs no UniKit project; only fall back to the
  // configured registry (which requires a project) when none was passed.
  let target: string;
  if (targetArg) {
    target = targetArg;
  } else {
    const config = await loadConfigOrExit(projectDir);
    target = resolveRegistryUrl(config.rulesRegistry);
  }

  const rawKind = detectRegistryKind(target);
  if (!rawKind) {
    console.error(chalk.red(`Invalid registry target: "${target}" — use absolute path, file://, http(s)://, or ~/`));
    exitWithCode(EXIT.INVALID_ARGS);
  }
  const kind: 'local' | 'remote' = rawKind === 'url' ? 'remote' : 'local';

  // Single-source transport — NO fallback chain, so the schema we read is this
  // registry's physical schema, not whatever the resolution chain would adopt.
  const source: RulesRegistry = rawKind === 'url' ? new GitRegistry(target) : new FsRegistry(target);
  const manifest = await source.fetchManifest();
  const schema = manifest && typeof manifest.schema === 'number' ? manifest.schema : null;

  const isLatestSchema = schema === LATEST_SCHEMA;
  const readable = schema !== null && schema <= LATEST_SCHEMA;
  const writable = isLatestSchema && kind === 'local';

  const facts: RegistryStatusFacts = { target, kind, schema, isLatestSchema, readable, writable };

  if (options.json) {
    console.log(JSON.stringify(facts, null, 2));
  } else {
    printRegistryStatusHuman(facts);
  }

  // Exit code: unreachable (2) > unsupported schema (5) > ok (0).
  if (schema === null) {
    exitWithCode(EXIT.NETWORK_ERROR);
  }
  if (schema > LATEST_SCHEMA) {
    exitWithCode(EXIT.VALIDATION_FAILED);
  }
}
