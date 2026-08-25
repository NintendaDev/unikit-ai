// Plan-timestamp backfill — every plan manifest gains `Created:` and `Updated:`.
//
// REQ-16 moves "which plan is the latest" off the lexicographic order of folder
// names and onto the `Updated:` field. Old plans carry no such field: the plan
// manifest records no date at all today, and the only trace of when one began is
// the date prefix of its folder name (C-9). Without a one-off backfill every
// resolver would owe a compatibility chain — `Updated:` → `Created:` → folder
// prefix → mtime — which is the duplication this stage removes, moved out of the
// data and into the logic. After this step a resolver reads ONE field.
//
// THREE THINGS DIFFER from `plan-artifact.ts`, and each is deliberate:
//
//   - There is NO SELECTIVITY. The manifest merge leaves completed plans alone;
//     this one stamps them too, because `--list` and "latest by Updated" both
//     enumerate completed plans, and a plan without the field would sort
//     unpredictably rather than sort last. Named here because a missing gate
//     reads like a forgotten check.
//
//     What that costs, and why `planFile` below exists: a completed folder is
//     left in the PRE-MERGE shape forever, so its plan file is still named
//     `TASKS.md` and a `PLAN.md` never appears there. A step that knew only one
//     file name would therefore skip exactly the folders this bullet promises
//     to stamp — and warn about an unreadable manifest for each of them on
//     every run, `logWarn` not being behind the verbose gate.
//   - It walks TWO ROOTS, not one. `planFolders` returns the subfolders of
//     `plans/`, and the flat `.unikit/code/PLAN.md` is not one of them — it is
//     priority #1 in all three plan resolvers, and Phase 04 removes the file-
//     mtime branch that served it until now. Skipping it here would leave every
//     project with a fast plan without an input, and without the fallback.
//   - It NEVER renames a folder. Dateless naming applies to new plans only; the
//     three name formats coexist on disk and the resolvers tell them apart.
//
// Nothing below the header is touched: not the checklist, not
// `## Technical Context`, not `## Based on`.

