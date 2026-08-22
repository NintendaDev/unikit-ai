# unikit-plan — Ultra Bundle Format

`mode-ultra.md` reads this file **completely** before choosing the phase structure. It
specifies **what to write**: the mode marker, the manifest template, the phase file
template, the per-task detail floor, the write order, and the integrity checks a bundle
must pass before it is shown to the user.

Reading a bundle is specified elsewhere — `.unikit/system/ultra-plan-read.md`, a system
asset shared by `/unikit-implement`, `/unikit-verify`, `/unikit-improve` and
`/unikit-commit`. Do not restate consumer behaviour here: a restated contract drifts, and
the original this format was ported from is the measured proof of it.

Ultra is strictly **additive** to the plan shape declared in `TASK-FORMAT.md` — the same
plan folder, the same entry point, the same section order — plus `## Phase Index`,
`## Cross-Phase Dependencies` and the phase files. Every rule in `TASK-FORMAT.md` still
holds unless a rule below names the difference.

**The price of editing this file.** It lives in `references/` and is therefore
hash-tracked: any edit re-installs the whole `unikit-plan` skill on the next
`unikit-ai update`. That is the accepted cost of keeping the specification next to its
only reader — do not split or relocate it to make edits cheaper.

## Bundle Layout

```text
.unikit/code/plans/{YYYY-MM-DD}_{feature-name}/
├── PLAN.md                 ← the manifest (same name as a full plan)
├── phase-01-<slug>.md
├── phase-02-<slug>.md
└── phase-NN-<slug>.md
```

- **The bundle reuses the full-mode folder and the full-mode entry point.** Going from
  full to ultra is additive: phase files and `## Phase Index` are added, nothing is
  renamed and nothing moves.
- **Only the manifest plus direct child `phase-*.md` files.** There are no nested phase
  directories.
- **Zero-padded phase numbers**, so lexical order and execution order agree.
- **The mode is never determined by listing the folder.** A consumer must read
  `.unikit/code/plans/<folder>/PLAN.md` and check the marker. This is parity with the
  format ultra was ported from, not a regression: a `phase-01-*.md` in the listing is a
  sufficient signal for a human, and is not a contract for a machine.

## Mode Marker

Written exactly like this — the line is quoted verbatim by the reader contract and by the
bundle contract test:

```
<!-- unikit:plan-mode:ultra -->
```

Rules:

- present **exactly once**, and as the **first line** of the plan folder's manifest;
- **never localized**, not even under `language.artifacts: ru`;
- the `unikit:` namespace follows the HTML-comment marker precedent already used by this
  repository's `SKILL.md` files — it is not copied from the format ultra was ported from;
- declared **here and nowhere else**. `mode-ultra.md`, the reader contract and the contract
  test cite this line; none of them redefines it.

## Sources of Truth

- `.unikit/code/plans/<folder>/PLAN.md` is the manifest: the scope anchor and the **only
  progress source**.
- Task checkboxes exist **only** in the manifest. A phase file contains no `- [ ]` at all.
- The ordered links under `## Phase Index` define which files belong to the bundle. A
  `phase-*.md` that is not linked is an **orphan**, and an orphan blocks — it is never
  silently ignored.
- Every task exists in exactly **three consistent projections**: a range line in
  `## Phase Index`, a checkbox in `## Checklist`, and a `## Task N.M:` section in exactly
  one phase file.
- **Everything mutable during execution lives in the manifest**: checkboxes,
  `## MCP Findings`, `## Commit Plan`, `## Settings`. Phase files are **read-only during
  execution**. The consequence has to be stated, because it is what the split buys: the
  executor has one write surface, `F<n>` numbering in the findings table never branches
  across phases, and the `/unikit-mcp-trap` window stays single-file (`plans/*/PLAN.md`).

## Manifest Template

Placement: `.unikit/code/plans/<folder>/PLAN.md` — the same path a full plan uses. The
section order below is the `TASK-FORMAT.md` order plus two new sections; it is a contract,
not layout.

