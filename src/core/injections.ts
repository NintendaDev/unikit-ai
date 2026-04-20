import path from 'path';
import { readTextFile, writeTextFile, fileExists } from '../utils/fs.js';
import type { AgentInstallation } from './config.js';
import { getAgentConfig } from './agents.js';
import { getTransformer } from './transformer.js';
import type { ExtensionInjection } from './extensions.js';

// --- Constants ---

const MARKER_PREFIX = 'unikit-ext';

// --- Marker format ---

function startMarker(extName: string, target: string, position: string): string {
  return `<!-- ${MARKER_PREFIX}:${extName}:${target}:${position}:start -->`;
}

function endMarker(extName: string, target: string, position: string): string {
  return `<!-- ${MARKER_PREFIX}:${extName}:${target}:${position}:end -->`;
}

// --- Path resolution ---

function resolveInjectionTargetPath(
  projectDir: string,
  agent: AgentInstallation,
  injection: ExtensionInjection,
): string | null {
  if (injection.targetType === 'subagent') {
    return path.join(projectDir, agent.subagentsDir, injection.target + '.md');
  }

  // targetType === 'skill'
  const transformer = getTransformer(agent.id);
  const agentConfig = getAgentConfig(agent.id);
  const transformed = transformer.transform(injection.target, '');

  if (transformed.flat) {
    return path.join(projectDir, agentConfig.configDir, transformed.targetDir, transformed.targetName);
  }

  return path.join(projectDir, agent.skillsDir, transformed.targetDir, 'SKILL.md');
}

// --- Apply injection ---

export async function applyInjection(
  projectDir: string,
  agent: AgentInstallation,
  extName: string,
  injection: ExtensionInjection,
  injectionContent: string,
): Promise<boolean> {
  const targetPath = resolveInjectionTargetPath(projectDir, agent, injection);
  if (!targetPath || !(await fileExists(targetPath))) {
    console.warn(`Warning: Injection target not found: ${injection.target} (${injection.targetType}) for agent ${agent.id}`);
    return false;
  }

  let content = await readTextFile(targetPath);
  if (!content) {
    console.warn(`Warning: Injection target empty or unreadable: ${targetPath}`);
    return false;
  }

  const start = startMarker(extName, injection.target, injection.position);
  const end = endMarker(extName, injection.target, injection.position);

  // Strip existing injection for idempotent re-application
  content = stripBlock(content, start, end);

  const block = `${start}\n${injectionContent}\n${end}`;

  if (injection.position === 'prepend') {
    content = block + '\n' + content;
  } else {
    content = content.trimEnd() + '\n\n' + block + '\n';
  }

  await writeTextFile(targetPath, content);

  return true;
}

// --- Strip injection ---

function stripBlock(content: string, start: string, end: string): string {
  const startIdx = content.indexOf(start);
  if (startIdx === -1) return content;

  const endIdx = content.indexOf(end, startIdx);
  if (endIdx === -1) return content;

  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx + end.length);

  // Clean up extra newlines at the boundary
  const cleaned = before.replace(/\n+$/, '\n') + after.replace(/^\n+/, '\n');

  return cleaned;
}

export async function stripInjection(
  projectDir: string,
  agent: AgentInstallation,
  extName: string,
  injection: ExtensionInjection,
): Promise<boolean> {
  const targetPath = resolveInjectionTargetPath(projectDir, agent, injection);
  if (!targetPath || !(await fileExists(targetPath))) {
    return false;
  }

  const content = await readTextFile(targetPath);
  if (!content) return false;

  const start = startMarker(extName, injection.target, injection.position);
  const end = endMarker(extName, injection.target, injection.position);

  if (!content.includes(start)) return false;

  const stripped = stripBlock(content, start, end);
  await writeTextFile(targetPath, stripped);

  return true;
}

// --- Strip all injections for an extension ---

export async function stripAllInjections(
  projectDir: string,
  agent: AgentInstallation,
  extName: string,
  injections: ExtensionInjection[],
): Promise<number> {
  let count = 0;

  for (const injection of injections) {
    const removed = await stripInjection(projectDir, agent, extName, injection);
    if (removed) count++;
  }

  return count;
}

// --- Apply all injections for an extension ---

export async function applyAllInjections(
  projectDir: string,
  agent: AgentInstallation,
  extName: string,
  injections: ExtensionInjection[],
  extensionDir: string,
): Promise<number> {
  let count = 0;

  for (const injection of injections) {
    const contentPath = path.resolve(extensionDir, injection.file);
    const content = await readTextFile(contentPath);
    if (!content) {
      console.warn(`Warning: Injection file not found: ${contentPath}`);
      continue;
    }

    const applied = await applyInjection(projectDir, agent, extName, injection, content);
    if (applied) count++;
  }

  return count;
}

// --- Scan for existing injections ---

/** @public Used for injection diagnostics and conflict detection */
export async function scanInjections(
  projectDir: string,
  agent: AgentInstallation,
  injection: ExtensionInjection,
): Promise<string[]> {
  const targetPath = resolveInjectionTargetPath(projectDir, agent, injection);
  if (!targetPath || !(await fileExists(targetPath))) {
    return [];
  }

  const content = await readTextFile(targetPath);
  if (!content) return [];

  const extNames: string[] = [];
  const pattern = new RegExp(`<!-- ${MARKER_PREFIX}:([^:]+):${injection.target}:[^:]+:start -->`, 'g');
  let match;

  while ((match = pattern.exec(content)) !== null) {
    extNames.push(match[1]);
  }

  return extNames;
}
