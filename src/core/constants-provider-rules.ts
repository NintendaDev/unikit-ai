import path from 'path';
import { CODE_MODULE_ID, moduleTierDir } from './constants.js';

export const PROVIDER_RULE_LOG = 'provider-rules';
export const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const PROVIDER_RULE_TIER = 'stack';
export const PROVIDER_RULE_EXTENSION = '.md';
export const PROVIDER_CANDIDATE_SEPARATOR = '\u0000';
export const PROVIDER_REFERENCE_PATTERN = /^[^/\\]+\.md$/;
export const PROVIDER_RULE_PROMPT = 'Which MCP / bridge rules should be installed?';
export const PROVIDER_RULE_LOADING = 'Loading available MCP / bridge rules...';
export const PROVIDER_RULE_PENDING = 'New MCP / bridge rules need your choice. Run unikit-ai init to select them.';
export const PROVIDER_RULE_CANCELLED = 'MCP / bridge rule selection cancelled.';
export const PROVIDER_RULE_SETUP_SUMMARY = '  MCP / bridge rules: selected during setup. Run /unikit for core and other stack rules.';
export const PROVIDER_PROMPT_EXIT_ERROR = 'ExitPromptError';
export const PROVIDER_PROMPT_CANCEL_MARKER = 'User force closed';
export const PROVIDER_RULE_LABELS = {
  declined: 'Declined MCP / bridge rule',
  present: 'Present MCP / bridge rule',
} as const;

/** Message text and formatting shared by the provider-rule lifecycle and its CLI. */
export const PROVIDER_RULE_MESSAGES = {
  malformedSelection: 'ignored malformed providerSelection',
  malformedDecision: (id: string) => `ignored malformed decision: ${id}`,
  legacyApproved: (id: string) => `legacy approved ${id}: registry entry and file exist`,
  manifestUnavailable: (origin: string) => `${origin} manifest unavailable`,
  manifestFetchFailed: (origin: string) => `${origin} manifest fetch failed; trying next source`,
  tryingOrigin: (id: string, origin: string) => `${id}: trying ${origin}`,
  noUsableRow: (id: string, origin: string) => `${id}: ${origin} has no usable row; falling back`,
  incompleteBundle: (id: string, origin: string) => `${id}: incomplete ${origin} bundle; falling back`,
  resolvedBundle: (id: string, origin: string, count: number) => `${id}: resolved ${origin}, ${count} references`,
  fetchFailed: (id: string, origin: string) => `${id}: ${origin} fetch failed; falling back`,
  noInstallableBundle: (id: string) => `${id}: no installable bundle`,
  rollbackFailed: (id: string, file: string, reason: string) => `${id}: rollback failed for ${file}: ${reason}`,
  retainingFile: (id: string) => `${id}: no complete bundle; retaining installed file`,
  unchangedBundle: (id: string, origin: string) => `${id}: ${origin} bundle unchanged`,
  refreshedBundle: (id: string, origin: string) => `${id}: refreshed from ${origin}`,
  kept: (id: string, reason: string) => `kept ${id}: ${reason}`,
  removed: (id: string, count: number) => `removed ${id} and its ${count} reference file(s)`,
  needsConsent: (id: string) => `${id}: new installation needs current consent`,
  notInRegistry: (id: string) => `${id} has no rule in the registry`,
  installed: (id: string) => `installed ${id}`,
  installFailed: (id: string, reason: string) => `could not install ${id}: ${reason}`,
  explicitDecision: (id: string, enabled: boolean) => `${id}: explicit decision ${enabled}`,
  removeFailed: (id: string, reason: string) => `could not remove the rule of ${id}: ${reason}`,
  readFailed: (id: string, reason: string) => `could not read the rule of ${id}: ${reason}`,
  indexFailed: (reason: string) => `could not rebuild RULES_INDEX.md: ${reason}`,
  emptyChoices: 'no installable rules; skipping checkbox',
  offering: (ids: string[]) => `offering: ${ids.join(', ')}`,
  confirmed: (decisions: Record<string, boolean>) => `confirmed: ${JSON.stringify(decisions)}`,
  updatePending: (interactive: boolean, count: number) => `update: interactive=${interactive}, pending=${count}`,
  updateCancelled: 'update selection cancelled; no provider changes applied',
  collecting: (ids: string[]) => `[FIX] loading provider rules: ${ids.join(', ')}`,
  collected: (count: number, elapsedMs: number) => `[FIX] loaded ${count} provider rule bundles in ${elapsedMs}ms`,
} as const;

export function providerRulePath(projectDir: string, id: string): string {
  return path.join(moduleTierDir(projectDir, CODE_MODULE_ID, PROVIDER_RULE_TIER), `${id}${PROVIDER_RULE_EXTENSION}`);
}
