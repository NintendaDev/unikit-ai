// --- CLI Contract: Source of truth for exit codes and command descriptions ---
// Generated into data/cli-contract.md by scripts/generate-cli-contract.ts
// Installed into .unikit/system/cli-contract.md by installer

export interface ExitCodeEntry {
  code: number;
  meaning: string;
}

export interface CommandEntry {
  command: string;
  description: string;
  flags?: string[];
  outputFormat?: string;
}

// --- Exit codes (unified for all `unikit rules *`) ---

export const RULES_EXIT_CODES: ExitCodeEntry[] = [
  { code: 0, meaning: 'Success' },
  { code: 1, meaning: 'Not found (rule id, config file, variadic install with every id failing, or `rules install defaults` where every bootstrap work item failed)' },
  { code: 2, meaning: 'Network error / registry unreachable' },
  { code: 3, meaning: 'Invalid arguments (bad id format, relative path, url format, unknown --module value, `rules install defaults` combined with rule ids, ambiguous `rules show` id that resolves in multiple modules)' },
  { code: 4, meaning: 'Operation not permitted (file-exists guards outside variadic install)' },
  { code: 5, meaning: 'Registry validation failed (bad manifest, schema mismatch, engine missing, empty `rules install defaults` bootstrap set — no rules for any module whose skills are installed)' },
  { code: 6, meaning: 'Registry already initialized at target path (rules registry init)' },
  { code: 7, meaning: 'Target path occupied by non-registry files (rules registry init)' },
  { code: 8, meaning: 'Project out of date — run `unikit-ai update` before `rules sync` / `rules install` (memory layout not migrated to the modular `code/` module)' },
];

// --- Commands ---

