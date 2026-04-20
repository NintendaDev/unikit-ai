// --- Registry Manifest Types ---
// Mirrors the manifest.json structure produced by CI in NintendaDev/unikit-ai-rules.
// Schema version 1: flat per-engine core/stack arrays, version-only change detection.

export interface RegistryRule {
  id: string;
  description: string;
  version: string;
  references?: string[];
}

export interface EngineRules {
  core: RegistryRule[];
  stack: RegistryRule[];
}

export interface RegistryManifest {
  schema: 1;
  generated: string;
  engines: Record<string, EngineRules>;
}

// Category discriminator used by transport methods to build paths.
export type RuleCategory = 'core' | 'stack';

// Result of fetching a single rule file.
export interface FetchedRule {
  id: string;
  category: RuleCategory;
  content: string;
}

// Result of fetching reference files for a rule.
export interface FetchedReference {
  filename: string;
  content: string;
}
