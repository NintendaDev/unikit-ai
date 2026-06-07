// --- RulesRegistry interface + public re-exports + factory ---

export type {
  RegistryManifest,
  RegistryRule,
  EngineRules,
  ModuleManifest,
  RuleCategory,
  Tier,
  ModuleId,
  FetchedRule,
  FetchedReference,
} from './manifest-types.js';
export { LATEST_SCHEMA } from './manifest-types.js';
export { manifestEngineIds } from './validator.js';

export { GitRegistry } from './git-registry.js';
export { FsRegistry } from './fs-registry.js';
export { ApiRegistry } from './api-registry.js';
export { ChainedRegistry } from './chained-registry.js';
export { HybridRegistry } from './hybrid-registry.js';
export { OfficialRegistry } from './official-registry.js';

import type { RegistryManifest, RuleCategory, ModuleId, FetchedRule, FetchedReference } from './manifest-types.js';
import { GitRegistry } from './git-registry.js';
import { FsRegistry } from './fs-registry.js';
import { ApiRegistry } from './api-registry.js';
import { ChainedRegistry } from './chained-registry.js';
import { HybridRegistry } from './hybrid-registry.js';
import { OfficialRegistry } from './official-registry.js';
import { getBundledRegistryDir } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

/** Official rules repository (raw.githubusercontent). */
export const OFFICIAL_REGISTRY_URL = 'https://raw.githubusercontent.com/NintendaDev/unikit-ai-rules/main';

/** Registry source kind — mirrors the detection in `createRegistry`. */
export type RegistryKind = 'url' | 'local';

/**
 * Resolve the registry URL the CLI should actually talk to.
 *
 * `null` (or empty) in `.unikit.json.rulesRegistry` means "no custom registry
 * configured" — the runtime always falls back to the official registry, and
 * every user-facing display (status, registry GET) should advertise the
 * official URL rather than "not configured" so users see the concrete source
 * the CLI will hit.
 *
 * Use this everywhere a *displayable* / *URL-to-call* value is needed.
 * Use the raw `config.rulesRegistry` only when you need to distinguish
 * "user explicitly set this" from "default" — the new
 * `rules status --json registryConfigured` boolean exposes that bit.
 */
export function resolveRegistryUrl(stored: string | null | undefined): string {
  if (!stored) return OFFICIAL_REGISTRY_URL;
  const trimmed = stored.trim();
  return trimmed.length === 0 ? OFFICIAL_REGISTRY_URL : trimmed;
}

/**
 * Classify a stored registry value without instantiating a transport.
 * Returns null for an empty/null input (no configured registry).
 *
 * Shared helper used by CLI JSON outputs and skills so nobody parses the raw
 * string themselves. Relative paths still return `null` — they are rejected
 * by `validateUrlFormat` earlier in the flow, so they should not reach here.
 */
export function detectRegistryKind(input: string | null | undefined): RegistryKind | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return 'url';
  if (trimmed.startsWith('file://')) return 'local';
  if (trimmed.startsWith('/') || trimmed.startsWith('~/') || trimmed === '~') return 'local';
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return 'local';

  return null;
}

/**
 * Abstract transport for fetching rules from a registry source.
 *
 * Implementations:
 *  - GitRegistry  — HTTP via raw.githubusercontent.com
 *  - FsRegistry   — local filesystem (absolute path / file:// / ~/)
 *  - ApiRegistry   — REST API stub (always fails, Phase 2)
 *  - HybridRegistry — primary → official → bundled chain (custom URL)
 *  - OfficialRegistry — official → bundled chain (no custom URL / official URL)
 */
export interface RulesRegistry {
  /** Human-readable label for logging (e.g. "git:NintendaDev/unikit-ai-rules", "fs:/home/dev/rules"). */
  readonly label: string;

  /** Fetch and parse the full manifest.json. Returns null on failure. */
  fetchManifest(): Promise<RegistryManifest | null>;

  /**
   * Fetch the markdown content of a single rule.
   *
   * Path derivation depends on the source's PHYSICAL schema (see
   * `rule-path.ruleTierSegments`):
   *   schema 1 → `<engineId>/<category>/<ruleId>.md`
   *   schema 2 → `<module>/<engineId>/<category>/<ruleId>.md` (engine-partitioned)
   *            → `<module>/<category>/<ruleId>.md`            (non-engine module)
   * Returns null if the rule file cannot be fetched.
   */
  fetchRule(module: ModuleId, engineId: string, category: RuleCategory, ruleId: string): Promise<FetchedRule | null>;

  /**
   * Fetch all reference files for a rule. References live in a `references/`
   * subdirectory of the rule's tier dir; the tier dir is derived exactly as in
   * `fetchRule` (schema-aware, module-shaped).
   * Returns an empty array if no references or on failure.
   */
  fetchReferences(module: ModuleId, engineId: string, category: RuleCategory, ruleId: string, filenames: string[]): Promise<FetchedReference[]>;
}

/**
 * Build a registry chain for the given URL and engine.
 *
 * URL detection:
 *  - null | '' | url === OFFICIAL_REGISTRY_URL → OfficialRegistry (official → bundled)
 *  - http(s):// → HybridRegistry with GitRegistry primary
 *  - file:// | absolute path | ~/... | drive-letter path → HybridRegistry with FsRegistry primary
 *  - otherwise → HybridRegistry with ApiRegistry primary (stub fallback)
 *
 * Returns a ChainedRegistry; the concrete subclass reflects the chain
 * semantics and is what origin tagging keys off of.
 *
 * The bundled registry is an FsRegistry over `./rules-registry` (populated by
 * scripts/download-rules.sh at npm publish / CI / dev test-guards). It is the
 * offline-safe last-resort source. Pass `bundledPath=null` to explicitly disable
 * the bundled level (e.g. for isolated tests).
 */
export function createRegistry(
  url: string | null,
  engineId: string,
  bundledPath?: string | null,
): ChainedRegistry {
  const officialGit = new GitRegistry(OFFICIAL_REGISTRY_URL);

  const resolvedBundledPath = bundledPath === undefined ? getBundledRegistryDir() : bundledPath;
  const bundled = resolvedBundledPath ? new FsRegistry(resolvedBundledPath) : undefined;

  // No-custom-URL / explicit-official case: origin tagging is intrinsic to
  // `OfficialRegistry` (chain = [official, bundled]), so we avoid the duplicate
  // fetch that would happen if we built a HybridRegistry with primary===official.
  if (!url || url === OFFICIAL_REGISTRY_URL) {
    logInfo('createRegistry', 'no custom URL (or url equals official), using OfficialRegistry (official → bundled)');
    return new OfficialRegistry(officialGit, engineId, bundled);
  }

  let primary: RulesRegistry;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    primary = new GitRegistry(url);
  } else if (url.startsWith('file://') || url.startsWith('/') || url.startsWith('~/') || /^[A-Za-z]:[\\/]/.test(url)) {
    primary = new FsRegistry(url);
  } else {
    // Fallback: try as API stub (will always return null → official takes over)
    logWarn('createRegistry', `unrecognized URL format "${url}", using API stub`);
    primary = new ApiRegistry(url);
  }

  const bundledLabel = bundled ? bundled.label : 'none';
  logInfo('createRegistry', `primary=${primary.label}, official=${officialGit.label}, bundled=${bundledLabel}, engine=${engineId}`);
  return new HybridRegistry(primary, officialGit, engineId, bundled);
}
