import path from 'path';
import semver from 'semver';
import {
  getSubagentsDir, getDataDir,
  ensureDir, listFiles,
  readTextFile, writeTextFile, removeDirectory, removeFile,
  fileExists, hashFile,
} from '../utils/fs.js';
import type { AgentInstallation, ManagedSkillState, RuleOrigin, UniKitConfig } from './config.js';
import type { RulesRegistry } from './registry/index.js';
import { getAgentConfig } from './agents.js';
import {
  computeContentHash, isMarkdownFile, stripMdExtension,
  buildSubagentTemplateVars, loadSourceForAgent, warnActionFailed,
} from './installer/shared.js';
import { computeSubagentSourceHash } from './installer/hashing.js';
import { installSkillWithTransformer } from './installer/skills.js';
import { processTemplate } from './template.js';
import { getTransformer } from './transformer.js';
import { logInfo } from '../utils/log.js';
import {
  DEFAULT_ENGINE_ID, RULE_CATEGORIES,
  REFERENCES_DIR_NAME, RULES_INDEX_FILE, RULES_INDEX_TEMPLATE_FILE,
  RULES_MANIFEST_FILE,
  CORE_TABLE_MARKER, STACK_TABLE_MARKER, memoryDir,
} from './constants.js';

// --- Types ---

export type SubagentUpdateStatus = 'changed' | 'unchanged' | 'skipped' | 'removed';

export interface SubagentUpdateEntry {
  subagent: string;
  status: SubagentUpdateStatus;
  reason: string;
}

export interface UpdateSubagentsResult {
  installedSubagents: string[];
  entries: SubagentUpdateEntry[];
}

export interface UpdateSubagentsOptions {
  force?: boolean;
  engineId?: string;
  engineMcpKey?: string | null;
}

// --- Agent installation ---

export async function installSubagents(
  projectDir: string,
  subagentsDir: string,
  options: { agentId: string; skipUnchanged?: boolean; engineId?: string; engineMcpKey?: string | null },
): Promise<string[]> {
  const packageSubagentsDir = getSubagentsDir();
  const targetDir = path.join(projectDir, subagentsDir);
  await ensureDir(targetDir);

  const { agentId } = options;
  const skipUnchanged = options.skipUnchanged ?? false;
  const installedSubagents: string[] = [];
  const files = await listFiles(packageSubagentsDir);

  for (const file of files) {
    if (!isMarkdownFile(file)) continue;

    try {
      const sourcePath = path.join(packageSubagentsDir, file);
      const targetPath = path.join(targetDir, file);

      if (skipUnchanged) {
        const sourceHash = await hashFile(sourcePath);
        const targetHash = await hashFile(targetPath);
        if (sourceHash && targetHash && sourceHash === targetHash) {
          installedSubagents.push(stripMdExtension(file));
          continue;
        }
      }

      const content = await loadSourceForAgent(sourcePath, agentId);
      if (content) {
        const subagentName = stripMdExtension(file);
        const vars = buildSubagentTemplateVars(subagentName, options?.engineId, options.engineMcpKey);
        const processed = processTemplate(content, vars);
        await writeTextFile(targetPath, processed);
        installedSubagents.push(subagentName);
      }
    } catch (error) {
      warnActionFailed('install subagent', file, error);
    }
  }

  return installedSubagents;
}

// --- Managed subagent state ---

export async function buildManagedSubagentsState(
  projectDir: string,
  agent: AgentInstallation,
  baseSubagents: string[],
  engineId: string,
): Promise<Record<string, ManagedSkillState>> {
  const state: Record<string, ManagedSkillState> = {};
  const packageSubagentsDir = getSubagentsDir();

  for (const subagentName of baseSubagents) {
    const sourcePath = path.join(packageSubagentsDir, subagentName + '.md');
    const sourceHash = await computeSubagentSourceHash(sourcePath, engineId, agent.id);
    if (!sourceHash) continue;

    const targetPath = path.join(projectDir, agent.subagentsDir, subagentName + '.md');
    const installedHash = await hashFile(targetPath);
    if (!installedHash) continue;

    state[subagentName] = { sourceHash, installedHash };
  }

  return state;
}

