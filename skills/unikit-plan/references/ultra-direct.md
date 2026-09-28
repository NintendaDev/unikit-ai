# unikit-plan — Ultra writing protocol: classic

Read by `mode-ultra.md` Step A0 when the classic protocol is chosen — the default. The session writes
the whole bundle in one go; nothing but the bundle itself goes to disk.

## Write order

1. Write **all** phase files — before each one, the **Rule refresh per phase** of SKILL.md Step 5 for that phase.
2. Write the manifest — `.unikit/code/plans/<feature-name>/PLAN.md` — **last**, once phase
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

## Checks through the script

Point 3 of `## Write order` runs through
`node {{skills_dir}}/{{self_name}}/scripts/plan-bundle.mjs check .unikit/code/plans/<feature-name>`:
a `FAIL` line → fix it and check again; a `WARN 10` line is judged by the model. `node` cannot run →
the model runs the checks itself and prints
`WARN [plan] plan-bundle.mjs unavailable — checks done by the model`.

## After a compaction

The phase files already written are on disk and nothing else is. Continue from the first phase
file that does not exist; take exact names from the phase files it depends on, and record what
cannot be recovered as a blocking open question rather than guessing it. This protocol has no
resume in a new session: `/unikit-plan ultra <name>` finds a plan folder without its manifest and
offers to start over.
