# Prototype profile — how a disposable-prototype plan is executed

Read by `/unikit-implement`, `unikit-implement-coordinator`, `unikit-implement-worker`,
`/unikit-verify`, `/unikit-pr`, `/unikit-improve`, `unikit-plan-polisher`, `unikit-plan-coordinator`,
`/unikit-review`, `unikit-review-sidecar`, `unikit-architecture-sidecar`, `/unikit-fix`,
`/unikit-devcontext` and `/unikit-commit`. Each reads this file only at its own point — its pointer
names that point — and only the section of its role, plus the common sections that section names.
Every service line this contract defines carries the tag `[prototype]`.

Do not restate this contract inside a skill — that is the failure mode this file exists to prevent.
Fourteen readers apply the same rules; a reader that repeats a rule drifts from it, and nothing
turns red when two answers disagree.

A plan is a **prototype plan** when the manifest has `## Experiment Context` — a plan built from
experiment cards (`unikit-plan/references/experiment-plan.md`). An ordinary plan never reads this
file. A prototype is built to answer one question on real players and is then kept or thrown away;
nothing in this contract turns it into production-ready functionality.

## Trigger and fallback

- **Trigger.** The manifest has `## Experiment Context`. A role with no manifest of its own
  (review, fix, devcontext, the sidecars) triggers by hand-off: the session was started from such a
  plan, or the prompt it received carries the note
  `Prototype plan: read the section for your role in .unikit/system/prototype-profile.md.`
  followed by the plan's `Branch:`, `Base:` and settings.
- **Fallback.** File missing or unreadable → print
  `WARN [prototype] profile contract missing — treating the plan as ordinary; run unikit-ai update`
  once, and carry on as for an ordinary plan.
- **What is read.** The section of the role, and `## Mandatory`, `## Softened`, `## Switched off`
  and `## Branch and base` when that section names them. Nothing else.

## Mandatory

These stay in force for a prototype plan:

- Clean, readable code (Code conventions 1) and no inline comments (6); the response language (9).
- The prototype compiles and launches: a task is not done while the project does not build.
- The interface is legible: the key elements the card names are readable at a glance.
- Data integrity: nothing that already saves, loads or migrates player or project data is broken.
- Explicit project constraints: the rules of `.unikit/RULES.md` and the written prohibitions of
  `.unikit/ARCHITECTURE.md` are obeyed.
- The card's `Out of Scope` is a boundary: what it excludes is not built.
- Existing behaviour outside the prototype is unchanged.
- The evidence contract (Layer A of `.unikit/system/dev-principles.md`): a report never declares
  verified what was not verified.
- Tests and documentation follow `## Settings` of the plan (`Testing: no` and `Docs: no` by
  default, an explicit `yes` is honoured); this contract neither enables nor disables them.

## Softened

- **Architecture and scalability** (Code conventions 2, 3 and 5):
  direct references and local parameters are acceptable; no new layers, no dependency injection,
  no extension points, no cross-platform optimisation, no performance work beyond a playable prototype.
- **Documentation after editing methods** (7): not required.
- **Error handling and logging** (4): the minimum that makes a failure during a test visible and
  understandable; no defensive layers, no logging infrastructure.
- **TODO entries** (8): a `// TODO:` comment left in code creates no entry in the project's TODO;
  `/unikit-todo` is not run.

## Switched off

- Updating `DESCRIPTION.md`, `AGENTS.md` and `ARCHITECTURE.md` after a phase (implement Step 3.7),
  whatever `Docs` says.
- Ticking a milestone of `ROADMAP.md` (implement Step 3.10), also when `Milestone: "none"`.
- Ticking `TODO.md` (implement Step 5.1, fix Step 7.3).
- The "PR after verification" hint of implement, the pull-request offer of verify and the actions of
  `/unikit-pr`.
- Any write into `.unikit/gamedesign/experiments/`: cards, feedback and results belong only to
  `unikit-gd-experiment`. A finished prototype does not mean the hypothesis is supported, and no
  executor writes an assessment.
- The `implemented_version` writeback (the plan has no `## Design`).

## Branch and base

- Before the first write — and, for the coordinator, before any mark is written and before the first
  dispatch — compare the current branch with the `Branch:` line of `## Experiment Context`.
  `Branch: none` → no check. A mismatch → print
  `WARN [prototype] the current branch is not the plan's branch` and ask once:
  continue here · switch to the plan's branch · stop. The answer is not asked again in the same session.
