// --- MCP recheck-notes lifecycle ---
//
// `.unikit/MCP-RECHECK-NOTES.md` is the project's log of findings about the
// engine MCP server it actually runs against. A finding is a statement about ONE
// server: "this call reports success on a broken artifact" says nothing about a
// different server, and carrying it across a switch would be worse than losing
// it — it would look like evidence.
//
// So the installer parks the notes instead of deleting them. Switching servers
// renames the active file to `MCP-RECHECK-NOTES.archive.<previousFileId>.md`;
// switching back restores it. The installer NEVER writes note content: the file
// is authored by `/unikit-mcp-trap` and curated by `/unikit-mcp-audit`, and the
// only operation here is a rename.
//
// Invariant: one file per server — active OR archived, never both. It holds on
// every path a completed run can take. The one exception is an interrupted run,
// which leaves an extra archive behind: restoring picks the newest and KEEPS the
// rest, because merging two sessions' findings is a curation call and not the
// installer's to make. That state is announced by a WARN, never silent.

import path from 'path';
import {
  MCP_RECHECK_NOTES_ARCHIVE_PREFIX, MCP_RECHECK_NOTES_FILE,
  UNIKIT_DIR, mcpRecheckNotesPath,
} from '../constants.js';
import { fileExists, listFiles, movePath } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

/** Extension of every notes file, active or archived. */
const NOTES_EXTENSION = '.md';

/**
 * Suffix appended to an archive name whose slot is already taken: `.1`, `.2`, …
 * A taken slot means a previous run was interrupted between the two renames, so
 * the existing file is evidence of a real session — overwriting it is the one
 * thing this module must never do.
 */
function indexedArchiveName(fileId: string, index: number): string {
  return `${MCP_RECHECK_NOTES_ARCHIVE_PREFIX}${fileId}.${index}${NOTES_EXTENSION}`;
}

/** `MCP-RECHECK-NOTES.archive.<fileId>.md` — the unindexed slot. */
function archiveName(fileId: string): string {
  return `${MCP_RECHECK_NOTES_ARCHIVE_PREFIX}${fileId}${NOTES_EXTENSION}`;
}

/**
 * Every archived notes file belonging to `fileId`, most recent slot last.
 *
 * Ordering is by index: the unindexed name is slot 0, `.1` is slot 1, and so on,
 * which matches the order {@link parkActiveNotes} allocates them in. The highest
 * index is therefore the newest session.
 */
async function listArchivesFor(unikitDir: string, fileId: string): Promise<string[]> {
  const prefix = `${MCP_RECHECK_NOTES_ARCHIVE_PREFIX}${fileId}`;
  const matches: { name: string; index: number }[] = [];

  for (const name of await listFiles(unikitDir)) {
    if (!name.startsWith(prefix) || !name.endsWith(NOTES_EXTENSION)) continue;

    const middle = name.slice(prefix.length, name.length - NOTES_EXTENSION.length);
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
 * Rename the active notes into the archive slot of the server that produced
 * them. Returns the name it landed under, or `null` when there was nothing to
 * park.
 */
async function parkActiveNotes(
  projectDir: string,
  unikitDir: string,
  previousFileId: string,
): Promise<string | null> {
  const activePath = mcpRecheckNotesPath(projectDir);
  if (!(await fileExists(activePath))) return null;

  let name = archiveName(previousFileId);
  let index = 0;
  while (await fileExists(path.join(unikitDir, name))) {
    index += 1;
    name = indexedArchiveName(previousFileId, index);
  }

  await movePath(activePath, path.join(unikitDir, name));

  if (index > 0) {
    logWarn('swapMcpRecheckNotes', `archive name taken, wrote ${name}`);
  }
  logInfo('swapMcpRecheckNotes', `parked ${activePath} as ${name}`);
  return name;
}

/**
 * Park the active notes under the outgoing server and restore the incoming
 * server's own notes, if this project ever kept any.
 *
 * Call order matters and is the one thing that breaks silently if got wrong:
 * read the previous selection from the on-disk config → resolve the new one →
 * **swap here** → persist `config.mcp.servers` → deliver the rules tree. Run it
 * after the config write and `previousFileId` is already the new value, so the
 * swap becomes a no-op and the notes of the old server stay active under the new
 * one — the exact confusion this module exists to prevent.
 *
 * @param previousFileId the engine server recorded in the config before this
 *                       run, or `null` on a fresh project.
 * @param nextFileId     the engine server this run selected, or `null` when the
 *                       new selection has none.
 */
export async function swapMcpRecheckNotes(
  projectDir: string,
  previousFileId: string | null,
  nextFileId: string | null,
): Promise<void> {
  if (previousFileId === nextFileId) {
    logInfo('swapMcpRecheckNotes', 'server unchanged, no-op');
    return;
  }

  const unikitDir = path.join(projectDir, UNIKIT_DIR);

  if (previousFileId) {
    await parkActiveNotes(projectDir, unikitDir, previousFileId);
  } else if (await fileExists(mcpRecheckNotesPath(projectDir))) {
    // Notes with no recorded owner: a project that predates this mechanism, or
    // one whose config was hand-edited. Parking them under the incoming server
    // would relabel someone else's evidence, so they stay put and say so.
    logWarn(
      'swapMcpRecheckNotes',
      `${MCP_RECHECK_NOTES_FILE} exists but no previous server is recorded — left in place`,
    );
    return;
  }

  if (!nextFileId) return;

  const archives = await listArchivesFor(unikitDir, nextFileId);
  if (archives.length === 0) return;

  const restored = archives[archives.length - 1];
  await movePath(path.join(unikitDir, restored), mcpRecheckNotesPath(projectDir));
  logInfo('swapMcpRecheckNotes', `restored ${restored} as ${MCP_RECHECK_NOTES_FILE}`);

  if (archives.length > 1) {
    // The others are left on disk on purpose: each is a real session's findings,
    // and merging them is a curation call that belongs to `/unikit-mcp-audit`.
    // This is the one state in which a server holds an active file AND an
    // archive at the same time — hence the WARN rather than a silent restore.
    logWarn(
      'swapMcpRecheckNotes',
      `${archives.length} archives exist for ${nextFileId}, restored the newest and kept ${archives.length - 1}`,
    );
  }
}
