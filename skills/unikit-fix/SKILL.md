---
name: unikit-fix
description: >-
  Fix a specific bug or problem in a {{engine_name}} project. Supports two modes — immediate fix
  or plan-first. Without arguments executes existing .unikit/code/FIX_PLAN.md. Checks {{engine_name}}
  compilation, suggests test coverage, and creates self-improvement patches. Use when user says "fix bug", "debug this", "something is broken",
  "fix the tests", "fix the errors in the tests", "read the errors in the {{engine_name}} console logs and fix the problems",
  or pastes an error message or {{engine_name}} console log.
  Also trigger when user shares a NullReferenceException, MissingReferenceException,
  compilation error, or any {{engine_name}}-specific error.
argument-hint: "<bug description or error message>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(git *)
  - Bash(rm *)
  - Bash(mkdir *)
  - Agent
  - Skill
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.2"
  category: bugfix
---

# Fix — {{engine_name}} Bug Fix Workflow

Fix a specific bug or problem in the codebase. Supports two modes: immediate fix or plan-first approach.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

<!-- unikit:agents codex -->
## Subagent Delegation — BLOCKING PRE-REQUISITE

When the workflow reaches a step that requires a subagent (`Agent`), the assistant MUST automatically spawn the
subagent if agent execution is supported by the current environment and not prohibited by higher-priority
instructions.

Only if agent execution is unavailable or blocked, the assistant MUST ask the user before proceeding with any
alternative.
<!-- unikit:end -->

---

## Delegation agents

This skill uses a named delegation alias for `Agent(...)` calls. The alias expands to an `Agent(subagent_type: "general-purpose", ...)` invocation with the matching skill loaded.

- **`develop-agent`** — used ONLY for complex fixes requiring extensive codebase exploration or independent multi-file changes. Default fixes are implemented inline by this skill using rules loaded in Bootstrap. Expands to:

  ```
  Agent(
    subagent_type: "general-purpose",
    prompt: "/unikit-devcontext <fix details>",
    description: "Apply fix",
    skills: ["unikit-devcontext"]
  )
  ```

  Fallback: if the `Agent` tool is unavailable, invoke `/unikit-devcontext` inline.

---

## Step 0: Check for Existing Fix Plan

**BEFORE anything else**, check if `.unikit/code/FIX_PLAN.md` exists.

**If the file EXISTS:**
- Read `.unikit/code/FIX_PLAN.md`
- Inform the user: "Found a fix plan. Executing the fix according to the plan."
- **Skip Step 0.1 and Step 1**, but still run **Step 0.2** to load fix context (skill-context and patches)
- Go to **Step 2: Investigate the Codebase**, using the plan as your guide
- Follow each step of the plan sequentially
- Continue through Step 4 (Verify), Step 5 (Test suggestion), Step 6 (Patch), Step 7 (Post-Fix Actions)
- FIX_PLAN.md is deleted in **Step 7.5** after all verification completes

**If the file DOES NOT exist AND conversation history contains review findings** (e.g., the user ran `/unikit-review` or similar earlier in this session):
- Extract the list of problems/violations from the conversation history
- If `$ARGUMENTS` is provided — use it as a **filter or clarification** for the review findings. The user may specify which issues to fix and which to skip (e.g., "fix issues 1, 3, 5", "only fix the naming violations", "skip the formatting issues"). Apply only the selected subset.
- If `$ARGUMENTS` is empty — treat ALL review findings as the bug description
- Summarize the extracted problems (after filtering, if applicable) back to the user before continuing
- Proceed to Step 0.1

**If the file DOES NOT exist AND `$ARGUMENTS` is empty AND no review context in conversation:**
- Tell the user: "No fix plan found and no bug description provided. Specify a bug description (`/unikit-fix <description>`) or create a plan."
- **STOP.**

**If the file DOES NOT exist AND `$ARGUMENTS` is provided AND no review context in conversation:**
- Treat `$ARGUMENTS` as the bug description
- Continue to Step 0.1 below.

---

## Step 0.1: Pre-flight Checks

### Check for Uncommitted Changes

```bash
git status
```

**If uncommitted changes exist:**

```
⚠️ Uncommitted changes detected.

Options:
1. Commit now (recommended)
2. Stash and continue (git stash)
3. Continue as is
```

