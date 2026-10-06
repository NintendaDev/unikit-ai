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
  /**
   * How skills name the subagents they launch on this runtime. `readerType` is the read-only
   * agent type (reconnaissance, validation), `workerType` the one that can create files and
   * is also what the skill-loading aliases launch. `modelDefault` is the model argument passed
   * when `.unikit/config.yaml` has no `subagents.model.<id>`: only a stable vendor alias
   * (`sonnet`, `flash`) or empty — empty means pass no model. The values are pointers into
   * the runtime's own type namespace and age with it: re-check them in a live session.
   */
  subagentProfile: { readerType: string; workerType: string; modelDefault: string };
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
    subagentProfile: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: 'sonnet' },
  },
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
    subagentProfile: { readerType: 'explorer', workerType: 'worker', modelDefault: '' },
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
    subagentProfile: { readerType: 'explore', workerType: 'generalPurpose', modelDefault: '' },
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
    subagentProfile: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: '' },
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
    subagentProfile: { readerType: 'explore', workerType: 'general', modelDefault: '' },
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
    subagentProfile: { readerType: 'research', workerType: 'self', modelDefault: 'flash' },
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
    subagentProfile: { readerType: 'explore', workerType: 'coder', modelDefault: '' },
  },
  // For runtimes UniKit does not name. Skills go to the shared `.agents/skills` — Antigravity's
  // directory too, which is why the two are never selected together (core/agent-skills-dir.ts) —
  // and MCP to `.mcp.json`, written by the same writer as Claude Code's. The profile reuses
  // Claude's type names and passes no model: the runtime is not known in advance.
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
    subagentProfile: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: '' },
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
