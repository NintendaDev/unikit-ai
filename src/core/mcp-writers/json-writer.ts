import type { McpWriter } from './index.js';
import { findKeyInContainer, getEntryInContainer } from './shared.js';
import { QWEN_HTTP_URL_FIELD } from '../constants.js';
import { renderHeaderEnvRefs, type EnvRefStyle } from '../mcp-env.js';
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

export interface JsonMcpWriterOptions {
  /** The client, for log lines only. */
  label: string;
  envStyle: EnvRefStyle;
  /** Qwen: an HTTP server's URL goes into `httpUrl` — `url` means an SSE endpoint there. */
  httpUrlField?: boolean;
}

export class JsonMcpWriter implements McpWriter {
  constructor(private readonly options: JsonMcpWriterOptions = { label: 'claude', envStyle: 'dollar-brace' }) {}

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
    const out: Record<string, unknown> = { ...config };
    const headers = out['headers'];
    if (isRecord(headers)) {
      const rendered = renderHeaderEnvRefs(headers, this.options.envStyle);
      out['headers'] = rendered.headers;
      if (rendered.count > 0) {
        // The count only — a header is where a bearer token sits.
        logInfo('mcp', `${this.options.label}: ${key} — ${rendered.count} env reference(s) rendered`);
      }
    }
    if (this.options.httpUrlField && out['type'] === 'http' && typeof out['url'] === 'string') {
      out[QWEN_HTTP_URL_FIELD] = out['url'];
      delete out['url'];
      delete out['type'];
    }
    ensureNestedRecord(settings, 'mcpServers')[key] = out;
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

  getEntry(settings: Record<string, unknown>, key: string): Record<string, unknown> | null {
    return getEntryInContainer(settings, 'mcpServers', key);
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
