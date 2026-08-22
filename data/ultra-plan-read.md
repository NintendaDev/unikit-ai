# Ultra plan bundle — reader contract

Read by `/unikit-implement`, `/unikit-verify`, `/unikit-improve` and `/unikit-commit`. It
specifies **how to read** an ultra plan bundle. How to **write** one is declared canonically
in `unikit-plan/references/ULTRA-PLAN-FORMAT.md`, which on a user machine sits in the
agent's installed skills directory.

Do not restate this contract inside a skill — that is the failure mode this file exists to
prevent. A skill **names** the rule and points here; a skill that **repeats** the rule
drifts from it, and nothing turns red when the two disagree.

## Detection

Three steps, in exactly this order:

1. **Plan discovery does not change.** The plan folder is resolved exactly as it always
   was — an explicit `@<path>`, then a feature name, then the git branch, then the latest
   folder lexicographically. Ultra adds no discovery branch and removes none.
2. **Open the manifest** — `.unikit/code/plans/<folder>/PLAN.md`.
3. **Read its first line.** If it is exactly

   ```
   <!-- unikit:plan-mode:ultra -->
   ```

   the plan is an ultra bundle and everything below applies. Otherwise it is an ordinary
   folder plan (or a flat fast plan) and nothing below applies.

A directory listing is not a detection method. The presence of `phase-*.md` is a hint for a
human, never a branch condition for a skill — read the marker.

## Reading depth — per consumer, not one rule

| Consumer | Reads | Why this depth |
|----------|-------|----------------|
| `/unikit-implement` | the manifest plus the phase file of the **active task** | one task is executed at a time; holding every phase in context means holding what is not being executed |
| `/unikit-verify` | the manifest plus **every** phase file | verification validates the plan as a whole and checks the implementation against per-task criteria |
| `/unikit-improve` | the manifest plus **every** phase file | improvement is not local — moving a task between phases touches two of them |
| `/unikit-commit` | the manifest plus the phase files of the **current commit group** | staged paths are mapped onto groups; the rest of the bundle is not needed |
| `unikit-implement-coordinator` | the manifest plus the phase files of the phases it dispatches in the **current layer** | layers execute one at a time, so the phases of future layers have no business in the context; the hand-off to a worker is closed, so what it does not read, it cannot pass on |

## What is mutable

- Checkboxes, `## MCP Findings`, `## Commit Plan` and `## Settings` are edited **only in the
  manifest**.
- **Phase files are read-only during execution.** A skill executing a plan writes into
  `phase-*.md` under no circumstance.
- **`Write` over the manifest is forbidden** — use `Edit`. A regenerating write drops
  `## Phase Index` and `## Technical Context` wholesale.
- The consequence worth naming, because it is what the single write surface buys: `F<n>`
  numbering in `## MCP Findings` never branches across phases, so the `/unikit-mcp-trap`
  window stays single-file.

## Integrity is blocking

Each of the following stops `/unikit-implement`, `/unikit-verify` and `/unikit-improve`. None
of them is a reason to proceed partially:

1. A `## Phase Index` link does not exist, is not relative, or escapes the bundle directory.
2. A checklist task has no `## Task N.M:` section in any phase file.
3. A `## Task N.M:` section appears more than once.
4. A `phase-*.md` file in the folder is missing from `## Phase Index` — an orphan.
5. A dependency reference names a task ID that does not exist.

The reason is the same in every case: **the committed specification is incomplete**. Report
the violation and stop — do not implement, verify or improve a bundle that is missing part
of itself.

A task already marked `[x]` whose phase file is missing is **not** a reason to continue —
the checkbox is the weaker signal, the specification is the stronger one.

**`/unikit-commit` is the exception, and deliberately so.** It reports a violation as a `WARN`
and commits anyway: plan linkage is an optional courtesy there, its other context checks are
explicitly non-blocking, and refusing to record finished work because a plan file lost a link
punishes the wrong action. Blocking on bundle integrity is `/unikit-verify`'s job.

One write-time invariant is **not** re-checked here: that the `## Phase Index` ranges cover
exactly the set of checklist tasks. `unikit-plan/references/ULTRA-PLAN-FORMAT.md` enforces it
before the bundle is saved, and a consumer resolves tasks through the checklist rather than
through the ranges, so a stale range misleads a human and no machine. If that stops being true,
the check belongs in the list above — not in one consumer.

## Verification commands

For `/unikit-verify`:

- Commands under a task's `### Verification` are executed **within the grant the skill
  already holds**.
- Anything outside that grant is printed with the `⏸️ MANUAL` status and reaches **both** the
  report **and** the `unikit-gate-result` block — otherwise it is lost in silence.
- Grants are not widened for this: the `⏸️ MANUAL` idiom already exists for editor targets.
- Verify the implementation against the detailed per-task interfaces, edge cases, logging,
  acceptance criteria, and commands — **not only the short checkbox text**.

## Editing a bundle

For `/unikit-improve`:

- The manifest and every affected phase file are edited **together**.
- Never regenerate the manifest alone when phase detail changed.
- After the write, re-run every check in `## Integrity is blocking`.

## Commit-group mapping

For `/unikit-commit`:

- Resolve the group first: `## Commit Plan` names **task ranges** (`### Commit N: after tasks
  X-Y`), never file names. Take that range, look the tasks up in `## Phase Index`, and read
  **only** the phase files they live in — never the whole bundle.
- When a phase carries tasks from **different** commit groups, file ownership is read from
  its `## Task N.M` sections — not from the phase's `## Files in This Phase` table, which
  belongs to the phase and not to any one group.
- When two groups overlap on a file, stage at hunk level.

## Not a bundle

Behaviour is unchanged for all of these, and it is stated here so nobody goes looking:

- the flat fast plan `.unikit/code/PLAN.md`;
- `.unikit/code/FIX_PLAN.md` and the `/unikit-fix` workflow — a fix plan is architecturally
  a flat file and stays outside the bundle model;
- a folder plan whose manifest carries no marker.

`/unikit-review` is not a consumer either: it is diff/PR-scoped and reads no plan at all.
The accepted consequence is that a broken bundle passes review in silence — only
`/unikit-verify` blocks on it.
