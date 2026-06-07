// Generic, layout-agnostic migration chain types.
//
// A `Migration` describes one forward step: `detect` decides whether the step
// still has work to do against the current state, `apply` performs the
// idempotent transformation. The runner (see `runner.ts`) walks an ordered
// chain and applies only the steps whose `detect` reports work, returning a
// report of what ran.
//
// No knowledge of memory layout, registry schema, or installer internals lives
// here — concrete chains supply that through the callbacks. PR#1's first
// consumer is `memory-migrations`; PR#2 reuses the same runner for registry
// schema migrations.

export interface Migration<Ctx> {
  /** Stable id, surfaced in logs and the applied-step report. */
  id: string;
  /** Returns true when this step still has work to do against `ctx`. */
  detect(ctx: Ctx): Promise<boolean>;
  /** Performs the idempotent transformation. */
  apply(ctx: Ctx): Promise<void>;
}

export interface MigrationChainResult {
  /** Ids of the steps that were applied, in execution order. */
  applied: string[];
}

export interface RunMigrationChainOptions {
  /** Log component tag for per-step messages. Defaults to `'migrate'`. */
  logTag?: string;
}
