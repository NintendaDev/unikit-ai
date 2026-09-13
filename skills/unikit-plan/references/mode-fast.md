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
- Tests: Yes → tests are written inside the tasks that introduce them; **no separate testing
  phase is created**. Runs are placed as separate test-checkpoint tasks, under the policy
  resolved below.
- Tests: No → no test tasks, and no `Test checkpoints:` line is written
- Roadmap: Link → proceed to milestone selection (see below)
- Roadmap: Skip → add `Milestone: "none"` to Roadmap Linkage

Fast mode always uses `Docs: no` in Settings (documentation checkpoint is a full mode feature).

#### Test run placement (`Test checkpoints`)

**There is no question here.** The value is project policy: read it from `.unikit/config.yaml`
→ `testing.plan.checkpoints.fast`. Asking it on every plan is the same noise already removed
from the editor mode.

1. `Testing: no` → the `Test checkpoints:` line is not written at all. Do not go further
   through this subsection.
2. Read `testing.plan.checkpoints.fast`. The domain in fast is `phase | plan`.
   **Key or file missing, or the value empty → `plan`**, silently: a project without a config
   is a normal case, and a line on every plan would turn the warning into wallpaper. This
   default differs from full's `phase` deliberately — a fast plan is short, and one full run
   at the end covers it whole. The value `task` is not admissible in fast: there is no
   per-task surface here. On meeting it, take `plan` and print one line:

   ```
   WARN [testing] checkpoints=task is unavailable in fast; took plan
   ```

   Any other value outside the domain (a typo, the wrong case) is treated the same way: take
   `plan` and print that same `WARN [testing]` line, naming the value actually read.
3. Write the resolved value into `## Settings` as `Test checkpoints: <value>` (Step 5 item 3).
   The plan is self-describing: changing the key in the config afterwards never reinterprets a
   plan that has already been written.

The executor's own merge policy is resolved at execution time and is **never read here**: a
planner that recorded it into the plan would make the executor's decision irreversible.

#### Editor mode (`Editor tasks`)

**Gate — `engine_rules_loaded = false` → skip this whole subsection.** Do not ask, and do **not** write an `Editor tasks` line into `## Settings`. Step 0.5 already disabled `Editor:` generation for this engine, so the setting would have no consumer and the question would be unanswerable noise.

When `engine_rules_loaded = true`:

1. **Probe for a configured engine MCP** — check whether MCP server `{{engine_mcp_tool}}` is present in `{{settings_file}}` at the project root (the same probe `/unikit-implement` uses in Step 3.6). Refinement, when you need to name the server in the question: `.unikit/system/engine-mcp/INDEX.md` exists → a rules tree shipped for the configured server, and the `server:` line of its delivery stamp is the name to quote. Its **absence does not** flip the probe — a server may ship no rules tree at all, and no rules means no known exceptions, never no capabilities.
2. **MCP configured → `Editor tasks: mcp`, silently.** No question — asking on every plan is noise.
3. **MCP not configured → ask:**

```
AskUserQuestion: This plan contains editor work (scenes, UI, VFX, animation, assets).
No engine MCP is configured. How should those tasks be carried out?

   a. manual — the task is marked `⏸️ MANUAL`; no files are touched, and you get the
      exact instruction in the form `[kind] container → target : action`
   b. direct — the file format is edited directly (a git commit is made first)
```

   Offer **`direct` only** when `references/ENGINE_RULES.md` §6 rates the engine's serialized formats 🟢 or 🟡. Where §6 rates them 🔴 (binary or dense generated formats), drop the option entirely rather than showing it and refusing later.

Store the preferences for the `## Settings` and `## Roadmap Linkage` sections in `.unikit/code/PLAN.md`, including the resolved `Test checkpoints:` placement.

**If `.unikit/ROADMAP.md` exists and the user chose milestone linkage:** follow the same milestone selection procedure as in Full Mode Step C (read ROADMAP.md, list candidates, ask user to pick, store milestone name).

**After Step A → continue to the Shared Steps (Step 2) in `SKILL.md`.**
