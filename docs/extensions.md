[← Rules Registry](rules-registry.md) · [Back to README](../README.md)

# Extensions

Extensions let third-party developers add new capabilities to UniKit AI - custom skills, subagents, skill injections, MCP servers, CLI commands, and skill replacements. Extensions survive `unikit-ai update` (injections are automatically re-applied after base skills are refreshed).

---

## For Users

### Installing an Extension

```bash
# From a local directory
unikit-ai extension add ./my-extension

# From a git repository
unikit-ai extension add https://github.com/user/unikit-ext-example.git

# From GitHub shorthand
unikit-ai extension add user/unikit-ext-example

# With a specific branch or tag
unikit-ai extension add user/unikit-ext-example#v2.0.0
```

### Managing Extensions

```bash
# List installed extensions
unikit-ai extension list

# Update all extensions from their sources
unikit-ai extension update

# Force reinstall even if version unchanged
unikit-ai extension update --force

# Remove an extension (cleans up injections, MCP servers, and files)
unikit-ai extension remove unikit-ext-example
```

### What Happens on Install

1. Extension source is resolved (local path, git clone, or GitHub API)
2. Manifest (`extension.json`) is validated
3. Command module files are verified to exist (if `commands` is defined)
4. Extension files are copied to `.unikit/extensions/<name>/`
5. Extension is recorded in `.unikit.json` under `extensions`
6. Skills are installed into all configured agents (applying agent-specific transformers)
7. Subagents are installed into agents that support them
8. Injections are applied to matching skill/subagent files
9. MCP servers are merged into each agent's settings file
10. Command modules are available on next CLI invocation

### What Happens on Update

Running `unikit-ai update`:

1. **Self-update check** - prompts to update the CLI if a newer version exists
2. **Base skill update** - updates installed base skills (hash-based change detection)
3. **Extension refresh** - checks installed extensions for updates from their sources:
   - GitHub repos: fetches `extension.json` via GitHub API (faster than cloning)
   - Git repos: requires `--force` to refresh
   - Local paths: requires `--force` to refresh
   - Extensions with unchanged versions are skipped
4. **Re-apply injections** - all extension injections are re-applied automatically

`unikit-ai update --force` forces a clean reinstall of base skills AND forces extension refresh regardless of version changes.

#### Extension Update Behavior

| Source Type | Version Check | `--force` Behavior |
|-------------|---------------|-------------------|
| GitHub | API fetch of `extension.json`, skip if unchanged | Always re-clone |
| Git (non-GitHub) | Requires `--force` | Always re-clone |
| Local path | Requires `--force` | Re-copy from source |

#### GitHub API Rate Limits

GitHub API requests use `GITHUB_TOKEN` if present (5,000 req/hr). Without a token, you're limited to 60 req/hr. If rate-limited, the extension refresh is skipped with a warning - the broader `update` continues.

```bash
# Set GITHUB_TOKEN for higher rate limits
export GITHUB_TOKEN=ghp_xxxx
unikit-ai update
```

### Updating Extensions Separately

Use `unikit-ai extension update` to refresh extensions without updating base skills:

```bash
# Update all extensions
unikit-ai extension update

# Force refresh regardless of version
unikit-ai extension update --force
```

### What Happens on Remove

1. Injection markers are stripped from all skill/subagent files
2. MCP server entries are removed from agent settings files
3. Extension skills and subagents are removed from all agents
4. Extension directory is deleted from `.unikit/extensions/`
5. Extension record is removed from `.unikit.json`
6. If the extension replaced base skills, the originals are restored automatically

---

## For Developers

### Extension Structure

An extension is a directory (or git repo) with `extension.json` in the root:

```
unikit-ext-example/
├── extension.json          # Manifest (required)
├── skills/                 # Custom and replacement skills
│   ├── my-skill/
│   │   └── SKILL.md
│   └── my-commit/          # Can replace built-in unikit-commit
│       └── SKILL.md
├── subagents/              # Subagent definitions
│   └── my-agent.md
├── injections/             # Content to inject into existing skills
│   └── implement-extra.md
└── mcp/                    # MCP server templates
    └── my-server.json
```

