// --- Parsers of the fields every kind of bridge shares ---
//
// House rule of `mcp-schema.ts`, kept: an unparseable OPTIONAL value is dropped, never thrown, so a
// typo in one field of one entry is a defect in that field and not a reason to abort the scan of the
// whole catalog. A value that is present but malformed earns one `logWarn` naming the file, because
// a silently dropped `setup` line costs the user a step they were never told about.

import path from 'path';
import semver from 'semver';
import type {
  BridgeCli, BridgeCliForms, BridgeDetect, BridgeFileProbe, BridgeRequires, BridgeSetupLine, BridgeShell, DocsSource,
} from './types.js';
import { logWarn } from '../../utils/log.js';

const LOG_COMPONENT = 'parseMcpServerEntry';

const SETUP_ACTORS: ReadonlySet<string> = new Set(['human', 'agent-confirmed']);
const DOCS_SOURCE_KINDS: ReadonlySet<string> = new Set(['command', 'package', 'git']);
const ENGINE_VERSION_PATTERN = /^\d+(\.\d+){0,2}$/;
const HTTPS_PREFIX = 'https://';
const PATH_SEPARATORS = /[\\/]/;
const BINARY_FORBIDDEN = /[\\/\s]/;
const FLAG_PREFIX = '--';
const CLI_SHELLS: ReadonlySet<string> = new Set(['Bash', 'PowerShell']);
const DEFAULT_CLI_SHELLS: BridgeShell[] = ['Bash'];
/** The forms a card may carry besides `call`, which is mandatory. */
const OPTIONAL_CLI_FORM_KEYS = ['groups', 'group', 'search', 'schema', 'compile', 'list', 'status', 'ready', 'version'] as const;
/** The one form that does not address a project: it asks the executable itself. */
const CLI_FORM_WITHOUT_PROJECT = 'version';

// Local on purpose: `mcp-schema.ts` imports this module, and the reverse import would be a cycle.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** A path that stays inside the folder it is relative to: not absolute, no `..` segment. */
function isInsideRelativePath(value: unknown): value is string {
  if (!isNonEmptyString(value) || path.isAbsolute(value) || value.startsWith('/') || value.startsWith('\\')) return false;
  return !value.split(PATH_SEPARATORS).includes('..');
}

function isGlobList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

/** `setup[]`: lines of preparation. A malformed item is dropped, the rest stay. */
export function parseSetup(raw: unknown, fileName: string): BridgeSetupLine[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const lines: BridgeSetupLine[] = [];
  for (const item of raw) {
    if (isRecord(item) && typeof item.by === 'string' && SETUP_ACTORS.has(item.by) && isNonEmptyString(item.run)) {
      lines.push({ by: item.by as BridgeSetupLine['by'], run: item.run });
    } else {
      logWarn(LOG_COMPONENT, `dropped malformed setup item in ${fileName}`);
    }
  }
  return lines.length > 0 ? lines : undefined;
}

/**
 * `requires`: the version floors. Each value is checked on its own; an unusable one is dropped with a
 * warning and the others stay. `cli` and `package` accept a full semver (`1.0.0-beta.14`) or anything
 * `semver.coerce` can read (`0.9`).
 */
export function parseRequires(raw: unknown, fileName: string): BridgeRequires | undefined {
  if (!isRecord(raw)) return undefined;

  const requires: BridgeRequires = {};
  if (raw.engineVersion !== undefined) {
    if (typeof raw.engineVersion === 'string' && ENGINE_VERSION_PATTERN.test(raw.engineVersion)) {
      requires.engineVersion = raw.engineVersion;
    } else {
      logWarn(LOG_COMPONENT, `dropped requires.engineVersion in ${fileName}: not a version`);
    }
  }
  for (const field of ['cli', 'package'] as const) {
    const value = raw[field];
    if (value === undefined) continue;
    if (typeof value === 'string' && (semver.valid(value) !== null || semver.coerce(value) !== null)) {
      requires[field] = value;
    } else {
      logWarn(LOG_COMPONENT, `dropped requires.${field} in ${fileName}: not a version`);
    }
  }
  return Object.keys(requires).length > 0 ? requires : undefined;
}

