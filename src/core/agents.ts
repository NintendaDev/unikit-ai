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
  isStable: boolean;
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
    isStable: true,
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
    isStable: false,
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
    isStable: false,
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini CLI',
    configDir: '.gemini',
    skillsDir: '.gemini/skills',
    subagentsDir: '.gemini/agents',
    settingsFile: '.gemini/settings.json',
    supportsMcp: true,
    supportsSubagents: false,
    skillsCliAgent: 'gemini-cli',
    isStable: false,
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
    isStable: false,
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
    isStable: false,
  },
};

export function getAgentConfig(id: string): AgentConfig {
  const config = AGENT_REGISTRY[id];
  if (!config) {
    throw new Error(`Unknown agent: ${id}. Available: ${Object.keys(AGENT_REGISTRY).join(', ')}`);
  }
  return config;
}

export function getAgentChoices(): { name: string; value: string; isStable: boolean }[] {
  return Object.values(AGENT_REGISTRY).map(agent => ({
    name: `${agent.displayName} (${agent.configDir}/)`,
    value: agent.id,
    isStable: agent.isStable,
  }));
}
