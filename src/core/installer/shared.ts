// Shared low-level helpers for the installer modules.
//
// These collapse patterns that were previously duplicated across the
// installer monolith: the subagent TemplateVars literal (x4), the
// "Could not <action>" install/update warning (x5), the
// logInfo + readSourceForAgent loading pair (x4), and the inline `.md`
// filename predicate / suffix strip. Centralizing them keeps the exact
// runtime text and behaviour while removing the TS-level copies.

import { createHash } from 'crypto';
import { readSourceForAgent } from '../agent-filter.js';
import { buildEngineVars } from '../template.js';
import type { TemplateVars } from '../template.js';
import { logInfo } from '../../utils/log.js';

// --- Content hashing ---

/** SHA-256 of a UTF-8 string. Used for rule-content drift detection. */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

// --- Markdown filename helpers ---

/** True when `file` ends in `.md`. */
export function isMarkdownFile(file: string): boolean {
  return file.endsWith('.md');
}

/** Strip a trailing `.md` extension from a filename (no-op otherwise). */
export function stripMdExtension(file: string): string {
  return file.replace(/\.md$/, '');
}

// --- Template vars ---

/**
 * Build the TemplateVars used for subagents and system assets. All agent-level
 * slots are blank (subagents/system files are agent-agnostic); when an engine
 * id is supplied the engine vars are layered on top. `selfName` is the
 * `{{self_name}}` identity for the rendered artifact.
 */
export function buildSubagentTemplateVars(
  selfName: string,
  engineId?: string,
  engineMcpKey?: string | null,
): TemplateVars {
  const vars: TemplateVars = {
    skills_dir: '',
    home_skills_dir: '',
    settings_file: '',
    skills_cli_agent_flag: '',
    self_name: selfName,
    engine_name: '',
    engine_code_language: '',
    engine_mcp_tool: '',
  };
  if (engineId) {
    Object.assign(vars, buildEngineVars(engineId, engineMcpKey));
  }
  return vars;
}

// --- Source loading ---

/**
 * Read a skill/subagent source file through the agent filter, logging the
 * load. Thin wrapper over {@link readSourceForAgent} that preserves the
 * `loading <path> via readSourceForAgent(<agent>)` trace from the monolith.
 */
export async function loadSourceForAgent(filePath: string, agentId: string): Promise<string | null> {
  logInfo('installer', `loading ${filePath} via readSourceForAgent(${agentId})`);
  return readSourceForAgent(filePath, agentId);
}

// --- Warnings ---

/**
 * Emit the canonical install/update failure warning. `action` is the verb
 * phrase (e.g. `install skill`, `update subagent`) so the rendered text
 * matches the original `Warning: Could not <action> "<name>": <error>` form.
 */
export function warnActionFailed(action: string, name: string, error: unknown): void {
  console.warn(`Warning: Could not ${action} "${name}": ${error}`);
}