/** `detect`: what the wizard may look at without running anything. */
export function parseDetect(raw: unknown, fileName: string): BridgeDetect | undefined {
  if (!isRecord(raw)) return undefined;

  const detect: BridgeDetect = {};
  if (raw.binary !== undefined) {
    if (isNonEmptyString(raw.binary) && !PATH_SEPARATORS.test(raw.binary)) {
      detect.binary = raw.binary;
    } else {
      logWarn(LOG_COMPONENT, `dropped detect.binary in ${fileName}: a bare file name is expected`);
    }
  }
  if (raw.projectVersionFile !== undefined) {
    if (isInsideRelativePath(raw.projectVersionFile)) {
      detect.projectVersionFile = raw.projectVersionFile;
    } else {
      logWarn(LOG_COMPONENT, `dropped detect.projectVersionFile in ${fileName}: not a path inside the project`);
    }
  }
  if (raw.versionPattern !== undefined) {
    if (hasExactlyOneCaptureGroup(raw.versionPattern)) {
      detect.versionPattern = raw.versionPattern;
    } else {
      logWarn(LOG_COMPONENT, `dropped detect.versionPattern in ${fileName}: a regular expression with exactly one capture group is expected`);
    }
  }
  return Object.keys(detect).length > 0 ? detect : undefined;
}

/** True for a string that compiles as a regular expression with exactly ONE capture group. */
function hasExactlyOneCaptureGroup(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    // An empty alternative always matches, so the match array reports the group count of the pattern.
    const match = new RegExp(`${value}|`, 'm').exec('');
    return match !== null && match.length === 2;
  } catch {
    return false;
  }
}

/** One pointer, or `null` (the caller warns once for the item). */
function parseDocsSource(item: unknown): DocsSource | null {
  if (!isRecord(item) || typeof item.kind !== 'string' || !DOCS_SOURCE_KINDS.has(item.kind)) return null;
  if (!isNonEmptyString(item.id) || !isInsideRelativePath(item.into)) return null;

  const { id, into } = item;
  if (item.kind === 'command') {
    return isNonEmptyString(item.list) && isNonEmptyString(item.show)
      ? { kind: 'command', id, list: item.list, show: item.show, into }
      : null;
  }

  if (item.include !== undefined && !isGlobList(item.include)) return null;
  if (item.exclude !== undefined && !isGlobList(item.exclude)) return null;
  const filters = {
    ...(item.include === undefined ? {} : { include: item.include as string[] }),
    ...(item.exclude === undefined ? {} : { exclude: item.exclude as string[] }),
  };

  if (item.kind === 'package') {
    return isInsideRelativePath(item.root) && isInsideRelativePath(item.path)
      ? { kind: 'package', id, root: item.root, path: item.path, ...filters, into }
      : null;
  }

  // git
  if (!isNonEmptyString(item.repo) || !item.repo.startsWith(HTTPS_PREFIX)) return null;
  if (item.ref !== undefined && !isNonEmptyString(item.ref)) return null;
  if (item.path !== undefined && !isInsideRelativePath(item.path)) return null;
  return {
    kind: 'git', id, repo: item.repo,
    ...(item.ref === undefined ? {} : { ref: item.ref as string }),
    ...(item.path === undefined ? {} : { path: item.path as string }),
    ...filters, into,
  };
}

/**
 * `docs.sources[]`: pointers to documentation. An item that does not parse, repeats an `id` of the
 * array, or has an `into` that is not inside the references folder is dropped with a warning.
 */
export function parseDocsSources(raw: unknown, fileName: string): DocsSource[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const sources: DocsSource[] = [];
  const seenIds = new Set<string>();
  for (const item of raw) {
    const source = parseDocsSource(item);
    if (source === null) {
      logWarn(LOG_COMPONENT, `dropped malformed docs source in ${fileName}`);
    } else if (seenIds.has(source.id)) {
      logWarn(LOG_COMPONENT, `dropped docs source in ${fileName}: id "${source.id}" repeats`);
    } else {
      seenIds.add(source.id);
      sources.push(source);
    }
  }
  return sources.length > 0 ? sources : undefined;
}

/** A file probe (`file` + key `path`, optional `fallback` of the same shape), or `undefined` for a malformed one. */
function parseFileProbe(raw: unknown): BridgeFileProbe | undefined {
  if (!isRecord(raw) || !isInsideRelativePath(raw.file)) return undefined;
  const keyPath = raw.path;
  if (!Array.isArray(keyPath) || keyPath.length === 0 || !keyPath.every(isNonEmptyString)) return undefined;

  const probe: BridgeFileProbe = { file: raw.file, path: keyPath };
  if (raw.fallback !== undefined) {
    const fallback = parseFileProbe(raw.fallback);
    if (fallback === undefined || fallback.fallback !== undefined) return undefined;
    probe.fallback = { file: fallback.file, path: fallback.path };
  }
  return probe;
}

