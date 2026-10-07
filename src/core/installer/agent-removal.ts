// Removal of one agent's setup when the user deselects it on a repeat `init`.
//
// A skills directory is not UniKit's alone: `.agents/skills` is the shared project path of
// more than twenty runtimes and of `npx skills add`, and `.claude/skills` holds whatever else
// the user installed there. So removal takes out exactly what UniKit put in — the skills
// recorded in the agent's `installedSkills` plus the skills of the installed extensions — and
// deletes the directory itself only when nothing is left in it. Subagent files and MCP
// entries are not touched, as before.

import path from 'path';
import type { AgentInstallation, UniKitConfig } from '../config.js';
import { getExtensionDir, loadExtensionManifest } from '../extensions.js';
import { cleanupAgentSetup } from '../transformer.js';
import { removeSkillsByName } from './skills.js';
import { fileExists, listEntries, removeDirectory } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

export interface AgentRemovalResult {
  /** Skill names removal was applied to (a name whose directory was already absent is included). */
  removedSkills: string[];
  /** Entries left in the skills directory because UniKit did not install them, sorted. */
  keptEntries: string[];
  /** True when the skills directory itself was deleted: it existed and was empty after the removal. */
  directoryRemoved: boolean;
}

/**
 * Skill names the installed extensions put into every agent's skills directory — the same set
 * `removeExtension` derives (extension-ops.ts): the extension's own skills (`basename` of each
 * `skills` path) and the base skills it replaced. A replacement is installed under the BASE
 * skill's name for every agent whether or not the user picked that base skill, so it need not be
 * in `installedSkills`. The agent record lists none of this: the replaced names are on the
 * extension's record, the rest is read from its manifest on disk. An extension whose manifest is
 * gone still contributes its replaced names; its own skills stay, and a warning says so.
 */
export async function collectExtensionSkillNames(projectDir: string, config: UniKitConfig | null): Promise<string[]> {
  const names = new Set<string>();

  for (const extension of config?.extensions ?? []) {
    for (const baseName of Object.keys(extension.replacedSkills ?? {})) {
      names.add(baseName);
    }

    const manifest = await loadExtensionManifest(getExtensionDir(projectDir, extension.name));
    if (!manifest) {
      logWarn('agent-removal', `extension "${extension.name}": manifest not found - its own skills are left in place`);
      continue;
    }
    for (const skillPath of manifest.skills ?? []) {
      names.add(path.basename(skillPath));
    }
    for (const baseName of Object.values(manifest.replaces ?? {})) {
      names.add(baseName);
    }
  }

  return [...names];
}

export async function removeAgentSetup(
  projectDir: string,
  agent: AgentInstallation,
  extensionSkillNames: string[] = [],
): Promise<AgentRemovalResult> {
  const skillNames = [...new Set([...agent.installedSkills, ...extensionSkillNames])];
  const removedSkills = await removeSkillsByName(projectDir, agent, skillNames);
  logInfo('agent-removal', `${agent.id}: removal applied to ${removedSkills.length} skill(s) in ${agent.skillsDir}`);

  const skillsPath = path.join(projectDir, agent.skillsDir);
  const existed = await fileExists(skillsPath);
  const keptEntries = await listEntries(skillsPath);
  let directoryRemoved = false;

  if (existed && keptEntries.length === 0) {
    await removeDirectory(skillsPath);
    directoryRemoved = true;
    logInfo('agent-removal', `${agent.id}: ${agent.skillsDir} is empty - removed`);
  } else if (keptEntries.length > 0) {
    logInfo('agent-removal', `${agent.id}: ${agent.skillsDir} kept - ${keptEntries.length} entr(ies) UniKit did not install: ${keptEntries.join(', ')}`);
  }

  await cleanupAgentSetup(agent.id, projectDir, agent.skillsDir);
  return { removedSkills, keptEntries, directoryRemoved };
}
