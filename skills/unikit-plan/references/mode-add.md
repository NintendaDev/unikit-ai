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

Load the plan manifest: `.unikit/code/plans/<folder>/PLAN.md` for folder plans, or `.unikit/code/PLAN.md` for the flat fast plan. There is no second file to load.

Project docs (DESCRIPTION.md, ARCHITECTURE.md, RULES.md, core/stack rules) are already loaded by Bootstrap (Step 0.5).

### Add Step 2: Analyze & Apply

Parse the user's description and determine changes: new tasks/phases, modifications, settings, updates to the manifest's `## Technical Context`.

If changes require codebase understanding → launch Explore tasks (same as Step 4 Phase A). Skip if purely structural.

Apply changes with Edit tool, preserving unaffected content:
- New tasks/phases follow existing format (numbering, WHY, `Files:`, `Editor:`, effort)
  - `Editor:` — one line per editor target, placed after `Files:`, only when the change touches the editor's **serialized state** (concrete signals for the active engine: `references/ENGINE_RULES.md` §3). Omitted for pure code tasks, and **not generated at all** when `engine_rules_loaded = false`.
  - Add mode does **not** introduce a `## Settings` section and does not re-ask the editor-mode question — it extends an existing plan and inherits its settings.
- Update the manifest's `## Total Estimated Effort`, `## Commit Plan` and `## Dependency Graph` as needed
- Update the `## Technical Context` section if changes affect constraints, interfaces, or patterns

### Add Step 3: Confirm

Show: plan path, what changed, updated effort. When `engine_rules_loaded = false`, also show the line `Engine rules: ENGINE_RULES.md not found, Editor: fields skipped` — Add mode never reaches Step 6, so this is its **only** confirmation point for the skipped editor fields. Ask if anything needs adjustment. **STOP after confirmation.**
