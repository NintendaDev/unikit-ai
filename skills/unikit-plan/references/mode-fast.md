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

#### Editor mode (`Editor tasks` and `Visual regression`)

**Gate — `engine_rules_loaded = false` → skip this whole subsection.** Do not ask, and do **not** write an `Editor tasks` line into `## Settings`. Step 0.5 already disabled `Editor:` generation for this engine, so the setting would have no consumer and the question would be unanswerable noise.

When `engine_rules_loaded = true`:

1. **Probe for a configured engine MCP** — check whether `{{engine_mcp_tool}}` is present in `{{settings_file}}` at the project root (the same probe `/unikit-implement` uses in Step 3.6). Refinement, when you need to name the server in the question: `.unikit/system/engine-mcp/INDEX.md` exists → a rules tree shipped for the configured server, and the `server:` line of its delivery stamp is the name to quote. Its **absence does not** flip the probe — a server may ship no rules tree at all, and no rules means no known exceptions, never no capabilities.
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

4. **`Visual regression` — ask only when `Editor tasks: mcp`.** In every other case write `Visual regression: no` without asking. Do not try to establish here whether the server actually supports visual regression: that is declared in the `verification.md` shard, which `/unikit-verify` reads, and it already has a **GATE LIFTED** mechanism for it. The planner states the intent; verify decides reachability.

Store the preferences for the `## Settings` and `## Roadmap Linkage` sections in `PLAN.md`.

**If `.unikit/ROADMAP.md` exists and the user chose milestone linkage:** follow the same milestone selection procedure as in Full Mode Step C (read ROADMAP.md, list candidates, ask user to pick, store milestone name).

**After Step A → continue to the Shared Steps (Step 2) in `SKILL.md`.**
