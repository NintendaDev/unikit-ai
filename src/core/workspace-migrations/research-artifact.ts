// Research-artifact migration — the three-file research folder becomes one manifest.
//
// It RENAMES rather than interprets. `RESEARCH_RESULT.md` becomes `RESEARCH.md`
// and `RESEARCH_SOURCE.md` becomes `SOURCE.md`, because a rename cannot lose a
// byte. `RESEARCH_BRIEF.md` is left exactly where it is: an earlier revision
// took it apart by matching section headings against a fixed English list, and
// the skill that wrote those briefs required the headings to be translated
// whenever `language.artifacts` was not English — so in a non-English project
// nothing matched, nothing was carried across, and the brief was deleted all
// the same. This step now deletes nothing at all, and the one destructive
// operation it used to own is gone with it.
//
// Two rules still govern it, and both are ways to lose data:
//
//   1. `apply` can be entered at `detect === false` (the runner ORs the version
//      half with `detect` — see `migrations/runner.ts`), so every half below
//      re-checks the SHAPE of the folder itself and returns without writing
//      when there is nothing to do.
//   2. A rename happens only into a name that is free. Both halves check, and
//      a collision is a `logWarn` skip rather than an overwrite.
//
// TWO THINGS DIFFER from the plan step, and both are deliberate:
//
//   - There is NO SELECTIVITY. The plan merge skips completed folders; research
//     has no notion of completeness to express that with, so by DEC-8 every
//     folder migrates on the first `update` — no lazy mode. A lazy mode would
//     owe every reader a compatibility branch FOREVER, since under it the moment
//     "all projects have migrated" never arrives.
//   - `## Active Summary` is written UNCONDITIONALLY, brief or no brief. The
//     section is the hashed object and the registry generator's input, not a
//     derivative of the brief: a folder left without it fails Integrity check 7
//     on the first `/unikit-explore` save, reports `drift unknown` forever, and
//     shows up as a nameless row in the `/unikit-plan` question — three failures
//     far away from this one cause.
//
// The `## Active Summary` half lives in `research-artifact-summary.ts`.