// --- Subagent update ---

export async function updateSubagents(
  agent: AgentInstallation,
  projectDir: string,
  options: UpdateSubagentsOptions = {},
): Promise<UpdateSubagentsResult> {
  const { force = false, engineId = DEFAULT_ENGINE_ID, engineMcpKey } = options;

  const packageSubagentsDir = getSubagentsDir();
  const availableFiles = await listFiles(packageSubagentsDir);
  const availableSubagents = availableFiles
    .filter(f => isMarkdownFile(f))
    .map(f => stripMdExtension(f));
  const availableSet = new Set(availableSubagents);

  const entries: SubagentUpdateEntry[] = [];
  const previousSubagents = agent.installedSubagents;
  const previousSet = new Set(previousSubagents);
  const previousManaged = agent.managedSubagents ?? {};

  // Detect removed subagents
  const removedSubagents = previousSubagents.filter(s => !availableSet.has(s));
  for (const sa of removedSubagents) {
    const targetPath = path.join(projectDir, agent.subagentsDir, sa + '.md');
    await removeFile(targetPath);
    entries.push({ subagent: sa, status: 'removed', reason: 'package-removed' });
  }

  // Detect new subagents (available in package but not previously installed)
  const newlyAvailable = availableSubagents.filter(s => !previousSet.has(s));
  for (const sa of newlyAvailable) {
    entries.push({ subagent: sa, status: 'skipped', reason: 'new-subagent-not-installed' });
  }

  // Updatable subagents
  const updatableSubagents = previousSubagents.filter(s => availableSet.has(s));
  const shouldInstall = new Map<string, { install: boolean; reason: string }>();

  for (const sa of updatableSubagents) {
    const sourcePath = path.join(packageSubagentsDir, sa + '.md');
    const sourceHash = await computeSubagentSourceHash(sourcePath, engineId, agent.id);
    const targetPath = path.join(projectDir, agent.subagentsDir, sa + '.md');
    const installedHash = await hashFile(targetPath);
    const previousState = previousManaged[sa];

    if (force) {
      shouldInstall.set(sa, { install: true, reason: 'force-clean-reinstall' });
      continue;
    }

    if (!sourceHash) {
      shouldInstall.set(sa, { install: true, reason: 'source-missing' });
      continue;
    }

    if (!previousState) {
      shouldInstall.set(sa, { install: true, reason: 'missing-managed-state' });
      continue;
    }

    if (!installedHash) {
      shouldInstall.set(sa, { install: true, reason: 'missing-installed-artifact' });
      continue;
    }

    if (previousState.sourceHash !== sourceHash) {
      shouldInstall.set(sa, { install: true, reason: 'source-hash-changed' });
      continue;
    }

    if (previousState.installedHash !== installedHash) {
      console.warn(`Warning: Local modifications detected in subagent "${sa}" - will be overwritten by update.`);
      shouldInstall.set(sa, { install: true, reason: 'installed-hash-drift' });
      continue;
    }

    shouldInstall.set(sa, { install: false, reason: 'up-to-date' });
  }

  // Install subagents that need updating
  const installedSet = new Set<string>();
  const targetDir = path.join(projectDir, agent.subagentsDir);
  await ensureDir(targetDir);

  for (const sa of updatableSubagents) {
    const decision = shouldInstall.get(sa);
    if (!decision?.install) continue;

    try {
      const sourcePath = path.join(packageSubagentsDir, sa + '.md');
      const targetPath = path.join(targetDir, sa + '.md');
      const content = await loadSourceForAgent(sourcePath, agent.id);

      if (content) {
        const vars = buildSubagentTemplateVars(sa, engineId, engineMcpKey);
        const processed = processTemplate(content, vars);
        await writeTextFile(targetPath, processed);
        installedSet.add(sa);
      }
    } catch (error) {
      warnActionFailed('update subagent', sa, error);
    }
  }

  for (const sa of updatableSubagents) {
    const decision = shouldInstall.get(sa);
    if (!decision) continue;

    if (decision.install) {
      entries.push({
        subagent: sa,
        status: installedSet.has(sa) ? 'changed' : 'skipped',
        reason: installedSet.has(sa) ? decision.reason : 'install-failed',
      });
      continue;
    }

    entries.push({
      subagent: sa,
      status: 'unchanged',
      reason: decision.reason,
    });
  }

  const retainedSubagents = previousSubagents.filter(s => availableSet.has(s));

  return {
    installedSubagents: retainedSubagents,
    entries,
  };
}

