import type { McpWriter } from './index.js';
import { findKeyInContainer } from './shared.js';
import { MCP_COMMENT_KEY } from '../constants.js';
import { fileExists, readTextFile } from '../../utils/fs.js';
import { logInfo } from '../../utils/log.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureNestedRecord(object: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = object[key];
  if (isRecord(value)) {
    return value;
  }
  const next: Record<string, unknown> = {};
  object[key] = next;
  return next;
}

function sanitizeEnv(env: Record<string, unknown>, serverKey: string): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === null || v === undefined) {
      console.warn(`[mcp] opencode: dropping null env key ${k} for ${serverKey}`);
      continue;
    }
    sanitized[k] = v;
  }
  return sanitized;
}

function toOpenCodeServerConfig(rawConfig: Record<string, unknown>, serverKey: string): Record<string, unknown> | null {
  const cmd = rawConfig['command'];
  const url = rawConfig['url'];
  const args = rawConfig['args'];
  const env = rawConfig['env'];

  let out: Record<string, unknown>;

  if (typeof cmd === 'string') {
    const commandArray: unknown[] = [cmd];
    if (Array.isArray(args)) {
      commandArray.push(...args);
    } else if (args !== undefined) {
      console.warn(`[mcp] opencode: server "${serverKey}" has non-array args field, ignoring`);
    }

    out = {
      type: 'local',
      command: commandArray,
    };

    if (isRecord(env)) {
      const sanitized = sanitizeEnv(env, serverKey);
      if (Object.keys(sanitized).length > 0) {
        out['environment'] = sanitized;
      }
    }

    logInfo('mcp', `opencode: ${serverKey} -> local`);
  } else if (typeof url === 'string') {
    out = {
      type: 'remote',
      url,
    };

    logInfo('mcp', `opencode: ${serverKey} -> remote (${url})`);

    const headers = rawConfig['headers'];
    if (isRecord(headers)) {
      out['headers'] = headers;
      // Count only, never the values — a header is where a bearer token sits.
      logInfo('mcp', `opencode: ${serverKey} — ${Object.keys(headers).length} header(s) carried through`);
    }
  } else {
    const type = typeof rawConfig['type'] === 'string' ? ` (type="${rawConfig['type'] as string}")` : '';
    console.warn(`[mcp] opencode: skipping server "${serverKey}"${type} — OpenCode writer needs either a string "command" (local transport) or a string "url" (remote transport)`);
    return null;
  }

  // One point, deliberately AFTER the fork rather than inside the remote branch:
  // carrying the hint only on remote would reproduce the very asymmetry this
  // writer just lost, along a different axis — a future stdio server shipping a
  // hint would lose it on OpenCode and nowhere else.
  //
  // Named passthrough of ONE key, not a general passthrough of unknown fields.
  // A general one would defeat the point of this writer: it deliberately does
  // not let `type: "http"`, `args` or `env` through in their source form.
  // The value is carried verbatim — it is a single line a human reads.
  if (rawConfig[MCP_COMMENT_KEY] !== undefined) {
    out[MCP_COMMENT_KEY] = rawConfig[MCP_COMMENT_KEY];
    logInfo('mcp', `opencode: ${serverKey} — hint field carried through`);
  }

  return out;
}

export class OpenCodeMcpWriter implements McpWriter {
  async readExisting(settingsPath: string): Promise<Record<string, unknown>> {
    if (!(await fileExists(settingsPath))) {
      return {};
    }

    const raw = await readTextFile(settingsPath);
    if (raw === null) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? parsed : {};
    } catch {
      console.warn(`[mcp] failed to parse ${settingsPath}, starting from empty settings`);
      return {};
    }
  }

  upsert(settings: Record<string, unknown>, key: string, config: Record<string, unknown>): void {
    const transformed = toOpenCodeServerConfig(config, key);
    if (transformed === null) {
      return;
    }
    ensureNestedRecord(settings, 'mcp')[key] = transformed;
  }

  remove(settings: Record<string, unknown>, key: string): boolean {
    const servers = settings['mcp'];
    if (!isRecord(servers)) {
      return false;
    }
    if (!(key in servers)) {
      return false;
    }
    delete servers[key];
    return true;
  }

  findKey(settings: Record<string, unknown>, code: string, reserved: Set<string>): string | null {
    return findKeyInContainer(settings, 'mcp', code, reserved);
  }

  mergeEnv(settings: Record<string, unknown>, key: string, env: Record<string, unknown>): void {
    const servers = settings['mcp'];
    if (!isRecord(servers)) return;
    const entry = servers[key];
    if (!isRecord(entry)) return;

    // A remote entry has no spawned process, so it has no `environment` to
    // configure. The call site (`mcp-reconcile.ts`) decides to overlay purely on
    // whether the PACKAGE config carries `env` — the transport is not part of
    // that condition — so the guard has to live here, where the shape actually
    // written to disk can be read.
    //
    // The check is negative (`type === 'remote'` → leave) rather than positive
    // ("write only when there is a command array"): the negative form fixes the
    // one new shape and changes nothing for hand-written entries that carry no
    // `type` at all.
    //
    // No live case today — all seven servers in the catalog were checked (three
    // HTTP, none with `env`; three stdio with `env`; fennara with an empty
    // `env: {}`). This is prophylaxis, and saying so keeps the next reader from
    // reading it as a fix for a bug that was actually happening. It matters
    // because OpenCode is the one agent that declares a `$schema`, where a field
    // that does not belong can invalidate the whole file rather than one entry.
    if (entry['type'] === 'remote') {
      logInfo('mcp', `opencode: ${key} is remote — env overlay skipped (no process to configure)`);
      return;
    }

    // The field is `environment`, NOT `env` — OpenCode's own schema. Writing
    // `env` here by analogy with the JSON writer would leave the client
    // ignoring it, and `UNITY_MCP_NO_GATING=1` would silently fail to arrive on
    // exactly one agent out of four: the surface this whole exception exists
    // for, unclosed. Empty values are dropped, as in `upsert`.
    const merged = { ...(isRecord(entry['environment']) ? entry['environment'] : {}), ...env };
    const sanitized = sanitizeEnv(merged, key);
    if (Object.keys(sanitized).length > 0) {
      entry['environment'] = sanitized;
    }
  }

  serialize(settings: Record<string, unknown>): string {
    return JSON.stringify(settings, null, 2) + '\n';
  }
}
