import path from 'path';
import { execSync } from 'child_process';
import semver from 'semver';
import {
  readJsonFile, fileExists,
  copyDirectory, ensureDir, removeDirectory, listDirectories,
} from '../utils/fs.js';
import type { ExtensionRecord } from './config.js';

// --- Constants ---

const MANIFEST_FILENAME = 'extension.json';
const EXTENSIONS_DIR = '.unikit/extensions';
const EXT_NAME_PATTERN = /^[a-zA-Z0-9_@][\w.@/-]*$/;

// --- Types ---

export interface ExtensionInjection {
  target: string;
  targetType: 'skill' | 'subagent';
  position: 'append' | 'prepend';
  file: string;
}

export interface ExtensionMcpServer {
  key: string;
  template: string;
}

export interface ExtensionCommand {
  name: string;
  description: string;
  module: string;
}

export interface ExtensionManifest {
  name: string;
  version: string;
  description?: string;
  commands?: ExtensionCommand[];
  skills?: string[];
  subagents?: string[];
  replaces?: Record<string, string>;
  injections?: ExtensionInjection[];
  mcpServers?: ExtensionMcpServer[];
}

export type ExtensionSourceType = 'local' | 'git' | 'github';

export interface ExtensionSource {
  type: ExtensionSourceType;
  raw: string;
  resolved: string;
}

export interface ResolvedExtension {
  manifest: ExtensionManifest;
  source: ExtensionSource;
  localPath: string;
}

// --- Source classification ---

export function classifySource(raw: string): ExtensionSource {
  const normalized = raw.replaceAll('\\', '/');

  // Local path: starts with ./ ../ / or drive letter (C:)
  if (/^(\.\/|\.\.|\/|[a-zA-Z]:)/.test(normalized)) {
    return { type: 'local', raw, resolved: path.resolve(raw) };
  }

  // Git URL: starts with git://, https://*.git, or ssh://
  if (/^(git:\/\/|https?:\/\/.*\.git|ssh:\/\/)/.test(normalized) || normalized.endsWith('.git')) {
    return { type: 'git', raw, resolved: normalized };
  }

  // GitHub shorthand: owner/repo or owner/repo#ref
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(#.+)?$/.test(normalized)) {
    const [repo, ref] = normalized.split('#');

    return {
      type: 'github',
      raw,
      resolved: ref ? `https://github.com/${repo}.git#${ref}` : `https://github.com/${repo}.git`,
    };
  }

  // Fallback: treat as local path
  return { type: 'local', raw, resolved: path.resolve(raw) };
}

// --- Validation ---

export function validateExtensionName(name: string): string | null {
  if (!name) return 'Extension name is required';
  if (name.includes('..')) return 'Extension name must not contain ".." (path traversal)';
  if (path.isAbsolute(name)) return 'Extension name must not be an absolute path';
  if (!EXT_NAME_PATTERN.test(name)) {
    return `Extension name must start with alphanumeric/_ /@ and contain only word chars, dots, @, /, -`;
  }

  return null;
}

