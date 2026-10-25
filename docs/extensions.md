[← Rules Registry](rules-registry.md) · [Back to README](../README.md)

# Extensions

Extensions let third-party developers add new capabilities to UniKit AI - custom skills, subagents, skill injections (by position, or at a named extension point), MCP servers, CLI commands, and skill replacements. Extensions survive `unikit-ai update` (injections are automatically re-applied after base skills are refreshed).

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

# Choose in a terminal: a list of the extension's skills, subagents and MCP servers, everything checked
unikit-ai extension add ./my-extension

# Without a menu: install everything except the named items
unikit-ai extension add ./my-extension --skip-skills noisy-skill --skip-subagents helper --skip-mcp my-server
```

### Choosing What to Install

An extension can ship skills, subagents and MCP servers. You decide which of them end up in the project:

- **Skills** - including skills that replace a base skill, listed as `my-commit → unikit-commit`
- **Subagents**
- **MCP servers**

CLI commands and injections are not part of the list: they always come with the extension (see [Injections and the selection](#injections-and-the-selection)).

**The menu.** In a terminal `unikit-ai extension add` shows one list with the three sections, everything checked. Uncheck what you do not want and confirm. When you add an extension that is already installed, the list is pre-filled with your earlier choices; items the new version added are checked. Cancelling the list is treated as "no change": nothing is written and the temporary git clone is removed (the cancel path is covered by the code, not yet confirmed in a live terminal). The menu is shown only in a terminal and only when no flag has already decided the question (see below).

**Flags.** The flags only ever switch items off:

| Flag | Takes | Meaning |
|------|-------|---------|
| `--skip-skills <names>` | Comma-separated names (repeatable) | Do not install these skills. A name is the skill directory name or its path from the manifest |
| `--skip-subagents <names>` | Comma-separated names (repeatable) | Do not install these subagents. A name is the file name without `.md` or its path from the manifest |
| `--skip-mcp <keys>` | Comma-separated keys (repeatable) | Do not install these MCP servers |
| `--yes`, `-y` | - | Do not show the menu and do not ask anything; follow the rules below |
| `--install-new` | - | Turn on the items that have no decision yet (see below) |
| `--skip-new` | - | Leave those items uninstalled without asking; wins over `--install-new` |

An unknown name, or a name that matches two skills (use the manifest path then), is an error with exit code `1`, reported before anything is written.

**Without a terminal** (CI, scripts, `--yes`, or any of the flags above) there is no menu and the rules are:

| | No flags | `--install-new` | `--skip-new` | `--skip-skills` / `--skip-subagents` / `--skip-mcp` |
|---|----------|-----------------|--------------|--------------------|
| **First install** | Everything is installed | Ignored: everything is installed | Ignored: everything is installed | Everything except the named items |
| **Installed extension** (`add` again, `update`, `extension update`) | Earlier choices are kept; items with no decision yet are **not** installed | Items with no decision yet are turned on; an item you switched off stays off | Items with no decision yet stay undecided; no question | The named items are off, an undecided one included; earlier choices are kept |

A flag never turns an item you switched off back on: that is what the menu is for.

**Changing the choice later.**

```bash
# Menu in a terminal, pre-filled with the current state
unikit-ai extension select unikit-ext-example

# Without a terminal: switch items off, or turn on the ones with no decision yet
unikit-ai extension select unikit-ext-example --skip-skills noisy-skill --skip-mcp my-server
unikit-ai extension select unikit-ext-example --install-new
```

`extension select` works on the copy in `.unikit/extensions/<name>/`: the source is not needed. It takes out what turned off, installs what turned on, re-applies the injections and, when a replacement is switched off, puts the base skill back at once. Without a terminal and without a flag that changes something it stops with `Nothing to change` and exit code `1`. Turning on an item you switched off earlier needs the menu.

`unikit-ai extension list` shows `Skipped:` (items you switched off) and `Not decided:` (items of the installed version that have no decision yet).

### Managing Extensions

```bash
# List installed extensions
unikit-ai extension list

# Choose which items of an installed extension are installed
unikit-ai extension select unikit-ext-example

# Update all extensions from their sources
unikit-ai extension update

# Force reinstall even if version unchanged
unikit-ai extension update --force

