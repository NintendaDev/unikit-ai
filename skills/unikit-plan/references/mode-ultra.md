# unikit-plan — Ultra Mode (Additional Steps)

> Loaded on demand by `unikit-plan` Step 1.5 dispatch when the mode is `ultra`.
> Ultra is **strictly opt-in**: it is reached only by the explicit leading `ultra`
> token, never offered in the interactive mode question and never inferred from
> the complexity of the task.
>
> Steps A-C run before the Shared Steps in `SKILL.md`; Steps D-H replace Step 5 and
> Step 6 of the shared workflow.

## Ultra Mode — Blocking Prerequisite

Read `{{skills_dir}}/{{self_name}}/references/ULTRA-PLAN-FORMAT.md` **completely** before
choosing the phase structure. Do not generate a bundle from memory: the manifest
template, the marker, the Required Detail Gate and the integrity checks are canonical
there, and a bundle written from recollection fails the checks it was never read.

## Ultra Mode — Additional Steps

These steps run **only in ultra mode**.

### Step A: Decide on Git Branch

Identical to full mode — follow `mode-full.md` Step A, then return here.

### Step B: Quick Reconnaissance

Identical to full mode — follow `mode-full.md` Step B, with **one scope adjustment**:
launch **2-3** focused Explore tasks instead of 1-3, covering architecture, existing
patterns, integration and side effects, and the test/operational surface. The depth the
Required Detail Gate demands is produced here — a thin recon becomes a vague phase file,
and the gate then rejects a bundle that could have been written correctly the first time.

The dispatch form is the same as `mode-full.md` Step B — `Agent(subagent_type: Explore,
prompt: …)`, naming no model. Unifying the dispatch form across the repository is the
subject of a separate research bundle; until it closes, a new dispatch follows the one
existing model-free template rather than adding another copy of the literal.

### Step C: Ask About Preferences

Identical to full mode — follow `mode-full.md` Step C, including the editor mode question
and the roadmap milestone linkage.

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
- Give each phase a slug (kebab-case, 2-4 words) → the file name `phase-NN-<slug>.md`,
  zero-padded.

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

1. Write **all** phase files.
2. Write the manifest — `.unikit/code/plans/<dated-folder>/PLAN.md` — **last**, once phase
   content has stopped moving, so that `## Phase Index`, the task links, the ranges and the
   dependency references all agree with it.
   Its **first line** is the mode marker, written verbatim and never localized:

   ```
   <!-- unikit:plan-mode:ultra -->
   ```

   The line is declared in `ULTRA-PLAN-FORMAT.md` — quoted here, never redefined.
3. Run every check in `## Integrity Checks` from `ULTRA-PLAN-FORMAT.md`.
4. Only then show the plan to the user.

Never write the manifest first and the phases after — the index would be written against
content that does not exist yet, and the checks would then be run against a plan you
have already shown.

## Step G: Distribution of the technical context

One rule decides every case: **cross-phase goes in the manifest, task-scoped goes in the
phase.**

| Subsection | Where it goes |
|-----------|---------------|
| `CONTEXT`, `CONSTRAINTS`, `DEPENDENCY GRAPH`, `OUT OF SCOPE` | the manifest, `## Technical Context` |
| `INTERFACES`, `KEY PATTERNS` | the phase, `### Required Interfaces and Contracts` of the task that owns it |
| `FILES` | the phase, `## Files in This Phase` |
| `EDITOR TARGETS` | the phase, `### Required Interfaces and Contracts` of the task carrying the `Editor:` line |
| `DI BINDINGS` | the phase, the task that creates the binding |

`## MCP Findings`, `## Commit Plan`, `## Settings` and the checkboxes live **only** in the
manifest. Phase files are read-only during execution.

## Step H: Confirm with the user

In addition to the full-mode Step 6 items, show:

1. The bundle folder path.
2. The number of phase files.
3. The number of tasks.
4. The integrity check result — `all integrity checks passed`, or the list of violations.
5. When blocking open questions exist, the line
   `Plan is NOT implementation-ready: N blocking open question(s)`.

Then **STOP**.

## Not part of ultra

- Sequential plan numbering is not introduced — the date prefix already gives both order
  and uniqueness.
- There is no model layer.
- The design axis (`unikit-gd-*`) is untouched.
- `--list` is unchanged.
- `/unikit-fix` and its flat `FIX_PLAN.md` stay outside the bundle model.

## When the checks fail

- **Integrity checks did not pass** → do **not** show the plan as ready. Repair the broken
  links, the unmapped tasks, the duplicated sections and the orphan files, then re-run all
  checks.
- **A blocking open question exists** → show the plan, but mark it not implementation-ready
  with the explicit line from Step H. It is stated, never implied.
