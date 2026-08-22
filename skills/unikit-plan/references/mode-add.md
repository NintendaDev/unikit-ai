# unikit-plan — Add Mode

> Loaded on demand by `unikit-plan` Step 0 dispatch when the mode is `add`.
> Step 0.5 (Bootstrap Context) has already run. Follow these steps and **STOP** —
> Add mode never reaches the Shared Steps and never creates a branch.

## Add Mode — Modify Existing Plan

Modifies an existing plan in-place. Never creates a new branch.

### Add Step 1: Find & Load Plan

Use unified plan detection:
1. Check both locations: `.unikit/code/PLAN.md` (fast plan) and `.unikit/code/plans/` (full plans — match by git branch `<configured branch prefix>*` → folder ending with `_<feature-name>`, or latest folder sorted lexicographically descending)
2. Both exist → ask user which to modify
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

Project docs (DESCRIPTION.md, ARCHITECTURE.md, RULES.md, core/stack rules) are already loaded by Bootstrap (Step 0.5).

### Add Step 2: Analyze & Apply

Parse the user's description and determine changes: new tasks/phases, modifications, settings, updates to the manifest's `## Technical Context`.

If changes require codebase understanding → launch Explore tasks (same as Step 4 Phase A). Skip if purely structural.

Apply changes with Edit tool, preserving unaffected content (this list applies to the non-ultra branch only — an ultra bundle already STOPped in Add Step 1):
- New tasks/phases follow existing format (numbering, WHY, `Files:`, `Editor:`, effort)
  - `Editor:` — one line per editor target, placed after `Files:`, only when the change touches the editor's **serialized state** (concrete signals for the active engine: `references/ENGINE_RULES.md` §3). Omitted for pure code tasks, and **not generated at all** when `engine_rules_loaded = false`.
  - Add mode does **not** introduce a `## Settings` section and does not re-ask the editor-mode question — it extends an existing plan and inherits its settings.
- Update the manifest's `## Total Estimated Effort`, `## Commit Plan` and `## Dependency Graph` as needed
- Update the `## Technical Context` section if changes affect constraints, interfaces, or patterns

### Add Step 3: Confirm

Show: plan path, what changed, updated effort. When `engine_rules_loaded = false`, also show the line `Engine rules: ENGINE_RULES.md not found, Editor: fields skipped` — Add mode never reaches Step 6, so this is its **only** confirmation point for the skipped editor fields. Ask if anything needs adjustment. **STOP after confirmation.**
