// --- OfficialRegistry: official → bundled chain (no-custom-URL case) ---
//
// Used when `.unikit.json.rulesRegistry` is null/empty or explicitly holds
// the `OFFICIAL_REGISTRY_URL` literal. The chain is [official, bundled?]
// — one fetch to the official manifest, with the bundled snapshot as the
// offline-safe fallback. Origin tagging is intrinsic to the class:
// `official` or `bundled`, never `primary`.

import type { RulesRegistry } from './index.js';
import type { RuleOrigin } from '../config.js';
import { ChainedRegistry } from './chained-registry.js';

export class OfficialRegistry extends ChainedRegistry {
  readonly label: string;
  protected readonly logTag = 'OfficialRegistry';
  private readonly official: RulesRegistry;
  private readonly bundled: RulesRegistry | null;

  constructor(official: RulesRegistry, engineId: string, bundled?: RulesRegistry) {
    super(engineId);
    this.official = official;
    this.bundled = bundled ?? null;
    const bundledLabel = this.bundled ? `→${this.bundled.label}` : '';
    this.label = `official:[${official.label}${bundledLabel}]`;
  }

  protected chain(): RulesRegistry[] {
    return this.bundled ? [this.official, this.bundled] : [this.official];
  }

  getResolvedOrigin(): RuleOrigin | null {
    if (!this.resolvedSource) return null;
    if (this.resolvedSource === this.bundled) return 'bundled';
    return 'official';
  }
}
