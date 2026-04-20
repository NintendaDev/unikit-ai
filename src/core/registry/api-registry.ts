// --- ApiRegistry: REST API stub (Phase 2) ---
// Always returns null/empty — triggers fallback to Git or FS transports.

import type { RulesRegistry } from './index.js';
import type { RegistryManifest, RuleCategory, FetchedRule, FetchedReference } from './manifest-types.js';
import { logInfo } from '../../utils/log.js';

export class ApiRegistry implements RulesRegistry {
  readonly label: string;

  constructor(url: string) {
    this.label = `api:${url}`;
  }

  async fetchManifest(): Promise<RegistryManifest | null> {
    logInfo('ApiRegistry', 'stub — fetchManifest not implemented, returning null');
    return null;
  }

  async fetchRule(_engineId: string, _category: RuleCategory, _ruleId: string): Promise<FetchedRule | null> {
    return null;
  }

  async fetchReferences(
    _engineId: string,
    _category: RuleCategory,
    _ruleId: string,
    _filenames: string[],
  ): Promise<FetchedReference[]> {
    return [];
  }
}
