[← Memory & Skill Evolution](evolve.md) · [Back to README](../README.md) · [Rules Registry →](rules-registry.md)

# Configuration

## `.unikit.json`

Main configuration file, created by `unikit-ai init`:

```json
{
  "version": "1.0.0",
  "engine": "unity",
  "engineMcpKey": "UnityMCP",
  "mcp": { "servers": { "unity-biome-mcp": "UnityMCP", "context7": "context7" } },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": [
        "unikit", "unikit-architecture", "unikit-commit", "unikit-devcontext",
        "unikit-docs", "unikit-evolve", "unikit-explore", "unikit-fix", "unikit-help",
        "unikit-implement", "unikit-improve", "unikit-memory", "unikit-plan",
        "unikit-review", "unikit-roadmap", "unikit-rules", "unikit-rules-registry",
        "unikit-skills-context", "unikit-todo", "unikit-verify"
      ],
      "installedSubagents": [
        "unikit-architecture-sidecar", "unikit-commit-sidecar",
        "unikit-docs-sidecar", "unikit-review-sidecar",
        "unikit-implement-coordinator", "unikit-implement-worker",
        "unikit-plan-coordinator", "unikit-plan-polisher"
      ],
      "managedSkills": {
        "unikit": { "sourceHash": "abc123", "installedHash": "abc123" }
      },
      "managedSubagents": {
        "unikit-architecture-sidecar": { "sourceHash": "def456", "installedHash": "def456" }
      }
    }
  ],
  "rulesRegistry": "https://raw.githubusercontent.com/NintendaDev/unikit-ai-rules/main",
  "rules": {
    "installed": {
      "version": "1.0.0",
      "core": [
        { "name": "code-style",        "source": "registry", "origin": "official", "version": "1.2.0", "installed_hash": "sha256:..." },
        { "name": "design-principles", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "folders-structure", "source": "registry", "origin": "official", "version": "1.1.0", "installed_hash": "sha256:..." },
        { "name": "performance",       "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "testing",           "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." }
      ],
      "stack": [
        { "name": "aspid-mvvm", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "node-canvas", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "odin",        "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "r3",          "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." },
        { "name": "unitask",     "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "sha256:..." }
      ]
    }
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `version` | Package version at time of install |
| `engine` | Game engine identifier (`unity`, `godot`, `godot-net`, `unreal-engine-5`) |
| `engineMcpKey` | Vendor code of the selected engine MCP server, or `null`. **Derived** — recomputed from `mcp.servers` on every write, never an independent input. |
| `rulesRegistry` | Rules registry URL or local path. Defaults to the official `NintendaDev/unikit-ai-rules` URL. See [Rules Registry](rules-registry.md) for details. |
| `mcp.servers` | Globally selected MCP servers as `key → code`. The **key** is the server's file id — the name of its JSON file under `mcp/`, an internal identity that is never written anywhere else. The **value** is the vendor code UniKit registered that server under in the agent's settings file (`mcpServers.<code>`), stored per project because it is the only record of what was actually written. Configs written before 1.2.0 carry a bare `string[]` of file ids here and are converted on the next `unikit-ai init` / `unikit-ai update`. |
| `agents` | Array of installed agent configurations |
| `agents[].id` | Agent identifier (`claude`) |
| `agents[].skillsDir` | Where skills are installed |
| `agents[].subagentsDir` | Where subagent .md files are installed |
| `agents[].installedSkills` | List of installed skill names |
| `agents[].installedSubagents` | List of installed subagent names |
| `agents[].managedSkills` | SHA-256 hash-based change tracking for skill updates |
| `agents[].managedSubagents` | SHA-256 hash-based change tracking for subagent updates |
| `extensions` | Array of installed extension records (optional) |
| `rules.installed` | Currently installed dynamic memory (core + stack). Each entry is an object `{ name, source, origin?, version?, installed_hash? }`. See [Rules Registry](rules-registry.md#unikitjson-registry-fields) for field descriptions. Legacy `string[]` entries are normalized to `{ name, source: "installer" }` on load. |

## `.unikit/config.yaml`

User-editable configuration bootstrapped by `/unikit`. All sections are optional - defaults are used when not specified. Skills read this file at the start of every command (canonical Step 0) to determine language, workflow, and git behavior.

The full schema with comments lives in `skills/unikit/references/config-template.yaml`.

```yaml
language:
  ui: en
  artifacts: en
  rules: en
  technical_terms: keep

workflow:
  research_relevance_days: 7

git:
  enabled: true
  base_branch: main
  create_branches: true
  branch_prefix: feature/
  skip_push_after_commit: false