// --- Extension skill installation ---

export async function installExtensionSkills(
  projectDir: string,
  agent: AgentInstallation,
  extensionDir: string,
  skillPaths: string[],
  engineId?: string,
  engineMcpKey?: string | null,
): Promise<string[]> {
  const agentConfig = getAgentConfig(agent.id);
  const installed: string[] = [];

  for (const skillPath of skillPaths) {
    const sourceDir = path.join(extensionDir, skillPath);
    const skillName = path.basename(skillPath);

    try {
      await installSkillWithTransformer(
        sourceDir, skillName, projectDir, agent.skillsDir,
        agent.id, agentConfig, engineId, engineMcpKey,
      );
      installed.push(skillName);
    } catch (error) {
      warnActionFailed('install extension skill', skillName, error);
    }
  }

  return installed;
}

export async function removeExtensionSkills(
  projectDir: string,
  agent: AgentInstallation,
  skillNames: string[],
): Promise<string[]> {
  const agentConfig = getAgentConfig(agent.id);
  const transformer = getTransformer(agent.id);
  const removed: string[] = [];

  for (const skillName of skillNames) {
    try {
      const result = transformer.transform(skillName, '');
      if (result.flat) {
        const targetPath = path.join(projectDir, agentConfig.configDir, result.targetDir, result.targetName);
        await removeDirectory(targetPath);
      } else {
        const targetSkillDir = path.join(projectDir, agent.skillsDir, result.targetDir);
        await removeDirectory(targetSkillDir);
      }
      removed.push(skillName);
    } catch {
      // Skill may not exist, ignore
    }
  }

  return removed;
}

// --- Extension subagent installation ---

export async function installExtensionSubagents(
  projectDir: string,
  agent: AgentInstallation,
  extensionDir: string,
  subagentPaths: string[],
  engineId?: string,
  engineMcpKey?: string | null,
): Promise<string[]> {
  const agentConfig = getAgentConfig(agent.id);
  if (!agentConfig.supportsSubagents) return [];

  const targetDir = path.join(projectDir, agent.subagentsDir);
  await ensureDir(targetDir);

  const installed: string[] = [];

  for (const subagentPath of subagentPaths) {
    const sourcePath = path.join(extensionDir, subagentPath);
    const fileName = path.basename(subagentPath);

    if (!isMarkdownFile(fileName)) continue;

    try {
      const content = await loadSourceForAgent(sourcePath, agent.id);
      if (!content) continue;

      const subagentName = stripMdExtension(fileName);
      const vars = buildSubagentTemplateVars(subagentName, engineId, engineMcpKey);
      const processed = processTemplate(content, vars);

      await writeTextFile(path.join(targetDir, fileName), processed);
      installed.push(subagentName);
    } catch (error) {
      warnActionFailed('install extension subagent', fileName, error);
    }
  }

  return installed;
}

