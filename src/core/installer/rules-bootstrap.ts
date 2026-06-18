// Rule install primitives + module-aware bootstrap.
//
// Factored out of `cli/commands/rules.ts` so both the CLI (`rules install`)
// and the `update` command (newly installed module skills -> their rules) share
// one install primitive and one bootstrap loop.
//
// Boundary: everything here is EXIT-FREE. `installOneRule` returns a report
// line and `bootstrapModuleRules` returns `{ report, stateChanged }` — neither
// calls `process.exit`, prints a report, regenerates RULES_INDEX, or saves
// config. The caller owns the exit-code gates, presentation, index regen, and
// `saveConfig`. This keeps the `update` linkage from aborting the whole update
// (via `process.exit`) when a flaky registry breaks a bootstrap step.

import path from 'path';
import { createHash } from 'crypto';
import { getModuleTier } from '../config.js';
import type { UniKitConfig, InstalledRuleEntry } from '../config.js';
import type { RulesRegistry, RuleCategory } from '../registry/index.js';
import { normalizeRuleId } from './rules-index.js';
import type { CatalogRule, ModuleCatalog } from './module-catalog.js';
import { REFERENCES_DIR_NAME, moduleTierDir, type Tier } from '../constants.js';
import type { Module } from '../modules.js';
import { writeTextFile, fileExists, listFiles, removeFile } from '../../utils/fs.js';
import { logInfo } from '../../utils/log.js';

export type InstallReportStatus = 'installed' | 'already-installed' | 'failed';

export interface InstallReportLine {
  status: InstallReportStatus;
  module: string;
  category: RuleCategory | 'unknown';
  id: string;
  version?: string;
  reason?: string;
}

function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Install a single rule as part of a variadic batch. Mutates `config` in place
 * and returns a report line — never exits the process. Caller decides the final
 * exit code from the aggregated report.
 *
 * Module-generic: state lookups, catalog search, destination paths, and
 * re-categorisation walk `module.tiers` instead of a hardcoded core/stack
 * pair. Preserves the single-id behaviour from the old code-pinned handler:
 *   - canonical id normalisation on lookup (so legacy `CODE-STYLE` state still
 *     resolves when the user passes `code-style` and vice versa),
 *   - re-categorisation cleanup (rule moved between tiers),
 *   - orphan reference cleanup when re-categorising.
 */
export async function installOneRule(
  projectDir: string,
  config: UniKitConfig,
  registry: RulesRegistry,
  module: Module,
  catalogRules: CatalogRule[],
  engineId: string,
  rawId: string,
  options: { force?: boolean; allowAlreadyInstalled?: boolean; preferredTier?: Tier },
): Promise<InstallReportLine> {
  // Canonical lowercase-hyphen comparison lets legacy state entries like
  // `CODE-STYLE` still resolve when the user (or a script) passes the canonical
  // `code-style`, and vice versa. This is the guard that kept pre-migration
  // projects usable and must not be lost in the variadic rewrite.
  const normalizedId = normalizeRuleId(rawId);
  const tierStates = module.tiers.map(tier => ({
    tier,
    list: getModuleTier(config, module.id, tier),
  }));
  const existingHit = tierStates
    .map(({ tier, list }) => ({ tier, entry: list.find(e => normalizeRuleId(e.name) === normalizedId) }))
    .find(h => h.entry !== undefined) as { tier: Tier; entry: InstalledRuleEntry } | undefined;
  const existing = existingHit?.entry;

  // Find rule by id in the module catalog (canonical lowercase-hyphen
  // comparison). When the caller hints a preferred tier (bootstrap knows the
  // exact tier from the catalog), try that tier first so a rule shipped in two
  // tiers of the manifest goes where the bootstrap wants it.
  const ordered = options.preferredTier
    ? [
      ...catalogRules.filter(r => r.tier === options.preferredTier),
      ...catalogRules.filter(r => r.tier !== options.preferredTier),
    ]
    : catalogRules;
  const foundHit = ordered.find(r => normalizeRuleId(r.rule.id) === normalizedId);

  if (!foundHit) {
    const scope = module.enginePartitioned ? `engine "${engineId}"` : `module "${module.id}"`;
    return {
      status: 'failed',
      module: module.id,
      category: 'unknown',
      id: rawId,
      reason: `not found in registry for ${scope}`,
    };
  }

  const category = foundHit.tier;
  const found = foundHit.rule;
  // Per-rule B-merge origin from the catalog ROW (not a module-wide value):
  // for gamedesign each id may resolve from a different chain level (custom
  // override vs official/bundled backfill); for code it is the module-wide
  // origin on every row. Stamped onto every state entry written below.
  const origin = foundHit.origin;

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
    return { status: 'already-installed', module: module.id, category, id: found.id };
  }

  // Fetch rule content.
  const fetched = await registry.fetchRule(module.id, engineId, category, found.id);
  if (!fetched) {
    return {
      status: 'failed',
      module: module.id,
      category,
      id: found.id,
      reason: 'failed to fetch rule content',
    };
  }

  const newHash = computeHash(fetched.content);
  const destPath = path.join(moduleTierDir(projectDir, module.id, category), `${found.id}.md`);
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
    return { status: 'already-installed', module: module.id, category, id: found.id };
  }

  await writeTextFile(destPath, fetched.content);

  // Install references if any. Reference files live alongside the rule under
  // `.unikit/memory/<module>/<tier>/references/` and are matched by filename
  // prefix on cleanup (see re-categorisation block below).
  if (found.references && found.references.length > 0) {
    const refs = await registry.fetchReferences(module.id, engineId, category, found.id, found.references);
    const destRefsDir = path.join(moduleTierDir(projectDir, module.id, category), REFERENCES_DIR_NAME);
    for (const ref of refs) {
      await writeTextFile(path.join(destRefsDir, ref.filename), ref.content);
    }
  }

  const listOf = (tier: Tier): InstalledRuleEntry[] => {
    const state = tierStates.find(s => s.tier === tier);
    return state ? state.list : getModuleTier(config, module.id, tier);
  };

  if (existing && existingHit) {
    // Design note — re-categorisation cleanup (rule moved between tiers in
    // the registry) + legacy name migration escape hatch for core rules.
    //
    // Without cleanup the old file would survive on disk, and the next
    // `rules sync` Phase 1 would register it as a `source: local` entry in
    // the stale tier — producing a phantom duplicate of the rule.
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
    const oldCategory = existingHit.tier;
    if (oldCategory !== category) {
      logInfo('rules:install', `re-categorized ${existing.name}: ${oldCategory} → ${category}`);
      const oldPath = path.join(moduleTierDir(projectDir, module.id, oldCategory), `${existing.name}.md`);
      if (await fileExists(oldPath)) {
        await removeFile(oldPath);
      }
      // Clean up orphan reference files from the old tier. References are
      // matched by filename prefix (aspid-mvvm-*.md style), mirroring how
      // fetchReferences writes them next to the rule file.
      const oldRefsDir = path.join(moduleTierDir(projectDir, module.id, oldCategory), REFERENCES_DIR_NAME);
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
    // stayed in the same tier AND the stored name already matches the
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
      // Legacy-name migration OR cross-tier move. Splice the old entry
      // out and push a fresh canonical entry under the correct tier list.
      const oldList = listOf(oldCategory);
      const idx = oldList.indexOf(existing);
      if (idx >= 0) oldList.splice(idx, 1);
      listOf(category).push({
        name: found.id,
        source: 'registry',
        origin,
        version: found.version,
        installed_hash: newHash,
      });
    }
  } else {
    listOf(category).push({
      name: found.id,
      source: 'registry',
      origin,
      version: found.version,
      installed_hash: newHash,
    });
  }

  return { status: 'installed', module: module.id, category, id: found.id, version: found.version };
}

