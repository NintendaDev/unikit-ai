// Subagent install / managed-state / update.
//
// Mirrors the skill lifecycle for subagents: a plain install pass, the
// managed-state builder used by init, and the hash-diff updateSubagents used
// by update. Subagent source hashing lives in ./hashing.ts.

import path from 'path';
import {
  getSubagentsDir, ensureDir, listFiles, writeTextFile, removeFile, hashFile,
} from '../../utils/fs.js';
import type { AgentInstallation, ManagedSkillState } from '../config.js';
import { processTemplate } from '../template.js';
import { DEFAULT_ENGINE_ID } from '../constants.js';
import {
  isMarkdownFile, stripMdExtension, buildSubagentTemplateVars,
  loadSourceForAgent, warnActionFailed,
} from './shared.js';
import { computeSubagentSourceHash } from './hashing.js';

// --- Types ---

export type SubagentUpdateStatus = 'changed' | 'unchanged' | 'skipped' | 'removed';

export interface SubagentUpdateEntry {
  subagent: string;
  status: SubagentUpdateStatus;
  reason: string;
}

export interface UpdateSubagentsResult {
  installedSubagents: string[];
  entries: SubagentUpdateEntry[];
}

export interface UpdateSubagentsOptions {
  force?: boolean;
  engineId?: string;
  engineMcpKey?: string | null;
  /**
   * The project's selected MCP server file ids (`config.mcp.servers`). Folded
   * into every source hash so a changed selection reinstalls the subagents —
   * MCP tool injection is additive and would otherwise accumulate dead ids.
   */
  mcpServers?: string[];
}

// --- Agent installation ---

export async function installSubagents(
  projectDir: string,
  subagentsDir: string,
  options: { agentId: string; skipUnchanged?: boolean; engineId?: string; engineMcpKey?: string | null },
): Promise<string[]> {
  const packageSubagentsDir = getSubagentsDir();
  const targetDir = path.join(projectDir, subagentsDir);
  await ensureDir(targetDir);

  const { agentId } = options;
  const skipUnchanged = options.skipUnchanged ?? false;
  const installedSubagents: string[] = [];
  const files = await listFiles(packageSubagentsDir);

  for (const file of files) {
    if (!isMarkdownFile(file)) continue;

    try {
      const sourcePath = path.join(packageSubagentsDir, file);
      const targetPath = path.join(targetDir, file);

      if (skipUnchanged) {
        const sourceHash = await hashFile(sourcePath);
        const targetHash = await hashFile(targetPath);
        if (sourceHash && targetHash && sourceHash === targetHash) {
          installedSubagents.push(stripMdExtension(file));
          continue;
        }
      }

      const content = await loadSourceForAgent(sourcePath, agentId);
      if (content) {
        const subagentName = stripMdExtension(file);
        const vars = buildSubagentTemplateVars(subagentName, options?.engineId, options.engineMcpKey);
        const processed = processTemplate(content, vars);
        await writeTextFile(targetPath, processed);
        installedSubagents.push(subagentName);
      }
    } catch (error) {
      warnActionFailed('install subagent', file, error);
    }
  }

  return installedSubagents;
}

// --- Managed subagent state ---

/**
 * Snapshot the managed subagent state written into `.unikit.json`. Like
 * {@link import('./skills.js').buildManagedSkillsState}, this MUST use the same
 * hash formula as {@link updateSubagents} — a divergence reinstalls every
 * subagent on every run, invisibly to the type-checker and knip.
 */
export async function buildManagedSubagentsState(
  projectDir: string,
  agent: AgentInstallation,
  baseSubagents: string[],
  engineId: string,
  engineMcpKey: string | null | undefined,
  mcpServers: string[],
): Promise<Record<string, ManagedSkillState>> {
  const state: Record<string, ManagedSkillState> = {};
  const packageSubagentsDir = getSubagentsDir();

  for (const subagentName of baseSubagents) {
    const sourcePath = path.join(packageSubagentsDir, subagentName + '.md');
    const sourceHash = await computeSubagentSourceHash(sourcePath, engineId, agent.id, engineMcpKey, mcpServers);
    if (!sourceHash) continue;

    const targetPath = path.join(projectDir, agent.subagentsDir, subagentName + '.md');
    const installedHash = await hashFile(targetPath);
    if (!installedHash) continue;

    state[subagentName] = { sourceHash, installedHash };
  }

  return state;
}

// --- Subagent update ---

