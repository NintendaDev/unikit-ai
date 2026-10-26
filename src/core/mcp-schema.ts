// --- MCP JSON schema parsing ---
//
// Turns one raw `engine-bridges/<engine>/<name>.json` (or `mcp/universal/<name>.json`) object
// into a typed `McpServerEntry`.
// Split out of `mcp.ts` for the same reason as `mcp-platform.ts` and
// `bridges/selection.ts`: that module carries discovery, configuration, rule
// collection and frontmatter injection, and the schema kept growing a field per
// task. The dependency runs one way — this module imports types from `mcp.ts`,
// never the reverse.
//
// House rule for every optional field: an unparseable value is dropped
// silently, never thrown. A typo in one key is a data defect in one server, not
// a reason to abort the scan of the whole directory. The one exception is a
// value that is present but malformed — that is a defect worth one `logWarn`,
// because a silently dropped `docs` block costs the user the install line and a
// silently dropped `rules` pointer costs them the whole exceptions tree.

import path from 'path';
import { MCP_PLATFORM_KEYS, type McpPlatformKey } from './constants.js';
import type { BridgeKind, McpAllowedTools, McpServerEntry } from './mcp.js';
import { parseCli, parseDetect, parseDocsSources, parseRequires, parseSetup } from './bridges/schema-fields.js';
import type { BridgeCli } from './bridges/types.js';
import { logInfo, logWarn } from '../utils/log.js';

/**
 * Everything one JSON object can say about itself.
 *
 * `originDir` is deliberately absent: which catalog folder an entry was read out
 * of is not written in the file, it is where the file sits. The scanner stamps
 * it on — see `scanMcpDirectory` — and this type is what makes forgetting that
 * step a compile error rather than a wizard that silently groups every server
 * into one radio.
 */
export type ParsedMcpServerEntry = Omit<McpServerEntry, 'originDir'>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the optional `docs` block — pointers to where this server documents
 * itself. `context7` is a Context7 library id, `repo` the upstream repository
 * URL; both are optional and each is kept independently, so a server that
 * publishes only one of the two still contributes it.
 *
 * `repo` is load-bearing for engine servers: the `init` summary generates its
 * install line from it (the hand-written `instruction` prose it replaced went
 * stale field by field). A URL rots more slowly than prose, and when it dies it
 * answers 404 loudly instead of walking the user through outdated steps.
 *
 * @param fileName the JSON's own file name, for the warn message only.
 */
function parseDocs(raw: unknown, fileName: string): McpServerEntry['docs'] | null {
  if (raw === undefined) return null;

  if (!isRecord(raw)) {
    logWarn('parseMcpServerEntry', `dropped malformed docs field in ${fileName}`);
    return null;
  }

  const docs: NonNullable<McpServerEntry['docs']> = {};

  if (typeof raw.context7 === 'string' && raw.context7.length > 0) {
    docs.context7 = raw.context7;
  }
  if (typeof raw.repo === 'string' && raw.repo.length > 0) {
    docs.repo = raw.repo;
  }
  // `sources` rides on a block that already says something: pointers alone, with neither a Context7
  // id nor a repository, are not a `docs` block and take the warning below.
  const sources = parseDocsSources(raw.sources, fileName);
  if (sources && (docs.context7 !== undefined || docs.repo !== undefined)) {
    docs.sources = sources;
  }

  if (docs.context7 === undefined && docs.repo === undefined) {
    logWarn('parseMcpServerEntry', `dropped malformed docs field in ${fileName}`);
    return null;
  }

  return docs;
}

/**
 * Read the optional `rules` key — a directory holding this server's exceptions
 * tree (`INDEX.md` plus whatever else it grew). The JSON stores the path
 * relative to its own directory, exactly as the retired `shards` pointers did;
 * it is resolved to absolute here so no consumer needs to know which
 * `engine-bridges/<engine>/` dir the entry came from.
 *
 * Returns `null` when the key is absent — a server without a rules tree is a
 * normal state, and by the "no rules is not no rights" invariant it degrades
 * nothing.
 *
 * @param fileName the JSON's own file name, for the warn message only.
 */
function parseRulesDir(raw: unknown, dirPath: string, fileName: string): string | null {
  if (raw === undefined) return null;

  if (typeof raw !== 'string' || raw.length === 0) {
    logWarn('parseMcpServerEntry', `dropped malformed rules field in ${fileName}`);
    return null;
  }

  return path.resolve(dirPath, raw);
}

/** The optional `kind` key: absent means `mcp`; a value that is neither `mcp` nor `cli` is `null`. */
function parseBridgeKind(raw: unknown): BridgeKind | null {
  if (raw === undefined) return 'mcp';
  return raw === 'mcp' || raw === 'cli' ? raw : null;
}

/**
 * Read the optional `configByPlatform` key into a typed map. Platforms outside
 * {@link MCP_PLATFORM_KEYS} and non-object values are dropped.
 */
