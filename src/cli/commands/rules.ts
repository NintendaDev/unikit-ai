// --- CLI: unikit rules <subcommand> ---
// 6 subcommands: list, show, install, sync, status, registry
// `registry` is a command group with nested subcommands: show, set, reset, init

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { spawnSync } from 'child_process';
import { loadConfig, saveConfig } from '../../core/config.js';
import type { UniKitConfig } from '../../core/config.js';
import { createRegistry, detectRegistryKind, resolveRegistryUrl, OFFICIAL_REGISTRY_URL } from '../../core/registry/index.js';
import type { RulesRegistry, RegistryRule, RuleCategory, RegistryKind } from '../../core/registry/index.js';
import { validateRegistry, validateUrlFormat, normalizeRegistryUrl } from '../../core/registry/validator.js';
import { getAllEngineIds } from '../../core/engines.js';
import {
  generateRulesIndex, loadRequiredByMap, CORE_RULE_WHITELIST, syncRulesState,
  parseRuleMetadataFromContent, normalizeRuleId,
  type SyncRulesEvent,
} from '../../core/installer.js';
import { writeTextFile, fileExists, listFiles, removeFile, getBundledRegistryDir } from '../../utils/fs.js';
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

function buildRegistry(config: UniKitConfig): RulesRegistry {
  return createRegistry(config.rulesRegistry, config.engine);
}

// =====================================================================
// list — lean catalog from registry
// =====================================================================