- **Switch** → check out the `Branch:` value; when git refuses, print its answer and stop. After a
  switch the plan is resolved again from the new branch.
- The base of every diff and check is the `Base:` line when its value is not `none`
  (`.unikit/system/plan-boundaries.md` → `## Base branch` states the rule).

## Role: execution

`/unikit-implement`, `unikit-implement-coordinator`, `unikit-implement-worker`.

- Apply `## Mandatory`, `## Softened`, `## Switched off` and `## Branch and base`.
- **`/unikit-implement`:** skip Step 3.7, Step 3.10 and Step 5.1; print no "PR after verification"
  hint; Step 5.3 (the documentation checkpoint) runs only when `## Settings` says `Docs: yes`. Build
  each task at prototype size: the simplest thing that tests the hypothesis of the card, using what
  exists. The prompt of every delegate it launches in Step 3.2 (a `develop-agent`) carries the same
  note as the coordinator's workers do.
- **`unikit-implement-coordinator`:** does the branch check once for the session, before any mark is
  written and before the first dispatch. To the prompt of every worker, every review sidecar and every architecture sidecar it
  dispatches it adds the note
  `Prototype plan: read the section for your role in .unikit/system/prototype-profile.md.
  Branch: <value>. Base: <value>. Testing: <yes|no>. Docs: <yes|no>.`
  The documentation sidecar and the commit sidecar are not readers of this contract and get no note.
- **`unikit-implement-worker`:** receives the note in its prompt, reads this section and
  `## Softened`, and does not repeat the branch check.

## Role: verification and pull request

`/unikit-verify`, `/unikit-pr`.

- **`/unikit-verify`:** checks that the checklist of the plan is done, that the project builds and
  launches, that the key elements of the interface are legible, that the card's `Out of Scope` was
  respected and that data is intact. It does not fail the plan for `TODO`/`FIXME`/`HACK` markers
  (Step 3.2 and the strict-mode row), for missing documentation (Steps 3.3, 3.4 and 3.7), for the
  roadmap gate (Step 3.5) or for context drift (Step 3.6, which asks no "Update now?" question);
  Step 3.9 does not run. The engine-specific checks of Step 2.3 and the Anti-patterns row of strict
  mode follow `## Softened`; what it cannot observe it reports as not verified, never as passed. It
  offers no pull request at the end (Step 5 keeps its other options). The verdict never says the
  hypothesis is supported or not.
- **`/unikit-pr`:** prints `INFO [prototype] no pull request for a prototype plan` and stops.

## Role: planning

`/unikit-improve`, `unikit-plan-polisher`, `unikit-plan-coordinator`.

- Do not widen the plan beyond the card's `Must Have`: no test tasks under `Testing: no`, no
  documentation tasks under `Docs: no`, no gold-plating.
- The section `## Experiment Context` is never rewritten: `/unikit-improve` edits around it, the
  polisher preserves it whole.
- The critique rubric does not ask for architecture, layering or extensibility tasks
  (`## Softened`).

## Role: quality and the rest

`/unikit-review`, `unikit-review-sidecar`, `unikit-architecture-sidecar`, `/unikit-fix`,
`/unikit-devcontext`, `/unikit-commit`.

- **Review and the review sidecar:** report bugs, regressions, data-integrity risks, broken explicit
  constraints and an unreadable interface. Do not report a missing abstraction, missing
  extensibility, the depth of error handling, missing documentation, a `// TODO:` comment or
  roadmap linkage.
- **The architecture sidecar:** report only a breach of a prohibition written in
  `.unikit/ARCHITECTURE.md` or `.unikit/RULES.md`; say nothing about missing structure.
- **`/unikit-fix`:** a fix inside a prototype plan follows `## Softened`; `TODO.md` is not ticked
  (Step 7.3); a regression test (Step 5) is suggested only when the plan says `Testing: yes`. The
  prompt of a `develop-agent` it launches carries the same note as the coordinator's workers do.
- **`/unikit-devcontext`:** applies `## Softened` and skips the documentation-update and TODO parts
  of the conventions it reads.
- **`/unikit-commit`:** skips the roadmap-alignment suggestion of its context check; its architecture
  check reports only a breach of a prohibition written in `.unikit/ARCHITECTURE.md` or
  `.unikit/RULES.md`; the message is written as usual.

## Not this contract

- `data/dev-principles.md` is unchanged; ordinary plans never read this file.
- Tests and documentation follow the plan's `## Settings`; this contract neither enables nor
  disables them.
- Cards, feedback, results and the index are written only by `unikit-gd-experiment`.
