// --- HybridRegistry: primary → official → bundled chain (custom URL case) ---
//
// Used when the user configured a custom `rulesRegistry` URL. The chain is
// [primary, official, bundled?] and origin tagging reflects which tier won.
//
// For the no-custom-URL case (or `url === OFFICIAL_REGISTRY_URL`) the
// factory returns `OfficialRegistry` instead. The runtime invariant
// `primary !== official` is enforced by the constructor guard below so
// that `getResolvedOrigin()` can rely on reference identity.

import type { RulesRegistry } from './index.js';
import type { RuleOrigin } from '../config.js';
import { ChainedRegistry } from './chained-registry.js';

export class HybridRegistry extends ChainedRegistry {
  readonly label: string;
  protected readonly logTag = 'HybridRegistry';
  private readonly primary: RulesRegistry;
  private readonly official: RulesRegistry;
  private readonly bundled: RulesRegistry | null;

  constructor(primary: RulesRegistry, official: RulesRegistry, engineId: string, bundled?: RulesRegistry) {
    super(engineId);

    // Fail-fast guard. The no-custom-URL case must route through
    // OfficialRegistry; if a future call-site forgets and passes the same
    // instance twice, origin tagging would silently regress to 'primary'
    // for the official tier — the exact bug this split fixes.
    if (primary === official) {
      throw new Error(
        'HybridRegistry requires distinct primary and official registries; use OfficialRegistry for the no-custom-URL case',
      );
    }

    this.primary = primary;
    this.official = official;
    this.bundled = bundled ?? null;
    const bundledLabel = this.bundled ? `→${this.bundled.label}` : '';
    this.label = `hybrid:[${primary.label}→${official.label}${bundledLabel}]`;
  }

  protected chain(): RulesRegistry[] {
    return this.bundled ? [this.primary, this.official, this.bundled] : [this.primary, this.official];
  }

  getResolvedOrigin(): RuleOrigin | null {
    if (!this.resolvedSource) return null;
    if (this.resolvedSource === this.bundled) return 'bundled';
    if (this.resolvedSource === this.primary) return 'primary';
    return 'official';
  }
}
