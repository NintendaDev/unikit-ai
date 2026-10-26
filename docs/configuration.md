[← Memory & Skill Evolution](evolve.md) · [Back to README](../README.md) · [Rules Registry →](rules-registry.md)

# Configuration

## `.unikit.json`

Main configuration file, created by `unikit-ai init`:

```json
{
  "version": "3.0.0",
  "engine": "unity",
  "mcp": { "servers": { "context7": "context7" } },
  "engineBridges": { "selected": { "unity-biome-mcp": "unity-biome-mcp" } },
  "agents": [
    {
      "id": "claude",
      "skillsDir": ".claude/skills",
      "subagentsDir": ".claude/agents",
      "installedSkills": [
        "unikit", "unikit-architecture", "unikit-archive", "unikit-commit", "unikit-devcontext",
        "unikit-docs", "unikit-evolve", "unikit-explore", "unikit-fix", "unikit-help",
        "unikit-implement", "unikit-improve", "unikit-bridge-audit", "unikit-bridge-docs",
        "unikit-bridge-trap", "unikit-memory", "unikit-plan", "unikit-pr", "unikit-references",
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
      "version": "2.0.0",
      "modules": {
        "code": {
          "core": [
            { "name": "code-style",        "source": "registry", "origin": "official", "version": "1.2.0", "installed_hash": "<64-hex sha256>" },
            { "name": "design-principles", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" },
            { "name": "folders-structure", "source": "registry", "origin": "official", "version": "1.1.0", "installed_hash": "<64-hex sha256>" },
            { "name": "performance",       "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" },
            { "name": "testing",           "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" }
          ],
          "stack": [
            { "name": "aspid-mvvm",  "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" },
            { "name": "node-canvas", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" },
            { "name": "odin",        "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" },
            { "name": "r3",          "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" },
            { "name": "unitask",     "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" }
          ]
        },
        "gamedesign": {
          "core": [
            { "name": "core-loops", "source": "registry", "origin": "official", "version": "1.0.0", "installed_hash": "<64-hex sha256>" },
            { "name": "economy",    "source": "registry", "origin": "primary",  "version": "2.1.0", "installed_hash": "<64-hex sha256>" }
          ],
          "library": []
        }
      }
    }
  },
  "genres": {
    "installed": [
      { "id": "tycoon", "version": 1 }
    ]
  }
}
```

Two shapes worth calling out:

- **`rules.installed` is module-keyed.** Entries live under `modules.<moduleId>.<tier>` - `modules.code.{core,stack}` and `modules.gamedesign.{core,library}`. The pre-2.0.0 flat form (`installed.core` / `installed.stack` at the top level) is still *read* and wrapped under the `code` module on load, so old projects keep working, but it is no longer the shape that gets written.
- **`genres.installed` is deliberately flat**, not a knowledge module - a plain list of `{ id, version }` keyed by profile id. Its `version` is a provenance record of which bundled revision was delivered; it does not gate refresh, because the installer rewrites installed profiles unconditionally on every `update`.

### Fields

