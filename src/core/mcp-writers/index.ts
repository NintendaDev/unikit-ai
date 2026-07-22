import { JsonMcpWriter } from './json-writer.js';
import { TomlMcpWriter } from './toml-writer.js';
import { OpenCodeMcpWriter } from './opencode-writer.js';
import { AntigravityMcpWriter } from './antigravity-writer.js';

export interface McpWriter {
  readExisting(settingsPath: string): Promise<Record<string, unknown>>;
  upsert(settings: Record<string, unknown>, key: string, config: Record<string, unknown>): void;
  remove(settings: Record<string, unknown>, key: string): boolean;
  serialize(settings: Record<string, unknown>): string;
}

const jsonWriter = new JsonMcpWriter();
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
  return jsonWriter;
}
