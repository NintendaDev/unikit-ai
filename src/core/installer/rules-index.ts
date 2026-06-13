// Rule metadata loaders + RULES_INDEX.md generation.
//
// Owns the rule-id normalization rules, the requiredBy manifest loader, the
// Scope / Load when parser, and the module-generic RULES_INDEX.md generator
// that the /unikit skill reads to decide what to load per task.

import path from 'path';
import {
  getDataDir, listFiles, readTextFile, writeTextFile, removeFile, fileExists,
} from '../../utils/fs.js';
import { logInfo } from '../../utils/log.js';
import {
  RULES_MANIFEST_FILE, RULES_INDEX_FILE,
  TIER_TABLE_MARKERS, moduleDir, moduleTierDir, type Tier,
} from '../constants.js';
import type { Module } from '../modules.js';
import type { RuleOrigin } from '../config.js';
import { isMarkdownFile, stripMdExtension } from './shared.js';

// --- Rules: data loaders and shared state ---

export type RequiredByMap = Record<string, string | string[]>;

export async function loadRequiredByMap(): Promise<RequiredByMap> {
  const manifestPath = path.join(getDataDir(), RULES_MANIFEST_FILE);
  const { readJsonFile: readJson } = await import('../../utils/fs.js');
  const full = await readJson<Record<string, unknown>>(manifestPath);
  if (!full || typeof full.requiredBy !== 'object' || full.requiredBy === null) return {};
  return full.requiredBy as RequiredByMap;
}

/**
 * Canonical form of a rule id is lowercase-hyphen.
 *
 * All comparison points (user input, registry ids, `.unikit.json` entries,
 * whitelist lookups, requiredBy map keys) MUST go through this helper —
 * NEVER compare raw ids with `toUpperCase()` / `toLowerCase()` inline.
 *
 * On-disk writes and `entry.name` values are stored as-is (the registry id),
 * so legacy projects with `CODE-STYLE` in state keep working until the user
 * manually migrates. Normalization is a comparison concern, not a storage one.
 */
export function normalizeRuleId(raw: string): string {
  return raw.trim().toLowerCase();
}

// installRules() and loadRulesManifest() were removed — rules are now installed via
// `unikit-ai rules install` (no-args core whitelist bootstrap + variadic, see
// rulesInstallCommand) and `/unikit-memory` (stack). The /unikit skill Step 9
// orchestrates the full flow. RULES_INDEX.md metadata is derived by parsing each
// installed rule file on disk — the .md file is the single source of truth for
// both description (Scope) and Load when.

// --- RULES_INDEX.md generation ---

/**
 * Parse Scope / Load when / heading fallback from a rule .md content string.
 * Exported so call sites that already have the content in memory (e.g.
 * `rules show` with freshly fetched registry content) can reuse the same
 * extraction logic without a second disk read.
 */
