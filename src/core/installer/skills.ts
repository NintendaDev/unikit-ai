// Skill install / managed-state / removal / update.
//
// Owns the hash-based skill update lifecycle: building managed-skill state,
// installing skills through the per-agent transformer, listing available
// package skills, removing installed skills, and the diff-driven updateSkills
// that reinstalls only skills whose source or installed hash diverged.

import path from 'path';
import {
  copyDirectory, getSkillsDir, ensureDir, listDirectories,
  writeTextFile, removeDirectory, fileExists, readTextFile, listFilesRecursive,
} from '../../utils/fs.js';
import type { AgentInstallation, ManagedSkillState } from '../config.js';
import { getAgentConfig } from '../agents.js';
import { getTransformer, extractFrontmatterName, replaceFrontmatterName } from '../transformer.js';
import type { AgentTransformer } from '../transformer.js';
import { buildTemplateVars, buildEngineVars, processTemplate, processSkillTemplates } from '../template.js';
import type { TemplateVars } from '../template.js';
import { SKILL_FILE, REFERENCES_DIR_NAME, DEFAULT_ENGINE_ID } from '../constants.js';
import { loadSourceForAgent, warnActionFailed, isMarkdownFile } from './shared.js';
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
  /**
   * The project's selected MCP server file ids (`config.mcp.servers`). Folded
   * into every source hash so a changed selection reinstalls the skills — MCP
   * tool injection is additive and would otherwise accumulate dead ids.
   */
  mcpServers?: string[];
  replacedSkills?: Set<string>;
  /**
   * Skills newly added to the package that the caller opted to install this
   * run (interactive prompt / `--install-new`). Skills in this set are
   * installed and reported as 'changed'/'new-skill-installed'; new skills NOT
   * in the set stay 'skipped'/'new-skill-not-installed' (CI-safe default).
   */
  installNewSkills?: Set<string>;
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
  engineMcpKey: string | null | undefined,
  mcpServers: string[],
): Promise<ManagedSkillState | null> {
  const sourceSkillDir = path.join(getSkillsDir(), skillName);
  const sourceHash = await computeSourceHashWithTemplate(sourceSkillDir, engineId, skillName, agent.id, engineMcpKey, mcpServers);
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

/**
 * Snapshot the managed state written into `.unikit.json`.
 *
 * `engineMcpKey` / `mcpServers` MUST be threaded through here, not only into
 * {@link updateSkills}: the snapshot and the comparison have to be computed by
 * the *same* formula. If they diverge, `previousState.sourceHash !== sourceHash`
 * is true on every single run and every skill is reinstalled forever — a
 * mismatch neither the type-checker nor knip can see, because both signatures
 * stay valid.
 */
export async function buildManagedSkillsState(
  projectDir: string,
  agent: AgentInstallation,
  baseSkills: string[],
  engineId: string,
  engineMcpKey: string | null | undefined,
  mcpServers: string[],
): Promise<Record<string, ManagedSkillState>> {
  const state: Record<string, ManagedSkillState> = {};

  for (const skillName of baseSkills) {
    const managed = await getManagedSkillState(projectDir, agent, skillName, engineId, engineMcpKey, mcpServers);
    if (managed) {
      state[skillName] = managed;
    }
  }

  return state;
}

// --- Skill installation ---

/**
 * Rewrite `/unikit-*` invocations inside a skill's reference `.md` files using
 * the agent transformer's {@link AgentTransformer.transformReference}. No-op for
 * default agents (method undefined) and for non-`.md` files. The root SKILL.md
 * (when present in `dir`) is skipped — it is already rewritten by `transform`.
 * The agent-filter is deliberately NOT applied to references: no guarded blocks
 * live there (enforced by a source guard in scripts/test-skills.sh), and running
 * it over inline marker prose would throw.
 */
async function rewriteReferenceInvocations(
  transformer: AgentTransformer,
  dir: string,
): Promise<void> {
  const fn = transformer.transformReference?.bind(transformer);
  if (!fn) return;

  const skillMdPath = path.join(dir, SKILL_FILE);
  const files = await listFilesRecursive(dir);
  for (const file of files) {
    if (!isMarkdownFile(file)) continue;
    if (file === skillMdPath) continue;
    const raw = await readTextFile(file);
    if (raw === null) continue;
    const rewritten = fn(raw);
    if (rewritten !== raw) {
      await writeTextFile(file, rewritten);
    }
  }
}

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
      // Parity with the non-flat branch: flat references previously skipped
      // {{}} substitution (latent gap) and invocation rewriting. No agent is
      // flat today, so this is forward insurance.
      await rewriteReferenceInvocations(transformer, targetRefsDir);
      await processSkillTemplates(targetRefsDir, agentConfig, engineId, engineMcpKey, skillName);
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
    // Reference `.md` files are copied verbatim by copyDirectory; rewrite their
    // `/unikit-*` invocations for agents that remap them (codex/qwen). The root
    // SKILL.md is excluded (already rewritten above). No-op for default agents.
    await rewriteReferenceInvocations(transformer, targetSkillDir);
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

export async function removeSkillsByName(
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
  const { force = false, engineId = DEFAULT_ENGINE_ID, engineMcpKey, mcpServers = [], replacedSkills, installNewSkills } = options;
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

  // Detect new skills (available in the package but not installed for this
  // agent). Skills the caller opted into (installNewSkills) are installed now
  // and reported as 'changed'/'new-skill-installed'; the rest stay 'skipped'/
  // 'new-skill-not-installed' — the CI-safe back-compat default.
  const newlyAvailable = availableSkills.filter(s => !previousSet.has(s));
  const newToInstall = newlyAvailable.filter(s => installNewSkills?.has(s));
  const installedNew = newToInstall.length > 0
    ? await installSkills({
      projectDir,
      skillsDir: agent.skillsDir,
      skills: newToInstall,
      agentId: agent.id,
      engineId,
      engineMcpKey,
    })
    : [];
  const installedNewSet = new Set(installedNew);
  for (const skill of newlyAvailable) {
    if (!installNewSkills?.has(skill)) {
      entries.push({ skill, status: 'skipped', reason: 'new-skill-not-installed' });
    } else if (installedNewSet.has(skill)) {
      entries.push({ skill, status: 'changed', reason: 'new-skill-installed' });
    } else {
      entries.push({ skill, status: 'skipped', reason: 'install-failed' });
    }
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
    const sourceHash = await computeSourceHashWithTemplate(sourceSkillDir, engineId, skillName, agent.id, engineMcpKey, mcpServers);
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

  // Clean-replace on ANY reinstall decision, not only --force. copyDirectory
  // overwrites the files the package still ships, but leaves behind reference
  // files that were renamed or dropped upstream — they would otherwise survive
  // in the project forever. The trade-off is deliberate: if an install then
  // fails (try/catch above), the skill is absent rather than stale, and the next
  // run picks it up via 'missing-installed-artifact' — the state self-heals.
  // Extension-replaced skills are already excluded from updatableSkills, and
  // extension injections are applied later in update.ts, so both survive.
  if (skillsToInstall.length > 0) {
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
    // Newly installed skills are not in previousSkills, so union them in — the
    // caller persists installedSkills into config + rebuilds managed state.
    installedSkills: [...retainedSkills, ...installedNew],
    entries,
  };
}