| Field | Description |
|-------|-------------|
| `version` | Package version at time of install |
| `engine` | Game engine identifier (`unity`, `godot`, `godot-net`, `unreal-engine-5`) |
| `engineBridges.selected` | The selected engine bridges as `key → code` (an MCP-kind bridge: the vendor code it is registered under; a CLI-kind bridge: its binary). It is a **set**: any number of bridges. The **order** is not stored here - see [`engine_bridges`](#engine_bridges-section). A 2.x config kept the engine servers inside `mcp.servers`; `unikit-ai update` splits them - see [Migrating to 3.0.0](migration-3.0.0.md). |
| `rulesRegistry` | Rules registry URL or local path. Defaults to the official `NintendaDev/unikit-ai-rules` URL. See [Rules Registry](rules-registry.md) for details. |
| `mcp.servers` | Globally selected **universal** MCP servers (Context7, GitHub) as `key → code`. The **key** is the server's file id — the name of its JSON file under `mcp/universal/`, an internal identity that is never written anywhere else. The **value** is the vendor code UniKit registered that server under in the agent's settings file (`mcpServers.<code>`), stored per project because it is the only record of what was actually written. Configs written before 2.0.0 carry a bare `string[]` of file ids here and are converted on the next `unikit-ai init` / `unikit-ai update`. |
| `agents` | Array of installed agent configurations |
| `agents[].id` | Agent identifier (`claude`) |
| `agents[].skillsDir` | Where skills are installed |
| `agents[].subagentsDir` | Where subagent .md files are installed |
| `agents[].installedSkills` | List of installed skill names |
| `agents[].installedSubagents` | List of installed subagent names |
| `agents[].managedSkills` | SHA-256 hash-based change tracking for skill updates |
| `agents[].managedSubagents` | SHA-256 hash-based change tracking for subagent updates |
| `extensions` | Array of installed extension records (optional): `name`, `source`, `version`, `replacedSkills` (the replacements that are on), `selection` (the user's per-item choices - see [Extensions](extensions.md#config-format)) |
| `rules.installed` | Currently installed dynamic memory, keyed by module then tier (`modules.code.{core,stack}`, `modules.gamedesign.{core,library}`). Each entry is an object `{ name, source, origin?, version?, installed_hash? }`. See [Rules Registry](rules-registry.md#unikitjson-registry-fields) for field descriptions. Legacy `string[]` entries are normalized to `{ name, source: "installer" }` on load, and the pre-2.0.0 flat `{ core, stack }` form is wrapped under the `code` module. |
| `genres.installed` | Installed genre profiles as a flat list of `{ id, version }` (optional). Written by `unikit-ai genres install` and by `/unikit-gd-spec`'s best-fit resolve; drives which profiles `installGenreProfiles` delivers into `.unikit/system/gamedesign/genres/`. Orthogonal to `rules.installed` - genres are a seed catalog, not a knowledge module. |

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

testing:
  plan:
    checkpoints:
      ultra: phase
      full: phase
      fast: plan
  run:
    use_affected_modules: false
    full_run_threshold_percent: 30

git:
  enabled: true
  base_branch: main
  create_branches: true
  branch_prefix: feature/
  experiment_branch_prefix: experiment/
  skip_push_after_commit: false
  pull_requests:
    checkpoints: false
    max_level: create   # remind | create | merge

engine_bridges:
  order: []   # bridge ids, the most preferred first; [] = the default order of the package

subagents:
  model:
    claude:
      reader: sonnet
      validator: sonnet
      executor: inherit
    codex:
      reader: inherit
      validator: inherit
      executor: inherit
    antigravity:
      reader: flash
      validator: flash
      executor: inherit
  effort:
    claude:
      reader: medium
      validator: medium
      executor: inherit
    codex:
      reader: medium
      validator: medium
      executor: inherit
```

### `language` section

| Key | Description | Default |
|-----|-------------|---------|
| `ui` | Language for AI-agent communication (prompts, questions, explanations). It holds for the whole session, not just the first reply: status lines while background agents run, relays of what a subagent found (subagents talk to each other in English), the final report and any follow-up discussion. Options: `en`, `ru`, `de`, `fr`, `es`, `zh`, `ja`, `ko`, `pt`, `it` | `en` |
| `artifacts` | Language for generated artifacts (plans, specs, documentation). Same options as `ui`. | same as `ui` |
| `rules` | Language for knowledge base rule files: everything under `.unikit/memory/` (`code/{core,stack}/`, `gamedesign/{core,library}/`, `references/`, `RULES_INDEX.md`), `.unikit/RULES.md`, and skill-context rules. Intentionally decoupled from `ui` and `artifacts` - rule files are consumed by AI agents for prompt matching; keeping them in a stable language reduces semantic drift across agents and teams. Changing `ui` or `artifacts` does NOT change the language of existing rule files. **Strongly not recommended to change from `en`** - non-English rule files cause semantic drift and inconsistent agent behavior. Default is always `en`; can only be changed by manually editing this file (skills never write to this key). | `en` |
| `technical_terms` | How to handle technical terms in translations. `keep` - preserve English terms (API, prefab, shader, ECS). `translate` - translate where a common translation exists. **Strongly not recommended to change from `keep`** - translating technical terms degrades agent accuracy. Default is always `keep`; can only be changed by manually editing this file (skills never write to this key). | `keep` |

### `workflow` section

| Key | Description | Default |
|-----|-------------|---------|
| `research_relevance_days` | Maximum age (in days) for a research to be considered fresh by `/unikit-plan`, measured on the manifest's `Updated:`. Research older than this is **filtered out** of the planning question, not flagged. Since 2.0.0 the filtering is announced: `/unikit-plan` and `/unikit-improve` each print one `INFO [research] index: …` line naming how many entries were dropped and why. | `7` |

### `testing` section

Where **test runs** are placed in a plan (`plan`), and how wide a run goes when it happens (`run`). The keys do not affect **writing** tests: tests are written in any task of any phase, exactly as before.

| Key | Description | Default |
|-----|-------------|---------|
| `testing.plan.checkpoints.ultra` | Where `/unikit-plan` places a test-checkpoint task in an ultra bundle. Domain `task \| phase \| plan`; `task` is admissible only here, because only ultra has a per-task surface to put a run on. | `phase` |
| `testing.plan.checkpoints.full` | The same for a full plan. Domain `phase \| plan`. | `phase` |
| `testing.plan.checkpoints.fast` | The same for a fast plan. Domain `phase \| plan`. The default differs from full deliberately: a fast plan is short, and one full run at its end covers it whole. | `plan` |
| `testing.run.use_affected_modules` | How a phase test checkpoint and a `/unikit-fix` test run choose their tests. `false` runs every test in the project; `true` runs only the test suites of the changed modules and of the modules that depend on them, found by name search, in one run — and every test when narrowing is not possible. `task N.M` checkpoints always run their own fixtures, and the plan's final checkpoint always runs everything. | `false` |
| `testing.run.full_run_threshold_percent` | With `use_affected_modules: true`: when the affected suites reach this share of all the project's test suites, every test is run instead. An integer from 1 to 100; any other value falls back to the default with a `WARN [testing]` line. Assigned, not measured — tune it on your project. | `30` |

**Merging runs is a question, not a key.** When a `/unikit-implement` call covers two or more test-checkpoint tasks that can be merged, it asks once, before the first task, whether to run the tests once at the last of them or at every point as planned; words in the call itself (`Phases 5-6, tests at the end of phase 6`) answer it in advance. The answer holds for that call only — on disk it survives as the `⏭️ MERGED` marks in the plan. The plan's final full run is never merged into another point; it is the point the others merge into, so a phase run plus the final run already counts as two. A config written by an earlier version may still carry the executor's old merge key; nothing reads it any more.

**The placement key is recorded, not re-read.** `plan.checkpoints` is read by the planner and **recorded into the plan** as a `Test checkpoints:` line, so changing it later never reinterprets a plan already written.

**A run is never narrower than its coverage.** Where a checkpoint sits sets the minimum a run must cover — a task its own fixtures, a phase the modules it touched, the end of a plan everything. `testing.run` decides only how much wider than that minimum a run goes, so no setting can make a checkpoint cover less than its position promises. By default a phase checkpoint runs every test: several narrow launches in a row cost more than one full run, because every launch pays the test runner's fixed cost again. The scope is closed before the first launch, and a repeat after a red result is one launch of the whole scope — never a narrow check of the fixed test first. With narrowing on, the suites it finds still go out in one launch, and a run that finds zero tests is never counted as passed.

**The run keys are re-read, not recorded.** Unlike `plan.checkpoints`, `testing.run` is read each time a run happens and never written into a plan: a wider run is always compatible with what the plan declared, so changing the key never makes a plan already written wrong.

**`/unikit-verify` runs no tests of its own.** It checks the run the plan recorded against the current code; only `--strict` offers to run the full suite, when that record is missing or stale. See [Plan files](plan-files.md).

Existing projects receive the key by either of the two paths in [How new keys reach an existing project](#how-new-keys-reach-an-existing-project) — `/unikit` merge mode, which offers it, or the config actualization mode, which appends a template literal silently. Until then the built-in defaults above apply, and nothing warns — a project without a config is a normal case.

### `git` section

| Key | Description | Default |
|-----|-------------|---------|
| `enabled` | Whether this project uses git-aware workflows. If `false`, `/unikit-plan full` does not create branches, and `/unikit-review`/`/unikit-verify` do not assume a base branch exists. | auto-detected from `.git` presence |
| `base_branch` | Default branch for diff/review/merge targets (e.g. `main`, `master`, `develop`). | auto-detected, fallback `main` |
| `create_branches` | Automatically create feature branches for plans. Applies only when `git.enabled = true`. | `true` |
| `branch_prefix` | Branch name prefix for new features. Applies only when `create_branches = true`. | `feature/` |
| `experiment_branch_prefix` | Branch name prefix for experiment plans (a plan built from experiment cards): the branch is `<prefix><YYYY-MM-DD>-<topic>`. Applies only when `create_branches = true`. A project without the key uses the default. | `experiment/` |
| `skip_push_after_commit` | If `true`, `/unikit-commit` ends after a successful local commit with no push prompt. | `false` |
| `pull_requests.checkpoints` | Write a PR checkpoint task at the end of every plan module but the last. Recorded into the plan as `PR checkpoints: yes`. Not written when git is off or when the plan is on the base branch. | `false` |
| `pull_requests.max_level` | `remind` \| `create` \| `merge` — how far `/unikit-pr` goes. A ceiling for any request, and the action taken at a PR checkpoint. Without the GitHub MCP every level acts as `remind`. | `create` |

**`pull_requests.checkpoints` is recorded, not re-read** — the same rule as the test-run placement key above: `/unikit-plan` resolves it once and writes `PR checkpoints: yes` into the plan, so changing the key later never reinterprets a plan already written. `/unikit-plan add` and `/unikit-improve` read the plan's line, never the key. `max_level` is never read by the planner: it is resolved when a pull request is made.

**Plans are always sliced into modules**, whatever these keys say: a module is one or more consecutive phases after whose merge the base branch is whole. The keys only decide whether a module ends with a PR checkpoint task — see [Plan files → Modules](plan-files.md#modules--pieces-the-base-branch-can-take-whole).

### `engine_bridges` section

```yaml
engine_bridges:
  order: []   # bridge ids, the most preferred first; [] = the default order of the package
```

- `order` lists bridge ids - the file names without `.json`, as `BRIDGES.md` prints them. The agents use the installed bridges in this order, then the remaining installed ones in the default order printed in `BRIDGES.md` (the numbered table under `default order:`). An id that is not installed is skipped without a message. An empty list, or no key, means the default order.
- It is written by `/unikit`: at the first setup when two or more bridges are selected; by the config update, which asks the order in the same run when it adds the key to an existing project that has two bridges or more; and later in its bridge-order mode ("make Biome the main bridge"). You can also edit it by hand. Changing it needs no `init` and no `update` and reinstalls no skill: the installer never reads it.
- An instruction in the session ("use only Biome for this task") beats this order for that session.

### `subagents` section

Which model, and how much reasoning effort, the subagents that skills and the two coordinators launch use - one value per agent and per **role**, in two blocks, `model` and `effort`. A role says what a launch does: a **reader** collects facts and returns them, a **validator** checks a finished result, an **executor** does work whose result becomes part of the project (code, documents, rules, plans, architecture); which launch has which role is the table in `.unikit/system/subagent-roles.md`. Each block lists the agents whose subagent call takes that argument without any setting of the runtime itself; the other agents have no key.

| Key | Description | Default |
|-----|-------------|---------|
| `model.claude.<role>` | Claude Code. A tier name: `sonnet`, `opus` or `haiku`. | `sonnet` for `reader` and `validator`, `inherit` for `executor` |
| `model.codex.<role>` | Codex CLI. A model identifier as the model parameter of Codex's `spawn_agent` accepts it - its schema lists the valid names, and they change, so you write it yourself. | `inherit` |
| `model.antigravity.<role>` | Antigravity. `inherit`, `flash_lite`, `flash` or `pro` - the values of the `Model` argument of its subagent call; a tier sets the size of the model, not the depth. | `flash` for `reader` and `validator`, `inherit` for `executor` |
| `effort.claude.<role>` | Claude Code. A level of the `effort` argument of its subagent call: `low`, `medium`, `high`, `xhigh` or `max`. Which levels a model supports differs. | `medium` for `reader` and `validator`, `inherit` for `executor` |
| `effort.codex.<role>` | Codex CLI. A level of the `reasoning_effort` argument of `spawn_agent`. The valid levels depend on the model of the subagent, and a wrong one fails with an error that lists them, so no list is kept here. | `medium` for `reader` and `validator`, `inherit` for `executor` |

`<role>` is `reader`, `validator` or `executor`. A value means:

- **a model name** - passed to the subagent with every call of that role, exactly as written;
- **`inherit`, or an empty value** - nothing is passed: the subagent runs on the model, or the effort, of the agent that launches it. `inherit` is what the template ships for every executor and for the Codex models, whose identifiers go stale; an empty value written by hand means the same, is a deliberate choice and is never filled in again;
- **no key at all** (including no file, or no `subagents` block) - a model falls back to the built-in model of the role (a reader and a validator: the default noted above; an executor: none, the model of the session); an effort is not passed at all, so a project without the `effort` block behaves as it did before. A single value written directly under an agent, as in earlier releases (`model.claude: sonnet`), is not read: it counts as no key until you move it under `reader`, `validator` or `executor`.

**The skills and the coordinators read this block at run time**, once per run before the first launch, so an edit takes effect on the next command - `unikit-ai update` is not needed, and the installer never reads the file. Every launch is covered: the delegation aliases (`recon-agent`, `check-agent`, `lens-agent`, `recon-writer-agent`, `develop-agent`, `docs-agent`), the launches without an alias (`/unikit` generating stack rules and the architecture, the market validation of `/unikit-gd-brainstorm`), a launch a skill decides on by itself, and the workers, sidecars and polisher that `unikit-implement-coordinator` and `unikit-plan-coordinator` start. What to pass, and in which order, is the rule in `.unikit/system/subagent-arguments.md`, and which role a launch has is the table in `.unikit/system/subagent-roles.md`; `unikit-ai init` and `unikit-ai update` install both whichever skills you chose. The names of the model and effort arguments are not in the config: they are part of the agent profile and stand in the installed skills as slots of the call (`model: <model>`, `effort: <effort>`) - see [Subagents](subagents.md#subagent-profile-per-agent).

**Which value wins** is decided for the model and for the effort separately: what you ask for - in the request that started the skill, or earlier in the session ("use opus for the subagents", "launch every subagent with effort high") - comes first and holds for every launch whatever its role; then the config key of the launch's role; then the built-in model of the role, or nothing for an effort. A remark about depth in general ("think deeper") is not such a request. An effort level is passed in lower case. A subagent that is itself started by a subagent runs on the effort of its launcher unless one is passed, so the launcher repeats a level you named in the prompt of a nested launch that can launch further subagents. If an effort makes the launch fail, the skill repeats the call once without it (`WARN [delegation] effort ...`) and, if that fails too, once without the model.

**What can override the effort (Claude Code, by its documentation - not checked by a probe):** the environment variable `CLAUDE_CODE_EFFORT_LEVEL` overrides the level of a subagent call, and the setting `maxEffortLevel` or a limit of your organisation caps it, so the level written here may not be the one that runs; a level the model does not support falls to the nearest one below it. For a model the documentation does not list, what the argument does is not known. The argument itself is documented from Claude Code v2.1.292 (the probe of 2026-10-16 ran on 2.1.301); what an older client does with it was not checked - the call can fail, and the skill then repeats it without the effort.

**Antigravity has no effort key:** the subagent call of its client takes no effort argument, so what you can set is the effort of the session itself (`/effort` or `--effort`) and the tier in `subagents.model.antigravity.<role>` - see [Agents](agents.md#antigravity).

UniKit keeps no list of model names or effort levels. A value the runtime does not accept makes the launch fail, and the skill repeats the call with a `WARN [delegation]` line. Cursor, OpenCode, Kimi Code, Qwen Code and Universal / Other have no key in the template and UniKit draws no slot for them: nothing is passed, the subagent runs on the model and the effort of the session, and a key added by hand is not read. The reason is that their subagent call takes no model at all (Cursor, OpenCode), takes one only after you set up the client itself (Kimi Code `[secondary_model]`, Qwen Code `agents.modelGrades`), or belongs to a runtime UniKit does not know in advance (Universal / Other); the effort of Kimi Code is a client setting and not an argument of the call. What these clients accept comes from the vendor's documentation and has not been checked in a live session. The agent types the skills launch come from the agent profile, not from this file - see [Subagents](subagents.md#subagent-profile-per-agent).

### How new keys reach an existing project

A key added to this template after your project was bootstrapped does not arrive on its own: `unikit-ai init` only prints a hint about the file and `unikit-ai update` never touches it. `.unikit/config.yaml` is written by the `/unikit` skill and by nothing else, so there are exactly **two** paths, and the difference between them is deliberate.

| Path | Entered by | What it does with a missing key |
|------|-----------|--------------------------------|
| merge mode | a full `/unikit` bootstrap run on a project that already has a config | names the missing keys and **offers** to append them |
| config actualization mode | asking `/unikit` to update / actualize / repair the config on a project already set up | appends a template **literal** silently; **asks** only where the template carries a placeholder, or the current value falls outside a declared domain; and, when it has just added `engine_bridges.order` and two bridges or more are installed, asks their order |

Both derive the missing set the same way — by comparing `.unikit/config.yaml` against `skills/unikit/references/config-template.yaml` — so neither is more thorough than the other. The `subagents` block reaches an existing project the same way: the actualization mode appends it whole, with its comments. They differ only in whether they ask, and that difference follows from consent: a bootstrap run is not something you started in order to change configuration, so a question is appropriate there; the actualization mode is entered *because* you asked for exactly that, so re-asking about an obvious default is noise.

The actualization mode sorts every leaf key of the template into one of six buckets:

1. Absent, template value is a literal → appended **silently**.
2. Absent, template value is a `{{PLACEHOLDER}}` → **asked**.
3. Present but empty → treated exactly as absent. An empty value is a normal state, not a fault: `git.base_branch` is deliberately left empty in no-git mode. Exception: an empty `subagents.model.<agent>.<role>` or `subagents.effort.<agent>.<role>` is a deliberate choice (pass no model, pass no effort), so it is kept as it is; an absent key is appended with its template value, and an agent that holds one scalar where the template has a map of roles (the form of earlier releases) is left as it is and listed as skipped.
4. Present but outside a **declared** domain → asked. A domain is declared by exactly one thing: an inline `# a | b` comment standing beside the value. An `Options:` or `Examples:` list inside a comment block is prose for the reader, not a domain. Which keys carry one is settled by the template alone — this page deliberately does not list them, so the two cannot drift apart.
5. Present in your file but absent from the template → **reported, never deleted**. This is usually a key you added on purpose.
6. `language.rules` and `language.technical_terms` → **not touched at all**.

**The template is the single place these facts are declared.** Whether a key is defaulted silently or asked about follows from the template itself: a `{{PLACEHOLDER}}` value means "needs a human", a literal means "safe to default", and an inline `# a | b` declares a domain. Nothing about any specific key is written down a second time in the skill, so adding a key to the template is the whole change. Should a fact ever appear that this encoding cannot express — "ask even though it is a literal", or "deprecated: report but never append" — that is the moment to extend the template with a marker class, and not before: markers would have to be stripped out again when the config is written, and the comments are precisely what makes a setting discoverable.

**Two keys are never written and never asked about.** `language.rules` and `language.technical_terms` are hand-edited only, on both paths. Switching either on a live project leaves a half-translated rule corpus that agents then grep, which is why the ban covers the offer as much as the write.

**There is no mechanical backfill on `init` or `update`, and this is a decision rather than a gap.** A default written into the file stops being a default: the project would be pinned to today's value forever, and nothing afterwards could distinguish "the user chose this" from "we filled it in". Leaving the key absent keeps the built-in default live, and a missing key is behaviourally harmless — every reader carries its own.

## MCP Configuration

UniKit AI writes MCP server configuration into the file selected per agent: `.mcp.json` (Claude Code), `.codex/config.toml` (Codex CLI), `.cursor/mcp.json` (Cursor), `.qwen/settings.json` (Qwen Code), `opencode.json` (OpenCode), `.agents/mcp_config.json` (Antigravity), `.kimi-code/mcp.json` (Kimi Code), or `.mcp.json` (Universal / Other - the same file Claude Code uses, written by the same writer).

The catalog has two parts. **Universal servers** (Context7, GitHub) live in `mcp/universal/` and are the first group of checkboxes in the wizard. **Engine bridges** live in `engine-bridges/<engine>/` and are the second group: an engine bridge is either an MCP server (kind `mcp`) or a command line (kind `cli`, the Unity CLI today). A bridge of kind `cli` has **no entry** in any settings file; the rest of this page, up to [the Unity CLI](#unity-cli-order-1-kind-cli), is about servers that do.

Every server carries two names, and keeping them apart is what the rest of this section rests on:

- **`key`** — the server's internal identity, always equal to the name of its JSON file under `mcp/universal/` or `engine-bridges/<engine>/`. It is what `.unikit.json` records your selection under, what the delivery stamp and the findings log are named after, and it is never written into an agent's settings file.
- **`code`** — the **vendor code**: the key the server is actually registered under in your settings file (`mcpServers.<code>`), the middle segment of every `mcp__<code>__*` grant, and the value `{{engine_bridge_mcp_code}}` expands to in extension text.

Before 2.0.0 there was only `key`, and the engine alternatives of one engine were made to share it — which meant UniKit registered Unity Biome under the name `UnityMCP` while the server itself registers as `unity-biome-mcp`. The two entries coexisted in `.mcp.json`, and the grants followed the one nobody was talking to.

**Engine bridges of one engine are not alternatives** - tick any number of them. The group is the engine's own catalog directory (`engine-bridges/unity/`, `engine-bridges/godot/`, …); `godot` and `godot-net` share `engine-bridges/godot/`, so they share the group. Where more than one is selected, the order decides which is used first: a check that has no route on one bridge is tried on the next (see [`engine_bridges`](#engine_bridges-section)).

| Server | `key` (file id) | `code` (settings key, grant prefix) |
|--------|-----------------|-------------------------------------|
| Unity CLI (kind `cli`: no settings entry) | `unity-cli` | `unity` (the binary) |
| Unity Biome MCP | `unity-biome-mcp` | `unity-biome-mcp` |
| Coplay Unity MCP | `coplay-unity-mcp` | `UnityMCP` |
| Fennara Godot AI | `fennara-godot-mcp` | `fennara` |
| GDAI Godot MCP | `gdai-godot-mcp` | `godot-mcp` |
| Coding-Solo Godot MCP | `coding-solo-godot-mcp` | `godot` |
| ChiR24 Unreal MCP | `chir24-unreal-mcp` | `unreal-engine` |
| Context7 | `context7` | `context7` |

Each code is the one its vendor uses, so an entry UniKit writes and an entry the vendor's own editor plugin writes are the same entry rather than two.

### Unity

Three engine bridges are offered here, in the order of their `order` field - the **default order** that `BRIDGES.md` prints and that your own `engine_bridges.order` overrides. On a fresh install the wizard checks the first MCP bridge (**Unity Biome**), and the Unity CLI as well when it finds `unity` on your `PATH`.

#### Unity CLI (`order: 1`, kind `cli`)

The Unity CLI (`unity`) is a command line, not an MCP server, so UniKit writes **no entry** for it into your agent's settings file. For a CLI bridge `init` / `update` record the selection in `engineBridges.selected`, give the skills that need it narrow shell permissions - `Bash(unity <verb> *)` for `command`, `status`, `recompile`, `test`, `list`, `skill show` and `--version` (and the same verbs as `PowerShell(unity <verb> *)` for the PowerShell tool on Windows - the two tools have separate permission rules), and nothing that installs, closes, signs in or updates - and describe how to call it in `.unikit/system/engine-bridges/BRIDGES.md`. Every call passes `--project-path`: a bare `unity` command can see every editor that is open on the machine. The status form is for diagnosis, not for polling: it contacts every open editor even when it is given a path, and an editor that runs an older Pipeline package logs a harmless "No command named" error line for each call.

Requirements (the floors are printed in `BRIDGES.md`): the CLI at or above `1.0.0-beta.14`, the package `com.unity.pipeline` at or above `0.9.1-exp.1`, Unity at or above `6000.0`. The wizard pre-selects the bridge only when `unity` is found on your `PATH` (the search does not run it) and `ProjectSettings/ProjectVersion.txt` meets the engine floor.

You install the CLI yourself (`winget install Unity.CLI`, `brew install --cask unity-cli`, or the installer script in the Unity documentation). `unity pipeline install --project-path "<project>"` is run by an agent only after you confirm; an editor that is already open loads a new package only after it refreshes the project: bring its window forward and, when Auto Refresh is switched off in the editor (Hot Reload and similar plugins do that), use Assets > Refresh; until then it answers `STATUS_PIPELINE_LOAD_PENDING`. `/unikit` checks all of this at the end of setup and prints what is missing.

On Windows in Git Bash, a scene-object path that begins with one slash (`/Player`) is rewritten into a file path before the CLI sees it and the editor answers that no such object exists; the notes in `BRIDGES.md` tell the agents to write such paths without the leading slash, with two slashes, or to use the instance id.

It ships a small rules tree: checks for behaviour that was measured on a live editor and that Unity's own documentation does not describe. A tree adds **checks**, never removes a right. See [Engine bridge rules trees](#engine-bridge-rules-trees).

Documentation: `/unikit-bridge-docs` copies the built-in skill of the CLI and the documentation that ships inside the installed Pipeline package (its `Documentation~` folder and changelog, matching the installed version) into `.unikit/references/bridges/unity-cli/` and keeps an index of what it copied (`INDEX.md`, `FILES.md`). **Unity's own agent plugin:** see [Migrating to 3.0.0](migration-3.0.0.md#unitys-own-agent-plugin).

#### Unity Biome MCP (`order: 2`)

```json
{
  "command": "uvx",
  "args": ["--from", "git+https://github.com/german-krasnikov/unity-biome-mcp.git@v{{ VERSION }}#subdirectory=server", "unity-biome-mcp"],
  "env": { "UNITY_MCP_NO_GATING": "1" }
}
```

Backed by [unity-biome-mcp](https://github.com/german-krasnikov/unity-biome-mcp). Requires **Unity 6 (6000.0+)** and [`uv`](https://docs.astral.sh/uv/). Install the Unity package from the git URL `https://github.com/german-krasnikov/unity-biome-mcp.git?path=unity-plugin`, then run `MCP > Setup Wizard` in Unity. The Editor must be running — the server finds its port through `~/.unity-biome-mcp/ports/*.port`, so no env vars are needed.

It is the deepest of the engine integrations: transactional scene edits, a real console watermark, and authoring across uGUI, UI Toolkit, animation and shaders. What it can do at *your* version is answered by its live catalog, not by a list in this file — which is why you will not find one here.

It ships a **rules tree**: see [Engine bridge rules trees](#engine-bridge-rules-trees) below for what that is, and what it deliberately does not contain.

**Why UniKit AI sets `env: { "UNITY_MCP_NO_GATING": "1" }`.** Without the flag the catalog arrives gated — the client sees a fraction of it and is expected to unlock the rest per category. That unlock was measured **not to reach the client**, which leaves affordances declared and unreachable at once: the worst possible shape, because the failure is silent. The flag turns the whole set on at connect time. It costs roughly 8-10k tokens of context and buys one honest rule — *a tool that is not in your list does not exist here; it is not hidden*. The flag is written identically for every agent (it is all-or-nothing, not per-agent). The vendor does not document the variable, so this is the only place our reason for setting it is written down.

#### Coplay Unity MCP (`order: 3`)

```json
{
  "type": "http",
  "url": "http://127.0.0.1:8085/mcp"
}
```

Backed by the [MCP for Unity](https://github.com/CoplayDev/unity-mcp) package (Coplay). Requires **Unity 2021.3 LTS → 6.x**, the package installed in your Unity project, and the Unity Editor running. Its catalog arrives grouped. The grouping is presentational: what your client lists is what you can call, and a name missing from that list may still be reachable — or may be switched off in the editor by the person sitting at it. The rules tree tells an agent how to tell those two apart. Broadly it covers console reading, domain reload / asset refresh, EditMode and PlayMode test runs, and Editor authoring across scenes, components, prefabs, assets, UI documents, materials, animation and project settings.

The port above is the one measured on the installation this was written against: the Unity plugin passed it to the server on its launch line rather than letting the vendor default apply. Whether the plugin always picks that number is not established, so if yours differs, edit it in both places — the editor and your agent config.

It ships a rules tree: what UniKit AI has measured about this server and could not learn from the live catalog. A tree adds **checks**, never removes a right. See [Engine bridge rules trees](#engine-bridge-rules-trees).

Three caveats worth knowing before you rely on it:

- **The HTTP server does not start on its own.** Open the plugin window (`Window > MCP for Unity > Toggle MCP Window`) and start the server from its connection section. Until it is running, every tool call fails to connect.
- **The Unity package registers itself on editor load.** It shares its settings key with UniKit AI, so when it detects a transport or version mismatch it clears that key from every scope it can see — including the entry UniKit AI wrote. Turn that off with the EditorPref `MCPForUnity.AutoRegisterEnabled=false`, edited via `Window > MCP for Unity > Edit EditorPrefs`, if you want UniKit AI to stay the owner of your agent config.
- **The plugin can install an agent skill of its own, and it lands in your home directory.** A button in the plugin window writes a skill package outside the project, so it triggers in every project you open, not just this one. It does not collide with the `unikit-*` skills by path or name, but it competes with them for triggering. If you would rather it did not, do not press that button — or remove the package afterwards.

### Godot

Three engine bridges are offered here (`godot` and `godot-net` share the same catalog directory, so they are offered the same three); the wizard checks **Fennara** on a fresh install.

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

It ships a rules tree: what UniKit AI has measured about this server and could not learn from the live catalog. A tree adds **checks**, never removes a right. See [Engine bridge rules trees](#engine-bridge-rules-trees).

**The editor's approval setting is not a boundary for your agent.** Fennara's dock offers a tool-approval mode, and its default holds project changes for confirmation. That mode governs Fennara's own built-in chat and nothing else: a call arriving over MCP never passes through it, and a project-changing call was measured completing under the default setting with no prompt and no queue entry. Read it as a comfort setting for the editor's own assistant, not as a gate in front of the `unikit-*` skills — and do not go looking for an unlock step for the catalog, because all fourteen tools are already there.

Relatedly, the tool listing is not a permission boundary. While a project is open with the addon enabled, the local daemon serves any process on the machine that can read the control token from the current user's profile, and nothing on that path asks for approval — the same trust boundary as any other local developer tool that exposes a running editor. This is a property of the product rather than of UniKit AI, and it is written here only because a list of fourteen names reads like a limit and is not one.

This is the only config using [`configByPlatform`](#per-platform-configs) — its binary is an absolute path that differs on each OS. Its `env` objects are empty on purpose: the catalog arrives whole at connect time with full schemas, so there is no gating to lift and no variable this integration needs — the asymmetry with the flag Biome carries is a difference between the two servers, not an omission here.

#### GDAI Godot MCP (`order: 2`, paid)

```json
{
  "config": {
    "command": "uv",
    "args": ["run", "./addons/gdai-mcp-plugin-godot/gdai_mcp_server.py"]
  }
}
```

Backed by [gdai-mcp-plugin-godot](https://github.com/3ddelano/gdai-mcp-plugin-godot). Requires **Godot 4.1+**. A paid plugin — the vendor's own site is the source for pricing and installation. Before the first run: install the addon under `res://addons/gdai-mcp-plugin-godot/` and enable it in the project's plugin settings; the MCP client launches the Python server itself via the `uv run` command above, there is no separate manual start step.

- **The editor must be open** — there is no headless mode, and there is no daemon outside the editor process the way Fennara runs one.
- All 35 tools are visible immediately (no bootstrap). Its shape is an operation catalog rather than a code executor: granular, single-purpose tools cover scene, node, script, and editor-inspection work individually — the opposite of Fennara's one script-execution hatch.
- **No approval mode or permission gate is documented anywhere for this server** — not in its configuration guide, its installation guide, or any other page checked. There is nothing to look for and nothing to disable; the only boundary is the host OS and the process's own permissions — the same conclusion as Fennara's, reached for the opposite reason (Fennara documents an approval setting that turns out not to gate MCP calls; this server never describes one in the first place).

It ships a rules tree: what UniKit AI has measured about this server and could not learn from the live catalog — several of its mutations do not behave the way a synchronous success response implies, even though the catalog itself is honest and complete. A tree adds **checks**, never removes a right. See [Engine bridge rules trees](#engine-bridge-rules-trees).

This is a flat `config`, not [`configByPlatform`](#per-platform-configs) — the launch command has the same shape on every OS, and it carries neither an `env` block nor a `{{home}}`/`{{localappdata}}` token today.

#### Coding-Solo Godot MCP (`order: 3`, free)

```json
{
  "config": {
    "command": "npx",
    "args": ["@coding-solo/godot-mcp"],
    "env": {
      "GODOT_PATH": "/path/to/godot",
      "DEBUG": "true"
    }
  }
}
```

Backed by [godot-mcp](https://github.com/Coding-Solo/godot-mcp). Coding-Solo declares no version threshold at all — its prerequisites say only "Godot Engine installed" — which is why it is the one entry in the Godot list with no version in brackets. An undeclared threshold, not a forgotten one: a bracketed "Godot 4.x" there would be our inference rather than the vendor claim.

- **`GODOT_PATH` is a literal, untokenized path to your own Godot executable** — the one field of its kind among the three Godot servers. Fennara's and GDAI's install locations are predictable enough to expand from `{{home}}`/`{{localappdata}}`; a Godot install is not, so this one is written in by hand.
- All 14 tools are visible immediately (no bootstrap), and the vendor's own published tool list matches the live catalog exactly — the first of the three Godot servers measured with zero discrepancy in either direction.
- **Creating a brand-new scene fails unconditionally on Godot 4.6.x** — a version regression in the vendor's own bundled script, not a project-specific defect, thrown before any file is written. It fails loudly and immediately on the very first attempt, so widening the grant to `["*"]` does not hide this: it just means that one specific operation reliably fails on this engine version, while adding a node to an *existing* scene remains the reliable path.

It ships a rules tree: what UniKit AI has measured about this server and could not learn from the live catalog — most of its calls report success or failure independently of what actually happened on disk. A tree adds **checks**, never removes a right. See [Engine bridge rules trees](#engine-bridge-rules-trees).

This is a flat `config`, not [`configByPlatform`](#per-platform-configs) — the launch command (`npx @coding-solo/godot-mcp`) is the same on every OS; only the `env` block above varies by your own machine.

### Engine bridge rules trees

UniKit AI copies the **rules tree** of every selected bridge that ships one into `.unikit/system/engine-bridges/<bridge>/` (`INDEX.md`, `verification.md`) and writes `.unikit/system/engine-bridges/BRIDGES.md` - the set of selected bridges, the **default order** of the package (your own order lives in `config.yaml`), and for each bridge a table of its kind, how to call it, where its catalog comes from, when it is available, its rules tree, notes and collected documentation, and a table of its setup lines. The file is Markdown tables; the default order is a numbered one. A rules tree records **exceptions, not capabilities** — the places where this particular server behaves differently from what an honest reading of its own catalog would suggest.

| File | Read by |
|------|---------|
| `INDEX.md`, base section (everything except the `## Check` table) | `/unikit-plan`, `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-devcontext`, `unikit-implement-worker` — once, at Bootstrap |
| `INDEX.md`, the `## Check` table | `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `unikit-implement-worker` — grepped per editor task, by the task's own area plus the cross-cutting ones |
| `INDEX.md`, the delivery stamp and the access section | `/unikit-bridge-audit`, `/unikit-bridge-trap` — the stamp (the `bridge` row of the table under the title) names the bridge the tree belongs to; the access section says how a project-relative asset path is written for this engine |
| `verification.md` | `/unikit-verify` and no other skill — per-gate calibration: which observation closes which gate |

Three invariants hold over everything in the tree, and they are what makes it safe to ship at all:

- **Monotonic.** A rules file only ever *adds* an obligation. It never pre-lifts a gate, never says "use Y instead of X", and never hands out a permission.
- **Nameless.** No tool name appears anywhere in the tree. Names rot faster than anything else about an MCP server, and the live catalog is the only place they are true — so a rule is keyed by **area** (`ui`, `console`, `rollback`, `batch`, `compile`, `transport`, `visual`, …) instead.
- **No rules is not no rights.** A missing tree, a missing file, or an area with no matching line changes nothing about what an agent may attempt. `⏸️ MANUAL` is reached by trying and finding no route — never by an absence in this folder.

The genre of every entry is a **check to perform**, not a claim about the server's state: "confirm the content is able to exceed the viewport" stays true whether the bug is present or already fixed, while "the scroll container is broken" starts lying the moment it is fixed — and lies silently.

Mechanics worth knowing:

- Each tree comes from the [`rules`](#mcp-json-schema-fields) pointer of a bridge you selected, so the set of trees changes with your selection. A bridge without the pointer contributes nothing, and a skill that finds no file prints one line and keeps every right it had.
- It is **copied, not merged**. Each bridge gets a folder of its own, so there is nothing to concatenate and no per-contributor heading; subdirectories are copied as they are, so the tree may grow past its two starting files.
- Every delivered `.md` gets a **provenance stamp** under its title — a small table with one row, `bridge | <id>`, plus a comment saying to fix the source rather than the copy. That stamp is your project's only record of *whose* exceptions are on disk, and it is what the header of `.unikit/bridge-notes/<bridge>.md` is compared against at Bootstrap. It is the bridge id and nothing else, which is worth more than it sounds: a delivered file is byte-identical between runs for as long as the tree and the bridge are unchanged, so an unexpected diff in `.unikit/system/engine-bridges/` is a signal rather than the daily noise a delivery date used to produce.
- Like `cli-contract.md` and `dev-principles.md`, the tree is a **system asset — not hash-tracked**. Every `init` / `update` rewrites it from source, so local edits are lost. Findings of your own go in `.unikit/bridge-notes/<bridge>.md` (below); durable project knowledge goes in `.unikit/memory/`.
- Orphans are deleted across the **whole subtree**, not just `*.md`. Switching engines (or deselecting a bridge) clears the stale tree rather than leaving a Unity tree in a Godot project.

### Project findings - `.unikit/bridge-notes/<bridge>.md`

The rules tree is what UniKit AI shipped. These files are what *your* project found out, against each bridge it actually runs - one file per bridge.

- They sit in `.unikit/bridge-notes/`, deliberately **outside** `.unikit/system/` — so the installer's flat-rewrite and orphan sweep cannot reach them by construction.
- **The installer never writes their content.** The only operation it performs is a rename: a bridge that leaves your selection has its file parked as `.unikit/bridge-notes/archive/<bridge>.md`, and a bridge that returns gets it back (the change is worked out from the previous `BRIDGES.md`, read before it is rewritten). A finding is a statement about *one* bridge, so carrying it to another would be worse than losing it — it would look like evidence.
- Invariant: **one file per bridge — active or archived, never both.** An interrupted run can leave a second archive behind; it is kept rather than overwritten and announced with a `WARN`, because merging two sessions' findings is a curation call and not the installer's to make.
- `/unikit-bridge-trap` writes it, `/unikit-bridge-audit` curates it (re-stamp, replay, retire, upstream). Pipeline skills **read** it and never write it: one observation is a bad sample, and a bad line lives for months, so the durable surface passes through a human.
- It obeys the same three invariants as the rules tree, with **one carve-out**: the `evidence:` field of an entry is the single place in the whole system where a tool name may be written down. That is what makes an entry evidence rather than an opinion — and it is why `/unikit-bridge-audit` treats every entry as suspect once the server moves.

### MCP JSON schema fields

Every catalog JSON - under `mcp/universal/` or `engine-bridges/<engine>/` - declares `key` / `code` / `displayName` and either one of `config` / `configByPlatform` (kind `mcp`, the default) or a `cli` block (kind `cli`). `key` must equal the file's own basename and `code` must be non-empty — an entry missing either is dropped at scan time, so the server is simply never offered. Beyond those, a catalog JSON may declare the optional fields below. All of them are backward compatible — a config without them behaves exactly as before.

| Field | Purpose |
|-------|---------|
| `docs` | `{ context7, repo }` — where the server documents *itself*. `repo` generates the single install line printed in the `init` summary (`<displayName> — setup and requirements: <url>`) and is **required** when `is_engine: true`. `context7` is the library id the rules tree names as the server's reference. |
| `rules` | Directory holding this bridge's rules tree, resolved relative to the JSON's own directory (`"rules/<bridge>/"`, under `engine-bridges/<engine>/rules/`). Delivered to `.unikit/system/engine-bridges/<bridge>/` — see [Engine bridge rules trees](#engine-bridge-rules-trees). Absent is a normal state, not a degraded one. |
| `order` | The **default order** of the bridges of one engine - the `is_engine` entries of a single `engine-bridges/<engine>/` directory (ascending, 1-based; **required** for a bridge, unique within the directory). It is printed as the numbered table under `default order:` in `BRIDGES.md` and presents the wizard's list; it does **not** affect the order servers are written into a settings file, and your own order (`engine_bridges.order`) overrides it for the agents. |
| `kind` | `mcp` (the default; an MCP server the agent's client talks to) or `cli` (a command line the agent runs). |
| `cli` | For `kind: cli`, instead of `config`: `binary` (searched on `PATH`, the head of every grant), `projectFlag` (the option that names the project, in every form but the version probe), `shells` (the tools the grants are written for: `Bash`, `PowerShell`), `forms` (the command lines: `call`, `groups`, `group`, `tags`, `tag`, `search`, `list`, `schema`, `compile`, `status`, `ready`, `version`), `probes.package` (a project file to read for the installed package version) and `notes`. |
| `setup[]` | Lines of preparation, printed in the `init` summary and in the bridge's block of `BRIDGES.md`: `by` is `human` or `agent-confirmed` (the agent runs it only after you confirm), `run` the line. |
| `detect` | What the wizard may look at - without running anything - to pre-select the bridge: `binary` (found on `PATH`), `projectVersionFile` and `versionPattern` (a pattern with one capture group that picks the engine version out of it). |
| `requires` | The floors below which the bridge is unavailable: `engineVersion`, `cli`, `package`. Printed as `floor:` in `BRIDGES.md`. |
| `versionProbe` | For `kind: mcp`: where the installed version of the bridge is read - `{ "in": "args", "pattern": … }`, a regular expression with exactly one capture group applied to the `args` of the bridge's entry in each agent's MCP settings file. Printed as the `probe version` row of the block in `BRIDGES.md`; `/unikit-bridge-docs` and the executors use it to know which release the server runs. |
| `docs.sources[]` | Pointers to documentation, not documents - `command` (a command that lists and shows files), `package` (files inside an installed package) or `git` (a repository path with include and exclude filters; its `ref` may be `v{version}`, the tag of the installed version of the bridge). `/unikit-bridge-docs` copies what they point to. |
| `configByPlatform` | Per-OS config variants keyed by `win32` / `darwin` / `linux`, for servers whose binary path differs per platform. |
| `preselect` | `false` keeps the server unchecked in the wizard's checkbox list on a fresh install; absent means checked, as before. A re-run of `init` mirrors your previous choice either way. Universal servers only - an engine bridge is pre-selected by `order` (the first MCP bridge) and, for the Unity CLI, by detection, and `preselect` never sits on an `is_engine` entry. |

**A token in a header is a reference, never a value.** A header value in `config.headers` may carry `{{env:NAME}}` — the name of an environment variable, uppercase — and every writer renders it in its own client's syntax, so the settings file you commit never holds the token itself:

| Client | `Authorization: Bearer {{env:GITHUB_PAT}}` becomes |
|--------|----------------------------------------------------|
| Claude Code | `"Authorization": "Bearer ${GITHUB_PAT}"` |
| Cursor | `"Authorization": "Bearer ${env:GITHUB_PAT}"` |
| Qwen Code | `"Authorization": "Bearer ${GITHUB_PAT}"`, with the URL in `httpUrl` |
| OpenCode | `"Authorization": "Bearer {env:GITHUB_PAT}"` and `"oauth": false` |
| Codex CLI | `bearer_token_env_var = "GITHUB_PAT"` — no `Authorization` header at all |
| Antigravity | `"Authorization": "Bearer YOUR_GITHUB_PAT"` — it documents no reference syntax, so this is a placeholder you replace yourself |
| Kimi Code | `"bearerTokenEnvVar": "GITHUB_PAT"` — Kimi expands nothing inside a header, so the variable NAME goes into its own field and no `Authorization` header is written; set `GITHUB_PAT` in the environment `kimi` starts from |
| Universal / Other | `"Authorization": "Bearer ${GITHUB_PAT}"` - the same writer and the same spelling as Claude Code |

The first write has to be right: an entry already standing under our code is kept as it is (rule 3 of [What UniKit writes into your settings file](#what-unikit-writes-into-your-settings-file)), so nothing would ever correct a wrong one.

`config` (and each `configByPlatform` variant) may carry an `env` block, handed to the server process verbatim; the path tokens below expand inside its values too. UniKit AI uses it for exactly one thing today — see [`UNITY_MCP_NO_GATING`](#unity-biome-mcp-order-2) above.

`config` may also carry **`_comment` as its last field**: a one-line hint addressed to whoever opens their own settings file. Every writer carries it through verbatim — Codex because it copies fields it does not recognise, OpenCode through a passthrough naming the key explicitly, since that writer assembles its output from a whitelist and would otherwise drop it. Nothing reads the value: no consumer changes behaviour depending on whether it is present, absent, or says something else entirely. The key is pinned to the `MCP_COMMENT_KEY` constant by a guard in `scripts/test-skills.sh` Part 5b, so the data and the writer cannot drift apart. [Context7](#context7) and [GitHub](#github) use it today.

**`docs` replaced a hand-written `instruction` field, and the removal is deliberate.** That field restated the vendor's own documentation, which is how it came to carry a measured-false claim about how much of the catalog was reachable. A URL rots more slowly than prose, and when it finally dies it answers 404 loudly instead of walking you through outdated steps in silence. The install facts themselves — engine version, prerequisites, plugin setup — belong to the vendor and are deliberately not mirrored here. A server that needs no setup at all simply omits `docs.repo` and contributes no line.

**`verified` was retired, and the same absent-key guard now keeps it out.** The field carried `{ version, date, toolRegistry }` — the server version a rules tree was measured against, when, and from which registry file — and it died in two steps.

The version half went first, because the comparison it fed was structurally dead: `verified.version` was copied into the delivery stamp, the stamp was copied into the bridge-notes header, and the skills then compared header against stamp — so **both sides came from the same package constant**. The mismatch it was written to catch could only ever be announced by a UniKit release, never by the server on your machine moving, and a comparison that cannot fire for its own reason is worse than none because it reads like a guard. Nor could the version be recovered elsewhere: the MCP protocol carries it in `InitializeResult.serverInfo`, which reaches the client during the handshake with no method to ask for it again, and measurement across the catalog found no tool that reports it — on biome, `mcp_status`, `get_capabilities` and `doctor` return the scene, the *Unity* version and the *Python* version respectively.

The remaining half went with the last consumer that read it. Once the version was gone, nothing in the codebase consumed `date` or `toolRegistry`: they were parsed on every scan into a typed field no code path ever looked at. A hand-maintained date with no reader goes stale in silence, and the same question — *how old are these exceptions* — is answered better by `git log engine-bridges/<engine>/rules/`, which cannot drift from the thing it dates. The `verified` key now sits beside `shards` and `instruction` in the absent-key guard, because all three would come back the same way: someone adds a server, copies the nearest config as a template, and reintroduces a mechanism nothing reads.

#### Tool grants (`allowed-tools`)

A catalog JSON may name the skills and subagents that receive its tools. For an MCP bridge the names are injected into the installed frontmatter as `mcp__<code>__<tool>` (or `mcp__<code>__*`) — the **vendor code**, which is what the running server publishes its tools under. For a bridge of kind `cli` the JSON lists **verbs** and the installer writes `Bash(<binary> <verb> *)` for each - and the same as `PowerShell(<binary> <verb> *)` when the card names that shell, because the two tools have separate permission rules. Injection is keyed on your **selection** (the set of bridges, not their order), so changing which bridges you use reinstalls all skills and subagents and clears the old entries; a server whose code changes while your selection stays put has its dead names removed too. The installer removes only entries it owns - those that start with `mcp__` or with `Bash(<binary> ` / `PowerShell(<binary> ` - and never an entry you wrote yourself, such as `Bash(git *)`.

- **Executors get a wildcard.** `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-devcontext` and the implement coordinator / worker / review sidecar are granted `["*"]` rather than a list of names. A stored list is a second catalog that nothing keeps in sync: it goes stale silently, and then it removes a right the agent was supposed to have. The wildcard also removes the last reason for a tool name to be written down anywhere but the live catalog.
- **A command-line bridge is granted verbs, not a wildcard.** The executors get `command`, `status`, `recompile`, `test` and `--version`; `/unikit-bridge-audit` gets `command`, `status` and `--version`; `/unikit-bridge-docs` gets `skill show` and `--version`; `/unikit` gets `--version`, `status` and `self-update --check`. Nothing that installs, closes, signs in or updates is granted to anyone - `unity pipeline install` is run by an agent only after you confirm it.
- **The planner is the one exception**, and receives discovery names only — as few as the server needs to resolve a target. The discovery protocol is the single layer that does not rot, and a planner physically cannot mutate anything, so a narrow grant costs nothing and documents the boundary. A meta-tool that reports which parts of a catalog are switched on is **not** granted where its state field has been measured to lie.
- **On the three Godot servers the planner receives nothing at all, and that is the rule above being applied rather than an oversight.** None of `fennara-godot-mcp.json`, `gdai-godot-mcp.json` or `coding-solo-godot-mcp.json` carries a `unikit-plan` key. Fennara's only discovery-shaped candidate is a self-report, and its tool listing was measured naming an affordance the protocol path then refuses to run — a state field that disagrees with what is callable. Granting it would hand the planner a catalog that lies in the direction that costs most: naming what does not work. The other two Godot servers offer no discovery-shaped tool at all, so there is nothing to grant. Since the format has no comments, the asymmetry with the servers that *do* grant the planner is recorded here:

  | Server | Planner grant |
  |--------|---------------|
  | Unity Biome MCP | `discover_tools`, `mcp_status` |
  | Coplay Unity MCP | `find_gameobjects` |
  | Unity CLI | `list` - one read-only listing of the live catalog (`Bash(unity list *)`) |
  | ChiR24 Unreal MCP | `manage_tools` |
  | All three Godot servers | *(no `unikit-plan` key)* |
- `/unikit-bridge-audit` gets a wildcard because replaying a finding means re-issuing the exact call recorded in its `evidence:` field. Its restraint lives in a six-step envelope gated on one informed confirmation from you, not in the size of its grant.
- **`/unikit-bridge-trap` receives no grants at all** — it makes zero bridge calls by construction. This cannot be recorded in the JSON itself: the format has no comments, and an empty array would say something different — that the skill is a recipient whose grant list happens to be empty, which is a state nothing distinguishes from an editing mistake. So it is written down here.
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

The settings file is shared property: the vendor's editor plugin writes into it, you write into it, extensions write into it. Since 2.0.0 UniKit reconciles rather than overwrites, and it does so on **both** `init` and `update` — `update` used to leave the file alone entirely, which is the wrong half of the cycle to skip, because `init` is run once while a plugin rewrites its own entry between runs. A bridge of kind `cli` has no entry in this file; its permissions are in the frontmatter of the skills.

Per selected server, in this order:

1. **A code that changed since the last write** — the entry standing under the old code is an orphan (nothing is listening on it, while its grants stay live in every skill's frontmatter), so it is removed. This is also the whole upgrade path off the pre-2.0.0 schema: the migration deliberately preserves the code UniKit *wrote* last time, so the divergence surfaces once and heals itself.
2. **No entry** → the server is written in full.
3. **An entry under our exact code** → `command` and `args` are **left alone**. Whoever wrote them knows things UniKit does not: a pinned version, a local build, an API key. Overwriting them is how the duplicate-registration bug this release fixes came about.
4. **An entry under a case or whitespace variant** of our code → removed and rewritten under the canonical spelling. Leaving it is not an option: grants are literal, so `mcp__UnityMCP__*` confers nothing on tools published as `mcp__unityMCP__*`. The scan is bounded — a key registered by an extension is never treated as a variant of ours, however similar it looks.
5. **`env` is the one narrow exception** and is overlaid onto an existing entry as well. It is UniKit's own field: `UNITY_MCP_NO_GATING=1` is what makes "gating is removed by configuration" a true statement about your project, and a plugin that rewrites the entry carries it away with everything else. The field name differs per agent (`environment` on OpenCode, `env` elsewhere) and Codex and OpenCode drop empty values. On OpenCode a **remote** entry is skipped by the overlay entirely: `environment` configures a spawned process, and a remote server has none. No shipped server reaches that path today — all four HTTP ones carry no `env` — but OpenCode is the one agent that declares a `$schema`, where a field that does not belong there can invalidate the whole file rather than a single entry.

The pass is idempotent — it compares the serialized result against what is on disk and does not rewrite an unchanged file.

**Version placeholders.** A shipped config may carry the token `{{ VERSION }}` where a version has to match something on your machine rather than something UniKit knows. Unity Biome does: its server version must match the version of the Unity package, and opening Unity writes the pin for you. Until it is filled in, every `init` and `update` prints a warning naming the server. Unlike the path tokens above, this one is **not** expanded — it is a marker meant to be replaced, and a run that still finds it says so out loud.

### Re-running `init`

On a re-init the wizard mirrors what `.unikit.json` already records:

- **Both checkbox groups** (universal servers, and the engine bridges) pre-check what you had installed. There is no radio group and no `Skip`: a bridge is ticked or not.
- A bridge you install **after** `init` is registered by running `init` again and ticking it. `/unikit` tells you when it finds one on the machine that you did not select.

The package order (`order`) and the detection of the Unity CLI therefore decide the defaults only on a **fresh** install; your own order lives in `.unikit/config.yaml` ([`engine_bridges`](#engine_bridges-section)).

Changing your selection reinstalls all skills and subagents: the **set** of selected servers and bridges (not their order) is part of their source hash, which is how stale `mcp__<code>__*` and `Bash(<binary> …)` entries get cleared from the installed frontmatter. The hash covers both halves of every `mcp.servers` and `engineBridges.selected` entry, so a server whose vendor code changes while your selection stays the same still triggers the reinstall.

### Unreal Engine 5

The one engine bridge here, an MCP server, registers under the code `unreal-engine`.

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

The server exposes 23 distinct top-level tools rather than a single gateway — each is its own catalog entry with its own JSON Schema, and enabling or disabling one for the calling agent through the `manage_tools` tool is real and immediate in both directions, confirmed by a live round trip. Per-tool grants are possible for the first time on this engine; no per-action granularity exists within a single tool, and none of the 23 is purely read-only.

It ships a rules tree: a handful of calls silently drop an argument or report success over a state that did not change. A tree adds **checks**, never removes a right. See [Engine bridge rules trees](#engine-bridge-rules-trees).

### Context7

```json
{
  "type": "http",
  "url": "https://mcp.context7.com/mcp",
  "_comment": "Higher rate limits with a free API key — add an Authorization: Bearer <YOUR_API_KEY> header. The field name differs per client — per-client examples: https://context7.com/docs/resources/all-clients"
}
```

Provides up-to-date documentation for any library. It is a hosted HTTP endpoint: nothing is installed and no local process is spawned. Used by `/unikit` and `/unikit-architecture` during setup, by `/unikit-explore` while researching, and by `/unikit-memory` to enrich dynamic memory.

`/unikit-implement`, `/unikit-fix`, `/unikit-verify` and the implement worker and coordinator are granted it (with `unikit-architecture`, `unikit-explore`, `unikit-memory` and `unikit`). The executors read the documentation collected for the bridge for the command they chose (`dev-principles.md` → D6 step 2) and may reach for the library by the library-reference procedure (`dev-principles.md` → D8) only on **two triggers**: an unfamiliar area (what approaches the authors propose — once per area per session), and a dead end (the schema is there, the capability is not). Never routinely at Bootstrap: it is a network dependency inside the editor lane, it costs 2-4k tokens per query, and it makes two runs of the same plan diverge. Whatever comes back describes **intent, not behaviour**, so it carries the same evidence obligations as anything else — with heightened attention, because it has been caught presenting a structurally broken path as an exemplary one. `/unikit-verify` uses it for the dead end only: whatever comes back is advice, never the evidence that closes a gate.

The server is optional in the wizard. Declining it does not disable anything — it removes one fallback, and the route ladder in the development principles continues from there.

**The server works anonymously.** A free API key from [context7.com/dashboard](https://context7.com/dashboard) raises your rate limits — it does not unlock access. That is why no `headers` block is shipped: a literal `Bearer YOUR_API_KEY` would answer 401 on every fresh install and, by rule 3 above (an entry standing under our exact code is left alone), would never repair itself.

**`_comment` is where to look when you do want the key.** It is an ordinary string carried into your settings file, addressed to you and read by nothing. It names the *header* rather than a field name, because the field name differs per client — Codex writes `http_headers`, Antigravity has a shape of its own — so the per-client examples at [context7.com/docs/resources/all-clients](https://context7.com/docs/resources/all-clients) are the authority on where the header actually goes. See [MCP JSON schema fields](#mcp-json-schema-fields) for the field itself.

You can delete the hint from your own settings file and `update` will **not** put it back. That is the same rule that preserves an API key you typed in by hand: UniKit does not rewrite an entry already standing under our code.

**A project installed before this change keeps its `npx` entry**, by decision rather than oversight — there is no migration, because rewriting an entry you may have edited is precisely what rule 3 exists to prevent. To move over, delete the `context7` entry from your settings file and run `unikit-ai update`.

**Qwen Code gets `httpUrl`.** Qwen reads `url` as an SSE endpoint and `httpUrl` as HTTP streaming, so a new entry for **every** HTTP server — Context7, the HTTP engine servers (Coplay `UnityMCP`, chir24 `unreal-engine`) and servers registered by extensions — is written with `httpUrl` and without `url`/`type`. An entry written earlier is kept as it is; to recreate it, delete it from `.qwen/settings.json` and run `unikit-ai init` or `update`.

**Kimi Code drops `type`.** Kimi reads the transport off the entry (`command` → stdio, `url` → HTTP), so a new entry for every HTTP server is written without `type`, and a bearer-token header becomes `bearerTokenEnvVar` (table above). A header that is a whole `{{env:NAME}}` reference, or mixes text with one, has no Kimi field: it is dropped with a warning. Kimi enables project-level MCP servers only after you trust the folder. An entry written earlier is kept as it is; to recreate it, delete it from `.kimi-code/mcp.json` and run `unikit-ai init` or `update`.

### GitHub

```json
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": { "Authorization": "Bearer {{env:GITHUB_PAT}}" }
}
```

GitHub's official remote MCP server, offered in the wizard next to Context7 and **unchecked by default** (`preselect: false`) — it needs a token, and not every project makes pull requests. Only `/unikit-pr` uses it, and only five tools are granted, to that skill alone: `list_pull_requests`, `create_pull_request`, `update_pull_request`, `pull_request_read`, `merge_pull_request`. The tools that write into a repository past git (`create_branch`, `create_or_update_file`, `delete_file`) are never granted.

**Set `GITHUB_PAT` in the environment your agent starts from.** It is a GitHub personal access token that can read and write pull requests, plus write contents if you allow the `merge` level; the scopes GitHub asks for are listed in the [github-mcp-server README](https://github.com/github/github-mcp-server). The push itself is ordinary `git` with your own credentials — the MCP token is not used for it. `init` prints one line naming the variable when the server is selected.

**Antigravity** documents no syntax for referencing an environment variable, so its settings file gets the placeholder `YOUR_GITHUB_PAT`. Replace it with the token yourself — and never commit `.agents/mcp_config.json` once it holds the token. `init` says so in the summary.

**An older `github` entry is kept as it is.** An entry you wrote by hand, or one another tool left under the `github` key (a local `npx` server with a different token variable, a literal token), is not rewritten — the same rule that keeps a key you typed into Context7. `init` and `update` warn about it with a line ending in `does not match the catalog`, without printing its value: delete the entry and run `unikit-ai init` again.

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

Rule metadata (`id`, `description`, `version`, `references`) lives in the remote registry `manifest.json`; the `Load when` text stays exclusively inside each rule `.md` file and is parsed at runtime by `parseRuleMetadataFromContent()` when building `RULES_INDEX.md` and when `rules show` prints the header.
## Supported Agents

| Agent | Config Dir | Skills Dir | MCP Support |
|-------|-----------|------------|-------------|
| Claude Code | `.claude` | `.claude/skills` | Yes (`.mcp.json`) |
| Codex CLI | `.codex` | `.codex/skills` | Yes (`.codex/config.toml`) |
| Cursor | `.cursor` | `.cursor/skills` | Yes (`.cursor/mcp.json`) |
| Qwen Code | `.qwen` | `.qwen/skills` | Yes (`.qwen/settings.json`) |
| OpenCode | `.opencode` | `.opencode/skills` | Yes (`opencode.json`) |
| Antigravity | `.agents` | `.agents/skills` | Yes (`.agents/mcp_config.json`) |
| Kimi Code | `.kimi-code` | `.kimi-code/skills` | Yes (`.kimi-code/mcp.json`) |
| Universal / Other | `.agents` | `.agents/skills` | Yes (`.mcp.json`) |

### Removing an agent

Deselecting an agent on a repeat `unikit-ai init` removes only what UniKit installed for it: the skills recorded under that agent in `.unikit.json` (`installedSkills`) and the skills of installed extensions. The skills directory itself is deleted only when nothing else is left in it - skills you added by hand or with `npx skills add` stay, and `init` says how many items it left. Subagent files and MCP entries are not removed, and Antigravity's `.agents/rules/unikit.md` is.

### Two agents, one skills directory

Two agents of one project never share a skills directory: with different text in the same place they would overwrite each other on every `update`. Today the only such pair is Antigravity and Universal / Other (both use `.agents/skills`); the `init` wizard refuses the selection, and `update` and `extension add|remove|update` stop with exit code 1 if `.unikit.json` was edited into that state. The rule compares directories, not agent names, so it holds for any agent added later.

## Project Structure

After initialization (example for Claude Code):

```
your-unity-project/
├── .claude/                      # Agent config dir
│   ├── skills/                   # 26 code-pipeline skills (+ 13 unikit-gd-* if the Game Design group was selected)
│   │   ├── unikit/
│   │   │   └── references/
│   │   ├── unikit-architecture/
│   │   ├── unikit-archive/
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
│   │   ├── unikit-bridge-audit/
│   │   ├── unikit-bridge-docs/
│   │   │   └── references/
│   │   ├── unikit-bridge-trap/
│   │   │   └── references/
│   │   ├── unikit-memory/
│   │   ├── unikit-plan/
│   │   │   ├── references/
│   │   │   └── scripts/          # plan-bundle.mjs - checks, finalizes or discards an ultra bundle
│   │   ├── unikit-pr/
│   │   │   └── references/
│   │   ├── unikit-references/
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
│   │   └── unikit-gd-*/          # 13 game-design skills, one dir each - see Game-Design Module
│   └── agents/                    # Subagents directory
│       └── unikit-architecture-sidecar.md    # 8 subagent files (sidecars, coordinators, workers)
├── .unikit/                      # UniKit AI working directory
│   ├── config.yaml               # User-editable config (language, workflow, git)
│   ├── system/                   # Flat-rewritten on every init/update - never hand-edit
│   │   ├── cli-contract.md        # CLI exit codes + command contract, for the skills to read
│   │   ├── dev-principles.md      # Engine principles (the one asset with {{engine_*}} substituted)
│   │   ├── modules.yml            # Generated snapshot of MODULE_REGISTRY
│   │   ├── gate-result-contract.md # Schema of the `unikit-gate-result` fenced JSON block
│   │   ├── ultra-plan-read.md     # Reader contract for an ultra plan bundle
│   │   ├── research-link.md       # The `## Based on` contract - entry, hashing, drift ladder
│   │   ├── plan-boundaries.md     # Where a plan, a module and a push start and end - read by verify, implement, commit, pr
│   │   ├── merge-analysis.md      # How to read a merge before it happens - read by explore and plan when asked to merge a branch
│   │   ├── balance-handback.md    # The balance hand-back report contract - read by plan, implement, verify and unikit-gd-balance
│   │   ├── prototype-profile.md   # How a plan built from experiment cards is executed - read by implement, verify, pr, improve, review, fix, devcontext, commit and their subagents
│   │   ├── subagent-arguments.md  # How the model and the effort of a subagent launch are settled - read by every skill that can launch a subagent and by the two coordinators
│   │   ├── subagent-roles.md      # Which role (reader, validator, executor) each subagent launch has - read with subagent-arguments.md
│   │   ├── user-questions.md      # How a skill asks you a question and waits for the answer - read before the first question by every skill and agent file that can ask you one
│   │   ├── gamedesign/            # Game-design system assets
│   │   │   ├── gd-principles.md    # The design working contract - slim core
│   │   │   ├── gd-authoring.md     # + 6 shards, each read only by the skills that need it
│   │   │   ├── gd-lifecycle.md
│   │   │   ├── gd-flow-axis.md
│   │   │   ├── gd-content-axis.md
│   │   │   ├── gd-provenance.md
│   │   │   ├── gd-critique.md
│   │   │   ├── design-read.md      # The code-reads-design contract
│   │   │   └── genres/             # Only the profiles in .unikit.json genres.installed
│   │   └── engine-bridges/        # BRIDGES.md and the rules tree of each selected bridge
│   ├── bridge-notes/             # Your findings, one file per bridge - /unikit-bridge-trap writes, the installer only renames
│   ├── references/               # bridges/ (/unikit-bridge-docs), user/ and INDEX.md (/unikit-references)
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
│   ├── rules/                    # Project rule topics, listed under ## Topics in RULES.md (managed by /unikit-rules)
│   ├── ROADMAP.md                # Strategic roadmap (managed by /unikit-roadmap)
│   ├── TODO.md                   # Task checklist (managed by /unikit-todo)
│   ├── code/                     # Dev-pipeline workspace
│   │   ├── PLAN.md                # Fast-mode plan (managed by /unikit-plan)
│   │   ├── FIX_PLAN.md            # Fix plan (created by /unikit-fix)
│   │   ├── plans/                 # Feature plans (managed by /unikit-plan)
│   │   │   ├── <name>/recon/      # Reconnaissance kept with an ultra plan written with saved state
│   │   │   └── <name>/.planning/  # An ultra plan written with saved state - gone once its checks pass
│   │   ├── patches/               # Fix patches (created by /unikit-fix)
│   │   └── researches/            # Discovery output (created by /unikit-explore), with INDEX.md
│   ├── gamedesign/                # GDD workspace (GAME.md, GD-IDS.yaml, systems/, flows/, ..., balance/, experiments/) - created on first use (/unikit-gd-spec; balance/ and experiments/ may be created first by /unikit-gd-balance and /unikit-gd-experiment)
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
- [Migrating to 3.0.0](migration-3.0.0.md) - from one engine server to engine bridges
