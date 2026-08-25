// Where a module's workspace subfolders are and how they are walked — the disk
// half of the content-merging migrations.
//
// Split from `markdown.ts` on a LAYER boundary rather than a size one: nothing
// here parses markdown, and nothing there touches the disk. Three steps read
// this module — the manifest merge (`plan-artifact.ts`), the timestamp backfill
// (`plan-timestamps.ts`) and the research merge (`research-artifact.ts`) — and
// a verbatim copy of the walk in any of them is exactly the duplication the
// extraction exists to prevent. It was copied into the research merge once
// already, together with the TSDoc explaining the dual root, which is how the
// file came to be named for plans while serving all three.
//
// The walk is parameterised by DIRECTORY NAME (`plans`, `researches`) because
// that is the only thing that differs between them: same module workspace, same
// pre-1.1.0 flat fallback, same reason for the fallback.

import path from 'path';
import { fileExists, listDirectories } from '../../utils/fs.js';
import {
  CODE_MODULE_ID, PLANS_DIR_NAME, RESEARCHES_DIR_NAME, UNIKIT_DIR, workspaceDir,
} from '../constants.js';

/** Absolute paths of the subfolders of `root`, sorted so logs read alike everywhere. */
async function foldersUnder(root: string): Promise<string[]> {
  const names = await listDirectories(root);
  return names.sort().map(name => path.join(root, name));
}

/** Where `<dirName>` lives once the 1.1.0 relocation has run. */
function modularRoot(projectDir: string, dirName: string): string {
  return path.join(workspaceDir(projectDir, CODE_MODULE_ID), dirName);
}

/** The folders `apply` walks — always the modular location. */
async function workspaceFolders(projectDir: string, dirName: string): Promise<string[]> {
  return foldersUnder(modularRoot(projectDir, dirName));
}

/**
 * The folders `detect` judges — which is NOT always the same set.
 *
 * The runner evaluates `detect` for the WHOLE chain before it applies anything
 * (`migrations/runner.ts`, phases 1 and 3). On a project that still carries the
 * pre-1.1.0 flat workspace, `.unikit/code/<dirName>` therefore does not exist
 * yet at detect time even though the relocation is queued to run in this very
 * pass, and probing only the modular root would report "nothing to do" while
 * doing it is exactly what the run owes. A version-pending project is carried
 * by the version half regardless; the one this rescues is the project whose
 * stamp says current while its disk says otherwise — the case the runner ORs
 * the two halves for in the first place.
 *
 * The fallback is gated on the modular root being ABSENT, which is verbatim the
 * relocation's own destination guard. When both roots exist the flat copy is a
 * `logWarn` leftover that no step will ever touch, and reporting it as pending
 * would strand the project at exit 8 with nothing able to clear it.
 */
async function detectableWorkspaceFolders(
  projectDir: string,
  dirName: string,
): Promise<string[]> {
  const modular = modularRoot(projectDir, dirName);
  if (await fileExists(modular)) return foldersUnder(modular);
  return foldersUnder(path.join(projectDir, UNIKIT_DIR, dirName));
}

/** The plan folders `apply` walks. */
export async function planFolders(projectDir: string): Promise<string[]> {
  return workspaceFolders(projectDir, PLANS_DIR_NAME);
}

/** The plan folders `detect` judges — see {@link detectableWorkspaceFolders}. */
export async function detectableFolders(projectDir: string): Promise<string[]> {
  return detectableWorkspaceFolders(projectDir, PLANS_DIR_NAME);
}

/** The research folders `apply` walks. */
export async function researchFolders(projectDir: string): Promise<string[]> {
  return workspaceFolders(projectDir, RESEARCHES_DIR_NAME);
}

/** The research folders `detect` judges — see {@link detectableWorkspaceFolders}. */
export async function detectableResearchFolders(projectDir: string): Promise<string[]> {
  return detectableWorkspaceFolders(projectDir, RESEARCHES_DIR_NAME);
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
