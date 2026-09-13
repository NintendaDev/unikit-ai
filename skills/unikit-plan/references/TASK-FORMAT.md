# Plan File Templates

> **Engine placeholders.** These templates are engine-neutral. Four placeholders resolve from `references/ENGINE_RULES.md` §2 (Language & layout) for the active engine — substitute them when writing the plan, never copy them verbatim:
>
> | Placeholder | Resolves to |
> |-------------|-------------|
> | `<lang>` | the markdown code-fence identifier (§2 "code fence") |
> | `<ext>` | the source-file extension |
> | `<content-root>` | the project's content root path |
> | `{DI binding per ENGINE_RULES.md §2}` | the engine's DI binding form |
>
> When `ENGINE_RULES.md` is absent for the active engine, keep the sections but leave the engine-specific bodies out rather than guessing.

## Naming vocabulary (flat plan vs folder manifest)

Two different files carry the name `PLAN.md`: the flat fast plan and the manifest of a plan folder. The path tells them apart; prose does not. An unqualified mention inside a consumer resolves to "whichever one is nearer", and which one that is depends on which paragraph the reader happened to read first — so the name is never written bare.

- **Flat fast plan** — always written as the full path `.unikit/code/PLAN.md`.
- **Folder plan manifest** — always written as the full path `.unikit/code/plans/<folder>/PLAN.md`, as the glob `plans/*/PLAN.md`, or as the bare-token-free phrase "the plan folder's manifest". The third form carries no backticked name on purpose: a phrase that quotes `PLAN.md` is the very shape the rule below forbids, so sanctioning it here would hand the next author a form the guard rejects.
- **A bare `PLAN.md` token is forbidden** in `skills/**` and `subagents/*`. This section — where the name is declared — is the only exception.

> **This file is the fast/full single-file format.** For an ultra bundle the canonical
> source is `ULTRA-PLAN-FORMAT.md` — it owns the mode marker, the manifest template, the
> phase file template, the per-task detail floor and the integrity checks. Ultra is
> **additive** to what is described here: every rule below still holds in ultra unless the
> bundle specification names the difference.

## Plan Manifest Template

Placement: Fast → `.unikit/code/PLAN.md`; Full → `.unikit/code/plans/<feature-name>/PLAN.md`.

The folder name carries no date. The two header fields below are the only record of when a
plan was created and when it was last revised, and every resolver that picks "the latest
plan" sorts on `Updated:` — so a manifest without them is not merely undated, it is
unfindable by that branch.

`Updated:` moves when the plan's **content** changes — creation, `/unikit-plan add`,
`/unikit-improve`. Ticking a checkbox during `/unikit-implement` does **not** move it:
progress is not a revision, and a plan being executed must not outrank a plan just
written when the resolver picks the latest one.

Both timestamps are `YYYY-MM-DD`, without a time: a plan has no notion of a session, and the
hour a folder was opened decides nothing.

```markdown
# {Feature Name} — Tasks

Created: YYYY-MM-DD
Updated: YYYY-MM-DD

## Overview
What is being built, why, and what goal it serves. 3-5 sentences maximum.
Answer: WHAT is done, WHY it is needed, WHAT GOAL it pursues.

## Based on
(Optional) Use Research Reference Format from the main skill file to link researches.

If no research — technical context is in the `## Technical Context` section below.

## Settings
- Testing: yes/no
- Test checkpoints: task | phase | plan
- Docs: yes/no (full mode only)
- Editor tasks: mcp | manual | direct

## Roadmap Linkage (optional)
Milestone: "[milestone name]" | "none"
Rationale: [1 short sentence]

## Checklist

Tasks are ordered by dependencies. Each phase includes effort estimate and dependency list.

> **Commit-checkpoint markers (decorative).** For plans with a `## Commit Plan` (5+ tasks), insert one `<!-- Commit checkpoint: tasks X-Y -->` HTML comment at each commit boundary — right after the last task of that commit's range. The `X-Y` range MUST mirror the matching `### Commit N: after tasks X-Y` heading in the `## Commit Plan` below (single source of truth — derive the marker from the Commit Plan, never the other way round). These markers are **decorative only**: they document where a commit naturally falls. `/unikit-implement` does **not** parse them and they never alter its behavior.

### Phase 1: {Phase Name}
**Effort:** S / M / L / XL (S = hours, M = 1-2 days, L = 3-5 days, XL = 1+ week)
**Dependencies:** None (first phase) | Phase N, Phase M
**Status:** [ ] Not started

- [ ] Task 1.1 — brief description of what to do
  WHY: one-line reason why this task is needed in the context of the feature
  Files: `path/to/file.<ext>`