export function validateManifest(manifest: unknown): { valid: true; manifest: ExtensionManifest } | { valid: false; error: string } {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, error: 'Manifest must be a JSON object' };
  }

  const m = manifest as Record<string, unknown>;

  if (typeof m.name !== 'string' || !m.name) {
    return { valid: false, error: 'Manifest must have a string "name" field' };
  }

  const nameError = validateExtensionName(m.name as string);
  if (nameError) {
    return { valid: false, error: nameError };
  }

  if (typeof m.version !== 'string' || !semver.valid(m.version as string)) {
    return { valid: false, error: `Manifest "version" must be a valid semver string, got: ${m.version}` };
  }

  // Validate skills array
  if (m.skills !== undefined) {
    if (!Array.isArray(m.skills) || !m.skills.every((s: unknown) => typeof s === 'string')) {
      return { valid: false, error: '"skills" must be an array of strings' };
    }
  }

  // Validate subagents array
  if (m.subagents !== undefined) {
    if (!Array.isArray(m.subagents) || !m.subagents.every((s: unknown) => typeof s === 'string')) {
      return { valid: false, error: '"subagents" must be an array of strings' };
    }
  }

  // Validate replaces
  if (m.replaces !== undefined) {
    if (typeof m.replaces !== 'object' || m.replaces === null || Array.isArray(m.replaces)) {
      return { valid: false, error: '"replaces" must be an object mapping skill paths to base skill names' };
    }
    for (const [key, value] of Object.entries(m.replaces as Record<string, unknown>)) {
      if (typeof value !== 'string') {
        return { valid: false, error: `"replaces.${key}" must be a string (base skill name)` };
      }
    }
  }

  // Validate injections
  if (m.injections !== undefined) {
    if (!Array.isArray(m.injections)) {
      return { valid: false, error: '"injections" must be an array' };
    }
    for (let i = 0; i < m.injections.length; i++) {
      const inj = m.injections[i] as Record<string, unknown>;
      if (!inj || typeof inj !== 'object') {
        return { valid: false, error: `injections[${i}] must be an object` };
      }
      if (typeof inj.target !== 'string') {
        return { valid: false, error: `injections[${i}].target must be a string` };
      }
      if (typeof inj.file !== 'string') {
        return { valid: false, error: `injections[${i}].file must be a string` };
      }
      const targetType = inj.targetType ?? 'skill';
      if (targetType !== 'skill' && targetType !== 'subagent') {
        return { valid: false, error: `injections[${i}].targetType must be "skill" or "subagent"` };
      }
      if (inj.position !== 'append' && inj.position !== 'prepend') {
        return { valid: false, error: `injections[${i}].position must be "append" or "prepend"` };
      }
    }
  }

  // Validate commands
  if (m.commands !== undefined) {
    if (!Array.isArray(m.commands)) {
      return { valid: false, error: '"commands" must be an array' };
    }
    for (let i = 0; i < m.commands.length; i++) {
      const cmd = m.commands[i] as Record<string, unknown>;
      if (!cmd || typeof cmd !== 'object') {
        return { valid: false, error: `commands[${i}] must be an object` };
      }
      if (typeof cmd.name !== 'string') {
        return { valid: false, error: `commands[${i}].name must be a string` };
      }
      if (typeof cmd.description !== 'string') {
        return { valid: false, error: `commands[${i}].description must be a string` };
      }
      if (typeof cmd.module !== 'string') {
        return { valid: false, error: `commands[${i}].module must be a string` };
      }
    }
  }

  // Validate mcpServers
  if (m.mcpServers !== undefined) {
    if (!Array.isArray(m.mcpServers)) {
      return { valid: false, error: '"mcpServers" must be an array' };
    }
    for (let i = 0; i < m.mcpServers.length; i++) {
      const srv = m.mcpServers[i] as Record<string, unknown>;
      if (!srv || typeof srv !== 'object') {
        return { valid: false, error: `mcpServers[${i}] must be an object` };
      }
      if (typeof srv.key !== 'string') {
        return { valid: false, error: `mcpServers[${i}].key must be a string` };
      }
      if (typeof srv.template !== 'string') {
        return { valid: false, error: `mcpServers[${i}].template must be a string` };
      }
    }
  }

  // Normalize injections targetType default
  const injections = (m.injections as ExtensionInjection[] | undefined)?.map(inj => ({
    ...inj,
    targetType: (inj.targetType ?? 'skill') as 'skill' | 'subagent',
  }));

  return {
    valid: true,
    manifest: {
      name: m.name as string,
      version: m.version as string,
      description: typeof m.description === 'string' ? m.description : undefined,
      commands: m.commands as ExtensionCommand[] | undefined,
      skills: m.skills as string[] | undefined,
      subagents: m.subagents as string[] | undefined,
      replaces: m.replaces as Record<string, string> | undefined,
      injections,
      mcpServers: m.mcpServers as ExtensionMcpServer[] | undefined,
    },
  };
}

// --- Resolve from sources ---

export async function resolveFromLocal(localPath: string): Promise<ResolvedExtension> {
  const absPath = path.resolve(localPath);
  const manifestPath = path.join(absPath, MANIFEST_FILENAME);

  if (!(await fileExists(manifestPath))) {
    throw new Error(`No ${MANIFEST_FILENAME} found at ${absPath}`);
  }

  const raw = await readJsonFile<unknown>(manifestPath);
  const result = validateManifest(raw);

  if (!result.valid) {
    throw new Error(`Invalid manifest at ${manifestPath}: ${result.error}`);
  }

  return {
    manifest: result.manifest,
    source: { type: 'local', raw: localPath, resolved: absPath },
    localPath: absPath,
  };
}

export async function resolveFromGit(gitUrl: string): Promise<ResolvedExtension> {
  const { tmpdir } = await import('os');
  const tmpDir = path.join(tmpdir(), `unikit-ext-${Date.now()}`);

  try {
    const [url, ref] = gitUrl.split('#');

    const cloneArgs = ref
      ? `clone --depth 1 --branch ${ref} ${url} ${tmpDir}`
      : `clone --depth 1 ${url} ${tmpDir}`;

    execSync(`git ${cloneArgs}`, { stdio: 'pipe', timeout: 30000 });

    const manifestPath = path.join(tmpDir, MANIFEST_FILENAME);
    if (!(await fileExists(manifestPath))) {
      throw new Error(`No ${MANIFEST_FILENAME} found in cloned repository`);
    }

    const raw = await readJsonFile<unknown>(manifestPath);
    const result = validateManifest(raw);

    if (!result.valid) {
      throw new Error(`Invalid manifest in cloned repository: ${result.error}`);
    }

    return {
      manifest: result.manifest,
      source: { type: 'git', raw: gitUrl, resolved: gitUrl },
      localPath: tmpDir,
    };
  } catch (error) {
    await removeDirectory(tmpDir);
    throw error;
  }
}

