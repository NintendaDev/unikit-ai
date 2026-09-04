---
name: unikit-evolve
description: >-
  Learn project rules from accumulated fix patches in .unikit/code/patches/. Analyzes past
  mistakes, extracts prevention points, classifies each as a coding rule (→ RULES.md) or a
  per-skill workflow rule (→ skill-context), and proposes them for approval. Use when the
  user wants to turn past fixes into rules — "evolve", "evolve the rules", "learn from past
  mistakes", "learn from the fixes", "analyze the patches", "what rules should we add from
  recent fixes". Best run after several /unikit-fix sessions have left patches behind. This
  derives rules from accumulated patch history — to add a single rule by hand use
  /unikit-rules, and to promote mature RULES.md entries into the knowledge base use
  /unikit-memory migrate-rules.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Skill
disable-model-invocation: true
user-invocable: true
metadata:
  author: unikit
  version: "2.1"
---

# Evolve — Rules Discovery from Patches

Analyze accumulated patches (past mistakes) and propose new rules: coding rules → `.unikit/RULES.md`, workflow rules → `.unikit/skill-context/<skill>/SKILL.md`.

## Core Idea

```
patches (past mistakes)
    |
extract prevention points (concrete, actionable rules)
    |
classify: coding rule vs workflow rule
    |
cross-check against existing rules (RULES.md + knowledge base + skill-context)
    |
present uncovered candidates to user
    |
user picks → coding rules to RULES.md, workflow rules to skill-context
```

**Two rule destinations:**
- **RULES.md** — coding conventions: HOW to write code (patterns, naming, null-checks, async, serialization). These reach `unikit-devcontext` via RULES.md → `/unikit-memory` → memory/.
- **skill-context** — workflow overrides: HOW a skill should behave (delegation strategy, commit frequency, compilation checks, parallelism). These go to `.unikit/skill-context/<skill>/SKILL.md` and are read by the target skill directly.

Rule migration from RULES.md to core/stack rule files is handled by `/unikit-memory migrate-rules`.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

## Critical: Write Boundary

This skill writes to exactly two destinations plus its own log. Everything else in the
project is READ-ONLY — no exception, no "just this once", no fixing something on the way
past it.

**Writable:**

- `.unikit/skill-context/<skill>/SKILL.md` — workflow rules (Step 6)
- `.unikit/evolutions/*.md` and `.unikit/evolutions/patch-cursor.json` — this skill's own
  log and cursor (Step 7)

**Written ONLY through delegation:**

- `.unikit/RULES.md` — always via `/unikit-rules`. This skill has no direct write path to
  it, and must not create one when the delegation fails. A delegation that wrote nothing is
  reported in Step 7 and leaves the cursor where it stands; it is never worked around by
  writing the file from here.

**READ-ONLY — never `Write`, never `Edit`:**

- `.unikit/system/**` — installer-owned; every `unikit-ai init` / `unikit-ai update`
  rewrites it, so an edit here is lost on the next run and misleading until then
- `{{skills_dir}}/unikit-*/**` — the built-in skills. An override belongs in skill-context;
  that is the whole reason skill-context exists
- `.unikit/memory/**` — owned by `/unikit-memory`
- `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`, `.unikit/ROADMAP.md`
- everything else in the project, including its source code

**The only skill this command may invoke is `/unikit-rules`.** Never `/unikit`, never
`/unikit-memory`, never `/unikit-skills-context` — each of them writes files this command
is not allowed to reach.

## Workflow

### Step 1: Read Patches (Incremental)

```
Glob: .unikit/code/patches/*.md
```

**If no patches found** → report "No patches to analyze" and **STOP**.

**Cursor file:** `.unikit/evolutions/patch-cursor.json`

```json
{
  "last_processed_patch": "YYYY-MM-DD-HH.mm.md",
  "updated_at": "YYYY-MM-DD HH:mm"
}
```

**Processing rules:**

