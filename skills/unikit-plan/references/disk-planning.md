# unikit-plan — Disk-first ultra planning

Read by `mode-ultra.md` on every ultra run. A large plan is written module by module, and everything the run knows lives on disk, so an automatic compaction — which drops old tool outputs and keeps a summary, the last messages and a few recently read files — never loses where the run stands. The format of the finished bundle is `ULTRA-PLAN-FORMAT.md`; this file owns only the way to it. The procedure one executor follows for one module is `module-procedure.md`.

## When

Every ultra run of `/unikit-plan`, not only a large one: one scheme, one shape of result. Fast and full plans are written as before.

## Working folder

`.unikit/code/.planning/<name>/` — outside `.unikit/code/plans/`, because every folder there counts as a plan for `--list`, `/unikit-implement` and `/unikit-verify`, and an unfinished planning must never be picked up as one. The plan folder `.unikit/code/plans/<name>/` appears only at the end, whole (`## Assembly`).

```text
.unikit/code/.planning/<name>/
├── .gitignore               ← `*`, written first
├── STATE.md                 ← the run's memory; `Next:` is its last line
├── recon/<topic>.md         ← reconnaissance answers, one file per question
├── fragments/M<k>.md        ← one per finished module, written last by its executor
├── phase-NN-<slug>.md       ← the phase files, final form
└── PLAN.md                  ← the manifest, assembled last
```

The working folder's first file is a `.gitignore` holding `*`. Without it the folder shows in `git status`, blurs the `## Change guard`, and changes the `tree-sha256` by which `/unikit-implement` and `/unikit-verify` reuse a test run.

## STATE.md

Written right after the phases and the cross-cutting decisions are settled (`mode-ultra.md` Steps D-E), before the first phase file. Updated after every module and after every closed batch of gaps. `Next:` is always the last line.

```markdown
> Resume: 1. read `<Format: path>` and the `Procedure:` path below; 2. read the rule files under `## Rules loaded`; 3. read this file to the end and continue from `Next:`.

# Planning state — <name>

Slug: <name>
Branch: <branch>
Base: <base>
Planned at: <short sha>
Created: YYYY-MM-DD
Settings: Testing: yes · Test checkpoints: phase · Docs: yes · PR checkpoints: yes
Research: <path to the linked research, or none>
Format: <absolute path of ULTRA-PLAN-FORMAT.md>
Procedure: <absolute path of module-procedure.md>

## Research link
<the `## Based on` entry, with the Summary SHA256 already computed — never recomputed here>

## Design briefs
<## Design / ## Flow Context / ## Content Context, verbatim as the manifest will carry them>

## Catalog
<the Step 4.6 result>

## Overview
## Roadmap Linkage
## Technical Context
## Open Questions

## Modules
- M1 · <name> · phases 1-3 · delivers: <…> · PR: task 3.4 · status: pending | running | done

## Phases
- 1 · phase-01-<slug>.md · <name> · goal: <…> · tasks: 1.1-1.4 · M1 · depends: none

## Cross-cutting decisions
## Contracts
## Rules loaded
## Recon
- recon/<topic>.md · <one line> · HEAD <sha>

## Executors
- M1 · module-planner | session · started <HH:MM> · expects fragments/M1.md

## Gaps
- G1 · M2 · <what is missing> · open | closed

Next: <the next step>
```

`Format:` and `Procedure:` are absolute paths: an executor running as a subagent cannot compute them. The sections from `## Research link` to `## Open Questions` hold what the run computed before the phases were written; `## Assembly` takes them from here, never from memory.

## Recon files

`recon/<topic>.md` — the first line is `HEAD: <short sha>`, the second `Question: <…>`. The body follows the tables of a phase file — `## Current-Code Evidence` rows (path · symbols or lines · why it matters), interfaces with their signatures, tests and fixtures, logging — and the seven points of the Required Detail Gate. The last section, `## Gaps`, names what was not found. Written by the `recon-writer` alias (`SKILL.md` → `## Delegation agents`).

## Fragments

`fragments/M<k>.md` is written by the module's executor **last**, with the sections `### Modules line`, `### Phase Index lines`, `### Checklist` (the phase headings with `**Effort:**` / `**Dependencies:**` / `**Status:**`, and the task lines with their `([details](…))` links), `### Cross-Phase Dependencies`, `### Commit Plan`, `### Blocking questions`, `### Gaps`. The rule the resume rests on: a fragment present means the module is done.

## Executors

Module k is planned by the `module-planner` alias, following `module-procedure.md`; its answer is three lines (`module-procedure.md` → `## Return`). Modules run one at a time.

The call fails — the subagent is not installed, or agents are off → run the same procedure in this session and print `INFO [plan] module-planner unavailable — planning M<k> in this session; re-run unikit-ai init to install it`. The hint matters: an existing project gets new subagents from neither `update` (it installs only the ones already listed) nor `update --install-new` (skills only).

## Change guard

The executor writes files, and its tool list does not bound the path. Before it starts, take a snapshot: `git status --porcelain --untracked-files=all` without the lines under `.unikit/code/.planning/` (a plain `--porcelain` folds an untracked folder into one `?? .unikit/` line and hides a write inside it), plus `git diff | git hash-object --stdin` (a second edit of an already modified file does not change its status line). After it returns, take the same two. A new status line or a different hash → stop:

```
ERROR [plan] M<k> executor changed files outside the working folder: <paths>
```

and ask `Keep them and continue` / `Stop planning`. Rolling back is the user's decision; the skill deletes nothing. Git disabled or outside a work tree → no guard, and one line for the whole run: `WARN [plan] change guard off — no git work tree`.

## Progress lines

After every module:

```
INFO [plan] M<k>/<n> done — <t> tasks, <g> gaps · state: .unikit/code/.planning/<name>/STATE.md
```

The path is in every line: after a compaction it is the line that leads back to the state.

## Gaps

Gaps collect in `STATE.md`. Before the next module, the open ones are closed in one batch — one `recon-writer` call per batch. A contract gap — an executor needs a cross-module contract that `## Contracts` does not hold — is decided here, by the orchestrator: write it into `## Contracts`, mark the module `pending`, and run it again.

## Resume

Two entries, and both start with the protocol at the top of `STATE.md`:

- **A new session** — the argument names an unfinished planning, or `Continue` was chosen at Step 1: an executor listed in `## Executors` whose fragment does not exist is started again.
- **The same session after a compaction** — an executor started in this session is not started again: wait for its notification, or for its fragment to appear.

## Assembly

After the last module:

1. Assemble the manifest `.unikit/code/.planning/<name>/PLAN.md` from the fragments, in module order, and from the `STATE.md` sections computed before the phases: the marker as the first line, the header with `Planned at:` from `STATE.md`, `## Based on` with the saved digest, the briefs, and every section in the order of the `ULTRA-PLAN-FORMAT.md` manifest template.
2. `node {{skills_dir}}/{{self_name}}/scripts/plan-bundle.mjs check <working folder>`. A `WARN 10` line is judged by the model. A failure → fix it and check again.
3. `node {{skills_dir}}/{{self_name}}/scripts/plan-bundle.mjs finalize <working folder> .unikit/code/plans` — it moves the bundle into `.unikit/code/plans/<name>/` and removes the working folder.

`node` cannot run → the model runs checks 1-15 itself and prints the two move commands for the user: `WARN [plan] plan-bundle.mjs unavailable — checks done by the model; move the bundle with: <commands>`.
