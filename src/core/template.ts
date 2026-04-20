import path from 'path';
import fs from 'fs/promises';
import type { AgentConfig } from './agents.js';
import { getEngineConfig } from './engines.js';

const DEFAULT_ENGINE_MCP_TOOL = 'EngineMCP';

export interface TemplateVars {
  skills_dir: string;
  home_skills_dir: string;
  settings_file: string;
  skills_cli_agent_flag: string;
  self_name: string;
  engine_name: string;
  engine_code_language: string;
  engine_mcp_tool: string;
}

export function buildEngineVars(engineId: string, engineMcpKey?: string | null): Pick<TemplateVars, 'engine_name' | 'engine_code_language' | 'engine_mcp_tool'> {
  const config = getEngineConfig(engineId);

  return {
    engine_name: config.displayName,
    engine_code_language: config.codeLanguage,
    engine_mcp_tool: engineMcpKey ?? DEFAULT_ENGINE_MCP_TOOL,
  };
}

export function buildTemplateVars(agent: AgentConfig): TemplateVars {
  return {
    skills_dir: agent.skillsDir,
    home_skills_dir: `~/${agent.skillsDir}`,
    settings_file: agent.settingsFile ?? 'the MCP settings file',
    skills_cli_agent_flag: agent.skillsCliAgent ? `--agent ${agent.skillsCliAgent}` : '',
    self_name: '',
    engine_name: '',
    engine_code_language: '',
    engine_mcp_tool: '',
  };
}

export function processTemplate(content: string, vars: TemplateVars): string {
  return content.replace(/\{\{(skills_dir|home_skills_dir|settings_file|skills_cli_agent_flag|self_name|engine_name|engine_code_language|engine_mcp_tool)\}\}/g, (_, key: string) => {
    return vars[key as keyof TemplateVars];
  });
}

export async function processSkillTemplates(skillDir: string, agent: AgentConfig, engineId?: string, engineMcpKey?: string | null, selfName?: string): Promise<void> {
  const vars: TemplateVars = engineId
    ? { ...buildTemplateVars(agent), ...buildEngineVars(engineId, engineMcpKey) }
    : buildTemplateVars(agent);
  if (selfName) vars.self_name = selfName;
  await processDirectoryTemplates(skillDir, vars);
}

async function processDirectoryTemplates(dir: string, vars: TemplateVars): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDirectoryTemplates(fullPath, vars);
    } else if (entry.name.endsWith('.md')) {
      const content = await fs.readFile(fullPath, 'utf-8');
      const processed = processTemplate(content, vars);
      if (processed !== content) {
        await fs.writeFile(fullPath, processed, 'utf-8');
      }
    }
  }
}
