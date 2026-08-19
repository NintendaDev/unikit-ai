// Generic migration-chain runner.
//
// Walks an ordered chain in four phases — detect → plan → applySequential →
// stamp — and returns the ids of the steps that ran. Layout-agnostic: it does
// NOT import `installer/*` or know anything about what a step transforms. The
// only side effect is verbose logging via `logInfo`.

import semver from 'semver';
import { logInfo, logWarn } from '../../utils/log.js';
import type { Migration, MigrationChainResult, RunMigrationChainOptions } from './types.js';

const DEFAULT_LOG_TAG = 'migrate';

/**
 * Sort key for a step that carries no `since`. Such a step is treated as
 * predating every anchored one, which keeps the anchorless chain
 * (`REGISTRY_MIGRATIONS` — versioned by registry schema, never by project
 * version) in plain declaration order: all its steps share this key, and the
 * sort below is stable.
 */
const UNANCHORED_SINCE = '0.0.0';

/**
 * Chain order: ascending `since`, ties broken by declaration order.
 *
 * Version anchors are the chain's real timeline — a step that shipped in 1.1.0
 * must run before one that shipped in 1.2.0 even if a later edit appended it
 * above in the array. `Array.prototype.sort` is stable in ES2019+, so equal
 * anchors keep the order the chain author wrote.
 */
function inApplyOrder<Ctx>(migrations: readonly Migration<Ctx>[]): Migration<Ctx>[] {
  return [...migrations].sort((a, b) =>
    semver.compare(a.since ?? UNANCHORED_SINCE, b.since ?? UNANCHORED_SINCE));
}

/**
 * Detect-only pass: return the ids of the migrations that report pending work,
 * in apply order. Pure inspection — no `apply`, no disk writes. Callers that
 * only need to answer "is there pending work?" (a CLI staleness guard, a status
 * probe) use this without triggering a relocation. `runMigrationChain` runs
 * this same pass before applying.
 *
 * A step runs when EITHER signal fires:
 *
 *   versionPending = currentVersion is valid semver && lt(currentVersion, since)
 *   shouldRun      = detect ? (versionPending || await detect(ctx)) : versionPending
 *
 * **Why OR and not AND — three reasons, all measured.**
 *
 *  1. A version stamp can lie in both directions. `.unikit.json` written
 *     without a `version` field defaults to the CURRENT package version
 *     (`config.ts` `normalizeConfig`), so an ancient project reads as fresh;
 *     `readConfigVersion` returns `null` for that case and the version half
 *     goes quiet, leaving `detect` as the only signal. Symmetrically, projects
 *     stamped with a version BEFORE it was published (`npm link`, dev runs)
 *     carry a number no release ever shipped.
 *  2. Safety on an interrupted chain. The version stamp is written once for
 *     the whole chain, after the last step; a run that dies in the middle
 *     leaves the old number on disk with part of the work done. `detect` sees
 *     the half-migrated state that the version cannot.
 *  3. On healthy states the two halves agree, so OR costs nothing: it only
 *     widens the set where one of them is blind.
 *
 * **What OR breaks, and what every step now owes.** Until now `apply` ran only
 * behind a true `detect`, so a step always saw state it knew how to read. With
 * OR it can be entered at `detect === false` — version pending, state already
 * converted. "`apply` is idempotent" therefore stops being a wish and becomes a
 * correctness condition: every step must re-check the SHAPE of the state itself
 * and return without writing when there is no work. `codeWrapMigration`
 * satisfies this, but incidentally — each of its moves sits behind its own
 * `fileExists`. New steps must do it deliberately.
 *
 * A step with neither `since` nor `detect` can never fire and is a programming
 * error — the chain author gets a thrown id rather than a silent no-op.
 */
export async function planMigrationChain<Ctx>(
  ctx: Ctx,
  migrations: readonly Migration<Ctx>[],
  options: RunMigrationChainOptions = {},
): Promise<string[]> {
  const logTag = options.logTag ?? DEFAULT_LOG_TAG;
  const currentVersion = options.currentVersion ?? null;
  const versionUsable = currentVersion !== null && !!semver.valid(currentVersion);
  if (currentVersion !== null && !versionUsable) {
    logWarn(logTag, `unparseable currentVersion "${currentVersion}" — version half disabled, detect only`);
  }
  logInfo(logTag, `chain: ${migrations.length} step(s), currentVersion=${currentVersion ?? 'null'}`);

  const pendingIds: string[] = [];
  for (const migration of inApplyOrder(migrations)) {
    if (!migration.since && !migration.detect) {
      throw new Error(
        `Migration "${migration.id}" declares neither "since" nor "detect" — it can never run.`,
      );
    }
    const versionPending = versionUsable && !!migration.since
      && semver.lt(currentVersion as string, migration.since);
    const detected = migration.detect ? await migration.detect(ctx) : null;
    const shouldRun = migration.detect ? (versionPending || detected === true) : versionPending;
    logInfo(logTag, `step ${migration.id} since=${migration.since ?? '—'} `
      + `versionPending=${versionPending} detect=${detected === null ? 'skipped' : detected} `
      + `-> ${shouldRun ? 'run' : 'skip'}`);
    if (shouldRun) {
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
  const pendingIds = await planMigrationChain(ctx, migrations, options);

  // Phase 2 — plan: a clean detect pass means there is nothing to do.
  if (pendingIds.length === 0) {
    logInfo(logTag, 'no pending migrations');
    return { applied: [] };
  }

  const byId = new Map(migrations.map(m => [m.id, m]));

  // Phase 3 — applySequential: steps may build on each other, so order matters.
  // `pendingIds` already arrives in apply order (ascending `since`).
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
