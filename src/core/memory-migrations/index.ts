// Project memory migrations — on-disk relocation of `.unikit/memory`.
//
// PR#1 introduces the modular layout `.unikit/memory/<module>/<tier>`. Existing
// projects have the legacy flat layout `.unikit/memory/{core,stack}` (plus a
// top-level `RULES_INDEX.md`). The single migration here wraps that flat layout
// under the `code` module, non-destructively and idempotently: a second run is
// a no-op (detect returns false once `code/` exists), so the move is sha-stable.

import path from 'path';
import { fileExists, movePath } from '../../utils/fs.js';
import { logInfo } from '../../utils/log.js';
import {
  CODE_MODULE_ID, RULE_CATEGORIES, RULES_INDEX_FILE,
  memoryDir, moduleDir, moduleTierDir,
} from '../constants.js';
import { runMigrationChain } from '../migrations/runner.js';
import type { Migration, MigrationChainResult } from '../migrations/types.js';

interface MemoryMigrationContext {
  projectDir: string;
}

/**
 * Minimum `.unikit.json` `version` that guarantees the modular memory layout
 * (`.unikit/memory/code/<tier>`) is in place. A project below this version
 * predates `codeWrapMigration` and must run `unikit-ai update` (the sole
 * migrator) before any command that reconciles rule state against the new
 * path. This is a migration fact pinned to `codeWrapMigration` — NOT the
 * current package version — so it never moves when the release version bumps.
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

export const PROJECT_MEMORY_MIGRATIONS: readonly Migration<MemoryMigrationContext>[] = [
  codeWrapMigration,
];

/**
 * Run the project memory migration chain against `projectDir`. Safe to call on
 * every `update`: it no-ops once the modular layout is in place.
 */
export async function runProjectMemoryMigrations(projectDir: string): Promise<MigrationChainResult> {
  logInfo('memory:migrate', 'running project memory migrations');
  return runMigrationChain({ projectDir }, PROJECT_MEMORY_MIGRATIONS);
}