Based on choice:
- Commit now → run `/unikit-commit`, then continue
- Stash → `git stash push -m "unikit-fix: stash before fix"`, then continue
- Continue as is → proceed without changes

### Resume / Recovery

If the user is resuming after a break or context was likely lost (e.g. after `/clear`), rebuild context:

```bash
git status
git branch --show-current
git log --oneline --decorate -10
git diff --stat
```

---

## Step 0.2: Load Fix Context

Bootstrap loads coding rules and principles ONCE upfront so the fix can be implemented inline without re-loading on each delegation.

**Read in parallel (rules + principles):**
1. `.unikit/system/dev-principles.md` — engine development principles
2. `.unikit/RULES.md` — project overrides (highest priority)
3. `.unikit/memory/code/RULES_INDEX.md` — index of core/stack rules
4. For EACH row in the Core table where Required By = `all` or contains `unikit-fix` — read that file from `.unikit/memory/code/core/` using the Read tool.

Stack rules are loaded on-demand later — when investigation reveals which framework is involved (e.g. R3, Zenject, UniTask).

**Engine-MCP rules (conditional, engine-neutral) — once per session, zero calls:**

5. `.unikit/system/engine-mcp/INDEX.md`, **base section only** — the delivery stamp (`server:`) plus every section **except** the `## Check` table — access, the live failure classes, shape and cost, what is irreversible, the lane, and what to do when the file is silent. Those are the exceptions that hold for every task here. **Do not read the `## Check` table now** — it is grepped per editor task, by area (Step 3).
6. `.unikit/MCP-RECHECK-NOTES.md`, **header only** (`server:` / `audited:`) — this project's own accumulated findings. Compare that header against the delivery stamp from item 5. On a mismatch print exactly one line and **apply the entries anyway**:

   ```
   WARN [engine-mcp] notes header ≠ configured server (<notes> ≠ <configured>)
   ```

   The entries are *suspect*, not void, and a suspect check still fails safe. Retiring them belongs to `/unikit-mcp-audit`, never to this skill.

**Either file absent → skip it, print one line, and continue with every right you had:**

```
MCP rules: no INDEX.md — no known exceptions for this server, rights unchanged
```

No rules means no known exceptions, never no capabilities. Absence never disables the engine MCP and never turns a target into `⏸️ MANUAL` (`.unikit/system/dev-principles.md` → **A9**).

**Lifted gates come from a verdict, not from a server profile.**

`GATE LIFTED` is a **runtime verdict of `/unikit-verify`** — reached by trying, finding no affordance, and producing the evidence of that absence. This skill has no direct channel to the per-gate calibration and will not grow one: that calibration is verify's, and splitting it across two readers is how two skills come to disagree about what is lifted. Read the **verdict** instead — the last ```unikit-gate-result``` fenced block of the most recent `/unikit-verify` run, per `.unikit/system/gate-result-contract.md`.

- A verdict exists → honour exactly what it lifted, and nothing beyond it.
- **No verdict** (verify has not run) → **nothing is lifted.** Do not infer a lifted gate from an indirect signal, and do not report success on the strength of one. The obligation stands until a real run lifts it — that is what monotonicity means here.

**Read `.unikit/skill-context/unikit-fix/SKILL.md`** — MANDATORY if the file exists.

This file contains project-specific rules accumulated by `/unikit-evolve` from patches,
codebase conventions, and tech-stack analysis. These rules are tailored to the current project.

**How to apply skill-context rules:**
- Treat them as **project-level overrides** for this skill's general instructions
- When a skill-context rule conflicts with a general rule written in this SKILL.md,
  **the skill-context rule wins** (more specific context takes priority)
- When there is no conflict, apply both: general rules from SKILL.md + project rules from skill-context
- Do NOT ignore skill-context rules even if they seem to contradict this skill's defaults —
  they exist because the project's experience proved the default insufficient

**Load patches** from `.unikit/code/patches/` if the directory exists:

- **If skill-context exists** → do NOT read all patches (skill-context already contains distilled lessons from `/unikit-evolve`). Optionally: read a targeted subset — patches whose Tags or Files overlap with the current bug (match by keywords from `$ARGUMENTS`)
- **If skill-context does NOT exist** → read only the last 10 patches (by filename descending, filenames are `YYYY-MM-DD-HH.mm.md`) for baseline context
- If the current problem resembles a past patch — apply the same approach or avoid the same mistakes
- This is accumulated experience. Use it.

