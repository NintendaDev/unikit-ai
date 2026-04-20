# UniKit CLI Contract

Machine-readable reference for AI skills invoking UniKit CLI commands.
Read this file before using `unikit-ai` commands via Bash tool.

## Exit Codes (`unikit-ai rules *`)

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Not found (rule id, config file, variadic install with every id failing) |
| 2 | Network error / registry unreachable |
| 3 | Invalid arguments (bad id format, relative path, url format) |
| 4 | Operation not permitted (file-exists guards outside variadic install) |
| 5 | Registry validation failed (bad manifest, schema mismatch, engine missing, empty core whitelist) |
| 6 | Registry already initialized at target path (rules registry init) |
| 7 | Target path occupied by non-registry files (rules registry init) |

## Rules Commands

### `unikit-ai rules list`

List available rules from registry catalog
Flags: `--json`, `--engine <id>`
Output: JSON: { engine, rules: [{ id, category, description, version }] }

### `unikit-ai rules show <id>`

Preview a rule from registry (full content with frontmatter)
Flags: `--references`

### `unikit-ai rules install [ids...]`

Install rules from the registry. With no arguments, installs the whitelisted core bootstrap (used by /unikit Step 9.2). With one or more ids, installs them in a single call with one manifest fetch and prints an aggregated report: per-rule `✓ installed <cat>/<id> v<ver>` / `↻ already installed <cat>/<id>` / `✗ failed <cat>/<id>: <reason>` followed by a summary line `Rules: N installed, M already-installed, K failed`. Re-runs are idempotent; use --force to re-fetch rules already in state.
Flags: `--force`
Output: Human-readable aggregated report. Exit 0 when ≥1 rule is installed or already-installed; exit 1 when every requested id failed; exit 2 registry unreachable; exit 5 engine missing or empty core whitelist.

### `unikit-ai rules sync`

Reconcile disk ↔ .unikit.json state and regenerate RULES_INDEX.md. By default refreshes registry-sourced rules whose version changed and skips locally-modified files with a warning. Use --replace to overwrite local modifications and re-fetch rules at the same version; use --prune to remove obsolete stack rules that vanished from the registry; combine both for a full mirror (the old `sync --force`).
Flags: `--replace`, `--prune`

### `unikit-ai rules status`

Show installed rules with source, origin, version, hash
Flags: `--json`, `--check-updates`
Output: JSON: { engine, registry, registryKind: "url" | "local" | null, rules: [{ name, category, source, origin, version, installed_hash }] }

### `unikit-ai rules registry`

Alias for `unikit-ai rules registry show`. Print the currently configured rules registry URL and its kind. Use the nested subcommands `show`, `set`, `reset`, `init` for the full surface.
Flags: `--json`
Output: Human text or --json: { configured: boolean, url: string, kind: "url" | "local" | null }

### `unikit-ai rules registry show`

Print the currently configured rules registry URL and its kind. Read-only — never touches `.unikit.json` or rule files.
Flags: `--json`
Output: Human text or --json: { configured: boolean, url: string, kind: "url" | "local" | null }

### `unikit-ai rules registry set <url>`

Set the rules registry URL (validated against the engine). Writes `.unikit.json.rulesRegistry` ONLY — does NOT touch rule files on disk or run a sync. After a set the CLI prints an info-block reminding the user to run `unikit-ai rules sync [--replace] [--prune]` when they want to pull content.
Flags: `--json`
Output: Human text + hints block; --json: { configured: true, url, kind }

### `unikit-ai rules registry reset`

Reset the rules registry URL to the default (official `NintendaDev/unikit-ai-rules`). Writes the literal `OFFICIAL_REGISTRY_URL` into `.unikit.json.rulesRegistry` (same value the wizard writes when the user declines a custom registry during init). Does NOT touch rule files on disk. Legacy projects with `rulesRegistry: null` still load correctly via `resolveRegistryUrl()`. Run `unikit-ai rules sync` afterwards to reconcile against the default registry.
Flags: `--json`
Output: Human text + hints block; --json: { configured: true, url, kind }

### `unikit-ai rules registry init [path]`

Scaffold a new local rules registry at the target path. Copies package.json, RULE_TEMPLATE.md, scripts/build-manifest.js from the bundled snapshot and creates <engine>/{core,stack}/ for the project engine (from .unikit.json) or all 4 engines when run outside a UniKit project. Runs build-manifest.js on creation. Does not touch git or the caller project .unikit.json. Exit codes: 6 (already initialized), 7 (path occupied).

## General Commands

### `unikit-ai init`

Initialize UniKit in current project (interactive wizard)

### `unikit-ai update`

Update installed skills, agents, and rules to latest version. To update the CLI package itself, run `unikit-ai self-update`.
Flags: `--force`

### `unikit-ai self-update`

Update the unikit-ai CLI itself to the latest version from npm registry. Detects the package manager (npm/pnpm/yarn/bun/mise/volta) from the binary path and runs the appropriate install command. Interactive by design — skips silently in non-TTY environments. No flags.
Output: Exit 0 (updated, up to date, skipped, or fetch failure). Exit 1 (install command failed).

