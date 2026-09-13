---
name: unikit-rules
description: >-
  Add a short, project-specific rule, convention, or override to .unikit/RULES.md — the
  quick-capture inbox for this project's rules; each invocation appends a rule,
  automatically loaded by /unikit-implement before execution (later promotable into the
  knowledge base via /unikit-memory migrate-rules). Works only with a rule typed as a
  prompt — it does NOT read files, folders, URLs, or PDFs. Cross-checks against the
  knowledge base (RULES_INDEX.md) to avoid duplicating core/stack entries. Use for fast,
  one-line conventions and corrections: "add a rule", "remember this", "convention",
  "always do X", "never use Y", "from now on do Z", or when the user corrects agent
  behavior and wants it remembered. If the user points to a source (file, folder, URL,
  PDF, article, book) or wants to research/document framework usage, use /unikit-memory;
  for architecture decisions use ARCHITECTURE.md.
argument-hint: "[rule text or topic | numbered batch | compact]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# UniKit Rules — Project Conventions

Add short, actionable rules to `.unikit/RULES.md`. Rules are project-specific overrides that take precedence over the base knowledge rules in `.unikit/memory/code/core/` and `.unikit/memory/code/stack/`.

Before adding any rule, cross-check it against RULES_INDEX.md to avoid duplicating what's already covered in the knowledge base. If a rule is already covered — tell the user and skip. If the rule contradicts or extends an existing knowledge base rule — add it as an explicit override to RULES.md with a note about what it overrides.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

Skill-specific rule:
- If the user provides a rule in a non-English language, translate it to English before writing to `.unikit/RULES.md`

## Workflow

### Step 0: Load Skill Context

Read `.unikit/skill-context/unikit-rules/SKILL.md` if it exists. Treat it as project-level overrides — when it conflicts with this SKILL.md, the skill-context wins.

### Step 1: Determine Mode

```
Check $ARGUMENTS:
├── Exactly `compact`? → Mode C: retro-compaction
├── Numbered batch?    → Mode A: Direct add, N rules
├── Has text?          → Mode A: Direct add, 1 rule
└── No arguments?      → Mode B: Interactive
```

**Mode C is matched on an exact argument, never on containment.** A rule that happens to
contain the word "compact" is still a rule, and only the bare argument `compact` selects the
retro mode.

**Mode A** — user provided rule text:
```
/unikit-rules Never use var, always explicit types
```
→ Proceed to Step 2 with the provided text.

**Mode A, batch form** — the argument carries several rules at once. It is a **numbered
batch** when two or more lines begin with `^\d+\. ` at column zero. Each rule starts at
such a marker and runs to the next one, or to the end of the input:

```
/unikit-rules 1. Constructor null checks MUST be symmetric across injected dependencies.
2. Event subscriptions go before any fallible operation in OnInit; unsubscribe in OnExit
   even when OnInit threw.
3. Never call DiResolver.Resolve<T>() without a null guard — throw, do not warn.
```

Why the numeral and not a newline or a `- ` bullet: a rule that cannot be reduced to one
directive is written as it stands (Step 4), so a bare line break does not reliably separate
two rules, and `- ` is the element format of `RULES.md` itself and appears **inside** a rule.
A numbered element never does, so `^\d+\. ` at column zero cannot collide with content.

Run Steps 2-5 per rule and report all of them together in Step 6. One rule and N rules
differ only in how many rows the report carries.

**Mode B** — no arguments:
→ Ask the user what rule to add. Offer examples relevant to {{engine_name}}/{{engine_code_language}}:
```
What rule or convention would you like to add?

Examples:
- Never use var — always declare explicit types
- MonoBehaviour injection via public Construct() with [Inject]
- All async methods must accept CancellationToken as last parameter
- Use canvas.enabled instead of SetActive for UI toggling
- Factory classes instead of Zenject PlaceholderFactory
```

### Step 2: Cross-Check Against Knowledge Base

This step prevents duplication and helps maintain a clean separation between project rules and knowledge base rules.

1. **Read `.unikit/memory/code/RULES_INDEX.md`** — get the list of all rule files with their descriptions and "Load When" hints.

2. **Identify potentially overlapping rule files** — based on the topic of the new rule, find rule files from the index that cover the same area. For example:
   - Rule about naming → check `code-style.md`
   - Rule about async/UniTask → check `reactive-async.md`
   - Rule about Zenject → likely already in `RULES.md` or `design-principles.md`
   - Rule about Odin attributes → check `odin.md`

3. **Read the relevant rule file(s)** — only the ones that might overlap (not all of them).

4. **Determine the relationship:**

   | Situation | Action |
   |-----------|--------|
   | Rule already exists with the same meaning | Tell user: "This is already covered in `{file}`: {quote}". Skip. |
   | Rule contradicts an existing knowledge base rule | Add to RULES.md with override note. Tell user what it overrides. |
   | Rule extends/narrows an existing rule | Add to RULES.md. Mention the related base rule for context. |
   | Rule covers a new topic not in knowledge base | Add to RULES.md. |

### Step 3: Read or Create RULES.md

Check if `.unikit/RULES.md` exists.

**If it does NOT exist** → create it:

```markdown
# Project Rules

Project-specific rules that override or extend the base knowledge rules in `.unikit/memory/`.
One rule per line, one directive per rule. No sections.

---

- [new rule here]
```

