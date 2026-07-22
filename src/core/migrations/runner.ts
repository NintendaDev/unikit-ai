// Generic migration-chain runner.
//
// Walks an ordered chain in four phases — detect → plan → applySequential →
// stamp — and returns the ids of the steps that ran. Layout-agnostic: it does
// NOT import `installer/*` or know anything about what a step transforms. The
// only side effect is verbose logging via `logInfo`.

import { logInfo } from '../../utils/log.js';
import type { Migration, MigrationChainResult, RunMigrationChainOptions } from './types.js';

const DEFAULT_LOG_TAG = 'migrate';

/**
 * Detect-only pass: return the ids of the migrations whose `detect` reports
 * pending work, in chain order. Pure inspection — no `apply`, no side effects,
 * no logging. Callers that only need to answer "is there pending work?" (a CLI
 * staleness guard, a status probe) use this without triggering a relocation.
 * `runMigrationChain` runs this same pass before applying.
 */
export async function planMigrationChain<Ctx>(
  ctx: Ctx,
  migrations: readonly Migration<Ctx>[],
): Promise<string[]> {
  const pendingIds: string[] = [];
  for (const migration of migrations) {
    if (await migration.detect(ctx)) {
      pendingIds.push(migration.id);
    }
  }
  return pendingIds;
}

export async function runMigrationChain<Ctx>(
  ctx: Ctx,
  migrations: readonly Migration<Ctx>[],
  options: RunMigrationChainOptions = {},
): Promise<MigrationChainResult> {
  const logTag = options.logTag ?? DEFAULT_LOG_TAG;

  // Phase 1 — detect: select the steps that report pending work.
  const pendingIds = await planMigrationChain(ctx, migrations);

  // Phase 2 — plan: a clean detect pass means there is nothing to do.
  if (pendingIds.length === 0) {
    logInfo(logTag, 'no pending migrations');
    return { applied: [] };
  }

  const byId = new Map(migrations.map(m => [m.id, m]));

  // Phase 3 — applySequential: steps may build on each other, so order matters.
  const applied: string[] = [];
  for (const id of pendingIds) {
    const migration = byId.get(id);
    if (!migration) continue; // unreachable: ids originate from `migrations`
    logInfo(logTag, `applying ${id}`);
    await migration.apply(ctx);
    applied.push(id);
  }

  // Phase 4 — stamp: report the applied steps for the caller to persist/render.
  logInfo(logTag, `applied ${applied.length} migration(s): ${applied.join(', ')}`);
  return { applied };
}