```

### `language` section

| Key | Description | Default |
|-----|-------------|---------|
| `ui` | Language for AI-agent communication (prompts, questions, explanations). Options: `en`, `ru`, `de`, `fr`, `es`, `zh`, `ja`, `ko`, `pt`, `it` | `en` |
| `artifacts` | Language for generated artifacts (plans, specs, documentation). Same options as `ui`. | same as `ui` |
| `rules` | Language for knowledge base rule files: everything under `.unikit/memory/` (`core/`, `stack/`, `references/`, `RULES_INDEX.md`), `.unikit/RULES.md`, and skill-context rules. Intentionally decoupled from `ui` and `artifacts` - rule files are consumed by AI agents for prompt matching; keeping them in a stable language reduces semantic drift across agents and teams. Changing `ui` or `artifacts` does NOT change the language of existing rule files. **Strongly not recommended to change from `en`** - non-English rule files cause semantic drift and inconsistent agent behavior. Default is always `en`; can only be changed by manually editing this file (skills never write to this key). | `en` |
| `technical_terms` | How to handle technical terms in translations. `keep` - preserve English terms (API, prefab, shader, ECS). `translate` - translate where a common translation exists. **Strongly not recommended to change from `keep`** - translating technical terms degrades agent accuracy. Default is always `keep`; can only be changed by manually editing this file (skills never write to this key). | `keep` |

### `workflow` section

| Key | Description | Default |
|-----|-------------|---------|
| `research_relevance_days` | Maximum age (in days) for research notes to be considered fresh by `/unikit-plan`. Older research is flagged as stale and a refresh is suggested. | `30` |

### `git` section

| Key | Description | Default |
|-----|-------------|---------|
| `enabled` | Whether this project uses git-aware workflows. If `false`, `/unikit-plan full` does not create branches, and `/unikit-review`/`/unikit-verify` do not assume a base branch exists. | auto-detected from `.git` presence |
| `base_branch` | Default branch for diff/review/merge targets (e.g. `main`, `master`, `develop`). | auto-detected, fallback `main` |
| `create_branches` | Automatically create feature branches for plans. Applies only when `git.enabled = true`. | `true` |
| `branch_prefix` | Branch name prefix for new features. Applies only when `create_branches = true`. | `feature/` |
| `skip_push_after_commit` | If `true`, `/unikit-commit` ends after a successful local commit with no push prompt. | `false` |

## MCP Configuration

UniKit AI writes MCP server configuration into the file selected per agent: `.mcp.json` (Claude Code), `.codex/config.toml` (Codex CLI), `.cursor/mcp.json` (Cursor), `.qwen/settings.json` (Qwen Code), `opencode.json` (OpenCode), or `.agents/mcp_config.json` (Antigravity).

Every server carries two names, and keeping them apart is what the rest of this section rests on:

- **`key`** — the server's internal identity, always equal to the name of its JSON file under `mcp/`. It is what `.unikit.json` records your selection under, what the delivery stamp and the findings log are named after, and it is never written into an agent's settings file.
- **`code`** — the **vendor code**: the key the server is actually registered under in your settings file (`mcpServers.<code>`), the middle segment of every `mcp__<code>__*` grant, and the value `{{engine_mcp_tool}}` expands to in skill prose.

Before 1.2.0 there was only `key`, and the engine alternatives of one engine were made to share it — which meant UniKit registered Unity Biome under the name `UnityMCP` while the server itself registers as `unity-biome-mcp`. The two entries coexisted in `.mcp.json`, and the grants followed the one nobody was talking to.

**Engine servers of one engine are alternative implementations** — the wizard offers them as a radio group and you pick exactly one. The group is now the engine's own catalog directory (`mcp/unity/`, `mcp/godot/`, …), not a shared key; `godot` and `godot-net` share `mcp/godot/`, so they share the group. Everything else is additive and is offered as a checkbox.

| Server | `key` (file id) | `code` (settings key, grant prefix) |
|--------|-----------------|-------------------------------------|
| Unity Biome MCP | `unity-biome-mcp` | `unity-biome-mcp` |
| Coplay Unity MCP | `coplay-unity-mcp` | `UnityMCP` |
| Fennara Godot AI | `fennara-godot-mcp` | `fennara` |
| GDAI Godot MCP | `gdai-godot-mcp` | `godot-mcp` |
| Coding-Solo Godot MCP | `coding-solo-godot-mcp` | `godot` |
| ChiR24 Unreal MCP | `chir24-unreal-mcp` | `unreal-engine` |
| Context7 | `context7` | `context7` |

Each code is the one its vendor uses, so an entry UniKit writes and an entry the vendor's own editor plugin writes are the same entry rather than two.

### Unity

Two engine servers compete here. The wizard lists them in `order`, so **Unity Biome** is the default offer on a fresh install.

#### Unity Biome MCP (`order: 1`)

```json
{
  "command": "uvx",
  "args": ["--from", "git+https://github.com/german-krasnikov/unity-biome-mcp.git#subdirectory=server", "unity-biome-mcp"],
  "env": { "UNITY_MCP_NO_GATING": "1" }
}
```

Backed by [unity-biome-mcp](https://github.com/german-krasnikov/unity-biome-mcp). Requires **Unity 6 (6000.0+)** and [`uv`](https://docs.astral.sh/uv/). Install the Unity package from the git URL `https://github.com/german-krasnikov/unity-biome-mcp.git?path=unity-plugin`, then run `MCP > Setup Wizard` in Unity. The Editor must be running — the server finds its port through `~/.unity-biome-mcp/ports/*.port`, so no env vars are needed.

