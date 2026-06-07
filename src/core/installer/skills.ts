// Skill install / managed-state / removal / update.
//
// Owns the hash-based skill update lifecycle: building managed-skill state,
// installing skills through the per-agent transformer, listing available
// package skills, removing installed skills, and the diff-driven updateSkills
// that reinstalls only skills whose source or installed hash diverged.

import path from 'path';
import {
  copyDirectory, getSkillsDir, ensureDir, listDirectories,
  writeTextFile, removeDirectory, fileExists,
} from '../../utils/fs.js';
import type { AgentInstallation, ManagedSkillState } from '../config.js';
import { getAgentConfig } from '../agents.js';
import { getTransformer, extractFrontmatterName, replaceFrontmatterName } from '../transformer.js';
import { buildTemplateVars, buildEngineVars, processTemplate, processSkillTemplates } from '../template.js';
import type { TemplateVars } from '../template.js';
import { SKILL_FILE, REFERENCES_DIR_NAME, DEFAULT_ENGINE_ID } from '../constants.js';
import { loadSourceForAgent, warnActionFailed } from './shared.js';
import { resolveSkillPaths, hashInstalledSkill, computeSourceHashWithTemplate } from './hashing.js';

// --- Types ---

export type SkillUpdateStatus = 'changed' | 'unchanged' | 'skipped' | 'removed' | 'replaced';

export interface SkillUpdateEntry {
  skill: string;
  status: SkillUpdateStatus;
  reason: string;
}

export interface UpdateSkillsResult {
  installedSkills: string[];
  entries: SkillUpdateEntry[];
}

export interface UpdateSkillsOptions {
  force?: boolean;
  engineId?: string;
  engineMcpKey?: string | null;
  replacedSkills?: Set<string>;
}

export interface InstallSkillsOptions {
  projectDir: string;
  skillsDir: string;
  skills: string[];
  agentId: string;
  engineId?: string;
  engineMcpKey?: string | null;
}

// --- Managed skill state ---

async function getManagedSkillState(
  projectDir: string,
  agent: AgentInstallation,
  skillName: string,
  engineId: string,
): Promise<ManagedSkillState | null> {
  const sourceSkillDir = path.join(getSkillsDir(), skillName);
  const sourceHash = await computeSourceHashWithTemplate(sourceSkillDir, engineId, skillName, agent.id);
  if (!sourceHash) {
    return null;
  }

  const paths = resolveSkillPaths(projectDir, agent.skillsDir, agent.id, skillName, sourceSkillDir);
  const installedHash = await hashInstalledSkill(paths);
  if (!installedHash) {
    return null;
  }

  return { sourceHash, installedHash };
}

export async function buildManagedSkillsState(
  projectDir: string,
  agent: AgentInstallation,
  baseSkills: string[],
  engineId: string,
): Promise<Record<string, ManagedSkillState>> {
  const state: Record<string, ManagedSkillState> = {};

  for (const skillName of baseSkills) {
    const managed = await getManagedSkillState(projectDir, agent, skillName, engineId);
    if (managed) {
      state[skillName] = managed;
    }
  }

  return state;
}

// --- Skill installation ---

export async function installSkillWithTransformer(
  sourceSkillDir: string,
  skillName: string,
  projectDir: string,
  skillsDir: string,
  agentId: string,
  agentConfig: ReturnType<typeof getAgentConfig>,
  engineId?: string,
  engineMcpKey?: string | null,
): Promise<void> {
  const transformer = getTransformer(agentId);
  const skillMdPath = path.join(sourceSkillDir, SKILL_FILE);
  const content = await loadSourceForAgent(skillMdPath, agentId);
  if (!content) {
    throw new Error(`SKILL.md not found in ${sourceSkillDir}`);
  }

  const fmName = extractFrontmatterName(content);
  const adjustedContent = (fmName && fmName !== skillName) ? replaceFrontmatterName(content, skillName) : content;

  const result = transformer.transform(skillName, adjustedContent);
  const vars: TemplateVars = engineId
    ? { ...buildTemplateVars(agentConfig), ...buildEngineVars(engineId, engineMcpKey) }
    : buildTemplateVars(agentConfig);
  vars.self_name = skillName;

  if (result.flat) {
    const targetPath = path.join(projectDir, agentConfig.configDir, result.targetDir, result.targetName);
    await writeTextFile(targetPath, processTemplate(result.content, vars));

    const sourceRefsDir = path.join(sourceSkillDir, REFERENCES_DIR_NAME);
    if (await fileExists(sourceRefsDir)) {
      const targetRefsDir = path.join(projectDir, agentConfig.configDir, result.targetDir, REFERENCES_DIR_NAME);
      await copyDirectory(sourceRefsDir, targetRefsDir);
    }
  } else {
    const targetSkillDir = path.join(projectDir, skillsDir, result.targetDir);
    await copyDirectory(sourceSkillDir, targetSkillDir);
    // Always overwrite the copied SKILL.md with the transformer/filter output —
    // `content` is already post-agent-filter, so even when the transformer
    // returns it unchanged (DefaultTransformer), the raw source from
    // copyDirectory must be replaced so guarded blocks and their markers do
    // not leak into the installed file.
    await writeTextFile(path.join(targetSkillDir, SKILL_FILE), result.content);
    await processSkillTemplates(targetSkillDir, agentConfig, engineId, engineMcpKey, skillName);
  }
}