- [ ] Task 1.2 — brief description
  WHY: reason
  Files: `path/to/file1.<ext>`, `path/to/file2.<ext>`
  Editor: [ui] <container> → <target> : <action>
<!-- Commit checkpoint: tasks 1.1-1.6 -->

### Phase 2: {Phase Name}
**Effort:** M
**Dependencies:** Phase 1
**Status:** [ ] Not started

- [ ] Task 2.1 — brief description
  WHY: reason
  Files: `path/to/file.<ext>`
<!-- Commit checkpoint: tasks 2.1-2.4 -->

...

### Phase N: {Phase Name}
**Effort:** L
**Dependencies:** Phase 2, Phase 3
**Status:** [ ] Not started

- [ ] Task N.1 — brief description
  WHY: reason

## Commit Plan

(Only for plans with 5+ tasks total)

Each `### Commit N: after tasks X-Y` heading is the single source of truth for the decorative `<!-- Commit checkpoint: tasks X-Y -->` markers placed in the `## Checklist` above — keep the ranges in sync (Checklist marker derives from the heading here).

### Commit 1: after tasks 1.1-1.6
feat(<module>): <description>

### Commit 2: after tasks 2.1-2.4
feat(<module>): <description>

...

## MCP Findings

(Only when the plan carries at least one `Editor:` task. The planner emits the heading and
the header row and stops there; the executor appends a row when an engine MCP call misled it.)

| id | area | confirm that | observed | evidence | from |
|---|---|---|---|---|---|
| F1 | rollback | the snapshot captured more than zero files | 2026-08-18 | `<call>(paths="...")` → `state=ready files=0` | task 2.3 |

## Rule Candidates

(Always emitted by the planner — the heading and the header row. The executor appends a row
the moment a candidate is noticed.)

| id | rule | full formulation | from | status |
|---|---|---|---|---|
| R1 | Never resolve a DI type without a null guard | ...the long version, with its rationale... | task 2.3 | open |

## Test Runs

(Only when `Testing: yes`. The planner emits the heading; everything under it is written by
the executor.)

- 2026-09-12 · phases 1-2 · 4 test suites · passed 128/128 · tree-sha256 `a1b2c3d4…`
- 2026-09-12 · plan · all tests · passed 3363/3363 · tree-sha256 `e5f6a7b8…`

Full run: 2026-09-12 · all tests · passed 3363/3363 · tree-sha256 `e5f6a7b8…`

## Dependency Graph

Phase 1 → Phase 2 → Phase 4
Phase 1 → Phase 3 → Phase 4
              ↘ Phase 5

## Total Estimated Effort
Sum of all phases: ~X days

---

## Technical Context

### CONTEXT
Project: {{engine_name}} / {stack from `.unikit/DESCRIPTION.md`}
Feature: {brief description}
Scope: {list of key components/modules affected}
Stop condition: {what is explicitly NOT implemented in this plan}

### CONSTRAINTS
- MUST: {constraint with rationale}
- MUST: {constraint with rationale}
- FORBIDDEN: {anti-pattern with rationale}
- FORBIDDEN: {anti-pattern with rationale}

### INTERFACES

#### {InterfaceName} [NEW | MODIFY]
​```<lang>
// Namespace
public interface IExample
{
    // Key methods with signatures
}
​```

### KEY PATTERNS

#### {Pattern Name}
​```<lang>
// Code example showing the pattern in context
​```

### DEPENDENCY GRAPH

ComponentA
  <- IDependency (ctor inject)
  <- IOtherDependency (ctor inject)

ComponentB
  <- ComponentA (ctor inject)

### FILES

#### CREATE
| Path | Type | Notes |
|------|------|-------|
| `<content-root>/...` | interface | description |

#### MODIFY
| Path | Change |
|------|--------|
| `<content-root>/...` | what to change |

### EDITOR TARGETS
| Kind | Container | Target | Change |
|------|-----------|--------|--------|

### DI BINDINGS
​```<lang>
{DI binding per ENGINE_RULES.md §2} — one line per installer binding
​```

### OUT OF SCOPE
- What is explicitly NOT part of this plan

