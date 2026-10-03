# unikit-plan — Ultra Mode (Additional Steps)

> Loaded on demand by `unikit-plan` Step 1.5 dispatch when the mode is `ultra`.
> Ultra is **user-named, never model-inferred**: it is reached because the user asked
> for an ultra plan — as the leading `ultra` token or in their own wording — never
> offered in the interactive mode question and never inferred from the complexity of
> the task.
>
> Steps A0-C run before the Shared Steps in `SKILL.md`; Steps D-H **refine** Step 5 and
> Step 6 of the shared workflow — they decide the phase partition, the write order, the
> distribution of technical context and the contents of the confirmation. They do **not**
> cancel the section list of Step 5, the rules governing what those sections contain, or
> Guard B. Everything Step 5 says about the content of the manifest's sections holds in
> ultra unchanged — the single exception is the task-scoped subsections of
> `## Technical Context`, which Step G distributes into the phase files.

## Ultra Mode — Blocking Prerequisite

Read `{{skills_dir}}/{{self_name}}/references/ULTRA-PLAN-FORMAT.md` **completely** before
choosing the phase structure. Do not generate a bundle from memory: the manifest
template, the marker, the Required Detail Gate and the integrity checks are canonical
there, and a bundle written from recollection fails the checks it was never read.

The writing protocol's file is read at Step A0 (or Step D2), never before.

## Ultra Mode — Additional Steps

These steps run **only in ultra mode**.

### Step A0: Choose the writing protocol

Step A0 is the first action of an ultra run — before Step A, before any reconnaissance, and asked on its own, never deferred into the Step C batch: the answer decides how Step B dispatches its agents. Until Step A0 is settled, no agent is launched.

- The arguments explicitly ask to save the planning state — any phrasing, any language, as rule 5
  recognises ultra → the protocol with saved state, no question; strip that wording from the feature description, as rule 5 does for ultra.
- A continuation (rule 5a in `SKILL.md`) → no question: it resumes the protocol with saved state.
- Otherwise ask:

  ```
  AskUserQuestion: How should this ultra plan be written?

  Options:
  1. Standard (Recommended) — the session writes the whole plan in one go; the fastest; a context compaction may lose details of early decisions
  2. With saved state — decisions, reconnaissance and progress are kept on disk; survives a compaction and continues in a new session; a little slower
  ```

Once it is settled — answered, requested in the arguments, or a continuation — read
`{{skills_dir}}/{{self_name}}/references/ultra-direct.md` (standard) or
`{{skills_dir}}/{{self_name}}/references/ultra-stateful.md` (with saved state — then run its
`## Entry: from the start`), and print `INFO [plan] ultra protocol: standard` or
`INFO [plan] ultra protocol: saved state`. The line is printed on every path, so the user always sees which protocol runs.

### Step A: Decide on Git Branch

Identical to full mode — follow `mode-full.md` Step A, then return here.

### Step B: Quick Reconnaissance

Take from `mode-full.md` Step B only the **dispatch form** and its rules for writing the
prompts. The scope is **not** inherited: launch **2-3** focused Explore tasks covering
architecture, existing patterns, integration and side effects, and the test/operational
surface. The `1-3 tasks max` limit stated in `mode-full.md` does **not** apply in ultra —
it is that file's own limit, and ultra declares its own here. The depth the Required Detail
Gate demands is produced here — a thin recon becomes a vague phase file, and the gate then
rejects a bundle that could have been written correctly the first time.

The dispatch form is the same as `mode-full.md` Step B — the `recon-agent` alias,
declared once in `SKILL.md` under `## Delegation agents`. A call site names the alias
and never carries a model argument of its own.

Under the standard protocol the dispatch is always `recon-agent`, whatever the size of the work. Under the saved-state protocol the dispatch is `recon-writer-agent` instead: each answer lands in its own `recon/<topic>.md`, whole and never condensed — written by the agent itself, or, where the runtime has no writing agent, by this session the moment the answer returns — and later steps work from the file's `## Summary` (`ultra-stateful.md` → `## Recon files`).

When the Explore tasks return, **return here** — under the saved-state protocol with every answer already on disk (the recon gate in `ultra-stateful.md`).

### Step C: Ask About Preferences

Identical to full mode — follow `mode-full.md` Step C, including the editor mode question
and the roadmap milestone linkage, **then return here**.

That file ends Step C with `continue to the Shared Steps (Step 2) in SKILL.md`. In an ultra
run that line does **not** terminate this file: the Shared Steps are indeed next, and
Steps D-H below run afterwards, refining Step 5 and Step 6 in the sense stated at the top.

The **Test run placement** subsection is inherited with one difference: the key is
`testing.plan.checkpoints.ultra`, and its domain is **wider** — `task | phase | plan`. `task`
exists **only here**: a phase file's per-task `### Tests` is the only surface a per-task run
can be written to. The default is `phase`.

The **PR checkpoints** subsection is inherited unchanged.

## Step D: Partition the work into phases

- A phase is a **coherent implementation checkpoint**, not a rubric: it ends in a state
  that can be checked.
- Phases are ordered by dependency, and the phase order **is** the file-number order.
- **Guard B applies unchanged**: a phase carrying at least one `Editor:` line stays alone
  in its execution layer. The rule is expressed in the manifest's `## Dependency Graph`
  and nowhere else. Partitioning must account for it — put editor work in its own phase
  rather than "separating" two editor tasks into different phases, because the latter is
  what creates the collision the rule prevents. This is a rule about **phases, not tasks**:
  two `Editor:` tasks inside one phase are already sequential.