### Manifest: `extension.json`

```json
{
  "name": "unikit-ext-example",
  "version": "1.0.0",
  "description": "Example extension",
  "skills": [
    "skills/my-skill",
    "skills/my-commit"
  ],
  "subagents": [
    "subagents/my-agent.md"
  ],
  "replaces": {
    "skills/my-commit": "unikit-commit"
  },
  "injections": [
    {
      "target": "unikit-implement",
      "targetType": "skill",
      "position": "append",
      "file": "./injections/implement-extra.md"
    }
  ],
  "mcpServers": [
    {
      "key": "my-server",
      "template": "./mcp/my-server.json"
    }
  ]
}
```

Only `name` and `version` are required. All other fields are optional.

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Unique extension name. Must match `unikit-ext-<lowercase-alphanumeric-hyphens>` |
| `version` | `string` | Yes | SemVer version (e.g., `1.0.0`) |
| `description` | `string` | No | Human-readable description |
| `commands` | `ExtensionCommand[]` | No | CLI commands registered at startup (see [Commands](#commands)) |
| `skills` | `string[]` | No | Paths to skill directories within the extension |
| `subagents` | `string[]` | No | Paths to subagent `.md` files within the extension |
| `replaces` | `Record<string, string>` | No | Maps extension skill paths to base skill names they replace |
| `injections` | `ExtensionInjection[]` | No | Content to inject into existing skill/subagent files |
| `mcpServers` | `ExtensionMcpServer[]` | No | MCP server configurations to merge into agent settings |

### Name Validation

Extension names must match the pattern: `^unikit-ext-[a-z][a-z0-9-]*$`

Valid: `unikit-ext-hello`, `unikit-ext-custom-commit`, `unikit-ext-v2`
Invalid: `my-extension`, `unikit-ext-`, `unikit-ext-Hello`, `unikit-ext-hello_world`

---

### Skills

Extensions can bundle custom skills. List them in the manifest `skills` array as relative paths:

```json
{
  "skills": ["skills/my-custom-skill"]
}
```

Each skill follows the standard format - a directory with `SKILL.md`:

```
skills/my-custom-skill/
├── SKILL.md              # Skill definition with YAML frontmatter
└── references/           # Optional reference files
    └── patterns.md
```

On `unikit-ai extension add`, skills are installed into each configured agent's skills directory using the same agent transformer logic as built-in skills. The original extension copy remains in `.unikit/extensions/<name>/`.

### Skill Replacements

Extensions can replace built-in skills with their own versions using the `replaces` field. This maps extension skill paths to the base skill names they replace:

```json
{
  "skills": ["skills/my-commit"],
  "replaces": {
    "skills/my-commit": "unikit-commit"
  }
}
```

#### How Replacements Work

The replacement skill is installed **under the base skill name**. For example, `skills/my-commit` from the extension will be installed as `unikit-commit/SKILL.md` in the agent's skills directory. The user still invokes `/unikit-commit` - but the content comes from the extension.

**On install** (`extension add`):
1. The extension skill overwrites the base skill directory (installed under the base name)
2. The replacement is recorded in `.unikit.json`

**On update** (`unikit-ai update`):
1. Extension replacement skills are re-installed from `.unikit/extensions/`
2. If the extension manifest is missing or broken, the base skill is restored automatically

**On remove** (`extension remove`):
1. The replacement skill is removed (by its base name)
2. The original base skill is **restored** from the package

**Conflict detection:** No two extensions can replace the same base skill. Attempting to install a second extension that replaces an already-replaced skill will produce an error.

#### Example

An extension that replaces `unikit-commit` with a custom commit workflow:

```
unikit-ext-custom-commit/
├── extension.json
└── skills/
    └── my-commit/
        └── SKILL.md
```

```json
{
  "name": "unikit-ext-custom-commit",
  "version": "1.0.0",
  "skills": ["skills/my-commit"],
  "replaces": {
    "skills/my-commit": "unikit-commit"
  }
}
```

After installation, the extension's `my-commit/SKILL.md` is installed as `unikit-commit/SKILL.md`. The user invokes `/unikit-commit` as before - the replacement is transparent.

---

### Subagents

Extensions can provide subagent definitions. List them in the manifest `subagents` array:

```json
{
  "subagents": ["subagents/my-agent.md"]
}
```

Each subagent is a markdown file with YAML frontmatter:

```markdown
---
name: my-agent
description: My custom agent for specialized tasks
model: sonnet
---

Agent instructions here...
```

Subagents are only installed for agents that support them (e.g., Claude Code). They are placed in the agent's subagents directory (e.g., `.claude/agents/`).

---

### Injections

Injections append or prepend content to existing skill or subagent files. This lets extensions augment built-in workflows without replacing them entirely.

#### Injection Definition

```json
{
  "target": "unikit-implement",
  "targetType": "skill",
  "position": "append",
  "file": "./injections/implement-extra.md"
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `target` | Any skill/subagent name | The target to inject into (e.g., `unikit-implement`, `unikit-commit`) |
| `targetType` | `skill` or `subagent` | Type of target. Defaults to `skill` |
| `position` | `append` or `prepend` | Where to insert the content |
| `file` | Relative path | Path to the markdown file within the extension directory |

#### How Injections Work

Injected content is wrapped in HTML comment markers for tracking:

```markdown
<!-- unikit-ext:my-extension:unikit-implement:append:start -->
Your injected content here.
<!-- unikit-ext:my-extension:unikit-implement:append:end -->
```

These markers enable:
- **Idempotent application** - re-installing the same extension won't duplicate content
- **Clean removal** - `extension remove` strips exactly the injected blocks
- **Update survival** - `unikit-ai update` overwrites base skills, then re-applies all injections

#### Example Injection File

```markdown
## Post-Implementation Checklist (from my-extension)

After completing each task:
1. Run the linter
2. Check for debug statements left in production code
3. Verify error messages are user-friendly
```

---

### MCP Servers

Extensions can provide MCP (Model Context Protocol) server configurations that are automatically merged into each agent's settings file.

#### MCP Server Definition

```json
{
  "key": "my-server",
  "template": "./mcp/my-server.json"
}
```

| Field | Description |
|-------|-------------|
| `key` | Unique key for the MCP server entry in the agent's settings |
| `template` | Path to a JSON template file within the extension directory |

#### MCP Template Format

The template must contain either a `command` or `url` field, and may optionally declare tool permissions that are injected into installed skills and subagents:

```json
{
  "key": "context7",
  "displayName": "Context7 (library documentation)",
  "instruction": "Context7: No additional configuration needed.",
  "config": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp@latest"]
  },
  "allowed-tools": {
    "agents": {
      "my-subagent": ["resolve-library-id", "query-docs"]
    },
    "skills": {
      "my-skill": ["resolve-library-id", "query-docs"]
    }
  }
}
```

Or for HTTP-based servers:

```json
{
  "config": {
    "type": "http",
    "url": "http://localhost:9090/mcp"
  }
}
```

The `config` object is merged into each agent's settings file under `mcpServers.<key>`. All agents with MCP support receive the server entry:

| Agent | MCP Settings File |
|-------|------------------|
| Claude Code | `.mcp.json` |
| Codex CLI | `.codex/config.toml` |
| Cursor | `.cursor/mcp.json` |
| Gemini CLI | `.gemini/settings.json` |
| Qwen Code | `.qwen/settings.json` |
| OpenCode | `opencode.json` |

On `extension remove`, the key is deleted from the settings file.

#### Tool Permission Injection (`allowed-tools`)

The optional `allowed-tools` block declares which MCP tools each skill or subagent is allowed to call. At install time the tool names are expanded into the fully qualified MCP form (`mcp__<server-key>__<tool>`) and injected into the target skill/subagent frontmatter. The frontmatter field differs per agent:

- Claude Code uses `allowed-tools:` (comma-separated list appended to the existing value)
- All other agents use `tools:` in the same shape

Injection is idempotent: re-running install, update, or extension refresh merges new entries and deduplicates existing ones, never duplicating a tool already present. Removing the extension also strips the injected tool names back out of the frontmatter lists, preserving any tools that were declared manually or by other sources.

Use `allowed-tools` when a skill must reach a specific MCP server (for example `/unikit-explore` calling Context7 for library docs), while keeping unrelated skills in the project unaffected.

---

### Commands

Extensions can register custom CLI commands that are available as `unikit-ai <command-name>`. Commands are loaded dynamically at CLI startup from installed extensions.

#### Command Definition

```json
{
  "commands": [
    {
      "name": "my-setup",
      "description": "Run post-install setup for my extension",
      "module": "./commands/setup.js"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `name` | Command name (available as `unikit-ai <name>`) |
| `description` | Human-readable description shown in `--help` |
| `module` | Path to an ESM JavaScript module within the extension directory |

#### Command Module Format

The module must export a `register` function that receives the [Commander.js](https://github.com/tj/commander.js) program instance:

```javascript
// commands/setup.js
export function register(program) {
  program
    .command('my-setup')
    .description('Run post-install setup for my extension')
    .option('--force', 'Overwrite existing files')
    .action((opts) => {
      console.log('Running setup...');
      // Full filesystem access - copy files, modify configs, etc.
    });
}
```

After installation, the command is available as:

```bash
unikit-ai my-setup
unikit-ai my-setup --force
```

#### Use Case: Post-Install File Copying

Commands are useful for copying additional files (agents, hooks, configs) into agent directories after installation:

```javascript
// commands/setup.js
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

export function register(program) {
  program
    .command('my-setup')
    .description('Copy agents and hooks into .claude/')
    .option('--force', 'Overwrite existing files')
    .action(async (opts) => {
      const projectDir = process.cwd();
      const files = [
        { src: 'agents/my-agent.md', dest: '.claude/agents/my-agent.md' },
      ];

      for (const { src, dest } of files) {
        const destPath = path.join(projectDir, dest);
        if (!opts.force) {
          try { await fs.access(destPath); console.log(`  SKIP  ${dest}`); continue; } catch {}
        }
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(path.join(ASSETS_DIR, src), destPath);
        console.log(`  COPY  ${dest}`);
      }
    });
}
```

#### Module Validation

Command module files are validated at install time - if a `module` path references a file that doesn't exist in the extension directory, installation fails immediately with a descriptive error.

#### Error Handling

A broken command module will **not** crash the CLI. If a module fails to load, a warning is printed to stderr and all other commands continue to work normally.

#### Security

Command modules execute arbitrary JavaScript code with full system access. **Only install extensions from sources you trust**, just as you would with npm packages.

---

### Template Variables

Extension skills and subagents can use template variables that are substituted at install time:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `{{skills_dir}}` | `.claude/skills` | Agent's skills directory |
| `{{home_skills_dir}}` | `~/.claude/skills` | Agent's home skills directory |
| `{{settings_file}}` | `.mcp.json` | Agent's MCP settings file |
| `{{skills_cli_agent_flag}}` | `--agent claude-code` | CLI agent flag |
| `{{engine_name}}` | `Unity` | Game engine name |
| `{{engine_code_language}}` | `CSharp` | Engine's programming language |
| `{{engine_mcp_tool}}` | `UnityMCP` | Engine MCP server key |

Use these in SKILL.md files to write agent-agnostic skills:

```markdown
Read the project rules from `{{skills_dir}}/unikit/SKILL.md`.
```

---

### Source Types

Extensions can be installed from three source types:

#### Local Path

Starts with `./`, `../`, `/`, or a drive letter. Points to a directory on disk.

```bash
unikit-ai extension add ./my-extension
unikit-ai extension add ../extensions/unikit-ext-hello
unikit-ai extension add /home/user/extensions/unikit-ext-hello
```

#### Git URL

Full git URL. Supports optional branch/tag reference with `#ref`.

```bash
unikit-ai extension add https://github.com/user/unikit-ext-example.git
unikit-ai extension add https://github.com/user/unikit-ext-example.git#v2.0.0
unikit-ai extension add git://example.com/unikit-ext-example.git
```

#### GitHub Shorthand

`owner/repo` format, automatically expanded to `https://github.com/{owner}/{repo}.git`.

```bash
unikit-ai extension add user/unikit-ext-example
unikit-ai extension add my-org/unikit-ext-tools#main
```

---

## Storage Layout

```
your-project/
├── .unikit/
│   └── extensions/
│       └── unikit-ext-example/        # Installed extension
│           ├── extension.json
│           ├── skills/
│           ├── subagents/
│           ├── injections/
│           └── mcp/
├── .unikit.json                       # extensions[] array tracks installed extensions
├── .claude/
│   ├── skills/                        # Extension skills installed here
│   └── agents/                        # Extension subagents installed here
└── .mcp.json                          # MCP servers merged here (Claude Code)
```

## Config Format

Extensions are tracked in `.unikit.json`:

```json
{
  "version": "1.0.0",
  "agents": [...],
  "extensions": [
    {
      "name": "unikit-ext-example",
      "source": "https://github.com/user/unikit-ext-example.git",
      "version": "1.0.0",
      "replacedSkills": {
        "unikit-commit": "skills/my-commit"
      }
    }
  ]
}
```

The `replacedSkills` field maps base skill names to extension skill paths, enabling automatic restoration of base skills when the extension is removed.

---

## Backup and Rollback

During installation, a backup is created at `.unikit/extensions/<name>.backup`. If any error occurs during the asset installation phase:

1. The corrupted extension directory is deleted
2. The backup is restored
3. The original error is thrown

This ensures the project stays in a consistent state even if installation fails mid-way.

---

## Security Considerations

- **Extension names are validated** - names must match `unikit-ext-<lowercase-alphanumeric-hyphens>`, preventing path traversal
- **Git clones use shallow depth** - `git clone --depth 1` for minimal download
- **Manifest validation** - all manifest fields are strictly validated before installation
- **Replacement conflicts** - no two extensions can replace the same base skill
- **Command modules execute code** - command modules are dynamically imported at CLI startup. Only install extensions you trust, just as you would with npm packages
- **Command module validation** - module files referenced in `commands` are verified to exist at install time

---

## Complete Example

An extension with all features:

**extension.json:**
```json
{
  "name": "unikit-ext-complete",
  "version": "1.2.0",
  "description": "Complete example with all extension features",
  "commands": [
    {
      "name": "complete-setup",
      "description": "Post-install setup for complete extension",
      "module": "./commands/setup.js"
    }
  ],
  "skills": [
    "skills/web-analyzer",
    "skills/code-reviewer"
  ],
  "subagents": [
    "subagents/web-expert.md"
  ],
  "replaces": {
    "skills/code-reviewer": "unikit-review"
  },
  "injections": [
    {
      "target": "unikit-implement",
      "targetType": "skill",
      "position": "append",
      "file": "./injections/extra-checks.md"
    },
    {
      "target": "unikit-implement-coordinator",
      "targetType": "subagent",
      "position": "prepend",
      "file": "./injections/agent-preamble.md"
    }
  ],
  "mcpServers": [
    {
      "key": "web-mcp",
      "template": "./mcp/web-server.json"
    }
  ]
}
```

**Directory structure:**
```
unikit-ext-complete/
├── extension.json
├── commands/
│   └── setup.js
├── skills/
│   ├── web-analyzer/
│   │   ├── SKILL.md
│   │   └── references/
│   │       └── web-patterns.md
│   └── code-reviewer/
│       └── SKILL.md
├── subagents/
│   └── web-expert.md
├── injections/
│   ├── extra-checks.md
│   └── agent-preamble.md
└── mcp/
    └── web-server.json
```

**Installation result:**
- 1 new skill installed (`web-analyzer`)
- 1 base skill replaced (`unikit-review` with extension's `code-reviewer`)
- 1 subagent installed (`web-expert`) - for agents that support subagents
- Content appended to `unikit-implement` skill
- Content prepended to `unikit-implement-coordinator` subagent
- `web-mcp` server configured in `.mcp.json`
- `complete-setup` CLI command registered (available as `unikit-ai complete-setup`)

## See Also

- [Configuration](configuration.md) - `.unikit.json` format, MCP servers, project structure
- [Skills Reference](skills.md) - all built-in skills that extensions can augment or replace
- [Getting Started](getting-started.md) - installation and first project setup
