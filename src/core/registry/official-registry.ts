// --- OfficialRegistry: official → bundled chain (no-custom-URL case) ---
//
// Used when `.unikit.json.rulesRegistry` is null/empty or explicitly holds
// the `OFFICIAL_REGISTRY_URL` literal. The chain is [official, bundled?]
// — one fetch to the official manifest, with the bundled snapshot as the
// offline-safe fallback. Origin tagging is intrinsic to the class:
// `official` or `bundled`, never `primary`.

import type { RulesRegistry } from './index.js';
import type { ModuleId } from './manifest-types.js';
import type { RuleOrigin } from '../config.js';
import { CODE_MODULE_ID } from '../constants.js';
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

  // Reference-identity source→origin map. The chain has no `primary` tier, so a
  // source is `bundled` or (by elimination) `official`. Shared by both
  // `getResolvedOrigin` and the base's per-rule origin accessor.
  protected originOf(source: RulesRegistry): RuleOrigin {
    if (source === this.bundled) return 'bundled';
    return 'official';
  }

  // Default `module = CODE_MODULE_ID` so no-arg callers get the code module's
  // origin. The chain has no `primary` tier, so origin is `official` or
  // `bundled` per the requested module's winning source.
  getResolvedOrigin(module: ModuleId = CODE_MODULE_ID): RuleOrigin | null {
    // `resolvedSource` is the documented back-compat shadow of the code module's
    // resolution (kept in sync by `cacheResolved`); honor it for `code`.
    const source = this.resolvedByModule.get(module)?.source
      ?? (module === CODE_MODULE_ID ? this.resolvedSource : null);
    return source ? this.originOf(source) : null;
  }
}
