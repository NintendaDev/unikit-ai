[← Subagents](subagents.md) · [Back to README](../README.md) · [Game-Design Module →](gamedesign.md)

# Plan Files

UniKit AI uses markdown files to track implementation plans, self-improvement patches, and skill overrides.

## Plan Structure

Plans are stored in two locations depending on mode:

| Source | Plan Location | Contents |
|--------|--------------|----------|
| `/unikit-plan fast` | `.unikit/code/PLAN.md` | Single flat file: overview, settings, checklist, commit plan, and `## Technical Context` inline |
| `/unikit-plan full` | `.unikit/code/plans/<feature-name>/` | One manifest — `PLAN.md` — carrying the same sections |
| `/unikit-plan ultra` | `.unikit/code/plans/<feature-name>/` | `PLAN.md` + `phase-NN-<slug>.md` |
| `/unikit-plan add` | Existing plan location | Modifies existing plan in-place |
| `/unikit-fix` (plan mode) | `.unikit/code/FIX_PLAN.md` | Single file with analysis + fix steps |

Ultra reuses the full-mode folder and the same `PLAN.md` entry point — moving a plan from full to ultra is purely additive: phase files appear, nothing is renamed, external links stay valid.

**Two different files are called `PLAN.md`.** The flat `.unikit/code/PLAN.md` is the throwaway fast plan; `.unikit/code/plans/<folder>/PLAN.md` is a folder plan's manifest. Nothing else distinguishes them — always read the path, never the name. Skills are held to the same rule by a guard (`PL-1`): inside `skills/**` and `subagents/*` the name may never be written bare, only as a full path, as the glob `plans/*/PLAN.md`, or as the phrase "the plan folder's manifest".

**Migration is selective.** `unikit-ai update` merges the old two-file form into one `PLAN.md` only in folders that still have open tasks. A plan whose checklist is fully ticked is left exactly as it was, with `TASKS.md` and `PLAN-BRIEF.md` side by side — a finished plan is a record, and a record is not rewritten. So `.unikit/code/plans/` stays mixed, permanently and by design; the two shapes are not a half-finished migration. Anything that has to read across old plans (the `implemented_version` migration-grace scan in `/unikit-plan`) locates blocks by heading and never by file name, which is why it globs `plans/*/*.md`.

A folder plan stays a folder even with a single file in it — discovery looks for the folder and never opens it, which is what lets new plan shapes be added without touching any consumer.

### PLAN.md — the plan manifest

One file per folder plan: overview, settings, the dependency-ordered checklist with WHY context, effort estimates and file paths, the commit plan, and the technical context that does not belong in the checklist. In fast mode the very same sections live in the flat `.unikit/code/PLAN.md`.

```markdown
# Item Rarity System — Tasks

Created: 2026-03-15
Updated: 2026-03-18

## Overview
Adds a five-tier rarity classification to items, surfaced in the inventory grid.
Rarity drives filtering, drop weighting and the badge tint on the item widget.
Goal: make an item's value readable at a glance without opening its tooltip.

## Settings
- Testing: no
- Test checkpoints: phase
- Docs: no
- Editor tasks: mcp

## Checklist

### Phase 1: Data Model
**Effort:** S
**Dependencies:** None
**Status:** [ ] Not started

- [ ] Task 1.1 — Create the RarityType enum
  WHY: a typed rarity classification has to exist before any visual or gameplay logic
  Files: `<content-root>/Gameplay/Core/Items/RarityType.<ext>`
- [ ] Task 1.2 — Add the rarity field to ItemDefinition
  WHY: items need a rarity property for filtering and display
  Files: `<content-root>/Inventory/ItemDefinition.<ext>`

### Phase 2: Presentation
**Effort:** S
**Dependencies:** Phase 1
**Status:** [ ] Not started

- [ ] Task 2.1 — Tint the rarity badge in the item widget
  WHY: the rarity has to be readable at a glance in the inventory grid
  Files: `<content-root>/UI/ItemWidget.<ext>`
  Editor: [ui] ItemWidget → RarityBadge : bind tint to Rarity
<!-- Commit checkpoint: tasks 1.1-2.1 -->

## Commit Plan

### Commit 1: after tasks 1.1-1.2
feat(items): add rarity enum and data model

### Commit 2: after tasks 2.1-2.4
feat(items): implement rarity visual effects

## MCP Findings

| id | area | confirm that | observed | evidence | from |
|---|---|---|---|---|---|

## Rule Candidates

| id | rule | full formulation | from | status |
|---|---|---|---|---|

## Test Runs

Full run: 2026-09-12 · all tests · passed 3363/3363 · tree-sha256 `e5f6a7b8…`

---

## Technical Context

### CONTEXT
Project, feature, scope, and the stop condition — what this plan explicitly does not implement.

### CONSTRAINTS
MUST / FORBIDDEN lines, each with its rationale.

### INTERFACES
Signatures of every interface the plan introduces or changes, marked `[NEW | MODIFY]`.

### KEY PATTERNS
The patterns the code must follow, shown in context rather than named.

### DEPENDENCY GRAPH
Which component receives which dependency, and how.

### FILES
`CREATE` and `MODIFY` tables — every path the plan touches.

### EDITOR TARGETS
| Kind | Container | Target | Change |
|------|-----------|--------|--------|
| ui | ItemWidget | RarityBadge | bind tint to Rarity |

### DI BINDINGS
One line per installer binding, per `ENGINE_RULES.md` §2.

### OUT OF SCOPE
What is explicitly not part of this plan.
```

