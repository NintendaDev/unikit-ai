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
| 5 | Registry validation failed (bad manifest, schema mismatch, engine missing, no always-tagged (core) rules) |
| 6 | Registry already initialized at target path (rules registry init) |
| 7 | Target path occupied by non-registry files (rules registry init) |
| 8 | Project out of date — run `unikit-ai update` before `rules sync` / `rules install` (memory layout not migrated to the modular `code/` module) |

## Rules Commands

### `unikit-ai rules list`

List available rules from registry catalog
Flags: `--json`, `--engine <id>`
Output: JSON: { engine, rules: [{ id, category, description, version }] }

### `unikit-ai rules show <id>`

Preview a rule from registry (full content with frontmatter)
Flags: `--references`

### `unikit-ai rules install [ids...]`

Install rules from the registry. With no arguments, installs all always-tagged (core) rules (the bootstrap used by /unikit Step 9.2). With one or more ids, installs them in a single call with one manifest fetch and prints an aggregated report: per-rule `✓ installed <cat>/<id> v<ver>` / `↻ already installed <cat>/<id>` / `✗ failed <cat>/<id>: <reason>` followed by a summary line `Rules: N installed, M already-installed, K failed`. Re-runs are idempotent; use --force to re-fetch rules already in state.
Flags: `--force`
Output: Human-readable aggregated report. Exit 0 when ≥1 rule is installed or already-installed; exit 1 when every requested id failed; exit 2 registry unreachable; exit 5 engine missing or no always-tagged (core) rules; exit 8 project out of date (run `unikit-ai update` first).

### `unikit-ai rules sync`

Reconcile disk ↔ .unikit.json state and regenerate RULES_INDEX.md. By default refreshes registry-sourced rules whose version changed and skips locally-modified files with a warning. Use --replace to overwrite local modifications and re-fetch rules at the same version; use --prune to remove obsolete stack rules that vanished from the registry; combine both for a full mirror (the old `sync --force`). Exits 8 when the project memory layout has not been migrated to the modular `code/` module — run `unikit-ai update` first.
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

Scaffold a new local schema:2 rules registry at the target path. Copies package.json, RULE_TEMPLATE.md, scripts/build-manifest.js from the bundled snapshot and creates code/<engine>/{core,stack}/ for the project engine (from .unikit.json) or all 4 engines when run outside a UniKit project, plus the reserved gamedesign/{core,library}/ tree. Writes a schema:2 manifest.json directly (does not run build-manifest.js). Does not touch git or the caller project .unikit.json. Exit codes: 6 (already initialized), 7 (path occupied).

### `unikit-ai rules registry migrate [path]`

Migrate a local rules registry on disk from schema:1 (flat <engine>/<tier>/) to schema:2 (code/<engine>/<tier>/), relocating rule files and rewriting manifest.json. Idempotent — a second run is a no-op. Targets the given path, or the configured rulesRegistry when it is local; remote registries cannot be migrated (clone locally first). Exit codes: 0 (migrated or already latest), 1 (target manifest missing), 3 (no local target), 5 (resulting manifest invalid / unsupported schema).

### `unikit-ai rules registry status [target]`

Report a registry's physical schema and whether the CLI can migrate/write it. Distinct from `unikit-ai rules status`, which lists the project's installed rules — this inspects the registry SOURCE (write/migrate capability). Reads the raw schema from a single source (no fallback chain). Defaults to the configured registry; pass [target] to inspect another. Exit codes: 0 (reachable, schema ≤ latest), 2 (unreachable), 5 (schema > latest, unsupported).
Flags: `--json`
Output: Human table + verdict line, or --json: { target, kind: "local" | "remote", schema: number | null, isLatestSchema, readable, writable }

## General Commands

### `unikit-ai init`

Initialize UniKit in current project (interactive wizard)

### `unikit-ai update`

Update installed skills, agents, and rules to latest version. To update the CLI package itself, run `unikit-ai self-update`.
Flags: `--force`

### `unikit-ai self-update`

Update the unikit-ai CLI itself to the latest version from npm registry. Detects the package manager (npm/pnpm/yarn/bun/mise/volta) from the binary path and runs the appropriate install command. Interactive by design — skips silently in non-TTY environments. No flags.

