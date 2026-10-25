// --- Detection of a bridge on this machine ---
//
// The wizard pre-selects a command-line bridge only when two facts hold: its executable is found on
// PATH, and the engine version of the project is at or above the floor of the card. Both are READS:
// the PATH is split and its folders are probed for a file, and the version is picked out of a file
// of the project with the card's own pattern. Nothing is executed and nothing is written, because
// the installer must never run a tool the user has not asked it to run (REQ-5), and the format of an
// engine's version file belongs to the card, not to this code.

import path from 'path';
import type { McpServerEntry } from '../mcp.js';
import { isFile, readTextFile } from '../../utils/fs.js';
import { logInfo } from '../../utils/log.js';

const LOG_COMPONENT = 'detect';
const WINDOWS = 'win32';
const PATH_DELIMITER_WINDOWS = ';';
const PATH_DELIMITER_POSIX = ':';
/** Used when the environment names no PATHEXT: the extensions Windows itself falls back on. */
const DEFAULT_PATHEXT = '.EXE;.CMD;.BAT';
const VERSION_SEPARATOR = '.';

/** What detection looks at: the project folder, the environment and the platform (a parameter so a test can name another). */
export interface DetectContext {
  projectDir: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
}

/** The value of an environment variable; on Windows the name is case-insensitive (`Path`, `PATH`). */
function envValue(ctx: DetectContext, name: string): string | undefined {
  if (ctx.platform !== WINDOWS) return ctx.env[name];
  const key = Object.keys(ctx.env).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : ctx.env[key];
}

/**
 * The first PATH folder that holds a file called `name` (on Windows: `name` plus an extension of
 * PATHEXT). Executable permission is not required; nothing is run.
 */
export async function findBinaryOnPath(name: string, ctx: DetectContext): Promise<string | null> {
  const windows = ctx.platform === WINDOWS;
  const folders = (envValue(ctx, 'PATH') ?? '')
    .split(windows ? PATH_DELIMITER_WINDOWS : PATH_DELIMITER_POSIX)
    .filter(folder => folder.length > 0);
  const extensions = windows
    ? (envValue(ctx, 'PATHEXT') ?? DEFAULT_PATHEXT).split(PATH_DELIMITER_WINDOWS).filter(ext => ext.length > 0)
    : [''];

  for (const folder of folders) {
    for (const extension of extensions) {
      const candidate = path.join(folder, `${name}${extension}`);
      if (await isFile(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/** The engine version number read from the project file with the entry's own pattern (one capture group), or null. */
export async function readProjectEngineVersion(entry: McpServerEntry, ctx: DetectContext): Promise<string | null> {
  const file = entry.detect?.projectVersionFile;
  const pattern = entry.detect?.versionPattern;
  if (file === undefined || pattern === undefined) return null;

  const text = await readTextFile(path.join(ctx.projectDir, file));
  if (text === null) return null;
  try {
    return new RegExp(pattern, 'm').exec(text)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The leading number of a version segment: `23f1` is 23. A segment with none counts as 0. */
function leadingNumber(segment: string): number {
  const parsed = Number.parseInt(segment, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Numeric comparison of dotted versions, segment by segment over the floor's segments:
 * `6000.0.23f1` is not at `6000.3`, `6000.3.1f1` is, `6000.10` is. A found version with fewer
 * segments counts the missing ones as 0; segments the floor does not have are not compared.
 */
export function versionAtLeast(found: string, floor: string): boolean {
  const foundSegments = found.split(VERSION_SEPARATOR);
  const floorSegments = floor.split(VERSION_SEPARATOR);
  for (let index = 0; index < floorSegments.length; index++) {
    const have = leadingNumber(foundSegments[index] ?? '0');
    const need = leadingNumber(floorSegments[index]);
    if (have !== need) return have > need;
  }
  return true;
}

/**
 * True iff the entry has `detect`, its binary (when it names one) is on PATH and — when the card sets
 * `requires.engineVersion` — the version of the project is read and is at or above it. Anything
 * missing or unreadable means "do not pre-select"; the bridge stays available for a manual tick.
 */
export async function detectBridge(entry: McpServerEntry, ctx: DetectContext): Promise<boolean> {
  const detect = entry.detect;
  if (!detect || (detect.binary === undefined && detect.projectVersionFile === undefined)) return false;

  try {
    if (detect.binary !== undefined) {
      const found = await findBinaryOnPath(detect.binary, ctx);
      logInfo(LOG_COMPONENT, `${entry.key}: binary ${detect.binary} ${found === null ? 'not found on PATH' : `found at ${found}`}`);
      if (found === null) return false;
    }

    const floor = entry.requires?.engineVersion;
    if (floor !== undefined) {
      const version = await readProjectEngineVersion(entry, ctx);
      logInfo(LOG_COMPONENT, `${entry.key}: engine version ${version ?? 'unreadable'}, floor ${floor}`);
      if (version === null || !versionAtLeast(version, floor)) return false;
    }
    return true;
  } catch (error) {
    logInfo(LOG_COMPONENT, `${entry.key}: detection failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
