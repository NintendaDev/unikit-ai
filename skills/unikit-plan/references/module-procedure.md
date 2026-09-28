# unikit-plan — Plan one module

One procedure, two executors: the `unikit-plan-module-planner` subagent on a runtime that has it, and the planning session itself everywhere else. The text is the same for both, so the two paths cannot drift. The working folder and its files are `disk-planning.md`'s; the phase file form and the Required Detail Gate are `ULTRA-PLAN-FORMAT.md`'s.

## Input

The prompt carries four things: the path of `STATE.md`, the module id `M<k>`, and the `Format:` and `Procedure:` paths from `STATE.md`. Everything else is on disk.

## Steps

1. Read `STATE.md`, the `Format:` file completely, the rule files listed under `## Rules loaded`, and the `recon/` files that concern the module's phases.
2. Read the code the module's phases need, to the Ultra depth gate: code-level evidence for every phase. Before each phase, load the topic files and stack rules whose `Load when` matches it and that are not loaded yet — the same delta as the planner's rule refresh per phase.
3. Write the module's `phase-NN-<slug>.md` files into the working folder, and check every task against the Required Detail Gate. When `STATE.md` says `PR checkpoints: yes` and the module is not the last, its PR checkpoint task is the last task of its closing phase, in the form `ULTRA-PLAN-FORMAT.md` gives it.
4. Write `fragments/M<k>.md` — its form is `disk-planning.md` → `## Fragments` — **last**.
5. Mark the module `done` in `STATE.md`; `Next:` becomes the next module, or `assembly`.

## Rules

- Write only inside the working folder.
- Stay inside the phases of your module.
- A cross-module contract that is not in `## Contracts` — do not invent it: stop, record a gap in `## Gaps` of `STATE.md`, and return it.
- Never call other agents.
- Keep the numbering `## Phases` gives.

## Return

Exactly three lines — the only thing that reaches the orchestrator's context:

```
tasks: <n>
gaps: <n>[ — G<a>, G<b>]
blocking: <n>[ — <one line each>]
```
