import path from 'path';
import fs from 'fs/promises';
import type { AgentConfig } from './agents.js';
import { getEngineConfig } from './engines.js';
import { expandSkillCalls, renderCallHead } from './skill-call.js';
import type { SkillCallForm } from './constants-skill-call.js';
import { SYSTEM_PATH_VARS, TEMPLATE_VAR_NAMES } from './constants-template.js';
import type { SystemTemplateVars } from './constants-template.js';

const DEFAULT_ENGINE_BRIDGE_MCP_CODE = 'EngineMCP';

/**
 * The fields below are the ones that depend on an agent or an engine. The paths of the system files
 * (`user_questions_contract`, `gd_principles`, …) come from the registry in `constants-template.ts`
 * through {@link SystemTemplateVars}: one table, one field per row, none declared by hand.
 */
export interface TemplateVars extends SystemTemplateVars {
  skills_dir: string;
  home_skills_dir: string;
  settings_file: string;
  skills_cli_agent_flag: string;
  self_name: string;
  engine_name: string;
  engine_code_language: string;
  engine_bridge_mcp_code: string;
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

export function buildEngineVars(engineId: string, mcpBridgeCode?: string | null): Pick<TemplateVars, 'engine_name' | 'engine_code_language' | 'engine_bridge_mcp_code'> {
  const config = getEngineConfig(engineId);

  return {
    engine_name: config.displayName,
    engine_code_language: config.codeLanguage,
    engine_bridge_mcp_code: mcpBridgeCode ?? DEFAULT_ENGINE_BRIDGE_MCP_CODE,
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
    engine_bridge_mcp_code: '',
    agent_id: agent.id,
    agent_reader_type: agent.subagentProfile.readerType,
    agent_worker_type: agent.subagentProfile.workerType,
    agent_model_default: agent.subagentProfile.modelDefault,
    agent_call_reader: renderCallHead(agent.subagentProfile, 'reader', false),
    agent_call_worker: renderCallHead(agent.subagentProfile, 'worker', false),
    agent_call_worker_quoted: renderCallHead(agent.subagentProfile, 'worker', true),
    agent_skill_call_form: agent.subagentProfile.skillCall,
    ...SYSTEM_PATH_VARS,
  };
}

// Built once from the one list of names (`TEMPLATE_VAR_NAMES`): the names are `[a-z0-9_]`, nothing to escape.
const TEMPLATE_VAR_PATTERN = new RegExp(`\\{\\{(${TEMPLATE_VAR_NAMES.join('|')})\\}\\}`, 'g');

// An unknown `{{name}}` stays in the text as written — which is why a live `{{agent_` outside
// the skills is guarded against (a subagent file or system asset would ship it unreplaced).
// The system-file names substitute wherever this function runs — skills and their references,
// extension text, subagent files, `dev-principles.md` — to the same path for every agent.
// `{{agent_skill_call:<skill>}}` is expanded by a second pass, by the form of the agent.
export function processTemplate(content: string, vars: TemplateVars): string {
  const named = content.replace(TEMPLATE_VAR_PATTERN, (_, key: string) => {
    return vars[key as keyof TemplateVars];
  });
  return expandSkillCalls(named, vars.agent_skill_call_form, vars.skills_dir);
}

export async function processSkillTemplates(skillDir: string, agent: AgentConfig, engineId?: string, mcpBridgeCode?: string | null, selfName?: string): Promise<void> {
  const vars: TemplateVars = engineId
    ? { ...buildTemplateVars(agent), ...buildEngineVars(engineId, mcpBridgeCode) }
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