# Remove an extension (cleans up injections, MCP servers, and files)
unikit-ai extension remove unikit-ext-example
```

### What Happens on Install

1. Extension source is resolved (local path, or a shallow `git clone` for both git and GitHub sources)
2. Manifest (`extension.json`) is validated
3. The selection is made: the menu in a terminal, otherwise the flags and rules from [Choosing What to Install](#choosing-what-to-install). A wrong name or a closed menu stops here, before anything is written, and the temporary clone is removed
4. Command module files are verified to exist (if `commands` is defined)
5. Extension files are copied to `.unikit/extensions/<name>/` (the whole extension, including the items you left out - `extension select` needs them)
6. The selected skills are installed into all configured agents (applying agent-specific transformers)
7. The selected subagents are installed into agents that support them
8. Injections are applied: position-based text is added to the target file; extension-point text is rendered for each agent and inserted under the point's anchor, and the entry's reference files are copied into the target skill. The command then prints `Injections: N of M applied` and the reason for every skipped entry
9. The selected MCP servers are merged into each agent's settings file
10. Extension is recorded in `.unikit.json` under `extensions` (with your `selection`) - **last**, only once every asset above is on disk, so an interrupted install never leaves a recorded extension whose files never arrived
11. Command modules are available on next CLI invocation

### What Happens on Update

Running `unikit-ai update`:

1. **Extension refresh** - every installed extension is re-resolved from its source and compared by manifest `version`; changed ones are re-committed
2. **Base skill update** - updates installed base skills (hash-based change detection)
3. **Re-render injections** - one pass over every installed extension and every agent re-applies all injections and reference files after the base skills and MCP grants are refreshed

The extension refresh runs **before** the base-skill update, so a skill an extension replaces is already in place when the base pass walks the skill list.

The injection pass does not depend on the order the extensions were installed in or on earlier runs: it renders everything from the installed extensions each time. `update` does not treat injected text as a local edit of the skill, so adding, updating or removing an extension is never followed by a `Local modifications detected` warning.

`unikit-ai update` does **not** check whether a newer CLI version is on npm. Updating the CLI package itself is a separate, explicitly-invoked command:

```bash
unikit-ai self-update   # update the CLI package from npm
unikit-ai update        # update this project's installed content
```

`unikit-ai update --force` forces a clean reinstall of base skills AND re-commits every extension regardless of whether its version changed.

#### Extension Update Behavior

All three source types are treated **identically**: the source is always re-resolved, and the freshly-read manifest `version` is compared against the recorded one. `--force` only controls whether an *unchanged* version is re-committed anyway.

| Source Type | Version Check | `--force` Behavior |
|-------------|---------------|-------------------|
| GitHub | Shallow clone, compare manifest `version`, skip if unchanged | Re-commit even when unchanged |
| Git (non-GitHub) | Shallow clone, compare manifest `version`, skip if unchanged | Re-commit even when unchanged |
| Local path | Re-read manifest, compare `version`, skip if unchanged | Re-copy from source |

There is no GitHub-API fast path and no `GITHUB_TOKEN` handling in the refresh flow - a GitHub source is cloned like any other git source, so GitHub API rate limits never apply to `unikit-ai update`.

#### New items of an installed extension

Your earlier choices survive every `update`, `update --force`, `init` and `extension update`: what you switched off is not installed again. An item the extension offers that you have not decided on - typically one a new version added - is called *new* (or *undecided*) and is handled the way new skills of the package are in `unikit-ai update`:

- **In a terminal**, `update` and `extension update` show a list of only those items, everything checked. Items you uncheck are remembered as "not wanted" and are not offered again; `extension select` is the way back.
- **Without a terminal**, new items are **not** installed. The command says `not installed (undecided)` and names them. Pass `--install-new` to install them (it never turns on an item you switched off), or `--skip-new` to decline explicitly: the items then stay undecided and nothing is asked.

**This changes the behaviour of non-interactive runs.** Before item selection existed, a new version of an extension installed everything it added by itself. Now a run without a terminal installs new items only with `--install-new`. In CI, use for example:

```bash
unikit-ai extension update --install-new
unikit-ai update --install-new
```

A record from before item selection (no `selection` in `.unikit.json`) is read as "what is installed is on": the first update after the upgrade keeps all of it, and only the items the new version adds are undecided.

### Updating Extensions Separately

Use `unikit-ai extension update` to refresh extensions without updating base skills:

```bash
# Update all extensions
unikit-ai extension update