interface WorkItem { module: Module; id: string; preferredTier: Tier }

/**
 * Bootstrap rules for a set of PRE-RESOLVED module catalogs by each module's
 * bootstrap policy (`always-core` → registry `always`-tagged rules;
 * `all-rules` → the entire catalog). Returns the aggregated report plus whether
 * any state changed — EXIT-FREE.
 *
 * The caller resolves the catalogs (so the pre-install reachability/engine
 * hard-exit gates can run BEFORE this loop installs anything) and owns the
 * empty/all-failed gates from the returned report, plus `saveConfig`,
 * RULES_INDEX regeneration, and the printed report. Here, unreachable /
 * engine-missing / absent (empty) catalogs are skipped softly (verbose log) so
 * a flaky registry during the `update` linkage degrades to a no-op instead of
 * aborting the whole update via `process.exit`.
 */
export async function bootstrapModuleRules(
  projectDir: string,
  config: UniKitConfig,
  registry: RulesRegistry,
  engineId: string,
  catalogs: ModuleCatalog[],
  opts: { force?: boolean } = {},
): Promise<{ report: InstallReportLine[]; stateChanged: boolean }> {
  const work: WorkItem[] = [];
  for (const catalog of catalogs) {
    if (!catalog.reachable) {
      logInfo('rules:bootstrap', `skipping ${catalog.module.id}: registry chain unreachable`);
      continue;
    }
    if (!catalog.engineAvailable) {
      logInfo('rules:bootstrap', `skipping ${catalog.module.id}: engine "${engineId}" unavailable`);
      continue;
    }
    const selected = catalog.module.bootstrap === 'all-rules'
      ? catalog.rules
      : catalog.rules.filter(r => r.rule.always === true);
    for (const r of selected) {
      work.push({ module: catalog.module, id: r.rule.id, preferredTier: r.tier });
    }
  }

  const report: InstallReportLine[] = [];
  for (const item of work) {
    const catalog = catalogs.find(c => c.module.id === item.module.id);
    const line = await installOneRule(
      projectDir,
      config,
      registry,
      item.module,
      catalog?.rules ?? [],
      engineId,
      item.id,
      {
        // Bootstrap is idempotent by design: hash-match skip + drift recovery.
        force: opts.force === true,
        allowAlreadyInstalled: true,
        preferredTier: item.preferredTier,
      },
    );
    report.push(line);
  }

  return { report, stateChanged: report.some(l => l.status === 'installed') };
}
