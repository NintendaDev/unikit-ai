# unikit-plan — Full Mode (Additional Steps)

> Loaded on demand by `unikit-plan` Step 1.5 dispatch when the mode is `full`.
> Run these additional steps (git branch, recon, preferences), **then continue
> to the Shared Steps (Step 2) in `SKILL.md`**. The git-key docs and the `--base`
> priority contract are canonical in `SKILL.md` (Input + Step 0.1); the
> references below apply them.

## Full Mode — Additional Steps

These steps run **only in full mode**, before the shared planning workflow.

### Step A: Decide on Git Branch

**If `git.enabled = false` or `git.create_branches = false`:**
- Skip this step entirely
- Mark `branch_created = false`, continue to next step

**If `--base <branch>` was provided** — skip the question, always create the branch (the flag implies intent).

**Otherwise**, ask the user whether to create a feature branch or stay on the current one:

```
AskUserQuestion: Create a feature branch?

Options:
1. Yes — create <git.branch_prefix><feature-name> (recommended for new work)
2. No — stay on the current branch
```

Based on choice:
- Yes → create feature branch, mark `branch_created = true`:

  **Otherwise, create the branch:**

  ```bash
  git checkout <base_branch>
  git pull origin <base_branch>   # If pull fails (no remote, no network) — warn and continue from local state
  git checkout -b <git.branch_prefix><feature-name>
  ```

  Where `<base_branch>` is resolved from: `--base` flag > `git.base_branch` from config > fallback `main`.
  Where `<git.branch_prefix>` defaults to `feature/` if not set in `.unikit/config.yaml`.

  The branch name uses the feature name **without** the date prefix.
  Example: folder `2026-03-10_item-appraisal-system` → branch `<git.branch_prefix>item-appraisal-system`.
  If the branch already exists, ask: switch to existing or create with a different name?
- No → stay on current branch, mark `branch_created = false`, continue to next step

### Step B: Quick Reconnaissance

Launch 1-3 Explore tasks in parallel to quickly scan the codebase before deep planning. This gives a high-level picture without consuming main context.

```
recon-agent(prompt:
  "In the current project, find files and modules related to [feature domain keywords].
   Report: key directories, relevant files, existing patterns, integration points.
   Thoroughness: quick. Be concise — return a structured summary, not file contents.")
```

**Fallback:** If Agent tool is unavailable, use Glob/Grep/Read directly to scan for relevant files and modules.

**Rules:**
- 1-3 tasks max, "quick" thoroughness — this is reconnaissance, not deep analysis
- Deep exploration happens later in the shared Step 4 (Explore the Codebase)
- Recon results are used to write **targeted** Phase A prompts — require structured output: list of discovered file paths, class/interface names, and module directories. This data feeds directly into Phase A to avoid redundant broad scanning

### Step C: Ask About Preferences

```
AskUserQuestion: Before planning:

1. Include tests in the plan?
   a. Yes, add a testing phase
   b. No, skip tests

2. Documentation policy after implementation?
   a. Yes — show documentation checkpoint after completion (invokes /unikit-docs)
   b. No — skip documentation

3. Roadmap milestone linkage (only if `.unikit/ROADMAP.md` exists):
   a. Link this plan to a milestone
   b. Skip — no linkage

4. Additional requirements or constraints?
```

Based on choice:
- Tests: Yes → add a testing phase after each implementation phase in the plan
- Tests: No → no test tasks in the plan
- Docs: Yes → add `Docs: yes` to Settings, `/unikit-implement` will show documentation checkpoint
- Docs: No → add `Docs: no` to Settings
- Roadmap: Link → proceed to milestone selection (see below)
- Roadmap: Skip → add `Milestone: "none"` to Roadmap Linkage

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

Store the preferences — they affect the `## Settings` section in `.unikit/code/plans/<folder>/PLAN.md`, whether a testing phase is added, whether `/unikit-implement` shows a documentation checkpoint, and how `/unikit-implement` executes `Editor:` tasks.

**If `.unikit/ROADMAP.md` exists and the user chose milestone linkage:**
- Read `.unikit/ROADMAP.md` and list candidate milestones (prefer unchecked items)
- Ask the user to pick one milestone (or type a custom one)
- Store the selected milestone name and a 1-sentence rationale for inclusion in the plan file

**After Step C → continue to the Shared Steps (Step 2) in `SKILL.md`.**
