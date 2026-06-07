// Extension skill / subagent install + removal.
//
// Extensions ship their own skills and subagents from an external extension
// directory. Skill installs reuse the core transformer pipeline
// (installSkillWithTransformer); subagent installs mirror the plain subagent
// template render. Removal is best-effort (missing artifacts are ignored).

import path from 'path';
import { ensureDir, writeTextFile, removeDirectory, removeFile } from '../../utils/fs.js';
import type { AgentInstallation } from '../config.js';
import { getAgentConfig } from '../agents.js';
import { getTransformer } from '../transformer.js';
import { processTemplate } from '../template.js';
import {
  isMarkdownFile, stripMdExtension, buildSubagentTemplateVars,
  loadSourceForAgent, warnActionFailed,
} from './shared.js';
import { installSkillWithTransformer } from './skills.js';

// --- Extension skill installation ---

export async function installExtensionSkills(
  projectDir: string,
  agent: AgentInstallation,
  extensionDir: string,
  skillPaths: string[],
  engineId?: string,
  engineMcpKey?: string | null,
): Promise<string[]> {
  const agentConfig = getAgentConfig(agent.id);
  const installed: string[] = [];

  for (const skillPath of skillPaths) {
    const sourceDir = path.join(extensionDir, skillPath);
    const skillName = path.basename(skillPath);

    try {
      await installSkillWithTransformer(
        sourceDir, skillName, projectDir, agent.skillsDir,
        agent.id, agentConfig, engineId, engineMcpKey,
      );
      installed.push(skillName);
    } catch (error) {
      warnActionFailed('install extension skill', skillName, error);
    }
  }

  return installed;
}

export async function removeExtensionSkills(
  projectDir: string,
  agent: AgentInstallation,
  skillNames: string[],
): Promise<string[]> {
  const agentConfig = getAgentConfig(agent.id);
  const transformer = getTransformer(agent.id);
  const removed: string[] = [];

  for (const skillName of skillNames) {
    try {
      const result = transformer.transform(skillName, '');
      if (result.flat) {
        const targetPath = path.join(projectDir, agentConfig.configDir, result.targetDir, result.targetName);
        await removeDirectory(targetPath);
      } else {
        const targetSkillDir = path.join(projectDir, agent.skillsDir, result.targetDir);
        await removeDirectory(targetSkillDir);
      }
      removed.push(skillName);
    } catch {
      // Skill may not exist, ignore
    }
  }

  return removed;
}

// --- Extension subagent installation ---

export async function installExtensionSubagents(
  projectDir: string,
  agent: AgentInstallation,
  extensionDir: string,
  subagentPaths: string[],
  engineId?: string,
  engineMcpKey?: string | null,
): Promise<string[]> {
  const agentConfig = getAgentConfig(agent.id);
  if (!agentConfig.supportsSubagents) return [];

  const targetDir = path.join(projectDir, agent.subagentsDir);
  await ensureDir(targetDir);

  const installed: string[] = [];

  for (const subagentPath of subagentPaths) {
    const sourcePath = path.join(extensionDir, subagentPath);
    const fileName = path.basename(subagentPath);

    if (!isMarkdownFile(fileName)) continue;

    try {
      const content = await loadSourceForAgent(sourcePath, agent.id);
      if (!content) continue;

      const subagentName = stripMdExtension(fileName);
      const vars = buildSubagentTemplateVars(subagentName, engineId, engineMcpKey);
      const processed = processTemplate(content, vars);

      await writeTextFile(path.join(targetDir, fileName), processed);
      installed.push(subagentName);
    } catch (error) {
      warnActionFailed('install extension subagent', fileName, error);
    }
  }

  return installed;
}

export async function removeExtensionSubagents(
  projectDir: string,
  agent: AgentInstallation,
  subagentNames: string[],
): Promise<string[]> {
  const removed: string[] = [];

  for (const name of subagentNames) {
    try {
      const targetPath = path.join(projectDir, agent.subagentsDir, name + '.md');
      await removeFile(targetPath);
      removed.push(name);
    } catch {
      // Subagent may not exist, ignore
    }
  }

  return removed;
}
