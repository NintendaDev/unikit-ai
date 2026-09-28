# unikit-plan — Ultra writing protocol: with saved state

Read by `mode-ultra.md` Step A0 or Step D2 when this protocol is chosen, and by a resume.
Everything a later step or phase needs is written to disk the moment it appears.

## Folder

```text
.unikit/code/plans/<feature-name>/
├── .planning/              ← its first file is a `.gitignore` holding `*`
│   ├── STATE.md            ← what is done, what is left, decisions, contracts, Next:
│   ├── manifest-head.md    ← manifest sections computed before the phases
│   ├── checklist.md        ← the manifest checklist, one phase block appended per phase
│   └── recon/<topic>.md    ← reconnaissance answers
├── phase-NN-<slug>.md      ← written in their final form, one at a time
└── PLAN.md                 ← written last; until it exists the plan is unfinished
```

The `.planning/` folder's first file is a `.gitignore` holding `*`, so nothing of the saved state
reaches a commit. The phase files are written straight into the plan folder, in their final form;
the manifest `.unikit/code/plans/<feature-name>/PLAN.md` is written last, and until it exists the
plan is unfinished.

## Entry: from the start

After the answer at Step A0: create `.planning/.gitignore`, then the header of `STATE.md` with
`Next: Step A`. `Rules:` starts with the files read at Step 0.5 (Bootstrap) — otherwise a
compaction before the first phase leaves the project rules unread.

Each step writes its result the moment it has one, not at the end of the step:

| Step | Where its result is written |
|------|-----------------------------|
| Step A (branch) | `Settings:` |
| Step B, Step 4 Phase A and Phase B (reconnaissance) | each answer at once into `recon/<topic>.md`, plus its line in `## Recon` |
| Step C (preferences) | `Settings:` and `## Decisions` |
| Step 2 (research link) | `manifest-head.md` → `## Based on`, with the digest computed at Step 2 — never recomputed |
| Step 4 synthesis | `manifest-head.md` → `## Technical Context` |
| Step 4.5 and Step 4.6 | `manifest-head.md` (the design briefs, the catalog reading) |
| Overview, Roadmap Linkage | `manifest-head.md` |
| Step D | `## Phases`; the `## Modules` lines go to `manifest-head.md` |
| Step E | `## Decisions`, `## Contracts`; a blocking question → `## Open` and `manifest-head.md` → `## Open Questions` |

After every step `Next:` is **replaced**, never appended to.

## Entry: switch at D2

What so far lives only in the context is written to disk once, in this order:

1. `.planning/.gitignore`;
2. `recon/` — the reconnaissance answers condensed into the form of `## Recon files`, not retold;
3. `manifest-head.md`;
4. `STATE.md` — Settings, the Decisions from the user's answers and Step C, Phases, Rules, Recon,
   `Next: Step E`.

From there on, exactly as with the entry from the start. Print one line:
`INFO [plan] saved state · state: .unikit/code/plans/<feature-name>/.planning/STATE.md`.

## STATE.md

```markdown
> Resume: read `Procedure:`, `Format:` and the files on `Rules:`, then this file to the end; when `Next:` names a step before Step F, re-read `Skill:` and `Mode:` as well; continue from `Next:`.
# Planning state — <feature-name>
Procedure: {{skills_dir}}/{{self_name}}/references/ultra-stateful.md
Skill: {{skills_dir}}/{{self_name}}/SKILL.md
Mode: {{skills_dir}}/{{self_name}}/references/mode-ultra.md
Format: {{skills_dir}}/{{self_name}}/references/ULTRA-PLAN-FORMAT.md
Settings: Testing: <yes|no> · Test checkpoints: <task|phase|plan> · Docs: <yes|no> · Editor tasks: <mcp|manual|direct> · PR checkpoints: <yes|no> · branch: <branch> · base: <base>
Rules: <path> · <path> · …

## Decisions
- <a final decision, one line>

## Phases
| N | file | goal | tasks | dep | M | ✓ |

## Contracts
- <signature> · P<owner> → P<consumers>

## Handoff
- P<n> · <exact names this phase created> · TEMP <what a later phase must undo> — undo in P<m>

## Recon
- recon/<topic>.md → P<a>, P<b>

## Open
- <an unresolved blocking item>

Next: <step or phase> — <what to read for it>
```

