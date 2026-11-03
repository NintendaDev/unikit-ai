// --- Bridge notes lifecycle ---
//
// `.unikit/bridge-notes/<bridge id>.md` is the project's log of findings about ONE engine bridge it
// actually runs against. A finding is a statement about one bridge: "this call reports success on a
// broken artifact" says nothing about a different bridge, and carrying it across a switch would be
// worse than losing it — it would look like evidence. The owner is therefore part of the file name.
//
// So the installer parks the notes instead of deleting them. A bridge that leaves the selection has its
// active file renamed into `bridge-notes/archive/<id>.md`; a bridge that comes back has its own archive
// restored. The installer NEVER writes note content: the file is authored by `/unikit-bridge-trap` and
// curated by `/unikit-bridge-audit`, and the only operation here is a rename.
//
// Invariant: one file per bridge — active OR archived, never both. It holds on every path a completed
// run can take. The one exception is an interrupted run, which leaves an extra archive behind:
// restoring picks the newest and KEEPS the rest, because merging two sessions' findings is a curation
// call and not the installer's to make. That state is announced by a WARN, never silent.

import path from 'path';
import {
  BRIDGE_NOTES_EXTENSION, bridgeNotesArchiveDir, bridgeNotesDir, bridgeNotesPath,
} from '../constants-bridges.js';
import { fileExists, listFiles, movePath } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

const LOG_COMPONENT = 'swapBridgeNotes';

/**
 * `<id>.md` — the unindexed slot — or, once that slot is taken, `<id>.<index>.md`. A taken slot means a
 * previous run was interrupted between the two renames, so the existing file is evidence of a real
 * session: overwriting it is the one thing this module must never do.
 */
function archiveName(bridgeId: string, index: number): string {
  return index === 0
    ? `${bridgeId}${BRIDGE_NOTES_EXTENSION}`
    : `${bridgeId}.${index}${BRIDGE_NOTES_EXTENSION}`;
}

/**
 * Every archived notes file belonging to `bridgeId`, most recent slot last.
 *
 * Ordering is by index: the unindexed name is slot 0, `.1` is slot 1, and so on, which matches the order
 * {@link parkActiveNotes} allocates them in. The highest index is therefore the newest session.
 */
async function listArchivesFor(archiveDir: string, bridgeId: string): Promise<string[]> {
  const matches: { name: string; index: number }[] = [];

  for (const name of await listFiles(archiveDir)) {
    if (!name.startsWith(bridgeId) || !name.endsWith(BRIDGE_NOTES_EXTENSION)) continue;

    const middle = name.slice(bridgeId.length, name.length - BRIDGE_NOTES_EXTENSION.length);
    if (middle === '') {
      matches.push({ name, index: 0 });
      continue;
    }
    const index = Number(middle.slice(1));
    if (middle.startsWith('.') && Number.isInteger(index) && index > 0) {
      matches.push({ name, index });
    }
  }

  return matches.sort((a, b) => a.index - b.index).map(m => m.name);
}

/**
 * Rename the active notes of a bridge into its archive slot. Returns the name it landed under, or
 * `null` when there was nothing to park.
 */
async function parkActiveNotes(projectDir: string, bridgeId: string): Promise<string | null> {
  const activePath = bridgeNotesPath(projectDir, bridgeId);
  if (!(await fileExists(activePath))) return null;

  const archiveDir = bridgeNotesArchiveDir(projectDir);
  let index = 0;
  while (await fileExists(path.join(archiveDir, archiveName(bridgeId, index)))) {
    index += 1;
  }
  const name = archiveName(bridgeId, index);

  await movePath(activePath, path.join(archiveDir, name));

  if (index > 0) {
    logWarn(LOG_COMPONENT, `archive name taken, wrote ${name}`);
  }
  logInfo(LOG_COMPONENT, `parked ${activePath} as ${name}`);
  return name;
}

/** Bring a bridge's newest archive back as its active file, unless it already has one. */
async function restoreArchivedNotes(projectDir: string, bridgeId: string): Promise<void> {
  const archiveDir = bridgeNotesArchiveDir(projectDir);
  const archives = await listArchivesFor(archiveDir, bridgeId);
  if (archives.length === 0) return;

  if (await fileExists(bridgeNotesPath(projectDir, bridgeId))) {
    logWarn(LOG_COMPONENT, `notes of ${bridgeId} are both active and archived — left as they are`);
    return;
  }

  const restored = archives[archives.length - 1];
  await movePath(path.join(archiveDir, restored), bridgeNotesPath(projectDir, bridgeId));
  logInfo(LOG_COMPONENT, `restored ${restored} as ${bridgeId}${BRIDGE_NOTES_EXTENSION}`);

  if (archives.length > 1) {
    // The others are left on disk on purpose: each is a real session's findings, and merging them is a
    // curation call that belongs to `/unikit-bridge-audit`. This is the one state in which a bridge holds
    // an active file AND an archive at the same time — hence the WARN rather than a silent restore.
    logWarn(LOG_COMPONENT, `${archives.length} archives exist for ${bridgeId}, restored the newest and kept ${archives.length - 1}`);
  }
}

/**
 * The bridges that have active notes right now, as far as this module may tell: only file names that
 * are a known bridge id. Anything else in the folder is the user's own and is never touched.
 */
async function activeNoteIds(projectDir: string, knownIds: ReadonlySet<string>): Promise<string[]> {
  const ids: string[] = [];
  for (const name of await listFiles(bridgeNotesDir(projectDir))) {
    if (!name.endsWith(BRIDGE_NOTES_EXTENSION)) continue;
    const id = name.slice(0, -BRIDGE_NOTES_EXTENSION.length);
    if (knownIds.has(id)) ids.push(id);
  }
  return ids;
}

/**
 * Park the notes of the bridges that left the selection and restore the notes of the ones that came
 * back — the difference of the two sets, bridge by bridge.
 *
 * Call order matters and is the one thing that breaks silently if got wrong: read the previous set →
 * resolve the new one → **swap here** → persist the config → deliver the rules trees. Run it after the
 * config write and the previous set is already the new one, so the swap becomes a no-op and the notes of
 * a dropped bridge stay active.
 *
 * @param previous ids of the previous run, or `null` when there is no record of one (no BRIDGES.md: the
 *                 first run after a 2.x project was migrated). Then the previous set is taken to be the
 *                 bridges whose notes are active now.
 * @param next     ids of this run.
 * @param knownIds ids of the current engine's catalog; the fallback reads only names that are one.
 */
export async function swapBridgeNotes(
  projectDir: string,
  previous: string[] | null,
  next: string[],
  knownIds: ReadonlySet<string>,
): Promise<void> {
  const before = new Set(previous ?? await activeNoteIds(projectDir, knownIds));
  const after = new Set(next);
  const parked = [...before].filter(id => !after.has(id));
  const restored = [...after].filter(id => !before.has(id));

  if (parked.length === 0 && restored.length === 0) {
    logInfo(LOG_COMPONENT, 'bridge set unchanged, no-op');
    return;
  }

  // Parked first, restored second: one set must not overwrite the other.
  for (const id of parked) await parkActiveNotes(projectDir, id);
  for (const id of restored) await restoreArchivedNotes(projectDir, id);
}
