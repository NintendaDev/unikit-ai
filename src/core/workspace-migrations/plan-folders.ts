// Where the plan folders are and how they are walked — the disk half of the
// content-merging migrations.
//
// Split from `markdown.ts` on a LAYER boundary rather than a size one: nothing
// here parses markdown, and nothing there touches the disk. Two steps read this
// module — the manifest merge (`plan-artifact.ts`) and the timestamp backfill
// (`plan-timestamps.ts`) — plus the research merge, which borrows only
// `folderDatePrefix`. A verbatim copy of the walk in any of them is exactly the
// duplication the extraction exists to prevent.

import path from 'path';
import { fileExists, listDirectories } from '../../utils/fs.js';
import { CODE_MODULE_ID, PLANS_DIR_NAME, UNIKIT_DIR, workspaceDir } from '../constants.js';

/** Absolute paths of the subfolders of `root`, sorted so logs read alike everywhere. */
async function foldersUnder(root: string): Promise<string[]> {
  const names = await listDirectories(root);
  return names.sort().map(name => path.join(root, name));
}

/** Where the plans live once the 1.1.0 relocation has run. */
function modularPlansRoot(projectDir: string): string {
  return path.join(workspaceDir(projectDir, CODE_MODULE_ID), PLANS_DIR_NAME);
}

/** The plan folders `apply` walks — always the modular location. */
export async function planFolders(projectDir: string): Promise<string[]> {
  return foldersUnder(modularPlansRoot(projectDir));
}

/**
 * The plan folders `detect` judges — which is NOT always the same set.
 *
 * The runner evaluates `detect` for the WHOLE chain before it applies anything
 * (`migrations/runner.ts`, phases 1 and 3). On a project that still carries the
 * pre-1.1.0 flat workspace, `.unikit/code/plans` therefore does not exist yet
 * at detect time even though the relocation is queued to run in this very pass,
 * and probing only the modular root would report "nothing to merge" while the
 * merge is exactly what the run owes. A version-pending project is carried by
 * the version half regardless; the one this rescues is the project whose stamp
 * says current while its disk says otherwise — the case the runner ORs the two
 * halves for in the first place.
 *
 * The fallback is gated on the modular root being ABSENT, which is verbatim the
 * relocation's own destination guard. When both roots exist the flat copy is a
 * `logWarn` leftover that no step will ever touch, and reporting it as pending
 * would strand the project at exit 8 with nothing able to clear it.
 */
export async function detectableFolders(projectDir: string): Promise<string[]> {
  const modularRoot = modularPlansRoot(projectDir);
  if (await fileExists(modularRoot)) return foldersUnder(modularRoot);
  return foldersUnder(path.join(projectDir, UNIKIT_DIR, PLANS_DIR_NAME));
}

/**
 * `2026-03-08` out of `2026-03-08_customers`; `null` when the name carries no date.
 *
 * Reads the BASE NAME only, never a full path: a dated parent directory has no
 * business deciding the date of a folder whose own name carries none. Legacy
 * `001-customers` and dateless `customers` both answer `null`, and the caller
 * decides what an unrecoverable date means for it.
 */
export function folderDatePrefix(base: string): string | null {
  return /^(\d{4}-\d{2}-\d{2})_/.exec(base)?.[1] ?? null;
}
