// Zero-dependency bounded-concurrency primitive.
//
// The dependency tree carries no `p-limit`-style helper (6 deps, none for
// concurrency), so this is the house implementation. Used by the rules
// pipeline to overlap per-rule network fetches (`syncRegistry`,
// `bootstrapModuleRules`) without unleashing an unbounded burst of GETs at
// `raw.githubusercontent.com`.

/**
 * Map `items` through `fn` with at most `limit` invocations in flight at once,
 * returning the results in INPUT order — `result[i] === await fn(items[i], i)`,
 * regardless of the order in which the tasks actually settled. This input-order
 * re-serialisation is what lets a parallel call drop in for a sequential
 * `for...of` loop without reordering any downstream effect keyed on position.
 *
 * Pure: no logging, no fs, no side effects beyond the local pool state. ESM,
 * strict TS, no `any`.
 *
 * Error semantics mirror `Promise.all`, NOT `Promise.allSettled`: the first
 * rejected task propagates and rejects the whole call. Swallowing a rejection
 * would let a caller persist state for work the disk never received (a silent
 * state↔disk divergence), so we deliberately do not absorb it. After the first
 * rejection no NEW task is started; tasks already in flight are allowed to
 * settle on their own and their values are discarded — the same bounded write
 * window a sequential loop would leave behind when it throws mid-iteration.
 * (`Promise.all` has already attached reactions to every worker, so a second
 * worker rejecting after the aggregate settled is consumed, not unhandled.)
 *
 * Edge cases:
 *   - empty `items`           → resolves to `[]` (`fn` is never called)
 *   - `limit >= items.length` → every task starts immediately
 *   - `limit <= 0`            → clamped to 1 (never deadlocks on a 0-width pool)
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  if (items.length === 0) return results;

  const width = Math.min(Math.max(1, Math.floor(limit)), items.length);
  let cursor = 0;
  let failed = false;

  async function worker(): Promise<void> {
    while (cursor < items.length && !failed) {
      const index = cursor++;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        // Stop the pool from pulling further work, then propagate so the
        // aggregating `Promise.all` rejects with this first error.
        failed = true;
        throw err;
      }
    }
  }

  await Promise.all(Array.from({ length: width }, () => worker()));
  return results;
}