## Open Questions
(Optional) Uncertainties the planning pass could not close. One line each.
Placed last, **after** `## Technical Context`, so it never falls inside the
`## MCP Findings` window (which runs from that heading to the next `##`).
```

> **`Test checkpoints:` is omitted entirely when `Testing: no`** — there are no runs, so there is nowhere to place them. When `Testing: yes` the line is mandatory: a plan without it is legacy, and its executor is left inferring run placement from the prose of the tasks.

### Editor task grammar

Some tasks change the engine editor's **serialized state** (scenes, UI, VFX, animation, assets, input maps, project settings) rather than source files. Such a task carries one or more `Editor:` lines:

```
Editor: [kind] <container> → <target> : <action>
kind ∈ scene | ui | vfx | anim | asset | settings   (default: scene)
```

Rules:

- **One line per target** — repeat the field when a task touches several targets.
- The field goes **after** `Files:`.
- Naming of `<container>` and `<target>` is engine-specific — see `references/ENGINE_RULES.md` (§1 kind → concept, §2 language & layout).
- **Pure code tasks omit the field entirely.** Editing a plain text or config file stays in `Files:`.
- When `references/ENGINE_RULES.md` is absent for the active engine, the field is **not generated at all** — the plan degrades to code-only tasks and `## Settings` carries no `Editor tasks` line.
- **A phase carrying an `Editor:` line is serialized alone in its execution layer.** The unit of parallelism downstream is the **phase** — the coordinator runs every phase of one layer concurrently and the tasks inside a phase in order — so the `**Dependencies:**` lines of an editor-bearing phase must leave it as the only member of its layer. This is not a rule about tasks: two `Editor:` tasks in one phase are already sequential, and splitting them into two phases to "separate" them is what creates the collision. The hazard includes plain code phases: a source write triggers a domain reload, and minutes of unavailability land in the middle of another phase's mutation.

  **`## MCP Findings` is written under this invariant, and would need a different scheme without it.** Executors append their rows straight into the plan file, and `unikit-implement-worker` has no worktree isolation — every worker edits the same file. That is safe only because the phase that can produce an MCP finding is alone in its layer, so there is never more than one writer at a time. If the serialization rule is ever relaxed, the append scheme has to be revisited before it is: the fallback is a per-task mailbox (`plans/<plan>/findings/<task>.md`) collected at the end, which costs a directory and a second phase and is why it was not chosen now.

The targets are aggregated into the `### EDITOR TARGETS` table inside `## Technical Context`. It is omitted entirely when the plan carries no `Editor:` task.

### Test checkpoint task grammar

A test run is a **separate task** in `## Checklist`, never a command buried inside another task. Such a task carries one `Test checkpoint:` line:

```
Test checkpoint: <coverage>
coverage ∈ task N.M | phase N | phases N-M | plan
```

Rules:

- **One line per test-checkpoint task**, in the position an ordinary task gives to `Files:`. A test-checkpoint task creates nothing, so it carries `WHY:` and `Test checkpoint:` and **carries no `Files:`** — the only form of task in this format without that line.
- **The width of a run follows from its coverage and is not configurable:** `task N.M` → the fixtures and classes that task names; `phase N` / `phases N-M` → the test suites of the modules those phases touch, plus the suites that depend on them; `plan` → every test in the project.
- **The planner writes no list of suites.** The executor computes the set at run time, from the files actually changed. The planner neither reads nor builds a module graph, so planning time does not grow.
- `task N.M` exists **only in an ultra bundle**: fast and full have no per-task surface to put it on.
- **When `Testing: yes`, the last task of the plan is `Test checkpoint: plan`** — a full run of every test. It has no off switch, and it is never merged away nor deferred.
- A checkpoint goes **where the change is worth one, not into every phase**: `Test checkpoints:` is a ceiling, not an obligation. The criterion: a check is needed when the phase changes executable code, or a contract other modules rely on; it is not needed when executable code is untouched — documentation, assets and their service files, data no test covers. What counts as an asset or a service file is engine-specific, and the answer lives where the signals for `Editor:` come from: `references/ENGINE_RULES.md` §3.
- A phase without a check **does not lose its goals**: they pass to the next test-checkpoint task, whose coverage then names both phases (`Test checkpoint: phases 1-2`), and the phase text says so in one line.
- **Repeats are forbidden:** the phase completion checklist does not restate the run, and a test-checkpoint task never follows another when nothing changed between them.

### MCP findings section

`## MCP Findings` lives in the manifest at `##` level, next to `## Commit Plan` and **above** `## Technical Context`. `/unikit-mcp-trap` reads the heading down to the next `##`; a findings table demoted to `###`, or placed inside `## Technical Context`, is invisible to it.

An executor that hits a misleading engine MCP response records it **here, in the plan, and nowhere else**. It does not edit `.unikit/MCP-RECHECK-NOTES.md` itself: one observation is a bad sample and a bad line lives for months, so the durable surface passes through a human running `/unikit-mcp-trap`.

