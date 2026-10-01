# unikit-plan — Add Mode

> Loaded on demand by `unikit-plan` Step 0 dispatch when the mode is `add`.
> Step 0.5 (Bootstrap Context) has already run. Follow these steps and **STOP** —
> Add mode never reaches the Shared Steps and never creates a branch.

## Add Mode — Modify Existing Plan

Modifies an existing plan in-place. Never creates a new branch.

### Add Step 1: Find & Load Plan

Use unified plan detection:
1. Check both locations: `.unikit/code/PLAN.md` (fast plan) and `.unikit/code/plans/` (full plans, resolved as follows).

   **Branch match.** From branch `<prefix><name>`, collect every folder in `.unikit/code/plans/` that matches any of the three name formats: (1) exactly `<name>` — the current format; (2) ending with `_<name>` — the `YYYY-MM-DD_<name>` format; (3) ending with `-<name>` and beginning with three digits — the legacy `DDD-<name>` format. Exactly one match → use it. **More than one → ask the user which one**, listing each with its `Updated:` — do not pick by format precedence: two folders for one feature is exactly the state the date used to prevent, and choosing silently is how the resolver starts finding the wrong one. No match → fall through to *latest*.

   **Latest.** Read the `Updated:` line from each candidate's `.unikit/code/plans/<folder>/PLAN.md` and sort descending; ties break on `Created:` descending, then on folder name descending. A manifest with no `Updated:` is **excluded and named** — `WARN [plan] <folder>: manifest has no Updated: — excluded; run unikit-ai update to backfill it` — never guessed from the folder name and never from the file's mtime, which `git checkout` and a fresh clone rewrite.
   **`latest fallback` is a guess, not a resolution:** the branch named no plan. With two
   or more plans present, print the candidate table (folder, `Updated:`, tasks remaining)
   and ask — never auto-select. With exactly one plan present there is nothing to choose
   between: announce it with the branch miss named in the reason and continue.

   **An unfinished plan is not a plan.** A folder under `.unikit/code/plans/` that holds `.planning/STATE.md` but not its manifest `.unikit/code/plans/<folder>/PLAN.md` is an ultra plan still being written: it is never a candidate, and it is named once:

   ```
   NOTE [plan] <folder> — unfinished planning: .planning/STATE.md is there, the manifest is not. Continue it with: /unikit-plan ultra <folder>
   ```

   Add never writes into an unfinished plan: when it is the only folder found, print that line and **STOP**.

**Announce the resolution.** Print exactly one visible line before any other output:

```
INFO [plan] resolved: <path> (<reason>)
```

`<reason>` is exactly one of: `explicit path` · `feature name` · `fast plan` · `fix plan` ·
`branch match: <branch>` · `latest fallback`. This is plain output, never the payload of an
interactive question.
2. Both exist → ask user which to modify. Print both plan paths with their `Updated:` to the
   screen as plain markdown first — the question mechanism carries the options and nothing else.
3. Only one exists → use it
4. No plan found → tell user to create one first, **STOP**

Load the plan manifest: `.unikit/code/plans/<folder>/PLAN.md` for folder plans, or `.unikit/code/PLAN.md` for the flat fast plan.

**Ultra bundle check.** Read the first line of the resolved plan manifest. If it equals `<!-- unikit:plan-mode:ultra -->`, this is an ultra bundle: it is read as a whole per `.unikit/system/ultra-plan-read.md`, and Add mode refuses it — see the branch below. Otherwise continue unchanged. There is no second file to load.

   **If `.unikit/system/ultra-plan-read.md` is missing or unreadable, do not block:** treat every plan as a single-file plan and continue exactly as before — a project that predates the ultra port has no bundles to read.

**When the manifest is an ultra bundle — refuse and route, do not write:**

1. Tell the user the plan is an ultra bundle, and that extending one requires a coordinated edit of the manifest **and** the affected phase files — a new `## Task N.M:` section in the owning phase file, an updated `## Phase Index`, a matching `([details](…))` anchor, and a re-run of the integrity checks.
2. Name the owner of that operation: `/unikit-improve`, which is already ultra-aware and edits the manifest together with every phase file it touches, re-running the integrity checks after the write.
3. **STOP** without writing anything. Do not read the phase files — the check needs only the manifest's first line.

The refusal is never silent: a silent stop is indistinguishable from "there was nothing to add".

