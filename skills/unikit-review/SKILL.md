---
name: unikit-review
description: Perform a code review on {{engine_name}} {{engine_code_language}} code. Checks for bugs, security issues, performance problems, and best practices against the project's coding rules, design principles, and framework-specific conventions. Supports four modes — staged changes, a pull request, a commit range, or individual files. Use when the user says "review code", "check my code", "code review", "review PR", "review staged changes", "review these commits", or "is this code okay". Optional +check flag validates findings via a fresh-context subagent.
argument-hint: "[+check] [script.cs ... | @folder ... | PR number | branch/commit/tag | empty]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(find *)
  - Bash(wc *)
  - Bash(git *)
  - Bash(gh *)
  - Agent
  - AskUserQuestion
---

# {{engine_name}} Code Reviewer

Analyze {{engine_code_language}} code against the project's coding rules and produce a structured review report.

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

> **`+check` carve-out:** the optional `+check` findings validator (Step 4.5) is **exempt** from the rule above. If its validator agent is unavailable or blocked, render the review as drafted and emit a single `WARN [+check]` line — never ask the user. See `references/CHECK-MODE.md`.

## Step 1: Load rules

Read (they always apply):
- `.unikit/ARCHITECTURE.md` — module boundaries, dependency rules
- `.unikit/ROADMAP.md` (if present) — milestone alignment
- `.unikit/system/gate-result-contract.md` — schema for the machine-readable `unikit-gate-result` block emitted in Step 5. If missing or unreadable, do not block: the Step 5 gate-result section is self-sufficient on the schema and degrades gracefully (see there).

Read `.unikit/memory/code/RULES_INDEX.md`. Load rules:
- **RULES.md**: ALWAYS read `.unikit/RULES.md` first (highest priority)
- **Core**: read the Core table. For EACH row where Required By = `all` or contains `{{self_name}}` — read that file from `.unikit/memory/code/core/` using the Read tool. Do NOT skip any matching row. Always re-read at skill start, never rely on prior conversation cache
- **Stack**: load dynamically when the current task or context matches "Load When" column, or when a need arises during work

Read `.unikit/skill-context/{{self_name}}/SKILL.md` if it exists — project-level overrides that win over this SKILL.md when conflicting.

## Step 2: Route argument and get code

**Parse `+check` first.** If `$ARGUMENTS` contains the `+check` token, strip it out (remember `check = true`) before running the routing chain below, so it is never mistaken for a file path or git ref. `+check` enables the fresh-context findings validator in Step 4.5; without it, that step is skipped entirely.

### Routing chain

1. **Empty** → Staged mode
2. **Digits / `#N` / PR URL** (e.g. `123`, `#42`, `https://github.com/.../pull/123`) → PR mode. Extract number from URL if needed
3. **Starts with `@`** → File mode (folder). Strip `@`, glob `<path>/**/*.cs`
4. **Contains `.cs`** → File mode (explicit files)
5. **Other** → `git rev-parse --verify <arg>`:
   - Valid → Commits mode
   - Invalid → `AskUserQuestion` (staged / cancel / corrected ref)

> `@` disambiguates folder paths from git refs with `/`.

### Staged mode

1. `git diff --cached` → if empty, `git diff` → if empty, inform and **stop**
2. Extract changed `.cs` files, read full content for stack rule detection

### PR mode

1. `gh pr view <N> --json title,body,baseRefName,headRefName,files`
2. `gh pr diff <N>`
3. Extract changed `.cs` files, read full content for stack rule detection

### Commits mode

1. Validate ref via `git rev-parse --verify`. Invalid → ask user
2. `git log --oneline --reverse <ref>..HEAD` → if empty, inform and **stop**
3. If >20 commits → `AskUserQuestion` (all / last 20 / cancel)
4. `git diff --name-only <ref>..HEAD -- '*.cs'` → read full content for stack rule detection
5. For each commit: `git show <hash> --stat` and `git show <hash>`

### File mode

- `.cs` args: locate via `Glob`/`find`. Name without path → search entire project
- `@folder` args: `Glob <folder>/**/*.cs`. No results → report error, continue with others
- Read full content of all found files for stack rule detection

## Step 3: Load stack rules

Now that target code is available, scan it for framework markers from the **Stack** section of `RULES_INDEX.md`. Each entry lists which keywords/types indicate relevance ("Load When" column). Load only matching rule files. If no markers match — skip stack rules entirely.

## Step 4: Analyze