export function parseRuleMetadataFromContent(content: string): { description: string; loadWhen: string } {
  let description = '';
  let loadWhen = '';

  for (const line of content.split('\n')) {
    const scopeMatch = line.match(/^>\s*\*\*Scope\*\*:\s*(.+)/);
    if (scopeMatch) {
      description = scopeMatch[1].trim();
      continue;
    }

    const loadWhenMatch = line.match(/^>\s*\*\*Load when\*\*:\s*(.+)/);
    if (loadWhenMatch) {
      loadWhen = loadWhenMatch[1].trim();
      continue;
    }

    if (description && loadWhen) break;
  }

  // Fallback: first heading as description
  if (!description) {
    const headingMatch = content.match(/^#\s+(.+)/m);
    if (headingMatch) {
      description = headingMatch[1].trim();
    }
  }

  return { description, loadWhen };
}

async function parseRuleFileMetadata(filePath: string): Promise<{ description: string; loadWhen: string }> {
  const content = await readTextFile(filePath);
  if (!content) return { description: '', loadWhen: '' };
  return parseRuleMetadataFromContent(content);
}

/**
 * Result of {@link generateRulesIndex}:
 *
 * - `'written'`     — the index was rebuilt with at least one row on disk
 * - `'skipped-empty'` — no rows to emit AND no `RULES_INDEX.md` existed; file
 *                     intentionally NOT created (avoids empty stub files in
 *                     projects that never installed any rules)
 * - `'removed-empty'` — no rows to emit but a stale `RULES_INDEX.md` was
 *                     present and has been deleted (keeps `.unikit/memory/`
 *                     consistent when a project drops all its rules)
 */
export type GenerateRulesIndexStatus = 'written' | 'skipped-empty' | 'removed-empty';

/** Installed rule names to render, keyed by tier. Empty/absent tier = render all on disk. */
export type InstalledByTier = Partial<Record<Tier, string[]>>;

/** Installed per-rule origin, keyed by rule name (no `.md`). Drives the GD core Origin column. */
export type OriginByRule = Record<string, RuleOrigin>;

/**
 * Render one core-tier rule row. The column scheme is module-specific and MUST
 * match the module's RULES_INDEX template:
 *
 *  - `per-id-merge` modules (gamedesign): `| file | description | Origin | Load when |`.
 *    Core is canonical Load-when knowledge resolved per-id (custom override vs
 *    official/bundled backfill); the Origin column surfaces that provenance and
 *    there is NO Required-By (these rules are not mandatory-gated).
 *  - `module-winner` modules (code): `| file | description | Required By | Load when |`.
 *    Core rules are mandatory-gated, so Required By is the meaningful column.
 *
 * Non-core tiers (stack/library) are load-on-demand and emit no extra column.
 */
function renderRuleRow(
  module: Module,
  tier: Tier,
  file: string,
  meta: { description: string; loadWhen: string },
  requiredBy: RequiredByMap,
  originByRule: OriginByRule,
): string {
  if (tier === 'core') {
    if (module.coreResolution === 'per-id-merge') {
      // origin from installed state; '—' when unknown (a disk-only rule with no
      // state entry, e.g. a hand-added file the user has not installed yet).
      const origin = originByRule[stripMdExtension(file)] ?? '—';
      return `| ${file} | ${meta.description} | ${origin} | ${meta.loadWhen} |`;
    }
    // requiredBy keys are canonical lowercase-hyphen ids (no .md); normalize the
    // on-disk filename so legacy `CODE-STYLE.md` files still resolve correctly.
    const rb = requiredBy[normalizeRuleId(stripMdExtension(file))] ?? 'all';
    const rbStr = Array.isArray(rb) ? rb.join(', ') : rb;
    return `| ${file} | ${meta.description} | ${rbStr} | ${meta.loadWhen} |`;
  }
  return `| ${file} | ${meta.description} | ${meta.loadWhen} |`;
}

/**
 * Generate `<module>/RULES_INDEX.md` for one module by iterating its tiers and
 * filling the per-tier table markers in the module's template. The template is
 * selected per module via `module.rulesIndexTemplate` (data-dir-relative) —
 * `code` and `gamedesign` carry different tier tables and prose.
 *
 * Filter: if `installedByTier[tier]` is non-empty, emit only rules tracked in
 * that list. If it is empty/absent, emit every `.md` file found on disk for
 * that tier (matches legacy behavior for projects without populated state).
 */
export async function generateRulesIndex(
  projectDir: string,
  module: Module,
  installedByTier: InstalledByTier = {},
  requiredBy: RequiredByMap = {},
  originByRule: OriginByRule = {},
): Promise<GenerateRulesIndexStatus> {
  const templatePath = path.join(getDataDir(), module.rulesIndexTemplate);
  const template = await readTextFile(templatePath);
  if (!template) {
    throw new Error(`RULES_INDEX template not found: ${templatePath}`);
  }

  let result = template;
  let totalRows = 0;

  for (const tier of module.tiers) {
    const dir = moduleTierDir(projectDir, module.id, tier);
    const installedSet = new Set(installedByTier[tier] ?? []);
    const rows: string[] = [];

    for (const file of await listFiles(dir)) {
      if (!isMarkdownFile(file)) continue;
      const name = stripMdExtension(file);
      if (installedSet.size > 0 && !installedSet.has(name)) continue;
      const meta = await parseRuleFileMetadata(path.join(dir, file));
      rows.push(renderRuleRow(module, tier, file, meta, requiredBy, originByRule));
    }

    rows.sort((a, b) => a.localeCompare(b));
    totalRows += rows.length;
    result = result.replace(TIER_TABLE_MARKERS[tier], rows.join('\n'));
  }

  const indexPath = path.join(moduleDir(projectDir, module.id), RULES_INDEX_FILE);

  // Empty-rules guard.
  //
  // When none of the module's tiers have renderable rules (e.g. a fresh project
  // running `unikit-ai rules sync` before installing anything), writing a stub
  // `RULES_INDEX.md` with empty tier tables is pure noise — the file tells the
  // `/unikit` skill "there is an index", but that index points at nothing.
  //
  // Two branches:
  //   1. No existing file → skip creation entirely (`skipped-empty`).
  //   2. Stale existing file → delete it (`removed-empty`). Keeping a stale
  //      index after the user has dropped all rules would silently mislead
  //      the skill on the next run.
  //
  // Both branches are idempotent and safe to hit multiple times per session.
  if (totalRows === 0) {
    if (await fileExists(indexPath)) {
      logInfo('rules:index', '[FIX] no rules on disk/in state — removing stale RULES_INDEX.md');
      await removeFile(indexPath);
      return 'removed-empty';
    }
    logInfo('rules:index', '[FIX] no rules on disk/in state — skipping RULES_INDEX.md creation');
    return 'skipped-empty';
  }

  await writeTextFile(indexPath, result);
  return 'written';
}
