import { findKeyInContainer, type McpWriter } from './index.js';
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

export class JsonMcpWriter implements McpWriter {
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
    ensureNestedRecord(settings, 'mcpServers')[key] = config;
  }

  remove(settings: Record<string, unknown>, key: string): boolean {
    const servers = settings['mcpServers'];
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
    return findKeyInContainer(settings, 'mcpServers', code, reserved);
  }

  mergeEnv(settings: Record<string, unknown>, key: string, env: Record<string, unknown>): void {
    const servers = settings['mcpServers'];
    if (!isRecord(servers)) return;
    const entry = servers[key];
    if (!isRecord(entry)) return;

    entry['env'] = { ...(isRecord(entry['env']) ? entry['env'] : {}), ...env };
  }

  serialize(settings: Record<string, unknown>): string {
    return JSON.stringify(settings, null, 2) + '\n';
  }
}
