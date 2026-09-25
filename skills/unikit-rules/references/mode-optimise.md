# Mode D — Reorganize the Rules into Topics (`optimise`)

`unikit-rules` reads this file in two cases, and never otherwise:

- **Explicit** — the whole argument is `optimise` or `optimize`, in any letter case (SKILL.md → Step 1). It works in every state: it reorganizes a `legacy` file, turns a `flat` one into topics and removes its marker, and regroups a `topics` one.
- **Offer** — the Step 3 state was `legacy`: after the Step 6 report of an add (Modes A and B), or before compaction (Mode C). Follow `## Offer` at the end of this file.

The layout — the two shapes of the root, the header paragraph, the table row, the topic file, the marker — is SKILL.md → `## Layout of the rule files`; the placement criteria are SKILL.md → Step 4. This file only moves rules into that layout.

**No rule is deleted** — under any outcome. This mode changes where a rule lives, never its wording: shortening is Mode C (`compact`).

It edits files in the user's project, so it runs **only on confirmation**. It touches only `.unikit/RULES.md` and `.unikit/rules/`: never `RULES_INDEX.md`, never anything under `.unikit/memory/`.

## D.1 Read and parse

1. Read `.unikit/RULES.md` and determine its state (SKILL.md → Step 3). No file, or the `empty` state → on an explicit call print `INFO [rules] optimise: no rules — file unchanged` and stop; on an offer stop without a word.
2. `topics` → read every topic file the table lists. A listed file that is missing contributes no rules: `WARN [rules] topic file missing: .unikit/rules/<slug>.md`. A file in `.unikit/rules/` that the table does not list is outside the layout: warn as SKILL.md Step 3 does and leave it untouched.
3. Parse every list into rules exactly as Mode C step 2 does, remembering each rule's file and, in a `legacy` root, the `## ` section it stood under. A trailing `<!-- @no-migrate -->` is part of its rule. Anything that does not parse → write nothing: `WARN [rules] optimise: <n> items did not parse — file unchanged`, name the places, and stop.
4. `N` is the number of rules parsed — the invariant of D.5.

## D.2 Propose

Give every rule exactly one destination — a topic or common — by the placement criteria of SKILL.md Step 4. **When unsure, common.**

- **A `legacy` root with `## ` sections:** each section is a candidate cluster, never a topic by itself — merge sections, split one, or send it to common, by the same criteria.
- **A `flat` file:** as a `legacy` one; the marker goes away in D.5.
- **A `topics` file (regroup):** keep the slug and the file of every topic that stays; merge topics whose `Load when` overlap, or that hold a rule or two a neighbour already covers; split a topic whose rules answer two different `Load when`; move rules between common and topics in both directions.
- For each topic: its slug, title and `Load when` (SKILL.md → `## Layout of the rule files`).

The result is zero or more topics plus the common rules. Zero topics on an explicit call is a valid proposal: the file ends flat (D.5).

## D.3 Preview

Print the proposal as plain markdown, in a block of its own, before any question — the question carries the options and nothing else:

```markdown
## Proposed layout — <T> topics, <C> common rules, <N> rules

| Topic | Load when | Rules | Change |
|-------|-----------|-------|--------|
| [UI views](rules/ui.md) | UI screens, HUD, view models | 12 | new |
| common | — | 40 | — |

### UI views — rules/ui.md (12)
- <rule, in full>

### Common (40)
- <rule, in full>
```

`Change` is one of `new`, `kept`, `merged from <slugs>`, `split from <slug>`, or `removed` for a topic whose rules all move elsewhere — its file is deleted in D.5. Every rule appears exactly once, in full. When the root's header paragraph is not the canonical one, say in one line that it will be replaced.

## D.4 Ask (explicit call)

One question: `Apply` / `Cancel` — with `AskUserQuestion`; without it, the two options as numbered text: print them, then end your turn and wait for the answer. `Cancel`, or no answer → nothing is written: `INFO [rules] optimise: cancelled, file unchanged`.

## D.5 Check, then write

1. **Invariant, before any write:** the proposal holds exactly `N` rules, and every parsed rule stands in exactly one destination, word for word. Otherwise write nothing: `WARN [rules] optimise: <N> rules before, <M> after — file unchanged`, and stop.
2. **At least one topic:** write each topic file with `Write` — its `# Project Rules — <Title>` line and its rules. Then write the root with `Write`, last: `# Project Rules`, the header paragraph, `## Topics` with one row per topic in alphabetical order of slug, and `## Common` with the common rules. The marker, legacy `## ` sections and `---` separators are not carried over.
3. **Zero topics:** write the root flat — `# Project Rules`, the header paragraph, all rules; no `## Topics`, no `## Common`, no marker.
4. **Order:** inside every destination the rules keep their original relative order — the root's order first, then the topic files in their old table order.
5. **Delete**, after the root is written, the file of every topic marked `removed` in D.3 — and, for zero topics, every file the old table listed — with `rm .unikit/rules/<slug>.md`. Nothing else under `.unikit/rules/` is ever deleted here.
6. **Read back** the written files and count their rules. A count other than `N` → `WARN [rules] optimise: wrote <M> rules, expected <N> — check git diff`.

## D.6 Report

`INFO [rules] optimise: topics=<t> common=<c> rules=<N>`, then a table `Topic | Rules`. Not one line about length, and no suggestion to move anything into the knowledge base.

## Offer

Run by SKILL.md Step 6 after the report of an add, and by Mode C before compaction — only in the `legacy` state.

1. Run D.1 and D.2. **No topic proposed → no question, nothing written, no line printed**: a file whose rules are all common has nothing to reorganize, and a question there is noise.
2. At least one topic → D.3, then one question with three options:
   - `Apply` — D.5 and D.6: the file takes the topic layout.
   - `Keep the flat format` — insert the marker line (SKILL.md → `## Layout of the rule files`) and nothing else; print `INFO [rules] layout: flat marker written — /unikit-rules optimise reorganizes later`. The refusal is final: the offer is never made for this file again.
   - `Not now` — nothing is written; the offer returns on the next call that finds the file `legacy`.
3. Ask with `AskUserQuestion`; without it, the same three options as numbered text — print them, then end your turn and wait for the answer. No answer → `Not now`.
