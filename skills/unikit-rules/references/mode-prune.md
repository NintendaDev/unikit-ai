# Mode E — Prune the Rules (`prune`)

`unikit-rules` reads this file only when the whole argument is `prune`, in any letter case (SKILL.md → Step 1, which has already printed the Mode E announcement before this file was read). No other mode and no other skill offers it: pruning is always the user's explicit call.

This is the one mode of this skill that deletes rules. **Only the rules the user selected are deleted.** It rewords nothing, with one exception the user confirms as well: a contradiction resolved by merging its two rules into one (E.2 → *Resolving a conflict*). It never moves a rule — that is Mode D (`optimise`) — and shortening is Mode C (`compact`). It works the same in every layout state (SKILL.md → Step 3), and it edits files in the user's project, so it runs **only on confirmation**.

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
| `stale-ref` | nothing the rule says applies any more: every class, file, API or rule it names is gone | the names, the `Grep` pattern and where it searched — with no match |
| `conflict` | two project rules contradict each other | both rules, quoted, the evidence that decides between them, and the proposed resolution |

"No longer needed" is not a class: nothing records which rules were applied or broken, so it cannot be told.

The first four are **deletion candidates**. **A conflict is resolved, never simply deleted**: deleting both sides erases the knowledge each was written for, and more often than not one side corrects or narrows the other. It gets its own section in E.3 and its own question in E.4.

Four protections against a false candidate — each lifts only its own class:

1. **`covered` only on the same meaning.** A rule that contradicts, narrows or extends a knowledge-base rule is an override (SKILL.md → Step 2), never `covered`: deleting it would erase exactly what the rule was written for.
2. **`stale-ref` never applies to a prohibition** ("Never use X", "Do not call Y"): X missing from the code means the rule works, not that it is stale.
3. **A topic rule and a `## Common` rule are never a `conflict`**: inside its own area the topic wins (SKILL.md → `## Layout of the rule files`) — a sanctioned override, not a contradiction.
4. **`stale-ref` only when nothing of the rule still applies.** A rule whose directive still holds while an example, a path or an incident story in it is dead — or half of which is still true — is not a candidate: deleting it takes the live part with it. It goes to the *outdated in part* list of the report (E.6); this mode does not rewrite it.

A prohibition can still be `duplicate` or `covered`; a topic/common pair can still be `duplicate`. **A candidate without evidence is not shown.** A rule ending with `<!-- @no-migrate -->` may be a candidate — the tag forbids migration into the knowledge base, not deletion — and the preview shows the tag.

### Resolving a conflict

For every conflict, **work out which side is right before showing it**, the way you would if the user asked you to: read what each rule rests on — the code it names, the measurement it records, the knowledge-base rule it overrides — and `Grep` the names involved. Then propose one resolution:

- **`keep C<n>a`** or **`keep C<n>b`** — one side is right and the other is wrong or outdated: the wrong side is deleted.
- **`merge`** — each side holds part of the truth: one refines, narrows or corrects the other. Write **one rule that keeps what is true in both and drops what the evidence refutes**, in the form of SKILL.md Step 4 — one directive where it can be, written as it stands where it cannot. It replaces the two.
- **`undecided`** — the evidence does not tell them apart: the user decides.

Never propose deleting both sides.

## E.3 Preview

No deletion candidate and no conflict → `INFO [rules] prune: no candidates — file unchanged`, and stop.

Otherwise print, as plain markdown in a block of its own and before any question, the deletion candidates grouped by file — the root first, then the topic files in table order — and then the conflicts:

```markdown
## Prune candidates — <k> of <N> rules

### .unikit/RULES.md
| Id | Rule | Class | Evidence |
|----|------|-------|----------|
| P1 | <rule, in full> | duplicate | same as "<other rule>" (rules/ui.md) |

### rules/ui.md
| Id | Rule | Class | Evidence |
|----|------|-------|----------|
| P2 | <rule, in full> | stale-ref | `Grep 'OldView'` in the project: no match |

## Conflicts — <c>

### C1 — rules/editor-tooling.md ↔ rules/presentation-feel.md
- **C1a** (rules/editor-tooling.md): <rule, in full>
- **C1b** (rules/presentation-feel.md): <rule, in full>
- **What decides:** <the code, the measurement or the knowledge-base rule that settles it>
- **Proposed:** merge — the two are replaced by:
  - <the merged rule, in full>
```

