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
| Step B, Step 4 Phase A and Phase B (reconnaissance) | before an agent is launched, the `guard:` line and its question's `pending` line in `## Recon`; its answer, whole, into `recon/<topic>.md` — by the agent itself (`## Recon files`) |
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
2. `recon/` — every reconnaissance answer still in the context, sorted whole into the sections of
   `RECON-TEMPLATE.md`, with its `## Summary` and `## Contents` (`## Recon files`);
   an answer a compaction has already taken is not rebuilt from memory — its file keeps only what is
   certain and names the loss in `## Gaps`;
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
- guard: <status hash> · <diff hash>
- recon/<topic>.md · pending
- recon/<topic>.md → P<a>, P<b>

## Open
- <an unresolved blocking item>

Next: <step or phase> — <what to read for it>
```

`STATE.md` and `recon/` are written in English: they are the model's own files, never shown to
the user. Phase files use `language.artifacts`.

| Section | Limit |
|---------|-------|
| `Settings:` | the values only — no remarks in brackets |
| `## Decisions` | one line per decision, the outcome only — not who chose it, not what happened before |
| `## Phases` | one table row per phase |
| `## Contracts` | one line: signature · owner → consumers |
| `## Handoff` | at most two lines per phase |
| `## Recon` | the `guard:` line, then one line per question: `· pending` until its file is written, then file → phases (from Step D) |
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

One file per reconnaissance question, `recon/<topic>.md`, in English, in the form of
`{{skills_dir}}/{{self_name}}/references/RECON-TEMPLATE.md`: a short head — `## Summary` and
`## Contents` — over the whole answer. Every question goes through `recon-writer-agent` (`SKILL.md` →
`## Delegation agents`): the agent fills the template itself and returns only the path and its `## Summary`, so the answers never pass through this context — seven detailed answers written
back by the session would fill it twice over, once as the answer and once as the write, and even
read back once they fill it before the first phase.

The answer is written whole, never condensed — every row, number, formula, path and signature the
agent found. The file is the only copy that outlives a compaction or the end of the session:
whatever is left out of it is lost or asked again. When an agent returns, its `## Recon` line loses
`pending`; an agent that returns without its file is asked again as below.

**Reading a recon file.** Open it at the head — `## Summary` and `## Contents`, the lines above
`## Current-Code Evidence`. Then read only the sections `## Contents` names for what is needed now, by their line range (`Read` with `offset` and `limit`); a whole file only when the step rests on
most of it. Before the phases — Step 4 synthesis, Step D, Step E —
the summaries are the working material, and a section is opened only for an exact detail.

Where `recon-writer-agent` falls back to `recon-agent` (a runtime without a writing agent, a failed
call, a missing file), the answer comes back into this session instead.
Writing it is the first thing done when an answer arrives — before reading anything else, before
waiting for the next agent.

**Change guard.** `recon-writer-agent` runs an agent that could edit files, and only its prompt
bounds it. Before the first agent starts, write `guard: <status hash> · <diff hash>` into
`## Recon`: `git status --porcelain --untracked-files=all | shasum -a 256` and
`git diff | shasum -a 256` (`sha256sum` where `shasum` is missing). `.planning/` is ignored by git,
so once no line is `pending` both hashes come out the same again. A different one → print
`WARN [plan] files changed outside .planning/ while recon agents ran` with the paths
`git status --porcelain` shows, and ask whether to continue or stop; never revert anything yourself.
Outside a git work tree there is no guard.

## Phase cycle

For each phase, in order:

1. the **Rule refresh per phase** of SKILL.md Step 5 — new paths are appended to `Rules:`;
2. read the head of each recon file `## Recon` maps to this phase, then only the sections its
   `## Contents` names for this phase's paths and symbols (**Reading a recon file**); read
   `## Contracts` and `## Handoff`; open an earlier phase file only for an exact detail of a direct
   dependency;
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
- A step before Step F that is already recorded is not run again.
- Reconnaissance: a recon file that exists is the answer and is never asked again — a `pending`
  line whose file exists just loses `pending`. A `pending` line with no file: in the same session,
  while the summary says its agent is still running, wait for it; otherwise (a new session, or
  nothing says it runs) ask that one question again — only that one.
- Read only what `Next:` needs: the heads of the recon files `## Recon` maps to the next phase, or of
  those the step in `Next:` works from, and a section only by **Reading a recon file** — never the whole `recon/` folder.
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