function parseConfigByPlatform(raw: unknown): Partial<Record<McpPlatformKey, Record<string, unknown>>> | null {
  if (!isRecord(raw)) return null;

  const resolved: Partial<Record<McpPlatformKey, Record<string, unknown>>> = {};
  let found = false;

  for (const platform of MCP_PLATFORM_KEYS) {
    const value = raw[platform];
    if (!isRecord(value)) continue;
    resolved[platform] = value;
    found = true;
  }

  return found ? resolved : null;
}

/**
 * Parse one MCP JSON object into an entry.
 *
 * @param raw      the parsed JSON object.
 * @param dirPath  directory the JSON was read from — the `rules` pointer is
 *                 relative to it and is resolved to an absolute path here so no
 *                 consumer needs to know which `engine-bridges/<engine>/` dir it came from.
 * @param fileName the JSON's own file name, quoted in warn messages so a
 *                 malformed field names its source without the caller having to
 *                 re-derive it.
 * @returns `null` when the object cannot describe a usable server: no `key`, no
 *          `code`, no `displayName`, or neither `config` nor `configByPlatform`.
 *          That last disjunction matters — a server whose binary path differs
 *          per OS ships only `configByPlatform`, and demanding `config` would
 *          drop it before it ever reached the wizard.
 *
 *          `code` joins `key` as a hard requirement rather than an optional
 *          field defaulting to the key. The two answer different questions —
 *          `key` is who this server IS inside the package, `code` is the name it
 *          is REGISTERED under in the agent's settings file — and a default
 *          would silently register a server under its file id the day someone
 *          forgets the field. That is not a degraded install; it is grants
 *          (`mcp__<code>__*`) aimed at a container key that does not exist, and
 *          nothing downstream can tell it apart from a correct one.
 */
export function parseMcpServerEntry(raw: unknown, dirPath: string, fileName: string): ParsedMcpServerEntry | null {
  if (!isRecord(raw) || !raw.key || !raw.displayName) return null;

  if (typeof raw.code !== 'string' || raw.code.length === 0) {
    logWarn('parseMcpServerEntry', `dropped ${fileName}: missing or empty "code"`);
    return null;
  }

  // Present but unknown is a defect worth a warning; absent is `mcp`, the only kind that existed.
  const kind = parseBridgeKind(raw['kind']);
  if (kind === null) {
    logWarn('parseMcpServerEntry', `dropped ${fileName}: unknown kind "${String(raw['kind'])}"`);
    return null;
  }

  // What makes an entry usable depends on its kind: an MCP server needs a config to be registered with,
  // a command line needs a valid `cli` block. The old rule ("config or configByPlatform") dropped every
  // entry of kind `cli` without a word.
  const configByPlatform = parseConfigByPlatform(raw['configByPlatform']);
  let cli: BridgeCli | undefined;
  if (kind === 'cli') {
    cli = parseCli(raw['cli'], fileName);
    if (!cli) {
      logWarn('parseMcpServerEntry', `dropped ${fileName}: kind "cli" needs a valid "cli" block`);
      return null;
    }
    if (raw.config || raw['configByPlatform'] !== undefined) {
      logWarn('parseMcpServerEntry', `${fileName}: "config" is ignored for kind "cli"`);
    }
  } else {
    if (!raw.config && !configByPlatform) return null;
    if (raw['cli'] !== undefined) {
      logWarn('parseMcpServerEntry', `${fileName}: the "cli" block is ignored for kind "mcp"`);
    }
  }

  const entry: ParsedMcpServerEntry = {
    key: raw.key as string,
    code: raw.code,
    isEngine: (raw['is_engine'] as boolean) ?? false,
    kind,
    displayName: raw.displayName as string,
  };

  if (cli) {
    entry.cli = cli;
  } else {
    if (raw.config) {
      entry.config = raw.config as Record<string, unknown>;
    }

    if (configByPlatform) {
      entry.configByPlatform = configByPlatform;
    }
  }

  const allowedTools = raw['allowed-tools'] as McpAllowedTools | undefined;
  if (allowedTools) {
    entry.allowedTools = allowedTools;
  }

  if (typeof raw['order'] === 'number') {
    entry.order = raw['order'];
  }

  // A non-boolean is dropped silently, like every optional field here.
  const preselect = typeof raw['preselect'] === 'boolean' ? raw['preselect'] : undefined;
  if (preselect !== undefined) {
    entry.preselect = preselect;
  }

  const docs = parseDocs(raw['docs'], fileName);
  if (docs) {
    entry.docs = docs;
  }

  const rulesDir = parseRulesDir(raw['rules'], dirPath, fileName);
  if (rulesDir) {
    entry.rulesDir = rulesDir;
  }

  // The fields every kind of bridge shares: each is kept only when it parsed to something.
  const setup = parseSetup(raw['setup'], fileName);
  if (setup) {
    entry.setup = setup;
  }
  const requires = parseRequires(raw['requires'], fileName);
  if (requires) {
    entry.requires = requires;
  }
  const detect = parseDetect(raw['detect'], fileName);
  if (detect) {
    entry.detect = detect;
  }

  logInfo(
    'parseMcpServerEntry',
    `${fileName}: key=${entry.key} code=${entry.code} is_engine=${entry.isEngine} kind=${entry.kind} sources=${entry.docs?.sources?.length ?? 0}`,
  );

  return entry;
}