```markdown
<!-- unikit:plan-mode:ultra -->
# {Feature Name} — Tasks

## Overview
## Based on
## Design            (only when design_linked = true)
## Flow Context      (optional)
## Content Context   (optional)
## Settings
## Roadmap Linkage   (optional)

## Architecture and Decisions   (optional)
- [A cross-phase boundary, contract or decision — and why this one was chosen]

## Phase Index
1. [Phase 1: {name}](phase-01-{slug}.md) — Tasks 1.1-1.2
2. [Phase 2: {name}](phase-02-{slug}.md) — Tasks 2.1-2.2

## Cross-Phase Dependencies
- Task 2.1 depends on Tasks 1.1 and 1.2 because …

## Checklist
### Phase 1: {name}
**Effort:** M
**Dependencies:** None
**Status:** [ ] Not started

- [ ] Task 1.1 — {deliverable} ([details](phase-01-{slug}.md#task-11-deliverable))
  WHY: …
  Files: `…`
- [ ] Task 1.2 — {deliverable} ([details](phase-01-{slug}.md#task-12-deliverable))
  WHY: …
  Files: `…`

### Phase 2: {name}
**Effort:** S
**Dependencies:** Phase 1
**Status:** [ ] Not started

- [ ] Task 2.1 — {deliverable} ([details](phase-02-{slug}.md#task-21-deliverable))
  WHY: …
  Files: `…`
- [ ] Task 2.2 — {deliverable} ([details](phase-02-{slug}.md#task-22-deliverable))
  WHY: …
  Files: `…`

## Commit Plan
## MCP Findings
## Dependency Graph
## Total Estimated Effort

---

## Technical Context
### CONTEXT
### CONSTRAINTS
### DEPENDENCY GRAPH
### OUT OF SCOPE

## Open Questions        (optional; BLOCKING questions make the plan not implementation-ready)
```

Rules:

- **Task IDs are `N.M`**, exactly as in full mode. This format introduces no second
  numbering scheme. The link anchor is the GitHub-style slug of the phase file's task
  heading (`## Task 1.1: Foo` → `#task-11-foo`).
- The checkbox line stays short and **must** carry its `([details](…))` link. `WHY:` and
  `Files:` are kept from the base format, unchanged.
- **`## Architecture and Decisions` holds decisions that bind two or more phases** — a module
  boundary, a shared contract, a chosen trade-off. A decision internal to one phase belongs in
  that task's `### Required Interfaces and Contracts` and is not lifted here. The section is
  **optional** and is omitted entirely when there are no such decisions: a mandatory empty
  section is an invitation to fill it for form's sake, which the Required Detail Gate forbids.
- **The example above is deliberately complete, not elided.** Two phases with two tasks each is
  the smallest example in which the three projections of the task set can disagree, and the
  bundle contract test validates the template itself: the `## Phase Index` ranges, the checklist
  checkboxes and the phase numbers inside the `([details](…))` links must cover exactly the same
  task IDs. Shortening the example by dropping a checkbox breaks the test — which is the point:
  a template that contradicts itself teaches the contradiction.
- **`## Technical Context` shrinks to its cross-phase part** in ultra: `CONTEXT`,
  `CONSTRAINTS`, `DEPENDENCY GRAPH`, `OUT OF SCOPE`. The task-scoped subsections —
  `INTERFACES`, `KEY PATTERNS`, `FILES`, `EDITOR TARGETS`, `DI BINDINGS` — are distributed
  into the phase files. There is one rule, and it decides every case:
  **cross-phase goes in the manifest, task-scoped goes in the phase.**
- **`## MCP Findings` stays at `##` level and above `## Technical Context`**, for the same
  reason as in the base format: `/unikit-mcp-trap` reads the heading down to the next `##`,
  and a technical context that drifted above the findings would silently widen that window
  onto prose.
- **`## Open Questions` is where a blocking question goes.** If a choice genuinely cannot
  be made during planning, it is recorded here and the plan is declared **not
  implementation-ready** — instead of hiding the gap behind a vague phrase.

## Phase File Template

```markdown
# Phase {N}: {Name}

Plan: [PLAN.md](PLAN.md)
Tasks: {N}.1-{N}.M
Depends on: none | Phase {K}

## Objective
[The observable outcome this phase must produce.]

## Current-Code Evidence

| Path | Symbols / lines | Why it matters |
|------|-----------------|----------------|
| `{path}` | `{Class.method}` / lines {A}-{B} | [Existing pattern, integration point or contradiction this phase acts on] |

## Files in This Phase

| Path | Action | Required change |
|------|--------|-----------------|
| `{path}` | create / modify / delete | [Exact responsibility — not "update the file"] |

## Task {N}.{M}: {Deliverable}

### Intent
[Why this task exists and what later work depends on it.]

### Implementation Steps
1. [Concrete edit in a named file and symbol.]
2. [Exact control and data flow.]
3. [Integration or migration step.]

### Required Interfaces and Contracts
- Types, signatures, schemas, events, environment variables or config.
- Compatibility requirements and invariants.
- Concise pseudocode **when prose leaves meaningful ambiguity** — never a pasted source file.

### Error Handling and Logging
- Failure modes and the expected behaviour of each.
- Log events and levels, the safe fields, and the fields that must **not** be logged.
- Follow the plan's `Logging:` setting.

### Tests
- When `Testing: yes`: exact cases, fixtures, test files and commands.
- When `Testing: no`: the literal `Not planned by user preference`; no test tasks are added.

### Acceptance Criteria
- [Observable, independently verifiable result.]

### Verification
- `{exact command or manual check}`
- Expected result: [...]

## Phase Risks and Mitigations
- Risk: [what can go wrong in this phase]
  Mitigation: [what makes it not happen, or makes it cheap when it does]

## Phase Completion Checklist
- Every task in this phase satisfies its acceptance criteria.
- The required verification commands pass.
- The manifest's task checkboxes are ticked immediately after verified completion, not at the end of the phase.
```