export async function installSkills(options: InstallSkillsOptions): Promise<string[]> {
  const { projectDir, skillsDir, skills, agentId, engineId, engineMcpKey } = options;
  const installedSkills: string[] = [];
  const agentConfig = getAgentConfig(agentId);

  const targetDir = path.join(projectDir, skillsDir);
  await ensureDir(targetDir);

  const packageSkillsDir = getSkillsDir();

  for (const skill of skills) {
    const sourceSkillDir = path.join(packageSkillsDir, skill);

    try {
      await installSkillWithTransformer(sourceSkillDir, skill, projectDir, skillsDir, agentId, agentConfig, engineId, engineMcpKey);
      installedSkills.push(skill);
    } catch (error) {
      warnActionFailed('install skill', skill, error);
    }
  }

  const transformer = getTransformer(agentId);
  if (transformer.postInstall) {
    await transformer.postInstall(projectDir);
  }

  return installedSkills;
}

export async function getAvailableSkills(): Promise<string[]> {
  const packageSkillsDir = getSkillsDir();
  const dirs = await listDirectories(packageSkillsDir);
  return dirs.filter(dir => !dir.startsWith('_'));
}

// --- Skill removal ---

async function removeSkillsByName(
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

// --- Skill update ---

export async function updateSkills(
  agent: AgentInstallation,
  projectDir: string,
  options: UpdateSkillsOptions = {},
): Promise<UpdateSkillsResult> {
  const { force = false, engineId = DEFAULT_ENGINE_ID, engineMcpKey, replacedSkills } = options;
  const availableSkills = await getAvailableSkills();
  const availableSet = new Set(availableSkills);

  const entries: SkillUpdateEntry[] = [];
  const previousSkills = agent.installedSkills;
  const previousSet = new Set(previousSkills);
  const previousManaged = agent.managedSkills ?? {};

  // Detect removed skills
  const removedSkills = previousSkills.filter(s => !availableSet.has(s));
  if (removedSkills.length > 0) {
    await removeSkillsByName(projectDir, agent, removedSkills);
    for (const skill of removedSkills) {
      entries.push({ skill, status: 'removed', reason: 'package-removed' });
    }
  }

  // Detect new skills
  const newlyAvailable = availableSkills.filter(s => !previousSet.has(s));
  for (const skill of newlyAvailable) {
    entries.push({ skill, status: 'skipped', reason: 'new-skill-not-installed' });
  }

  // Skip replaced skills (handled by extensions)
  if (replacedSkills && replacedSkills.size > 0) {
    for (const skill of previousSkills) {
      if (replacedSkills.has(skill) && availableSet.has(skill)) {
        entries.push({ skill, status: 'replaced', reason: 'replaced-by-extension' });
      }
    }
  }

  // Updatable skills (exclude replaced)
  const updatableSkills = previousSkills.filter(s => availableSet.has(s) && !(replacedSkills?.has(s)));
  const shouldInstall = new Map<string, { install: boolean; reason: string }>();

  for (const skillName of updatableSkills) {
    const sourceSkillDir = path.join(getSkillsDir(), skillName);
    const sourceHash = await computeSourceHashWithTemplate(sourceSkillDir, engineId, skillName, agent.id);
    const paths = resolveSkillPaths(projectDir, agent.skillsDir, agent.id, skillName, sourceSkillDir);
    const installedHash = await hashInstalledSkill(paths);
    const previousState = previousManaged[skillName];

    if (force) {
      shouldInstall.set(skillName, { install: true, reason: 'force-clean-reinstall' });
      continue;
    }

    if (!sourceHash) {
      shouldInstall.set(skillName, { install: true, reason: 'source-missing' });
      continue;
    }

    if (!previousState) {
      shouldInstall.set(skillName, { install: true, reason: 'missing-managed-state' });
      continue;
    }

    if (!installedHash) {
      shouldInstall.set(skillName, { install: true, reason: 'missing-installed-artifact' });
      continue;
    }

    if (previousState.sourceHash !== sourceHash) {
      shouldInstall.set(skillName, { install: true, reason: 'source-hash-changed' });
      continue;
    }

    if (previousState.installedHash !== installedHash) {
      console.warn(`Warning: Local modifications detected in skill "${skillName}" — will be overwritten by update.`);
      shouldInstall.set(skillName, { install: true, reason: 'installed-hash-drift' });
      continue;
    }

    shouldInstall.set(skillName, { install: false, reason: 'up-to-date' });
  }

  const skillsToInstall = updatableSkills.filter(skillName => shouldInstall.get(skillName)?.install === true);

  if (force && skillsToInstall.length > 0) {
    await removeSkillsByName(projectDir, agent, skillsToInstall);
  }

  const installedBaseSkills = skillsToInstall.length > 0
    ? await installSkills({
      projectDir,
      skillsDir: agent.skillsDir,
      skills: skillsToInstall,
      agentId: agent.id,
      engineId,
      engineMcpKey,
    })
    : [];

  const installedSet = new Set(installedBaseSkills);

  for (const skillName of updatableSkills) {
    const decision = shouldInstall.get(skillName);
    if (!decision) continue;

    if (decision.install) {
      entries.push({
        skill: skillName,
        status: installedSet.has(skillName) ? 'changed' : 'skipped',
        reason: installedSet.has(skillName) ? decision.reason : 'install-failed',
      });
      continue;
    }

    entries.push({
      skill: skillName,
      status: 'unchanged',
      reason: decision.reason,
    });
  }

  const retainedSkills = previousSkills.filter(s => availableSet.has(s));

  return {
    installedSkills: retainedSkills,
    entries,
  };
}