1. Glob patch files and sort by filename ascending (timestamp format is lexical-friendly).
2. If no cursor file exists → first run: read all patches.
3. If cursor file exists and referenced patch is present → read only patches with filename `>` `last_processed_patch`.
4. If cursor file exists but referenced patch is missing (deleted/renamed) → emit `WARN [evolve]` and do a full rescan.
5. **Do not advance cursor in this step.** Cursor is updated only after successful apply in Step 7.

**Overlap window (anti-miss guard):**

LLMs may miss prevention points on a single pass. To reduce the risk:

6. When running in incremental mode, ALSO read the newest min(5, total) patches (tail-5), then de-duplicate.
7. Track separately:
   - "New patches" = patches with filename `>` `last_processed_patch`
   - "Overlap patches" = tail-5 patches
   - "Processed patches" = union(New, Overlap)
8. Cursor updates in Step 7 are based on "New patches" only — never advance cursor when only overlap patches were processed.

Read every patch in the processed set. For each one, extract:
- **Problem categories** (null-check, async, serialization, DI, lifecycle, etc.)
- **Root cause patterns**
- **Prevention points** — each independent actionable rule from the Prevention/Solution section.
  A single patch often contains **multiple independent prevention points**.
  Extract EACH one separately. Do NOT treat a patch as a single unit.
- **Tags**

### Step 2: Load Context

Read the following files:

1. **`.unikit/DESCRIPTION.md`** — tech stack, project constraints
2. **`.unikit/RULES.md`** — current project rules. If doesn't exist, will be created in Step 6
3. **`.unikit/memory/code/RULES_INDEX.md`** — index of knowledge base rule files. If doesn't exist or empty, skip knowledge base cross-check in Step 4 (check only RULES.md)

### Step 3: Build Prevention Point Registry

Build a flat list of ALL extracted prevention points:

```
| # | Patch | Prevention Point (specific action) | Type |
|---|-------|-------------------------------------|------|
| 1 | <patch-file> | <concrete rule to enforce> | code |
| 2 | <patch-file> | <different rule from same patch> | workflow:<skill> |
| 3 | <other-patch> | <rule> | code |
```

**CRITICAL:** A patch with 5 prevention points produces 5 rows, not 1.

**Type classification:**

Each prevention point must be classified:

- **`code`** — about HOW to write code: patterns, null-checks, async handling, serialization, naming, DI registration, lifecycle management. Destination: RULES.md.
- **`workflow:<skill-name>`** — about HOW a skill should behave: delegation strategy, when to compile, commit frequency, parallelism decisions, what to check before/after a step. Destination: `.unikit/skill-context/<skill>/SKILL.md`.

Classification heuristic:
- If the prevention point says "code MUST do X", "always use pattern Y", "never call Z" — it's `code`
- If the prevention point says "skill should check X before Y", "run compilation after each file", "delegate to agent instead of inline" — it's `workflow:<skill>`
- When in doubt, default to `code` — it reaches devcontext through RULES.md → memory/ and applies broadly

### Step 4: Filter — Remove Already Covered

For each prevention point, cross-check against the appropriate destination:

**For `code` type:**
1. **`.unikit/RULES.md`** — is this rule already codified? If RULES.md doesn't exist, no rules are covered — all prevention points are candidates.
2. **Knowledge base via RULES_INDEX.md** — identify relevant rule files by topic, read them, check if covered. If RULES_INDEX.md doesn't exist or is empty — skip this check, use only RULES.md.

**For `workflow:<skill>` type:**
1. **`.unikit/skill-context/<skill>/SKILL.md`** — is this workflow override already recorded?
2. **Base skill `{{skills_dir}}/<skill>/SKILL.md`** — does the base skill already include this behavior?

   Read only. Never edit the base skill — that is what skill-context exists for.

A prevention point is "covered" ONLY when there is a rule that addresses the **specific action described** — not merely the same topic area.

Mark uncovered prevention points as candidates.

**Verification:** Count total, covered, uncovered. If uncovered = 0, report "all prevention points already covered" and skip to Step 7 (log only, no rules added).

### Step 5: Present Candidates to User

Group candidates by type and format each uncovered prevention point:

