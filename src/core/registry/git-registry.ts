// --- GitRegistry: HTTP transport via raw.githubusercontent.com ---

import type { RulesRegistry } from './index.js';
import type { RegistryManifest, RuleCategory, ModuleId, FetchedRule, FetchedReference } from './manifest-types.js';
import { manifestSummary } from './manifest-types.js';
import { ruleTierSegments } from './rule-path.js';
import { logInfo, logWarn } from '../../utils/log.js';

const TAG = 'GitRegistry';
const DEFAULT_TIMEOUT_MS = 10_000;

export class GitRegistry implements RulesRegistry {
  readonly label: string;
  private readonly baseUrl: string;
  // PHYSICAL schema of the source, cached from the last successful
  // `fetchManifest`. Drives the rule path layout (flat vs `code/`-prefixed).
  private physicalSchema: number | null = null;

  /**
   * @param url — Raw base URL, e.g. "https://raw.githubusercontent.com/NintendaDev/unikit-ai-rules/main"
   *              Trailing slash is stripped if present.
   */
  constructor(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
    this.label = `git:${this.baseUrl}`;
  }

  async fetchManifest(): Promise<RegistryManifest | null> {
    const url = `${this.baseUrl}/manifest.json`;
    logInfo(TAG, `fetchManifest ${url}`);

    const text = await this.httpGet(url);
    if (text === null) {
      return null;
    }

    try {
      const parsed = JSON.parse(text) as RegistryManifest;
      this.physicalSchema = typeof parsed.schema === 'number' ? parsed.schema : null;
      logInfo(TAG, `manifest parsed, schema=${parsed.schema}, ${manifestSummary(parsed)}`);
      return parsed;
    } catch (err) {
      logWarn(TAG, `manifest JSON parse error: ${(err as Error).message}`);
      return null;
    }
  }

  async fetchRule(
    module: ModuleId,
    engineId: string,
    category: RuleCategory,
    ruleId: string,
  ): Promise<FetchedRule | null> {
    const schema = await this.resolvePhysicalSchema();
    const dir = ruleTierSegments(schema, module, engineId, category).join('/');
    const url = `${this.baseUrl}/${dir}/${ruleId}.md`;
    logInfo(TAG, `fetchRule ${url}`);

    const content = await this.httpGet(url);
    if (content === null) {
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
    if (filenames.length === 0) {
      return [];
    }

    const schema = await this.resolvePhysicalSchema();
    const dir = ruleTierSegments(schema, module, engineId, category).join('/');
    logInfo(TAG, `fetchReferences ${dir}/${ruleId}: [${filenames.join(', ')}]`);
    const results: FetchedReference[] = [];

    for (const filename of filenames) {
      const url = `${this.baseUrl}/${dir}/references/${filename}`;
      const content = await this.httpGet(url);
      if (content !== null) {
        results.push({ filename, content });
      } else {
        logWarn(TAG, `reference fetch failed: ${filename}`);
      }
    }

    return results;
  }

  /**
   * Physical schema for path building. Lazily fetches the manifest once if a
   * rule fetch races ahead of it; defaults to 1 (flat layout) when the source
   * is unreachable so behaviour matches the legacy default.
   */
  private async resolvePhysicalSchema(): Promise<number> {
    if (this.physicalSchema === null) {
      await this.fetchManifest();
    }
    return this.physicalSchema ?? 1;
  }

  // --- Internal ---

  private async httpGet(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        logWarn(TAG, `HTTP ${response.status} for ${url}`);
        return null;
      }

      return await response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logWarn(TAG, `fetch error for ${url}: ${msg}`);
      return null;
    }
  }
}
