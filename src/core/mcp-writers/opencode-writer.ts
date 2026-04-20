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
      console.warn(`[mcp] opencode: dropping null env key ${k} for ${serverKey}`);
      continue;
    }
    sanitized[k] = v;
  }
  return sanitized;
}

function toOpenCodeServerConfig(rawConfig: Record<string, unknown>, serverKey: string): Record<string, unknown> | null {
  const cmd = rawConfig['command'];
  const args = rawConfig['args'];
  const env = rawConfig['env'];

  if (typeof cmd !== 'string') {
    const type = typeof rawConfig['type'] === 'string' ? ` (type="${rawConfig['type'] as string}")` : '';
    console.warn(`[mcp] opencode: skipping server "${serverKey}"${type} — OpenCode writer supports only stdio servers with a string "command" field`);
    return null;
  }

  const commandArray: unknown[] = [cmd];
  if (Array.isArray(args)) {
    commandArray.push(...args);
  } else if (args !== undefined) {
    console.warn(`[mcp] opencode: server "${serverKey}" has non-array args field, ignoring`);
  }

  const out: Record<string, unknown> = {
    type: 'local',
    command: commandArray,
  };

  if (isRecord(env)) {
    const sanitized = sanitizeEnv(env, serverKey);
    if (Object.keys(sanitized).length > 0) {
      out['environment'] = sanitized;
    }
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

  serialize(settings: Record<string, unknown>): string {
    return JSON.stringify(settings, null, 2) + '\n';
  }
}