Deletion candidates are `P1`, `P2`, … in preview order; conflicts are `C1`, `C2`, …, their sides `C<n>a` and `C<n>b`. `Proposed` is `keep C<n>a` / `keep C<n>b` with the reason, `merge` with the new rule in full, or `undecided` with what is missing to decide. A `not-a-rule` line that describes the current code gets one more line under its table: that text belongs in `ARCHITECTURE.md`, through `/unikit-architecture` — this skill never writes that file.

## E.4 Ask

Two questions, asked together — one `AskUserQuestion` call — each only when its section has entries.

**Deletion candidates.** Right under the preview, one line lists the ids **everything proposed** means — every `P` id. The options, in this order:

- `Delete everything proposed` — exactly those ids, nothing to type;
- `Choose by id` — the user types the ids to delete (`P1, P3`);
- `Delete nothing`.

The labels are said in `language.ui` by their meaning. `Choose by id` asks the user to type ids: never render it as "delete the listed ones", which reads as the candidates shown above — the trap that made a user pick it expecting everything to go.

**Conflicts.** A separate question, never folded into the first — its answer rewrites or removes rules the user did not list for deletion:

- `Resolve as proposed` — apply every `keep` and `merge` proposal;
- `Decide each one` — one question per conflict: `As proposed` / `Keep C<n>a` / `Keep C<n>b` / `Leave both` (up to four per call);
- `Leave the conflicts` — nothing about them changes.

An `undecided` conflict is never resolved by `Resolve as proposed`: it gets its own follow-up question — `Keep C<n>a` / `Keep C<n>b` / `Leave both`.

Ask with `AskUserQuestion` — ids arrive as the free-text answer; without it, the questions as numbered text, answered by option number or by ids — print them, then end your turn and wait for the answer. `Choose by id` picked without any id → ask once, as plain text, for the ids, and end your turn. The two answers are independent: `Delete nothing` still lets the conflicts be resolved, and `Leave the conflicts` still lets the candidates go. No answer, or both declined → nothing is deleted or changed: `INFO [rules] prune: nothing deleted — file unchanged`. An id that is not in the preview is ignored and named in the report.

## E.5 Delete and resolve

First print `Deleting <d> rules, resolving <r> conflicts…`.

1. Remove each selected deletion candidate — every line of it — with `Edit`, from the file it lives in. Nothing is reworded, nothing is moved.
2. A resolved conflict: `keep` → remove the other side, as in step 1. `merge` → with `Edit`, put the merged rule in the place of the side whose file's `Load when` covers it — in the root, `## Common`; both fit, or unsure → the place of `C<n>a` — and remove the other side.
3. A topic file left without rules → delete it with `rm .unikit/rules/<slug>.md` and remove its row from the table. The last row gone → remove `## Topics` with its table and the `## Common` heading; the common rules stay as the flat list under the header paragraph.
4. All common rules deleted while topics remain → `## Common` stays, empty.
5. A legacy `## ` section of the root left without rules → remove its heading too.
6. Read the files back and count their rules. Expected: `N`, minus the deleted candidates, minus one per resolved conflict (a `keep` removes one side; a `merge` turns two rules into one). Any other count → `WARN [rules] prune: <M> rules left, expected <K> — check git diff`.

## E.6 Report

`INFO [rules] prune: deleted=<d> merged=<m> kept=<k>`, then a table `Class | Found | Removed` — for `conflict`, the conflicts resolved — one line per conflict with its outcome (`C1 merged`, `C2 kept C2a`, `C3 left`), and the ignored ids, if any.

Then the **outdated in part** list, when protection 4 put anything there: the rules whose directive still holds while a part of them is dead, each with what is dead. This mode does not rewrite them; the user fixes them or asks for a rewrite.

Not one line about length, and no suggestion to move anything into the knowledge base.
