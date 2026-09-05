// Generic, layout-agnostic migration chain types.
//
// A `Migration` describes one forward step. Two independent signals decide
// whether it runs, OR-combined by the runner (see `runner.ts`):
//
//   - `detect` — a PRECISE probe against the current state: "does this step
//     still have work to do here?". Reads the disk (or whatever `Ctx` points
//     at) and answers from the state itself.
//   - `since` — a COARSE filter over the project's version: "this step shipped
//     in release X, so anything below X has not seen it yet". Knows nothing
//     about the actual state.
//
// Neither is sufficient alone (a project can carry a version that lies, and a
// state can be unobservable), so the runner takes their OR. `apply` performs
// the idempotent transformation.
//
// No knowledge of memory layout, registry schema, or installer internals lives
// here — concrete chains supply that through the callbacks. PR#1's first
// consumer is `memory-migrations`; PR#2 reuses the same runner for registry
// schema migrations.

export interface Migration<Ctx> {
  /** Stable id, surfaced in logs and the applied-step report. */
  id: string;
  /**
   * Semver version of the release this step ships in — the version anchor.
   * A project whose recorded version is strictly below it has not seen the
   * step yet, whatever the disk says.
   *
   * OPTIONAL, because the chain has a second consumer with no version axis at
   * all: `REGISTRY_MIGRATIONS` is versioned by the registry SCHEMA, its context
   * is `{ registryDir }`, and `runRegistryDiskMigration` never passes a
   * `currentVersion` — so the version half is permanently inert there. Making
   * the field mandatory would force that chain to invent an anchor, and the
   * schema guard would then start checking the invention.
   *
   * Absent `since` means "the version half is off for this step; `detect`
   * decides" — which is verbatim the current semantics of the registry chain.
   */
  since?: string;
  /**
   * Returns true when this step still has work to do against `ctx`.
   *
   * OPTIONAL, but only for steps whose work is NOT OBSERVABLE ON DISK — a
   * template re-render, a change of substitution format, anything that leaves
   * no distinguishable trace to probe. Such a step is driven by `since` alone.
   * Whenever the state CAN be read back, write a `detect`: it is the only
   * signal that survives a version stamp being wrong.
   */
  detect?(ctx: Ctx): Promise<boolean>;
  /**
   * Performs the transformation. MUST be idempotent, and — since the runner
   * ORs the two signals — must also verify the shape of the state itself and
   * return without writing when there is no work: `apply` can now be reached
   * with `detect === false` (version pending, state already converted).
   */
  apply(ctx: Ctx): Promise<void>;
}

export interface MigrationChainResult {
  /** Ids of the steps that were applied, in execution order. */
  applied: string[];
}

export interface RunMigrationChainOptions {
  /** Log component tag for per-step messages. Defaults to `'migrate'`. */
  logTag?: string;
  /**
   * The project's recorded version, used as the left side of the `since`
   * comparison. `undefined` / `null` (or an unparseable value) turns the
   * version half off for the whole chain, leaving `detect` in sole charge —
   * which is what the registry chain relies on.
   */
  currentVersion?: string | null;
}