import path from 'path';
import { fileExists, readTextFile, writeTextFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';
import {
  CODE_MODULE_ID, LEGACY_PLAN_TASKS_FILE, MANIFEST_CREATED_FIELD,
  MANIFEST_UPDATED_FIELD, MIGRATION_SINCE_PLAN_TIMESTAMPS, PLAN_MANIFEST_FILE,
  UNIKIT_DIR, workspaceDir,
} from '../constants.js';
import type { Migration } from '../migrations/types.js';
import type { WorkspaceMigrationContext } from './context.js';
import { fieldValue, findField, headerEnd, insertPoint } from './markdown.js';
import { detectableFolders, folderDatePrefix, planFolders } from './workspace-folders.js';

const LOG_TAG = 'plan:timestamps';

/** How the flat manifest names itself in a log line — it has no folder to be named by. */
const FLAT_LABEL = `${CODE_MODULE_ID}/${PLAN_MANIFEST_FILE}`;

/** `YYYY-MM-DD` of a file's modification time — the fallback source of a date. */
async function mtimeDate(file: string): Promise<string> {
  const { stat } = await import('fs/promises');
  return (await stat(file)).mtime.toISOString().slice(0, 10);
}

/**
 * The file inside `folder` that IS this plan — `PLAN.md`, else `TASKS.md`,
 * else `null`.
 *
 * ONE resolver, called by `detect` and by `apply`, and the reason it is one is
 * that the two run at different MOMENTS of the same pass. The runner evaluates
 * `detect` for the whole chain before it applies anything, so a folder that
 * `plan-1-to-2-manifest-merge` is about to rename still shows `TASKS.md` when
 * `detect` looks and `PLAN.md` by the time `apply` arrives. Judging one name
 * only would leave the merged manifest unstamped after a run that reported
 * success, with the NEXT `detect` declaring work pending — `rules sync` then
 * answers exit 8 straight after a clean `update`, and on a project stamped at
 * the current version the version half is quiet, so nothing clears it but a
 * second `update`.
 *
 * The ladder is the same one `isCompletedPlan` walks in `plan-artifact.ts`, and
 * for the same reason: a folder caught mid-migration must be judged on the same
 * content either way. It also settles the completed-plan case named in the
 * header — the merge leaves that folder at `TASKS.md` forever, and this is the
 * name under which it gets its stamp.
 *
 * Both names present is the merge's own refuse-to-overwrite branch; `PLAN.md`
 * wins there, exactly as every plan resolver reads it.
 */
async function planFile(folder: string): Promise<string | null> {
  const manifest = path.join(folder, PLAN_MANIFEST_FILE);
  if (await fileExists(manifest)) return manifest;
  const tasks = path.join(folder, LEGACY_PLAN_TASKS_FILE);
  if (await fileExists(tasks)) return tasks;
  return null;
}

/** True when the file at `file` is missing either header field. */
async function needsStamp(file: string): Promise<boolean> {
  const body = await readTextFile(file);
  if (body === null) return false;
  const lines = body.split('\n');
  const end = headerEnd(body);
  return findField(lines, end, MANIFEST_CREATED_FIELD) === -1
    || findField(lines, end, MANIFEST_UPDATED_FIELD) === -1;
}

/** True when the plan inside `folder` still owes its two header fields. */
async function folderNeedsStamp(folder: string): Promise<boolean> {
  const file = await planFile(folder);
  return file === null ? false : needsStamp(file);
}

/**
 * Stamp one manifest. `label` names it in the log; `dated` is the date carried
 * by its folder name, or `null` when it has none — or has no folder at all.
 */
async function stampOneManifest(file: string, label: string, dated: string | null): Promise<void> {
  const body = await readTextFile(file);
  if (body === null) {
    // `file` was resolved by `planFile` (or is the flat manifest, checked to
    // exist), so this is a genuine read failure and not the ordinary shape of a
    // folder that never had a `PLAN.md` — that one no longer reaches here.
    logWarn(LOG_TAG, `skip ${label}: no readable plan file`);
    return;
  }

  const lines = body.split('\n');
  const end = headerEnd(body);
  const hasCreated = findField(lines, end, MANIFEST_CREATED_FIELD);
  const hasUpdated = findField(lines, end, MANIFEST_UPDATED_FIELD);
  if (hasCreated !== -1 && hasUpdated !== -1) {
    logInfo(LOG_TAG, `${label}: already stamped — skipped`);
    return;
  }

  let created: string;
  if (hasCreated !== -1) {
    created = fieldValue(lines[hasCreated], MANIFEST_CREATED_FIELD);
  } else if (dated !== null) {
    created = dated;
  } else {
    // Not a rejected resolver fallback but a ONE-OFF source: REQ-14 forbids
    // reading mtime AT RESOLVE TIME, every time, because `git checkout` and a
    // fresh clone rewrite it. Read once here, the value lands in the file and
    // survives both.
    created = await mtimeDate(file);
    logWarn(LOG_TAG, `${label}: ${MANIFEST_CREATED_FIELD} derived from file mtime `
      + '— folder name carries no date');
  }

  const pending: string[] = [];
  if (hasCreated === -1) pending.push(`${MANIFEST_CREATED_FIELD} ${created}`);
  if (hasUpdated === -1) pending.push(`${MANIFEST_UPDATED_FIELD} ${created}`);

  const at = insertPoint(lines, end);
  // A manifest with no header fields gets its block separated from whatever
  // follows: without the blank line the new fields glue onto the next paragraph.
  const needsBlank = at < lines.length && lines[at].trim() !== '';
  lines.splice(at, 0, ...pending, ...(needsBlank ? [''] : []));
  await writeTextFile(file, lines.join('\n'));

  const readback = await readTextFile(file);
  if (readback === null) {
    logWarn(LOG_TAG, `skip ${label}: header write could not be verified`);
    return;
  }
  const back = readback.split('\n');
  const backEnd = headerEnd(readback);
  if (findField(back, backEnd, MANIFEST_CREATED_FIELD) === -1
    || findField(back, backEnd, MANIFEST_UPDATED_FIELD) === -1) {
    logWarn(LOG_TAG, `skip ${label}: header write could not be verified`);
    return;
  }
  logInfo(LOG_TAG, `${label}: stamped ${MANIFEST_CREATED_FIELD} ${created} / ${MANIFEST_UPDATED_FIELD} ${created}`);
}

/** The flat fast-mode manifest — the second root, and the one easily lost. */
function flatManifest(projectDir: string): string {
  return path.join(workspaceDir(projectDir, CODE_MODULE_ID), PLAN_MANIFEST_FILE);
}

/**
 * The flat manifest `detect` judges — which is NOT always the one `apply` writes.
 *
 * The dual root of `detectableFolders`, owed for the same reason and easy to get
 * subtly wrong because this half is a single FILE rather than a directory of
 * them. The runner evaluates `detect` for the WHOLE chain before it applies
 * anything, so on a project still carrying the pre-1.1.0 flat workspace the
 * manifest is at `.unikit/PLAN.md` and the modular one does not exist yet.
 *
 * The gate is the modular MANIFEST, not the modular workspace DIRECTORY, and the
 * difference is the whole point:
 *
 *  - Gating on the directory misses the partially-migrated shape — modular root
 *    already created, fast plan still flat, not one plan FOLDER to carry the
 *    detect. There `detect` answers false, `apply` never runs, and the
 *    relocation moves the file in that very pass; on a project stamped at the
 *    current version the version half is quiet too, so the manifest leaves
 *    `update` unstamped and `rules sync` answers exit 8 right after a clean run.
 *  - Probing BOTH unconditionally would be worse in the other direction. When
 *    both files exist the relocation refuses to overwrite and the flat copy is a
 *    leftover no step will ever touch, so reporting it pending would strand the
 *    project at exit 8 with nothing able to clear it — verbatim the trap
 *    `detectableFolders` documents.
 *
 * Modular file present → judge it alone. Absent → judge the flat one, which the
 * relocation will move into place before `apply` reaches it.
 */
async function detectableFlatManifest(projectDir: string): Promise<string> {
  const modular = path.join(workspaceDir(projectDir, CODE_MODULE_ID), PLAN_MANIFEST_FILE);
  if (await fileExists(modular)) return modular;
  return path.join(projectDir, UNIKIT_DIR, PLAN_MANIFEST_FILE);
}

/**
 * Backfill `Created:` / `Updated:` into every plan on disk — the manifest
 * inside each `plans/<folder>/` (under whichever of the two names that folder
 * currently carries, see {@link planFile}) and the flat fast-mode one alike.
 */
const planTimestampsMigration: Migration<WorkspaceMigrationContext> = {
  id: 'plan-2-to-3-timestamps',
  since: MIGRATION_SINCE_PLAN_TIMESTAMPS,

  // Both halves ask `planFile` which file a folder's plan IS, rather than
  // assuming the merged name. Assume it in `detect` and the folder the merge
  // renames LATER IN THIS PASS is never reported; assume it in `apply` and the
  // completed folder the merge never renames is never stamped. The two
  // assumptions fail in opposite directions from one shared cause, which is why
  // there is one resolver and not two conditions.
  async detect({ projectDir }) {
    for (const folder of await detectableFolders(projectDir)) {
      if (await folderNeedsStamp(folder)) return true;
    }
    return needsStamp(await detectableFlatManifest(projectDir));
  },

  async apply({ projectDir }) {
    for (const folder of await planFolders(projectDir)) {
      // One unwritable manifest must not strand the rest — `writeTextFile`
      // throws, `runMigrationChain` does not catch, and `update`/`init` await
      // the chain directly, so an editor-locked PLAN.md would otherwise end the
      // run with a raw EPERM and skip the version stamp.
      try {
        const base = path.basename(folder);
        const file = await planFile(folder);
        // A folder carrying no plan file at all is not a failure to report: it
        // is a directory that is not a plan. Warning here put a line on stderr
        // for every completed folder on every run, indistinguishable from a
        // real read error.
        if (file === null) {
          logInfo(LOG_TAG, `${base}: no plan file — skipped`);
          continue;
        }
        await stampOneManifest(file, base, folderDatePrefix(base));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logWarn(LOG_TAG, `skip ${path.basename(folder)}: ${reason}`);
      }
    }

    const flat = flatManifest(projectDir);
    if (!(await fileExists(flat))) return;
    try {
      // `null` is not a degradation here — the flat manifest never had a dated
      // name to lose. mtime is its only possible source.
      await stampOneManifest(flat, FLAT_LABEL, null);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logWarn(LOG_TAG, `skip ${FLAT_LABEL}: ${reason}`);
    }
  },
};

export const PROJECT_PLAN_TIMESTAMP_MIGRATIONS: readonly Migration<WorkspaceMigrationContext>[] = [
  planTimestampsMigration,
];
