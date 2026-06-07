// Generic migration-chain runner.
//
// Walks an ordered chain in four phases — detect → plan → applySequential →
// stamp — and returns the ids of the steps that ran. Layout-agnostic: it does
// NOT import `installer/*` or know anything about what a step transforms. The
// only side effect is verbose logging via `logInfo`.

import { logInfo } from '../../utils/log.js';
import type { Migration, MigrationChainResult, RunMigrationChainOptions } from './types.js';

const DEFAULT_LOG_TAG = 'migrate';

export async function runMigrationChain<Ctx>(
  ctx: Ctx,
  migrations: readonly Migration<Ctx>[],
  options: RunMigrationChainOptions = {},
): Promise<MigrationChainResult> {
  const logTag = options.logTag ?? DEFAULT_LOG_TAG;

  // Phase 1 — detect: select the steps that report pending work.
  const pending: Migration<Ctx>[] = [];
  for (const migration of migrations) {
    if (await migration.detect(ctx)) {
      pending.push(migration);
    }
  }

  // Phase 2 — plan: a clean detect pass means there is nothing to do.
  if (pending.length === 0) {
    logInfo(logTag, 'no pending migrations');
    return { applied: [] };
  }

  // Phase 3 — applySequential: steps may build on each other, so order matters.
  const applied: string[] = [];
  for (const migration of pending) {
    logInfo(logTag, `applying ${migration.id}`);
    await migration.apply(ctx);
    applied.push(migration.id);
  }

  // Phase 4 — stamp: report the applied steps for the caller to persist/render.
  logInfo(logTag, `applied ${applied.length} migration(s): ${applied.join(', ')}`);
  return { applied };
}
