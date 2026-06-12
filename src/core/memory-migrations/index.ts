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
  CODE_MODULE_ID, RULE_CATEGORIES, RULES_INDEX_FILE,
  memoryDir, moduleDir, moduleTierDir,
} from '../constants.js';
import { runMigrationChain } from '../migrations/runner.js';
import type { Migration, MigrationChainResult } from '../migrations/types.js';
import { PROJECT_WORKSPACE_MIGRATIONS } from '../workspace-migrations/index.js';

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
 * It is intentionally NOT bumped for every layout migration. The workspace
 * relocation (PR#4) ships to projects that are already at `1.1.0`
 * (`semver.lt('1.1.0','1.1.0') === false`), so `versionStale` cannot see their
 * pending workspace move. That is by design: per-migration staleness is the job
 * of `diskPending` (the migration chain's own `detect` pass via
 * `planMigrationChain`), which catches ANY un-applied step — memory or
 * workspace — regardless of version. Keeping this pin fixed avoids forcing a
 * version bump (and a sweep of every version-seeding test fixture) for each new
 * relocation step. Raising it later is a deliberate defense-in-depth lever, not
 * a requirement for the workspace gate.
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

// The single project migration chain. The memory wrap runs first, then the
// workspace relocation — both keyed by `projectDir` only, so the two
// structurally identical contexts compose into one chain. Kept under the
// historical name `PROJECT_MEMORY_MIGRATIONS` because the `rules` staleness
// guard imports it by that name; it now covers memory AND workspace staleness.
export const PROJECT_MEMORY_MIGRATIONS: readonly Migration<MemoryMigrationContext>[] = [
  codeWrapMigration,
  ...PROJECT_WORKSPACE_MIGRATIONS,
];

/**
 * Run the project migration chain (memory wrap + workspace relocation) against
 * `projectDir`. Safe to call on every `update`: it no-ops once the modular
 * layout is fully in place.
 */
export async function runProjectMemoryMigrations(projectDir: string): Promise<MigrationChainResult> {
  logInfo('memory:migrate', 'running project memory migrations');
  return runMigrationChain({ projectDir }, PROJECT_MEMORY_MIGRATIONS);
}