- **Group the phases into modules** as part of the partition (`TASK-FORMAT.md` →
  `### Modules section`): the module boundary is decided here, with the phases, not after. A
  PR checkpoint task, when the plan carries them, is the last task of its module's closing
  phase, after that phase's test-checkpoint task.
- Give each phase a slug (kebab-case, 2-4 words) → the file name `phase-NN-<slug>.md`,
  zero-padded.
- **A test-checkpoint task belongs to the phase it closes** and stands last in it — only a PR checkpoint task may follow it. A phase
  without one is normal, not an oversight (`Test checkpoints` is a ceiling): its goals pass to
  the next test-checkpoint task, whose coverage then names both phases. Say so in one line of
  the phase text, so the hand-over does not read as a loss.
- **The final full run is the last task of the plan's last phase** under `Testing: yes`. No
  separate phase is created for it.

## Step D2: Offer saved state on a large plan

The standard protocol and more phases than the threshold this line names → print
`WARN [plan] <N> phases — above 12, the context will likely be compacted before the plan is written`
and ask:

```
AskUserQuestion: The plan has <N> phases. Switch to writing with saved state?

Options:
1. Switch to saved state (Recommended) — what is decided so far goes to disk now, the rest as it appears
2. Stay standard
```

- "Switch to saved state" → read `{{skills_dir}}/{{self_name}}/references/ultra-stateful.md` and
  run its `## Entry: switch at D2`.
- "Stay standard" → continue, with no further line.

The protocol with saved state chosen earlier, or no more phases than that threshold → this step is silent. The question is asked in one direction only: from standard to saved state.

## Step E: Resolve every cross-cutting decision

Everything below is decided **before** the phase files are written, or the decision leaks
to the implementer:

- file placement and module boundaries;
- public interfaces and signatures;
- data flow and control flow;
- compatibility requirements and invariants;
- migrations and their ordering;
- failure behaviour;
- observability — logging events, levels, and the fields that must not be logged;
- tests;
- documentation;
- rollout.

If evidence is insufficient for a safe decision, record a **blocking** open question in
`## Open Questions` of the manifest and declare the plan not implementation-ready. Do not
hide the gap behind vague instructions — the Required Detail Gate item that forbids it
names the exact words that count as hiding.

## Step F: Write order

The bundle is written by the protocol chosen at Step A0 or Step D2 — `ultra-direct.md` →
`## Write order`, or `ultra-stateful.md` → `## Phase cycle` and `## Assembly`.

Common to both: the phase files go straight into `.unikit/code/plans/<feature-name>/`, with the
**Rule refresh per phase** of SKILL.md Step 5 before each; the manifest
`.unikit/code/plans/<feature-name>/PLAN.md` goes last, its first line the mode marker below,
written verbatim and never localized; then the checks; only then is the plan shown.

```
<!-- unikit:plan-mode:ultra -->
```

The line is declared in `ULTRA-PLAN-FORMAT.md` — quoted here, never redefined.

## Step G: Distribution of the technical context

One rule decides every case: **cross-phase goes in the manifest, task-scoped goes in the
phase.**

| Subsection | Where it goes |
|-----------|---------------|
| `CONTEXT`, `CONSTRAINTS`, `DEPENDENCY GRAPH`, `OUT OF SCOPE` | the manifest, `## Technical Context` |
| a decision binding two or more phases | the manifest, `## Architecture and Decisions` |
| `INTERFACES`, `KEY PATTERNS` | the phase, `### Required Interfaces and Contracts` of the task that owns it |
| `FILES` | the phase, `## Files in This Phase` |
| `EDITOR TARGETS` | the phase, `### Required Interfaces and Contracts` of the task carrying the `Editor:` line |
| `DI BINDINGS` | the phase, the task that creates the binding |

`## MCP Findings`, `## Rule Candidates`, `## Test Runs`, `## Commit Plan`, `## Settings` and
the checkboxes live **only** in the manifest. Phase files are read-only during execution.

## Step H: Confirm with the user

In addition to the Step 6 items, show:

1. The bundle folder path.
2. The number of phase files.
3. The number of tasks.
4. The integrity check result — `all integrity checks passed`, or the list of violations.
5. When blocking open questions exist, the line
   `Plan is NOT implementation-ready: N blocking open question(s)`.

Then **STOP**.

## Not part of ultra

- Sequential plan numbering is not introduced. Uniqueness comes from the collision policy
  (a slug that already exists routes to `add` or asks for another name — never a silent
  suffix), and ordering comes from the manifest's `Updated:`. Neither is a property of the
  folder name any more.
- There is no model layer.
- There are no planning subagents: under both protocols the session writes every phase itself.
- The design axis (`unikit-gd-*`) is untouched.
- `--list` is unchanged.
- `/unikit-fix` and its flat `FIX_PLAN.md` stay outside the bundle model.
- `add` mode is routed from Step 0 and never reaches the Step 1.5 dispatch that loads this
  file, so its behaviour on an ultra bundle is specified in `mode-add.md`, not here.

## When the checks fail

- **Integrity checks did not pass** → do **not** show the plan as ready. Repair the broken
  links, the unmapped tasks, the duplicated sections and the orphan files, then re-run all
  checks.
- **A blocking open question exists** → show the plan, but mark it not implementation-ready
  with the explicit line from Step H. It is stated, never implied.