export const RULES_COMMANDS: CommandEntry[] = [
  {
    command: 'unikit-ai rules list',
    description: 'List available rules from the registry catalog. With NO --module it lists EVERY registered module as separate blocks (code first, then gamedesign) and emits a flat-all JSON; pass --module <id> to scope to one module (back-compat flat-single JSON). A module absent from the registry chain is skipped silently; an engine-partitioned module (code) whose engine is missing from the registry prints a warning to stderr and contributes an empty section (exit 0, NOT exit 1). exit 2 only when EVERY catalog in scope is unreachable; unknown --module values exit 3; exit 1 is reserved for a missing .unikit.json.',
    flags: ['--json', '--engine <id>', '--module <module>'],
    outputFormat: 'JSON flat-all (no --module): { engine, rules: [{ id, module, category, description, version }] }. JSON flat-single (with --module): { engine, module, rules: [{ id, category, description, version }] }. category is the module tier (core/stack for code, core/library for gamedesign). Machine consumers should always send --module to get the stable flat-single form.',
  },
  {
    command: 'unikit-ai rules show <id>',
    description: 'Preview a rule from the registry (full content with frontmatter). Module-agnostic by default: searches the id across EVERY registered module; pass --module <id> to restrict the search to one module. An id that resolves in more than one module is ambiguous and exits 3 (pass --module to disambiguate); an id found in none while at least one catalog is reachable exits 1; every catalog unreachable exits 2.',
    flags: ['--references', '--module <module>'],
  },
  {
    command: 'unikit-ai rules install [defaults | ids...]',
    description: 'Install rules from the registry. Bare (no arguments) prints command help and exits 0 — it installs nothing. The `defaults` keyword bootstraps every module whose SKILLS are installed, by each module policy: the code module installs all always-tagged (core) rules, the gamedesign module installs its entire catalog (core + library) when its skills are present — this is the bootstrap used by /unikit Step 9.2; modules absent from the registry are skipped gracefully. `defaults` cannot be combined with rule ids (exit 3). With one or more ids, installs them in a single call with one manifest fetch per module, scoped to the code module unless --module says otherwise, and prints an aggregated report: per-rule `✓ installed <cat>/<id> v<ver>` / `↻ already installed <cat>/<id>` / `✗ failed <cat>/<id>: <reason>` (non-code modules prefix the label with the module id, e.g. `gamedesign/library/<id>`) followed by a summary line `Rules: N installed, M already-installed, K failed`. Re-runs are idempotent; use --force to re-fetch rules already in state.',
    flags: ['--force', '--module <module>'],
    outputFormat: 'Human-readable aggregated report (or help text for the bare form). Exit 0 when bare (help) or ≥1 rule is installed/already-installed; exit 1 when every requested id failed (or every `defaults` bootstrap work item failed); exit 2 registry unreachable; exit 3 unknown --module value or `defaults` combined with ids; exit 5 engine missing or the `defaults` bootstrap set across all in-scope modules is empty; exit 8 project out of date (run `unikit-ai update` first).',
  },
  {
    command: 'unikit-ai rules sync',
    description: 'Reconcile disk ↔ .unikit.json state and regenerate RULES_INDEX.md. By default refreshes registry-sourced rules whose version changed and skips locally-modified files with a warning. Use --replace to overwrite local modifications and re-fetch rules at the same version; use --prune to remove obsolete stack rules that vanished from the registry; combine both for a full mirror (the old `sync --force`). Exits 8 when the project memory layout has not been migrated to the modular `code/` module — run `unikit-ai update` first.',
    flags: ['--replace', '--prune'],
  },
  {
    command: 'unikit-ai rules status',
    description: 'Show installed rules with source, origin, version, hash. Covers every registered module by default (code first, then gamedesign); pass --module to scope to one.',
    flags: ['--json', '--check-updates', '--module <module>'],
    outputFormat: 'JSON: { engine, registry, registryKind: "url" | "local" | null, rules: [{ name, module, category, source, origin, version, installed_hash }] }',
  },
  {
    command: 'unikit-ai rules registry',
    description: 'Alias for `unikit-ai rules registry show`. Print the currently configured rules registry URL and its kind. Use the nested subcommands `show`, `set`, `reset`, `init` for the full surface.',
    flags: ['--json'],
    outputFormat: 'Human text or --json: { configured: boolean, url: string, kind: "url" | "local" | null }',
  },
  {
    command: 'unikit-ai rules registry show',
    description: 'Print the currently configured rules registry URL and its kind. Read-only — never touches `.unikit.json` or rule files.',
    flags: ['--json'],
    outputFormat: 'Human text or --json: { configured: boolean, url: string, kind: "url" | "local" | null }',
  },
  {
    command: 'unikit-ai rules registry set <url>',
    description: 'Set the rules registry URL (validated against the engine). Writes `.unikit.json.rulesRegistry` ONLY — does NOT touch rule files on disk or run a sync. After a set the CLI prints an info-block reminding the user to run `unikit-ai rules sync [--replace] [--prune]` when they want to pull content.',
    flags: ['--json'],
    outputFormat: 'Human text + hints block; --json: { configured: true, url, kind }',
  },
  {
    command: 'unikit-ai rules registry reset',
    description: 'Reset the rules registry URL to the default (official `NintendaDev/unikit-ai-rules`). Writes the literal `OFFICIAL_REGISTRY_URL` into `.unikit.json.rulesRegistry` (same value the wizard writes when the user declines a custom registry during init). Does NOT touch rule files on disk. Legacy projects with `rulesRegistry: null` still load correctly via `resolveRegistryUrl()`. Run `unikit-ai rules sync` afterwards to reconcile against the default registry.',
    flags: ['--json'],
    outputFormat: 'Human text + hints block; --json: { configured: true, url, kind }',
  },
  {
    command: 'unikit-ai rules registry init [path]',
    description: 'Scaffold a new local schema:2 rules registry at the target path. Copies package.json, RULE_TEMPLATE.md, scripts/build-manifest.js from the bundled snapshot and creates code/<engine>/{core,stack}/ for the project engine (from .unikit.json) or all 4 engines when run outside a UniKit project, plus the reserved gamedesign/{core,library}/ tree. Writes a schema:2 manifest.json directly (does not run build-manifest.js). Does not touch git or the caller project .unikit.json. Exit codes: 6 (already initialized), 7 (path occupied).',
  },
  {
    command: 'unikit-ai rules registry migrate [path]',
    description: 'Migrate a local rules registry on disk from schema:1 (flat <engine>/<tier>/) to schema:2 (code/<engine>/<tier>/), relocating rule files and rewriting manifest.json. Idempotent — a second run is a no-op. Targets the given path, or the configured rulesRegistry when it is local; remote registries cannot be migrated (clone locally first). Exit codes: 0 (migrated or already latest), 1 (target manifest missing), 3 (no local target), 5 (resulting manifest invalid / unsupported schema).',
  },
  {
    command: 'unikit-ai rules registry status [target]',
    description: 'Report a registry\'s physical schema and whether the CLI can migrate/write it. Distinct from `unikit-ai rules status`, which lists the project\'s installed rules — this inspects the registry SOURCE (write/migrate capability). Reads the raw schema from a single source (no fallback chain). Defaults to the configured registry; pass [target] to inspect another. Exit codes: 0 (reachable, schema ≤ latest), 2 (unreachable), 5 (schema > latest, unsupported).',
    flags: ['--json'],
    outputFormat: 'Human table + verdict line, or --json: { target, kind: "local" | "remote", schema: number | null, isLatestSchema, readable, writable }',
  },
];

// --- Genres commands ---
//
// A bundled, read-only genre-profile catalog (no registry, no network, no engine
// partition). Exit codes are a SUBSET of the unified rules codes: 0 success · 1
// not found · 3 invalid args. There is no exit 2 (no network) and no exit-8
// migration gate (genres write under `.unikit/system/`, not the memory layout).

