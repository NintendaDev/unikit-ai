// Rule metadata loaders + RULES_INDEX.md generation.
//
// Owns the rule-id normalization rules, the core whitelist, the requiredBy
// manifest loader, the Scope / Load when parser, and the RULES_INDEX.md
// generator that the /unikit skill reads to decide what to load per task.

import path from 'path';
import {
  getDataDir, listFiles, readTextFile, writeTextFile, removeFile, fileExists,
} from '../../utils/fs.js';
import { logInfo } from '../../utils/log.js';
import {
  RULES_MANIFEST_FILE, RULES_INDEX_FILE, RULES_INDEX_TEMPLATE_FILE,
  CORE_TABLE_MARKER, STACK_TABLE_MARKER, memoryDir,
} from '../constants.js';
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

/**
 * Known core rule ids — registry can override content but cannot introduce new core names.
 *
 * Stored in the canonical lowercase-hyphen form. Consumers MUST feed registry
 * ids through `normalizeRuleId()` before lookup so unofficial registries that
 * ship `CODE-STYLE` / `code_style` variants still resolve to the same entry.
 */
export const CORE_RULE_WHITELIST = new Set([
  'code-style', 'design-principles', 'folders-structure', 'performance', 'testing', 'pipeline',
]);

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

export async function generateRulesIndex(
  projectDir: string,
  installedCore: string[],
  installedStack: string[],
  requiredBy: RequiredByMap = {},
): Promise<GenerateRulesIndexStatus> {
  const templatePath = path.join(getDataDir(), RULES_INDEX_TEMPLATE_FILE);
  const template = await readTextFile(templatePath);
  if (!template) {
    throw new Error(`RULES_INDEX template not found: ${templatePath}`);
  }

  const targetMemoryDir = memoryDir(projectDir);
  const installedCoreSet = new Set(installedCore);
  const installedStackSet = new Set(installedStack);

  // Filter: if the caller passed an install list (set non-empty), emit only
  // rules tracked in that list. If the set is empty, we are in "no tracking"
  // mode — emit every .md file found on disk (matches legacy behavior for
  // projects without a populated .unikit.json rules state).

  const coreRows: string[] = [];
  const coreDir = path.join(targetMemoryDir, 'core');
  for (const file of await listFiles(coreDir)) {
    if (!isMarkdownFile(file)) continue;
    const name = stripMdExtension(file);
    if (installedCoreSet.size > 0 && !installedCoreSet.has(name)) continue;
    const meta = await parseRuleFileMetadata(path.join(coreDir, file));
    // requiredBy keys are canonical lowercase-hyphen ids (no .md); normalize the
    // on-disk filename so legacy `CODE-STYLE.md` files still resolve correctly.
    const rb = requiredBy[normalizeRuleId(name)] ?? 'all';
    const rbStr = Array.isArray(rb) ? rb.join(', ') : rb;
    coreRows.push(`| ${file} | ${meta.description} | ${rbStr} | ${meta.loadWhen} |`);
  }

  const stackRows: string[] = [];
  const stackDir = path.join(targetMemoryDir, 'stack');
  for (const file of await listFiles(stackDir)) {
    if (!isMarkdownFile(file)) continue;
    const name = stripMdExtension(file);
    if (installedStackSet.size > 0 && !installedStackSet.has(name)) continue;
    const meta = await parseRuleFileMetadata(path.join(stackDir, file));
    stackRows.push(`| ${file} | ${meta.description} | ${meta.loadWhen} |`);
  }

  // Sort all rows alphabetically by filename
  coreRows.sort((a, b) => a.localeCompare(b));
  stackRows.sort((a, b) => a.localeCompare(b));

  const indexPath = path.join(targetMemoryDir, RULES_INDEX_FILE);

  // Empty-rules guard.
  //
  // When neither `.unikit/memory/core/` nor `.unikit/memory/stack/` have
  // renderable rules (e.g. a fresh project running `unikit-ai rules sync`
  // before installing anything), writing a stub `RULES_INDEX.md` with empty
  // CORE_TABLE / STACK_TABLE sections is pure noise — the file tells the
  // `/unikit` skill "there is an index", but that index points at nothing.
  //
  // Two branches:
  //   1. No existing file → skip creation entirely (`skipped-empty`).
  //   2. Stale existing file → delete it (`removed-empty`). Keeping a stale
  //      index after the user has dropped all rules would silently mislead
  //      the skill on the next run.
  //
  // Both branches are idempotent and safe to hit multiple times per session.
  if (coreRows.length === 0 && stackRows.length === 0) {
    if (await fileExists(indexPath)) {
      logInfo('rules:index', '[FIX] no rules on disk/in state — removing stale RULES_INDEX.md');
      await removeFile(indexPath);
      return 'removed-empty';
    }
    logInfo('rules:index', '[FIX] no rules on disk/in state — skipping RULES_INDEX.md creation');
    return 'skipped-empty';
  }

  const result = template
    .replace(CORE_TABLE_MARKER, coreRows.join('\n'))
    .replace(STACK_TABLE_MARKER, stackRows.join('\n'));

  await writeTextFile(indexPath, result);
  return 'written';
}
