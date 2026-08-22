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

Placement: Fast → `.unikit/code/PLAN.md`; Full → `.unikit/code/plans/<folder>/PLAN.md`.

```markdown
# {Feature Name} — Tasks

## Overview
What is being built, why, and what goal it serves. 3-5 sentences maximum.
Answer: WHAT is done, WHY it is needed, WHAT GOAL it pursues.

## Based on
(Optional) Use Research Reference Format from the main skill file to link researches.

If no research — technical context is in the `## Technical Context` section below.

## Settings
- Testing: yes/no
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

### Fast mode differences

- Title: `# {Feature Name} — Plan` (instead of `— Tasks`)
- Settings: no `Docs` line
