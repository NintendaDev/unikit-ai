// --- Registry validator ---
// Validates a registry URL: format check → fetch manifest → JSON parse → shape check.
// Two modes: strict (abort on failure) and soft (warn + return null for fallback).

import type { RegistryManifest } from './manifest-types.js';
import type { RulesRegistry } from './index.js';
import { GitRegistry } from './git-registry.js';
import { FsRegistry } from './fs-registry.js';
import { logInfo, logWarn, logError } from '../../utils/log.js';

export type ValidationMode = 'strict' | 'soft';

export type ValidationErrorCode =
  | 'URL_FORMAT'
  | 'FETCH_FAILED'
  | 'SHAPE_INVALID'
  | 'ENGINE_NOT_FOUND';

export interface ValidationResult {
  valid: boolean;
  manifest: RegistryManifest | null;
  error: string | null;
  code: ValidationErrorCode | null;
}

const BRANCH_CANDIDATES = ['main', 'master'];

/**
 * Normalize a GitHub URL to raw.githubusercontent.com format.
 * Synchronous part — rewrites github.com URLs, detects missing branch.
 * Returns { url, needsBranchProbe } — if branch is missing, caller must probe.
 */
function normalizeGitHubUrl(url: string): { url: string; needsBranchProbe: boolean } {
  let u = url.trim().replace(/\/+$/, '');

  // github.com/owner/repo/tree/branch → raw with explicit branch
  const ghWithBranch = u.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)\/tree\/(.+)$/);
  if (ghWithBranch) {
    const repoPath = ghWithBranch[1].replace(/\.git$/, '');
    return { url: `https://raw.githubusercontent.com/${repoPath}/${ghWithBranch[2]}`, needsBranchProbe: false };
  }

  // github.com/owner/repo (no branch) → raw, needs probe
  const ghNoBranch = u.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (ghNoBranch) {
    return { url: `https://raw.githubusercontent.com/${ghNoBranch[1]}`, needsBranchProbe: true };
  }

  // raw.githubusercontent.com/owner/repo (no branch) → needs probe
  const rawNoBranch = u.match(/^https?:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+$/);
  if (rawNoBranch) {
    return { url: u, needsBranchProbe: true };
  }

  return { url: u, needsBranchProbe: false };
}

/**
 * Normalize a registry URL. For GitHub URLs without a branch,
 * probes main then master to find the correct default branch.
 */
export async function normalizeRegistryUrl(url: string): Promise<string> {
  const { url: normalized, needsBranchProbe } = normalizeGitHubUrl(url);

  if (!needsBranchProbe) {
    return normalized;
  }

  // Probe branches: try fetching manifest.json with each candidate
  for (const branch of BRANCH_CANDIDATES) {
    const candidate = `${normalized}/${branch}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(`${candidate}/manifest.json`, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        logInfo('normalizeUrl', `detected branch: ${branch}`);
        return candidate;
      }
    } catch {
      // ignore, try next
    }
  }

  // Fallback to main if probe fails (will fail at validation)
  logWarn('normalizeUrl', `could not detect branch for ${normalized}, defaulting to main`);
  return `${normalized}/main`;
}

/**
 * Validate a registry URL format.
 * Allowed: http://, https://, file://, absolute paths, ~/ paths.
 * Rejected: relative paths, empty strings.
 */
export function validateUrlFormat(url: string): string | null {
  if (!url || url.trim().length === 0) {
    return 'URL is empty';
  }

  const trimmed = url.trim();

  // HTTP/HTTPS
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return null; // valid
  }

  // file:// URI
  if (trimmed.startsWith('file://')) {
    return null; // valid
  }

  // Tilde home expansion
  if (trimmed.startsWith('~/') || trimmed === '~') {
    return null; // valid
  }

  // Absolute paths (Unix or Windows)
  if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return null; // valid
  }

  return `relative paths not allowed: "${trimmed}" — use absolute path, file://, or https://`;
}

/**
 * Validate manifest shape (hand-rolled, no JSON Schema).
 * Checks: schema === 1, engines is an object, engines has at least one key.
 */
export function validateManifestShape(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== 'object') {
    return 'manifest is not an object';
  }

  const m = manifest as Record<string, unknown>;

  if (m.schema !== 1) {
    return `unsupported manifest schema: ${m.schema} (expected 1)`;
  }

  if (!m.engines || typeof m.engines !== 'object' || Array.isArray(m.engines)) {
    return 'manifest.engines must be an object';
  }

  const engineKeys = Object.keys(m.engines as Record<string, unknown>);
  if (engineKeys.length === 0) {
    return 'manifest.engines is empty — no engines defined';
  }

  // Validate each engine has core/stack arrays
  for (const engineId of engineKeys) {
    const engine = (m.engines as Record<string, unknown>)[engineId];
    if (!engine || typeof engine !== 'object') {
      return `manifest.engines.${engineId} is not an object`;
    }

    const e = engine as Record<string, unknown>;
    if (!Array.isArray(e.core)) {
      return `manifest.engines.${engineId}.core must be an array`;
    }
    if (!Array.isArray(e.stack)) {
      return `manifest.engines.${engineId}.stack must be an array`;
    }
  }

  return null; // valid
}

/**
 * Validate a specific engine exists in the manifest.
 */
export function validateEngineExists(manifest: RegistryManifest, engineId: string): string | null {
  if (!manifest.engines[engineId]) {
    const available = Object.keys(manifest.engines).join(', ');
    return `engine "${engineId}" not found in manifest (available: ${available})`;
  }
  return null;
}

/**
 * Full validation pipeline: URL format → fetch manifest → shape check → engine check.
 *
 * @param url - Registry URL to validate
 * @param engineId - Engine to check for in the manifest
 * @param mode - "strict" logs errors, "soft" logs warnings
 * @returns ValidationResult with valid flag, manifest (if successful), and error message
 */
export async function validateRegistry(
  url: string,
  engineId: string,
  mode: ValidationMode,
): Promise<ValidationResult> {
  const TAG = `Validator:${mode}`;
  const log = mode === 'strict' ? (msg: string) => logError(TAG, msg) : (msg: string) => logWarn(TAG, msg);

  // Step 1: URL format check
  const formatError = validateUrlFormat(url);
  if (formatError) {
    log(formatError);
    return { valid: false, manifest: null, error: formatError, code: 'URL_FORMAT' };
  }

  // Step 2: Fetch manifest — validate the exact URL, no hybrid fallback
  let registry: RulesRegistry;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    registry = new GitRegistry(url);
  } else {
    const fsRegistry = new FsRegistry(url);
    if (!fsRegistry.isValid()) {
      const error = `invalid path: "${url}" — must be absolute`;
      log(error);
      return { valid: false, manifest: null, error, code: 'URL_FORMAT' };
    }
    registry = fsRegistry;
  }

  const manifest = await registry.fetchManifest();
  if (!manifest) {
    const error = `failed to fetch manifest from ${url}`;
    log(error);
    return { valid: false, manifest: null, error, code: 'FETCH_FAILED' };
  }

  // Step 3: Shape check
  const shapeError = validateManifestShape(manifest);
  if (shapeError) {
    log(shapeError);
    return { valid: false, manifest: null, error: shapeError, code: 'SHAPE_INVALID' };
  }

  // Step 4: Engine exists
  const engineError = validateEngineExists(manifest, engineId);
  if (engineError) {
    log(engineError);
    return { valid: false, manifest, error: engineError, code: 'ENGINE_NOT_FOUND' };
  }

  logInfo(TAG, `validation passed for ${url} (engine: ${engineId})`);
  return { valid: true, manifest, error: null, code: null };
}
