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
  CODE_MODULE_ID, MIGRATION_SINCE_PLAN_TIMESTAMPS, PLAN_CREATED_FIELD,
  PLAN_MANIFEST_FILE, PLAN_UPDATED_FIELD, UNIKIT_DIR, workspaceDir,
} from '../constants.js';
import type { Migration } from '../migrations/types.js';
import type { WorkspaceMigrationContext } from './context.js';
import { scanLines } from './markdown.js';
import { detectableFolders, folderDatePrefix, planFolders } from './plan-folders.js';

const LOG_TAG = 'plan:timestamps';

/** How the flat manifest names itself in a log line — it has no folder to be named by. */
const FLAT_LABEL = `${CODE_MODULE_ID}/${PLAN_MANIFEST_FILE}`;

/** Index of the first unfenced `##` heading — where the header block ends. */
function headerEnd(body: string): number {
  const scanned = scanLines(body);
  for (let i = 0; i < scanned.length; i += 1) {
    if (!scanned[i].fenced && /^##\s/.test(scanned[i].text)) return i;
  }
  return scanned.length;
}

/** Line index of the `<field>` header line, or `-1`. `field` carries its colon. */
function findField(lines: string[], end: number, field: string): number {
  for (let i = 0; i < end && i < lines.length; i += 1) {
    if (lines[i].replace(/\r$/, '').startsWith(field)) return i;
  }
  return -1;
}

/**
 * Where the missing header lines go: after the LAST `Key: value` line of the
 * header, and after the H1 when the manifest carries no fields at all.
 *
 * The fragile half is the second one — a manifest that is nothing but an H1 is
 * the shape most likely to receive the insert in the wrong place, which is why
 * the golden-guard fixture (`# fast plan`) exercises exactly it through a real
 * `update`.
 */
function insertPoint(lines: string[], end: number): number {
  for (let i = Math.min(end, lines.length) - 1; i >= 0; i -= 1) {
    if (/^[A-Za-z][^:]*:/.test(lines[i].replace(/\r$/, ''))) return i + 1;
  }
  for (let i = 0; i < end && i < lines.length; i += 1) {
    if (/^#\s/.test(lines[i])) return i + 1;
  }
  return 0;
}

/** `YYYY-MM-DD` of a file's modification time — the fallback source of a date. */
async function mtimeDate(file: string): Promise<string> {
  const { stat } = await import('fs/promises');
  return (await stat(file)).mtime.toISOString().slice(0, 10);
}

/** True when the manifest at `file` is missing either header field. */
async function needsStamp(file: string): Promise<boolean> {
  const body = await readTextFile(file);
  if (body === null) return false;
  const lines = body.split('\n');
  const end = headerEnd(body);
  return findField(lines, end, PLAN_CREATED_FIELD) === -1
    || findField(lines, end, PLAN_UPDATED_FIELD) === -1;
}

/**
 * Stamp one manifest. `label` names it in the log; `dated` is the date carried
 * by its folder name, or `null` when it has none — or has no folder at all.
 */
async function stampOneManifest(file: string, label: string, dated: string | null): Promise<void> {
  const body = await readTextFile(file);
  if (body === null) {
    logWarn(LOG_TAG, `skip ${label}: no readable manifest`);
    return;
  }

  const lines = body.split('\n');
  const end = headerEnd(body);
  const hasCreated = findField(lines, end, PLAN_CREATED_FIELD);
  const hasUpdated = findField(lines, end, PLAN_UPDATED_FIELD);
  if (hasCreated !== -1 && hasUpdated !== -1) {
    logInfo(LOG_TAG, `${label}: already stamped — skipped`);
    return;
  }

  let created: string;
  if (hasCreated !== -1) {
    created = lines[hasCreated].replace(/\r$/, '').slice(PLAN_CREATED_FIELD.length).trim();
  } else if (dated !== null) {
    created = dated;
  } else {
    // Not a rejected resolver fallback but a ONE-OFF source: REQ-14 forbids
    // reading mtime AT RESOLVE TIME, every time, because `git checkout` and a
    // fresh clone rewrite it. Read once here, the value lands in the file and
    // survives both.
    created = await mtimeDate(file);
    logWarn(LOG_TAG, `${label}: ${PLAN_CREATED_FIELD} derived from file mtime `
      + '— folder name carries no date');
  }

  const pending: string[] = [];
  if (hasCreated === -1) pending.push(`${PLAN_CREATED_FIELD} ${created}`);
  if (hasUpdated === -1) pending.push(`${PLAN_UPDATED_FIELD} ${created}`);

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
  if (findField(back, backEnd, PLAN_CREATED_FIELD) === -1
    || findField(back, backEnd, PLAN_UPDATED_FIELD) === -1) {
    logWarn(LOG_TAG, `skip ${label}: header write could not be verified`);
    return;
  }
  logInfo(LOG_TAG, `${label}: stamped ${PLAN_CREATED_FIELD} ${created} / ${PLAN_UPDATED_FIELD} ${created}`);
}

/** The flat fast-mode manifest — the second root, and the one easily lost. */
function flatManifest(projectDir: string): string {
  return path.join(workspaceDir(projectDir, CODE_MODULE_ID), PLAN_MANIFEST_FILE);
}

/**
 * The flat manifest `detect` judges — which is NOT always the one `apply` writes.
 *
 * The dual root of `detectableFolders`, owed for exactly the same reason and
 * easy to forget because this half is a single FILE rather than a directory of
 * them: the runner evaluates `detect` for the WHOLE chain before it applies
 * anything, so on a project still carrying the pre-1.1.0 flat workspace the
 * manifest is still at `.unikit/PLAN.md` and `.unikit/code/PLAN.md` does not
 * exist yet. Probing only the modular path there answers "nothing to stamp",
 * `apply` is never entered — and on a project already stamped at the current
 * version, where the version half is quiet too, the file comes out of `update`
 * unstamped while the NEXT `detect` (now seeing the relocated path) reports
 * pending. `rules sync` then answers exit 8 immediately after a clean `update`.
 *
 * Gated on the modular workspace being ABSENT, verbatim as the folder half is.
 */
async function detectableFlatManifest(projectDir: string): Promise<string> {
  const modularRoot = workspaceDir(projectDir, CODE_MODULE_ID);
  if (await fileExists(modularRoot)) return path.join(modularRoot, PLAN_MANIFEST_FILE);
  return path.join(projectDir, UNIKIT_DIR, PLAN_MANIFEST_FILE);
}

/**
 * Backfill `Created:` / `Updated:` into every plan manifest — the ones inside
 * `plans/<folder>/` and the flat fast-mode one alike.
 */
const planTimestampsMigration: Migration<WorkspaceMigrationContext> = {
  id: 'plan-2-to-3-timestamps',
  since: MIGRATION_SINCE_PLAN_TIMESTAMPS,

  async detect({ projectDir }) {
    for (const folder of await detectableFolders(projectDir)) {
      if (await needsStamp(path.join(folder, PLAN_MANIFEST_FILE))) return true;
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
        await stampOneManifest(path.join(folder, PLAN_MANIFEST_FILE), base, folderDatePrefix(base));
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
