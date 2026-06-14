import path from 'path';
import semver from 'semver';
import {
  listFiles, readTextFile, writeTextFile, removeFile, fileExists,
} from '../../utils/fs.js';
import { getModuleTier, type RuleOrigin, type UniKitConfig } from '../config.js';
import type { ChainedRegistry } from '../registry/index.js';
import { manifestEngineIds } from '../registry/validator.js';
import { computeContentHash, isMarkdownFile, stripMdExtension } from './shared.js';
import { REFERENCES_DIR_NAME, RULES_INDEX_FILE, moduleTierDir, type Tier } from '../constants.js';
import { listModules, type Module } from '../modules.js';
import { loadRequiredByMap, generateRulesIndex, type InstalledByTier, type OriginByRule } from './rules-index.js';

// --- Rules sync ---
//
// `syncRulesState` is the single source of truth for the per-module `rules sync`
// semantics:
//   Phase 1: Disk ↔ state reconciliation (local .md files vs the module's state)
//   Phase 2: Registry version sync (fetch updates, optional replace/prune of obsolete stack)
//   Phase 3: Regenerate <module>/RULES_INDEX.md from registry metadata or disk fallback
//
// It operates on ONE module at a time (`config.rules.installed.modules[module]`);
// `syncAllModules` loops the MODULE_REGISTRY for callers that want every module
// reconciled in one pass. Used by both `unikit-ai rules sync` (thin wrapper) and
// `unikit-ai update`. Mutates `config.rules.installed` in-place and emits
// structured events; the caller is responsible for calling `saveConfig` when
// `changed` is true and for rendering human output.

export type SyncRulesEvent =
  | { kind: 'phase1:untracked-found'; tier: Tier; name: string }
  | { kind: 'phase1:missing-removed'; tier: Tier; name: string }
  | { kind: 'phase1:state-reconciled' }
  | { kind: 'phase1:state-in-sync' }
  | { kind: 'phase2:registry-unreachable' }
  | { kind: 'phase2:engine-missing'; engineId: string }
  | { kind: 'phase2:updating'; tier: Tier; name: string; fromVersion?: string; toVersion: string; action: 'install' | 'update' }
  | { kind: 'phase2:fetch-failed'; tier: Tier; name: string }
  | { kind: 'phase2:skipped-local-mod'; tier: Tier; name: string }
  | { kind: 'phase2:overwrite-local-mod'; tier: Tier; name: string }
  | { kind: 'phase2:override-retained'; tier: Tier; name: string }
  | { kind: 'phase2:downgrade'; tier: Tier; name: string; fromVersion: string; toVersion: string }
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
   * Scoped to stack rules only (core rules are tier-gated, not pruned).
   */
  prune?: boolean;
}

