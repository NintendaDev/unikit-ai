// Registry migration chain — entry point.
//
// Two surfaces, mirroring the split documented in ./1-to-2.ts:
//
//  - `normalizeManifestToLatest` — a PURE synchronous fold of the in-memory
//    step normalizers (`normalize1to2`, …). It runs on every `fetchManifest()`
//    and is deliberately NOT built on `runMigrationChain` (that runner is async
//    and side-effecting; the hot path must stay pure and sync).
//
//  - `runRegistryDiskMigration` — the async, side-effecting on-disk relocation,
//    a thin wrapper over the generic `runMigrationChain` applied to
//    `REGISTRY_MIGRATIONS`. Used by the maintainer `rules registry migrate`
//    command to move a local registry from schema:1 to schema:2 on disk.

import { logInfo } from '../../../utils/log.js';
import { runMigrationChain } from '../../migrations/runner.js';
import type { Migration, MigrationChainResult } from '../../migrations/types.js';
import type { RegistryManifest } from '../manifest-types.js';
import { LATEST_SCHEMA } from '../manifest-types.js';
import {
  canonicalizeSchema2,
  normalize1to2,
  registry1to2DiskMigration,
  type RegistryDiskMigrationContext,
} from './1-to-2.js';

/**
 * Ordered chain of on-disk registry migrations, consumed by
 * `runRegistryDiskMigration`. Each step is an idempotent `Migration<Ctx>`.
 */
export const REGISTRY_MIGRATIONS: readonly Migration<RegistryDiskMigrationContext>[] = [
  registry1to2DiskMigration,
];

/**
 * Ordered pure normalizers applied in memory to bring any fetched manifest up to
 * the latest schema. Add the next step (`normalize2to3`, …) here when a future
 * schema bump lands; the fold stays a single pass.
 */
const IN_MEMORY_NORMALIZERS: ReadonlyArray<(m: RegistryManifest) => RegistryManifest> = [
  normalize1to2,
];

/**
 * Fold the in-memory normalizer chain over `manifest` and guarantee the
 * canonical schema:2 invariants (`always` injected, `engines` compat mirror).
 * Pure and synchronous — safe to call on every fetch.
 *
 * A manifest that arrives already at schema ≥ 2 skips the 1→2 step but is still
 * canonicalized, so a raw schema:2 source read straight off disk (modules-only,
 * no mirror) is hydrated into the shape consumers expect.
 */
export function normalizeManifestToLatest(manifest: RegistryManifest): RegistryManifest {
  let m = manifest;
  for (const normalize of IN_MEMORY_NORMALIZERS) {
    m = normalize(m);
  }
  if (m.schema >= 2 && m.schema <= LATEST_SCHEMA) {
    m = canonicalizeSchema2(m);
  }
  return m;
}

/**
 * Run the on-disk registry migration chain against a local registry root.
 * Idempotent: no-ops once the registry is already at the latest schema.
 */
export async function runRegistryDiskMigration(registryDir: string): Promise<MigrationChainResult> {
  logInfo('registry:migrate', `running registry disk migrations on ${registryDir}`);
  return runMigrationChain({ registryDir }, REGISTRY_MIGRATIONS, { logTag: 'registry:migrate' });
}

export type { RegistryDiskMigrationContext } from './1-to-2.js';
