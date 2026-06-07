// --- Registry validator ---
// Validates a registry URL: format check → fetch manifest → JSON parse → shape check.
// Two modes: strict (abort on failure) and soft (warn + return null for fallback).

import type { RegistryManifest } from './manifest-types.js';
import { LATEST_SCHEMA } from './manifest-types.js';
import { CODE_MODULE_ID } from '../constants.js';
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
 * Schema-agnostic list of engine ids declared by a manifest, raw or normalized.
 *
 * schema:1 exposes engines at the manifest root (`engines`); schema:2 nests the
 * engine-partitioned `code` module under `modules.code.engines`. Every site that
 * needs "what engines does this registry offer" (wizard, `rules list/install`
 * not-found messages, `validateEngineExists`) must go through this helper rather
 * than touching `manifest.engines` directly, which is `undefined` on a raw
 * schema:2 manifest. Prefers the schema:2 module map and falls back to the flat
 * `engines` (covers both schema:1 sources and normalized compat mirrors).
 */
export function manifestEngineIds(manifest: RegistryManifest): string[] {
  const m = manifest as unknown as Record<string, unknown>;
  const modules = m.modules as Record<string, { engines?: Record<string, unknown> }> | undefined;
  const codeEngines = modules?.[CODE_MODULE_ID]?.engines;
  if (codeEngines && typeof codeEngines === 'object') {
    return Object.keys(codeEngines);
  }
  const engines = m.engines as Record<string, unknown> | undefined;
  return engines && typeof engines === 'object' ? Object.keys(engines) : [];
}

/** Validate one engine's `{core, stack}` tier arrays. */
function validateEngineTiers(engines: Record<string, unknown>, scope: string): string | null {
  for (const engineId of Object.keys(engines)) {
    const engine = engines[engineId];
    if (!engine || typeof engine !== 'object') {
      return `${scope}.${engineId} is not an object`;
    }
    const e = engine as Record<string, unknown>;
    if (!Array.isArray(e.core)) {
      return `${scope}.${engineId}.core must be an array`;
    }
    if (!Array.isArray(e.stack)) {
      return `${scope}.${engineId}.stack must be an array`;
    }
  }
  return null;
}

/**
 * Validate manifest shape (hand-rolled, no JSON Schema).
 *
 * Branches by schema version:
 *  - schema 1 → validate `engines` is a non-empty object of `{core, stack}`.
 *  - schema 2 → validate `modules.code.engines` is a non-empty object of
 *               `{core, stack}` (the engine-partitioned module). The raw
 *               schema:2 manifest has no top-level `engines`, so the schema:1
 *               branch would wrongly reject it.
 *  - schema > LATEST_SCHEMA → unsupported (caller maps to exit 5).
 */
export function validateManifestShape(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== 'object') {
    return 'manifest is not an object';
  }

  const m = manifest as Record<string, unknown>;

  if (typeof m.schema !== 'number' || m.schema < 1) {
    return `unsupported manifest schema: ${m.schema} (expected 1..${LATEST_SCHEMA})`;
  }
  if (m.schema > LATEST_SCHEMA) {
    return `unsupported manifest schema: ${m.schema} (this CLI supports up to ${LATEST_SCHEMA} — upgrade unikit-ai)`;
  }

  if (m.schema >= 2) {
    if (!m.modules || typeof m.modules !== 'object' || Array.isArray(m.modules)) {
      return 'manifest.modules must be an object';
    }
    const codeModule = (m.modules as Record<string, unknown>)[CODE_MODULE_ID];
    if (!codeModule || typeof codeModule !== 'object') {
      return `manifest.modules.${CODE_MODULE_ID} is not an object`;
    }
    const codeEngines = (codeModule as Record<string, unknown>).engines;
    if (!codeEngines || typeof codeEngines !== 'object' || Array.isArray(codeEngines)) {
      return `manifest.modules.${CODE_MODULE_ID}.engines must be an object`;
    }
    if (Object.keys(codeEngines as Record<string, unknown>).length === 0) {
      return `manifest.modules.${CODE_MODULE_ID}.engines is empty — no engines defined`;
    }
    return validateEngineTiers(
      codeEngines as Record<string, unknown>,
      `manifest.modules.${CODE_MODULE_ID}.engines`,
    );
  }

  // schema 1
  if (!m.engines || typeof m.engines !== 'object' || Array.isArray(m.engines)) {
    return 'manifest.engines must be an object';
  }
  const engineKeys = Object.keys(m.engines as Record<string, unknown>);
  if (engineKeys.length === 0) {
    return 'manifest.engines is empty — no engines defined';
  }
  return validateEngineTiers(m.engines as Record<string, unknown>, 'manifest.engines');
}

/**
 * Validate a specific engine exists in the manifest (schema-agnostic).
 */
export function validateEngineExists(manifest: RegistryManifest, engineId: string): string | null {
  const available = manifestEngineIds(manifest);
  if (!available.includes(engineId)) {
    return `engine "${engineId}" not found in manifest (available: ${available.join(', ')})`;
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