# Force refresh regardless of version
unikit-ai extension update --force
```

### What Happens on Remove

1. Injection blocks and copied reference files are removed; the target files return to the bytes they had before the extension was added
2. MCP server entries are removed from agent settings files
3. Extension skills and subagents are removed from all agents
4. Extension directory is deleted from `.unikit/extensions/`
5. Extension record is removed from `.unikit.json`
6. If the extension replaced base skills, the originals are restored automatically

Only what the extension installed is removed: a skill, a subagent or an MCP key that was left out of the selection is never touched, so a file of the same name that you added yourself stays. The same holds when you deselect an agent on a repeat `init`.

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
| `name` | `string` | Yes | Unique extension name. Must match `^[a-zA-Z0-9_@][\w.@/-]*$` - see [Name Validation](#name-validation) |
| `version` | `string` | Yes | SemVer version (e.g., `1.0.0`) |
| `description` | `string` | No | Human-readable description |
| `commands` | `ExtensionCommand[]` | No | CLI commands registered at startup (see [Commands](#commands)) |
| `skills` | `string[]` | No | Paths to skill directories within the extension |
| `subagents` | `string[]` | No | Paths to subagent `.md` files within the extension |
| `replaces` | `Record<string, string>` | No | Maps extension skill paths to base skill names they replace |
| `injections` | `ExtensionInjection[]` | No | Content to inject into existing skill/subagent files, by position or at a named extension point (see [Injections](#injections)) |
| `mcpServers` | `ExtensionMcpServer[]` | No | MCP server configurations to merge into agent settings |

### Name Validation

Extension names must match the pattern: `^[a-zA-Z0-9_@][\w.@/-]*$` - start with an alphanumeric, `_` or `@`, then word characters, dots, `@`, `/` or `-`. The name must also not contain `..` anywhere (so `a..b` is rejected) and must not be an absolute path.

Valid: `unikit-ext-hello`, `my-extension`, `@scope/my-ext`, `unikit-ext-v2`, `Custom_Ext`
Invalid: `-leading-hyphen`, `.dotfile`, `../traversal`, `name with spaces`

The `unikit-ext-` prefix used throughout this page is a **naming convention**, not a requirement - it keeps third-party extensions visually distinct from bundled UniKit content. The validator does not enforce it, and lowercase is not enforced either.

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
1. The base-skill pass **skips** every skill an extension replaces, so the replacement survives the update untouched rather than being overwritten by the packaged original
2. The extension's own `skills` and `subagents` you left on are reinstalled from `.unikit/extensions/`. A `replaces` entry is not itself reinstalled - it is protected by the skip above, which covers every skill a *selected* replacement owns
3. If an extension's manifest is missing or unreadable, that extension is skipped silently in the reinstall and injection passes and the update continues; a source that cannot be resolved during the refresh pass produces a `Could not refresh extension` warning. The base skill is **not** restored - restoring an original is exclusively the job of `unikit-ai extension remove`

**On remove** (`extension remove`):
1. The replacement skill is removed (by its base name)
2. The original base skill is **restored** from the package

**Conflict detection:** No two extensions can replace the same base skill. Attempting to install a second extension that replaces an already-replaced skill will produce an error. Only replacements you left on count: a replacement that is switched off is neither installed nor a conflict.

**Leaving a replacement out.** A replacement is an item of its own in the selection (`my-commit → unikit-commit`) and can be switched off. The base skill then stays in place and keeps updating with `unikit-ai update`. If a replacement is switched off or dropped later (`extension select`, a new version), the base skill is restored at once, not at the next `update`. The skip in the update pass above is for the replacements you left **on**.

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

Subagents are only installed for agents that support them (Claude Code and Kimi Code). They are placed in the agent's subagents directory (e.g., `.claude/agents/`). On Kimi Code, which does not read a `skills:` field in an agent file, the installer turns that field into a read list of `SKILL.md` paths at the top of the file - the same adapter runs over extension subagents (see [Subagents](subagents.md#skills-listed-in-an-agent-file)).

A subagent can be left out of the selection like a skill. If a subagent you kept preloads (`skills:`) a skill of the same extension that you left out, the command prints one `[WARN][extension]` line naming both. It is only a warning: nothing is blocked and the skill is not turned on for you.

A skill or a subagent of your extension that launches subagents settles their model and effort like the bundled ones: the rule is `.unikit/system/subagent-arguments.md`, the role of a launch your extension adds is placed by the nature of its work (the last section of `.unikit/system/subagent-roles.md`), and the project's `subagents.model.<agent>.<role>` and `subagents.effort.<agent>.<role>` keys apply. Do not copy the rule into your skill; point to the file.

---

### Injections

Injections put extension text into existing skill or subagent files. This lets extensions augment built-in workflows without replacing them entirely.

#### Two forms

| Form | Declared with | Where the text goes | Use it for |
|------|---------------|---------------------|------------|
| Position | `position: "append"` or `"prepend"` | The end of the target file, or right after its frontmatter | Whole sections added to a skill or a subagent |
| Extension point | `point` + `id` (+ `references`) | Under a named anchor the base skill carries | One short line, or a link to a reference file, at a fixed place of a skill's context loading |

An entry sets exactly one of `position` and `point`. A manifest that uses `point` is rejected by UniKit versions that predate extension points: the `position` field is required there.

#### Extension points

A base skill marks a place where extensions may add text with an anchor line:

```markdown
<!-- unikit:extension-point:bootstrap -->
```

An extension asks for that place by naming the point:

```json
{
  "id": "spec-line",
  "target": "unikit-plan",
  "targetType": "skill",
  "point": "bootstrap",
  "file": "./injections/spec-line.md",
  "references": ["./references/notes.md"]
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `id` | `[a-z0-9][a-z0-9-]*`, up to 64 characters | Required with `point`. Unique inside the extension; part of the block marker |
| `target` | A skill name from [Available extension points](#available-extension-points) | The skill whose anchor is used |
| `targetType` | `skill` | Subagent files carry no points yet |
| `point` | `[a-z][a-z0-9-]*`, not ending in `-agent` | The name of the point. Today every listed skill offers `bootstrap` |
| `file` | Relative path | The text to insert. Must stay inside the extension directory and exist at install time |
| `references` | Relative paths | Optional files delivered next to the target skill's own references (see [Reference files](#reference-files)). Same path rules as `file`; two files of one extension may not share a file name unless they are the same file |

#### Where the text goes

The anchor line stays in the skill. The block goes right under it:

```markdown
<!-- unikit:extension-point:bootstrap -->
<!-- unikit-ext:my-extension:unikit-plan:bootstrap:spec-line:start -->
Your text here.
<!-- unikit-ext:my-extension:unikit-plan:bootstrap:spec-line:end -->
```

Several blocks in one point are ordered by extension name, then by `id`. The result does not depend on the order the extensions were installed in or on how many times the commands ran.

#### What happens to your text

The text goes through the same steps as the text of the skill itself, in this order:

1. The agent filter: `<!-- unikit:agents … -->` blocks are kept or dropped for the agent.
2. `{{ext_reference:<file name>}}` becomes the path of the delivered reference file.
3. The variables from [Template Variables](#template-variables); `{{self_name}}` is the target skill.
4. The agent's own rewrite of invocations, where it has one - for example `/unikit-*` becomes `$unikit-*` for Codex.

A file may not contain `<!-- unikit-ext:` or an extension-point anchor. An empty file is skipped.

#### Reference files

A file listed in `references` is copied to `<skills dir>/<target>/references/ext/<slug>/<file name>`. The slug is the extension name with `@` replaced by `=` and `/` by `+`, so `@scope/pkg` gives `=scope+pkg`. In the text of the block and in the `.md` reference files themselves `{{ext_reference:<file name>}}` expands to that path, written from the project root. Files of other types are copied unchanged. `.md` files are read as UTF-8 text.

The `references/ext/` directory belongs to UniKit: it is recreated whole on every pass, and nothing in it survives by hand.

#### Skipped insertions

A skipped entry is not an installation error: the extension is installed, the command exits with `0`, and the report says what was not applied.

```
Injections: 1 of 2 applied, 1 reference file(s)
  my-extension › spec-line → unikit-plan (bootstrap): the installed skill has no such anchor — run "unikit-ai update" to refresh installed skills [claude]
```

| Reason | Meaning |
|--------|---------|
| `unknown-point` | This UniKit version offers no such point on the target - upgrade `unikit-ai`. Subagent entries with `point` also end here |
| `anchor-missing` | The installed skill has no such anchor - run `unikit-ai update` to refresh installed skills |
| `anchor-duplicated` | The installed skill carries the anchor more than once - run `unikit-ai update --force` |
| `target-not-installed` | The target is not installed for this agent |
| `source-missing` | A file the entry names is missing in the extension directory |
| `reference-unresolved` | The text uses `{{ext_reference:<name>}}` for a name that is not in `references` |
| `render-failed` | The text could not be rendered for this agent (a broken agent-filter marker, a reserved marker in the text) |
| `target-not-found` | The target file is not installed for this agent (position entries) |
| `target-disabled` | The target is a skill or subagent of this extension that was left out of its selection (position entries) |
| `path-outside-extension` | The path leaves the extension directory |

#### Injections and the selection

Injections are applied whatever the user selected. There is no `requires` field: an injection is self-sufficient, and the selection of skills, subagents and MCP servers does not switch injections on or off. So:

- text of an injection that names a skill, subagent or server the user left out is still inserted - write injected text so that it makes sense without the optional items of your extension;
- an injection into a **base** skill (or into a base skill whose replacement was switched off) is always applied;
- a `position` injection into a skill or subagent **of this extension** that the user left out is skipped with the reason `target-disabled` and no "target not found" warning.

#### Position injections

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

Injected content is wrapped in HTML comment markers for tracking:

```markdown
<!-- unikit-ext:my-extension:unikit-implement:append:start -->
Your injected content here.
<!-- unikit-ext:my-extension:unikit-implement:append:end -->
```

`append` puts the block at the end of the file. `prepend` puts it **right after the frontmatter**, so the file still starts with `---`; a block an earlier version put in front of the frontmatter is moved at the next `update`. A `file` path that leaves the extension directory is skipped when the injection is applied and shows up in the report as `path-outside-extension`.

These markers enable:
- **Idempotent application** - re-installing the same extension won't duplicate content
- **Clean removal** - `extension remove` strips exactly the injected blocks and returns the file to its previous bytes
- **Update survival** - `unikit-ai update` overwrites base skills, then re-applies all injections

#### Ownership of injected text

The text between the `unikit-ext` markers belongs to the extension and is rewritten on every pass. Edits made inside a block are not kept and are not reported as local modifications of the skill.

#### Example Injection File

```markdown
## Post-Implementation Checklist (from my-extension)

After completing each task:
1. Run the linter
2. Check for debug statements left in production code
3. Verify error messages are user-friendly
```

#### Available extension points

An anchor is a public contract: adding a point is a minor version of the package; moving or removing one happens only after a release that warns about it. More points - a second point in a skill, points in subagent files - are added on request of an extension, together with a check of the skill size limits and of the tests that read skill sections.

Every skill below offers one point, `bootstrap`, at the end of its context-loading block.

| Skill | Point | Placed | Not reached when |
|-------|-------|--------|------------------|
| `unikit` | `bootstrap` | Step 0 (Load Existing Config), before the config-actualization mode | - |
| `unikit-architecture` | `bootstrap` | Step 1 (Load Existing Context) | - |
| `unikit-archive` | `bootstrap` | Step 0 (Context) | - |
| `unikit-bridge-audit` | `bootstrap` | Bootstrap | There is no notes file for the bridge in `.unikit/bridge-notes/` |
| `unikit-bridge-docs` | `bootstrap` | Bootstrap | - |
| `unikit-bridge-trap` | `bootstrap` | Bootstrap | - |
| `unikit-commit` | `bootstrap` | Item 3 of the main list (Context Check), indented as part of the item | - |
| `unikit-devcontext` | `bootstrap` | Rules Loading, the last lines of the file | - |
| `unikit-docs` | `bootstrap` | Step 0 (Load Project Context) | - |
| `unikit-evolve` | `bootstrap` | Step 2 (Load Context) | - |
| `unikit-explore` | `bootstrap` | Step 0 (Bootstrap Context), after the optional reads | - |
| `unikit-fix` | `bootstrap` | Step 0.2 (Load Fix Context) | - |
| `unikit-implement` | `bootstrap` | Step 1.5 (Bootstrap Rules & Principles) | `--list`, `status` |
| `unikit-improve` | `bootstrap` | Step 0.5 (Bootstrap Context) | - |
| `unikit-memory` | `bootstrap` | Step 0.5 (Resolve the Active Module) | - |
| `unikit-plan` | `bootstrap` | Step 0.5 (Bootstrap Context) | `--list`, resuming an ultra plan, a merge plan |
| `unikit-pr` | `bootstrap` | Step 0 (Context) | - |
| `unikit-references` | `bootstrap` | Bootstrap | - |
| `unikit-review` | `bootstrap` | Step 1 (Load rules) | - |
| `unikit-roadmap` | `bootstrap` | Step 0 (Load Project Context) | - |
| `unikit-rules` | `bootstrap` | Step 0 (Load Skill Context) | - |
| `unikit-rules-registry` | `bootstrap` | Step 0.5 (Load the Module Registry) | - |
| `unikit-todo` | `bootstrap` | Step 0 (Load Skill Context) | - |
| `unikit-verify` | `bootstrap` | Step 0.3 (Load Engine Rules) | Before the plan is resolved (0.1) |
| `unikit-gd-apply` | `bootstrap` | Phase 0 - Bootstrap | - |
| `unikit-gd-balance` | `bootstrap` | Bootstrap Context | - |
| `unikit-gd-brainstorm` | `bootstrap` | Bootstrap | - |
| `unikit-gd-content` | `bootstrap` | Phase 0 - Bootstrap | - |
| `unikit-gd-docs` | `bootstrap` | Phase 0 - Bootstrap | - |
| `unikit-gd-experiment` | `bootstrap` | Bootstrap Context | - |
| `unikit-gd-explore` | `bootstrap` | Bootstrap Context | `init` mode |
| `unikit-gd-flow` | `bootstrap` | Phase 0 - Bootstrap | - |
| `unikit-gd-recon` | `bootstrap` | End of the cold-start gate | The gate stopped the run |
| `unikit-gd-review` | `bootstrap` | Phase 0 - Bootstrap | - |
| `unikit-gd-spec` | `bootstrap` | Bootstrap - Working Contract & Domain Knowledge | - |
| `unikit-gd-system` | `bootstrap` | Phase 0 - Bootstrap | - |
| `unikit-gd-verify` | `bootstrap` | Phase 0 - Bootstrap | - |

`unikit-skills-context` and `unikit-help` have no point: they have no context-loading block.

A line in a point is read by the model that runs the skill; whether it acts on the line is up to the model and is not guaranteed. The subagents `unikit-implement-worker` and `unikit-implement-coordinator` do not receive the line from `bootstrap` directly - only the content of the skills they preload reaches them.

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

The template file is the **server config itself** — the object that lands under your key in the agent's settings file. It is written through verbatim, so it holds exactly what your MCP client expects and nothing more: no `key` (that comes from the manifest entry), no wrapper `config` object, no metadata fields.

Validation is one rule: the template must carry a top-level `command` **or** `url`. A template that carries neither is rejected with a warning and that server is skipped — the rest of the install continues.

```json
{
  "command": "npx",
  "args": ["-y", "<your-mcp-package>"],
  "env": { "MY_SERVER_TOKEN": "..." }
}
```

Or for HTTP-based servers:

```json
{
  "type": "http",
  "url": "http://localhost:9090/mcp"
}
```

> The richer per-server schema used by the servers UniKit **ships** — `key`, `displayName`, `docs`, `rules`, `order`, `configByPlatform`, `allowed-tools` — is a different format, read from the package's own `mcp/` directory. It does not apply to extension templates. See [MCP JSON schema fields](configuration.md#mcp-json-schema-fields).

The template is written into each agent's settings file under `mcpServers.<key>` (the exact container and field names vary per agent — the writer handles that). All agents with MCP support receive the server entry:

| Agent | MCP Settings File |
|-------|------------------|
| Claude Code | `.mcp.json` |
| Codex CLI | `.codex/config.toml` |
| Cursor | `.cursor/mcp.json` |
| Qwen Code | `.qwen/settings.json` |
| OpenCode | `opencode.json` |
| Antigravity | `.agents/mcp_config.json` |
| Kimi Code | `.kimi-code/mcp.json` |
| Universal / Other | `.mcp.json` |

On `extension remove`, the key is deleted from the settings file.

A server you left out of the selection is not written to the settings files. Switching a server off later (`extension select`) removes only that key from each agent's settings file; the other entries of the file - yours, and those of other tools - are left as they are. The file is shared with you and with other tools (for Codex it is TOML); choose a `key` that is unlikely to collide with an entry of your own.

#### Tool permissions for an extension MCP server

**An extension MCP server does not grant tools to skills.** Installing the extension writes the server into the agent's settings file, and that is the whole of it — an `allowed-tools` block placed in a template is not read by anything. Grant declarations are a feature of the servers UniKit ships, not of extension templates.

What the extension installer does do, right after writing the server config, is **re-inject the grants of the packaged servers** into the skills and subagents those servers name as recipients. That step exists so a replacement skill delivered by your extension still receives the MCP tools it is entitled to; it never widens anything on your extension's behalf.

If a skill in your extension must call your server, add the qualified name — `mcp__<your-key>__<tool>`, or `mcp__<your-key>__*` for the whole server — to that skill's own `allowed-tools:` frontmatter, which your extension ships. Whether that entry survives an `update` depends on one thing:

- **A skill under its own name survives.** The re-injection pass opens only the skills and subagents that a packaged server actually names as a recipient. Your own skill is not one of them, so nothing ever rewrites its frontmatter.
- **A skill that *replaces* a packaged one may not.** If the skill you replace is a recipient of a packaged grant, the pass opens it — and it is a sync: every `mcp__`-prefixed entry the packaged servers do not currently grant is removed, yours included. Entries without that prefix (`Read`, `Bash`, `Agent`, …) are never touched.

So for a replacement skill, treat the frontmatter grant as non-durable and reach your server from a skill that carries its own name instead.

For how the packaged servers declare grants — wildcards for executors, a narrow list only where narrowing is the point — see [Tool grants](configuration.md#tool-grants-allowed-tools).

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
| `{{self_name}}` | `unikit-plan` | Name of the skill the file belongs to: in a skill's own `references/` files it is that skill; in an injection it is the target skill |
| `{{engine_name}}` | `Unity` | Game engine name |
| `{{engine_code_language}}` | `C#` | Engine's programming language |
| `{{engine_bridge_mcp_code}}` | `unity-biome-mcp` | Vendor code of the first engine bridge of kind mcp in the package order among the selected ones — the key it is registered under in the settings file, and the middle segment of its `mcp__<code>__*` grants. The default `EngineMCP` stands when none is selected. Not the bridge's file id. |
| `{{agent_id}}` | `claude` | Agent id |
| `{{agent_reader_type}}` | `Explore` | Read-only subagent type of the agent; empty when the agent has none (Codex) |
| `{{agent_worker_type}}` | `general-purpose` | Subagent type that can write files; empty when the agent has none (Codex) |
| `{{agent_model_default}}` | `sonnet` | Built-in default model argument; `inherit` (no model argument) when the agent has none |
| `{{agent_call_reader}}` | `subagent_type: Explore,` | Leading arguments of an `Agent(...)` call for a read-only subagent: the type and the agent's extra arguments (Codex: `fork_turns` and `task_name`, no type) |
| `{{agent_call_worker}}` | `subagent_type: general-purpose,` | The same for a subagent that can write files |
| `{{agent_call_worker_quoted}}` | `subagent_type: "general-purpose",` | The same, with the type in quotes (the spelling of multi-line call blocks) |
| `{{agent_skill_call:<skill>}}` | `Call the Skill tool with skill "<skill>" and …` | At the start of a `prompt: "…"` line: makes the subagent load the skill; the text after it up to the closing quote is the skill's arguments. Claude Code: a Skill-tool call; every other agent: a read of `<skills dir>/<skill>/SKILL.md` |

The `{{agent_*}}` variables are substituted in skills only (`SKILL.md` and `references/`); in subagent files and system assets they are empty, and `{{agent_skill_call:…}}` stays as written (a guard keeps it out of those files). They come from the agent profile - see [Subagents](subagents.md#subagent-profile-per-agent). The system-file variables further down are the opposite: they depend on neither the agent nor the engine, so they are substituted everywhere the template runs - in skills and their `references/`, in the text of extensions (injection blocks, reference files, and the skills and subagents an extension adds), in subagent files and in `dev-principles.md`. The other system files (the flat contracts, the `gamedesign/` files and the `engine-mcp/` tree) are copied without any substitution.

The same variables are available in the text of an injection and in the `.md` reference files of an extension point; `{{self_name}}` is the name of the target skill, and `{{agent_skill_call:<skill>}}` in the text of an injection expands as it does in a skill.

**System files.** Every file the framework puts under `.unikit/system/` has a variable that holds its path from the project root, so an extension names the file without writing the path out. The value is the same for every agent and for subagent files:

| Variable | Value | Present |
|----------|-------|---------|
| `{{system_dir}}` | `.unikit/system` | always |
| `{{system_gamedesign_dir}}` | `.unikit/system/gamedesign` | always |
| `{{system_genres_dir}}` | `.unikit/system/gamedesign/genres` | selective: appears with `unikit-ai genres install` and holds only the genre profiles the project installed |
| `{{system_engine_bridges_dir}}` | `.unikit/system/engine-bridges` | when at least one engine bridge is selected |
| `{{cli_contract}}` | `.unikit/system/cli-contract.md` | always |
| `{{dev_principles}}` | `.unikit/system/dev-principles.md` | always |
| `{{modules_yml}}` | `.unikit/system/modules.yml` | always |
| `{{gate_result_contract}}` | `.unikit/system/gate-result-contract.md` | always |
| `{{ultra_plan_read_contract}}` | `.unikit/system/ultra-plan-read.md` | always |
| `{{research_link_contract}}` | `.unikit/system/research-link.md` | always |
| `{{plan_boundaries_contract}}` | `.unikit/system/plan-boundaries.md` | always |
| `{{merge_analysis_contract}}` | `.unikit/system/merge-analysis.md` | always |
| `{{balance_handback_contract}}` | `.unikit/system/balance-handback.md` | always |
| `{{prototype_profile_contract}}` | `.unikit/system/prototype-profile.md` | always |
| `{{subagent_arguments_contract}}` | `.unikit/system/subagent-arguments.md` | always |
| `{{subagent_roles_contract}}` | `.unikit/system/subagent-roles.md` | always |
| `{{user_questions_contract}}` | `.unikit/system/user-questions.md` | always |
| `{{gd_principles}}` | `.unikit/system/gamedesign/gd-principles.md` | always |
| `{{gd_authoring}}` | `.unikit/system/gamedesign/gd-authoring.md` | always |
| `{{gd_lifecycle}}` | `.unikit/system/gamedesign/gd-lifecycle.md` | always |
| `{{gd_flow_axis}}` | `.unikit/system/gamedesign/gd-flow-axis.md` | always |
| `{{gd_content_axis}}` | `.unikit/system/gamedesign/gd-content-axis.md` | always |
| `{{gd_provenance}}` | `.unikit/system/gamedesign/gd-provenance.md` | always |
| `{{gd_critique}}` | `.unikit/system/gamedesign/gd-critique.md` | always |
| `{{design_read_contract}}` | `.unikit/system/gamedesign/design-read.md` | always |
| `{{engine_bridges_manifest}}` | `.unikit/system/engine-bridges/BRIDGES.md` | when at least one engine bridge is selected |
| `{{language_rules}}` | `.unikit/system/LANGUAGE_RULES.md` | after the `/unikit` skill has written it |

The names of these variables are public API of extensions, on a par with the extension-point anchors in the base skills: when the framework moves a file the value follows it and the name stays. A name is renamed or removed only after a release that warns about it. The one exception is 3.0.0, which replaced the names of the single-engine-server era at once: `system_engine_mcp_dir` is now `system_engine_bridges_dir`; `engine_mcp_rules_index` is now `engine_bridges_manifest` (the entry file — the rules files of one bridge are `{{system_engine_bridges_dir}}/<bridge id>/INDEX.md` and `…/verification.md`); `engine_mcp_rules_verification` has no successor; `engine_mcp_tool` is replaced by `engine_bridge_mcp_code` in the same release (see the table above). The old names are not substituted any more: a token that still carries one stays in the text as written.

A variable whose file is not always there (`{{system_genres_dir}}`, `{{system_engine_bridges_dir}}`, `{{engine_bridges_manifest}}`, `{{language_rules}}`) still resolves to its path, but the file may be missing; write the extension text so that it also works when the file is not there. A `{{…}}` token that the installed build of unikit-ai does not know stays in the text exactly as written and does not stop the install.

Such a token is not reported by default. A slot of your own that is meant for the runtime - a lower-case `{{…}}` in a template that your skill fills in - has exactly the form of a variable that a newer build might add, so the installer cannot tell the two apart, and an extension full of templates would repeat the same lines on every `update`. To see which tokens a build leaves as written, run `unikit-ai --verbose init`, `unikit-ai --verbose update` or `unikit-ai --verbose extension add|update|remove|select` (the extension commands re-apply the text; `update` only when it updated something): every file of the extension that holds such a token is listed at INFO level with the names, nothing of the content. Name the unikit-ai version your extension needs in its README.

```markdown
Before you ask the user anything, read `{{user_questions_contract}}`.
```

Use the variables in SKILL.md files to write agent-agnostic skills:

```markdown
Read the project rules from `{{skills_dir}}/unikit/SKILL.md`.
```

**Referencing files of a skill.** Name a file by its full path, built from the variables above. A phrase such as "the references folder of the skill", or a bare `references/<file>.md` as the only mention, does not say where the file is installed.

| You are pointing at | Write |
|---|---|
| a file of the same skill (`references/`, `scripts/`, `templates/`, `assets/`) | `{{skills_dir}}/{{self_name}}/references/<file>.md` |
| a file of another skill | `{{skills_dir}}/<skill>/references/<file>.md`, with the skill name written out |
| a reference file delivered by an extension point | `{{ext_reference:<file name>}}` |
| anything from a subagent file or a system asset | no `{{skills_dir}}`: it is empty there |

In a skill's `references/` files `{{self_name}}` is the skill that owns the directory, not the name of the file. A skill that an extension adds is installed the same way, so the same form points at its own files, with the skill's own name as `{{self_name}}`.

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
│   │   └── <skill>/references/ext/<slug>/   # Reference files delivered by extensions (owned by UniKit, recreated on every update)
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
      },
      "selection": {
        "skills": { "skills/my-skill": true, "skills/my-commit": false },
        "subagents": { "subagents/my-agent.md": true },
        "mcpServers": { "my-server": true }
      }
    }
  ]
}
```

The `replacedSkills` field maps base skill names to extension skill paths, enabling automatic restoration of base skills when the extension is removed. It lists only the replacements that are switched on.

The `selection` field holds your choices: the key is the path from the manifest (skills and subagents) or the `key` of an MCP server; the value says whether the item is on. An item that is missing from the maps is *undecided*: it has not been installed and is offered the next time (see [New items of an installed extension](#new-items-of-an-installed-extension)). A record without `selection` was written before item selection existed; everything installed counts as on. You do not edit the field by hand - use `unikit-ai extension select`.

An older CLI does not know the field: the next time it re-commits the extension (a version bump, `--force`) it rewrites the record without `selection`, and an `update` then installs everything again. Do not use different CLI versions in one project.

---

## Backup and Rollback

When an extension that is already installed is upgraded, a backup is created at `.unikit/extensions/<name>.backup`. If any error occurs during the upgrade:

1. The corrupted extension directory is deleted
2. The backup is restored
3. The original error is thrown

The backup and rollback apply to upgrades only and cover only `.unikit/extensions/<name>/`: a failed first-time install leaves no backup to restore, and assets already written into an agent's directories are not rolled back.

---

## Security Considerations

- **Extension names are validated** - the name must start with an alphanumeric, `_` or `@` and contain only word characters, dots, `@`, `/` and `-`, and may not contain `..` at all, so a name can never begin with `.` or `-` and cannot express a `../` traversal segment
- **Git clones use shallow depth** - `git clone --depth 1` for minimal download
- **Manifest validation** - all manifest fields are strictly validated before installation
- **Replacement conflicts** - no two extensions can replace the same base skill
- **Command modules execute code** - command modules are dynamically imported at CLI startup. Only install extensions you trust, just as you would with npm packages
- **Command module validation** - module files referenced in `commands` are verified to exist at install time
- **Injection and reference paths are validated** - for entries with `point`, `file` and `references` may not leave the extension directory (`..`, absolute paths) and must exist at install time; for `position` entries a path that leaves the extension directory is skipped when the injection is applied

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
    },
    {
      "id": "checks-line",
      "target": "unikit-plan",
      "targetType": "skill",
      "point": "bootstrap",
      "file": "./injections/plan-line.md",
      "references": ["./references/checks.md"]
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
│   ├── agent-preamble.md
│   └── plan-line.md
├── references/
│   └── checks.md
└── mcp/
    └── web-server.json
```

**Installation result:**
- 1 new skill installed (`web-analyzer`)
- 1 base skill replaced (`unikit-review` with extension's `code-reviewer`)
- 1 subagent installed (`web-expert`) - for agents that support subagents
- Content appended to `unikit-implement` skill
- Content prepended to `unikit-implement-coordinator` subagent, right after its frontmatter
- A block inserted under the `bootstrap` anchor of `unikit-plan`, and `references/checks.md` copied to `<skills dir>/unikit-plan/references/ext/unikit-ext-complete/checks.md`
- `web-mcp` server configured in `.mcp.json`
- `complete-setup` CLI command registered (available as `unikit-ai complete-setup`)

## See Also

- [Configuration](configuration.md) - `.unikit.json` format, MCP servers, project structure
- [Skills Reference](skills.md) - all built-in skills that extensions can augment or replace
- [Getting Started](getting-started.md) - installation and first project setup