---

## Step 1: Understand the Problem & Choose Mode

From `$ARGUMENTS`, identify:
- Error message or unexpected behavior
- Where it occurs (file, class, method, {{engine_name}} component)
- Steps to reproduce (if provided)
- {{engine_name}} console output (errors, warnings, stack traces)

If unclear, ask:
```
To fix this efficiently, I need more context:

1. What is the expected behavior?
2. What actually happens?
3. Is there a stack trace or {{engine_name}} Console log?
4. When did this start happening?
```

### When the symptom lives in the editor, not in the source

Investigation splits by where the symptom actually lives. The code-research delegates read the
**source** — their tools are enough there. The editor rungs below are walked by **the skill body
itself**: every one of them is a call to the engine MCP, and those grants are held by this skill,
not by whatever it delegates to. Both modes pass through here, so the ladder is available on the
planning path and on the immediate-fix path alike.

Take the rungs in order — cheapest deterministic signal first, most expensive probe last — and
stop at the first one that names a cause. Each rung is a **class of signal**, never a tool; the
vocabulary is the one `.unikit/system/dev-principles.md` → **D2** uses. D2 answers *is there such
a signal at all*; this ladder answers *in which order to take them*.

1. **Console delta from a marker** — place the marker, reproduce, read only what appeared after it.
2. **Compilation diagnostics with coordinates** — a build that does not pass explains most symptoms before any state is worth reading.
3. **A narrow structural read** — the one object or component the symptom points at, not the tree around it.
4. **A targeted probe chosen by the symptom** — read the state the symptom claims is wrong, directly.
5. **A deterministic behaviour run** — a test with a readable result, or a scripted run.
6. **A frame** — **only** when the symptom is visual.

Three rules hold across the whole ladder:

- **Reproduce once.** One reproduction, and only where reproducing is safe. A symptom that damages state on the way is described from what you already have, not re-triggered.
- **No identical call twice without new evidence.** The same call with the same arguments against the same state is not a second observation; it is the first one, paid for twice.
- **A visual symptom directs the diagnosis, it does not close it.** A frame tells you where to look. The evidence is the state you read afterwards.

**Report every rung you walk.** One line per rung, in the order you took them:

```
rung <N> — <signal class> → <raw observation>
```

A rung skipped on purpose is named with its reason (`rung 6 — frame → skipped, the symptom is not
visual`). Without these lines the ladder is indistinguishable from prose: nobody can check that the
expensive probe came *after* the cheap one rather than *instead of* it.

---

**After understanding the problem, ask the user to choose a mode:**

```
How would you like to proceed?

Options:
1. Fix now — investigate and fix immediately
2. Plan first — create a fix plan for review, fix later
```

Based on choice:
- Fix now → skip Step 1.1, proceed to **Step 2: Investigate**
- Plan first → proceed to **Step 1.1: Create Fix Plan**

---

## Step 1.1: Create Fix Plan

Investigate the codebase enough to understand the problem and create a plan.

**Use the same parallel exploration approach as Step 2** — launch 2-3 Explore tasks (`Agent(subagent_type: Explore, model: sonnet, ...)`) to investigate the problem. Design prompts based on the specific bug context.

**Fallback:** If Agent tool is unavailable, investigate directly using Glob/Grep/Read.

For a symptom that lives in the editor rather than in the source, walk the rungs from Step 1 yourself — the delegates cover the source half only.

After tasks return, synthesize findings to:
1. Identify the root cause (or most likely candidates)
2. Map affected files and functions
3. Assess impact scope

The synthesis is written in the **diagnosis contract** below — six fields, `## Analysis` in the plan file.
`.unikit/system/dev-principles.md` → **A1** covers a different moment: `CLAIM / EVIDENCE / VERDICT` reports
**finished** work and ends in a binary verdict. A diagnosis is **unfinished** work — it has no verdict to give,
so it carries a boundary and a named list of what is still a guess instead. The two do not compete and neither
replaces the other.

Then create `.unikit/code/FIX_PLAN.md`:

```markdown
# Fix Plan: [Brief title]

**Problem:** [What's broken — from user's description]
**Created:** YYYY-MM-DD HH:mm

## Analysis

The diagnosis contract — six fields, and every one of them is filled:

- **Symptom:** what is observably wrong, in the terms it actually presents in.
- **Evidence:** the raw observations the diagnosis rests on — a console line, a diagnostic with coordinates, a value read back. A retelling is not evidence: write down what you saw, not what it meant to you.
- **Boundary:** how far the investigation actually reached, and therefore what it does not cover.
- **Probable cause:** the mechanism that explains the symptom, stated as the candidate it still is.
- **Next action:** the single step the fix starts with.
- **Unverified:** what remained a hypothesis. **This field is never empty.** When everything was verified it reads `nothing` — a deliberate statement, not an omission. A hypothesis that goes unnamed here is read as established by whoever implements the fix.

## Fix Steps

Step-by-step plan for implementing the fix:

1. [ ] Step one — what to change and why
2. [ ] Step two — ...
3. [ ] Step three — ...

## Files to Modify

- `path/to/File.cs` — what changes are needed
- `path/to/Another.cs` — what changes are needed

## Risks & Considerations

- Potential side effects
- Things to verify after the fix
- Edge cases to watch for
- Engine-specific concerns (companion files, serialization, module boundaries)

## Test Coverage

- What tests should be added (NUnit, AAA pattern)
- What edge cases to cover
```

**After creating the plan, output:**

```
## ✅ Fix Plan Created

Plan saved to `.unikit/code/FIX_PLAN.md`.

Review the plan, and when ready:

/unikit-fix
```

**STOP here. Do NOT apply the fix.**

---

## Step 2: Investigate the Codebase

**Use Explore tasks to investigate the problem in parallel.** This keeps the main context clean and allows simultaneous investigation of multiple angles.

Launch 2-3 Explore tasks simultaneously:

```
Task 1 — Locate the problem area:
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Find code related to [error location / affected functionality].
   Read the relevant classes, trace the data flow.
   Thoroughness: medium.")

Task 2 — Related code & side effects:
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Find all callers/consumers of [affected class/method].
   Check Zenject bindings and installers that wire this up.
   Identify what else might break or be affected.
   Thoroughness: medium.")

Task 3 — Similar past patterns (if patches exist):
Agent(subagent_type: Explore, model: sonnet, prompt:
  "Search for similar error patterns or related fixes in the codebase.
   Check git log for recent changes to [affected files].
   Thoroughness: quick.")
```

**After tasks return, synthesize findings to identify:**
- The root cause (not just symptoms)
- Related code that might be affected
- Existing error handling
- DI bindings that wire the affected components
- Whether the issue is in a Module or Game script (affects where the fix goes)

**Fallback:** If Agent tool is unavailable, investigate directly using Glob/Grep/Read — find relevant files, read the code around the issue, trace the data flow, check for similar patterns.

For a symptom that lives in the editor rather than in the source, walk the rungs from Step 1 yourself — the delegates cover the source half only.

**Report the synthesis in the diagnosis contract** — the same six fields Step 1.1 writes into `## Analysis`
(symptom · evidence · boundary · probable cause · next action · unverified). On this path there is no plan file,
so the contract goes into the session output; **Unverified** is filled here too, and reads `nothing` only when
nothing was left to guess. Step 3 fixes what this contract established, not what it merely suspected.

---

## Step 3: Implement the Fix

This skill OWNS code-writing for fixes. Implement inline using `Read/Edit/Write/Bash` with the rules already loaded in Step 0.2 Bootstrap. Do NOT invoke `/unikit-devcontext` via `Skill(...)`.

Choose execution mode:
- **Default (single-file or tightly-scoped fix)** → inline implementation.
- **Complex fix from FIX_PLAN.md with extensive codebase exploration or independent multi-file changes** → spawn `develop-agent` to isolate context.

When implementing inline, apply:
- Root cause analysis from Step 2
- Specific files and lines to modify
- Expected behavior after the fix
- The principles from `dev-principles.md` (no inline comments, update docs, etc.)

**Fallback:** If `Agent` tool is unavailable, do NOT invoke `/unikit-devcontext` inline. Implement directly with the loaded rules — Bootstrap already covers everything needed.

**When the fix touches the editor's serialized state** — a scene, a prefab, a component, an asset, UI, VFX, animation, project settings — rather than source text, carry it out through the engine MCP in this order:

1. **Candidates from the live catalog, by intent.** Pick 3-5 candidate affordances from the tool list you actually hold. That list is the only place a name may come from — not this file, not a rules file, not memory. A name recalled instead of read is a `catalog phantom` you invented.
2. **Ask the server for the schema** of those 3-5 before calling any of them. A one-line or empty declaration does not mean "no parameters".
3. **Grep by area.** Read the `## Check` table of `.unikit/system/engine-mcp/INDEX.md` and of `.unikit/MCP-RECHECK-NOTES.md`, filtered to the area this change belongs to **plus every cross-cutting area**: `rollback · console · batch · compile · transport · visual`. The cross-cutting six are read **always**; the lines are short, and the moment one becomes applicable is not knowable in advance.
4. **Execute, then read the changed state back.** Close the claim with the evidence class its claim class requires (`dev-principles.md` → A2). A response code is not evidence.

**No rules file, or no check line for this area → nothing changes.** Every right you had, you keep: an absent exception is not an absent capability, and it is never a reason to declare the fix impossible or to mark it `⏸️ MANUAL` (A9).

**A call that misled you is a finding — and it goes in two places, neither of them the notes file.** Put it in the fix report as a candidate line (the `area`, what has to be confirmed, the raw call with the raw answer), and — when this fix is running against a plan — into that plan's `## MCP Findings` table. **Never write `.unikit/MCP-RECHECK-NOTES.md` from here:** one observation is a bad sample and a bad line lives for months, so the durable surface passes through a human running `/unikit-mcp-trap`.

**The library reference — two triggers, and never on Bootstrap.**

Reach for it on exactly two occasions:

1. **an unfamiliar area** — what approaches the authors propose; once per area per session;
2. **a dead end** — you hold the schema and the capability still is not there.

**Never routinely, and never at Bootstrap.** It is a network dependency inside the editor lane, a few thousand tokens per query, and it makes the run irreproducible — two runs of the same plan diverge. It also mixes a source with a systematic bias toward confidence into the hot path: retrieval returns what is most relevant, and a caveat is almost never the most relevant answer to "how do I do this".

**The identifier is already known.** It is carried in the header of `.unikit/system/engine-mcp/INDEX.md`, which names the reference for the configured server — so nothing has to be resolved at run time.

**Say when you reached for it, and why.** One line into the run report, at the moment of the call — the network was touched and the report has to show it:

```
Reference: trigger <1|2> — <the area, or the dead end>
```

Without it the run reads as if everything came from observation, which is exactly the confusion a source biased toward confidence should not get for free.

**How the answer is treated.** The reference describes **intent, not behaviour**. Anything taken from it carries the same evidence obligations as anything else, and with heightened attention: it has been caught presenting a structurally broken path as an exemplary example. It never closes a claim — only an observation does (`dev-principles.md` → A2).

**The reference is optional in the wizard.** If it was not configured, trigger 2 simply has no fallback: descend the degradation ladder (`dev-principles.md` → D3) and reach `⏸️ MANUAL` at its proper rung only — by absence of a route, established by trying. An unconfigured reference is not itself a missing capability.

After the fix is implemented, you MUST continue through ALL remaining steps (4 → 5 → 6 → 7).

---

## Step 4: Verify the Fix

### 4.1 {{engine_name}} Compile Check

Use MCP server `{{engine_mcp_tool}}` to check that the project compiles after the fix:
- Refresh/recompile the project through MCP server `{{engine_mcp_tool}}`
- Check the {{engine_name}} console for compilation errors
- If errors found — display them with `file:line` references and fix them
- If MCP server `{{engine_mcp_tool}}` is unavailable — skip and note: `Compilation check: engine MCP unavailable, skipped`

### 4.2 {{engine_name}} Test Run

Use MCP server `{{engine_mcp_tool}}` to run tests for the affected module:
- Determine which test assembly covers the modified module (check CLAUDE.md for the list of test assemblies)
- Run the relevant test assembly through MCP server `{{engine_mcp_tool}}`
- Wait for results and display them — highlight any failures
- If tests fail because of the fix — investigate and fix the regression
- If MCP server `{{engine_mcp_tool}}` is unavailable — skip and note: `Test run: engine MCP unavailable, skipped`

### 4.3 Engine Companion Files

