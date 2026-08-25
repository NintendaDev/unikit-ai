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

Listing never opens a plan folder — a folder is a plan whatever its manifest contains. That is what keeps this mode unchanged as new plan modes are added.

### List Step 2: Gather Info

For each found plan:
- **Name** — folder name (for full plans), `.unikit/code/PLAN.md` (fast), `.unikit/code/FIX_PLAN.md` (fix)
- **Progress** — count completed (`- [x]`) and total (`- [ ]` + `- [x]`) task checkboxes
- **Branch match.** From branch `<prefix><name>`, collect every folder in `.unikit/code/plans/` that matches any of the three name formats: (1) exactly `<name>` — the current format; (2) ending with `_<name>` — the `YYYY-MM-DD_<name>` format; (3) ending with `-<name>` and beginning with three digits — the legacy `DDD-<name>` format. Mark **every** match as `← current branch`.

  This is the one resolver where several matches do **not** raise a question: List mode only labels, it never selects, so there is nothing to choose between. Every other resolver asks.
- **Sort key** — the manifest's `Updated:`, newest first. A manifest that has none sorts **last** and its row is marked `(no Updated:)`. List mode never drops a plan — unlike the choosing resolvers, which exclude such a manifest and say so — but an unexplained position at the bottom of a list is the same silent omission in a smaller costume.

### List Step 3: Display

```
Available plans (sorted by the manifest's `Updated:`, newest first):

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
