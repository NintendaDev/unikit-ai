// Research-artifact migration — the three-file research folder becomes one manifest.
//
// The same three rules govern it that govern `plan-artifact.ts`, and they are
// repeated here rather than referenced because each one is a way to lose data:
//
//   1. It MERGES CONTENT rather than relocating a path. A whole brief is taken
//      apart into an `## Active Summary` section and two adaptive artifacts.
//   2. `apply` can be entered at `detect === false` (the runner ORs the version
//      half with `detect` — see `migrations/runner.ts`), so every half below
//      re-checks the SHAPE of the folder itself and returns without writing
//      when there is nothing to do.
//   3. Deletion of the brief happens ONLY after the manifest write has been
//      read back and verified. Reverse those two and an interrupted process is
//      the one way to lose the brief's content for good.
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
// The fold half — what becomes of the brief — lives in `research-artifact-fold.ts`.

import path from 'path';
import {
  fileExists, listDirectories, movePath, readTextFile, removeFile, writeTextFile,
} from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';
import {
  CODE_MODULE_ID, LEGACY_RESEARCH_BRIEF_FILE, LEGACY_RESEARCH_RESULT_FILE,
  LEGACY_RESEARCH_SOURCE_FILE, MIGRATION_SINCE_RESEARCH_MANIFEST,
  RESEARCHES_DIR_NAME, RESEARCH_ACTIVE_SUMMARY_END, RESEARCH_ACTIVE_SUMMARY_START,
  RESEARCH_CONTRACTS_FILE, RESEARCH_DEPENDENCY_GRAPH_FILE, RESEARCH_MANIFEST_FILE,
  RESEARCH_SESSIONS_END, RESEARCH_SESSIONS_HEADING, RESEARCH_SESSIONS_START,
  RESEARCH_SOURCE_FILE, UNIKIT_DIR, researchesDir,
} from '../constants.js';
import type { Migration } from '../migrations/types.js';
import type { WorkspaceMigrationContext } from './context.js';
import { scanLines } from './markdown.js';
import { folderDatePrefix } from './plan-folders.js';
import {
  buildActiveSummary, foldDependencyGraph, insertSummary, summaryBlock, writeContracts,
} from './research-artifact-fold.js';

const LOG_TAG = 'research:migrate';

// The two banners deliberately do NOT share a wording. Each names the state its
// own branch produced, because "assembled mechanically" over a folder that never
// had a brief would send a reader looking for a file that does not exist.
//
// English, like every other string in `src/` — the project keeps source text
// English-only (`test-skills.sh` Part 14) even where the artifact it lands in is
// authored in another language.

/** Banner for a summary assembled out of a brief — it needs a human pass, not repair. */
const BANNER_FROM_BRIEF = '> This section was assembled mechanically from RESEARCH_BRIEF.md.\n'
  + '> Bring it in line with REQ-1 (one fact, one owning section) on the next\n'
  + '> /unikit-explore session.';

/** Banner for a folder that had no brief — it names the real reason, not the generic one. */
const BANNER_NO_BRIEF = '> This folder was migrated without RESEARCH_BRIEF.md — only `Topic:`, taken\n'
  + '> from the title, is filled in. Bring the section in line with REQ-1 on the\n'
  + '> next /unikit-explore session.';

/** Absolute paths of the subfolders of `root`, sorted so logs read alike everywhere. */
async function foldersUnder(root: string): Promise<string[]> {
  const names = await listDirectories(root);
  return names.sort().map(name => path.join(root, name));
}

/** The research folders `apply` walks — always the modular location. */
async function researchFolders(projectDir: string): Promise<string[]> {
  return foldersUnder(researchesDir(projectDir, CODE_MODULE_ID));
}

/**
 * The research folders `detect` judges — which is NOT always the same set.
 *
 * Verbatim the dual root of `plan-artifact.ts`, for verbatim the same reason:
 * the runner evaluates `detect` for the WHOLE chain before it applies anything,
 * so on a project still carrying the pre-1.1.0 flat workspace
 * `.unikit/code/researches` does not exist yet at detect time even though the
 * relocation is queued to run in this very pass. The fallback is gated on the
 * modular root being ABSENT — when both exist the flat copy is a leftover no
 * step will touch, and reporting it would strand the project at exit 8.
 */