Some engines require companion/metadata files for every asset.
Read `.unikit/DESCRIPTION.md` to determine if the current engine has such a mechanism. If yes — verify consistency for any created or deleted source files:
- Every new source file has a paired companion
- Every deleted source file has its companion also deleted
- New directories have companion files
If the engine has no companion file mechanism — skip this check.

### 4.4 Module Boundary Check

Verify the fix doesn't violate module boundaries defined in `.unikit/ARCHITECTURE.md`.
For each modified source file in a module directory: check that imports don't reference forbidden dependency directions (as specified in the architecture doc).

### 4.5 Naming Convention Check

For any new source files, verify naming/namespace follows the convention table from `.unikit/ARCHITECTURE.md`.

---

## Step 5: Suggest Test Coverage

**ALWAYS suggest covering this case with a test:**

```
## Fix Applied

**Problem:** [brief explanation]
**Root cause:** [root cause]
**Fix:** [what was changed]

### Recommendation: add a test

This bug should be covered with a test to prevent regression:

```csharp
[Test]
public void MethodName_WhenCondition_ShouldExpectedBehavior()
{
    // Arrange
    var input = /* the problematic input */;

    // Act
    var result = sut.MethodName(input);

    // Assert
    Assert.That(result, Is.EqualTo(expected));
}
```

Create the test?
1. Yes — create the test
2. No — skip
```

Based on choice:
- Yes → write the test inline using `Read/Edit/Write` with the rules and principles loaded in Step 0.2 Bootstrap. Use `develop-agent` only if the test requires extensive codebase exploration. Do NOT invoke `/unikit-devcontext` via `Skill(...)` — Bootstrap already covers everything.
- No → skip, proceed to Step 6 (patch creation)

**The patch in Step 6 is mandatory regardless of the test decision.**

---

## Step 6: Create Self-Improvement Patch

**ALWAYS create a patch after every fix.** This builds a knowledge base for future fixes.

1. Create directory if it doesn't exist:
   ```bash
   mkdir -p .unikit/code/patches
   ```

2. Create a patch file: `YYYY-MM-DD-HH.mm.md` (e.g., `2026-03-09-14.30.md`)

3. Use this template:

```markdown
# [Brief title describing the fix]

**Date:** YYYY-MM-DD HH:mm
**Files:** list of modified files
**Severity:** low | medium | high | critical

## Problem

What was broken. How it manifested (error message, wrong behavior).
Include the actual error or symptom.

## Root Cause

WHY the problem occurred — not "what was wrong" but "why it was wrong":
- Logic error? Why was the logic incorrect?
- Missing null check? Why was it missing?
- Wrong assumption? What was assumed?
- Race condition? What sequence caused it?
- DI misconfiguration? What binding was wrong?

## Solution

How the fix was implemented. Key code changes and reasoning.
Include the approach, not just "changed line X".

## Prevention

How to prevent this class of problems in the future:
- What pattern/practice should be followed?
- What should be checked during code review?
- What test would catch this?

## Tags

Space-separated tags for categorization, e.g.:
`#null-check` `#async` `#zenject` `#r3` `#unitask` `#serialization` `#mono-behaviour`
```

**This is NOT optional.** Every fix generates a patch. The patch is your learning.

---

## Step 7: Post-Fix Actions

### 7.1 Summary

```
## Fix Applied

**Problem:** [what was broken]
**Root cause:** [root cause]
**Fix:** [what was changed]

**Modified files:**
- path/to/File.cs (line X)

**Compilation:** pass / skipped
**Tests:** pass / skipped
**Test suggested:** Yes
**Patch created:** .unikit/code/patches/YYYY-MM-DD-HH.mm.md
```

### 7.2 Evolve Suggestion

Count only **unprocessed** patches — those created after the cursor in `.unikit/evolutions/patch-cursor.json`:

1. Read `.unikit/evolutions/patch-cursor.json` (if exists) → extract `last_processed_patch` filename
2. Glob all `*.md` in `.unikit/code/patches/`, sort lexicographically
3. Count only patches with filename **greater than** `last_processed_patch` (or all patches if cursor file doesn't exist)
4. If **3 or more unprocessed** patches, suggest:

```
⚠️ You have N unprocessed patches (since last /unikit-evolve). Consider running /unikit-evolve
to feed lessons learned back into skills and prevent recurring issues.
```

Do NOT count already-processed patches — they have already been analyzed by `/unikit-evolve`.

### 7.3 Check TODO.md

After the fix, check if any open tasks in the project TODO list were resolved:

1. Check if `.unikit/TODO.md` exists. If not — skip this step.
2. Read `.unikit/TODO.md` and collect all unchecked tasks (`- [ ]`).
3. Compare each unchecked task against the fix just applied — match by semantic similarity to the bug description, modified files, classes, or methods.
4. If matching tasks found — change `- [ ]` to `- [x]` directly in `.unikit/TODO.md` using the Edit tool. No agents or skills needed.
5. If no matching tasks found — skip silently.

### 7.4 Verify or Commit

```
✅ Fix applied. What's next?