import path from 'path';
import { fileExists, movePath, readTextFile, writeTextFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';
import {
  LEGACY_RESEARCH_BRIEF_FILE, LEGACY_RESEARCH_RESULT_FILE,
  LEGACY_RESEARCH_SOURCE_FILE, MANIFEST_CREATED_FIELD, MANIFEST_UPDATED_FIELD,
  MIGRATION_SINCE_RESEARCH_MANIFEST, RESEARCH_ACTIVE_SUMMARY_START, RESEARCH_DATE_FIELD,
  RESEARCH_LIFECYCLE_ACTIVE, RESEARCH_LIFECYCLE_FIELD,
  RESEARCH_MANIFEST_FILE, RESEARCH_SESSIONS_END, RESEARCH_SESSIONS_HEADING,
  RESEARCH_SESSIONS_START, RESEARCH_SOURCE_FILE, RESEARCH_STATUS_FIELD,
} from '../constants.js';
import type { Migration } from '../migrations/types.js';
import type { WorkspaceMigrationContext } from './context.js';
import { fieldValue, findField, headerEnd, insertPoint, scanLines } from './markdown.js';
import {
  detectableResearchFolders, folderDatePrefix, researchFolders,
} from './workspace-folders.js';
import {
  buildActiveSummary, insertSummary, summaryBlock,
} from './research-artifact-summary.js';

const LOG_TAG = 'research:migrate';

// The two banners deliberately do NOT share a wording, and the split is by the
// one thing that changes what the reader should DO: whether a brief is sitting
// in the folder holding the content this stub is missing. Telling someone the
// folder "was migrated without a brief" while the file is right there sends
// them looking for something that is not lost; telling someone to fold in a
// brief that never existed sends them looking for a file that never was.
//
// English, like every other string in `src/` — the project keeps source text
// English-only (`test-skills.sh` Part 14) even where the artifact it lands in is
// authored in another language.

/** Banner for a folder whose brief is still on disk, unread and uncopied. */
const BANNER_BRIEF_KEPT = '> Only `Topic:` is filled in, taken from the title. RESEARCH_BRIEF.md was\n'
  + '> left untouched in this folder and its content was NOT copied here — carry\n'
  + '> it over by hand, or rewrite this section on the next /unikit-explore\n'
  + '> session, and delete the brief yourself once you have.';

/** Banner for a folder that had no brief — it names the real reason, not the generic one. */
const BANNER_NO_BRIEF = '> This folder was migrated without RESEARCH_BRIEF.md — only `Topic:`, taken\n'
  + '> from the title, is filled in. Bring the section in line with REQ-1 on the\n'
  + '> next /unikit-explore session.';

/** The manifest's H1 text — the only title every folder is guaranteed to have. */
function manifestTitle(body: string): string {
  for (const { text, fenced } of scanLines(body)) {
    if (!fenced && /^#\s/.test(text)) return text.replace(/\r$/, '').replace(/^#\s+/, '').trim();
  }
  return '';
}

/**
 * Normalize the header: `Date:` → `Created:`, backfill `Updated:` and `Lifecycle:`.
 *
 * `Status:` is NOT TOUCHED in any branch. It carries completeness
 * (`completed | in-progress | needs-follow-up`); `Lifecycle:` is the new and
 * SEPARATE axis of currency. Renaming the first would silently kill the
 * `/unikit-plan` registry filter, which answers "no researches" rather than an
 * error when the field it greps for is gone (REQ-5, D-6).
 */
function normalizeHeader(body: string, base: string): { body: string; changed: boolean } {
  const lines = body.split('\n');
  let changed = false;
  const rescan = (): number => headerEnd(lines.join('\n'));

  // (a) `Date:` → `Created:` — or dropped when `Created:` already carries it.
  let end = rescan();
  const dateAt = findField(lines, end, RESEARCH_DATE_FIELD);
  if (dateAt !== -1 && findField(lines, end, MANIFEST_CREATED_FIELD) !== -1) {
    logWarn(LOG_TAG, `${base}: both ${RESEARCH_DATE_FIELD} and `
      + `${MANIFEST_CREATED_FIELD} present — ${RESEARCH_DATE_FIELD} dropped`);
    lines.splice(dateAt, 1);
    changed = true;
  } else if (dateAt !== -1) {
    // Sliced by the key's own length rather than matched by a regex built from
    // it: the constants carry their colon, and re-deriving a pattern from a
    // constant is one more place the two spellings could part ways.
    lines[dateAt] = MANIFEST_CREATED_FIELD + lines[dateAt].slice(RESEARCH_DATE_FIELD.length);
    changed = true;
  }

  // (b) neither present — the folder name is the last record of when this began.
  end = rescan();
  if (findField(lines, end, MANIFEST_CREATED_FIELD) === -1) {
    const fromName = folderDatePrefix(base);
    if (fromName === null) {
      logWarn(LOG_TAG, `${base}: creation date not recoverable `
        + `— ${MANIFEST_CREATED_FIELD} omitted`);
    } else {
      lines.splice(insertPoint(lines, end), 0, `${MANIFEST_CREATED_FIELD} ${fromName}`);
      changed = true;
    }
  }

  // (c) `Updated:` seeds from `Created:` — freshness means "last confirmed".
  end = rescan();
  const created = findField(lines, end, MANIFEST_CREATED_FIELD);
  if (created !== -1 && findField(lines, end, MANIFEST_UPDATED_FIELD) === -1) {
    lines.splice(created + 1, 0,
      `${MANIFEST_UPDATED_FIELD} ${fieldValue(lines[created], MANIFEST_CREATED_FIELD)}`);
    changed = true;
  }

  // (d) `Lifecycle:` — the new axis, seeded active, right below `Status:`.
  end = rescan();
  if (findField(lines, end, RESEARCH_LIFECYCLE_FIELD) === -1) {
    const status = findField(lines, end, RESEARCH_STATUS_FIELD);
    lines.splice(status === -1 ? insertPoint(lines, end) : status + 1, 0,
      `${RESEARCH_LIFECYCLE_FIELD} ${RESEARCH_LIFECYCLE_ACTIVE}`);
    changed = true;
  }

  if (changed) logInfo(LOG_TAG, `${base}: header normalized (Created/Updated/Lifecycle)`);
  return { body: lines.join('\n'), changed };
}

/**
 * The append-only session log, seeded with the migration's own entry.
 *
 * The first entry is written non-empty on purpose: an append-only log that
 * starts out empty is indistinguishable from one whose history was wiped. It is
 * also why this half is not cosmetic — the continuation cycle appends BEFORE the
 * closing marker and has no "the section does not exist yet" branch, while "no
 * section" is the state of every folder this migration touches.
 */
function sessionsBlock(created: string): string {
  const stamp = created === '' ? '' : `${created} — `;
  return `${RESEARCH_SESSIONS_HEADING}\n${RESEARCH_SESSIONS_START}\n\n`
    + `### ${stamp}migrated from the three-file format\n`
    + '- What changed: RESULT was renamed to RESEARCH.md and SOURCE to SOURCE.md by\n'
    + '  `research-1-to-2-manifest-merge`. RESEARCH_BRIEF.md, if the folder had one, was\n'
    + '  left untouched and its content was NOT copied into `## Active Summary`.\n'
    + '- Gate: not run — a rename is mechanical, not a research session.\n\n'
    + `${RESEARCH_SESSIONS_END}\n`;
}

/** Merge one research folder: rename the two files it can, header, sessions, summary. */
async function mergeOneResearch(folder: string): Promise<void> {
  const base = path.basename(folder);
  const manifest = path.join(folder, RESEARCH_MANIFEST_FILE);
  const result = path.join(folder, LEGACY_RESEARCH_RESULT_FILE);
  const brief = path.join(folder, LEGACY_RESEARCH_BRIEF_FILE);

  // (1) rename half
  if (await fileExists(result)) {
    if (await fileExists(manifest)) {
      logWarn(LOG_TAG, `skip ${base}: both ${LEGACY_RESEARCH_RESULT_FILE} and `
        + `${RESEARCH_MANIFEST_FILE} exist — merge by hand`);
      return;
    }
    await movePath(result, manifest);
    logInfo(LOG_TAG, `${base}: ${LEGACY_RESEARCH_RESULT_FILE} -> ${RESEARCH_MANIFEST_FILE}`);
  }

  const legacySource = path.join(folder, LEGACY_RESEARCH_SOURCE_FILE);
  const source = path.join(folder, RESEARCH_SOURCE_FILE);
  if ((await fileExists(legacySource)) && !(await fileExists(source))) {
    await movePath(legacySource, source);
    logInfo(LOG_TAG, `${base}: ${LEGACY_RESEARCH_SOURCE_FILE} -> ${RESEARCH_SOURCE_FILE}`);
  }

  // Halves 2-4 share one gate: the manifest has to be readable to be edited.
  const original = await readTextFile(manifest);
  if (original === null) return;

  // (2) header half
  const header = normalizeHeader(original, base);
  let body = header.body;
  let changed = header.changed;

  // (3) sessions half — every folder, whether or not it ever had a brief.
  if (!body.includes(RESEARCH_SESSIONS_START)) {
    const headerLines = body.split('\n');
    const created = findField(headerLines, headerEnd(body), MANIFEST_CREATED_FIELD);
    const stamp = created === -1 ? '' : fieldValue(headerLines[created], MANIFEST_CREATED_FIELD);
    body = `${body.replace(/\s*$/, '')}\n\n${sessionsBlock(stamp)}`;
    changed = true;
  }

  // (4) summary half. The brief is NOT opened here — not to be split, not to be
  // measured, not to be deleted. It is a document this step cannot parse safely
  // (see `research-artifact-summary.ts` for the measurement that settled it), and
  // the section below is owed to every folder whether or not one exists.
  const briefPresent = await fileExists(brief);

  if (!body.includes(RESEARCH_ACTIVE_SUMMARY_START)) {
    body = insertSummary(body, summaryBlock(
      buildActiveSummary(manifestTitle(body)),
      briefPresent ? BANNER_BRIEF_KEPT : BANNER_NO_BRIEF,
    ));
    changed = true;
    logInfo(LOG_TAG, `${base}: ## Active Summary seeded from the title`);
  }

  // Printed on the run that migrates the folder — and ONLY on that run. Once the
  // version is stamped `detect` answers false and this step is skipped entirely,
  // so a log line cannot be what reminds anyone later. The durable notice is the
  // banner written into the manifest above: it stays in the file until a human
  // rewrites the section, which is precisely the event that makes it untrue.
  if (briefPresent) {
    logWarn(LOG_TAG, `${base}: ${LEGACY_RESEARCH_BRIEF_FILE} kept as-is — its content was `
      + 'NOT copied into ## Active Summary. Carry it over by hand or on the next '
      + '/unikit-explore session, then delete the brief yourself');
  }

  if (!changed) return;
  await writeTextFile(manifest, body);
}

/**
 * Fold `RESEARCH_RESULT.md` + `RESEARCH_BRIEF.md` + `RESEARCH_SOURCE.md` into a
 * single `RESEARCH.md` manifest inside every research folder.
 */
const researchManifestMergeMigration: Migration<WorkspaceMigrationContext> = {
  id: 'research-1-to-2-manifest-merge',
  since: MIGRATION_SINCE_RESEARCH_MANIFEST,

  // Mirrored branch-for-branch against `mergeOneResearch`: every folder shape
  // that `apply` walks past with a `logWarn` answers `false` here. A shape
  // reported as pending that `apply` then refuses to touch is the one way to
  // leave a project permanently pending, and `rules sync` refuses a pending
  // project with exit 8 that no `update` can clear.
  async detect({ projectDir }) {
    for (const folder of await detectableResearchFolders(projectDir)) {
      const manifest = path.join(folder, RESEARCH_MANIFEST_FILE);
      const hasResult = await fileExists(path.join(folder, LEGACY_RESEARCH_RESULT_FILE));
      const hasManifest = await fileExists(manifest);

      // Both names present is the `logWarn` skip, and it swallows every later
      // half with it — `apply` returns from that branch having done nothing, so
      // nothing about this folder may be reported as pending.
      if (hasResult && hasManifest) continue;
      if (hasResult) return true;

      if ((await fileExists(path.join(folder, LEGACY_RESEARCH_SOURCE_FILE)))
        && !(await fileExists(path.join(folder, RESEARCH_SOURCE_FILE)))) {
        return true;
      }

      if (!hasManifest) continue;
      const body = await readTextFile(manifest);
      if (body === null) continue;
      // Both halves, and the summary condition carries NO mention of the brief:
      // a folder without one still owes the section (branch 4b), and asking
      // about the brief here would lie about a migration still outstanding.
      if (!body.includes(RESEARCH_SESSIONS_START)) return true;
      if (!body.includes(RESEARCH_ACTIVE_SUMMARY_START)) return true;
    }
    return false;
  },

  async apply({ projectDir }) {
    for (const folder of await researchFolders(projectDir)) {
      // One unwritable folder must not strand the rest — and must not abort the
      // whole chain. `readTextFile` answers null on failure, but `movePath`,
      // `writeTextFile` and `removeFile` throw, `runMigrationChain` does not
      // catch, and `update`/`init` await the chain directly: a single read-only
      // or editor-locked manifest would otherwise end the run with a raw EPERM,
      // leave every later research folder unmigrated and skip the version stamp.
      try {
        await mergeOneResearch(folder);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logWarn(LOG_TAG, `skip ${path.basename(folder)}: ${reason}`);
      }
    }
  },
};

export const PROJECT_RESEARCH_ARTIFACT_MIGRATIONS: readonly Migration<WorkspaceMigrationContext>[] = [
  researchManifestMergeMigration,
];
