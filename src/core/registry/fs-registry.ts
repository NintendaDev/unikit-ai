// --- FsRegistry: Local filesystem transport ---

import path from 'path';
import os from 'os';
import type { RulesRegistry } from './index.js';
import type { RegistryManifest, RuleCategory, ModuleId, FetchedRule, FetchedReference } from './manifest-types.js';
import { manifestSummary } from './manifest-types.js';
import { ruleTierSegments } from './rule-path.js';
import { readTextFile, readJsonFile, fileExists } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

const TAG = 'FsRegistry';

/**
 * Resolve a user-supplied path to an absolute directory.
 * Supports: absolute paths, file:// URIs, ~/ home expansion.
 * Rejects relative paths (returns null).
 *
 * Exported so the maintainer `rules registry migrate` / `status` commands can
 * resolve a configured local `rulesRegistry` value through the exact same logic
 * the FS transport uses — no duplicated path handling.
 */
export function resolveRegistryPath(raw: string): string | null {
  let cleaned = raw;

  // file:// URI → path
  if (cleaned.startsWith('file://')) {
    cleaned = cleaned.slice('file://'.length);
    // On Windows file:///C:/... → C:/...
    if (/^\/[A-Za-z]:/.test(cleaned)) {
      cleaned = cleaned.slice(1);
    }
  }

  // ~/ → home dir
  if (cleaned.startsWith('~/') || cleaned === '~') {
    cleaned = path.join(os.homedir(), cleaned.slice(1));
  }

  // Reject relative paths
  if (!path.isAbsolute(cleaned)) {
    return null;
  }

  return path.normalize(cleaned);
}

export class FsRegistry implements RulesRegistry {
  readonly label: string;
  private readonly rootDir: string | null;
  private readonly rawPath: string;
  // PHYSICAL schema of the source, cached from the last successful
  // `fetchManifest`. Drives the rule path layout (flat vs `code/`-prefixed).
  private physicalSchema: number | null = null;

  constructor(pathOrUri: string) {
    this.rawPath = pathOrUri;
    this.rootDir = resolveRegistryPath(pathOrUri);
    this.label = `fs:${this.rootDir ?? pathOrUri}`;
  }

  async fetchManifest(): Promise<RegistryManifest | null> {
    if (!this.rootDir) {
      logWarn(TAG, `relative path not allowed: ${this.rawPath}`);
      return null;
    }

    const manifestPath = path.join(this.rootDir, 'manifest.json');
    logInfo(TAG, `fetchManifest ${manifestPath}`);

    const exists = await fileExists(manifestPath);
    if (!exists) {
      logWarn(TAG, `manifest not found: ${manifestPath}`);
      return null;
    }

    const manifest = await readJsonFile<RegistryManifest>(manifestPath);
    if (!manifest) {
      logWarn(TAG, `manifest parse failed: ${manifestPath}`);
      return null;
    }

    this.physicalSchema = typeof manifest.schema === 'number' ? manifest.schema : null;
    logInfo(TAG, `manifest loaded, schema=${manifest.schema}, ${manifestSummary(manifest)}`);
    return manifest;
  }

  async fetchRule(
    module: ModuleId,
    engineId: string,
    category: RuleCategory,
    ruleId: string,
  ): Promise<FetchedRule | null> {
    if (!this.rootDir) {
      logWarn(TAG, `relative path not allowed: ${this.rawPath}`);
      return null;
    }

    const schema = await this.resolvePhysicalSchema();
    const filePath = path.join(this.rootDir, ...ruleTierSegments(schema, module, engineId, category), `${ruleId}.md`);
    logInfo(TAG, `fetchRule ${filePath}`);

    const content = await readTextFile(filePath);
    if (content === null) {
      logWarn(TAG, `rule file not found: ${filePath}`);
      return null;
    }

    return { id: ruleId, category, content };
  }

  async fetchReferences(
    module: ModuleId,
    engineId: string,
    category: RuleCategory,
    ruleId: string,
    filenames: string[],
  ): Promise<FetchedReference[]> {
    if (filenames.length === 0 || !this.rootDir) {
      return [];
    }

    const schema = await this.resolvePhysicalSchema();
    const tierDir = path.join(this.rootDir, ...ruleTierSegments(schema, module, engineId, category));
    logInfo(TAG, `fetchReferences ${tierDir}/${ruleId}: [${filenames.join(', ')}]`);
    const results: FetchedReference[] = [];

    for (const filename of filenames) {
      const refPath = path.join(tierDir, 'references', filename);
      const content = await readTextFile(refPath);
      if (content !== null) {
        results.push({ filename, content });
      } else {
        logWarn(TAG, `reference not found: ${refPath}`);
      }
    }

    return results;
  }

  /** Check if the path was resolved successfully (not relative). */
  isValid(): boolean {
    return this.rootDir !== null;
  }

  /**
   * Physical schema for path building. Lazily loads the manifest once if a rule
   * fetch races ahead of it; defaults to 1 (flat layout) when the manifest is
   * absent so behaviour matches the legacy default.
   */
  private async resolvePhysicalSchema(): Promise<number> {
    if (this.physicalSchema === null) {
      await this.fetchManifest();
    }
    return this.physicalSchema ?? 1;
  }
}
