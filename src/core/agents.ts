import { CODEX_SPAWN_ARGS, DEFAULT_SKILL_CALL_FORM, SKILLTOOL_CALL_FORM } from './constants-skill-call.js';
import type { SkillCallForm } from './constants-skill-call.js';

/**
 * How skills name the subagents they launch on this runtime. `readerType` is the read-only
 * agent type (reconnaissance, validation), `workerType` the one that can create files and
 * is also what the skill-loading aliases launch. `modelDefault` is the model argument passed
 * when `.unikit/config.yaml` has no `subagents.model.<id>`: only a stable vendor alias
 * (`sonnet`, `flash`) or `inherit` — `inherit` means pass no model. The values are pointers into
 * the runtime's own type namespace and age with it: re-check them in a live session.
 */
export interface SubagentProfile {
  /** Read-only agent type (reconnaissance, validation). Empty when the runtime's agent call takes no type (see `spawnArgs`). */
  readerType: string;
  /** Agent type that can create files; also what the skill-loading aliases launch. Empty like `readerType`. */
  workerType: string;
  /** Model argument used when `.unikit/config.yaml` has no `subagents.model.<id>`: only a stable vendor alias or `inherit` (never empty). */
  modelDefault: string;
  /** How a subagent is told to load a skill: see `SKILL_CALL_FORMS`. */
  skillCall: SkillCallForm;
  /** Extra arguments every agent call carries, written as they stand in the call (each part ends with a comma); empty when none. */
  spawnArgs: string;
}

export interface AgentConfig {
  id: string;
  displayName: string;
  configDir: string;
  skillsDir: string;
  subagentsDir: string;
  settingsFile: string | null;
  supportsMcp: boolean;
  supportsSubagents: boolean;
  skillsCliAgent: string | null;
  subagentProfile: SubagentProfile;
}

export const AGENT_REGISTRY: Record<string, AgentConfig> = {
  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    configDir: '.claude',
    skillsDir: '.claude/skills',
    subagentsDir: '.claude/agents',
    settingsFile: '.mcp.json',
    supportsMcp: true,
    supportsSubagents: true,
    skillsCliAgent: 'claude-code',
    subagentProfile: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: 'sonnet', skillCall: SKILLTOOL_CALL_FORM, spawnArgs: '' },
  },
  // spawn_agent has no subagent type parameter (live probe 2026-10-06): the call names no type, drops the
  // parent history and gives each subagent a name of its own. Read-only for a reader rests on the prompt,
  // not on a type.
  codex: {
    id: 'codex',
    displayName: 'Codex CLI',
    configDir: '.codex',
    skillsDir: '.codex/skills',
    subagentsDir: '.codex/agents',
    settingsFile: '.codex/config.toml',
    supportsMcp: true,
    supportsSubagents: false,
    skillsCliAgent: 'codex',
    subagentProfile: { readerType: '', workerType: '', modelDefault: 'inherit', skillCall: DEFAULT_SKILL_CALL_FORM, spawnArgs: CODEX_SPAWN_ARGS },
  },
  cursor: {
    id: 'cursor',
    displayName: 'Cursor',
    configDir: '.cursor',
    skillsDir: '.cursor/skills',
    subagentsDir: '.cursor/agents',
    settingsFile: '.cursor/mcp.json',
    supportsMcp: true,
    supportsSubagents: false,
    skillsCliAgent: 'cursor',
    subagentProfile: { readerType: 'explore', workerType: 'generalPurpose', modelDefault: 'inherit', skillCall: DEFAULT_SKILL_CALL_FORM, spawnArgs: '' },
  },
  qwen: {
    id: 'qwen',
    displayName: 'Qwen Code',
    configDir: '.qwen',
    skillsDir: '.qwen/skills',
    subagentsDir: '.qwen/agents',
    settingsFile: '.qwen/settings.json',
    supportsMcp: true,
    supportsSubagents: false,
    skillsCliAgent: 'qwen',
    subagentProfile: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: 'inherit', skillCall: DEFAULT_SKILL_CALL_FORM, spawnArgs: '' },
  },
  opencode: {
    id: 'opencode',
    displayName: 'OpenCode',
    configDir: '.opencode',
    skillsDir: '.opencode/skills',
    subagentsDir: '.opencode/agents',
    settingsFile: 'opencode.json',
    supportsMcp: true,
    supportsSubagents: false,
    skillsCliAgent: 'opencode',
    subagentProfile: { readerType: 'explore', workerType: 'general', modelDefault: 'inherit', skillCall: DEFAULT_SKILL_CALL_FORM, spawnArgs: '' },
  },
  antigravity: {
    id: 'antigravity',
    displayName: 'Antigravity',
    configDir: '.agents',
    skillsDir: '.agents/skills',
    subagentsDir: '.agents/agents',
    settingsFile: '.agents/mcp_config.json',
    supportsMcp: true,
    supportsSubagents: false,
    skillsCliAgent: 'antigravity',
    subagentProfile: { readerType: 'research', workerType: 'self', modelDefault: 'flash', skillCall: DEFAULT_SKILL_CALL_FORM, spawnArgs: '' },
  },
  kimi: {
    id: 'kimi',
    displayName: 'Kimi Code',
    configDir: '.kimi-code',
    skillsDir: '.kimi-code/skills',
    subagentsDir: '.kimi-code/agents',
    settingsFile: '.kimi-code/mcp.json',
    supportsMcp: true,
    supportsSubagents: true,
    skillsCliAgent: 'kimi-code-cli',
    subagentProfile: { readerType: 'explore', workerType: 'coder', modelDefault: 'inherit', skillCall: DEFAULT_SKILL_CALL_FORM, spawnArgs: '' },
  },
  // For runtimes UniKit does not name. Skills go to the shared `.agents/skills` — Antigravity's
  // directory too, which is why the two are never selected together (core/agent-skills-dir.ts) —
  // and MCP to `.mcp.json`, written by the same writer as Claude Code's. The profile reuses
  // Claude's type names and passes no model: the runtime is not known in advance.
  // It reads the skill file: there is no Skill tool to rely on.
  universal: {
    id: 'universal',
    displayName: 'Universal / Other',
    configDir: '.agents',
    skillsDir: '.agents/skills',
    subagentsDir: '.agents/agents',
    settingsFile: '.mcp.json',
    supportsMcp: true,
    supportsSubagents: false,
    skillsCliAgent: 'universal',
    subagentProfile: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: 'inherit', skillCall: DEFAULT_SKILL_CALL_FORM, spawnArgs: '' },
  },
};

export function getAgentConfig(id: string): AgentConfig {
  const config = AGENT_REGISTRY[id];
  if (!config) {
    throw new Error(`Unknown agent: ${id}. Available: ${Object.keys(AGENT_REGISTRY).join(', ')}`);
  }
  return config;
}

export function getAgentChoices(): { name: string; value: string }[] {
  return Object.values(AGENT_REGISTRY).map(agent => ({
    name: `${agent.displayName} (${agent.configDir}/)`,
    value: agent.id,
  }));
}