It is the deepest of the engine integrations: transactional scene edits, a real console watermark, and authoring across uGUI, UI Toolkit, animation and shaders. What it can do at *your* version is answered by its live catalog, not by a list in this file — which is why you will not find one here.

It is the first server to ship a **rules tree**: see [Engine-MCP rules tree](#engine-mcp-rules-tree) below for what that is, and what it deliberately does not contain.

**Why UniKit AI sets `env: { "UNITY_MCP_NO_GATING": "1" }`.** Without the flag the catalog arrives gated — the client sees a fraction of it and is expected to unlock the rest per category. At the measurement dated in `verified` that unlock was found **not to reach the client**, which leaves affordances declared and unreachable at once: the worst possible shape, because the failure is silent. The flag turns the whole set on at connect time. It costs roughly 8-10k tokens of context and buys one honest rule — *a tool that is not in your list does not exist here; it is not hidden*. The flag is written identically for every agent (it is all-or-nothing, not per-agent). The vendor does not document the variable, so this is the only place our reason for setting it is written down.

#### Coplay Unity MCP (`order: 2`)

```json
{
  "type": "http",
  "url": "http://127.0.0.1:8080/mcp"
}
```

Backed by the [MCP for Unity](https://github.com/CoplayDev/unity-mcp) package (Coplay). Requires **Unity 2021.3 LTS → 6.x**, the package installed in your Unity project, and the Unity Editor running. Its catalog arrives grouped, with only part of it active up front, so an agent asks it what is reachable rather than assuming. Broadly it covers console reading, domain reload / asset refresh, EditMode and PlayMode test runs, and Editor authoring across scenes, components, prefabs, assets, UI documents, materials, animation and project settings.

It ships no rules tree yet. That means UniKit AI knows of no exceptions for it — not that it can do less, and never a reason to skip an editor task. See [Engine-MCP rules tree](#engine-mcp-rules-tree).

Two caveats worth knowing before you rely on it:

- **The HTTP server does not start on its own.** Start it manually via `Window > MCP for Unity > Start Server`. Until it is running, every tool call fails to connect.
- **The Unity package manages MCP client configs itself.** On editor load it rewrites (and can remove) MCP entries written by other tools, including the ones UniKit AI installs. Disable that behavior with the EditorPref `MCPForUnity.AutoRegisterEnabled=false` if you want UniKit AI to stay the owner of your agent config.

### Godot

Three engine servers compete here (`godot` and `godot-net` share the same catalog directory, so they are offered the same three); **Fennara** is the default offer on a fresh install.

#### Fennara Godot AI (`order: 1`, free)

```json
{
  "configByPlatform": {
    "win32":  { "command": "{{localappdata}}\\Fennara\\bin\\fennara-mcp.exe", "args": [], "env": {} },
    "darwin": { "command": "{{home}}/Library/Application Support/Fennara/bin/fennara-mcp", "args": [], "env": {} },
    "linux":  { "command": "{{home}}/.local/share/fennara/bin/fennara-mcp", "args": [], "env": {} }
  }
}
```

Backed by [fennara-godot-ai](https://github.com/fennaraOfficial/fennara-godot-ai). Requires **Godot 4.5+**, x86_64 on Windows/Linux or arm64 on macOS; on Windows also the MSVC Redistributable 2015-2022 x64. Before the first run: install the CLI, run `fennara install` inside the Godot project, then enable the addon.

- **The editor must be open** — there is no headless mode.
- One daemon serves the account (port 41287). With two projects open, the target is chosen in the Fennara dock, not by the MCP call.
- Telemetry is enabled by default.

All 14 tools are visible immediately (no bootstrap). Its shape is a code executor rather than an operation catalog: one `run_scene_edit_script` covers scene, UI, VFX and animation work. It is the only Godot server with real run feedback (full stdout+stderr behind a cursor) and version-accurate API docs via `get_class_info`.

This is the only config using [`configByPlatform`](#per-platform-configs) — its binary is an absolute path that differs on each OS.

#### GDAI Godot MCP (`order: 2`, paid) · Coding-Solo Godot MCP (`order: 3`, free)

**GDAI requires Godot 4.1+.** Coding-Solo declares no version threshold at all — its prerequisites say only "Godot Engine installed" — which is why it is the one entry in the Godot radio with no version in brackets. An undeclared threshold, not a forgotten one: a bracketed "Godot 4.x" there would be our inference rather than the vendor claim.

Both are stdio servers and both work. Neither ships a rules tree yet: UniKit AI knows of no exceptions for either, which is not the same as knowing they can do less — and the generic development principles apply to them exactly as they do to every other server.

What an agent may attempt against them is decided by what their live catalog offers. `⏸️ MANUAL` is reached by trying and finding no route, with the evidence of that absence to show — never by the absence of a rules tree. See [Editor tasks](plan-files.md#editor-tasks).

### Engine-MCP rules tree

When you select an engine MCP, UniKit AI copies that server's **rules tree** into `.unikit/system/engine-mcp/`. A rules tree records **exceptions, not capabilities** — the places where this particular server behaves differently from what an honest reading of its own catalog would suggest.

| File | Read by |
|------|---------|
| `INDEX.md`, base section (everything except the `## Check` table) | `/unikit-plan`, `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-devcontext`, `unikit-implement-worker` — once, at Bootstrap |
| `INDEX.md`, the `## Check` table | `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `unikit-implement-worker` — grepped per editor task, by the task's own area plus the cross-cutting ones |
| `verification.md` | `/unikit-verify` and no other skill — per-gate calibration: which observation closes which gate |

Three invariants hold over everything in the tree, and they are what makes it safe to ship at all:

- **Monotonic.** A rules file only ever *adds* an obligation. It never pre-lifts a gate, never says "use Y instead of X", and never hands out a permission.
- **Nameless.** No tool name appears anywhere in the tree. Names rot faster than anything else about an MCP server, and the live catalog is the only place they are true — so a rule is keyed by **area** (`ui`, `console`, `rollback`, `batch`, `compile`, `transport`, `visual`, …) instead.
- **No rules is not no rights.** A missing tree, a missing file, or an area with no matching line changes nothing about what an agent may attempt. `⏸️ MANUAL` is reached by trying and finding no route — never by an absence in this folder.

The genre of every entry is a **check to perform**, not a claim about the server's state: "confirm the content is able to exceed the viewport" stays true whether the bug is present or already fixed, while "the scroll container is broken" starts lying the moment it is fixed — and lies silently.

Mechanics worth knowing:

- The tree comes from the [`rules`](#mcp-json-schema-fields) pointer of the MCP JSON you selected, so it changes when your MCP choice changes. A server without the pointer contributes nothing, and skills read a missing file as a silent skip.
- It is **copied, not merged**. One engine takes one engine server, so there is nothing to concatenate and no per-contributor heading; subdirectories are copied as they are, so the tree may grow past its two starting files.
- Every delivered `.md` gets a **provenance stamp** prepended — `server:`, plus a line saying to fix the source rather than the copy. That stamp is your project's only record of *whose* exceptions are on disk, and it is what the header of `.unikit/MCP-RECHECK-NOTES.md` is compared against at Bootstrap. It is the server id and nothing else, which is worth more than it sounds: a delivered file is byte-identical between runs for as long as the tree and the server are unchanged, so an unexpected diff in `.unikit/system/engine-mcp/` is a signal rather than the daily noise a delivery date used to produce.
- Like `cli-contract.md` and `dev-principles.md`, the tree is a **system asset — not hash-tracked**. Every `init` / `update` rewrites it from source, so local edits are lost. Findings of your own go in `.unikit/MCP-RECHECK-NOTES.md` (below); durable project knowledge goes in `.unikit/memory/`.
- Orphans are deleted across the **whole subtree**, not just `*.md`. Switching engines (or deselecting a server) clears the stale tree rather than leaving a Unity tree in a Godot project.

### Project findings — `.unikit/MCP-RECHECK-NOTES.md`

The rules tree is what UniKit AI shipped. This file is what *your* project found out, against the server it actually runs.

- It sits at the root of `.unikit/`, deliberately **outside** `.unikit/system/` — so the installer's flat-rewrite and orphan sweep cannot reach it by construction.
- **The installer never writes its content.** The only operation it performs is a rename: switching engine MCP servers parks the active file as `MCP-RECHECK-NOTES.archive.<previous-server>.md`, and switching back restores it. A finding is a statement about *one* server, so carrying it across a switch would be worse than losing it — it would look like evidence.
- Invariant: **one file per server — active or archived, never both.** An interrupted run can leave a second archive behind; it is kept rather than overwritten and announced with a `WARN`, because merging two sessions' findings is a curation call and not the installer's to make.
- `/unikit-mcp-trap` writes it, `/unikit-mcp-audit` curates it (re-stamp, replay, retire, upstream). Pipeline skills **read** it and never write it: one observation is a bad sample, and a bad line lives for months, so the durable surface passes through a human.
- It obeys the same three invariants as the rules tree, with **one carve-out**: the `evidence:` field of an entry is the single place in the whole system where a tool name may be written down. That is what makes an entry evidence rather than an opinion — and it is why `/unikit-mcp-audit` treats every entry as suspect once the server moves.

### MCP JSON schema fields

Every MCP JSON declares `key` / `code` / `displayName` and one of `config` / `configByPlatform`. `key` must equal the file's own basename and `code` must be non-empty — an entry missing either is dropped at scan time, so the server is simply never offered. Beyond those, an MCP JSON may declare five optional fields. All five are backward compatible — a config without them behaves exactly as before.

| Field | Purpose |
|-------|---------|
| `docs` | `{ context7, repo }` — where the server documents *itself*. `repo` generates the single install line printed in the `init` summary (`<displayName> — setup and requirements: <url>`) and is **required** when `is_engine: true`. `context7` is the library id the rules tree names as the server's reference. |
| `rules` | Directory holding this server's rules tree, resolved relative to the JSON's own directory (`"rules/<server>/"`). Delivered to `.unikit/system/engine-mcp/` — see [Engine-MCP rules tree](#engine-mcp-rules-tree). Absent is a normal state, not a degraded one. |
| `order` | Presentation order within one engine group — the `is_engine` servers of a single `mcp/<engine>/` directory (ascending, 1-based; missing sorts last). Drives the wizard's radio pre-selection and nothing else — it does **not** affect the order servers are written into a settings file. |
| `verified` | `{ date, toolRegistry }` — when this server's **rules tree was last measured**, and the registry file the measurement read. A maintainer's working note: it is **not delivered into your project**, not stamped into the rules tree, and not printed in the `init` summary. |
| `configByPlatform` | Per-OS config variants keyed by `win32` / `darwin` / `linux`, for servers whose binary path differs per platform. |

`config` (and each `configByPlatform` variant) may carry an `env` block, handed to the server process verbatim; the path tokens below expand inside its values too. UniKit AI uses it for exactly one thing today — see [`UNITY_MCP_NO_GATING`](#unity-biome-mcp-order-1) above.

`config` may also carry **`_comment` as its last field**: a one-line hint addressed to whoever opens their own settings file. Every writer carries it through verbatim — Codex because it copies fields it does not recognise, OpenCode through a passthrough naming the key explicitly, since that writer assembles its output from a whitelist and would otherwise drop it. Nothing reads the value: no consumer changes behaviour depending on whether it is present, absent, or says something else entirely. The key is pinned to the `MCP_COMMENT_KEY` constant by a guard in `scripts/test-skills.sh` Part 5b, so the data and the writer cannot drift apart. [Context7](#context7) is the one server using it today.

**`docs` replaced a hand-written `instruction` field, and the removal is deliberate.** That field restated the vendor's own documentation, which is how it came to carry a measured-false claim about how much of the catalog was reachable. A URL rots more slowly than prose, and when it finally dies it answers 404 loudly instead of walking you through outdated steps in silence. The install facts themselves — engine version, prerequisites, plugin setup — belong to the vendor and are deliberately not mirrored here. A server that needs no setup at all simply omits `docs.repo` and contributes no line.

**`verified` is a maintainer's note, and it lost its version on purpose.** It used to mean "the tool names in `allowed-tools` were audited against version X"; with wildcard grants there is no name list left to audit, so it was re-anchored onto the rules tree. The version half is now gone as well, and the reason is worth stating so nobody adds it back: comparing versions was structurally dead. `verified.version` was copied into the delivery stamp, the stamp was copied into the `MCP-RECHECK-NOTES.md` header, and the skills then compared header against stamp — so **both sides of that comparison came from the same package constant**. The mismatch it was supposed to catch could only ever be announced by a UniKit release, never by the server on your machine moving. A comparison that cannot fire for its own reason is worse than no comparison, because it reads like a guard.

Nor could the version be recovered elsewhere. The MCP protocol carries it in `InitializeResult.serverInfo`, which reaches the client during the handshake with no method to ask for it again, and measurement across the catalog found no tool that reports it — on biome, `mcp_status`, `get_capabilities` and `doctor` return the scene, the *Unity* version and the *Python* version respectively.

What survives is the half that was always the useful one: `date` says how old the measurement is, `toolRegistry` says where to redo it. Do not attach a staleness warning to either — these servers ship one to three releases a day, so the warning would fire constantly and become noise.

#### Tool grants (`allowed-tools`)

An MCP JSON may name the skills and subagents that receive its tools; the names are injected into the installed frontmatter as `mcp__<code>__<tool>` (or `mcp__<code>__*`) — the **vendor code**, which is what the running server publishes its tools under. Injection is keyed on your **selection**, so changing which MCP you use reinstalls all skills and subagents and clears the old entries; a server whose code changes while your selection stays put has its dead names removed too.

- **Executors get a wildcard.** `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-devcontext` and the implement coordinator / worker / review sidecar are granted `["*"]` rather than a list of names. A stored list is a second catalog that nothing keeps in sync: it goes stale silently, and then it removes a right the agent was supposed to have. The wildcard also removes the last reason for a tool name to be written down anywhere but the live catalog.
- **The planner is the one exception**, and receives two discovery names only. The discovery protocol is the single layer that does not rot, and a planner physically cannot mutate anything — so a narrow grant costs nothing and documents the boundary.
- `/unikit-mcp-audit` gets a wildcard because replaying a finding means re-issuing the exact call recorded in its `evidence:` field. Its restraint lives in a six-step envelope gated on one informed confirmation from you, not in the size of its grant.
- **`/unikit-mcp-trap` receives no grants at all** — it makes zero MCP calls by construction. This cannot be recorded in the JSON itself: the format has no comments, and an empty array would create a recipient with no tools, which the test suite rejects. So it is written down here.
- The wildcard on the read-only review sidecar is a **deliberate deferral** — narrowing read-only consumers is a separate question — not an oversight to be tidied away.

#### Per-platform configs

`configByPlatform` wins when it has an entry for the current platform; otherwise the plain `config` is used. A platform outside the three known ids therefore falls back to `config` — and a server that has neither is skipped with a warning rather than failing the install.

Two path tokens are expanded recursively through the selected config (in `command`, in any `args` element, in `env` values):

| Token | Expands to |
|-------|-----------|
| `{{home}}` | `os.homedir()` |
| `{{localappdata}}` | `%LOCALAPPDATA%`, falling back to `~/AppData/Local` |

No existence check is performed on the result — if the binary is not installed yet, your MCP client reports that, not UniKit AI.

### What UniKit writes into your settings file

The settings file is shared property: the vendor's editor plugin writes into it, you write into it, extensions write into it. Since 1.2.0 UniKit reconciles rather than overwrites, and it does so on **both** `init` and `update` — `update` used to leave the file alone entirely, which is the wrong half of the cycle to skip, because `init` is run once while a plugin rewrites its own entry between runs.

Per selected server, in this order:

1. **A code that changed since the last write** — the entry standing under the old code is an orphan (nothing is listening on it, while its grants stay live in every skill's frontmatter), so it is removed. This is also the whole upgrade path off the pre-1.2.0 schema: the migration deliberately preserves the code UniKit *wrote* last time, so the divergence surfaces once and heals itself.
2. **No entry** → the server is written in full.
3. **An entry under our exact code** → `command` and `args` are **left alone**. Whoever wrote them knows things UniKit does not: a pinned version, a local build, an API key. Overwriting them is how the duplicate-registration bug this release fixes came about.
4. **An entry under a case or whitespace variant** of our code → removed and rewritten under the canonical spelling. Leaving it is not an option: grants are literal, so `mcp__UnityMCP__*` confers nothing on tools published as `mcp__unityMCP__*`. The scan is bounded — a key registered by an extension is never treated as a variant of ours, however similar it looks.
5. **`env` is the one narrow exception** and is overlaid onto an existing entry as well. It is UniKit's own field: `UNITY_MCP_NO_GATING=1` is what makes "gating is removed by configuration" a true statement about your project, and a plugin that rewrites the entry carries it away with everything else. The field name differs per agent (`environment` on OpenCode, `env` elsewhere) and Codex and OpenCode drop empty values. On OpenCode a **remote** entry is skipped by the overlay entirely: `environment` configures a spawned process, and a remote server has none. No shipped server reaches that path today — all three HTTP ones carry no `env` — but OpenCode is the one agent that declares a `$schema`, where a field that does not belong there can invalidate the whole file rather than a single entry.

The pass is idempotent — it compares the serialized result against what is on disk and does not rewrite an unchanged file.

**Version placeholders.** A shipped config may carry the token `{{ VERSION }}` where a version has to match something on your machine rather than something UniKit knows. Unity Biome does: its server version must match the version of the Unity package, and opening Unity writes the pin for you. Until it is filled in, every `init` and `update` prints a warning naming the server. Unlike the path tokens above, this one is **not** expanded — it is a marker meant to be replaced, and a run that still finds it says so out loud.

### Re-running `init`

On a re-init the wizard mirrors what `.unikit.json` already records:

- **Checkbox groups** (universal servers, and any engine directory holding just one) pre-check the servers you had installed.
- **Radio groups** (the engine alternatives of one catalog directory) pre-select your previous choice.
- `Skip` is never pre-selected — "you skipped it last time" and "there was no choice last time" are indistinguishable on disk, so the wizard re-offers the recommended server rather than silently disabling an MCP.

`order: 1` therefore decides the default only on a **fresh** install.

Changing your MCP selection reinstalls all skills and subagents: the selection is part of their source hash, which is how stale `mcp__<code>__*` entries get cleared from the installed frontmatter. The hash covers both halves of every `mcp.servers` entry, so a server whose vendor code changes while your selection stays the same still triggers the reinstall.

### Unreal Engine 5

The single engine server here registers under the code `unreal-engine`.

```json
{
  "type": "http",
  "url": "http://localhost:3000/mcp"
}
```

Backed by [ChiR24 Unreal MCP](https://github.com/ChiR24/Unreal_mcp) over its **native** transport (no Node.js bridge process). Requires **Unreal Engine 5.0+**; the vendor tests up to 5.8 (preview). The wizard shows the floor only — a ceiling goes stale on every engine release and means no more than "not tested further", while the floor is the half that makes a choice wrong.

Setup:

- Enable **Enable Native MCP** in the plugin settings (`bEnableNativeMCP` defaults to `false`; the server then listens on port 3000).
- A C++ project is required: copy `plugins/McpAutomationBridge` into `<Project>/Plugins/` and build it.
- Enable `PythonScriptPlugin`, `EditorScriptingUtilities`, `Niagara`, `GameplayAbilities` and `SmartObjects`.
- The Unreal Editor must be running.

The server exposes exactly **one** tool, which dispatches to every underlying action. There is no per-action granularity, so `allowed-tools` cannot narrow what an agent may do here — granting it grants everything the plugin implements. It ships no rules tree yet.

### Context7

```json
{
  "type": "http",
  "url": "https://mcp.context7.com/mcp",
  "_comment": "Higher rate limits with a free API key — add an Authorization: Bearer <YOUR_API_KEY> header. The field name differs per client — per-client examples: https://context7.com/docs/resources/all-clients"
}
```

Provides up-to-date documentation for any library. It is a hosted HTTP endpoint: nothing is installed and no local process is spawned. Used by `/unikit` and `/unikit-architecture` during setup, by `/unikit-explore` while researching, and by `/unikit-memory` to enrich dynamic memory.

`/unikit-implement` and `/unikit-fix` may also reach for it, but only on **two triggers**: an unfamiliar area (what approaches the authors propose — once per area per session), and a dead end (the schema is there, the capability is not). Never routinely at Bootstrap: it is a network dependency inside the editor lane, it costs 2-4k tokens per query, and it makes two runs of the same plan diverge. Whatever comes back describes **intent, not behaviour**, so it carries the same evidence obligations as anything else — with heightened attention, because it has been caught presenting a structurally broken path as an exemplary one. `/unikit-verify` is deliberately **not** granted it: verification needs evidence, not advice.

The server is optional in the wizard. Declining it does not disable anything — it removes one fallback, and the degradation ladder in the development principles continues from there.

**The server works anonymously.** A free API key from [context7.com/dashboard](https://context7.com/dashboard) raises your rate limits — it does not unlock access. That is why no `headers` block is shipped: a literal `Bearer YOUR_API_KEY` would answer 401 on every fresh install and, by rule 3 above (an entry standing under our exact code is left alone), would never repair itself.

**`_comment` is where to look when you do want the key.** It is an ordinary string carried into your settings file, addressed to you and read by nothing. It names the *header* rather than a field name, because the field name differs per client — Codex writes `http_headers`, Antigravity has a shape of its own — so the per-client examples at [context7.com/docs/resources/all-clients](https://context7.com/docs/resources/all-clients) are the authority on where the header actually goes. See [MCP JSON schema fields](#mcp-json-schema-fields) for the field itself.

You can delete the hint from your own settings file and `update` will **not** put it back. That is the same rule that preserves an API key you typed in by hand: UniKit does not rewrite an entry already standing under our code.

**A project installed before this change keeps its `npx` entry**, by decision rather than oversight — there is no migration, because rewriting an entry you may have edited is precisely what rule 3 exists to prevent. To move over, delete the `context7` entry from your settings file and run `unikit-ai update`.

## Rules Manifest

`data/rules-manifest.json` contains a `requiredBy` map only. It maps each core rule id (canonical lowercase-hyphen, no `.md`) to either `"all"` or an array of skill names that must load that rule. Example:

```json
{
  "requiredBy": {
    "code-style": "all",
    "pipeline": ["unikit-explore", "unikit-plan", "unikit-improve"]
  }
}
```

Rule metadata (`id`, `description`, `version`, `references`) lives in the remote registry `manifest.json`; the `Load when` text stays exclusively inside each rule `.md` file and is parsed at runtime by `parseRuleMetadataFromContent()` when building `RULES_INDEX.md` and when `rules show` prints the header. See `CLAUDE.md` → **Content Layers** for the full split.

## Supported Agents

| Agent | Config Dir | Skills Dir | MCP Support |
|-------|-----------|------------|-------------|
| Claude Code | `.claude` | `.claude/skills` | Yes (`.mcp.json`) |
| Codex CLI | `.codex` | `.codex/skills` | Yes (`.codex/config.toml`) |
| Cursor | `.cursor` | `.cursor/skills` | Yes (`.cursor/mcp.json`) |
| Qwen Code | `.qwen` | `.qwen/skills` | Yes (`.qwen/settings.json`) |
| OpenCode | `.opencode` | `.opencode/skills` | Yes (`opencode.json`) |
| Antigravity | `.agents` | `.agents/skills` | Yes (`.agents/mcp_config.json`) |

## Project Structure

After initialization (example for Claude Code):

```
your-unity-project/
├── .claude/                      # Agent config dir
│   ├── skills/                   # 22 code-pipeline skills (+ 11 unikit-gd-* if the Game Design group was selected)
│   │   ├── unikit/
│   │   │   └── references/
│   │   ├── unikit-architecture/
│   │   ├── unikit-commit/
│   │   ├── unikit-devcontext/
│   │   ├── unikit-docs/
│   │   │   ├── references/
│   │   │   └── templates/
│   │   ├── unikit-evolve/
│   │   ├── unikit-explore/
│   │   │   └── references/
│   │   ├── unikit-fix/
│   │   ├── unikit-help/
│   │   │   └── references/
│   │   ├── unikit-implement/
│   │   ├── unikit-improve/
│   │   ├── unikit-mcp-audit/
│   │   ├── unikit-mcp-trap/
│   │   │   └── references/
│   │   ├── unikit-memory/
│   │   ├── unikit-plan/
│   │   │   └── references/
│   │   ├── unikit-review/
│   │   ├── unikit-roadmap/
│   │   ├── unikit-rules/
│   │   ├── unikit-rules-registry/
│   │   ├── unikit-skills-context/
│   │   ├── unikit-todo/
│   │   │   └── assets/
│   │   ├── unikit-verify/
│   │   │   └── references/
│   │   └── unikit-gd-*/          # 11 game-design skills, one dir each - see Game-Design Module
│   └── agents/                    # Subagents directory
│       └── unikit-architecture-sidecar.md    # 8 subagent files (sidecars, coordinators, workers)
├── .unikit/                      # UniKit AI working directory
│   ├── config.yaml               # User-editable config (language, workflow, git)
│   ├── system/                   # Flat-rewritten on every init/update - never hand-edit
│   │   └── engine-mcp/            # Rules tree of the selected engine MCP (INDEX.md, verification.md)
│   ├── MCP-RECHECK-NOTES.md      # Your findings about that server - /unikit-mcp-trap writes, the installer only renames
│   ├── memory/                   # Dynamic memory, partitioned per knowledge module
│   │   ├── RULES_INDEX.md        # Auto-generated rule index
│   │   ├── code/
│   │   │   ├── core/              # 5 always-loaded rules
│   │   │   │   ├── code-style.md
│   │   │   │   ├── design-principles.md
│   │   │   │   ├── folders-structure.md
│   │   │   │   ├── performance.md
│   │   │   │   └── testing.md
│   │   │   └── stack/             # On-demand rules
│   │   │       ├── aspid-mvvm.md
│   │   │       ├── node-canvas.md
│   │   │       ├── imgui-editor-tools.md
│   │   │       ├── r3.md
│   │   │       ├── unitask.md
│   │   │       └── references/    # 9 detailed reference files
│   │   └── gamedesign/            # only if the Game Design skills are installed
│   │       ├── core/               # canonical domain knowledge (frameworks, balance, economy, ...)
│   │       └── library/            # empty studio slot for project-specific rules
│   ├── DESCRIPTION.md            # Project spec (generated by /unikit)
│   ├── ARCHITECTURE.md           # Architecture guidelines (generated by /unikit-architecture)
│   ├── RULES.md                  # Project-specific rules (managed by /unikit-rules)
│   ├── ROADMAP.md                # Strategic roadmap (managed by /unikit-roadmap)
│   ├── TODO.md                   # Task checklist (managed by /unikit-todo)
│   ├── code/                     # Dev-pipeline workspace
│   │   ├── plans/                 # Feature plans (managed by /unikit-plan)
│   │   ├── patches/               # Fix patches (created by /unikit-fix)
│   │   └── researches/            # Discovery output (created by /unikit-explore)
│   ├── gamedesign/                # GDD workspace (GAME.md, GD-IDS.yaml, systems/, flows/, ...) - created on first /unikit-gd-spec use
│   ├── skill-context/            # Skill overrides (/unikit-evolve, /unikit-skills-context)
│   └── evolutions/               # Evolution logs (generated by /unikit-evolve)
├── AGENTS.md                     # Project structure map (generated by /unikit)
├── .mcp.json                     # MCP config (Claude Code)
└── .unikit.json                  # UniKit AI installation config
```

## See Also

- [Getting Started](getting-started.md) - installation, supported agents, first project
- [Development Workflow](workflow.md) - how to use the workflow skills
- [Dynamic Memory](dynamic-memory.md) - how the dynamic memory works
