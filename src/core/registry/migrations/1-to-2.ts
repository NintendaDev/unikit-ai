// Registry schema 1 → 2 migration.
//
// TWO distinct mechanisms live here — do not conflate them:
//
//  1. `normalize1to2` / `canonicalizeSchema2` — PURE, SYNCHRONOUS, in-memory
//     manifest transforms. They run on the HOT path (every `fetchManifest()` in
//     `ChainedRegistry`) and must never touch the filesystem. They are NOT
//     `Migration<Ctx>` steps and never go through `runMigrationChain`.
//
//  2. `registry1to2DiskMigration` — an on-disk `Migration<Ctx>` (async,
//     side-effecting) that physically relocates a LOCAL registry from the flat
//     schema:1 layout (`<engine>/<tier>/`) to the schema:2 layout
//     (`code/<engine>/<tier>/`) and rewrites its `manifest.json`. It mirrors the
//     `memory-migrations` pattern (detect = legacy layout present, apply =
//     `movePath`, idempotent) and is driven by `runRegistryDiskMigration` (see
//     ./index.ts), used by the maintainer `rules registry migrate` command.
//
// Neither mechanism touches `gamedesign`: schema:1 sources only ever carried the
// engine-partitioned code rules, so the migration's sole job is to wrap those
// under the `code` module.

import path from 'path';
import { fileExists, movePath, readJsonFile, writeJsonFile } from '../../../utils/fs.js';
import { logInfo } from '../../../utils/log.js';
import { CODE_MODULE_ID } from '../../constants.js';
import type { Migration } from '../../migrations/types.js';
import type { EngineRules, RegistryManifest, RegistryRule } from '../manifest-types.js';

/** Inject `always` for a single rule when the field is absent. */
function injectAlways(rule: RegistryRule, isCore: boolean): RegistryRule {
  return rule.always === undefined ? { ...rule, always: isCore } : rule;
}

/**
 * Inject `always = (tier === 'core')` across an engine map, leaving rules that
 * already declare the field untouched. Pure — returns a fresh map.
 */
function withAlways(engines: Record<string, EngineRules>): Record<string, EngineRules> {
  const out: Record<string, EngineRules> = {};
  for (const [engineId, tiers] of Object.entries(engines)) {
    out[engineId] = {
      core: (tiers.core ?? []).map(r => injectAlways(r, true)),
      stack: (tiers.stack ?? []).map(r => injectAlways(r, false)),
    };
  }
  return out;
}

/**
 * Bring a schema:2 manifest to the canonical in-memory shape:
 *  - `always` injected on every code rule,
 *  - top-level `engines` set to the compat mirror of `modules.code.engines`
 *    (so consumers still reading the flat map keep working — see manifest-types
 *    header).
 *
 * Idempotent: applying twice yields the same object shape. Reads engines from
 * `modules.code` first (raw schema:2 from disk), falling back to the top-level
 * `engines` (a schema:1 manifest just wrapped by `normalize1to2`).
 */
export function canonicalizeSchema2(manifest: RegistryManifest): RegistryManifest {
  const modules = manifest.modules ?? {};
  const code = modules[CODE_MODULE_ID];
  const rawEngines = code?.engines ?? manifest.engines ?? {};
  const engines = withAlways(rawEngines);
  return {
    ...manifest,
    schema: 2,
    generated: manifest.generated,
    engines,
    modules: { ...modules, [CODE_MODULE_ID]: { ...(code ?? {}), engines } },
  };
}

/**
 * Pure in-memory normalizer for the 1→2 step. A schema:1 manifest is wrapped so
 * its flat `engines` map becomes `modules.code.engines` (with `always` injected
 * and the compat mirror retained). A manifest already at schema ≥ 2 is NOT this
 * step's concern and is returned unchanged — `normalizeManifestToLatest`
 * canonicalizes those.
 */
export function normalize1to2(manifest: RegistryManifest): RegistryManifest {
  if (manifest.schema >= 2) return manifest;
  const engines = manifest.engines ?? {};
  return canonicalizeSchema2({
    schema: 2,
    generated: manifest.generated,
    engines,
    modules: { [CODE_MODULE_ID]: { engines } },
  });
}

/** Context for the on-disk registry migration: the local registry root dir. */
export interface RegistryDiskMigrationContext {
  registryDir: string;
}

/**
 * On-disk relocation of a LOCAL schema:1 registry to schema:2. Moves every
 * engine directory under `code/` and rewrites `manifest.json` to a clean
 * schema:2 (modules-only, `always` injected). Idempotent: once the manifest
 * reads schema ≥ 2 there is no work, so a second run is a sha-stable no-op.
 */
export const registry1to2DiskMigration: Migration<RegistryDiskMigrationContext> = {
  id: 'registry-1-to-2-code-wrap',

  async detect({ registryDir }) {
    const manifest = await readJsonFile<RegistryManifest>(path.join(registryDir, 'manifest.json'));
    if (!manifest) return false; // unreadable / absent → nothing to migrate
    return manifest.schema === 1;
  },

  async apply({ registryDir }) {
    const manifestPath = path.join(registryDir, 'manifest.json');
    const manifest = await readJsonFile<RegistryManifest>(manifestPath);
    if (!manifest || manifest.schema >= 2) return;

    const engineIds = Object.keys(manifest.engines ?? {});

    // 1. Physically relocate each engine dir under `code/`.
    for (const engineId of engineIds) {
      const src = path.join(registryDir, engineId);
      const dest = path.join(registryDir, CODE_MODULE_ID, engineId);
      if (await fileExists(src) && !(await fileExists(dest))) {
        await movePath(src, dest);
        logInfo('registry:migrate', `relocated ${engineId} → ${CODE_MODULE_ID}/${engineId}`);
      }
    }

    // 2. Rewrite the manifest to a clean schema:2 (modules-only on disk — the
    //    in-memory `engines` mirror is a fetch-time concern, never persisted).
    const normalized = normalize1to2(manifest);
    const onDisk = {
      schema: 2,
      generated: normalized.generated,
      modules: normalized.modules,
    };
    await writeJsonFile(manifestPath, onDisk);
    logInfo('registry:migrate', `manifest rewritten to schema:2 (${engineIds.length} engine(s) under ${CODE_MODULE_ID}/)`);
  },
};