export async function removeExtensionSubagents(
  projectDir: string,
  agent: AgentInstallation,
  subagentNames: string[],
): Promise<string[]> {
  const removed: string[] = [];

  for (const name of subagentNames) {
    try {
      const targetPath = path.join(projectDir, agent.subagentsDir, name + '.md');
      await removeFile(targetPath);
      removed.push(name);
    } catch {
      // Subagent may not exist, ignore
    }
  }

  return removed;
}

// --- Rules: data loaders and shared state ---

export type RequiredByMap = Record<string, string | string[]>;

export async function loadRequiredByMap(): Promise<RequiredByMap> {
  const manifestPath = path.join(getDataDir(), RULES_MANIFEST_FILE);
  const { readJsonFile: readJson } = await import('../utils/fs.js');
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

// --- Rules sync ---
//
// `syncRulesState` is the single source of truth for the `rules sync` semantics:
//   Phase 1: Disk ↔ state reconciliation (local .md files vs config.rules.installed)
//   Phase 2: Registry version sync (fetch updates, optional replace/prune of obsolete stack)
//   Phase 3: Regenerate RULES_INDEX.md from registry metadata or disk fallback
//
// Used by both `unikit-ai rules sync` (thin wrapper) and `unikit-ai update`
// (replaces the legacy `updateRules`). Mutates `config.rules.installed` in-place
// and emits structured events; the caller is responsible for calling
// `saveConfig` when `changed` is true and for rendering human output.

export type SyncRulesEvent =
  | { kind: 'phase1:untracked-found'; category: 'core' | 'stack'; name: string }
  | { kind: 'phase1:missing-removed'; category: 'core' | 'stack'; name: string }
  | { kind: 'phase1:state-reconciled' }
  | { kind: 'phase1:state-in-sync' }
  | { kind: 'phase2:registry-unreachable' }
  | { kind: 'phase2:engine-missing'; engineId: string }
  | { kind: 'phase2:updating'; category: 'core' | 'stack'; name: string; fromVersion?: string; toVersion: string; action: 'install' | 'update' }
  | { kind: 'phase2:fetch-failed'; category: 'core' | 'stack'; name: string }
  | { kind: 'phase2:skipped-local-mod'; category: 'core' | 'stack'; name: string }
  | { kind: 'phase2:overwrite-local-mod'; category: 'core' | 'stack'; name: string }
  | { kind: 'phase2:downgrade'; category: 'core' | 'stack'; name: string; fromVersion: string; toVersion: string }
  | { kind: 'phase2:updated' }
  | { kind: 'phase2:up-to-date' }
  | { kind: 'phase2:obsolete-removed'; name: string }
  | { kind: 'phase3:index-regenerated' }
  | { kind: 'phase3:index-skipped-empty' }
  | { kind: 'phase3:index-removed-empty' };

export interface SyncRulesResult {
  changed: boolean;
  events: SyncRulesEvent[];
}

export interface SyncRulesOptions {
  /**
   * Overwrite existing registry-sourced rules regardless of version match and
   * overwrite locally-modified rule files. Emits `phase2:overwrite-local-mod`
   * for every overwritten modified file (no silent path — the former `force`
   * mode is gone).
   */
  replace?: boolean;
  /**
   * Remove obsolete stack rules that vanished from the registry manifest.
   * Scoped to stack rules only (core rules are whitelist-governed).
   */
  prune?: boolean;
}

export async function syncRulesState(
  projectDir: string,
  engineId: string,
  config: UniKitConfig,
  registry: RulesRegistry,
  options: SyncRulesOptions = {},
): Promise<SyncRulesResult> {
  const replace = options.replace === true;
  const prune = options.prune === true;
  const events: SyncRulesEvent[] = [];
  const targetMemoryDir = memoryDir(projectDir);
  let changed = false;

  // --- Phase 1: Disk ↔ state reconciliation ---
  //
  // Design note — intentional strict (case-sensitive) equality.
  //
  // Phase 1 matches filenames against `.unikit.json` entries via a raw
  // `Set<string>` of `entry.name`, with NO normalization. That is on
  // purpose: if a user has a legacy `CODE-STYLE` state entry and a fresh
  // lowercase `code-style.md` file on disk, Phase 1 treats them as two
  // distinct rules, tags the new file as `source: local`, and keeps the
  // legacy entry in place. That is the correct behaviour — we do NOT
  // silently migrate names under the user's feet (a file rename on a
  // case-insensitive FS like NTFS/HFS+ can produce ambiguous state, and
  // blindly merging would hide the mismatch from the user).
  //
  // For core rules there is NO automatic escape hatch — see the design
  // note on the core-state map in the variadic install handler
  // (`rulesInstallCommand` in rules.ts). For stack rules, `--prune` below
  // doubles as an intentional migration opt-in (obsolete-removed block at
  // the bottom of Phase 2).

  let phase1Changed = false;

  for (const category of RULE_CATEGORIES) {
    const dir = path.join(targetMemoryDir, category);
    const files = await listFiles(dir);
    const stateList = category === 'core' ? config.rules.installed.core : config.rules.installed.stack;
    const stateNames = new Set(stateList.map(e => e.name));

    for (const file of files) {
      if (!isMarkdownFile(file) || file === RULES_INDEX_FILE) continue;
      const name = stripMdExtension(file);

      if (!stateNames.has(name)) {
        events.push({ kind: 'phase1:untracked-found', category, name });
        const content = await readTextFile(path.join(dir, file));
        const hash = content ? computeContentHash(content) : undefined;
        stateList.push({ name, source: 'local', installed_hash: hash });
        phase1Changed = true;
      }
    }

    for (let i = stateList.length - 1; i >= 0; i--) {
      const entry = stateList[i];
      const filePath = path.join(dir, `${entry.name}.md`);
      if (!(await fileExists(filePath))) {
        events.push({ kind: 'phase1:missing-removed', category, name: entry.name });
        stateList.splice(i, 1);
        phase1Changed = true;
      }
    }
  }

  if (phase1Changed) {
    events.push({ kind: 'phase1:state-reconciled' });
    changed = true;
  } else {
    events.push({ kind: 'phase1:state-in-sync' });
  }

  // --- Phase 2: Registry sync ---
  //
  // Design note — intentional strict equality on `stateMap`.
  //
  // Phase 2 looks up existing state via `stateMap.get(regRule.id)`, where
  // the map is keyed by the raw `entry.name` from `.unikit.json`. If a
  // legacy project has `CODE-STYLE` in state and the registry now ships
  // `code-style`, Phase 2 will NOT find the existing entry and will
  // treat it as a fresh install — pushing a new `code-style` entry to
  // state and leaving the legacy `CODE-STYLE` row untouched. The result
  // is a duplicate state entry until the user migrates manually or
  // removes the legacy one.
  //
  // This mirrors the storage-vs-comparison split from `normalizeRuleId`:
  // on-disk writes and `.unikit.json` entries are stored as-is, so
  // round-tripping a legacy project never loses data. The CLI-side
  // commands in `rules.ts` (`install`, `show`) normalize on lookup so
  // the end user can still reach their rules — the legacy state simply
  // coexists with the canonical entry until cleaned up.

  const registryManifest = await registry.fetchManifest();
  let phase2Changed = false;

  if (!registryManifest) {
    events.push({ kind: 'phase2:registry-unreachable' });
  } else {
    const engineRules = registryManifest.engines[engineId];
    if (!engineRules) {
      events.push({ kind: 'phase2:engine-missing', engineId });
    } else {
      // Determine origin for tagging
      let origin: RuleOrigin | undefined;
      if ('getResolvedOrigin' in registry) {
        origin = (registry as { getResolvedOrigin(): RuleOrigin | null }).getResolvedOrigin() ?? undefined;
      }

      for (const category of RULE_CATEGORIES) {
        const registryRules = category === 'core' ? engineRules.core : engineRules.stack;
        const registryIds = new Set(registryRules.map(r => r.id));
        const stateList = category === 'core' ? config.rules.installed.core : config.rules.installed.stack;
        const stateMap = new Map(stateList.map(e => [e.name, e]));

        for (const regRule of registryRules) {
          const existing = stateMap.get(regRule.id);

          // HARD GUARD — never install rules the user never installed.
          //
          // `--replace` and `--prune` describe HOW we update rules that are
          // already in `.unikit.json.rules.installed`, not WHETHER we discover
          // and add new ones from the registry catalog. Adding previously-
          // uninstalled rules here would turn routine commands like
          // `unikit-ai update --force` (which users run to refresh skills)
          // into an unannounced bulk-install of every stack rule the registry
          // knows about — exactly the bug this guard fixes.
          //
          // New-rule discovery is the job of:
          //   - `/unikit` Step 9 — interactive, asks the user what to add
          //   - `unikit-ai rules install <id> [<id>...]` — explicit per-rule
          //     install (variadic) or `rules install` with no args for the
          //     whitelisted core bootstrap
          //   - `unikit-ai rules list [--json]` — read-only catalog view
          //
          // The guard is unconditional on purpose: it applies even when
          // `replace === true` or `prune === true`. Both flags still do
          // their intended work on rules that ARE already in state (see the
          // two guards below), they just cannot materialize new rules from
          // the catalog.
          if (!existing) continue;

          // `--replace` bypasses the remaining guards so it can overwrite
          // existing entries even when source is local or the version matches
          // the registry. Normal sync only updates existing registry-sourced
          // rules whose version changed.
          if (!replace) {
            if (existing.source !== 'registry') continue;
            if (existing.version === regRule.version) continue;
          }

          // Downgrade detection is emitted whenever `--replace` is walking
          // a rule whose registry version is lower than the installed one.
          // Without `--replace` the previous guard already short-circuits
          // the update, so downgrades can't be silently materialized.
          if (replace && existing.version
            && semver.valid(existing.version) && semver.valid(regRule.version)
            && semver.lt(regRule.version, existing.version)) {
            events.push({
              kind: 'phase2:downgrade',
              category,
              name: regRule.id,
              fromVersion: existing.version,
              toVersion: regRule.version,
            });
          }

          // `existing` is guaranteed defined at this point — the hard guard
          // above short-circuits rules that are not in state, so Phase 2
          // only ever UPDATES, never installs from scratch.
          events.push({
            kind: 'phase2:updating',
            category,
            name: regRule.id,
            fromVersion: existing.version,
            toVersion: regRule.version,
            action: 'update',
          });

          const fetched = await registry.fetchRule(engineId, category, regRule.id);
          if (!fetched) {
            events.push({ kind: 'phase2:fetch-failed', category, name: regRule.id });
            continue;
          }

          // Local modification handling:
          //   --replace → overwrite + WARN event per file (no silent path)
          //   normal    → skip with WARN event, leave disk alone
          const destPath = path.join(targetMemoryDir, category, `${regRule.id}.md`);
          const diskContent = await readTextFile(destPath);
          const diskHash = diskContent ? computeContentHash(diskContent) : null;
          const locallyModified = !!(diskHash && existing.installed_hash && diskHash !== existing.installed_hash);
          if (locallyModified) {
            if (replace) {
              events.push({ kind: 'phase2:overwrite-local-mod', category, name: regRule.id });
            } else {
              events.push({ kind: 'phase2:skipped-local-mod', category, name: regRule.id });
              continue;
            }
          }

          await writeTextFile(destPath, fetched.content);
          const newHash = computeContentHash(fetched.content);

          if (regRule.references && regRule.references.length > 0) {
            const refs = await registry.fetchReferences(engineId, category, regRule.id, regRule.references);
            const destRefsDir = path.join(targetMemoryDir, category, REFERENCES_DIR_NAME);
            for (const ref of refs) {
              await writeTextFile(path.join(destRefsDir, ref.filename), ref.content);
            }
          }

          existing.source = 'registry';
          existing.version = regRule.version;
          existing.installed_hash = newHash;
          existing.origin = origin;
          phase2Changed = true;
        }

        // --prune: remove obsolete stack rules that vanished from registry.
        //
        // Scoped to `category === 'stack'` on purpose: core rules are
        // governed by `CORE_RULE_WHITELIST` and have no such escape hatch
        // (see the design note on the core-state map in the variadic install
        // handler in rules.ts).
        //
        // Design note — legacy UPPER_CASE → canonical lowercase migration
        // is NO LONGER silently handled here. Previously, the install loop
        // above would materialize a new `unitask` entry when it saw a
        // registry rule with no matching state entry, and this block would
        // then delete the legacy `UNITASK`. That worked only because the
        // install loop was willing to add rules that were never installed
        // by the user — which turned out to be a much bigger footgun than
        // the migration was worth (every `unikit-ai update --force` would
        // carpet-bomb the project with the entire stack catalog). The
        // install loop now has a hard guard against materializing new
        // rules, so a legacy entry on a case-sensitive filesystem will be
        // removed here but never replaced. If you are migrating from an
        // UPPER_CASE state entry, run `unikit-ai rules install <id>`
        // explicitly after the sync — the CLI normalizes the id and
        // installs the canonical version.
        if (prune && category === 'stack') {
          for (let i = stateList.length - 1; i >= 0; i--) {
            const entry = stateList[i];
            if (entry.source === 'local') continue;
            if (registryIds.has(entry.name)) continue;

            const destPath = path.join(targetMemoryDir, 'stack', `${entry.name}.md`);
            if (await fileExists(destPath)) {
              await removeFile(destPath);
            }
            events.push({ kind: 'phase2:obsolete-removed', name: entry.name });
            stateList.splice(i, 1);
            phase2Changed = true;
          }
        }
      }

      if (phase2Changed) {
        events.push({ kind: 'phase2:updated' });
        changed = true;
      } else {
        events.push({ kind: 'phase2:up-to-date' });
      }
    }
  }

  // --- Phase 3: Regenerate RULES_INDEX.md ---
  //
  // The index is cheap to rebuild and is the single authoritative map the
  // /unikit skill reads to decide what to load per task, so we regenerate it
  // on every sync — even when Phase 1 and Phase 2 were no-ops. That keeps the
  // file in sync with `.unikit/memory/` contents if the user has added local
  // rules by hand or deleted some outside of `rules install`.

  const requiredBy = await loadRequiredByMap();
  const coreNames = config.rules.installed.core.map(e => e.name);
  const stackNames = config.rules.installed.stack.map(e => e.name);
  const indexStatus = await generateRulesIndex(projectDir, coreNames, stackNames, requiredBy);
  switch (indexStatus) {
    case 'written':
      events.push({ kind: 'phase3:index-regenerated' });
      break;
    case 'skipped-empty':
      events.push({ kind: 'phase3:index-skipped-empty' });
      break;
    case 'removed-empty':
      events.push({ kind: 'phase3:index-removed-empty' });
      // Removing a stale index counts as a state change even though
      // `.unikit.json` was not touched — the working tree differs after sync.
      changed = true;
      break;
  }

  return { changed, events };
}


// --- Temporary re-exports (dropped in the final unbundling task) ---
export { installEngineTemplates, installCliContract, installDevPrinciples } from './installer/system-assets.js';
export { injectMcpRules } from './installer/mcp-injection.js';
export {
  installSkillWithTransformer, installSkills, getAvailableSkills,
  buildManagedSkillsState, updateSkills,
} from './installer/skills.js';
export type {
  SkillUpdateStatus, SkillUpdateEntry, UpdateSkillsResult, UpdateSkillsOptions, InstallSkillsOptions,
} from './installer/skills.js';
