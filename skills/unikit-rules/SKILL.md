---
name: unikit-rules
description: >-
  Add a short, project-specific rule, convention, or override to .unikit/RULES.md — the
  quick-capture inbox for this project's rules (common rules always load; topic files in
  .unikit/rules/ load when the work matches), automatically loaded by /unikit-implement
  (later promotable via /unikit-memory migrate-rules). Works only with a rule typed as a
  prompt — it does NOT read files, folders, URLs, or PDFs. Cross-checks against the
  knowledge base (RULES_INDEX.md) to avoid duplicating core/stack entries. Use for fast,
  one-line conventions and corrections: "add a rule", "remember this", "convention",
  "always do X", "never use Y", "from now on do Z", or when the user corrects agent
  behavior and wants it remembered; also "split the rules into topics" (optimise), "clean
  up the rules" (prune), "shorten RULES.md" (compact). If the user points to a source
  (file, folder, URL, PDF, article, book) or wants to research/document framework usage,
  use /unikit-memory; for architecture decisions use ARCHITECTURE.md.
argument-hint: "[rule text or topic | numbered batch | compact | optimise | prune]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(rm .unikit/rules/*)
  - Bash(node *)
---

# UniKit Rules — Project Conventions

Add short, actionable rules to `.unikit/RULES.md` and to the topic files it lists in `.unikit/rules/`. Rules are project-specific overrides that take precedence over the base knowledge rules in `.unikit/memory/code/core/` and `.unikit/memory/code/stack/`.

Before adding any rule, cross-check it against RULES_INDEX.md to avoid duplicating what's already covered in the knowledge base. If a rule is already covered — tell the user and skip. If the rule contradicts or extends an existing knowledge base rule — add it as an explicit override to RULES.md with a note about what it overrides.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

**The language holds for the whole session, not just at load time:** every message until the conversation ends is in `language.ui` — progress notes while agents run, relays of what a subagent returned, the final report, any follow-up discussion. English input (subagent results, tool output, these instructions) is data, never a cue to switch languages.

Skill-specific rule:
- Write every rule — and a topic's title and `Load when` — in the language set by `language.rules` in `.unikit/config.yaml` (default `en`; `.unikit/system/LANGUAGE_RULES.md` → `## Knowledge base rule files`). A rule the user gives in another language is translated into that language before it is written. The layout anchors listed in `## Layout of the rule files` stay English in every language.

## Layout of the rule files

`.unikit/RULES.md` is the **root**, and the only file every reader opens. It takes one of two shapes.

**Flat** — every file until its first topic appears, and every older project:

```markdown
# Project Rules

<header paragraph>

- <rule>
- <rule>
```

**Topics** — common rules in the root, bounded rules in topic files:

```markdown
# Project Rules

<header paragraph>

## Topics

| Topic | Load when |
|-------|-----------|
| [UI views](rules/ui.md) | UI screens, HUD, view models, the `UI/` folder |
| [Save system](rules/save-system.md) | saving and loading, save data, save migrations |

## Common

- <rule>
```

The header paragraph is the same in both shapes. This skill writes it verbatim whenever it creates the root or reorganizes it:

```markdown
Project-specific rules that override or extend the base knowledge rules in `.unikit/memory/`.
One rule per line, one directive per rule. When this file has a `## Topics` table, the rules under `## Common` apply to every task, and a topic file applies when the work matches its "Load when" — check again when the work moves to a new phase or area, and when unsure, load it.
```

It travels with the data, so it instructs even a reader whose skills predate topics.

- **`## Topics` and `## Common` exist together or not at all.** Both appear with the first topic and both go away with the last one. There is never an empty `## Topics`; `## Common` may stay empty while topics exist — it is where new common rules are appended, which is why it is the root's last section.
- **A topic file** is `.unikit/rules/<slug>.md`: the line `# Project Rules — <Title>`, a blank line, and a flat list of rules. It carries no `Load when` of its own: **`Load when` lives only in the root table**, one source that no second copy can contradict.
- **A table row** is `| [<Title>](rules/<slug>.md) | <Load when> |`. `<slug>` is English kebab-case, one to three words, unique among the files in `.unikit/rules/`. `<Load when>` names the area in the words a plan's tasks use — area and feature names, folders, type names, frameworks — and contains no `|`.
- **The `flat` marker** is the line `<!-- unikit:rules-layout flat -->`, placed directly under the root's `# Project Rules` line (as the first line when there is none). It records the user's refusal of the topic layout and means nothing to readers. There is no marker for the topic layout: the `## Topics` table is the sign.
- **Priority.** The root and its topic files together are the project's override level (`## Priority Reminder`). Inside a topic's own area, a topic rule wins over a `## Common` rule it contradicts.
- **Anchors.** `# Project Rules`, the header paragraph, `## Topics`, `## Common`, the header row `| Topic | Load when |`, the marker and the slugs are English in every `language.rules`.