Project docs (DESCRIPTION.md, ARCHITECTURE.md, RULES.md, core rules) are already loaded by Bootstrap (Step 0.5). For every phase you add or rewrite, run the **Rule refresh per phase** of SKILL.md Step 5 before drafting its tasks.

### Add Step 2: Analyze & Apply

Parse the user's description and determine changes: new tasks/phases, modifications, settings, updates to the manifest's `## Technical Context`.

If changes require codebase understanding → launch Explore tasks (same as Step 4 Phase A). Skip if purely structural.

Apply changes with Edit tool, preserving unaffected content (this list applies to the non-ultra branch only — an ultra bundle already STOPped in Add Step 1):
- New tasks/phases follow existing format (numbering, WHY, `Files:`, `Editor:`, effort)
  - `Editor:` — one line per editor target, placed after `Files:`, only when the change touches the editor's **serialized state** (concrete signals for the active engine: `references/ENGINE_RULES.md` §3). Omitted for pure code tasks, and **not generated at all** when `engine_rules_loaded = false`.
  - Add mode does **not** introduce a `## Settings` section and does not re-ask the editor-mode question — it extends an existing plan and inherits its settings, `Test checkpoints:` among them. It never resolves that value from the config and never writes the line: the plan already carries it, and re-resolving it here would reinterpret a plan that has already been written.
- **New tasks go above the final full run.** When the plan's last task carries `Test checkpoint: plan`, every task Add mode appends is inserted **before** it, so that the full run stays last. Appending after it leaves the plan with work no run covers, and breaks the integrity check requiring the final task to be that run. The same holds inside a phase closed by a test-checkpoint task: new tasks for that phase go above it, not after it.
- **Plans with modules** (`## Modules` present, or any `PR checkpoint:` line). The grammar is `TASK-FORMAT.md` → `### Modules section` and `### PR checkpoint task grammar`; only the insertion decisions are stated here:
  - A new task of an existing module goes **above** its PR checkpoint task and above its module test-checkpoint task. The module is the one whose `## Modules` line covers the phase.
  - A new module **after the last**: under `PR checkpoints: yes` the former last module gets a PR checkpoint task — a new task at the end of its closing phase, with that phase's next free number — and its `## Modules` line gains `PR: task N.M`. The new module carries no `PR:` field: it is now the last.
  - Under `Testing: yes` the last task of the plan must stay `Test checkpoint: plan`, so with a module after the last the final full run moves to the new last phase, with that phase's next free number. Its old place in the former closing phase takes the module's test-checkpoint task (under `Test checkpoints: phase | task`), right before the new PR checkpoint task.
  - A new module **before the first** gets its own PR checkpoint task under `PR checkpoints: yes`; its phase is numbered `0`, and no existing phase changes its number.
  - A new module between two modules is not added: its work joins an existing module, above that module's PR checkpoint. There is no number for a phase between two existing ones without renumbering.
  - `## Modules` is updated in the same edit — its lines, ranges and `PR:` fields. A plan that had no section and now has two modules gets one.
  - The module barrier is rewritten into the `**Dependencies:**` lines of every affected phase.
  - `PR checkpoints: yes` is never written or removed here: Add mode does not read the config, so a plan without the line gets modules but no PR checkpoint tasks.
  - Existing task IDs are never renumbered, and `Planned at:` is left alone.
  - Adding a module prints one line: `INFO [plan] module <name> added as M<k> (phases K-L)`. Every other edit is silent.
- Update the manifest's `## Total Estimated Effort`, `## Commit Plan` and `## Dependency Graph` as needed
- Update the `## Technical Context` section if changes affect constraints, interfaces, or patterns
- Move the header's `Updated:` to today's date (`Bash(date *)`). Add mode changes the plan's **content**, which is exactly what that field tracks; leaving it stale drops the plan behind untouched plans in every "latest" resolver. `Created:` is never rewritten. `Planned at:` is never rewritten either: it marks where the plan's work starts.

### Add Step 3: Confirm

Show: plan path, what changed, updated effort. When `engine_rules_loaded = false`, also show the line `Engine rules: ENGINE_RULES.md not found, Editor: fields skipped` — Add mode never reaches Step 6, so this is its **only** confirmation point for the skipped editor fields. Ask if anything needs adjustment. **STOP after confirmation.**