/** The accepted tool names of `shells`; an absent or unusable list means the default. */
function parseShells(raw: unknown, fileName: string): BridgeShell[] {
  if (raw === undefined) return [...DEFAULT_CLI_SHELLS];

  const shells: BridgeShell[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string' && CLI_SHELLS.has(item)) {
        if (!shells.includes(item as BridgeShell)) shells.push(item as BridgeShell);
      } else {
        logWarn(LOG_COMPONENT, `dropped unknown shell ${JSON.stringify(item)} in cli.shells of ${fileName}`);
      }
    }
  }
  if (shells.length === 0) {
    logWarn(LOG_COMPONENT, `cli.shells of ${fileName} names no usable shell; using ${DEFAULT_CLI_SHELLS.join(', ')}`);
    return [...DEFAULT_CLI_SHELLS];
  }
  return shells;
}

/**
 * The `cli` block of a bridge of kind `cli`: the executable, the flag that addresses a project, and
 * the forms of calling it. Every form begins with the binary, and every form but the version probe
 * carries the project flag (REQ-4: a call always names its project). A form that breaks either rule
 * is dropped with a warning; without a usable `call` the whole block is `undefined` and the caller
 * drops the entry.
 */
export function parseCli(raw: unknown, fileName: string): BridgeCli | undefined {
  if (!isRecord(raw)) {
    logWarn(LOG_COMPONENT, `${fileName}: the "cli" block is missing or is not an object`);
    return undefined;
  }
  if (!isNonEmptyString(raw.binary) || BINARY_FORBIDDEN.test(raw.binary)) {
    logWarn(LOG_COMPONENT, `${fileName}: cli.binary must be a bare file name`);
    return undefined;
  }
  if (!isNonEmptyString(raw.projectFlag) || !raw.projectFlag.startsWith(FLAG_PREFIX)) {
    logWarn(LOG_COMPONENT, `${fileName}: cli.projectFlag must be an option such as --project-path`);
    return undefined;
  }
  const binary = raw.binary;
  const projectFlag = raw.projectFlag;
  const rawForms = isRecord(raw.forms) ? raw.forms : {};

  const formProblem = (key: string, form: unknown): string | null => {
    if (!isNonEmptyString(form)) return 'not a string';
    if (!form.startsWith(`${binary} `)) return `does not begin with "${binary} "`;
    if (key !== CLI_FORM_WITHOUT_PROJECT && !form.includes(projectFlag)) return `does not carry ${projectFlag}`;
    return null;
  };

  const callProblem = formProblem('call', rawForms.call);
  if (callProblem !== null) {
    logWarn(LOG_COMPONENT, `${fileName}: cli.forms.call ${callProblem}`);
    return undefined;
  }
  const forms: BridgeCliForms = { call: rawForms.call as string };
  for (const key of OPTIONAL_CLI_FORM_KEYS) {
    const form = rawForms[key];
    if (form === undefined) continue;
    const problem = formProblem(key, form);
    if (problem === null) forms[key] = form as string;
    else logWarn(LOG_COMPONENT, `dropped cli.forms.${key} in ${fileName}: ${problem}`);
  }

  const cli: BridgeCli = { binary, projectFlag, shells: parseShells(raw.shells, fileName), forms };

  if (isRecord(raw.probes) && raw.probes.package !== undefined) {
    const probe = parseFileProbe(raw.probes.package);
    if (probe) cli.probes = { package: probe };
    else logWarn(LOG_COMPONENT, `dropped cli.probes.package in ${fileName}: expected a project-relative file and a key path`);
  }

  if (raw.notes !== undefined) {
    const notes = Array.isArray(raw.notes) ? raw.notes.filter(isNonEmptyString) : [];
    if (!Array.isArray(raw.notes) || notes.length !== raw.notes.length) {
      logWarn(LOG_COMPONENT, `dropped malformed cli.notes items in ${fileName}`);
    }
    if (notes.length > 0) cli.notes = notes;
  }
  return cli;
}
