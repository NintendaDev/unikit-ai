// --- RulesRegistry interface + public re-exports + factory ---

export type {
  RegistryManifest,
  RegistryRule,
  EngineRules,
  RuleCategory,
  FetchedRule,
  FetchedReference,
} from './manifest-types.js';

export { GitRegistry } from './git-registry.js';
export { FsRegistry } from './fs-registry.js';
export { ApiRegistry } from './api-registry.js';
export { HybridRegistry } from './hybrid-registry.js';

import type { RegistryManifest, RuleCategory, FetchedRule, FetchedReference } from './manifest-types.js';
import { GitRegistry } from './git-registry.js';
import { FsRegistry } from './fs-registry.js';
import { ApiRegistry } from './api-registry.js';
import { HybridRegistry } from './hybrid-registry.js';
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
 *  - HybridRegistry — primary → official chain with per-engine fallback
 */
export interface RulesRegistry {
  /** Human-readable label for logging (e.g. "git:NintendaDev/unikit-ai-rules", "fs:/home/dev/rules"). */
  readonly label: string;

  /** Fetch and parse the full manifest.json. Returns null on failure. */
  fetchManifest(): Promise<RegistryManifest | null>;

  /**
   * Fetch the markdown content of a single rule.
   * Path derivation: <engineId>/<category>/<ruleId>.md
   * Returns null if the rule file cannot be fetched.
   */
  fetchRule(engineId: string, category: RuleCategory, ruleId: string): Promise<FetchedRule | null>;

  /**
   * Fetch all reference files for a rule.
   * Path derivation: <engineId>/<category>/references/<filename>
   * Returns an empty array if no references or on failure.
   */
  fetchReferences(engineId: string, category: RuleCategory, ruleId: string, filenames: string[]): Promise<FetchedReference[]>;
}

/**
 * Build a registry chain for the given URL and engine.
 *
 * URL detection:
 *  - http:// or https:// → GitRegistry
 *  - file:// or absolute path or ~/ → FsRegistry
 *  - null → official GitRegistry only (no primary)
 *
 * Returns a HybridRegistry that chains primary → official → bundled with per-engine fallback.
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
): HybridRegistry {
  const official = new GitRegistry(OFFICIAL_REGISTRY_URL);

  const resolvedBundledPath = bundledPath === undefined ? getBundledRegistryDir() : bundledPath;
  const bundled = resolvedBundledPath ? new FsRegistry(resolvedBundledPath) : undefined;

  // Treat "url equals the official URL" the same as "no custom URL". The
  // wizard stores OFFICIAL_REGISTRY_URL verbatim into `.unikit.json.rulesRegistry`
  // when the user declines a custom registry (so `rules status` always
  // advertises a concrete source). Without this short-circuit we would build
  // a separate `primary` GitRegistry instance pointing at the same URL as
  // `official`, the reference-identity check in
  // `HybridRegistry.getResolvedOrigin()` would fail, and every installed rule
  // would be tagged `origin: 'primary'` in `.unikit.json` even though the
  // content actually came from the official registry. Folding the two cases
  // here keeps the origin semantics honest.
  if (!url || url === OFFICIAL_REGISTRY_URL) {
    // No custom registry — official is both primary and fallback
    logInfo('createRegistry', 'no custom URL (or url equals official), using official only');
    return new HybridRegistry(official, official, engineId, bundled);
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
  logInfo('createRegistry', `primary=${primary.label}, official=${official.label}, bundled=${bundledLabel}, engine=${engineId}`);
  return new HybridRegistry(primary, official, engineId, bundled);
}
