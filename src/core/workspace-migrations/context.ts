// The context every workspace migration step is keyed by.
//
// Its own module rather than `index.ts` for one reason: `index.ts` re-exports
// the step sets, so a step importing the type FROM `index.ts` would close a
// cycle in the module graph. `import type` is erased and the cycle never
// reaches the emitted JavaScript, but `ARCHITECTURE.md` forbids circular
// imports without qualifying the kind, and a leaf module costs less than an
// exception to the rule.

export interface WorkspaceMigrationContext {
  projectDir: string;
}
