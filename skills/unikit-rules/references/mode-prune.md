# Mode E — Prune the Rules (`prune`)

`unikit-rules` reads this file only when the whole argument is `prune`, in any letter case (SKILL.md → Step 1, which has already printed the Mode E announcement before this file was read). No other mode and no other skill offers it: pruning is always the user's explicit call.

This is the one mode of this skill that deletes rules. **Only the rules the user selected are deleted.** It never rewords a rule — that is Mode C (`compact`) — and never moves one — that is Mode D (`optimise`). It works the same in every layout state (SKILL.md → Step 3), and it edits files in the user's project, so it runs **only on confirmation**.

## E.1 Read

1. Read `.unikit/RULES.md` and determine its state (SKILL.md → Step 3). No file, or the `empty` state → `INFO [rules] prune: no rules — file unchanged`, and stop.
2. `topics` → read every topic file the table lists. A listed file that is missing contributes no rules: `WARN [rules] topic file missing: .unikit/rules/<slug>.md`.
3. Parse every list into rules exactly as Mode C step 2 does. `N` is their number. Anything that does not parse → delete nothing: `WARN [rules] prune: <n> items did not parse — file unchanged`, name the places, and stop. Then print `Read <N> rules from <K> files — checking them against each other, the knowledge base and the project code now.`
4. For `covered`: read `.unikit/memory/code/RULES_INDEX.md` — and `.unikit/memory/gamedesign/RULES_INDEX.md` when it exists — then only the knowledge-base rule files whose description or `Load When` matches a rule's area. Never read the whole memory tree.
5. For `stale-ref`: `Grep` the project for each concrete name a rule cites — a class, a file or folder, an API, another rule file. Matches under `.unikit/` are not evidence either way: the rule itself lives there.

## E.2 Find candidates

| Class | A rule is a candidate when | Evidence in the preview |
|-------|----------------------------|-------------------------|
| `duplicate` | another project rule says the same thing | the other rule, quoted, with its file |
| `covered` | a knowledge-base rule says the same thing | the knowledge-base file and the quote |
| `not-a-rule` | the line carries no directive: a status, an incident story, a task or phase number, a description of how the code is built now | the line itself |
| `conflict` | two project rules contradict each other | both rules, quoted, with their files |
| `stale-ref` | the rule names a class, file, API or rule that no longer exists | the name, the `Grep` pattern and where it searched — with no match |

"No longer needed" is not a class: nothing records which rules were applied or broken, so it cannot be told.

Three protections against a false candidate — each lifts only its own class:

1. **`covered` only on the same meaning.** A rule that contradicts, narrows or extends a knowledge-base rule is an override (SKILL.md → Step 2), never `covered`: deleting it would erase exactly what the rule was written for.
2. **`stale-ref` never applies to a prohibition** ("Never use X", "Do not call Y"): X missing from the code means the rule works, not that it is stale.
3. **A topic rule and a `## Common` rule are never a `conflict`**: inside its own area the topic wins (SKILL.md → `## Layout of the rule files`) — a sanctioned override, not a contradiction.

A prohibition can still be `duplicate` or `covered`; a topic/common pair can still be `duplicate`. **A candidate without evidence is not shown.** A rule ending with `<!-- @no-migrate -->` may be a candidate — the tag forbids migration into the knowledge base, not deletion — and the preview shows the tag.

## E.3 Preview

No candidates → `INFO [rules] prune: no candidates — file unchanged`, and stop.

Otherwise print the candidates as plain markdown, in a block of its own, before the question, grouped by file — the root first, then the topic files in table order:

```markdown
## Prune candidates — <k> of <N> rules

### .unikit/RULES.md
| Id | Rule | Class | Evidence |
|----|------|-------|----------|
| P1 | <rule, in full> | duplicate | same as "<other rule>" (rules/ui.md) |
| P2a | <rule, in full> | conflict | contradicts P2b |
| P2b | <rule, in full> | conflict | contradicts P2a |

### rules/ui.md
| Id | Rule | Class | Evidence |
|----|------|-------|----------|
| P3 | <rule, in full> | stale-ref | `Grep 'OldView'` in the project: no match |
```

Ids are `P1`, `P2`, … in preview order; the two rules of a `conflict` are `P<n>a` and `P<n>b`. A `not-a-rule` line that describes the current code gets one more line under its table: that text belongs in `ARCHITECTURE.md`, through `/unikit-architecture` — this skill never writes that file.

## E.4 Ask

One question, three options:

- `Delete the ones I list` — the user answers with ids (`P1, P3, P2b`);
- `Delete every candidate except conflicts` — every candidate that is not a `conflict`; a side of a `conflict` goes only by its own id;
- `Delete nothing`.

Ask with `AskUserQuestion` — the id list arrives as the free-text answer; without it, the same three options as numbered text, answered by option number or by ids — print them, then end your turn and wait for the answer. No answer, or `Delete nothing` → nothing is deleted: `INFO [rules] prune: nothing deleted — file unchanged`. An id that is not in the preview is ignored and named in the report.

## E.5 Delete

First print `Deleting <d> rules…`.

1. Remove each selected rule — every line of it — with `Edit`, from the file it lives in. Nothing is reworded, nothing is moved.
2. A topic file left without rules → delete it with `rm .unikit/rules/<slug>.md` and remove its row from the table. The last row gone → remove `## Topics` with its table and the `## Common` heading; the common rules stay as the flat list under the header paragraph.
3. All common rules deleted while topics remain → `## Common` stays, empty.
4. A legacy `## ` section of the root left without rules → remove its heading too.
5. Read the files back and count their rules. A count other than `N` minus the deleted ones → `WARN [rules] prune: <M> rules left, expected <K> — check git diff`.

## E.6 Report

`INFO [rules] prune: deleted=<d> kept=<k>`, then a table `Class | Found | Deleted`, and the ignored ids, if any. Not one line about length, and no suggestion to move anything into the knowledge base.