## Workflow

### Step 0: Load Skill Context

**First, announce the mode** (Step 1 → **Announce the mode first**): the argument alone decides it, and its announcement is the run's first output — before this read.

Read `.unikit/skill-context/unikit-rules/SKILL.md` if it exists. Treat it as project-level overrides — when it conflicts with this SKILL.md, the skill-context wins.

### Step 1: Determine Mode

```
Check $ARGUMENTS:
├── Exactly `compact`?             → Mode C: retro-compaction
├── Exactly `optimise`/`optimize`? → Mode D: reorganize into topics
├── Exactly `prune`?               → Mode E: delete the rules the user selects
├── Numbered batch?                → Mode A: Direct add, N rules
├── Has text?                      → Mode A: Direct add, 1 rule
└── No arguments?                  → Mode B: Interactive
```

**Modes C, D and E are matched on an exact argument, never on containment.** A rule that happens to contain the word "compact", "optimise" or "prune" is still a rule; only the bare argument selects the mode. Mode D accepts `optimise` or `optimize`, in any letter case; Mode E accepts `prune`, in any letter case.

**Announce the mode first.** The argument alone decides the mode, so the mode is known before any file is read — say it before reading any. A tool call that sits alone on screen for minutes, or a remark about what you are about to read or compute, reads as a hang. Right after the language rules are loaded, the **very first output of the run** — before Step 0, before the mode's reference file, before any project file, and before any other sentence — is the mode's announcement below, said in `language.ui` (mode names stay as they are).

**One or two plain sentences, as you would say it to a colleague** — which mode is on and what it is about to do, and for Modes C, D and E that nothing is written before the user says so. No numbered steps, no heading, no list: the steps show up as the work happens.

- **Mode A**: `Adding <N> rule(s) — first I'll check them against the knowledge base and the rules you already have.`
- **Mode B**: the question for the rule is the first output; once the rule arrives, the Mode A line.
- **Mode C**: `compact: I'll shorten the rules that can be shorter and show every change before writing — no rule is deleted.`
- **Mode D**: `optimise: I'll sort the rules into topics and show you the proposed layout before writing anything.`
- **Mode E**: `prune: I'll look for rules that can go — duplicates, outdated references, lines that aren't rules — and for rules that contradict each other; nothing changes until you choose.`

**Then say what you are doing, as you do it:** at each step — reading the files, analysing the rules, writing — one short line saying what is happening right now, with how much there is where it helps (`<N> rules from <K> files`). Print it before that step's analysis begins, not after it. One line per step: not a plan announced in advance, and not a retelling of what went fine. Each mode names its progress lines at the step they precede: Mode C step 2, `mode-optimise.md` D.1 and D.5, `mode-prune.md` E.1 and E.5. Announcement and progress lines are plain sentences, not a log: no `INFO`/`WARN` prefix, and they replace none of the mode's own summary lines.

**Mode D** → read `{{skills_dir}}/{{self_name}}/references/mode-optimise.md` and follow it; Steps 2-6 below do not run. The layout it writes is `## Layout of the rule files` below.

**Mode E** → read `{{skills_dir}}/{{self_name}}/references/mode-prune.md` and follow it; Steps 2-6 below do not run.

**Mode A** — user provided rule text:
```
/unikit-rules Never use var, always explicit types
```
→ After the Mode A line (announcement above), proceed to Step 2 with the provided text.

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
→ Ask the user what rule to add; once the rule arrives, continue as Mode A, its announcement included. Offer examples relevant to {{engine_name}}/{{engine_code_language}}:
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

### Step 3: Read RULES.md and Determine Its Layout

Read `.unikit/RULES.md` if it exists. Its layout state is **decided by the file's content** — no setting, no second file. Check the states in this order; the first that matches wins:

| State | Recognized by | Where an added rule goes |
|-------|---------------|--------------------------|
| `topics` | a line `## Topics` followed by the table header row `Topic` / `Load when` | Step 4 places it: an existing topic, a new topic, or `## Common` |
| `flat` | the marker line `<!-- unikit:rules-layout flat -->` | the end of the flat list; nothing is offered |
| `empty` | no file, or a file without a single rule — no line starting `- ` | Step 4 places it; the first topic brings in both headings |
| `legacy` | anything else: rules, but neither the table nor the marker | the end of the list; after the Step 6 report the reorganization is offered |