`STATE.md` and `recon/` are written in English: they are the model's own files, never shown to
the user. Phase files use `language.artifacts`.

| Section | Limit |
|---------|-------|
| `## Decisions` | one line per decision, the outcome only |
| `## Phases` | one table row per phase |
| `## Contracts` | one line: signature · owner → consumers |
| `## Handoff` | at most two lines per phase |
| `## Recon` | one line: file → phases |
| `## Open` | only what is unresolved and blocking |
| `Next:` | one line, the last line of the file |

Never written into `STATE.md`:

- reasoning, history and alternatives;
- closed gaps — the decision goes to `## Decisions` or `## Contracts`, the gap is deleted;
- code bodies and class listings — a signature only;
- anything a phase file or a recon file already holds — point at it;
- manifest sections — they go to `manifest-head.md`.

A guide for the size: about 50 lines for a 10-phase plan.

## Recon files

One file per reconnaissance question, `recon/<topic>.md`, in English:

- the first line is `HEAD: <short sha>`, the second `Question: <…>`;
- the body: `## Current-Code Evidence` rows (path · symbols or lines · why it matters), interfaces
  with their signatures, tests and fixtures, logging;
- the last section is `## Gaps` — what the answer could not establish.

## Phase cycle

For each phase, in order:

1. the **Rule refresh per phase** of SKILL.md Step 5 — new paths are appended to `Rules:`;
2. read the recon files `## Recon` maps to this phase, `## Contracts` and `## Handoff`; open an
   earlier phase file only for an exact detail of a direct dependency;
3. write `.unikit/code/plans/<feature-name>/phase-NN-<slug>.md` in one write;
4. append the phase's block to `.planning/checklist.md` — the `### Phase N:` heading with
   `**Effort:**`, `**Dependencies:**` and `**Status:** [ ] Not started`, then one task line per
   task with its `WHY:` line and its `Files:` / `Test checkpoint:` / `PR checkpoint:` line, in the
   form of the checklist in the `ULTRA-PLAN-FORMAT.md` manifest template;
5. update `STATE.md` in one edit: the ✓ in the phase's row, its `## Handoff` line, the new `Next:`;
6. print `INFO [plan] phase <N>/<total> written · state: .unikit/code/plans/<feature-name>/.planning/STATE.md`.

The path is in every progress line: after a compaction it is the line that leads back to the
state.

A gap in a contract is closed here, by the session itself (through `AskUserQuestion` when it
needs the user), and the decision goes straight into `## Contracts`.

## Resume

Two entries:

- the same session after a compaction — a `state:` line or the summary names the plan;
- a new session — `/unikit-plan ultra <name>` or `Continue it` at Step 1.

Follow the `> Resume:` line, the first line of `STATE.md` — it names this protocol and what else
to read — then:

- **Disk wins.** A phase file on disk is done. A phase file on disk whose row has no ✓ → read
  that one file, write its `## Handoff` line and the ✓, continue. A phase file on disk whose block
  is missing from `checklist.md` → rebuild that block from this one file. A ✓ without its file →
  write the phase.
- A step before Step F that is already recorded is not run again; a recon file that exists is not
  asked again.
- Print `INFO [plan] resuming <feature-name> from <Next> · state: .unikit/code/plans/<feature-name>/.planning/STATE.md`.

## Assembly

After the last phase:

1. Write the manifest `.unikit/code/plans/<feature-name>/PLAN.md`. Its first line is
   `<!-- unikit:plan-mode:ultra -->`; the header and the sections computed before the phases come
   from `manifest-head.md`; `## Phase Index`, `## Commit Plan` and `## Dependency Graph` come from
   `## Phases`; the checklist is `checklist.md` as it stands — no phase file is re-read for it;
   every section stands in the order of the `ULTRA-PLAN-FORMAT.md` manifest template.
2. `node {{skills_dir}}/{{self_name}}/scripts/plan-bundle.mjs check .unikit/code/plans/<feature-name>` — a `FAIL` line → fix it and check again, until `OK`; a `WARN 10` line is judged by the model.
3. `node {{skills_dir}}/{{self_name}}/scripts/plan-bundle.mjs finalize .unikit/code/plans/<feature-name>` — removes `.planning/`.
4. `node` cannot run → the model runs the checks itself and prints
   `WARN [plan] plan-bundle.mjs unavailable — checks done by the model; remove .unikit/code/plans/<feature-name>/.planning/ by hand`.
