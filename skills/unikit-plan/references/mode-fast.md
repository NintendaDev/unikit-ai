# unikit-plan — Fast Mode (Additional Step)

> Loaded on demand by `unikit-plan` Step 1.5 dispatch when the mode is `fast`.
> Run this additional step (preferences), **then continue to the Shared Steps
> (Step 2) in `SKILL.md`**.

## Fast Mode — Additional Step

This step runs **only in fast mode**, before the shared planning workflow.

### Step A: Ask About Preferences

```
AskUserQuestion: Before planning:

1. Include tests in the plan?
   a. Yes
   b. No

2. Any specific requirements or constraints?

3. Roadmap milestone linkage (only if `.unikit/ROADMAP.md` exists):
   a. Link this plan to a milestone
   b. Skip — no linkage
```

Based on choice:
- Tests: Yes → add a testing phase in the plan
- Tests: No → no test tasks
- Roadmap: Link → proceed to milestone selection (see below)
- Roadmap: Skip → add `Milestone: "none"` to Roadmap Linkage

Fast mode always uses `Docs: no` in Settings (documentation checkpoint is a full mode feature).

Store the preferences for the `## Settings` and `## Roadmap Linkage` sections in `PLAN.md`.

**If `.unikit/ROADMAP.md` exists and the user chose milestone linkage:** follow the same milestone selection procedure as in Full Mode Step C (read ROADMAP.md, list candidates, ask user to pick, store milestone name).

**After Step A → continue to the Shared Steps (Step 2) in `SKILL.md`.**
