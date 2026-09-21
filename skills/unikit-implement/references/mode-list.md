# unikit-implement — List Mode

> Loaded on demand by `unikit-implement` Step 0.1 when `--list` is present.
> Follow these steps and **STOP** — do not run Steps 0.2–5.

## List Available Plans

Read-only plan discovery: nothing is executed and no file is modified.

1. Get the current branch: `git branch --show-current` (if git is unavailable, skip branch matching)
2. Scan `.unikit/code/plans/` for all feature folders
3. Check existence of `.unikit/code/FIX_PLAN.md`
4. For each feature folder, read its manifest (`.unikit/code/plans/<folder>/PLAN.md`) and count completed/total tasks
5. Print the plan availability summary — a branch match uses the three name formats of Step 0.1, and the other plans are ordered newest first by the manifest's `Updated:`:

```
Available plans in .unikit/code/plans/:

  Branch match:
    core-loop                     (12/40 tasks, 30%)  ← matches current branch

  Other plans:                                        (newest first, by manifest Updated:)
    customers-system              (18/18 tasks, 100% — completed)
    2026-03-08_inventory-rework   (5/22 tasks, 23%)
    003-legacy-shop-rework        (7/9 tasks, 78%)

  Fix plan: .unikit/code/FIX_PLAN.md — exists

Usage:
  /unikit-implement                              — auto-detect by branch
  /unikit-implement @.unikit/code/plans/<folder>      — use specific plan
  /unikit-implement <folder-name> Phase 3        — specific folder + phase
```