export async function rulesListCommand(options: { json?: boolean; engine?: string }): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = options.engine ?? config.engine;

  const registry = buildRegistry(config);
  const manifest = await registry.fetchManifest();

  if (!manifest) {
    console.warn(chalk.yellow('WARN: Registry unreachable. No catalog available.'));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  const engineRules = manifest.engines[engineId];
  if (!engineRules) {
    console.error(chalk.red(`Engine "${engineId}" not found in registry.`));
    const available = Object.keys(manifest.engines).join(', ');
    console.error(chalk.dim(`Available: ${available}`));
    exitWithCode(EXIT.NOT_FOUND);
  }

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

  const engineRules = manifest.engines[engineId];
  if (!engineRules) {
    console.error(chalk.red(`Engine "${engineId}" not found in registry.`));
    exitWithCode(EXIT.NOT_FOUND);
  }

  // Find rule by id via canonical lowercase-hyphen normalization.
  const normalizedId = normalizeRuleId(id);
  const found = [...engineRules.core, ...engineRules.stack].find(r => normalizeRuleId(r.id) === normalizedId);

  if (!found) {
    console.error(chalk.red(`Rule "${id}" not found in registry for engine "${engineId}".`));
    exitWithCode(EXIT.NOT_FOUND);
  }

  const category: RuleCategory = engineRules.core.some(r => r.id === found.id) ? 'core' : 'stack';
  const fetched = await registry.fetchRule(engineId, category, found.id);

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
    const refs = await registry.fetchReferences(engineId, category, found.id, found.references);
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
// `unikit-ai rules install`              — no args: install the CORE_RULE_WHITELIST
//                                          batch (core bootstrap, replaces the
//                                          old `rules core-install` used by
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
//   5  engine missing from manifest OR no-args call with empty whitelist
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
  const existingCore = config.rules.installed.core.find(e => normalizeRuleId(e.name) === normalizedId);
  const existingStack = config.rules.installed.stack.find(e => normalizeRuleId(e.name) === normalizedId);
  const existing = existingCore ?? existingStack;

  // Find rule by id in registry (canonical lowercase-hyphen comparison). When
  // the caller hints a preferred category (core whitelist bootstrap), try that
  // side first so a rule shipped in both sides of the manifest goes where the
  // bootstrap wants it.
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
  const fetched = await registry.fetchRule(engineId, category, found.id);
  if (!fetched) {
    return {
      status: 'failed',
      category,
      id: found.id,
      reason: 'failed to fetch rule content',
    };
  }

  const newHash = computeHash(fetched.content);
  const targetMemoryDir = path.join(projectDir, '.unikit', 'memory');
  const destPath = path.join(targetMemoryDir, category, `${found.id}.md`);
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
    const refs = await registry.fetchReferences(engineId, category, found.id, found.references);
    const destRefsDir = path.join(targetMemoryDir, category, 'references');
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
      const oldPath = path.join(targetMemoryDir, oldCategory, `${existing.name}.md`);
      if (await fileExists(oldPath)) {
        await removeFile(oldPath);
      }
      // Clean up orphan reference files from the old category. References are
      // matched by filename prefix (aspid-mvvm-*.md style), mirroring how
      // fetchReferences writes them next to the rule file.
      const oldRefsDir = path.join(targetMemoryDir, oldCategory, 'references');
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
      // out and push a fresh canonical entry under the correct category list.
      const oldList = existingCore
        ? config.rules.installed.core
        : config.rules.installed.stack;
      const idx = oldList.indexOf(existing);
      if (idx >= 0) oldList.splice(idx, 1);
      const targetList = category === 'core' ? config.rules.installed.core : config.rules.installed.stack;
      targetList.push({
        name: found.id,
        source: 'registry',
        origin,
        version: found.version,
        installed_hash: newHash,
      });
    }
  } else {
    const targetList = category === 'core' ? config.rules.installed.core : config.rules.installed.stack;
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

  // Fetch manifest exactly once per invocation — the single biggest reason
  // the legacy per-id `rulesInstallCommand` was painful to call from
  // `/unikit` Step 9.2 is that it hit the registry chain N times for N
  // whitelisted rules. The aggregated report below closes that loop.
  const registry = buildRegistry(config);
  const manifest = await registry.fetchManifest();

  if (!manifest) {
    console.error(chalk.red('Registry chain unreachable (primary → official → bundled all failed).'));
    exitWithCode(EXIT.NETWORK_ERROR);
  }

  const engineRules = manifest.engines[engineId];
  if (!engineRules) {
    console.error(chalk.red(`Engine "${engineId}" not found in registry.`));
    const available = Object.keys(manifest.engines).join(', ');
    console.error(chalk.dim(`Available: ${available}`));
    exitWithCode(EXIT.VALIDATION_FAILED);
  }

  // Resolve origin once — every rule installed in one invocation comes from
  // the same resolved registry tier.
  let origin: 'primary' | 'official' | 'bundled' | undefined;
  if ('getResolvedOrigin' in registry) {
    origin = (registry as { getResolvedOrigin(): 'primary' | 'official' | 'bundled' | null }).getResolvedOrigin() ?? undefined;
  }

  const noArgsBootstrap = ids.length === 0;

  // Design note — case-sensitive FS + whitelist bootstrap.
  //
  // The legacy `core-install` command keyed its in-memory state map by the
  // raw `entry.name` from `.unikit.json` (NOT canonical) on purpose: users
  // migrating from a legacy UPPER_CASE entry will see a duplicate in
  // `.unikit.json.rules.installed.core` after the bootstrap
  // (legacy `CODE-STYLE` + new `code-style`). The escape hatch for core is
  // MANUAL cleanup only — edit `.unikit.json` and remove the legacy entry,
  // then delete the corresponding `.unikit/memory/core/CODE-STYLE.md` file.
  // `rules sync --replace --prune` does NOT help for core rules: the
  // obsolete-remove block in `syncRulesState` is scoped to
  // `category === 'stack'`, so a legacy `CODE-STYLE.md` core file is
  // re-registered as `source: local` on the next Phase 1 pass and the
  // duplicate persists. The new variadic `installOneRule` preserves the
  // same semantics.
  const resolvedIds: string[] = noArgsBootstrap
    ? engineRules.core
      .filter(r => CORE_RULE_WHITELIST.has(normalizeRuleId(r.id)))
      .map(r => r.id)
    : ids;

  if (noArgsBootstrap && resolvedIds.length === 0) {
    console.error(chalk.red(`No whitelisted core rules found in registry for engine "${engineId}".`));
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
  // a fresh index after the bootstrap, even when every whitelisted rule was
  // already on disk.
  const requiredBy = await loadRequiredByMap();
  const coreNames = config.rules.installed.core.map(e => e.name);
  const stackNames = config.rules.installed.stack.map(e => e.name);
  await generateRulesIndex(projectDir, coreNames, stackNames, requiredBy);

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
        console.log(chalk.yellow(`Found untracked rule: ${ev.category}/${ev.name} — registering as local`));
        break;
      case 'phase1:missing-removed':
        console.log(chalk.yellow(`Rule ${ev.category}/${ev.name} missing from disk — removing from state`));
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
        console.log(chalk.cyan(`${verb} ${ev.category}/${ev.name}: ${from} → v${ev.toVersion}`));
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
   * Scoped to stack (core rules are whitelist-governed). Composable with
   * `--replace`: `sync --replace --prune` is the old `sync --force`.
   */
  prune?: boolean;
}

export async function rulesSyncCommand(options: RulesSyncOptions = {}): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfigOrExit(projectDir);
  const engineId = config.engine;

  const registry = buildRegistry(config);
  const result = await syncRulesState(projectDir, engineId, config, registry, {
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
    ...config.rules.installed.core.map(e => ({ ...e, category: 'core' as const })),
    ...config.rules.installed.stack.map(e => ({ ...e, category: 'stack' as const })),
  ];

  // Resolve null/empty `rulesRegistry` to the official URL — the runtime
  // does this anyway in `createRegistry()`, and exposing the resolved value
  // here keeps `rules status` and `rules registry` honest about which source
  // the CLI will hit.
  const effectiveRegistry = resolveRegistryUrl(config.rulesRegistry);
  const registryConfigured = config.rulesRegistry !== null && config.rulesRegistry.trim().length > 0;

  if (options.json) {
    const output = {
      engine: config.engine,
      registry: effectiveRegistry,
      registryKind: detectRegistryKind(effectiveRegistry),
      registryConfigured,
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

  if (registryConfigured) {
    console.log(chalk.dim(`Registry: ${effectiveRegistry}`));
  } else {
    console.log(chalk.dim(`Registry: ${effectiveRegistry} ${chalk.gray('(default — official)')}`));
  }
  console.log('');

  const coreRules = config.rules.installed.core;
  const stackRules = config.rules.installed.stack;

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

const REGISTRY_TEMPLATE_FILES = [
  'package.json',
  'RULE_TEMPLATE.md',
  path.join('scripts', 'build-manifest.js'),
];

async function classifyRegistryInitTarget(targetDir: string): Promise<'ok' | 'already-registry' | 'occupied'> {
  const exists = await fs.pathExists(targetDir);
  if (!exists) return 'ok';

  const stat = await fs.stat(targetDir);
  if (!stat.isDirectory()) return 'occupied';

  const entries = await fs.readdir(targetDir);
  if (entries.length === 0) return 'ok';

  if (entries.includes('manifest.json')) return 'already-registry';

  // If any known engine dir is present, treat as initialized.
  const engineIds = getAllEngineIds();
  for (const engineId of engineIds) {
    if (entries.includes(engineId)) {
      const engineDir = path.join(targetDir, engineId);
      const s = await fs.stat(engineDir);
      if (s.isDirectory()) return 'already-registry';
    }
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
  for (const engineId of engineIds) {
    await fs.ensureDir(path.join(targetDir, engineId, 'core'));
    await fs.ensureDir(path.join(targetDir, engineId, 'stack'));
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

  // Run build-manifest.js via absolute Node binary — works even when `node`
  // is absent from the user's PATH (npx-launched sessions, etc.).
  const buildScript = path.join(targetDir, 'scripts', 'build-manifest.js');
  const result = spawnSync(process.execPath, [buildScript], {
    cwd: targetDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    logError(REGISTRY_INIT_TAG, `build-manifest.js failed with exit code ${result.status}`);
    exitWithCode(EXIT.VALIDATION_FAILED);
  }

  logInfo(
    REGISTRY_INIT_TAG,
    `initialized at ${targetDir} (engines: ${engineIds.join(', ')})`,
  );
  console.log(chalk.green(`✓ Registry scaffold created at ${targetDir}`));
  console.log(chalk.dim(`  Engines: ${engineIds.join(', ')}`));
  console.log(chalk.dim(`  Files:   package.json, RULE_TEMPLATE.md, scripts/build-manifest.js, manifest.json`));
}
