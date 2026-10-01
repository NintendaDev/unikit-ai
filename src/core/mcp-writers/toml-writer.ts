import { parse, stringify } from 'smol-toml';
import type { McpWriter } from './index.js';
import { findKeyInContainer, getEntryInContainer } from './shared.js';
import { CODEX_BEARER_TOKEN_ENV_FIELD, CODEX_ENV_HTTP_HEADERS_FIELD } from '../constants.js';
import { splitCodexHeaderEnvRefs } from '../mcp-env.js';
import { fileExists, readTextFile } from '../../utils/fs.js';
import { logWarn } from '../../utils/log.js';

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
      console.warn(`[mcp] dropping null env key ${k} for ${serverKey}`);
      continue;
    }
    sanitized[k] = v;
  }
  return sanitized;
}

function toCodexServerConfig(rawConfig: Record<string, unknown>, serverKey: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(rawConfig)) {
    if (field === 'type') {
      continue;
    }
    if (field === 'headers') {
      if (!isRecord(value)) {
        out['http_headers'] = value;
        continue;
      }
      // Codex takes a variable NAME in its own fields, never a reference in a string.
      const split = splitCodexHeaderEnvRefs(value);
      if (Object.keys(split.staticHeaders).length > 0) out['http_headers'] = split.staticHeaders;
      if (split.bearerTokenEnvVar !== undefined) out[CODEX_BEARER_TOKEN_ENV_FIELD] = split.bearerTokenEnvVar;
      if (Object.keys(split.envHttpHeaders).length > 0) out[CODEX_ENV_HTTP_HEADERS_FIELD] = split.envHttpHeaders;
      for (const name of split.dropped) {
        logWarn('mcp', `codex: ${serverKey} — header ${name} mixes text and an env reference; Codex cannot express it, header dropped`);
      }
      continue;
    }
    if (field === 'env' && isRecord(value)) {
      out['env'] = sanitizeEnv(value, serverKey);
      continue;
    }
    out[field] = value;
  }

  return out;
}

export class TomlMcpWriter implements McpWriter {
  async readExisting(settingsPath: string): Promise<Record<string, unknown>> {
    if (!(await fileExists(settingsPath))) {
      return {};
    }

    const raw = await readTextFile(settingsPath);
    if (raw === null) {
      return {};
    }

    try {
      const parsed = parse(raw);
      return isRecord(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      console.warn(`[mcp] failed to parse ${settingsPath}, starting from empty settings`);
      return {};
    }
  }

  upsert(settings: Record<string, unknown>, key: string, config: Record<string, unknown>): void {
    const transformed = toCodexServerConfig(config, key);
    ensureNestedRecord(settings, 'mcp_servers')[key] = transformed;
  }

  remove(settings: Record<string, unknown>, key: string): boolean {
    const servers = settings['mcp_servers'];
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
    return findKeyInContainer(settings, 'mcp_servers', code, reserved);
  }

  getEntry(settings: Record<string, unknown>, key: string): Record<string, unknown> | null {
    return getEntryInContainer(settings, 'mcp_servers', key);
  }

  mergeEnv(settings: Record<string, unknown>, key: string, env: Record<string, unknown>): void {
    const servers = settings['mcp_servers'];
    if (!isRecord(servers)) return;
    const entry = servers[key];
    if (!isRecord(entry)) return;

    // Sanitized, not passed through: TOML has no null, so `smol-toml` throws on
    // one. Dropping empty values is part of this writer's contract, not an
    // implementation detail — the same rule `upsert` already applies.
    const merged = { ...(isRecord(entry['env']) ? entry['env'] : {}), ...env };
    entry['env'] = sanitizeEnv(merged, key);
  }

  serialize(settings: Record<string, unknown>): string {
    return stringify(settings) + '\n';
  }
}