Apply **all loaded rules** (core + stack + project + ARCHITECTURE.md) uniformly, regardless of mode.

For each file or diff hunk, check:
- **Rule violations** — every loaded rule against the code
- **Architecture alignment** — boundary/dependency violations (e.g. `Modules/ → Game/` forbidden)
- **Roadmap linkage** — for `feat`/`fix`/`perf` work, missing ROADMAP.md milestone link (suggestion only)
- **Removed code** (diff modes) — broken contracts, dangling references

**Commits mode only** — additionally per commit:
- **Message accuracy** — does the message match the actual changes?
- **Atomicity** — single logical unit, or mixed concerns?

### Severity scale

- 🔴 **Critical** — must fix (crashes, silent failures, memory leaks, data corruption)
- 🟡 **Warning** — likely to cause bugs under specific conditions
- 🟠 **Medium** — performance, code smell, maintainability
- 🟢 **Suggestion** — quality improvement

Record exact line numbers (or commit hash + file:line for diff modes) and relevant code snippets.

### General checklist

Always run these checks in addition to project rules. If a finding from the checklist contradicts a loaded project/core/stack rule or ARCHITECTURE.md (i.e. the code follows project conventions) — **suppress the finding**, it is not an issue.

**Correctness:**
- [ ] Logic errors or bugs
- [ ] Edge cases handling
- [ ] Null/undefined checks
- [ ] Error handling completeness
- [ ] Type safety

**Performance:**
- [ ] Memory leaks
- [ ] Inefficient algorithms
- [ ] N+1 query problems

**Best Practices:**
- [ ] Code duplication
- [ ] Dead code
- [ ] Magic numbers/strings
- [ ] Proper naming conventions
- [ ] SOLID principles
- [ ] DRY principle

**Testing:**
- [ ] Test coverage for new code
- [ ] Edge cases tested
- [ ] Mocking appropriateness

## Step 4.5: Validate Findings (`+check` only)

Run this step **only** when `check = true` (the `+check` flag was parsed in Step 2). Draft the full review internally first (all sections of Step 5, including the gate-result inputs), then — **before** rendering anything to the user — run the procedure in **`references/CHECK-MODE.md`**. It dispatches one fresh-context `Agent(subagent_type: Explore, model: sonnet)` validator over the **Findings table** rows (one item per row; "Questions", "Positive notes", and per-commit findings are excluded), applies each `keep`/`modify`/`drop` verdict and any severity move across the four levels (🔴 Critical / 🟡 Warning / 🟠 Medium / 🟢 Suggestion), tracks the `hidden` / `adjusted` / `reclassified` counters, and **recomputes** the `unikit-gate-result` block (Step 5 "Machine-readable gate result") from the post-filter table.

When `+check` ran successfully, append one line after all review sections and before the `unikit-gate-result` fence:

```
Filtered: N hidden, M adjusted, K reclassified by +check
```

**Fallback (do NOT inline-analyze):** if the validator agent is unavailable/blocked or the dispatch fails, keep **all** findings as drafted, do NOT recompute the gate-result block (assemble it from the unfiltered table), and emit the single line `WARN [+check]: validator failed (<reason>), all items kept as-is` above the fence — never re-do the validator's work with Glob/Grep/Read. This `+check` path is exempt from the Subagent-Delegation prerequisite (see the carve-out note above) — an unavailable validator is silently skipped, the user is never asked.

If `+check` is not set, skip this step entirely — no validator-related lines appear and the gate-result block is computed once from the full draft.

## Step 5: Output

All modes use the same report structure. Mode-specific sections are marked below.

```markdown
## Code Review Summary

<!-- PR mode only: -->
**PR:** #[number] — [title]
**Base:** [baseRefName] ← **Head:** [headRefName]
<!-- Commits mode only: -->
**Range:** `<ref>..HEAD`
**Commits Reviewed:** [count]

**Files Reviewed:** [count]
**Risk Level:** 🟢 Low / 🟡 Medium / 🔴 High
**Stack rules loaded:** [list or "none"]

<!-- Commits mode only: -->
### Per-Commit Notes
#### `<short-hash>` — <commit message>
- **Atomicity:** ✅ Good / ⚠️ Mixed concerns
- **Message accuracy:** ✅ Matches / ⚠️ Misleading
- **Issues:** [findings with severity markers, or "None"]

### Findings

| # | Severity | Location | Rule | Issue | Fix |
|---|----------|----------|------|-------|-----|
| 1 | 🔴/🟡/🟠/🟢 | file:L42 | Rule ref | What's wrong | How to fix |

### Code Fixes

<!-- For 🔴 and 🟡 findings, show: -->
**#1 — [issue title]** (`file:L42`)
​```csharp
// ❌ Current
<problematic code>