export async function updateSubagents(
  agent: AgentInstallation,
  projectDir: string,
  options: UpdateSubagentsOptions = {},
): Promise<UpdateSubagentsResult> {
  const { force = false, engineId = DEFAULT_ENGINE_ID, engineMcpKey, mcpServers = [] } = options;

  const packageSubagentsDir = getSubagentsDir();
  const availableFiles = await listFiles(packageSubagentsDir);
  const availableSubagents = availableFiles
    .filter(f => isMarkdownFile(f))
    .map(f => stripMdExtension(f));
  const availableSet = new Set(availableSubagents);

  const entries: SubagentUpdateEntry[] = [];
  const previousSubagents = agent.installedSubagents;
  const previousSet = new Set(previousSubagents);
  const previousManaged = agent.managedSubagents ?? {};

  // Detect removed subagents
  const removedSubagents = previousSubagents.filter(s => !availableSet.has(s));
  for (const sa of removedSubagents) {
    const targetPath = path.join(projectDir, agent.subagentsDir, sa + '.md');
    await removeFile(targetPath);
    entries.push({ subagent: sa, status: 'removed', reason: 'package-removed' });
  }

  // Detect new subagents (available in package but not previously installed)
  const newlyAvailable = availableSubagents.filter(s => !previousSet.has(s));
  for (const sa of newlyAvailable) {
    entries.push({ subagent: sa, status: 'skipped', reason: 'new-subagent-not-installed' });
  }

  // Updatable subagents
  const updatableSubagents = previousSubagents.filter(s => availableSet.has(s));
  const shouldInstall = new Map<string, { install: boolean; reason: string }>();

  for (const sa of updatableSubagents) {
    const sourcePath = path.join(packageSubagentsDir, sa + '.md');
    const sourceHash = await computeSubagentSourceHash(sourcePath, engineId, agent.id, engineMcpKey, mcpServers);
    const targetPath = path.join(projectDir, agent.subagentsDir, sa + '.md');
    const installedHash = await hashFile(targetPath);
    const previousState = previousManaged[sa];

    if (force) {
      shouldInstall.set(sa, { install: true, reason: 'force-clean-reinstall' });
      continue;
    }

    if (!sourceHash) {
      shouldInstall.set(sa, { install: true, reason: 'source-missing' });
      continue;
    }

    if (!previousState) {
      shouldInstall.set(sa, { install: true, reason: 'missing-managed-state' });
      continue;
    }

    if (!installedHash) {
      shouldInstall.set(sa, { install: true, reason: 'missing-installed-artifact' });
      continue;
    }

    if (previousState.sourceHash !== sourceHash) {
      shouldInstall.set(sa, { install: true, reason: 'source-hash-changed' });
      continue;
    }

    if (previousState.installedHash !== installedHash) {
      console.warn(`Warning: Local modifications detected in subagent "${sa}" - will be overwritten by update.`);
      shouldInstall.set(sa, { install: true, reason: 'installed-hash-drift' });
      continue;
    }

    shouldInstall.set(sa, { install: false, reason: 'up-to-date' });
  }

  // Install subagents that need updating
  const installedSet = new Set<string>();
  const targetDir = path.join(projectDir, agent.subagentsDir);
  await ensureDir(targetDir);

  for (const sa of updatableSubagents) {
    const decision = shouldInstall.get(sa);
    if (!decision?.install) continue;

    try {
      const sourcePath = path.join(packageSubagentsDir, sa + '.md');
      const targetPath = path.join(targetDir, sa + '.md');
      const content = await loadSourceForAgent(sourcePath, agent.id);

      if (content) {
        const vars = buildSubagentTemplateVars(sa, engineId, engineMcpKey);
        const processed = processTemplate(content, vars);
        await writeTextFile(targetPath, processed);
        installedSet.add(sa);
      }
    } catch (error) {
      warnActionFailed('update subagent', sa, error);
    }
  }

  for (const sa of updatableSubagents) {
    const decision = shouldInstall.get(sa);
    if (!decision) continue;

    if (decision.install) {
      entries.push({
        subagent: sa,
        status: installedSet.has(sa) ? 'changed' : 'skipped',
        reason: installedSet.has(sa) ? decision.reason : 'install-failed',
      });
      continue;
    }

    entries.push({
      subagent: sa,
      status: 'unchanged',
      reason: decision.reason,
    });
  }

  const retainedSubagents = previousSubagents.filter(s => availableSet.has(s));

  return {
    installedSubagents: retainedSubagents,
    entries,
  };
}