Options:
1. 🔍 Verify first — /unikit-verify → /unikit-commit (recommended)
2. 💾 Skip to commit — /unikit-commit directly
```

Based on choice:
- Verify first → run `/unikit-verify`, after it completes run `/unikit-commit`
- Skip to commit → run `/unikit-commit` directly

Stage ONLY files modified by the fix.

### 7.5 Clean Up FIX_PLAN.md

If the fix was executed from an existing `.unikit/code/FIX_PLAN.md`:

```bash
rm .unikit/code/FIX_PLAN.md
```

This happens only after all verification (Step 4), test suggestion (Step 5), and patch creation (Step 6) are complete.

### 7.6 Context Cleanup

Suggest the user to free up context space if needed: `/clear` (full reset) or `/compact` (compress history).

---

## Examples

### Example 1: NullReferenceException

**User:** `/unikit-fix NullReferenceException in CustomerFactory.Create() when spawning customer`

**Actions:**
1. Load patches, check skill-context
2. Search for `CustomerFactory` class
3. Find where null access occurs in `Create()`
4. Trace the data flow — check DI bindings, constructor injection
5. Add null check or fix the missing binding
6. Verify compilation
7. Suggest NUnit test for null case
8. Create patch

### Example 2: MissingReferenceException

**User:** `/unikit-fix MissingReferenceException when customer leaves shop — accessing destroyed GameObject`

**Actions:**
1. Investigate the problem area (likely R3/async lifecycle issue)
2. Find where destroyed object is accessed
3. Check if R3 subscription outlives the GameObject — missing `.AddTo()`
4. Fix the subscription lifecycle
5. Verify compilation and tests
6. Create patch with `#r3` `#lifecycle` tags

### Example 3: Zenject Binding Error

**User:** `/unikit-fix ZenjectException: Unable to resolve ICustomerSystem`

**Actions:**
1. Investigate the problem area (DI binding issue)
2. Search for `ICustomerSystem` interface and its implementation
3. Find the installer that should bind it
4. Fix the missing or incorrect binding
5. Verify compilation
6. Create patch with `#zenject` `#di` tags

---

## Important Rules

1. **Check FIX_PLAN.md first** — always check `.unikit/code/FIX_PLAN.md` before anything else
2. **Plan mode = plan only** — when user chooses "Plan first", create the plan and STOP. Do NOT apply the fix
3. **Execute mode = follow the plan** — when FIX_PLAN.md exists, follow it step by step. Deletion happens in Step 7.5
4. **Load patches and skill-context** — learn from past fixes before investigating
5. **Code-writing is owned by this skill** — fixes are implemented inline using `Read/Edit/Write/Bash` with the rules loaded in Step 0.2 Bootstrap. Delegate to `develop-agent` ONLY for complex fixes requiring extensive codebase exploration. Never invoke `/unikit-devcontext` via `Skill(...)` from this workflow.
6. **ALWAYS suggest tests** — NUnit, AAA pattern, fakes in separate files
7. **ALWAYS create patch** — every fix generates a `.unikit/code/patches/` entry
8. **Root cause, not symptoms** — fix the actual problem. Don't refactor unrelated code, don't add features
9. **Minimal scope** — one fix at a time, no scope creep
10. **Clean up FIX_PLAN.md** — deleted in Step 7.5 after all verification completes
11. **Respond in the configured language** — use `language.ui` from `.unikit/config.yaml` (default: English)
12. **Ownership boundary** — `/unikit-fix` owns `.unikit/code/FIX_PLAN.md` and `.unikit/code/patches/*.md`; all other `.unikit/` artifacts are read-only
13. **Never modify third-party code** — `Assets/Third-Party Assets/` and `Assets/Plugins/` are off-limits