Rules:

- **A phase file carries no task checkboxes whatsoever** — progress lives only in the
  manifest.
- A phase file is **read-only during execution**. Everything an executor changes is in the
  manifest.
- A task's `### EDITOR TARGETS` rows live here, but the task's own `Editor:` marker stays
  in the manifest checkbox, because that is what Guard B and the executor read.
- `### Tests`: under `Testing: yes` — exact cases, fixtures, test files and commands; under
  `Testing: no` — the literal `Not planned by user preference`, and no test tasks are added.
- `### Verification`: commands `/unikit-verify` **executes** within the grant it already
  holds. Anything outside that grant is printed with the `⏸️ MANUAL` status and reaches
  both the report and the `unikit-gate-result` block — otherwise it is lost in silence.
  Grants are not widened for this: the `⏸️ MANUAL` idiom already exists for editor targets.

## Required Detail Gate

Verify every task against all seven points **before** the bundle is saved:

1. Exact file paths and existing symbols — or an explicit statement that the path or
   symbol is new.
2. Ordered edits, detailed enough to implement without choosing an architecture.
3. Inputs, outputs, contracts, data flow, and the effects on dependencies.
4. Error handling, edge cases, and logging under the plan's selected policy.
5. Tests and commands under `Testing: yes`; an explicit statement of their absence under
   `Testing: no`.
6. Observable acceptance criteria, and verification commands or checks.
7. **No unresolved implementation choice hidden behind words** such as `handle`, `support`,
   `wire up`, `as needed`, `etc.`, "по необходимости", "при необходимости". A decision that
   genuinely cannot be made during planning goes into the manifest's `## Open Questions` as
   a blocking question, and the plan is declared not implementation-ready — the guess is
   never delegated to the implementer.

There is no model layer in this port and there is none in the original: nothing in the code
reads or assigns a model. The strong-plans/weak-executes idea is carried entirely by this
gate — it is a property of the artifact, not of a configuration.

## Write Order

Exactly this order, and the order is part of the contract:

1. Write **all phase files** first.
2. Write the **manifest** last.
3. Run the **integrity checks** below.
4. Only then show the plan to the user.

The manifest goes last because its `## Phase Index`, its task links and its ranges must
agree with phase content that has already stopped moving.

## Editing an Existing Bundle

- The manifest and the affected phase files are edited **together**. **Never regenerate the
  manifest alone** when phase detail changed.
- On reading, the bundle is one unit — the manifest is never read by itself.
- After a write, the integrity checks are **re-run**.
- **`Write` over a plan manifest is forbidden** — use `Edit` only. A `Write` wipes
  `## Phase Index` and `## Technical Context` wholesale.

## Integrity Checks

Each check is **blocking**:

1. The marker is present in the manifest exactly once, and on the first line.
2. Every `## Phase Index` link exists, is relative, and **does not escape the bundle
   directory** (no `../`).
3. Every checklist task maps to exactly one `## Task N.M:` section.
4. Every `## Task N.M:` section in the phase files appears in the checklist exactly once.
5. No `phase-*.md` is missing from `## Phase Index` (no orphans).
6. Dependency references point to task IDs that exist.
7. The `## Phase Index` ranges cover exactly the set of checklist tasks.
8. No `phase-*.md` contains a task checkbox (`- [ ]` or `- [x]`). Progress lives only in the
   manifest; a checkbox in a phase file is a second source of progress, and it diverges from
   the first the moment one of them is ticked.
9. The task ranges in `## Commit Plan` agree with `## Phase Index` and with `## Checklist` —
   every `### Commit N: after tasks X-Y` range is made of task IDs that exist, and the union of
   the ranges stays within the checklist's task set. `/unikit-commit` resolves a commit group by
   taking its range, locating those tasks through `## Phase Index` and reading only the phase
   files that hold them, so a range naming a task nobody has sends it to the wrong files.

The reason, kept in the words the original used: a broken or missing link means **the
committed specification is incomplete** — verify the plan, do not verify it partially.

## What This Format Does Not Change

- **Plan discovery in consumers.** The folder is found exactly as before; ultra adds no
  discovery branch.
- **`--list`.** It enumerates folders and does not look inside them.
- **`/unikit-fix`.** `FIX_PLAN.md` is architecturally a flat file and stays outside the
  bundle model.
- **The design axis (`unikit-gd-*`).** It is not in ultra's scope: it already has
  `GD-IDS.yaml` as its registry and single-owner zones, and a second decomposition model
  would compete with a working one.
