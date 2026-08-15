// Hashing + skill-path resolution for the installer.
//
// Pure, side-effect-free helpers that compute the source/installed content
// hashes used by the hash-based update logic, plus the per-agent skill path
// resolution that the install/update/mcp paths share.

import path from 'path';
import { createHash } from 'crypto';
import {
  getEngineTemplatesDir, listFilesRecursive, readFileBuffer,
  fileExists, hashDirectory, hashFile,
} from '../../utils/fs.js';
import { getAgentConfig } from '../agents.js';
import { getEngineConfig } from '../engines.js';
import { getTransformer } from '../transformer.js';
import { logInfo } from '../../utils/log.js';
import { REFERENCES_DIR_NAME, SKILL_FILE } from '../constants.js';
import { stripMdExtension } from './shared.js';

export interface ResolvedSkillPaths {
  sourceSkillDir: string;
  targetSkillDir: string;
  targetSkillFile: string;
  targetRefsDir: string;
  sourceRefsDir: string;
  flat: boolean;
}

// --- Hashing utilities ---

async function hashManagedFiles(files: Array<{ absPath: string; relPath: string }>): Promise<string | null> {
  if (files.length === 0) {
    return null;
  }

  const sortedFiles = [...files].sort((a, b) => a.relPath.localeCompare(b.relPath));
  const hasher = createHash('sha256');

  for (const file of sortedFiles) {
    const content = await readFileBuffer(file.absPath);
    if (!content) {
      return null;
    }
    hasher.update(`path:${file.relPath}\n`);
    hasher.update(content);
    hasher.update('\n');
  }

  return hasher.digest('hex');
}

async function hashManagedDirectory(dirPath: string): Promise<string | null> {
  const files = await listFilesRecursive(dirPath);
  if (files.length === 0) {
    return null;
  }

  const mapped = files.map(absPath => ({
    absPath,
    relPath: path.relative(dirPath, absPath).replaceAll('\\', '/'),
  }));

  return hashManagedFiles(mapped);
}

// --- Skill path resolution ---

export function resolveSkillPaths(
  projectDir: string,
  skillsDir: string,
  agentId: string,
  skillName: string,
  sourceSkillDir: string,
): ResolvedSkillPaths {
  const transformer = getTransformer(agentId);
  const agentConfig = getAgentConfig(agentId);
  const transformed = transformer.transform(skillName, '');

  const sourceRefsDir = path.join(sourceSkillDir, REFERENCES_DIR_NAME);
  if (transformed.flat) {
    const targetSkillDir = path.join(projectDir, agentConfig.configDir, transformed.targetDir);
    return {
      sourceSkillDir,
      targetSkillDir,
      targetSkillFile: path.join(targetSkillDir, transformed.targetName),
      targetRefsDir: path.join(targetSkillDir, REFERENCES_DIR_NAME),
      sourceRefsDir,
      flat: true,
    };
  }

  const targetSkillDir = path.join(projectDir, skillsDir, transformed.targetDir);
  return {
    sourceSkillDir,
    targetSkillDir,
    targetSkillFile: path.join(targetSkillDir, SKILL_FILE),
    targetRefsDir: path.join(targetSkillDir, REFERENCES_DIR_NAME),
    sourceRefsDir,
    flat: false,
  };
}

export async function hashInstalledSkill(paths: ResolvedSkillPaths): Promise<string | null> {
  if (!paths.flat) {
    return hashManagedDirectory(paths.targetSkillDir);
  }

  const mainFileExists = await fileExists(paths.targetSkillFile);
  if (!mainFileExists) {
    return null;
  }

  const filesToHash: Array<{ absPath: string; relPath: string }> = [
    {
      absPath: paths.targetSkillFile,
      relPath: path.basename(paths.targetSkillFile),
    },
  ];

  const sourceRefs = await listFilesRecursive(paths.sourceRefsDir);
  for (const sourceRef of sourceRefs) {
    const relPath = path.relative(paths.sourceRefsDir, sourceRef).replaceAll('\\', '/');
    const targetRef = path.join(paths.targetRefsDir, relPath);
    filesToHash.push({
      absPath: targetRef,
      relPath: `references/${relPath}`,
    });
  }

  return hashManagedFiles(filesToHash);
}

// --- Source hashes (skill + subagent) ---

/**
 * Fold the MCP selection into a source hash.
 *
 * MCP tool ids are injected into an installed skill's frontmatter, and the
 * injection is purely **additive** — there is no removal branch. The managed
 * state snapshot is also taken *after* injection, so `installedHash` always
 * matches itself and the drift check can never fire. Without this component a
 * changed MCP selection reinstalls nothing and dead `mcp__*` ids accumulate as
 * the union of every selection the project ever had.
 *
 * This hashes the **input** of the injection, not its output: materialising the
 * final text would mean running the whole pipeline just to decide whether to
 * install, plus a second in-memory implementation of an injection that is
 * currently file-based and positional — two paths that would drift.
 *
 * Sorting is mandatory: `config.mcp.servers` comes out of the wizard in answer
 * order, which is not deterministic.
 */
function mcpHashComponent(engineMcpKey: string | null | undefined, mcpServers: string[]): string {
  return `mcp:${engineMcpKey ?? 'none'}|${[...mcpServers].sort().join(',')}`;
}

export async function computeSourceHashWithTemplate(
  sourceSkillDir: string,
  engineId: string,
  skillName: string,
  agentId: string,
  engineMcpKey: string | null | undefined,
  mcpServers: string[],
): Promise<string | null> {
  const baseHash = await hashDirectory(sourceSkillDir);
  if (!baseHash) return null;

  // Always include engine ID + agent ID in hash so engine switch and
  // agent-specific filter output both trigger a reinstall for every skill.
  // The MCP selection is the same kind of global dimension — see mcpHashComponent.
  const combined = createHash('sha256');
  const mcpComponent = mcpHashComponent(engineMcpKey, mcpServers);
  combined.update(baseHash);
  combined.update(`engine:${engineId}`);
  combined.update(`agent:${agentId}`);
  combined.update(mcpComponent);
  logInfo('installer', `[hash] agent=${agentId} engine=${engineId} ${mcpComponent} skill=${skillName}`);

  let engineConfig;
  try {
    engineConfig = getEngineConfig(engineId);
  } catch {
    return combined.digest('hex');
  }

  const templateFilename = engineConfig.skillTemplates[skillName];
  if (!templateFilename) return combined.digest('hex');

  const templatePath = path.join(getEngineTemplatesDir(), 'skills', skillName, templateFilename);
  const templateHash = await hashFile(templatePath);
  if (!templateHash) return combined.digest('hex');

  combined.update(templateHash);

  return combined.digest('hex');
}

export async function computeSubagentSourceHash(
  sourcePath: string,
  engineId: string,
  agentId: string,
  engineMcpKey: string | null | undefined,
  mcpServers: string[],
): Promise<string | null> {
  const fileHash = await hashFile(sourcePath);
  if (!fileHash) return null;

  const combined = createHash('sha256');
  const mcpComponent = mcpHashComponent(engineMcpKey, mcpServers);
  combined.update(fileHash);
  combined.update(`engine:${engineId}`);
  combined.update(`agent:${agentId}`);
  combined.update(mcpComponent);
  logInfo('installer', `[hash] agent=${agentId} engine=${engineId} ${mcpComponent} subagent=${stripMdExtension(path.basename(sourcePath))}`);

  return combined.digest('hex');
}
