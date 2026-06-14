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
import type { ModuleId } from './manifest-types.js';
import type { RuleOrigin } from '../config.js';
import { CODE_MODULE_ID } from '../constants.js';
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

  // Reference-identity source→origin map. Shared by `getResolvedOrigin` (module-
  // wide) and the base's per-rule origin accessor (`getResolvedOriginForRule`),
  // so the two never disagree on which chain level a source represents.
  protected originOf(source: RulesRegistry): RuleOrigin {
    if (source === this.bundled) return 'bundled';
    if (source === this.primary) return 'primary';
    return 'official';
  }

  // Default `module = CODE_MODULE_ID` (the abstract signature leaves it optional)
  // so no-arg callers get the code module's origin. Origin is per-module: the
  // winning source for the requested module decides the tier.
  getResolvedOrigin(module: ModuleId = CODE_MODULE_ID): RuleOrigin | null {
    // `resolvedSource` is the documented back-compat shadow of the code module's
    // resolution (kept in sync by `cacheResolved`); honor it for `code` so it
    // stays the single source of truth for that module's origin.
    const source = this.resolvedByModule.get(module)?.source
      ?? (module === CODE_MODULE_ID ? this.resolvedSource : null);
    return source ? this.originOf(source) : null;
  }
}
