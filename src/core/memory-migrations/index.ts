// Project migrations — on-disk relocation of `.unikit/` into the modular layout.
//
// PR#1 introduces the modular layout `.unikit/memory/<module>/<tier>`. Existing
// projects have the legacy flat layout `.unikit/memory/{core,stack}` (plus a
// top-level `RULES_INDEX.md`). The first migration here wraps that flat layout
// under the `code` module, non-destructively and idempotently: a second run is
// a no-op (detect returns false once `code/` exists), so the move is sha-stable.
//
// PR#4 adds a sibling step (defined in `../workspace-migrations`) that relocates
// the project WORKSPACE — plans/patches/researches + the plan/fix-plan documents
// — under the same `code` module dir. Both steps share one chain
// (`PROJECT_MEMORY_MIGRATIONS`) so `update` runs them in a single pass and the
// `rules` staleness guard sees memory AND workspace staleness through the same
// `planMigrationChain` probe.

import path from 'path';
import { fileExists, movePath } from '../../utils/fs.js';
import { logInfo } from '../../utils/log.js';
import {
  CODE_MODULE_ID, MIGRATION_SINCE_MODULAR_LAYOUT, RULE_CATEGORIES, RULES_INDEX_FILE,
  memoryDir, moduleDir, moduleTierDir,
} from '../constants.js';
import { runMigrationChain } from '../migrations/runner.js';
import type { Migration, MigrationChainResult } from '../migrations/types.js';
import {
  PROJECT_PLAN_ARTIFACT_MIGRATIONS, PROJECT_WORKSPACE_MIGRATIONS,
} from '../workspace-migrations/index.js';
import { PROJECT_MCP_MIGRATIONS } from '../mcp-migrations/index.js';

interface MemoryMigrationContext {
  projectDir: string;
}

/**
 * Lower bound for the *broad* (version-based) staleness signal in
 * `isProjectStale`. A project whose `.unikit.json.version` is a valid semver
 * below this value predates the modular layout entirely (pre-1.1.0) — the CLI
 * was upgraded but `update` (the sole migrator) never ran, so its skills,
 * system files AND memory are all stale. `versionStale` flags those projects up
 * front.
 *
 * **Why this is an explicit literal and NOT derived as `max(since)`.** It is a
 * different question from a migration anchor. `Migration.since` asks "has this
 * project seen THIS step?"; this constant asks "is this project so old that
 * everything about it is stale?". Deriving it from the anchors would answer the
 * second question with the first one: any future step anchored at, say, 1.5.0
 * would instantly declare every 1.4.x project version-stale even with a clean
 * `detect` and nothing pending on disk.
 *
 * The derivation is also redundant. Since the runner ORs the two halves, a
 * 1.1.0 project already gets `versionPending === true` for every step anchored
 * above it — `planMigrationChain` returns those ids and `diskPending` raises
 * the same flag, one step at a time and only for steps that really exist.
 *
 * So this pin stays where it is: it marks the pre-modular era, not the latest
 * relocation. Per-migration staleness is `diskPending`'s job.
 */
export const MEMORY_MODULAR_MIN_VERSION = '1.1.0';

/**
 * Wrap the legacy flat layout (`memory/{core,stack}` + top-level
 * `RULES_INDEX.md`) under `memory/code/`. References live inside each tier
 * subtree (`memory/<tier>/references/`) and relocate together with it — they
 * are never moved separately.
 */
const codeWrapMigration: Migration<MemoryMigrationContext> = {
  id: 'memory-1-to-2-code-wrap',
  since: MIGRATION_SINCE_MODULAR_LAYOUT,

  async detect({ projectDir }) {
    const memDir = memoryDir(projectDir);
    let flatPresent = false;
    for (const tier of RULE_CATEGORIES) {
      if (await fileExists(path.join(memDir, tier))) {
        flatPresent = true;
        break;
      }
    }
    if (!flatPresent) return false;
    // Already wrapped under the module dir → nothing to do (idempotent).
    return !(await fileExists(moduleDir(projectDir, CODE_MODULE_ID)));
  },

  async apply({ projectDir }) {
    const memDir = memoryDir(projectDir);

    for (const tier of RULE_CATEGORIES) {
      const src = path.join(memDir, tier);
      const dest = moduleTierDir(projectDir, CODE_MODULE_ID, tier);
      if (await fileExists(src) && !(await fileExists(dest))) {
        await movePath(src, dest);
        logInfo('memory:migrate', `relocated ${tier} → code/${tier}`);
      }
    }

    // The generated index lived at the flat memory root; relocate it under the
    // module so no stale top-level RULES_INDEX.md survives the migration.
    const flatIndex = path.join(memDir, RULES_INDEX_FILE);
    const destIndex = path.join(moduleDir(projectDir, CODE_MODULE_ID), RULES_INDEX_FILE);
    if (await fileExists(flatIndex) && !(await fileExists(destIndex))) {
      await movePath(flatIndex, destIndex);
      logInfo('memory:migrate', `relocated ${RULES_INDEX_FILE} → code/${RULES_INDEX_FILE}`);
    }
  },
};

// The single project migration chain: the memory wrap, the workspace
// relocation, the MCP steps, then the plan-manifest merge — every context is
// keyed by `projectDir` only, so the structurally identical shapes compose into
// one chain. Kept under the historical name `PROJECT_MEMORY_MIGRATIONS` because
// the `rules` staleness guard imports it by that name; it now covers memory,
// workspace, MCP-config AND plan-artifact staleness.
//
// Declaration order is documentation, not policy — the runner sorts by `since`
// (the 1.1.0 layout steps, then the 1.2.0 group: the two MCP steps and the
// plan-manifest merge, which ship in the same release). Within that group the
// sort is stable, so declaration order decides — and it does not need to: the
// merge walks `.unikit/code/plans/*`, which on a pre-modular project does not
// exist until the 1.1.0 relocation has run, and the anchors alone order those
// two correctly.
export const PROJECT_MEMORY_MIGRATIONS: readonly Migration<MemoryMigrationContext>[] = [
  codeWrapMigration,
  ...PROJECT_WORKSPACE_MIGRATIONS,
  ...PROJECT_MCP_MIGRATIONS,
  ...PROJECT_PLAN_ARTIFACT_MIGRATIONS,
];

/**
 * Run the project migration chain (memory wrap + workspace relocation) against
 * `projectDir`. Safe to call on every `update`: it no-ops once the modular
 * layout is fully in place.
 *
 * `currentVersion` is the project's RECORDED version — read with
 * `readConfigVersion`, which returns `null` both for a missing config and for a
 * config with no `version` field. Do not source it from `loadConfig`: that
 * defaults a missing field to the current package version, so the oldest
 * projects in existence would read as freshly stamped and the version half of
 * every step would go quiet on exactly them. `null` is honest — it turns the
 * version half off and leaves `detect` in charge.
 */
export async function runProjectMemoryMigrations(
  projectDir: string,
  currentVersion: string | null,
): Promise<MigrationChainResult> {
  logInfo('memory:migrate', `running project memory migrations (currentVersion=${currentVersion ?? 'null'})`);
  return runMigrationChain({ projectDir }, PROJECT_MEMORY_MIGRATIONS, { currentVersion });
}