// ✅ Fixed
<corrected code>
​```

### Questions
[Ambiguous code or design decisions that need clarification from the author]

### Summary

- **Critical:** [count] | **Warning:** [count] | **Medium:** [count] | **Suggestion:** [count]
- **Top issues:** 3 most impactful to fix first
- **Positive notes:** Good patterns observed
```

### 5.1 Machine-Readable Gate Result

> **Mirror of `unikit-verify` Step 4.4** (the canonical template). This section copies that one field-for-field — the only differences are `"gate": "review"` and the projection source (the Findings table below, instead of verify's task-audit + context gates). The graceful-degradation wording and the last-fence rule are kept textually identical to verify's so a single guard locks both; if verify's wording changes, this must change in lockstep.

After the human-readable review above, append exactly one fenced `unikit-gate-result` JSON block. Use the schema loaded from `.unikit/system/gate-result-contract.md` in Step 1.

**Last fence wins:** the `unikit-gate-result` block MUST be the LAST fenced block in this skill's output — orchestrators parse only the last one. Any earlier fence (the example below, quoted prior output) is illustrative and is not the gate result.

**Projection (review):** derive the fields from the Findings table:

- `"gate"`: always `"review"`.
- `"status"`:
  - `fail` — the table has at least one **blocking** finding (🔴 Critical or 🟡 Warning).
  - `warn` — no blocking findings, but the table has 🟠 Medium / 🟢 Suggestion rows.
  - `pass` — the table is empty (no findings).
- `"blocking"`: `true` only when `status` is `fail`.
- `"blockers"`: include **only** the 🔴 Critical and 🟡 Warning rows, each `{ "id", "severity", "file", "summary" }`. Use stable ids (`review-finding-<row#>`). `severity` is `error` for these blocking rows (`warning` only when policy escalates). 🟠 Medium / 🟢 Suggestion rows stay in the human table, never in `blockers`.
- `"affected_files"`: the files the review actually evaluated or cited (not unrelated repo files); empty array when none apply.
- `"suggested_next.command"`: from the allowlist in `gate-result-contract.md` — `/unikit-fix` (code must change), `/unikit-rules` (a rules-gate finding needs a writer update), `/unikit-architecture` (architecture drift), `/unikit-roadmap` (roadmap drift), `/unikit-commit` (clean — natural next step), or `null`.

When `+check` ran (Step 4.5), this projection runs over the **post-filter** table and `suggested_next.reason` notes the `+check` counters; on `+check` whole-dispatch failure the block is assembled from the unfiltered table and is **not** recomputed.

```unikit-gate-result
{
  "schema_version": 1,
  "gate": "review",
  "status": "pass",
  "blocking": false,
  "blockers": [],
  "affected_files": [],
  "suggested_next": {
    "command": "/unikit-commit",
    "reason": "Review found no blocking issues."
  }
}
```

The fenced block contains JSON only — no comments, trailing commas, or prose inside it.

**Graceful degradation:** if `.unikit/system/gate-result-contract.md` is missing or unreadable, do not hard-fail — emit the block from the inline schema in this section; if even that is not possible, skip the block and append the single line `WARN [gate-result]: contract asset unavailable`.

## Guidelines

- Be precise: exact line numbers and code references
- Be actionable: every finding includes a concrete fix
- Be complete: check ALL loaded rules
- No false positives: if uncertain, mark "Potential — verify manually"
- Clean code → say so, don't invent issues
- Read-only: do NOT modify any files
- Be constructive: explain "why", acknowledge good code

## Examples

`/unikit-review` — review staged changes
`/unikit-review PlayerController.cs` — review specific file
`/unikit-review @Assets/Scripts/Player` — review folder recursively
`/unikit-review @Assets/Scripts/Player @Assets/Modules/Wallets` — review multiple folders
`/unikit-review 123` or `/unikit-review #42` — review PR by number
`/unikit-review https://github.com/org/repo/pull/123` — review PR by URL
`/unikit-review master` — review commits vs master
`/unikit-review v1.0.0` — review commits vs tag
`/unikit-review feature/day-loop` — review commits vs branch

> **Tip:** Context is heavy after review. Consider `/clear` or `/compact` before continuing.