| column | what goes in it |
|--------|-----------------|
| `id` | `F<n>`, allocated in order within this plan and never reused. `/unikit-mcp-trap` records it as `from: <plan>#<id>`, which is how a repeat pass knows the row was already transferred |
| `area` | one of the 12 words in `.unikit/system/dev-principles.md` -> A8. The key is an **area**, never a tool name — that is what keeps the row reachable after the server changes. Anything server-specific goes into the text of the check |
| `confirm that` | the check, phrased as an instruction to verify. **Only a check** — never a lifted gate, never "use Y instead of X", never an assertion about what the server can or cannot do |
| `observed` | the date the finding was **observed** (`YYYY-MM-DD`), written by whoever observed it. `/unikit-mcp-trap` copies this column into the notes verbatim rather than dating the transfer, so a row that arrives here undated makes the notes say when it was filed instead of when it happened — and the label then lies about its own contents |
| `evidence` | the raw call and the raw answer it gave. This is the one column where a tool name is legitimate, and the only reason it is here: without the raw call the finding cannot be replayed, retired, or upstreamed |
| `from` | the task that observed it (`task 2.3`) |

Three rows never belong here: a pre-declared `GATE LIFTED`, a list of what the server cannot do, and a named replacement for a call. All three lift an obligation permanently. A check that has gone stale merely costs one extra call and **fails safe** — the pipeline stops instead of driving past.

`/unikit-mcp-trap` reads the section through a window — the heading down to the next `##` heading — and reads nothing else from the plan. Keep the heading at `##`: a findings table demoted to `###`, or nested inside another section, is invisible to it.

The window carries a 30-line cap **only when trap is scanning many plans at once** (called with no arguments). Handed one plan by path — which is what `/unikit-implement` Step 5.5 does — it reads to the next `##` with no cap, because there is one named file and nothing to ration. When the cap does close a window, trap says so and names how many rows it did not read; the table growing past it is a warning, not a silent loss.

### Rule candidates section

`## Rule Candidates` lives in the manifest at `##` level, directly under `## MCP Findings`. The planner emits the heading and the header row in **every** plan: a candidate can arise in any plan, and an executor left to invent a place for the section puts it somewhere new each time. One empty table per plan is the cheaper mistake.

| column | what goes in it |
|--------|-----------------|
| `id` | `R<n>`, allocated in order within this plan and never reused |
| `rule` | the rule **exactly as it will be written into `.unikit/RULES.md`** — one line, one directive |
| `full formulation` | the long version, with its rationale. Nothing constrains the length here — this column is the reason the short form is allowed to stay short |
| `from` | the task that produced the candidate (`task 2.3`) |
| `status` | `open` \| `added` \| `declined` |

- A row is written **the moment the candidate is noticed**, by the same `Edit` that ticks the task's checkbox — never in the closing report: that is the one moment at which the session has most likely already ended.
- `declined` is durable: a candidate the user turned down is **not offered again**, in this run or in a later one.
- `added` is set once `/unikit-rules` has returned the outcome `added` for that rule.
- Nothing in this table reaches `.unikit/RULES.md` by the hand of the skill that wrote the row. Rules are written by `/unikit-rules` alone, and only in the set the user selected.
- **Four writers, and no others:** `/unikit-implement`, `unikit-implement-worker`, `unikit-implement-coordinator` and `/unikit-verify`. All four append the row to the manifest; none of them writes `.unikit/RULES.md`. The safety of a worker writing here rests on the same single-writer invariant that carries `## MCP Findings` — see `### Editor task grammar` above: the phase that can produce a candidate is alone in its execution layer.

### Test runs section

`## Test Runs` lives in the manifest at `##` level, under `## Rule Candidates`, and only when `Testing: yes`. The planner emits the heading; every line under it is written by the executor.

- **One bullet per run, append-only:**
  `<date> · <coverage> · <what ran> · passed N/N · tree-sha256 <hash>`
- **One `Full run:` anchor line**, rewritten in place after each full run, in that same form. This is the machine anchor `/unikit-verify` greps; the bullets are the log for a human. The duplication is deliberate: a verifier made to hunt for "the last bullet whose coverage is `plan`" would depend on the bullet order surviving every future edit.
- `tree-sha256` is the digest of **a short text**, not of the project: the output of `git rev-parse HEAD` followed by the output of `git status --porcelain`, normalized and hashed by the same procedure as the plan's `Summary SHA256`. No project file is read.
- Git unavailable → the run is still recorded, and the field reads `tree-sha256 unavailable`. A verifier that reads that value does not reuse the run.

### Fast mode differences

- Title: `# {Feature Name} — Plan` (instead of `— Tasks`)
- Settings: no `Docs` line
- Settings: the `Test checkpoints:` line is present here too — the only meaningful values are `phase` and `plan`