export async function resolveExtension(sourceRaw: string): Promise<ResolvedExtension> {
  const source = classifySource(sourceRaw);

  switch (source.type) {
    case 'local':
      return resolveFromLocal(source.resolved);
    case 'git':
    case 'github':
      return resolveFromGit(source.resolved);
  }
}

// --- GitHub API version check ---

/** @public Lightweight version check for GitHub sources without full git clone */
export async function fetchGitHubManifest(
  owner: string,
  repo: string,
  ref?: string,
): Promise<ExtensionManifest | null> {
  const token = process.env['GITHUB_TOKEN'];
  const branch = ref ?? 'main';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${MANIFEST_FILENAME}?ref=${branch}`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
    'User-Agent': 'unikit-ai',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 403) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        console.warn('GitHub API rate limit exceeded. Set GITHUB_TOKEN to increase limit.');
      }

      return null;
    }

    if (!response.ok) return null;

    const raw = await response.json();
    const result = validateManifest(raw);

    return result.valid ? result.manifest : null;
  } catch {
    return null;
  }
}

// --- Extension storage ---

export function getExtensionsDir(projectDir: string): string {
  return path.join(projectDir, EXTENSIONS_DIR);
}

export function getExtensionDir(projectDir: string, extensionName: string): string {
  return path.join(projectDir, EXTENSIONS_DIR, extensionName);
}

export async function commitExtensionInstall(
  projectDir: string,
  resolved: ResolvedExtension,
): Promise<void> {
  const targetDir = getExtensionDir(projectDir, resolved.manifest.name);

  // Remove previous version if exists
  await removeDirectory(targetDir);
  await ensureDir(targetDir);

  // Copy extension files
  await copyDirectory(resolved.localPath, targetDir);

  // Clean up git clone temp dir
  if (resolved.source.type === 'git' || resolved.source.type === 'github') {
    await removeDirectory(resolved.localPath);
  }
}

export async function removeExtensionFiles(
  projectDir: string,
  extensionName: string,
): Promise<void> {
  const targetDir = getExtensionDir(projectDir, extensionName);
  await removeDirectory(targetDir);
}

/** @public Used for config/disk integrity reconciliation */
export async function listInstalledExtensions(projectDir: string): Promise<string[]> {
  const extDir = getExtensionsDir(projectDir);
  if (!(await fileExists(extDir))) return [];

  return listDirectories(extDir);
}

export async function loadExtensionManifest(
  extensionDir: string,
): Promise<ExtensionManifest | null> {
  const manifestPath = path.join(extensionDir, MANIFEST_FILENAME);
  const raw = await readJsonFile<unknown>(manifestPath);
  if (!raw) return null;

  const result = validateManifest(raw);

  return result.valid ? result.manifest : null;
}

export async function loadAllExtensions(
  projectDir: string,
  registeredNames: string[],
): Promise<{ dir: string; manifest: ExtensionManifest }[]> {
  const results: { dir: string; manifest: ExtensionManifest }[] = [];

  for (const name of registeredNames) {
    const nameError = validateExtensionName(name);
    if (nameError) continue;

    const extDir = getExtensionDir(projectDir, name);
    const manifest = await loadExtensionManifest(extDir);
    if (manifest) {
      results.push({ dir: extDir, manifest });
    }
  }

  return results;
}

// --- Extension record helpers ---

export function buildExtensionRecord(resolved: ResolvedExtension): ExtensionRecord {
  const replacedSkills = resolved.manifest.replaces
    ? Object.fromEntries(
      Object.entries(resolved.manifest.replaces).map(([skillPath, baseName]) => [baseName, skillPath]),
    )
    : undefined;

  return {
    name: resolved.manifest.name,
    source: resolved.source.raw,
    version: resolved.manifest.version,
    replacedSkills,
  };
}

export function findExtensionRecord(
  extensions: ExtensionRecord[],
  name: string,
): ExtensionRecord | undefined {
  return extensions.find(ext => ext.name === name);
}

// --- Conflict detection ---

export function checkReplacementConflicts(
  existingExtensions: ExtensionRecord[],
  newManifest: ExtensionManifest,
): string[] {
  const conflicts: string[] = [];

  if (!newManifest.replaces) return conflicts;

  const existingReplacements = new Map<string, string>();
  for (const ext of existingExtensions) {
    if (ext.replacedSkills) {
      for (const baseName of Object.keys(ext.replacedSkills)) {
        existingReplacements.set(baseName, ext.name);
      }
    }
  }

  for (const baseName of Object.values(newManifest.replaces)) {
    const existingOwner = existingReplacements.get(baseName);
    if (existingOwner && existingOwner !== newManifest.name) {
      conflicts.push(`Skill "${baseName}" is already replaced by extension "${existingOwner}"`);
    }
  }

  return conflicts;
}