```
## Rule Candidates

Based on N patches analyzed, M uncovered prevention points found:

### Coding Rules (→ RULES.md)

#### 1. [Rule Name]
- **Source:** patch-YYYY-MM-DD-HH.mm.md
- **Category:** #tag
- **Proposed rule:** "[specific, actionable instruction]"
- **Target section:** [suggested RULES.md section name]

### Workflow Rules (→ skill-context)

#### 2. [Rule Name]
- **Source:** patch-YYYY-MM-DD-HH.mm.md
- **Target skill:** [skill name]
- **Proposed rule:** "[specific, actionable instruction]"
```

AskUserQuestion: Apply proposed rules?

Options:
1. ✅ Apply all
2. 🔍 Let me pick — present in batches of up to 4
3. 🚫 Skip all

Based on choice:
- Apply all → send every code rule to /unikit-rules in one batch, add workflow rules to skill-context
- Let me pick → present batches of up to 4, Apply/Skip per rule
- Skip all → skip rule creation, proceed to cursor update

**Do NOT add any rules until the user answers.**

### Step 6: Add Accepted Rules

**For `code` type** — send every accepted rule to `/unikit-rules` in **one** call.

`.unikit/RULES.md` is not writable from here (see **Critical: Write Boundary**), so this
dispatch is the whole channel for half of this skill's output. Treat a failure to invoke as
a failure to record, not as a reason to write the file yourself.

**Batch format.** A numbered list, one entry per rule, numeral at column zero:

```
1. <rule text, may span lines>
2. <rule text>
```

Number the batch **1..N of its own**, not by the Step 3 registry: that registry mixes
`code` and `workflow:<skill>` rows and only the `code` half travels here. Keep a local
`batch# → prevention point` map — Step 7 reads the report back through it.

**Dispatch — three tiers, in order:**

- **Tier 1 — primary (`Skill`).** `Skill(skill: "unikit-rules", args: "<batch>")` inline.
  This is the path on Claude Code.
- **Tier 2 — fallback (slash-command).** If the `Skill` tool is unavailable in the current
  environment, **invoke `/unikit-rules <batch>` inline**. The slash form is rewritten per
  agent by the installer (Codex `$unikit-rules`, Qwen `/skills unikit-rules`); `Skill(...)`
  is **not** rewritten and non-Claude agents have no `Skill` tool, so without this tier the
  dispatch is dead on 5 of 6 agents. This must be a **real call**, not a printed
  recommendation.
- **Tier 3 — degenerate (print).** Only when **no** inline invocation mechanism exists at
  all, print the `Run: /unikit-rules …` line for the user. Then say plainly that no rule was
  recorded and the cursor will not advance — otherwise the print reads as a result.

<!-- unikit:agents codex -->
## Dispatch — BLOCKING PRE-REQUISITE

When Step 6 reaches the `code`-rule dispatch, the assistant MUST **automatically invoke**
`/unikit-rules` itself — the Tier 1 `Skill(...)` call if available, otherwise the Tier 2
slash-command fallback — and wait for it to return. Do **NOT** print the command and ask
the user to run it: rendering the call instead of executing it is a known failure mode. The
invocation must be a real call, not text wrapped in backticks. The Tier 3 `Run:` print is
reserved for the single case where no inline invocation mechanism exists at all.
<!-- unikit:end -->

The delegate handles everything: cross-check against the knowledge base, dedup against
existing RULES.md entries, section placement, and the report. It returns a
`## Batch result` table with **one row per input rule** and three outcomes — `added`,
`already-covered`, `skipped-duplicate`.

**A rule with no row in the report was not processed.**

**A batch is not atomic: a partial write is a normal outcome, and the report is the only
way to learn which part landed.**

Keep the table — Step 7 counts from it.

**For `workflow:<skill>` type** — add directly to skill-context:

1. Read `.unikit/skill-context/<skill>/SKILL.md` if it exists
2. If file doesn't exist — create it with the standard header:

```markdown
# Project Rules for /<skill-name>

> Managed by `/unikit-evolve` and `/unikit-skills-context`. Do not edit manually.
> Last updated: YYYY-MM-DD HH:mm

## Rules

### [Rule Name]
**Source**: patch-YYYY-MM-DD-HH.mm.md
**Rule**: [Specific, actionable instruction in English]
```

3. If file exists — append new `### [Rule Name]` entry under `## Rules`, update `> Last updated:` line
4. Cross-check against base `{{skills_dir}}/<skill>/SKILL.md` — if base already covers the rule, skip and report.
   Read only. Never edit the base skill — that is what skill-context exists for.

### Step 7: Save Evolution Log & Update Cursor

**7.1: Create evolution log**

Write `.unikit/evolutions/YYYY-MM-DD-HH.mm.md`. `Write` creates the directory when it does
not exist — this skill carries no `Bash` grant, and does not need one:

```markdown
# Evolution: YYYY-MM-DD HH:mm

## Intelligence Summary
- Patches analyzed: X (new: N, overlap: M)
- Prevention points extracted: X
- Already covered: X
- Rules added: X

## Rules Added

- [rule text] <- Source: [patch filename]
  **Section:** [RULES.md section name]

## Patterns Identified
- [pattern]: [frequency] occurrences
```

`Rules added` and every `## Rules Added` entry are counted **from the Step 6 batch-report
table**, not estimated: a row's `Outcome` decides whether the rule is listed, and its
`Section` column fills `**Section:**`. Workflow rules are counted from this skill's own
writes. Do not report a code rule as added on the strength of having dispatched it.

**7.2: Update cursor**

1. If no new patches were processed → keep cursor unchanged.
2. If new patches were processed:
   - Every accepted code rule has a batch-report row (`added` / `already-covered` /
     `skipped-duplicate`), and every accepted workflow rule was written → advance cursor to
     newest "New patch" filename.
   - No rules were accepted (user skipped all) → advance cursor. Patches have been analyzed;
     re-reading them wastes context.
   - **Any accepted code rule has no row, or no report came back at all** (the dispatch
     degenerated to a Tier 3 print, or the delegate returned nothing) → do **NOT** advance.
     Name the pending prevention points and their source patches, and say that re-running
     `/unikit-evolve` will pick them up.
3. If execution fails before changes finalized → do not advance cursor.

The third branch exists because the second one used to swallow it. An approved rule whose
dispatch never reached `/unikit-rules` still looked like a finished run: the cursor moved,
the patch was marked processed, and the tail-5 overlap window bought five patches before the
prevention point was gone for good. Rule 3 does not cover that case — nothing fails, the
delegation just returns something other than a report.

### Context Cleanup

After completing evolution, suggest `/clear` or `/compact` — context is heavy after patch analysis and skill processing.

---

## Rules

1. **Traceable** — every proposed rule must link to a specific patch
2. **Minimal** — add rules to RULES.md, don't rewrite the knowledge base
3. **Reversible** — user approves before any changes are applied
4. **Cumulative** — each evolution builds on previous ones
5. **No hallucination** — only propose rules backed by evidence from patches
6. **English only** — all rules in RULES.md are in English
7. **No generic advice** — "write clean code" is not a rule; only specific, actionable instructions
8. **One prevention point = one rule** — don't merge multiple independent rules into a single vague summary
9. **Preserve concrete formats** — if a patch specifies exact format/syntax/template, the rule must include it verbatim
10. **Ownership boundary** — declared once, in **Critical: Write Boundary** above, and deliberately not restated here: two copies drift, and the one a reader trusts is whichever they reach first. Rule migration from RULES.md to memory/ is handled by `/unikit-memory migrate-rules`

## Example

```
/unikit-evolve

> Analyzed 5 patches (3 new, 2 overlap)
> Extracted 8 prevention points, 6 already covered, ⚠️ 2 uncovered
>
> Rule candidates:
> 1. "Constructor null checks MUST be symmetric..." <- patch-2026-03-10-12.00.md
> 2. "Event subscriptions before fallible operations..." <- patch-2026-03-10-12.00.md
>
> Apply all / Let me pick / Skip all?
```
