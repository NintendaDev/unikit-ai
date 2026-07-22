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

Load the plan: `TASKS.md` + `PLAN-BRIEF.md` for folder plans, or `PLAN.md` for fast plans.

Project docs (DESCRIPTION.md, ARCHITECTURE.md, RULES.md, core/stack rules) are already loaded by Bootstrap (Step 0.5).

### Add Step 2: Analyze & Apply

Parse the user's description and determine changes: new tasks/phases, modifications, settings, updates to PLAN-BRIEF.md (full mode) or `## Technical Context` (fast mode).

If changes require codebase understanding → launch Explore tasks (same as Step 4 Phase A). Skip if purely structural.

Apply changes with Edit tool, preserving unaffected content:
- New tasks/phases follow existing format (numbering, WHY, Files, effort)
- Update Total Estimated Effort, Commit Plan, Dependency Graph as needed
- Update PLAN-BRIEF.md / Technical Context if changes affect constraints, interfaces, or patterns

### Add Step 3: Confirm

Show: plan path, what changed, updated effort. Ask if anything needs adjustment. **STOP after confirmation.**
