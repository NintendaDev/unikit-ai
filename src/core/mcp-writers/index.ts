import { JsonMcpWriter } from './json-writer.js';
import { TomlMcpWriter } from './toml-writer.js';
import { OpenCodeMcpWriter } from './opencode-writer.js';
import { AntigravityMcpWriter } from './antigravity-writer.js';

export interface McpWriter {
  readExisting(settingsPath: string): Promise<Record<string, unknown>>;
  upsert(settings: Record<string, unknown>, key: string, config: Record<string, unknown>): void;
  remove(settings: Record<string, unknown>, key: string): boolean;
  /**
   * Find the key under which `code` is already registered, tolerating a
   * difference in case or surrounding whitespace.
   *
   * The scan is deliberately BOUNDED. A key counts as a variant of ours only
   * when it matches `code` after `trim()` + lowercasing AND is absent from
   * `reserved` — the set of keys extensions registered. Extensions write into
   * the same container (`extension-ops.ts`), so an unbounded case-insensitive
   * scan could recognise one of theirs as a misspelling of ours and destroy it
   * through the `remove` + `upsert` normalisation below. Anything failing either
   * condition is left alone no matter how similar it looks.
   *
   * @returns the key as it is spelled on disk, or `null` when the server is not
   *          registered under any variant.
   */
  findKey(settings: Record<string, unknown>, code: string, reserved: Set<string>): string | null;
  /** The entry registered under exactly `key`, or `null` — read-only, for the kept-entry check. */
  getEntry(settings: Record<string, unknown>, key: string): Record<string, unknown> | null;
  /**
   * Overlay `env` onto an existing entry, leaving every other field untouched.
   *
   * The one field UniKit imposes on an entry it did not write. Everything else
   * about an existing registration belongs to whoever created it — the vendor's
   * plugin, or the user — but `env` is ours: `UNITY_MCP_NO_GATING=1` is what
   * makes "gating is removed by configuration" in the biome rules tree a true
   * statement about this project, and a plugin that rewrites the entry between
   * two runs carries it away with everything else.
   *
   * The differences between writers are THREE, not one: the container name, the
   * field name (`environment` on OpenCode, `env` everywhere else), and whether
   * empty values are dropped (Codex and OpenCode sanitize). All three are part
   * of this method's contract rather than implementation detail — an
   * implementation copied from the JSON writer would hand an OpenCode user a
   * field their client ignores.
   */
  mergeEnv(settings: Record<string, unknown>, key: string, env: Record<string, unknown>): void;
  serialize(settings: Record<string, unknown>): string;
}

// Three instances of one JSON writer: the clients share the container and the
// file format, and differ in how an env reference is spelled and — on Qwen —
// in the field an HTTP server's URL goes into (`url` means SSE there).
const claudeJsonWriter = new JsonMcpWriter({ label: 'claude', envStyle: 'dollar-brace' });
const cursorJsonWriter = new JsonMcpWriter({ label: 'cursor', envStyle: 'env-colon' });
const qwenJsonWriter = new JsonMcpWriter({ label: 'qwen', envStyle: 'dollar-brace', httpUrlField: true });
const tomlWriter = new TomlMcpWriter();
const opencodeWriter = new OpenCodeMcpWriter();
const antigravityWriter = new AntigravityMcpWriter();

export function getMcpWriter(agentId: string): McpWriter {
  if (agentId === 'codex') {
    return tomlWriter;
  }
  if (agentId === 'opencode') {
    return opencodeWriter;
  }
  if (agentId === 'antigravity') {
    return antigravityWriter;
  }
  if (agentId === 'cursor') {
    return cursorJsonWriter;
  }
  if (agentId === 'qwen') {
    return qwenJsonWriter;
  }
  return claudeJsonWriter;
}
