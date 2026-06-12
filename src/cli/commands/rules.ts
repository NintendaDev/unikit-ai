// --- CLI: unikit rules <subcommand> ---
// 6 subcommands: list, show, install, sync, status, registry
// `registry` is a command group with nested subcommands: show, set, reset, init

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import semver from 'semver';
import { loadConfig, saveConfig, getModuleTier } from '../../core/config.js';
import type { UniKitConfig } from '../../core/config.js';
import { planMigrationChain } from '../../core/migrations/runner.js';
import { PROJECT_MEMORY_MIGRATIONS, MEMORY_MODULAR_MIN_VERSION } from '../../core/memory-migrations/index.js';
import {
  createRegistry, detectRegistryKind, resolveRegistryUrl, resolveRegistryPath,
  OFFICIAL_REGISTRY_URL, LATEST_SCHEMA, GitRegistry, FsRegistry,
} from '../../core/registry/index.js';
import type { RulesRegistry, ChainedRegistry, RegistryRule, RegistryManifest, RuleCategory, RegistryKind } from '../../core/registry/index.js';
import { validateRegistry, validateUrlFormat, normalizeRegistryUrl, validateManifestShape, manifestEngineIds } from '../../core/registry/validator.js';
import { runRegistryDiskMigration } from '../../core/registry/migrations/index.js';
import { getAllEngineIds } from '../../core/engines.js';
import {
  generateRulesIndex, loadRequiredByMap,
  parseRuleMetadataFromContent, normalizeRuleId, type InstalledByTier,
} from '../../core/installer/rules-index.js';
import { syncAllModules, type SyncRulesEvent } from '../../core/installer/rules-sync.js';
import {
  CODE_MODULE_ID, GAMEDESIGN_MODULE_ID, GAMEDESIGN_TIERS,
  RULE_CATEGORIES, REFERENCES_DIR_NAME, moduleTierDir,
} from '../../core/constants.js';
import { MODULE_REGISTRY, getModule } from '../../core/modules.js';
import { writeTextFile, fileExists, listFiles, removeFile, readJsonFile, writeJsonFile, getBundledRegistryDir } from '../../utils/fs.js';
import { createHash } from 'crypto';
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

function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
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
// list — lean catalog from registry
// =====================================================================

