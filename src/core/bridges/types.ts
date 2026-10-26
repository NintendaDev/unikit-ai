// --- Engine-bridge catalog types shared by every kind of bridge ---
//
// The fields of a catalog entry that do not depend on whether the bridge is an MCP server or a
// command line: how the user prepares the environment, how the wizard detects the bridge, which
// versions are the floor, and where the bridge's documentation lives. Types only: the parsers are in
// `schema-fields.ts`, and `mcp.ts` imports from here, never the reverse.

/** One line of preparation the user (or the agent, once confirmed) performs. */
export interface BridgeSetupLine {
  by: 'human' | 'agent-confirmed';
  run: string;
}

/** Minimum versions below which the bridge is unavailable. All optional; a missing one is no floor. */
export interface BridgeRequires {
  engineVersion?: string;
  cli?: string;
  package?: string;
}

/** Facts the wizard reads, without running anything, to pre-select the bridge. */
export interface BridgeDetect {
  binary?: string;
  projectVersionFile?: string;
  /**
   * A regular expression with exactly ONE capture group that picks the engine version number out of
   * `projectVersionFile`. It is data so that the code never learns the file format of one engine.
   */
  versionPattern?: string;
}

/** How a bridge of kind `cli` is called. Every form is a command line with slots: <project-root>, <command>, <group>, <word>, <params>. */
export interface BridgeCliForms {
  /** run a catalog command: ... <command> [-- <params>] */
  call: string;
  /** list the groups of the live catalog (the source of the table of contents) */
  groups?: string;
  /** list the commands of one group */
  group?: string;
  /** find commands by a word */
  search?: string;
  /** the schema of one command */
  schema?: string;
  /** recompile with diagnostics */
  compile?: string;
  /** the whole live catalog in one call: name, group, description of every command (the planner's read) */
  list?: string;
  /** the state of the editor and the in-editor package, with the reason when unavailable */
  status?: string;
  /** wait until the editor takes commands again (after a compile, a package change or a Play Mode change) */
  ready?: string;
  /** probe: the version of the executable */
  version?: string;
}

/** A probe that READS a file of the project instead of running a command (no shell, no grant, works with the editor closed). */
export interface BridgeFileProbe {
  /** project-relative, no `..` */
  file: string;
  /** the key path inside the JSON file */
  path: string[];
  /** read when the file or the key is missing */
  fallback?: { file: string; path: string[] };
}

/** The tool names a cli bridge's grants can be rendered for. */
export type BridgeShell = 'Bash' | 'PowerShell';

export interface BridgeCli {
  /** searched on PATH, head of every grant and of every form */
  binary: string;
  /** addresses the project in every form except the version probe */
  projectFlag: string;
  /** tool names the grants are rendered for */
  shells: BridgeShell[];
  forms: BridgeCliForms;
  /** the installed version of the in-editor package, read from a file (the CLI has no project-scoped command for it) */
  probes?: { package?: BridgeFileProbe };
  /** one-line cautions printed under the block in BRIDGES.md */
  notes?: string[];
}

/**
 * A POINTER to documentation, not a document. Three kinds:
 *  - command: a command the bridge itself ships (`list` prints the files, `show` prints one, `<file>` is the slot);
 *  - package: files inside a package installed in the project (`root` is a project-relative glob of the installed
 *    folder, `path` is relative to the folder it matches, `include`/`exclude` as for git);
 *  - git: a repository path with include/exclude globs relative to `path` (`ref` omitted = the default branch).
 * `into` is the folder under `.unikit/references/bridges/<id>/` (or `_engine/`) the copy lands in.
 */
export type DocsSource =
  | { kind: 'command'; id: string; list: string; show: string; into: string }
  | { kind: 'package'; id: string; root: string; path: string; include?: string[]; exclude?: string[]; into: string }
  | { kind: 'git'; id: string; repo: string; ref?: string; path?: string; include?: string[]; exclude?: string[]; into: string };