async function detectableResearchFolders(projectDir: string): Promise<string[]> {
  const modularRoot = researchesDir(projectDir, CODE_MODULE_ID);
  if (await fileExists(modularRoot)) return foldersUnder(modularRoot);
  return foldersUnder(path.join(projectDir, UNIKIT_DIR, RESEARCHES_DIR_NAME));
}

/** Index of the first unfenced `##` heading — where the header block ends. */
function headerEnd(body: string): number {
  const scanned = scanLines(body);
  for (let i = 0; i < scanned.length; i += 1) {
    if (!scanned[i].fenced && /^##\s/.test(scanned[i].text)) return i;
  }
  return scanned.length;
}

/** Line index of the `<key>:` header field, or `-1`. */
function findField(lines: string[], end: number, key: string): number {
  for (let i = 0; i < end && i < lines.length; i += 1) {
    if (lines[i].replace(/\r$/, '').startsWith(`${key}:`)) return i;
  }
  return -1;
}

/** The value carried by a `Key: value` line. */
function fieldValue(line: string): string {
  return line.replace(/\r$/, '').replace(/^[^:]*:\s*/, '').trim();
}

/** Where a newly created header field goes: after the last one, else after the H1. */
function headerInsertPoint(lines: string[], end: number): number {
  for (let i = Math.min(end, lines.length) - 1; i >= 0; i -= 1) {
    if (/^[A-Za-z][^:]*:/.test(lines[i].replace(/\r$/, ''))) return i + 1;
  }
  for (let i = 0; i < end && i < lines.length; i += 1) {
    if (/^#\s/.test(lines[i])) return i + 1;
  }
  return 0;
}

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
  const dateAt = findField(lines, end, 'Date');
  if (dateAt !== -1 && findField(lines, end, 'Created') !== -1) {
    logWarn(LOG_TAG, `${base}: both Date: and Created: present — Date: dropped`);
    lines.splice(dateAt, 1);
    changed = true;
  } else if (dateAt !== -1) {
    lines[dateAt] = lines[dateAt].replace(/^Date:/, 'Created:');
    changed = true;
  }

  // (b) neither present — the folder name is the last record of when this began.
  end = rescan();
  if (findField(lines, end, 'Created') === -1) {
    const fromName = folderDatePrefix(base);
    if (fromName === null) {
      logWarn(LOG_TAG, `${base}: creation date not recoverable — Created: omitted`);
    } else {
      lines.splice(headerInsertPoint(lines, end), 0, `Created: ${fromName}`);
      changed = true;
    }
  }

  // (c) `Updated:` seeds from `Created:` — freshness means "last confirmed".
  end = rescan();
  const created = findField(lines, end, 'Created');
  if (created !== -1 && findField(lines, end, 'Updated') === -1) {
    lines.splice(created + 1, 0, `Updated: ${fieldValue(lines[created])}`);
    changed = true;
  }

  // (d) `Lifecycle:` — the new axis, seeded active, right below `Status:`.
  end = rescan();
  if (findField(lines, end, 'Lifecycle') === -1) {
    const status = findField(lines, end, 'Status');
    lines.splice(status === -1 ? headerInsertPoint(lines, end) : status + 1, 0, 'Lifecycle: active');
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
    + `- What changed: RESULT + BRIEF merged into this manifest by \`research-1-to-2-manifest-merge\`.\n`
    + '- Gate: not run — the merge is mechanical, not a research session.\n\n'
    + `${RESEARCH_SESSIONS_END}\n`;
}

/** Occurrences of `marker` in `body` — both pairs must appear exactly once. */
function markerCount(body: string, marker: string): number {
  return body.split(marker).length - 1;
}

/** True when the manifest carries both marker pairs once and a non-empty summary. */
function manifestVerified(body: string): boolean {
  for (const marker of [
    RESEARCH_ACTIVE_SUMMARY_START, RESEARCH_ACTIVE_SUMMARY_END,
    RESEARCH_SESSIONS_START, RESEARCH_SESSIONS_END,
  ]) {
    if (markerCount(body, marker) !== 1) return false;
  }
  const start = body.indexOf(RESEARCH_ACTIVE_SUMMARY_START) + RESEARCH_ACTIVE_SUMMARY_START.length;
  return body.slice(start, body.indexOf(RESEARCH_ACTIVE_SUMMARY_END)).trim() !== '';
}

/** Merge one research folder: rename, header, sessions, summary, verify-then-delete. */
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
    const end = headerEnd(body);
    const created = findField(body.split('\n'), end, 'Created');
    const stamp = created === -1 ? '' : fieldValue(body.split('\n')[created]);
    body = `${body.replace(/\s*$/, '')}\n\n${sessionsBlock(stamp)}`;
    changed = true;
  }

  // (4) summary half — branching on WHERE THE BODY COMES FROM, not on whether a
  // brief exists. Both branches write the section; only 4a can delete anything.
  const briefBody = (await fileExists(brief)) ? await readTextFile(brief) : null;
  const fromBrief = briefBody !== null;
  let contracts = 0;
  let graphWritten = false;

  if (body.includes(RESEARCH_ACTIVE_SUMMARY_START)) {
    if (fromBrief) {
      logWarn(LOG_TAG, `skip ${base}: manifest already folded — fold `
        + `${LEGACY_RESEARCH_BRIEF_FILE} by hand`);
      if (changed) await writeTextFile(manifest, body);
      return;
    }
  } else {
    if (fromBrief) {
      contracts = await writeContracts(folder, briefBody);
      if (contracts > 0) {
        logInfo(LOG_TAG, `${base}: heavy sections -> ${RESEARCH_CONTRACTS_FILE} (${contracts} sections)`);
      }
      graphWritten = await foldDependencyGraph(folder, briefBody);
      if (graphWritten) {
        logInfo(LOG_TAG, `${base}: dependency graph -> ${RESEARCH_DEPENDENCY_GRAPH_FILE}`);
      }
    } else if (await fileExists(brief)) {
      logWarn(LOG_TAG, `skip ${base}: ${LEGACY_RESEARCH_BRIEF_FILE} could not be read — left in place`);
      if (changed) await writeTextFile(manifest, body);
      return;
    } else {
      logWarn(LOG_TAG, `${base}: no ${LEGACY_RESEARCH_BRIEF_FILE} `
        + '— Active Summary seeded from the title only');
    }

    const inner = buildActiveSummary(briefBody, manifestTitle(body));
    body = insertSummary(body, summaryBlock(inner, fromBrief ? BANNER_FROM_BRIEF : BANNER_NO_BRIEF));
    changed = true;
    if (fromBrief) logInfo(LOG_TAG, `${base}: brief folded into ## Active Summary`);
  }

  if (!changed) return;
  await writeTextFile(manifest, body);

  // (5) verify-then-delete — never the other way round.
  const readback = await readTextFile(manifest);
  if (readback === null || !manifestVerified(readback)) {
    logWarn(LOG_TAG, fromBrief
      ? `skip ${base}: manifest write not verified — ${LEGACY_RESEARCH_BRIEF_FILE} left in place`
      : `skip ${base}: manifest write not verified`);
    return;
  }
  for (const [written, file] of [
    [contracts > 0, RESEARCH_CONTRACTS_FILE], [graphWritten, RESEARCH_DEPENDENCY_GRAPH_FILE],
  ] as const) {
    if (!written) continue;
    const artifact = await readTextFile(path.join(folder, file));
    if (artifact === null || artifact.trim() === '') {
      logWarn(LOG_TAG, `skip ${base}: ${file} write not verified — `
        + `${LEGACY_RESEARCH_BRIEF_FILE} left in place`);
      return;
    }
  }

  if (!fromBrief) return;
  await removeFile(brief);
  logInfo(LOG_TAG, `${base}: ${LEGACY_RESEARCH_BRIEF_FILE} folded and removed`);
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