**If it exists** → read it and append to the end of the list.

### Step 4: Append the Rule

`.unikit/RULES.md` is a **flat list**. There are no sections: the rule is appended to the end of the list as a `- ` item. Choosing or creating a `## Section` is no longer part of this skill, and existing sections are never recreated.

**The rule's form is constrained by shape, not by a number:**

- **One line. One directive.** A short "why" may share that same line where it earns its place.
- Directive language — "Never…", "Always…", "Use…".
- **There is no numeric limit.** This skill does not count characters and **prints no service line about length**, neither in the rule nor in the report.
- **What never goes into a rule:** its origin ("Found in Task 14.3"), the story of the incident, a description of how the code is currently built, a task or phase number. History lives in git and in the patches; the current shape of the code lives in `ARCHITECTURE.md`.
- A duplicate by meaning is skipped, exactly as before.
- **A rule that cannot be reduced to one directive without losing knowledge is written as it stands**, and is marked in no way at all. This skill does not refuse, does not truncate, and **does not recommend moving the rule into the knowledge base** — that transfer is something the user starts, and offering it on every rule would be precisely the service noise this form exists to remove.

**When the existing file already has sections**, the rule is appended at the end of the file and those sections are left untouched and unreformatted. Silently restructuring the user's own file during an ordinary add is not allowed: flattening belongs to Mode C, and it happens only on confirmation.

### Step 5: Also Check Existing RULES.md

Before writing, verify the new rule doesn't duplicate something already in RULES.md itself (not just the knowledge base). Read through existing rules and check for semantic overlap.

### Step 6: Write and Confirm

Use `Edit` to add the rule(s). Then report — **one row per input rule, skipped ones
included**:

```markdown
## Batch result — N rules

| # | Outcome | Cross-check |
|---|---------|-------------|
| 1 | added | no overlap |
| 2 | already-covered | core/reactive-async.md |
| 3 | added | extends code-style.md |
| 4 | skipped-duplicate | same meaning as existing entry |
```

Outcomes, and nothing else:

- `added` — written into `.unikit/RULES.md`
- `already-covered` — the knowledge base already carries it (Step 2); `Cross-check` names the file
- `skipped-duplicate` — `RULES.md` already carries the same meaning (Step 5)

**A rule with no row in the report was not processed.** That is the fourth outcome, and it
is expressed by absence rather than by a token because absence is how it actually happens —
a run that ends early leaves no row to write.

**A batch is not atomic: a partial write is a normal outcome, and the report is the only
way to learn which part landed.** Do not roll back written rules because a later one
failed, and do not suppress the table when only some rules were processed.

A single-rule call renders the same table with one row. There is no second format.

There is no `Section` column any more: the list is flat, so there is no landing place left to
record, and a column whose every value would be `—` is exactly the mandatory empty cell the
formats of this repository forbid.

If the input looked like a numbered batch but parsed as one rule, say so in the report
instead of silently writing the whole text as a single `RULES.md` entry.

## Mode C: Compact an existing RULES.md

A retro mode. It edits a file inside the user's project, so it runs **only on confirmation** and is non-destructive: content is moved, never dropped.

1. Read `.unikit/RULES.md`. No file → say so and stop.
2. Parse it into `- ` items, preserving their order. A section (`## …`) is not an item: its heading goes away, and the items beneath it join the single list in the same order they had.
3. Decide an outcome per rule:
   - **`shorten`** — it reduces to one directive without losing knowledge: prepare the short wording;
   - **`keep`** — it does not reduce: it stays exactly as it stands. That is not a defect, and it is not marked;
   - **`flatten-only`** — the rule is already one line; only its place changes, because the section around it is going away.
4. **Print the preview as plain markdown, in a block of its own** — before the question: one line per rule, in the form `before → after` for `shorten`, a single line for the rest. The question mechanism carries the options and nothing else.
5. Ask once: **apply everything / apply only the `shorten` set / cancel**. Without an answer the file is not touched.
6. Write it with `Edit`: a flat list, the order of the rules preserved, section headings removed. **No rule is deleted** — under any outcome. The order is kept by stripping headings rather than by re-sorting: re-sorting would shuffle rules whose sequence the user chose.
7. Report how many `shorten`, how many `keep`, how many `flatten-only`. **Not one line about length in characters**, and no suggestion to move anything into the knowledge base.

This mode touches exactly one file: it never edits `RULES_INDEX.md` and nothing under `.unikit/memory/`.

**Verbose.** One summary line — `INFO [rules] compact: shorten=<a> keep=<b> flatten-only=<c>`; the preview is the detailed output. Cancelled by the user → the file is untouched, and `compact: cancelled, file unchanged` is printed. The file will not parse — not a markdown list, nested structures → write **nothing**, name the places that did not parse, and stop: `WARN [rules] compact: <n> items did not parse — file unchanged`. A half-compacted file belonging to someone else is worse than an uncompacted one.

## Priority Reminder

From RULES_INDEX.md, the override priority (highest wins):

1. `.unikit/RULES.md` — project-specific overrides (what this skill writes to)
2. `.unikit/ARCHITECTURE.md` — project architecture decisions
3. `.unikit/memory/code/core/*.md` — universal best practices
4. `.unikit/memory/code/stack/*.md` — framework-specific knowledge

Rules added by this skill have the highest priority and override everything below them. This is by design — project rules exist precisely to override defaults when the project needs something different.