`<content-root>` and `<ext>` are engine placeholders — see [Editor tasks](#editor-tasks) below.

`## EDITOR TARGETS` aggregates every `Editor:` line in the checklist. It is omitted entirely when a plan has no editor work, and `/unikit-improve` keeps it in sync when it adds or removes tasks.

The manifest is edited in place. `Write` over it is forbidden — the file carries `## Technical Context` alongside the checklist, and a regenerating write silently drops whatever the current pass did not reconstruct.

#### `## MCP Findings` — the executor's handoff surface

A plan that carries at least one `Editor:` task also carries a `## MCP Findings` section. `/unikit-plan` emits the heading and the header row and stops there; the executors fill it in.

```markdown
## MCP Findings

| id | area | confirm that | observed | evidence | from |
|---|---|---|---|---|---|
| F1 | rollback | the snapshot captured more than zero files | 2026-08-18 | `<call>(paths="...")` → `state=ready files=0` | task 2.3 |
```

A row is written when an engine MCP call **misled** you — it reported success while changing nothing, ate an argument, or validated a broken state.

| column | what goes in it |
|--------|-----------------|
| `id` | `F<n>`, allocated in order within this plan, never reused |
| `area` | one of the 12 area words — never a tool name, so the row stays reachable after the server changes |
| `confirm that` | the check, phrased as an instruction to verify. **Only a check** — never a lifted gate, never "use Y instead of X" |
| `observed` | the date it was observed, written by whoever observed it |
| `evidence` | the raw call and the raw answer. The one column where a tool name is legitimate |
| `from` | the task that observed it |

Three rules make this work:

- **The row is written at the task, not at the end of the run** — by the same edit that ticks the checkbox. A table filled only in the closing report is lost to every `/clear`, which is exactly the moment a long run is most likely to end.
- **Five writers, one table.** `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, plus `unikit-implement-worker` and `unikit-implement-coordinator` when the plan runs in parallel. None of them writes `.unikit/MCP-RECHECK-NOTES.md` directly: one observation is a bad sample, and a bad line lives for months, so the durable surface passes through a human.
- **The table is read through a window.** `/unikit-mcp-trap` reads from the heading to the next `##` and opens no other part of the plan — so keep the heading at `##`, keep it above `## Technical Context`, and never nest the table inside another section.

At the end of a run `/unikit-implement` offers to hand the plan to `/unikit-mcp-trap`, which turns accepted rows into entries in `.unikit/MCP-RECHECK-NOTES.md`. See [Engine-MCP rules tree](configuration.md#engine-mcp-rules-tree).

#### `## Rule Candidates` — a rule proposed, never written behind your back

`/unikit-plan` emits this section — heading and header row — in **every** plan, even when no candidate ever appears. A candidate can arise in any plan, and an executor left to invent a place for the table puts it somewhere new each time; one empty table per plan is the cheaper mistake.

| column | what goes in it |
|--------|-----------------|
| `id` | `R<n>`, allocated in order within this plan, never reused |
| `rule` | the rule **exactly as it would be written into `.unikit/RULES.md`** — one line, one directive |
| `full formulation` | the long version with its rationale, under no length limit. This column is why the short form is allowed to stay short |
| `from` | the task that produced it (`task 2.3`), or `verify` |
| `status` | `open` \| `added` \| `declined` |

Four skills write rows here — `/unikit-implement`, `/unikit-verify`, `unikit-implement-worker` and `unikit-implement-coordinator` — and **none of them writes `.unikit/RULES.md`**. A row is written the moment the candidate is noticed, by the same edit that ticks the checkbox, so it survives a `/clear`. At the end of the call the open candidates are printed as plain markdown and then put to you as a single question; only the set you pick is passed to `/unikit-rules`, which is the one skill that writes the file. `declined` is durable — a candidate you turned down is not offered again on a later run.

#### `## Test Runs` — what actually ran, and when

Emitted under `Testing: yes` only. `/unikit-plan` writes the heading; everything beneath it is the executor's.

- **One bullet per run, append-only:** `<date> · <coverage> · <what ran> · passed N/N · tree-sha256 <hash>`.
- **One `Full run:` anchor line**, rewritten in place after each full run. The bullets are the log for a human; the anchor is the machine surface `/unikit-verify` greps.
- `tree-sha256` digests a **short text**, not the project: the output of `git rev-parse HEAD` followed by `git status --porcelain`. No project file is read, so a large repository costs no more than a small one. Git unavailable → the field reads `tree-sha256 unavailable`, and a verifier will not reuse that run.

This is what lets `/unikit-verify` quote the executor's full run instead of repeating it when the tree has not changed — a closed gate on evidence obtained earlier, not a skipped one.

#### Test-checkpoint tasks — a run is a task, not a command

A test run is its own checklist task carrying a `Test checkpoint:` line, and it is the one task form that carries **no `Files:`**: it creates nothing. Under `Testing: yes` the plan's last task is always a full run. Where such tasks are placed comes from `testing.plan.checkpoints` (see [Configuration](configuration.md)), which the planner resolves once and records into `## Settings` — so changing the key later never reinterprets a plan already written. The grammar and how a run's width follows from its coverage are canonical in the plan format reference; this page names them rather than repeating them.

**A plan written before this existed has no `Test checkpoints:` line.** That is a legacy plan, and nothing breaks: the executor falls back to finding runs in the prose of the tasks, with lower confidence, and says so in its report. `/unikit-improve` will not add test-checkpoint tasks to such a plan — the placement was never declared, and guessing it while editing your plan is not its call.

**Section order in the manifest** is a contract, not layout: `## Commit Plan` → `## MCP Findings` → `## Rule Candidates` → `## Test Runs` → `## Dependency Graph` → `## Total Estimated Effort` → `---` → `## Technical Context` → `## Open Questions`.

### Ultra bundle — a manifest plus one file per phase

`/unikit-plan ultra` writes the same folder plan with one extra layer: the manifest keeps
the checklist, and every phase gets its own file carrying the detail that does not fit a
checklist line. Two situations call for it — a plan written by a strong model and executed
later by a smaller one, and a feature whose per-task specification (exact paths and
symbols, ordered edits, interfaces, error handling, acceptance criteria, verification
commands) is simply too long to live inside `## Checklist`.

**Ultra is strictly opt-in — user-named, never model-inferred.** It is never offered in
the interactive mode question and never chosen because a feature looks big. You do have to
ask for it, but you can ask in your own words and in any language ("ultra plan",
"ультраплан", "make an ultra plan for the inventory") — the request is recognised wherever
it sits in the sentence. What is *not* a request is wording that only asks for care: "plan
this thoroughly" or "a detailed plan" falls through to the interactive question instead,
because an unwanted bundle leaves you a folder of phase files you never asked for, while a
missed one costs you one word.

```text
.unikit/code/plans/<feature-name>/
├── PLAN.md                 ← the manifest (same name as a full plan)
└── phase-NN-<slug>.md      ← one file per phase
```

The first line of the manifest is the mode marker, written verbatim and never translated —
not even under `language.artifacts: ru`:

```
<!-- unikit:plan-mode:ultra -->
```

**What lives where.** Everything mutable during execution stays in the manifest: the
checklist checkboxes, `## MCP Findings`, `## Commit Plan`, `## Settings`, and the
cross-phase part of `## Technical Context` (`CONTEXT`, `CONSTRAINTS`, `DEPENDENCY GRAPH`,
`OUT OF SCOPE`). The manifest also carries an optional `## Architecture and Decisions` for
decisions that bind **two or more** phases — a module boundary, a shared contract, a chosen
trade-off. A decision internal to one phase belongs in that task's section instead, and the
whole section is omitted when there are no cross-phase decisions. The task-scoped detail moves into the phase files, and **phase files are
read-only during execution** — a skill executing a plan never writes into `phase-*.md`.
That single write surface is what keeps `F<n>` numbering in `## MCP Findings` from
branching across phases.

**Three projections.** Every task exists exactly three times: a range line in
`## Phase Index`, a checkbox in `## Checklist`, and a `## Task N.M:` section in exactly one
phase file. They have to agree because each answers a different question — which files
belong to the bundle, what is done, and what the task actually is. A checkbox without a
section is a task nobody specified; a section nobody links to is work nobody tracks.
Neither is a warning: an inconsistent bundle blocks its consumers, because the committed
specification is incomplete.

**How the consumers read it** — reading depth is per consumer, not one rule:

| Consumer | Reads |
|----------|-------|
| `/unikit-implement` | the manifest plus the phase file of the active task |
| `/unikit-verify` | the manifest plus every phase file |
| `/unikit-improve` | the manifest plus every phase file |
| `/unikit-commit` | the manifest plus the phase files of the current commit group |
| `unikit-implement-coordinator` | the manifest plus the phase files of the phases it dispatches in the current layer |

That table has one owner — `.unikit/system/ultra-plan-read.md` — and where the two
disagree, the contract is right and this page is stale.

The full rules — detection, mutability, the blocking integrity checks and the commit-group
mapping — live in `.unikit/system/ultra-plan-read.md`, installed into every project. The
producer side (the manifest and phase templates, the **Required Detail Gate** every task
must clear, the **nine Integrity Checks** run before the plan is shown) lives in the
`unikit-plan` skill's `references/ULTRA-PLAN-FORMAT.md`. Neither is restated here. Two of
the nine are worth knowing by name because they catch what the three projections cannot: no
`phase-*.md` may carry a task checkbox, and the task ranges in `## Commit Plan` must agree
with `## Phase Index` and `## Checklist`.

**What the bundle does not change.** Plan discovery is untouched, and so is
`/unikit-plan --list`. The flat fast plan `.unikit/code/PLAN.md` and `.unikit/code/FIX_PLAN.md`
are never bundles — a fix plan is architecturally a flat file and stays outside the model.
The design axis (`/unikit-gd-*` and `.unikit/gamedesign/`) has no ultra mode at all.
`/unikit-review` is not a consumer either: it is diff/PR-scoped and reads no plan, so a
broken bundle passes review in silence and only `/unikit-verify` blocks on it.

## Editor tasks

Most tasks change source files. Some change the **serialized state of the engine editor** — a scene, a prefab, a UI document, a material, an animation clip, a project setting. Those cannot be expressed as a file edit, so they get an `Editor:` line in addition to (or instead of) `Files:`:

```
Editor: [kind] <container> → <target> : <action>
```

`kind` is one of six: `scene` · `ui` · `vfx` · `anim` · `asset` · `settings` (default `scene`). One line per target; the field is omitted for pure code tasks. Input is not a kind of its own — an input-map asset is an `asset`, a legacy input axis is `settings`, and the handling code stays in `Files:`.

The naming of `<container>` and `<target>` is engine-specific and comes from the planning vocabulary described below — which is also where the `<content-root>`, `<ext>` and code-fence placeholders in the templates resolve.

### The setting

| Setting | Written by | Read by |
|---------|-----------|---------|
| `Editor tasks: mcp \| manual \| direct` | `/unikit-plan` | `/unikit-implement` |

`Editor tasks` decides how the editor work is actually carried out:

- **`mcp`** — through the engine MCP server. Chosen **silently** when an engine MCP is configured; you are not asked.
- **`manual`** — nothing is touched. The task is marked `⏸️ MANUAL` and you get the exact instruction in `[kind] container → target : action` form. `/unikit-verify` reports these but never treats them as blockers.
- **`direct`** — the serialized file is edited as text. Offered **only** where the engine's format tolerates it, and `/unikit-implement` always commits to git first. On Unreal Engine 5 the format tolerates it nowhere except `Config/Default*.ini` — every level and asset is binary — so `direct` is effectively an `.ini`-only route there.

  `/unikit-implement` reads the feasibility ratings out of §6 of the **`/unikit-plan` skill's** installed `ENGINE_RULES.md`, since it has no engine template of its own. If that file is not there — you installed a subset of skills without `/unikit-plan`, or a future engine's slot has no template written for it yet — the gate **fails closed**: every format is treated as 🔴, `direct` is refused, and the task goes back to `manual` with the reason stated. This is the one place an absent file removes a right rather than leaving it untouched, and deliberately so: what is missing is permission for an irreversible text edit of a possibly-binary format, not a rule that would grant a capability. The `mcp` route is unaffected.

When no engine MCP is configured, `/unikit-plan` asks which of `manual` / `direct` you want.

### What `mcp` does not promise

`Editor tasks: mcp` says the work goes **through** the engine MCP server. It does not promise that every target succeeds, and this file deliberately carries no table of which server can do what: such a table is a claim about six moving servers, and it was measured wrong in every row of its own predecessor within four weeks.

What holds instead:

- The candidate affordances come from the **live catalog**, asked per task — never from a stored list of names, and never from memory.
- A rules tree, where the selected server has one, adds **checks** on top of that: what to confirm, by area. It never removes a right. Its absence means no known exceptions, not no capabilities — see [Engine-MCP rules tree](configuration.md#engine-mcp-rules-tree).
- `⏸️ MANUAL` is reached by **trying and finding no route**, with the evidence of that absence to show. Never by an absent rules file, never by an absent table row.

### `<ENGINE>_RULES.md` — the planning vocabulary

Each engine can ship a planning vocabulary that `/unikit-plan` loads at bootstrap:

- **Source:** `data/engine-templates/skills/unikit-plan/<ENGINE>_RULES.md`
- **Installed to:** `<agent-skills-dir>/unikit-plan/references/ENGINE_RULES.md`

It carries six sections: kind → engine concept, language & layout placeholders, when a change counts as editor state, engine planning pitfalls, the scope boundary, and direct-edit feasibility. Six on every engine — the pitfalls section fills up as rules are validated against a real project, so on the newer engines it is a placeholder rather than a gap in the structure.

The boundary against the rules registry is exact: **the registry says HOW to write code for the engine; this file says HOW to write a plan for it.**

**Coverage — all four engines:**

| Engine | Vocabulary | Notes |
|--------|-----------|-------|
| Unity | ✅ | including seven validated §4 pitfalls |
| Godot 4 | ✅ | §4 is a stub (`pending real-project validation`) |
| Godot 4 .NET | ✅ | §4 is a stub; §2 differs from Godot (C# sources, `.csproj`) |
| Unreal Engine 5 | ✅ | §4 is a stub; §6 rates every level and asset 🔴, so `direct` is offered for `settings` targets in `.ini` only |

This table is about **the vocabularies this project writes**, not about what an engine MCP server can do — that distinction is the whole reason [What `mcp` does not promise](#what-mcp-does-not-promise) above refuses to carry a per-server capability table, and it is what keeps this one from turning into that one.

**If a future engine gets a slot before its vocabulary is written**, the degradation is normal, not an error: `/unikit-plan` generates no `Editor:` fields at all, omits the `Editor tasks` setting, and tells you so at confirmation — `Engine rules: ENGINE_RULES.md not found, Editor: fields skipped`.

## Plan Discovery

`/unikit-implement` finds plans in this order:
1. **Fast plan** → `.unikit/code/PLAN.md` (if exists, used directly)
2. **Git branch match** → from branch `<prefix><name>`, every folder matching one of the three name formats that coexist on disk: exactly `<name>`, ending in `_<name>` (the `YYYY-MM-DD_` era), or ending in `-<name>` after three digits (the older `DDD-` era). More than one match is a question, never a silent pick
3. **Latest** → the folder whose manifest carries the newest `Updated:`; ties break on `Created:`. A manifest carrying neither is excluded and named in a `WARN [plan]` line rather than guessed at from the folder name or the file's mtime. Reaching this step at all means the branch named no plan, so *latest* is a guess rather than a resolution: with two or more plans present the candidates are printed and the choice is put to the user, never auto-selected. With exactly one plan there is nothing to choose between — it is announced with the branch miss named, and work continues
4. **Fix plan fallback** → `.unikit/code/FIX_PLAN.md` → redirects to `/unikit-fix`

If both `.unikit/code/PLAN.md` and a matching folder plan exist, the user is asked which one to use.

Whichever branch of that order resolves, the plan is **named before any other output** — a single
`INFO [plan] resolved: <path> (<reason>)` line, where the reason is the branch of discovery that
produced it (`explicit path`, `feature name`, `fast plan`, `fix plan`, `branch match: <branch>` or
`latest fallback`). The same contract holds for `/unikit-improve`, `/unikit-verify` and
`/unikit-plan add`. Silence here is what allowed a resolver to work on the plan of a different
feature without ever saying so.

Discovery is unchanged for bundles. A directory listing cannot tell a bundle from a full plan — the marker in `PLAN.md` can, and that is the only supported way to ask.

## Artifact Ownership

To avoid ownership conflicts, artifact writers are command-scoped:

| Artifact | Primary owner | Notes |
|----------|--------------|-------|
| `.unikit/code/PLAN.md` | `/unikit-plan` | Fast-mode plan (temporary, single file) |
| `.unikit/DESCRIPTION.md` | `/unikit` | Project specification |
| `.unikit/ARCHITECTURE.md` | `/unikit-architecture` | Architecture guidelines |
| `.unikit/ROADMAP.md` | `/unikit-roadmap` | Milestone tracking |
| `.unikit/RULES.md` | `/unikit-rules` | Convention source of truth |
| `.unikit/code/plans/*/PLAN.md` + `phase-NN-*.md` | `/unikit-plan` | Folder-plan manifest; `/unikit-improve` refines existing. Phase files are written by `/unikit-plan ultra` and `/unikit-improve` — never by an executor |
| `.unikit/code/FIX_PLAN.md` | `/unikit-fix` | Bug-fix analysis and steps |
| `.unikit/code/patches/*.md` | `/unikit-fix` | Self-improvement patches |
| `.unikit/skill-context/*` | `/unikit-evolve` | Project-specific skill overrides |
| `.unikit/evolutions/*` | `/unikit-evolve` | Evolution logs + patch cursor |

Quality commands (`/unikit-commit`, `/unikit-review`, `/unikit-verify`) treat these files as read-only context by default.

## Self-Improvement Patches

UniKit AI has a built-in learning loop. Every bug fix creates a **patch** - a structured knowledge artifact that helps AI avoid the same mistakes in the future.

```
/unikit-fix → finds bug → fixes it → creates patch → /unikit-evolve distills patches into rules → smarter future runs
```

**How it works:**

1. `/unikit-fix` fixes a bug and creates a patch file in `.unikit/code/patches/YYYY-MM-DD-HH.mm.md`
2. Each patch documents: **Problem**, **Root Cause**, **Solution**, **Prevention**, and **Tags**
3. `/unikit-evolve` reads patches incrementally using `.unikit/evolutions/patch-cursor.json`
4. Evolve classifies patches and writes rules to `RULES.md` or `skill-context/`

**Example patch** (`.unikit/code/patches/2026-03-15-14.30.md`) — a real artifact from a Unity project, so the paths and package names below are that project's, not a template to copy:

```markdown
# NullReferenceException in CustomerItemView.OnInit

**Date:** 2026-03-15 14:30
**Files:** Assets/Game/Scripts/Gameplay/View/CustomerItemView.cs
**Severity:** medium

## Problem
NullReferenceException when DiResolver.Resolve<IItemService>() returns null in NodeCanvas OnInit.

## Root Cause
DiResolver.Resolve() can return null for mandatory dependencies - no null check in OnInit.

## Solution
Added null check with throw: `if (service == null) throw new InvalidOperationException(...)`.

## Prevention
- Always throw exception when DiResolver.Resolve returns null for mandatory dependencies in NodeCanvas OnInit
- Check all ActionTask/ConditionTask OnInit methods for unguarded Resolve calls

## Tags
`#null-check` `#node-canvas` `#di-resolve` `#mandatory-dependency`
```

The more you use `/unikit-fix`, the smarter AI becomes on your project.

## Skill-Context Overrides

Built-in `unikit-*` skills get overwritten on `unikit-ai update`. To keep project-specific rules stable, `/unikit-evolve` writes them to:

```
.unikit/skill-context/<skill-name>/SKILL.md
```

These files:
- **Survive updates** - live in your project, not in the package
- **Have higher priority** than base SKILL.md rules
- **Are cumulative** - each `/unikit-evolve` run adds, updates, or removes rules

## Skill Interconnections

Plan files are the shared state between exploration, planning, implementation, and bug-fix skills. Here is how they hand off context to each other:

```
     Main flow                            Fix flow

  ┌──────────────────┐
  │  /unikit-explore  │
  └────────┬─────────┘
           │
           ▼
    .unikit/code/researches/
           │
           ▼
  ┌──────────────────┐
  │   /unikit-plan    │
  └────────┬─────────┘
           │                          ┌──────────────────┐
           ▼                          │   /unikit-fix    │
  .unikit/code/plans/                      └────────┬─────────┘
  .unikit/code/PLAN.md                              │
           │                                   ▼
           ▼                            .unikit/code/patches/
  ┌──────────────────┐                         │
  │ /unikit-implement │                        ▼
  └────────┬─────────┘                ┌──────────────────┐
           │                          │  /unikit-evolve  │
           ▼                          └──────────────────┘
       PLAN.md [x]
```

### /unikit-explore → /unikit-plan

Explore saves a research to `.unikit/code/researches/<slug>/` as a single `RESEARCH.md` manifest, plus `SOURCE.md` for prompt-based explorations and, in ultra, whichever adaptive artifacts the subject actually needed. The manifest's `## Active Summary` — the region between its two markers — is the declared input for planning; the rest of the file is evidence and an append-only session log. When planning begins, `/unikit-plan` reads `researches/INDEX.md` and offers to link relevant researches. If linked, the plan uses that summary as a starting point for its own `## Technical Context` - verifying and extending it against the current codebase state. The plan references linked research via a `## Based on` section.

Each `## Based on` entry records a **`Summary SHA256`** — the SHA256 of the bytes between the `## Active Summary` markers as they stood at linking time, computed over normalized text (extracted between the markers, BOM stripped, LF endings, trailing spaces trimmed, exactly one final newline, nothing reformatted). Only that region is hashed: the header's `Updated:` moves on every session and `## Sessions` grows on every save, so hashing the whole file would report drift on every append that changed no requirement. `/unikit-improve`, `/unikit-implement` and `/unikit-verify` recompute the hash and report a mismatch as `WARN [research-drift]`. An entry with **no** `Summary SHA256` means drift is *unknown*, not absent — either the plan predates the field, or it carries a `Brief SHA256` recorded against the retired brief field, which describes a different object and is never recomputed against the summary. `/unikit-improve` records one when you accept the re-link it offers, and that is the only way the state clears — no migration backfills it and no consumer writes it while merely reading. Drift never blocks: work continues against the plan, which is the authoritative snapshot, and a rebase onto the newer research happens only when the user asks `/unikit-improve` for one.

**What `unikit-ai update` does to an old research folder.** It renames `RESEARCH_RESULT.md` to
`RESEARCH.md` and `RESEARCH_SOURCE.md` to `SOURCE.md`, normalizes the header, and seeds an
`## Active Summary` carrying `Topic:` and nothing else. **`RESEARCH_BRIEF.md` is left exactly where it
is, byte for byte** — it is not read, not split across the new artifacts, and not deleted. The manifest
carries a banner saying so, and the content is yours to carry over by hand or to rewrite on the next
`/unikit-explore` session; delete the brief yourself once you have.

That is deliberate, and it replaces an earlier behaviour that was not. The migration used to take the
brief apart by matching section headings against a fixed English list — while the skill that wrote those
briefs required their headings to be translated whenever `language.artifacts` was not English. In a
non-English project not one heading matched, nothing was carried across, and the brief was deleted all
the same. A document this step cannot parse safely is not a document for it to delete.

**Run `/unikit-explore` once before planning after the upgrade.** The migration does not touch
`researches/INDEX.md` either, because that file is generated — it is rebuilt from the folders on every
save. Until the first save the index still carries pre-2.0.0 rows, which have no `Updated:` field, so
`/unikit-plan` excludes every one of them and says so per row: `WARN [research] <folder>: index row has
no Updated — excluded; run /unikit-explore to redraw the index`. Nothing is lost and nothing fails
silently; one `/unikit-explore` save regenerates the index whole and the researches become visible to
planning again.

### Why a plan folder has no date and a patch file does

`plans/customers-system/` sits next to `patches/2026-03-09-14.30.md`, and the difference is not an inconsistency. A date in a **name** is allowed exactly when the artifact is an entry in an event log: nobody returns to a single entry, the stream is read in order, and `/unikit-evolve` additionally stores the name of the last patch it processed and compares names as strings — so lexicographic order of names *is* the mechanism there. Plans, researches and concepts are the opposite: you come back to them, you address them by what they are about, and a date in the name only gets in the way of that. The date did not disappear from them — it moved inside, into the `Created:` and `Updated:` fields of the artifact itself.

The rule is about the **class** of artifact, not a list of exceptions: a list would be wrong the first time a new artifact is added.

### /unikit-plan → /unikit-implement

Plan creates one manifest — `.unikit/code/PLAN.md` for a fast plan, `.unikit/code/plans/<folder>/PLAN.md` for a folder plan — carrying the checklist and `## Technical Context` in the same file. Implement discovers plans via the [Plan Discovery](#plan-discovery) priority order, reads the checklist for task ordering and the technical context alongside it, Bootstraps rules + engine principles once, then executes tasks sequentially inline (`Read/Edit/Write/Bash`). Parallel phases and deep-dive tasks are offloaded to the `develop-agent` alias. After each task, implement marks `- [x]` in the plan file. After phase completion: compilation check (engine MCP), optional tests, commit checkpoint.

In an [ultra bundle](#ultra-bundle--a-manifest-plus-one-file-per-phase) the depths differ per consumer: implement reads the manifest plus the phase file of the **active task**; verify and improve read the manifest plus **every** phase file; commit reads the manifest plus the phase files of the current commit group; and `unikit-implement-coordinator` — the parallel execution path, a separate entry point that does its own detection — reads the manifest plus the phase files of the phases it dispatches in the current layer. The full table lives in `.unikit/system/ultra-plan-read.md`.

### /unikit-fix ↔ /unikit-implement

If implement finds `FIX_PLAN.md` but no feature plan, it redirects to `/unikit-fix` for execution. Fix can create `FIX_PLAN.md` (plan-first mode) for later execution via either `/unikit-fix` (without arguments) or `/unikit-implement` (which detects and redirects). Both skills Bootstrap rules and engine principles once, then write code inline; they spawn `develop-agent` only for complex multi-file or deep-dive work.

### /unikit-fix → /unikit-evolve

Every fix creates a mandatory patch in `.unikit/code/patches/`. Evolve reads patches incrementally (via `patch-cursor.json`) and distills prevention rules: code/architecture rules go to `RULES.md`, skill workflow issues go to `.unikit/skill-context/`. These improved rules make future runs of `/unikit-fix`, `/unikit-implement`, and `/unikit-plan` smarter - closing the learning loop.

### /unikit-explore → /unikit-fix

If explore discovers a bug or broken behavior during investigation, it routes the finding to `/unikit-fix` via the insight routing table in the research's `## Next Steps` section. This enables a natural transition from "I found something broken" to "let me fix it properly".

## See Also

- [Development Workflow](workflow.md) - how plan files fit into the development loop
- [Skills Reference](skills.md) - full reference for `/unikit-fix`, `/unikit-evolve`, and other skills
- [Memory & Skill Evolution](evolve.md) - detailed evolve workflow and stale rule cleanup
