import { parse, stringify } from 'smol-toml';
import type { McpWriter } from './index.js';
import { fileExists, readTextFile } from '../../utils/fs.js';

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
      out['http_headers'] = value;
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

  serialize(settings: Record<string, unknown>): string {
    return stringify(settings) + '\n';
  }
}
