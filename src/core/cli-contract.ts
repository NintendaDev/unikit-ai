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
  { code: 1, meaning: 'Not found (rule id, config file, variadic install with every id failing)' },
  { code: 2, meaning: 'Network error / registry unreachable' },
  { code: 3, meaning: 'Invalid arguments (bad id format, relative path, url format)' },
  { code: 4, meaning: 'Operation not permitted (file-exists guards outside variadic install)' },
  { code: 5, meaning: 'Registry validation failed (bad manifest, schema mismatch, engine missing, no always-tagged (core) rules)' },
  { code: 6, meaning: 'Registry already initialized at target path (rules registry init)' },
  { code: 7, meaning: 'Target path occupied by non-registry files (rules registry init)' },
];

// --- Commands ---

export const RULES_COMMANDS: CommandEntry[] = [
  {
    command: 'unikit-ai rules list',
    description: 'List available rules from registry catalog',
    flags: ['--json', '--engine <id>'],
    outputFormat: 'JSON: { engine, rules: [{ id, category, description, version }] }',
  },
  {
    command: 'unikit-ai rules show <id>',
    description: 'Preview a rule from registry (full content with frontmatter)',
    flags: ['--references'],
  },
  {
    command: 'unikit-ai rules install [ids...]',
    description: 'Install rules from the registry. With no arguments, installs all always-tagged (core) rules (the bootstrap used by /unikit Step 9.2). With one or more ids, installs them in a single call with one manifest fetch and prints an aggregated report: per-rule `✓ installed <cat>/<id> v<ver>` / `↻ already installed <cat>/<id>` / `✗ failed <cat>/<id>: <reason>` followed by a summary line `Rules: N installed, M already-installed, K failed`. Re-runs are idempotent; use --force to re-fetch rules already in state.',
    flags: ['--force'],
    outputFormat: 'Human-readable aggregated report. Exit 0 when ≥1 rule is installed or already-installed; exit 1 when every requested id failed; exit 2 registry unreachable; exit 5 engine missing or no always-tagged (core) rules.',
  },
  {
    command: 'unikit-ai rules sync',
    description: 'Reconcile disk ↔ .unikit.json state and regenerate RULES_INDEX.md. By default refreshes registry-sourced rules whose version changed and skips locally-modified files with a warning. Use --replace to overwrite local modifications and re-fetch rules at the same version; use --prune to remove obsolete stack rules that vanished from the registry; combine both for a full mirror (the old `sync --force`).',
    flags: ['--replace', '--prune'],
  },
  {
    command: 'unikit-ai rules status',
    description: 'Show installed rules with source, origin, version, hash',
    flags: ['--json', '--check-updates'],
    outputFormat: 'JSON: { engine, registry, registryKind: "url" | "local" | null, rules: [{ name, category, source, origin, version, installed_hash }] }',
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