// --- Phase 1: Disk <-> state reconciliation ---
//
// Design note — intentional strict (case-sensitive) equality.
//
// Phase 1 matches filenames against the module state entries via a raw
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
async function reconcileDiskState(
  projectDir: string,
  module: Module,
  config: UniKitConfig,
  events: SyncRulesEvent[],
): Promise<boolean> {
  let phase1Changed = false;

  for (const tier of module.tiers) {
    const dir = moduleTierDir(projectDir, module.id, tier);
    const files = await listFiles(dir);
    const stateList = getModuleTier(config, module.id, tier);
    const stateNames = new Set(stateList.map(e => e.name));

    for (const file of files) {
      if (!isMarkdownFile(file) || file === RULES_INDEX_FILE) continue;
      const name = stripMdExtension(file);

      if (!stateNames.has(name)) {
        events.push({ kind: 'phase1:untracked-found', tier, name });
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
        events.push({ kind: 'phase1:missing-removed', tier, name: entry.name });
        stateList.splice(i, 1);
        phase1Changed = true;
      }
    }
  }

  if (phase1Changed) {
    events.push({ kind: 'phase1:state-reconciled' });
  } else {
    events.push({ kind: 'phase1:state-in-sync' });
  }

  return phase1Changed;
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
async function syncRegistry(
  projectDir: string,
  engineId: string,
  module: Module,
  config: UniKitConfig,
  registry: ChainedRegistry,
  replace: boolean,
  prune: boolean,
  events: SyncRulesEvent[],
): Promise<boolean> {
  // Per-module manifest resolution: each module finds its own winning chain
  // source (a code-only custom registry still syncs gamedesign rules through
  // the official/bundled fallback). A module missing from every source keeps
  // the manifest non-null while the accessors below yield `[]` — Phase 2 then
  // no-ops for that module instead of erroring.
  const registryManifest = await registry.fetchModuleManifest(module.id);

  if (!registryManifest) {
    events.push({ kind: 'phase2:registry-unreachable' });
    return false;
  }

  // Engine-existence predicate (engine-partitioned modules only). The accessor
  // `getModuleRules` collapses "engine missing" and "tier empty" to `[]`, so the
  // engine-missing signal must be derived from the manifest's engine list. The
  // raw schema:2 manifest has no flat `engines` map, hence the schema-agnostic
  // `manifestEngineIds` helper rather than a direct `manifest.engines` read.
  if (module.enginePartitioned && !manifestEngineIds(registryManifest).includes(engineId)) {
    events.push({ kind: 'phase2:engine-missing', engineId });
    return false;
  }

  let phase2Changed = false;

  for (const tier of module.tiers) {
    // Rules come exclusively through the registry accessor — the single read
    // channel that resolves the module's normalized schema:2 manifest.
    const registryRules = registry.getModuleRules(module.id, tier);
    const registryIds = new Set(registryRules.map(r => r.id));
    const stateList = getModuleTier(config, module.id, tier);
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
      //     core-tier bootstrap
      //   - `unikit-ai rules list [--json]` — read-only catalog view
      //
      // The guard is unconditional on purpose: it applies even when
      // `replace === true` or `prune === true`. Both flags still do
      // their intended work on rules that ARE already in state (see the
      // two guards below), they just cannot materialize new rules from
      // the catalog.
      if (!existing) continue;

      // Per-rule B-merge origin for THIS id (override→primary,
      // backfill→official/bundled). For module-winner modules it equals the
      // module-wide origin; for per-id-merge modules it varies per id.
      const ruleOrigin: RuleOrigin | undefined =
        registry.getResolvedOriginForRule(module.id, tier, regRule.id) ?? undefined;

      // `--replace` bypasses the remaining guards so it can overwrite
      // existing entries even when source is local or the version matches
      // the registry. Normal sync only updates existing registry-sourced
      // rules whose version changed.
      if (!replace) {
        if (existing.source !== 'registry') continue;
        if (existing.version === regRule.version) continue;

        // Override-retention guard (per-id-merge modules only): a deliberate
        // studio override (origin `primary`) does NOT auto-update from the
        // canonical official/bundled version. Once the per-id resolution no
        // longer points at the custom source for this id, leave the installed
        // override untouched — only an explicit `--replace` overwrites it.
        if (module.coreResolution === 'per-id-merge'
          && existing.origin === 'primary'
          && ruleOrigin !== 'primary') {
          events.push({ kind: 'phase2:override-retained', tier, name: regRule.id });
          continue;
        }
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
          tier,
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
        tier,
        name: regRule.id,
        fromVersion: existing.version,
        toVersion: regRule.version,
        action: 'update',
      });

      const fetched = await registry.fetchRule(module.id, engineId, tier, regRule.id);
      if (!fetched) {
        events.push({ kind: 'phase2:fetch-failed', tier, name: regRule.id });
        continue;
      }

      // Local modification handling:
      //   --replace → overwrite + WARN event per file (no silent path)
      //   normal    → skip with WARN event, leave disk alone
      const tierDir = moduleTierDir(projectDir, module.id, tier);
      const destPath = path.join(tierDir, `${regRule.id}.md`);
      const diskContent = await readTextFile(destPath);
      const diskHash = diskContent ? computeContentHash(diskContent) : null;
      const locallyModified = !!(diskHash && existing.installed_hash && diskHash !== existing.installed_hash);
      if (locallyModified) {
        if (replace) {
          events.push({ kind: 'phase2:overwrite-local-mod', tier, name: regRule.id });
        } else {
          events.push({ kind: 'phase2:skipped-local-mod', tier, name: regRule.id });
          continue;
        }
      }

      await writeTextFile(destPath, fetched.content);
      const newHash = computeContentHash(fetched.content);

      if (regRule.references && regRule.references.length > 0) {
        const refs = await registry.fetchReferences(module.id, engineId, tier, regRule.id, regRule.references);
        const destRefsDir = path.join(tierDir, REFERENCES_DIR_NAME);
        for (const ref of refs) {
          await writeTextFile(path.join(destRefsDir, ref.filename), ref.content);
        }
      }

      existing.source = 'registry';
      existing.version = regRule.version;
      existing.installed_hash = newHash;
      existing.origin = ruleOrigin;
      phase2Changed = true;
    }

    // --prune: remove obsolete stack rules that vanished from registry.
    //
    // Scoped to `tier === 'stack'` on purpose: core rules are tier-gated
    // (every core-tier rule the registry ships is installed by the
    // bootstrap) and have no such escape hatch — see the design note on
    // the core-state map in the variadic install handler in rules.ts.
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
    if (prune && tier === 'stack') {
      for (let i = stateList.length - 1; i >= 0; i--) {
        const entry = stateList[i];
        if (entry.source === 'local') continue;
        if (registryIds.has(entry.name)) continue;

        const destPath = path.join(moduleTierDir(projectDir, module.id, tier), `${entry.name}.md`);
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
  } else {
    events.push({ kind: 'phase2:up-to-date' });
  }

  return phase2Changed;
}

// --- Phase 3: Regenerate <module>/RULES_INDEX.md ---
//
// The index is cheap to rebuild and is the single authoritative map the
// /unikit skill reads to decide what to load per task, so we regenerate it
// on every sync — even when Phase 1 and Phase 2 were no-ops. That keeps the
// file in sync with the module's on-disk contents if the user has added local
// rules by hand or deleted some outside of `rules install`.
async function regenerateIndex(
  projectDir: string,
  module: Module,
  config: UniKitConfig,
  events: SyncRulesEvent[],
): Promise<boolean> {
  const requiredBy = await loadRequiredByMap();
  const installedByTier: InstalledByTier = {};
  const originByRule: OriginByRule = {};
  for (const tier of module.tiers) {
    const entries = getModuleTier(config, module.id, tier);
    installedByTier[tier] = entries.map(e => e.name);
    for (const e of entries) {
      if (e.origin) originByRule[e.name] = e.origin;
    }
  }
  const indexStatus = await generateRulesIndex(projectDir, module, installedByTier, requiredBy, originByRule);
  switch (indexStatus) {
    case 'written':
      events.push({ kind: 'phase3:index-regenerated' });
      return false;
    case 'skipped-empty':
      events.push({ kind: 'phase3:index-skipped-empty' });
      return false;
    case 'removed-empty':
      events.push({ kind: 'phase3:index-removed-empty' });
      // Removing a stale index counts as a state change even though
      // `.unikit.json` was not touched — the working tree differs after sync.
      return true;
  }
}

/**
 * Reconcile a single module's rule state with disk + registry. The per-module
 * worker behind both `unikit-ai rules sync` and `unikit-ai update` (via
 * `syncAllModules`).
 */
export async function syncRulesState(
  projectDir: string,
  engineId: string,
  module: Module,
  config: UniKitConfig,
  registry: ChainedRegistry,
  options: SyncRulesOptions = {},
): Promise<SyncRulesResult> {
  const replace = options.replace === true;
  const prune = options.prune === true;
  const events: SyncRulesEvent[] = [];
  let changed = false;

  if (await reconcileDiskState(projectDir, module, config, events)) changed = true;
  if (await syncRegistry(projectDir, engineId, module, config, registry, replace, prune, events)) changed = true;
  if (await regenerateIndex(projectDir, module, config, events)) changed = true;

  return { changed, events };
}

/**
 * Run `syncRulesState` for every module in the registry, aggregating their
 * change flags and events. PR#1 ships a single module (`code`); this is the
 * forward-compatible entry point callers use instead of pinning to one module.
 */
export async function syncAllModules(
  projectDir: string,
  engineId: string,
  config: UniKitConfig,
  registry: ChainedRegistry,
  options: SyncRulesOptions = {},
): Promise<SyncRulesResult> {
  const events: SyncRulesEvent[] = [];
  let changed = false;

  for (const module of listModules()) {
    const result = await syncRulesState(projectDir, engineId, module, config, registry, options);
    if (result.changed) changed = true;
    events.push(...result.events);
  }

  return { changed, events };
}
