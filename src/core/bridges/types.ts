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
