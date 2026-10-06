import path from 'path';
import fs from 'fs/promises';
import type { AgentConfig } from './agents.js';
import { getEngineConfig } from './engines.js';
import { expandSkillCalls, renderCallHead } from './skill-call.js';
import type { SkillCallForm } from './constants-skill-call.js';

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
  agent_id: string;
  agent_reader_type: string;
  agent_worker_type: string;
  agent_model_default: string;
  agent_call_reader: string;
  agent_call_worker: string;
  agent_call_worker_quoted: string;
  /** Internal, not a `{{name}}` of its own: the form `{{agent_skill_call:<skill>}}` expands to; '' leaves the token as written. */
  agent_skill_call_form: SkillCallForm | '';
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
    agent_id: agent.id,
    agent_reader_type: agent.subagentProfile.readerType,
    agent_worker_type: agent.subagentProfile.workerType,
    agent_model_default: agent.subagentProfile.modelDefault,
    agent_call_reader: renderCallHead(agent.subagentProfile, 'reader', false),
    agent_call_worker: renderCallHead(agent.subagentProfile, 'worker', false),
    agent_call_worker_quoted: renderCallHead(agent.subagentProfile, 'worker', true),
    agent_skill_call_form: agent.subagentProfile.skillCall,
  };
}

// An unknown `{{name}}` stays in the text as written — which is why a live `{{agent_` outside
// the skills is guarded against (a subagent file or system asset would ship it unreplaced).
// `{{agent_skill_call:<skill>}}` is expanded by a second pass, by the form of the agent.
export function processTemplate(content: string, vars: TemplateVars): string {
  const named = content.replace(/\{\{(skills_dir|home_skills_dir|settings_file|skills_cli_agent_flag|self_name|engine_name|engine_code_language|engine_mcp_tool|agent_id|agent_reader_type|agent_worker_type|agent_model_default|agent_call_reader|agent_call_worker_quoted|agent_call_worker)\}\}/g, (_, key: string) => {
    return vars[key as keyof TemplateVars];
  });
  return expandSkillCalls(named, vars.agent_skill_call_form, vars.skills_dir);
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
