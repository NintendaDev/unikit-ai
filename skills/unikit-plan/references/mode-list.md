# unikit-plan — List Mode

> Loaded on demand by `unikit-plan` Step 0 dispatch when `--list` is present.
> Follow these steps and **STOP** — do not run Steps 0.1–7.

## List Mode — Show Available Plans

When `--list` is present in arguments, show all available plans and STOP.

### List Step 1: Collect Plans

Scan for plans in all locations:
1. **Fast plan** — check if `.unikit/code/PLAN.md` exists
2. **Full plans** — list all folders in `.unikit/code/plans/` (if directory exists)
3. **Fix plan** — check if `.unikit/code/FIX_PLAN.md` exists

### List Step 2: Gather Info

For each found plan:
- **Name** — folder name (for full plans), "PLAN.md" (fast), "FIX_PLAN.md" (fix)
- **Progress** — count completed (`- [x]`) and total (`- [ ]` + `- [x]`) task checkboxes
- **Branch match** — compare plan name with current git branch (`git branch --show-current`). If on `<configured branch prefix><name>` and a plan folder ends with `_<name>` → mark as `← current branch`

### List Step 3: Display

```
Available plans:

  Plan                                    Progress       Branch
  ──────────────────────────────────────────────────────────────
  .unikit/code/plans/2026-03-10_night-trading  🔄 3/12       ← current branch
  .unikit/code/plans/2026-03-08_mini-games     ✅ 12/12      feature/mini-games
  .unikit/code/PLAN.md                         ⏳ 0/5        —
  .unikit/code/FIX_PLAN.md                     ⏳ 1/3        —

To start implementation: /unikit-implement
To modify a plan: /unikit-plan add <changes>
```

If no plans found:
```
No plans found.

Create one:
  /unikit-plan fast <description>
  /unikit-plan full <description>
```

**After displaying → STOP.** Do not continue to planning.