- **No file** → create it with the line `# Project Rules`, a blank line and the header paragraph (`## Layout of the rule files`); the rule itself is written in Step 4.
- **`topics`** → also read the table and `Glob .unikit/rules/*.md`, and compare the two. A row whose file is missing → `WARN [rules] topic table: <slug> is listed, .unikit/rules/<slug>.md does not exist`. A file with no row → `WARN [rules] topic table: .unikit/rules/<file> is not listed under ## Topics — no reader loads it`. Neither is repaired here, and this skill never writes into an unlisted file; a listed topic whose file is missing is recreated when Step 4 writes a rule into it. The warnings are printed after the Step 6 report.
- **The table and the marker both present** → the table wins: `WARN [rules] layout: flat marker ignored — the file already has a ## Topics table`.
- **A `flat` file is never offered the reorganization again.** The refusal is final; only `/unikit-rules optimise` reorganizes it, and removes the marker when it does. A user who deletes the marker by hand turns the file back into `legacy`, and the offer returns.
- A new file that has received only common rules looks exactly like a `legacy` one. That is harmless: the offer appears only when the analysis finds something to put in a topic.

### Step 4: Place and Append the Rule

Every rule list — the whole file in the `flat` and `legacy` states, the `## Common` section and each topic file in the `topics` state — is a **flat list**. Within a list there are no sections: the rule is appended to the end of its list as a `- ` item. Choosing or creating a `## Section` is no longer part of this skill, and existing sections are never recreated.

**The rule's form is constrained by shape, not by a number:**

- **One line. One directive.** A short "why" may share that same line where it earns its place.
- Directive language — "Never…", "Always…", "Use…".
- **There is no numeric limit.** This skill does not count characters and **prints no service line about length**, neither in the rule nor in the report.
- **What never goes into a rule:** its origin ("Found in Task 14.3"), the story of the incident, a description of how the code is currently built, a task or phase number. History lives in git and in the patches; the current shape of the code lives in `ARCHITECTURE.md`.
- A duplicate by meaning is skipped, exactly as before.
- **A rule that cannot be reduced to one directive without losing knowledge is written as it stands**, and is marked in no way at all. This skill does not refuse, does not truncate, and **does not recommend moving the rule into the knowledge base** — that transfer is something the user starts, and offering it on every rule would be precisely the service noise this form exists to remove.

**When the existing file already has sections**, the rule is appended at the end of the file and those sections are left untouched and unreformatted. Silently restructuring the user's own file during an ordinary add is not allowed: flattening belongs to Mode C, and it happens only on confirmation.

**Where the rule goes** depends on the Step 3 state:

- **`flat`, `legacy`** → the end of the file, exactly as before. The report's `Topic` is `common`.
- **`empty`, `topics`** → the first of these that fits:
  1. **An existing topic** whose `Load when` covers the rule's area → append the rule to the end of `.unikit/rules/<slug>.md`. When that `Load when` would not match a task that needs the rule, widen the cell with the words that name the rule's area.
  2. **A new topic** — the rule governs a bounded area that a task names explicitly (a subsystem or feature, a folder, a family of types, a framework or library, a process step such as commits or releases), so that a task outside that area never needs it, and no topic covers it yet. Write `.unikit/rules/<slug>.md` (`## Layout of the rule files`) and add its row to the table. When it is the first topic, write `## Topics` with its table and then `## Common` after the header paragraph; the rules the root already holds and the common rules of this batch stand under `## Common`, in their order.
  3. **Common** — every other case: the rule can apply to any task (naming, formatting, general language use, error handling, dependency injection, logging).

  **When unsure, the rule goes to common.** A common rule costs tokens on every run; a rule in a topic that did not load is a rule silently not applied.
- A `topics` root without a `## Common` heading → add `## Common` at the end of the file before appending the first common rule.
- Inside one batch, write the topic files first and the root last.

### Step 5: Also Check the Existing Project Rules

Before writing, verify the new rule doesn't duplicate something the project rules already say — not just the knowledge base. Read every list in the root and, in the `topics` state, the topic file chosen in Step 4; then `Grep -i` two or three distinctive words of the rule across `.unikit/rules/` and read the files that match. A duplicate by meaning is `skipped-duplicate`, wherever it lives.

### Step 6: Write and Confirm

Use `Edit` to add the rule(s) to existing files and `Write` for a new topic file or a new root. Then report — **one row per input rule, skipped ones
included**:

```markdown
## Batch result — N rules

| # | Outcome | Topic | Cross-check |
|---|---------|-------|-------------|
| 1 | added | common | no overlap |
| 2 | already-covered | — | core/reactive-async.md |
| 3 | added | save-system (new) | extends code-style.md |
| 4 | skipped-duplicate | ui | same meaning as existing entry |
```

Outcomes, and nothing else:

- `added` — written into `.unikit/RULES.md` or one of its topic files
- `already-covered` — the knowledge base already carries it (Step 2); `Cross-check` names the file
- `skipped-duplicate` — `RULES.md` already carries the same meaning (Step 5)

`Topic` names where the rule landed: `common`, `<slug>`, or `<slug> (new)` for a topic this call created; for `skipped-duplicate`, where the existing rule lives; `—` for `already-covered`, which writes nothing. In the `flat` and `legacy` states every written rule is `common`.

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

**After the report:** the Step 3 warnings, one per line; then, when Step 3 found the `legacy` state, the reorganization offer — read `{{skills_dir}}/{{self_name}}/references/mode-optimise.md` and follow its `## Offer`. The rules of this call are already written: the answer changes the layout, never whether they landed.

## Mode C: Compact an existing RULES.md

A retro mode. It edits a file inside the user's project, so it runs **only on confirmation** and is non-destructive: content is moved, never dropped.

1. Read `.unikit/RULES.md`. No file → say so and stop. Determine its state (Step 3); the `empty` state → `INFO [rules] compact: no rules — file unchanged`, and stop. **Mode C on a `legacy` file first runs the offer** (`{{skills_dir}}/{{self_name}}/references/mode-optimise.md` → `## Offer`): `Apply` reorganizes the file, and compaction then runs over the new layout; `Keep the flat format` writes the marker, and compaction continues as before; `Not now` — compaction continues as before. A `flat` or `topics` file is compacted without an offer.
2. Parse every list into `- ` items, preserving their order — the root and, in the `topics` state, each topic file its table lists, each file on its own. An item is a line starting `- ` at column zero together with the indented lines that continue it; a nested list (an indented `- ` or `1. `) does not parse. **Structure is not an item, and compact never removes or rewrites it:** the `# ` line, the header paragraph, the marker line, `## Topics` with its table, and `## Common`. A legacy section (any other `## …`) is not an item either: its heading goes away, and the items beneath it join the list in the same order they had. Then print `Read <N> rules from <K> files — deciding how to shorten each one now.`
3. Decide an outcome per rule:
   - **`shorten`** — it reduces to one directive without losing knowledge: prepare the short wording. A trailing `<!-- @no-migrate -->` stays verbatim at the end of the shortened rule;
   - **`keep`** — it does not reduce: it stays exactly as it stands. That is not a defect, and it is not marked;
   - **`flatten-only`** — the rule is already one line; only its place changes, because the section around it is going away.
4. **Print the preview as plain markdown, in a block of its own** — before the question: one line per rule, in the form `before → after` for `shorten`, a single line for the rest. The question mechanism carries the options and nothing else. With topics, the preview is grouped by file: the root first, then the topic files in table order.
5. Ask once: **apply everything / apply only the `shorten` set / cancel**. Without an answer the file is not touched.
6. Write it with `Edit`, file by file: every list flat, the order of the rules preserved, legacy section headings removed, the structure untouched. **No rule is deleted** — under any outcome. The order is kept by stripping headings rather than by re-sorting: re-sorting would shuffle rules whose sequence the user chose.
7. Report how many `shorten`, how many `keep`, how many `flatten-only`. **Not one line about length in characters**, and no suggestion to move anything into the knowledge base.

This mode touches only `.unikit/RULES.md` and its topic files: it never edits `RULES_INDEX.md` and nothing under `.unikit/memory/`.

**Verbose.** One summary line — `INFO [rules] compact: shorten=<a> keep=<b> flatten-only=<c>`; the preview is the detailed output. Cancelled by the user → the file is untouched, and `compact: cancelled, file unchanged` is printed. The file will not parse — not a markdown list, nested structures → write **nothing**, name the places that did not parse, and stop: `WARN [rules] compact: <n> items did not parse — file unchanged`. A half-compacted file belonging to someone else is worse than an uncompacted one.

## Deleting rules

This skill deletes a rule only in Mode E (`prune`), and only the rules the user selected there. Adding (Modes A and B), compaction (Mode C) and reorganization (Mode D) never delete one. Removing entries migrated into the knowledge base is `/unikit-memory migrate-rules`' own, separate right.

## Priority Reminder

From RULES_INDEX.md, the override priority (highest wins):

1. `.unikit/RULES.md` and its topic files in `.unikit/rules/` — project-specific overrides (what this skill writes to). Inside a topic's own area, a topic rule wins over a `## Common` rule it contradicts.
2. `.unikit/ARCHITECTURE.md` — project architecture decisions
3. `.unikit/memory/code/core/*.md` — universal best practices
4. `.unikit/memory/code/stack/*.md` — framework-specific knowledge

Rules added by this skill have the highest priority and override everything below them. This is by design — project rules exist precisely to override defaults when the project needs something different.