export const GENRES_COMMANDS: CommandEntry[] = [
  {
    command: 'unikit-ai genres list',
    description: 'List the bundled, read-only genre profiles (the §4.1–4.6 genre-matrix catalog). Reads the bundled profiles directly and loads `.unikit.json` ONLY to mark which are installed — a missing config is NOT an error. Always exit 0.',
    flags: ['--json'],
    outputFormat: 'JSON: { genres: [{ id, name, confidence: "high"|"medium"|"low", default_flow_mode: "linear"|"conditional"|"emergent", platform_default: string | null, installed: boolean }] }. Every human column (ID/Name/Confidence/Flow/Installed) is present as a JSON field.',
  },
  {
    command: 'unikit-ai genres show <id>',
    description: 'Print a single genre profile. The argument accepts the canonical id OR any alias (resolved exactly, case-insensitively). An empty argument exits 3 (invalid args); an unresolvable id/alias exits 1 (not found). Human and JSON render from the same profile object.',
    flags: ['--json'],
    outputFormat: 'JSON: the full profile object { schema_version, version, id, name, aliases, summary, confidence, default_flow_mode, default_packs, seed_systems, seed_content_types, seed_entities, seed_resources, critical_sections, review_emphasis, platform_default? }.',
  },
  {
    command: 'unikit-ai genres install [ids...]',
    description: 'Install one or more genre profiles into `.unikit/system/gamedesign/genres/<id>.json` and record them in `.unikit.json` (`genres.installed`, keyed by canonical id). Each argument accepts an id OR alias. No arguments exits 3 (invalid args); a missing `.unikit.json` exits 1. Idempotent: an already-installed profile prints `↻ already installed <id>` and is skipped (re-copied under --force). Prints a per-profile report (`✓ installed <id> v<ver>` / `↻ already installed <id>` / `✗ unknown genre: <id>`) and a summary `Genres: N installed, M already-installed, K failed`. This command is normally driven by `unikit-gd-spec` (best-fit resolve of a descriptive genre hint), not typed by the user. Exit 1 only when every requested id was unknown.',
    flags: ['--force'],
    outputFormat: 'Human-readable per-profile report + summary line. Exit 0 when ≥1 profile installed/already-installed; exit 1 when no `.unikit.json` or every requested id was unknown; exit 3 when no ids were given.',
  },
];

// --- General CLI commands ---

export const GENERAL_COMMANDS: CommandEntry[] = [
  {
    command: 'unikit-ai init',
    description: 'Initialize UniKit in current project (interactive wizard)',
  },
  {
    command: 'unikit-ai update',
    description: 'Update installed skills, agents, and rules to latest version. To update the CLI package itself, run `unikit-ai self-update`.',
    flags: ['--force'],
  },
  {
    command: 'unikit-ai self-update',
    description: 'Update the unikit-ai CLI itself to the latest version from npm registry. Detects the package manager (npm/pnpm/yarn/bun/mise/volta) from the binary path and runs the appropriate install command. Interactive by design — skips silently in non-TTY environments. No flags.',
    outputFormat: 'Exit 0 (updated, up to date, skipped, or fetch failure). Exit 1 (install command failed).',
  },
];

/**
 * Generate the CLI contract as markdown text.
 */
export function generateCliContractMarkdown(): string {
  const lines: string[] = [];

  lines.push('# UniKit CLI Contract');
  lines.push('');
  lines.push('Machine-readable reference for AI skills invoking UniKit CLI commands.');
  lines.push('Read this file before using `unikit-ai` commands via Bash tool.');
  lines.push('');

  // Exit codes
  lines.push('## Exit Codes (`unikit-ai rules *`)');
  lines.push('');
  lines.push('| Code | Meaning |');
  lines.push('|------|---------|');
  for (const entry of RULES_EXIT_CODES) {
    lines.push(`| ${entry.code} | ${entry.meaning} |`);
  }
  lines.push('');

  // Rules commands
  lines.push('## Rules Commands');
  lines.push('');
  for (const cmd of RULES_COMMANDS) {
    lines.push(`### \`${cmd.command}\``);
    lines.push('');
    lines.push(cmd.description);
    if (cmd.flags && cmd.flags.length > 0) {
      lines.push(`Flags: ${cmd.flags.map(f => `\`${f}\``).join(', ')}`);
    }
    if (cmd.outputFormat) {
      lines.push(`Output: ${cmd.outputFormat}`);
    }
    lines.push('');
  }

  // Genres commands
  lines.push('## Genres Commands');
  lines.push('');
  lines.push('Genre profiles are a bundled, read-only catalog. Genres reuse the exit-code table above but only ever return codes **0** (success), **1** (not found / no `.unikit.json`), and **3** (invalid args) — there is no network (exit 2) and no migration gate (exit 8).');
  lines.push('');
  for (const cmd of GENRES_COMMANDS) {
    lines.push(`### \`${cmd.command}\``);
    lines.push('');
    lines.push(cmd.description);
    if (cmd.flags && cmd.flags.length > 0) {
      lines.push(`Flags: ${cmd.flags.map(f => `\`${f}\``).join(', ')}`);
    }
    if (cmd.outputFormat) {
      lines.push(`Output: ${cmd.outputFormat}`);
    }
    lines.push('');
  }

  // General commands
  lines.push('## General Commands');
  lines.push('');
  for (const cmd of GENERAL_COMMANDS) {
    lines.push(`### \`${cmd.command}\``);
    lines.push('');
    lines.push(cmd.description);
    if (cmd.flags && cmd.flags.length > 0) {
      lines.push(`Flags: ${cmd.flags.map(f => `\`${f}\``).join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