export async function rulesListCommand(options: { json?: boolean; engine?: string; module?: string }): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = options.engine ?? config.engine;

  // `--module` mirrors `--engine` for parity. In PR#1 it is validation-only:
  // the single registered module is `code`, so any other value is rejected.
  // PR#3 (generic module-aware skills) gives the flag real scoping behaviour.
  if (options.module !== undefined && !getModule(options.module)) {
    console.error(chalk.red(`Unknown module "${options.module}". Available: ${Object.keys(MODULE_REGISTRY).join(', ')}`));
    exitWithCode(EXIT.INVALID_ARGS);
  }

  // Build the registry keyed to the (possibly overridden) engine so the
  // module accessors below resolve the same engine the user asked for.
  const registry = createRegistry(config.rulesRegistry, engineId);
  const manifest = await registry.fetchManifest();

  if (!manifest) {
    console.warn(chalk.yellow('WARN: Registry unreachable. No catalog available.'));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  // Explicit engine-existence predicate. The registry accessors return `[]` for
  // BOTH "engine missing" and "tier empty", so the not-found (exit 1) contract
  // must be re-established here before reading rules through the accessors.
  if (!manifestEngineIds(manifest).includes(engineId)) {
    console.error(chalk.red(`Engine "${engineId}" not found in registry.`));
    const available = manifestEngineIds(manifest).join(', ');
    console.error(chalk.dim(`Available: ${available}`));
    exitWithCode(EXIT.NOT_FOUND);
  }

  const engineRules = { core: registry.getEngineRules('core'), stack: registry.getEngineRules('stack') };

  const allRules = [
    ...engineRules.core.map(r => ({ ...r, category: 'core' as const })),
    ...engineRules.stack.map(r => ({ ...r, category: 'stack' as const })),
  ];

  if (options.json) {
    const output = {
      engine: engineId,
      rules: allRules.map(r => ({
        id: r.id,
        category: r.category,
        description: r.description,
        version: r.version,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(chalk.bold(`\nRules catalog for ${engineId}:\n`));

  // Compute column widths for aligned table
  const idWidth = Math.max(4, ...allRules.map(r => r.id.length));
  const verWidth = Math.max(7, ...allRules.map(r => `v${r.version}`.length));

  const termWidth = process.stdout.columns || 120;
  // 2 indent + idWidth + 2 gap + verWidth + 2 gap = prefix length
  const prefixLen = 2 + idWidth + 2 + verWidth + 2;
  const descMax = Math.max(20, termWidth - prefixLen);

  function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max - 1) + '…';
  }

  function printRuleTable(title: string, rules: typeof allRules): void {
    if (rules.length === 0) return;

    console.log(chalk.bold.cyan(title));
    const header = `  ${'ID'.padEnd(idWidth)}  ${'Version'.padEnd(verWidth)}  Description`;
    console.log(chalk.dim(truncate(header, termWidth)));
    console.log(chalk.dim(`  ${'─'.repeat(idWidth)}  ${'─'.repeat(verWidth)}  ${'─'.repeat(Math.min(40, descMax))}`));

    for (const rule of rules) {
      const id = chalk.bold(rule.id.padEnd(idWidth));
      const ver = chalk.dim(`v${rule.version}`.padEnd(verWidth));
      const desc = truncate(rule.description, descMax);
      console.log(`  ${id}  ${ver}  ${desc}`);
    }
    console.log('');
  }

  printRuleTable('Core rules:', allRules.filter(r => r.category === 'core'));
  printRuleTable('Stack rules:', allRules.filter(r => r.category === 'stack'));

  console.log(chalk.dim(`Total: ${allRules.length} rules (${engineRules.core.length} core, ${engineRules.stack.length} stack)`));
}

// =====================================================================
// show — preview a single rule from registry
// =====================================================================

export async function rulesShowCommand(id: string, options: { references?: boolean }): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = config.engine;

  const registry = buildRegistry(config);
  const manifest = await registry.fetchManifest();

  if (!manifest) {
    console.error(chalk.red('Registry unreachable.'));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  // Explicit engine-existence predicate before reading via the accessors —
  // they cannot tell "engine missing" (exit 1) from "tier empty" on their own.
  if (!manifestEngineIds(manifest).includes(engineId)) {
    console.error(chalk.red(`Engine "${engineId}" not found in registry.`));
    exitWithCode(EXIT.NOT_FOUND);
  }

  const engineRules = { core: registry.getEngineRules('core'), stack: registry.getEngineRules('stack') };

  // Find rule by id via canonical lowercase-hyphen normalization.
  const normalizedId = normalizeRuleId(id);
  const found = [...engineRules.core, ...engineRules.stack].find(r => normalizeRuleId(r.id) === normalizedId);

  if (!found) {
    console.error(chalk.red(`Rule "${id}" not found in registry for engine "${engineId}".`));
    exitWithCode(EXIT.NOT_FOUND);
  }

  const category: RuleCategory = engineRules.core.some(r => r.id === found.id) ? 'core' : 'stack';
  const fetched = await registry.fetchRule(CODE_MODULE_ID, engineId, category, found.id);

  if (!fetched) {
    console.error(chalk.red(`Failed to fetch rule content for "${found.id}".`));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  const { loadWhen } = parseRuleMetadataFromContent(fetched.content);

  console.log(chalk.bold(`\n${found.id} (${category}) v${found.version}\n`));
  console.log(chalk.dim(`Description: ${found.description}`));
  console.log(chalk.dim(`Load when:   ${loadWhen}`));
  if (found.references && found.references.length > 0) {
    console.log(chalk.dim(`References:  ${found.references.join(', ')}`));
  }
  console.log(chalk.dim('---'));
  console.log(fetched.content);

  if (options.references && found.references && found.references.length > 0) {
    const refs = await registry.fetchReferences(CODE_MODULE_ID, engineId, category, found.id, found.references);
    for (const ref of refs) {
      console.log(chalk.bold(`\n--- Reference: ${ref.filename} ---\n`));
      console.log(ref.content);
    }
  }
}

// =====================================================================
// install — variadic fetch + write + state update (+ no-args core bootstrap)
// =====================================================================
//
// `unikit-ai rules install`              — no args: install every core-tier rule
//                                          (core bootstrap, replaces the old
//                                          `rules core-install` used by
//                                          /unikit Step 9.2).
// `unikit-ai rules install <id>...`      — variadic: install one or more
//                                          user-specified rules in one call,
//                                          fetching the manifest once.
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
//   5  engine missing from manifest OR no-args call with no always-tagged rules
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
// The `/unikit` Step 9.7 skill-side update parses this format — keep the per-
// rule prefix characters (`✓` / `↻` / `✗`) and the summary wording stable.

type InstallReportStatus = 'installed' | 'already-installed' | 'failed';

interface InstallReportLine {
  status: InstallReportStatus;
  category: RuleCategory | 'unknown';
  id: string;
  version?: string;
  reason?: string;
}

function printInstallReport(lines: InstallReportLine[]): void {
  for (const line of lines) {
    const label = line.category === 'unknown' ? line.id : `${line.category}/${line.id}`;
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

/**
 * Install a single rule as part of a variadic batch. Mutates `config` in place
 * and returns a report line — never exits the process. Caller decides the final
 * exit code from the aggregated report.
 *
 * Preserves the single-id behaviour from the old `rulesInstallCommand`:
 *   - canonical id normalisation on lookup (so legacy `CODE-STYLE` state still
 *     resolves when the user passes `code-style` and vice versa),
 *   - re-categorisation cleanup (rule moved between core/stack),
 *   - orphan reference cleanup when re-categorising.
 */
async function installOneRule(
  projectDir: string,
  config: UniKitConfig,
  registry: RulesRegistry,
  engineRules: { core: RegistryRule[]; stack: RegistryRule[] },
  engineId: string,
  origin: 'primary' | 'official' | 'bundled' | undefined,
  rawId: string,
  options: { force?: boolean; allowAlreadyInstalled?: boolean; preferredCategory?: RuleCategory },
): Promise<InstallReportLine> {
  // Canonical lowercase-hyphen comparison lets legacy state entries like
  // `CODE-STYLE` still resolve when the user (or a script) passes the canonical
  // `code-style`, and vice versa. This is the guard that kept pre-migration
  // projects usable and must not be lost in the variadic rewrite.
  const normalizedId = normalizeRuleId(rawId);
  const coreState = getModuleTier(config, CODE_MODULE_ID, 'core');
  const stackState = getModuleTier(config, CODE_MODULE_ID, 'stack');
  const existingCore = coreState.find(e => normalizeRuleId(e.name) === normalizedId);
  const existingStack = stackState.find(e => normalizeRuleId(e.name) === normalizedId);
  const existing = existingCore ?? existingStack;

  // Find rule by id in registry (canonical lowercase-hyphen comparison). When
  // the caller hints a preferred category (core bootstrap), try that side first
  // so a rule shipped in both sides of the manifest goes where the bootstrap
  // wants it.
  let found: RegistryRule | undefined;
  let category: RuleCategory = options.preferredCategory ?? 'core';

  if (options.preferredCategory === 'stack') {
    found = engineRules.stack.find(r => normalizeRuleId(r.id) === normalizedId);
    if (!found) {
      found = engineRules.core.find(r => normalizeRuleId(r.id) === normalizedId);
      category = 'core';
    }
  } else {
    found = engineRules.core.find(r => normalizeRuleId(r.id) === normalizedId);
    if (!found) {
      found = engineRules.stack.find(r => normalizeRuleId(r.id) === normalizedId);
      category = 'stack';
    }
  }

  if (!found) {
    return {
      status: 'failed',
      category: 'unknown',
      id: rawId,
      reason: `not found in registry for engine "${engineId}"`,
    };
  }

  // Idempotency / already-installed handling.
  //
  // Three branches:
  //   1. `existing && options.force`                → always re-fetch + rewrite
  //   2. `existing && options.allowAlreadyInstalled` → hash-match skip, drift
  //                                                   re-fetch (used by
  //                                                   no-args bootstrap)
  //   3. `existing && !options.force && !allow...`  → report `already-installed`
  //                                                   (variadic user call without
  //                                                   `--force`); old single-id
  //                                                   handler emitted EXIT 4
  //                                                   here, we absorb into
  //                                                   the report instead.
  if (existing && !options.force && options.allowAlreadyInstalled !== true) {
    return { status: 'already-installed', category, id: found.id };
  }

  // Fetch rule content.
  const fetched = await registry.fetchRule(CODE_MODULE_ID, engineId, category, found.id);
  if (!fetched) {
    return {
      status: 'failed',
      category,
      id: found.id,
      reason: 'failed to fetch rule content',
    };
  }

  const newHash = computeHash(fetched.content);
  const destPath = path.join(moduleTierDir(projectDir, CODE_MODULE_ID, category), `${found.id}.md`);
  const destExists = await fileExists(destPath);

  // Idempotent skip for the no-args bootstrap path: if the file is on disk
  // and the hashes agree, keep it and report `already-installed`. This mirrors
  // the legacy `rules core-install` hash-match branch and makes `/unikit`
  // Step 9.2 safe to re-run on every invocation.
  if (
    options.allowAlreadyInstalled === true
    && !options.force
    && existing
    && existing.installed_hash === newHash
    && destExists
  ) {
    return { status: 'already-installed', category, id: found.id };
  }

  await writeTextFile(destPath, fetched.content);

  // Install references if any. Reference files live alongside the rule under
  // `.unikit/memory/<category>/references/` and are matched by filename prefix
  // on cleanup (see re-categorisation block below).
  if (found.references && found.references.length > 0) {
    const refs = await registry.fetchReferences(CODE_MODULE_ID, engineId, category, found.id, found.references);
    const destRefsDir = path.join(moduleTierDir(projectDir, CODE_MODULE_ID, category), REFERENCES_DIR_NAME);
    for (const ref of refs) {
      await writeTextFile(path.join(destRefsDir, ref.filename), ref.content);
    }
  }

  if (existing) {
    // Design note — re-categorisation cleanup (rule moved between core/stack
    // in the registry) + legacy name migration escape hatch for core rules.
    //
    // Without cleanup the old file would survive on disk, and the next
    // `rules sync` Phase 1 would register it as a `source: local` entry in
    // the stale category — producing a phantom duplicate of the rule.
    //
    // If `existing.name` is legacy (e.g. `CODE-STYLE`) and `found.id` is
    // canonical (`code-style`), the block below swaps the `.unikit.json`
    // state entry from legacy to canonical (splice from old list, push the
    // new entry under `found.id`). That is the full extent of the migration
    // performed here — on a case-sensitive filesystem the orphan
    // `CODE-STYLE.md` survives on disk and the next `rules sync` Phase 1
    // re-registers it as `source: local`, producing a persistent duplicate.
    // `rules sync --replace --prune` does NOT help for core rules: the
    // obsolete-remove block in `syncRulesState` is scoped to
    // `category === 'stack'`. Core rules require MANUAL cleanup — edit
    // `.unikit.json` and remove the legacy entry, then delete the orphan
    // file on disk. This is the documented escape hatch for core.
    const oldCategory: RuleCategory = existingCore ? 'core' : 'stack';
    if (oldCategory !== category) {
      logInfo('rules:install', `re-categorized ${existing.name}: ${oldCategory} → ${category}`);
      const oldPath = path.join(moduleTierDir(projectDir, CODE_MODULE_ID, oldCategory), `${existing.name}.md`);
      if (await fileExists(oldPath)) {
        await removeFile(oldPath);
      }
      // Clean up orphan reference files from the old category. References are
      // matched by filename prefix (aspid-mvvm-*.md style), mirroring how
      // fetchReferences writes them next to the rule file.
      const oldRefsDir = path.join(moduleTierDir(projectDir, CODE_MODULE_ID, oldCategory), REFERENCES_DIR_NAME);
      if (await fileExists(oldRefsDir)) {
        const refs = await listFiles(oldRefsDir);
        const prefix = existing.name.toLowerCase();
        for (const ref of refs) {
          const refLower = ref.toLowerCase();
          if (refLower.startsWith(`${prefix}-`) || refLower === `${prefix}.md`) {
            await removeFile(path.join(oldRefsDir, ref));
          }
        }
      }
    }

    // Update-in-place path — reuse the existing state entry when the rule
    // stayed in the same category AND the stored name already matches the
    // canonical id. The no-args bootstrap relies on this branch for its
    // drift-recovery flow (rule in state but stale hash on disk).
    const sameCategory = oldCategory === category;
    const sameName = existing.name === found.id;
    if (sameCategory && sameName) {
      existing.source = 'registry';
      existing.version = found.version;
      existing.installed_hash = newHash;
      existing.origin = origin;
    } else {
      // Legacy-name migration OR cross-category move. Splice the old entry
      // out and push a fresh canonical entry under the correct tier list.
      const oldList = existingCore ? coreState : stackState;
      const idx = oldList.indexOf(existing);
      if (idx >= 0) oldList.splice(idx, 1);
      const targetList = category === 'core' ? coreState : stackState;
      targetList.push({
        name: found.id,
        source: 'registry',
        origin,
        version: found.version,
        installed_hash: newHash,
      });
    }
  } else {
    const targetList = category === 'core' ? coreState : stackState;
    targetList.push({
      name: found.id,
      source: 'registry',
      origin,
      version: found.version,
      installed_hash: newHash,
    });
  }

  return { status: 'installed', category, id: found.id, version: found.version };
}

export async function rulesInstallCommand(ids: string[], options: { force?: boolean } = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = config.engine;

  // Refuse on a stale (un-migrated) project BEFORE touching the registry, so a
  // stale project fails fast with exit 8 instead of an unreachable-registry
  // exit 2. `update` is the sole migrator.
  await assertProjectMigrated(projectDir, config);

  // Fetch manifest exactly once per invocation — the single biggest reason
  // the legacy per-id `rulesInstallCommand` was painful to call from
  // `/unikit` Step 9.2 is that it hit the registry chain N times for N
  // always-tagged rules. The aggregated report below closes that loop.
  const registry = buildRegistry(config);
  const manifest = await registry.fetchManifest();

  if (!manifest) {
    console.error(chalk.red('Registry chain unreachable.'));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  // Explicit engine-existence predicate. The accessors below collapse "engine
  // missing" and "tier empty" to `[]`, so the exit-5 contract is re-established
  // here before reading rules.
  if (!manifestEngineIds(manifest).includes(engineId)) {
    console.error(chalk.red(`Engine "${engineId}" not found in registry.`));
    const available = manifestEngineIds(manifest).join(', ');
    console.error(chalk.dim(`Available: ${available}`));
    exitWithCode(EXIT.VALIDATION_FAILED);
  }

  const engineRules = { core: registry.getEngineRules('core'), stack: registry.getEngineRules('stack') };

  // Resolve origin once — every rule installed in one invocation comes from
  // the same resolved registry tier (the `code` module's winning source).
  const origin: 'primary' | 'official' | 'bundled' | undefined =
    registry.getResolvedOrigin(CODE_MODULE_ID) ?? undefined;

  const noArgsBootstrap = ids.length === 0;

  // Design note — case-sensitive FS + core bootstrap.
  //
  // The legacy `core-install` command keyed its in-memory state map by the
  // raw `entry.name` from `.unikit.json` (NOT canonical) on purpose: users
  // migrating from a legacy UPPER_CASE entry will see a duplicate in
  // `.unikit.json.rules.installed.modules.code.core` after the bootstrap
  // (legacy `CODE-STYLE` + new `code-style`). The escape hatch for core is
  // MANUAL cleanup only — edit `.unikit.json` and remove the legacy entry,
  // then delete the corresponding `.unikit/memory/code/core/CODE-STYLE.md`
  // file. `rules sync --replace --prune` does NOT help for core rules: the
  // obsolete-remove block in `syncRulesState` is scoped to the stack tier,
  // so a legacy `CODE-STYLE.md` core file is re-registered as `source: local`
  // on the next Phase 1 pass and the duplicate persists. The variadic
  // `installOneRule` preserves the same semantics.
  //
  // Core-gate (always-tagged): the no-args bootstrap installs every rule the
  // registry marks `always === true` for this engine, across both tiers. The
  // flag is injected by the schema:1→2 registry normalization
  // (`always = tier === 'core'`) and emitted directly by schema:2 sources, so
  // on the official registry this set equals the former core whitelist while
  // custom registries can opt stack rules into the bootstrap. The legacy
  // `CORE_RULE_WHITELIST` and the interim `tier === 'core'` gate are both gone.
  const resolvedIds: string[] = noArgsBootstrap
    ? [...engineRules.core, ...engineRules.stack].filter(r => r.always === true).map(r => r.id)
    : ids;

  if (noArgsBootstrap && resolvedIds.length === 0) {
    console.error(chalk.red(`No always-tagged (core) rules found in registry for engine "${engineId}".`));
    exitWithCode(EXIT.VALIDATION_FAILED);
  }

  const report: InstallReportLine[] = [];
  for (const id of resolvedIds) {
    const line = await installOneRule(
      projectDir,
      config,
      registry,
      engineRules,
      engineId,
      origin,
      id,
      {
        force: options.force === true,
        // No-args bootstrap is idempotent by design (hash-match skip, drift
        // recovery). Explicit variadic calls without `--force` absorb
        // "already installed" into the report instead of emitting EXIT 4.
        allowAlreadyInstalled: noArgsBootstrap,
        preferredCategory: noArgsBootstrap ? 'core' : undefined,
      },
    );
    report.push(line);
  }

  const anyStateChange = report.some(l => l.status === 'installed');
  if (anyStateChange) {
    await saveConfig(projectDir, config);
  }

  // Regenerate RULES_INDEX.md on every invocation — matches the old
  // `core-install` contract (Phase 3 of sync) so /unikit Step 9.2 always sees
  // a fresh index after the bootstrap, even when every always-tagged rule was
  // already on disk.
  const requiredBy = await loadRequiredByMap();
  const codeModule = MODULE_REGISTRY[CODE_MODULE_ID];
  const installedByTier: InstalledByTier = {};
  for (const tier of codeModule.tiers) {
    installedByTier[tier] = getModuleTier(config, CODE_MODULE_ID, tier).map(e => e.name);
  }
  await generateRulesIndex(projectDir, codeModule, installedByTier, requiredBy);

  printInstallReport(report);
  console.log(chalk.dim('✓ RULES_INDEX.md regenerated'));

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

export async function rulesStatusCommand(options: { json?: boolean; checkUpdates?: boolean }): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);

  const allRules = [
    ...getModuleTier(config, CODE_MODULE_ID, 'core').map(e => ({ ...e, category: 'core' as const })),
    ...getModuleTier(config, CODE_MODULE_ID, 'stack').map(e => ({ ...e, category: 'stack' as const })),
  ];

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

  const coreRules = getModuleTier(config, CODE_MODULE_ID, 'core');
  const stackRules = getModuleTier(config, CODE_MODULE_ID, 'stack');

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

  printStatusTable('Core:', allRules.filter(r => r.category === 'core'));
  printStatusTable('Stack:', allRules.filter(r => r.category === 'stack'));

  console.log(chalk.dim(`\nTotal: ${allRules.length} rules (${coreRules.length} core, ${stackRules.length} stack)`));
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
    console.log(chalk.green(`✓ Registry migrated to schema:${LATEST_SCHEMA} (${targetDir})`));
    console.log(chalk.dim(`  Applied:   ${result.applied.join(', ')}`));
    console.log(chalk.dim(`  Refreshed: ${BUILD_MANIFEST_SCRIPT_REL}`));
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
