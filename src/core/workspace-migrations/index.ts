// Project workspace migrations — on-disk relocation of `.unikit/<working files>`.
//
// PR#1 wrapped the memory layout under the `code` module (`.unikit/memory/code/`).
// PR#4 does the same for the project WORKSPACE: the plan/fix-plan documents and
// the plans/patches/researches directories move from the flat `.unikit/` root
// under `.unikit/<code-module>/`, so a future second module owns its own
// workspace without colliding with `code`. Mirrors `codeWrapMigration`:
// non-destructive (guards every move on an absent destination) and idempotent
// (a second run is a no-op once everything is relocated, so the move is
// sha-stable).
//
// This step is registered in `PROJECT_MEMORY_MIGRATIONS` (see
// `../memory-migrations`) so the single project migration chain that `update`
// runs — and that the `rules` staleness guard inspects via `planMigrationChain`
// — sees workspace staleness without any extra wiring.

import path from 'path';
import { fileExists, movePath } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';
import {
  CODE_MODULE_ID, UNIKIT_DIR,
  WORKSPACE_ARTIFACT_DIRS, WORKSPACE_ARTIFACT_FILES, WORKSPACE_ARTIFACT_RENAMES,
  workspaceDir,
} from '../constants.js';
import type { Migration } from '../migrations/types.js';

const LOG_TAG = 'workspace:migrate';

interface WorkspaceMigrationContext {
  projectDir: string;
}

/** One relocation: `<flatRoot>/<from>` → `<codeRoot>/<to>` (basenames may differ). */
interface Relocation {
  from: string;
  to: string;
}

/**
 * The full relocation set in apply order: directories and 1:1 files first
 * (`researches/` lands before the renamed index drops into it), then the
 * renames. Built from the constants inventory so the migration, the skill-layer
 * references, and the golden-guard never drift apart.
 */
function relocations(): Relocation[] {
  const oneToOne = [...WORKSPACE_ARTIFACT_DIRS, ...WORKSPACE_ARTIFACT_FILES]
    .map(name => ({ from: name, to: name }));
  return [...oneToOne, ...WORKSPACE_ARTIFACT_RENAMES.map(r => ({ from: r.from, to: r.to }))];
}

/**
 * Relocate the flat `.unikit/{plans,patches,researches,PLAN.md,FIX_PLAN.md}`
 * workspace (plus the `RESEARCHES_INDEX.md` → `researches/INDEX.md` rename)
 * under the `code` module dir. Each move is guarded by an absent-destination
 * check so a partially-migrated project self-heals and a fully-migrated one
 * is a clean no-op.
 */
const workspaceCodeRelocationMigration: Migration<WorkspaceMigrationContext> = {
  id: 'workspace-1-to-2-code-relocate',

  async detect({ projectDir }) {
    const flatRoot = path.join(projectDir, UNIKIT_DIR);
    const codeRoot = workspaceDir(projectDir, CODE_MODULE_ID);
    for (const { from, to } of relocations()) {
      const src = path.join(flatRoot, from);
      const dest = path.join(codeRoot, to);
      // Pending iff a legacy artifact still sits flat and is not yet relocated.
      if ((await fileExists(src)) && !(await fileExists(dest))) {
        return true;
      }
    }
    return false;
  },

  async apply({ projectDir }) {
    const flatRoot = path.join(projectDir, UNIKIT_DIR);
    const codeRoot = workspaceDir(projectDir, CODE_MODULE_ID);

    for (const { from, to } of relocations()) {
      const src = path.join(flatRoot, from);
      const dest = path.join(codeRoot, to);
      if (!(await fileExists(src))) continue;
      if (await fileExists(dest)) {
        // Both present means a prior run (or the user) already created the
        // destination — never overwrite; leave the flat copy for manual review.
        logWarn(LOG_TAG, `skip ${from}: ${CODE_MODULE_ID}/${to} already exists`);
        continue;
      }
      await movePath(src, dest);
      logInfo(LOG_TAG, `relocated ${from} → ${CODE_MODULE_ID}/${to}`);
    }
  },
};

export const PROJECT_WORKSPACE_MIGRATIONS: readonly Migration<WorkspaceMigrationContext>[] = [
  workspaceCodeRelocationMigration,
];
