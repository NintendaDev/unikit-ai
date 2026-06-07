// Physical on-disk path derivation for rule files, shared by the FS and Git
// transports. The PHYSICAL schema of the source (not the normalized in-memory
// schema) drives the layout, so a schema:1 source keeps its flat paths even
// though the registry hands consumers a normalized schema:2 manifest.

import { CODE_MODULE_ID } from '../constants.js';

/**
 * Whether a module nests its rules under an engine segment. Only `code` is
 * engine-partitioned today; this is encoded as a constant check (mirroring
 * `MODULE_REGISTRY.code.enginePartitioned`) so the transport layer stays
 * decoupled from the module registry — full `gamedesign` wiring is out of scope
 * for PR#2, but the conditional already accommodates its `<module>/<tier>` shape.
 */
function isEnginePartitioned(module: string): boolean {
  return module === CODE_MODULE_ID;
}

/**
 * Relative path segments to a module/engine/tier directory, per the source's
 * PHYSICAL schema:
 *   schema 1 → `<engine>/<tier>`            (flat legacy layout)
 *   schema 2 → `<module>/<engine>/<tier>`   (engine-partitioned, e.g. `code`)
 *            → `<module>/<tier>`            (non-engine, e.g. `gamedesign`)
 */
export function ruleTierSegments(
  physicalSchema: number,
  module: string,
  engineId: string,
  tier: string,
): string[] {
  if (physicalSchema >= 2) {
    return isEnginePartitioned(module) ? [module, engineId, tier] : [module, tier];
  }
  return [engineId, tier];
}
