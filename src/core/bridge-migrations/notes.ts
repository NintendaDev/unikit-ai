// Notes migration of 3.0.0 — `.unikit/MCP-RECHECK-NOTES*.md` becomes `.unikit/bridge-notes/<bridge>.md`.
//
// In 2.x the findings log of the one engine server sat at the root of `.unikit/`, and its owner was
// written INSIDE it (the `server:` header), not in its name. The installer never touches the content of
// a log, and it cannot guess an owner — so the move is a step of the chain, and it moves by the header:
// the active file by the id its header names, an archive by the id its name carries. A file whose owner
// cannot be told stays where it is, and says so.
//
// The header line changes in the same write (`server:` becomes `bridge:`), because the pipeline skills
// compare that key against the delivery stamp of the bridge's rules tree and the stamp changes with this
// release too. Nothing else in the file is touched, CRLF included.

import path from 'path';
import { fileExists, listFiles, readTextFile, removeFile, writeTextFile } from '../../utils/fs.js';
import { UNIKIT_DIR } from '../constants.js';
import {
  BRIDGE_MIGRATE_LOG_TAG, BRIDGE_NOTES_EXTENSION, LEGACY_NOTES_ARCHIVE_PREFIX, LEGACY_NOTES_FILE,
  MIGRATION_SINCE_ENGINE_BRIDGES, bridgeNotesArchiveDir, bridgeNotesPath,
} from '../constants-bridges.js';
import type { Migration } from '../migrations/types.js';
import { logInfo, logWarn } from '../../utils/log.js';

export interface NotesMigrationContext {
  projectDir: string;
}

interface NotesMove {
  from: string;
  to: string;
}

interface NotesPlan {
  /** Moves that can be carried out: the owner is known and the target is free. */
  moves: NotesMove[];
  /** Files left in place, each with the reason — for the one WARN `apply` prints per file. */
  skipped: string[];
}

/** The header ends at the first `## ` heading; the owner line is searched only above it. */
const FIRST_SECTION = '\n## ';
const HEADER_OWNER_PATTERN = /^server:[ \t]*(\S+)[ \t]*\r?$/m;
const HEADER_OWNER_REWRITE = /^server:([ \t]*\S+[ \t]*\r?)$/m;
/** `MCP-RECHECK-NOTES.archive.<id>.md` and `….<id>.<n>.md` (n > 0). */
const escapeForRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ARCHIVE_NAME_PATTERN = new RegExp(
  `^${escapeForRegExp(LEGACY_NOTES_ARCHIVE_PREFIX)}(.+?)(?:\\.([1-9][0-9]*))?${escapeForRegExp(BRIDGE_NOTES_EXTENSION)}$`,
);

function splitHeader(content: string): { header: string; rest: string } {
  const at = content.indexOf(FIRST_SECTION);
  return at < 0 ? { header: content, rest: '' } : { header: content.slice(0, at), rest: content.slice(at) };
}

/** The bridge id the active log names in its header, or `null`. */
function headerOwner(content: string): string | null {
  return HEADER_OWNER_PATTERN.exec(splitHeader(content).header)?.[1] ?? null;
}

/** The content with its first `server:` header line turned into `bridge:`; everything else byte-equal. */
function rewriteOwnerKey(content: string): string {
  const { header, rest } = splitHeader(content);
  return header.replace(HEADER_OWNER_REWRITE, 'bridge:$1') + rest;
}

/**
 * ONE list for `detect` and `apply`: a move is planned only when it can be carried out, so `detect`
 * never reports work `apply` refuses to do (a step stuck at "pending" is an exit 8 on every `rules`
 * command, forever).
 */
async function planMoves(projectDir: string): Promise<NotesPlan> {
  const unikitDir = path.join(projectDir, UNIKIT_DIR);
  const moves: NotesMove[] = [];
  const skipped: string[] = [];

  const plan = async (from: string, to: string): Promise<void> => {
    if (await fileExists(to)) {
      skipped.push(`${from}: ${to} already exists`);
    } else {
      moves.push({ from, to });
    }
  };

  const activePath = path.join(unikitDir, LEGACY_NOTES_FILE);
  const active = await readTextFile(activePath);
  if (active !== null) {
    const owner = headerOwner(active);
    if (owner === null) {
      skipped.push(`${activePath}: no "server:" line in its header, so its bridge is unknown`);
    } else {
      await plan(activePath, bridgeNotesPath(projectDir, owner));
    }
  }

  for (const name of await listFiles(unikitDir)) {
    const match = ARCHIVE_NAME_PATTERN.exec(name);
    if (!match) continue;
    const [, owner, index] = match;
    const target = path.join(bridgeNotesArchiveDir(projectDir), `${owner}${index ? `.${index}` : ''}${BRIDGE_NOTES_EXTENSION}`);
    await plan(path.join(unikitDir, name), target);
  }

  return { moves, skipped };
}

/**
 * Read the source, change its owner key, write the target, read the target back, and only then delete
 * the source — a half-written move must never lose the only copy of someone's findings.
 */
async function carryOut(move: NotesMove): Promise<void> {
  const content = await readTextFile(move.from);
  if (content === null) throw new Error('unreadable');

  const rewritten = rewriteOwnerKey(content);
  await writeTextFile(move.to, rewritten);
  if ((await readTextFile(move.to)) !== rewritten) {
    throw new Error(`${move.to} did not read back as written`);
  }
  await removeFile(move.from);
}

const bridgeNotesRelocate: Migration<NotesMigrationContext> = {
  id: 'bridge-notes-relocate',
  since: MIGRATION_SINCE_ENGINE_BRIDGES,

  async detect({ projectDir }) {
    return (await planMoves(projectDir)).moves.length > 0;
  },

  async apply({ projectDir }) {
    const { moves, skipped } = await planMoves(projectDir);
    for (const reason of skipped) {
      logWarn(BRIDGE_MIGRATE_LOG_TAG, `skip ${reason}`);
    }

    // Each file in its own try: one locked file must not leave the whole project without its version stamp.
    for (const move of moves) {
      try {
        await carryOut(move);
        logInfo(BRIDGE_MIGRATE_LOG_TAG, `moved ${move.from} -> ${move.to}`);
      } catch (error) {
        logWarn(BRIDGE_MIGRATE_LOG_TAG, `could not move ${move.from}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  },
};

export const PROJECT_NOTES_MIGRATIONS: readonly Migration<NotesMigrationContext>[] = [bridgeNotesRelocate];
