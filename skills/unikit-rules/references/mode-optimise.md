# Mode D — Reorganize the Rules into Topics (`optimise`)

`unikit-rules` reads this file in two cases, and never otherwise:

- **Explicit** — the whole argument is `optimise` or `optimize`, in any letter case (SKILL.md → Step 1, which has already printed the Mode D announcement before this file was read). It works in every state: it reorganizes a `legacy` file, turns a `flat` one into topics and removes its marker, and regroups a `topics` one.
- **Offer** — the Step 3 state was `legacy`: after the Step 6 report of an add (Modes A and B), or before compaction (Mode C). Follow `## Offer` below.

The layout — the two shapes of the root, the header paragraph, the table row, the topic file, the marker — is SKILL.md → `## Layout of the rule files`; the placement criteria are SKILL.md → Step 4. This file only moves rules into that layout.

**No rule is deleted** — under any outcome. This mode changes where a rule lives, never its wording: shortening is Mode C (`compact`), deleting is Mode E (`prune`).

It edits files in the user's project, so it runs **only on confirmation**. It touches only `.unikit/RULES.md` and `.unikit/rules/`: never `RULES_INDEX.md`, never anything under `.unikit/memory/`.

## The helper

Everything that has to be exact — the inventory, the count, the verbatim move, the write — is done by `{{skills_dir}}/{{self_name}}/scripts/rules-layout.mjs`, on Node, which every UniKit project has. You decide only where each rule goes. Run it from the project root:

| Call | What it does |
|------|--------------|
| `node {{skills_dir}}/{{self_name}}/scripts/rules-layout.mjs parse` | lists every item of the root and of each listed topic file, with an id, its lines and its old `## ` section; prints the state, the fingerprint and the `WARN` lines of SKILL.md Step 3 |
| `node … apply --dry-run` | checks the plan in `.unikit/rules-layout.plan.json` and prints the D.3 preview; writes nothing |
| `node … apply` | checks again, proves that every item lands exactly once and word for word, writes the topic files and then the root, deletes the topic files the plan drops and the plan file, reads everything back |
| `node … discard` | deletes the plan file |

Exit codes: `0` done · `1` usage · `2` the plan is invalid or the invariant failed — **nothing is written**, and the output names every reason · `3` the rule files changed after `parse` — nothing is written; run D.1 again. Tool output is folded away from the user: whatever the user must see — the warnings, the preview, the report — print again as your own message.

`node` cannot run (a denied permission, a sandbox) → do the same steps by hand, as `## By hand` at the end of this file describes.

## D.1 Read

1. Run `parse`. `state: none` or `state: empty` → on an explicit call print `INFO [rules] optimise: no rules — file unchanged` and stop; on an offer stop without a word.
2. Print its `WARN` lines. A file in `.unikit/rules/` that no row lists is outside the layout and stays untouched.
3. Every item has an id. `R<n>` is a rule. `B<n>` is a **block** — text the list grammar does not recognise: a paragraph, a table, a code block standing alone, a line the user added to the old header paragraph. A block is never dropped. Give it a destination like a rule — `apply` turns it into a rule item, text unchanged — or, when it belongs to the item right above it (a table or an example under a rule), **attach** it: it then travels inside that item.
4. `N` — the rules plus the blocks you do not attach — is the rule count the report must show.
5. Explicit call → print `Read <N> rules from <K> files — grouping them into topics now; this is the longest step.` before starting D.2.

## D.2 Propose

Give every item exactly one destination — a topic or common — by the placement criteria of SKILL.md Step 4. **When unsure, common.**

- **A `legacy` root with `## ` sections:** each section is a candidate cluster, never a topic by itself — merge sections, split one, or send it to common, by the same criteria.
- **A `flat` file:** as a `legacy` one; the marker goes away in D.5.
- **A `topics` file (regroup):** keep the slug and the file of every topic that stays; merge topics whose `Load when` overlap, or that hold a rule or two a neighbour already covers; split a topic whose rules answer two different `Load when`; move rules between common and topics in both directions.
- For each topic: its slug, title and `Load when` (SKILL.md → `## Layout of the rule files`).

Zero topics on an explicit call is a valid proposal: the file ends flat. Write the proposal with `Write` to `.unikit/rules-layout.plan.json`:

```json
{
  "version": 1,
  "fingerprint": "<the fingerprint parse printed>",
  "topics": [
    { "slug": "ui", "title": "UI views", "loadWhen": "UI screens, HUD, view models, the UI/ folder" }
  ],
  "assign": { "common": ["R1-R12", "R20"], "ui": ["R13-R19", "B1"] },
  "attach": ["B2"]
}
```

Every item stands in exactly one `assign` list or in `attach`; a list takes ids and ranges (`R13-R19`); an empty `topics` list flattens the file.

## D.3 Preview

Run `apply --dry-run`. Exit `2` → correct the plan by the reasons it printed and run it again; never work around it by hand. Exit `0` → print its output as your own message, in full, before any question — the question carries the options and nothing else. It has this shape:

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

`Change` is one of `new`, `kept`, `merged from <slugs>`, `split from <slug>`, or `removed` for a topic whose rules all move elsewhere — its file is deleted in D.5. Every rule appears exactly once, in full. The notes under it name the blocks that become rules, the attached ones, the rules whose list marker changes to `- `, and the old header lines the canonical header paragraph replaces.

## D.4 Ask (explicit call)

One question: `Apply` / `Cancel` — with `AskUserQuestion`; without it, the two options as numbered text: print them, then end your turn and wait for the answer. `Cancel`, or no answer → run `discard`; nothing is written: `INFO [rules] optimise: cancelled, file unchanged`.

## D.5 Write

Explicit call → first print `Writing <T> topic files and the root…`. Then run `apply`:

- `0` → D.6.
- `2` → nothing was written: print the reasons, correct the plan, and return to D.3 — the user confirms the corrected preview.
- `3` → the rule files changed since D.1: nothing was written; start again at D.1.

`apply` writes the topic files first and the root last: `# Project Rules`, the header paragraph, `## Topics` with one row per topic in alphabetical order of slug, and `## Common`. The marker, legacy `## ` sections and `---` separators are not carried over; inside every destination the rules keep their original relative order. It deletes only the topic files of the old table that the plan drops — never a file no row listed.

## D.6 Report

`apply` prints the report: `INFO [rules] optimise: topics=<t> common=<c> rules=<N>`, then a table `Topic | Rules`. Print it as your own message. Not one line about length, and no suggestion to move anything into the knowledge base.

## Offer

Run by SKILL.md Step 6 after the report of an add, and by Mode C before compaction — only in the `legacy` state.

1. Run D.1 and D.2 — without the D.1 progress line: the offer is not a mode the user called, so nothing announces it. **No topic proposed → no question, nothing written, no line printed**: a file whose rules are all common has nothing to reorganize, and a question there is noise. No plan file is written either.
2. At least one topic → D.3, then one question with three options:
   - `Apply` — D.5 and D.6: the file takes the topic layout.
   - `Keep the flat format` — run `discard`, insert the marker line (SKILL.md → `## Layout of the rule files`) and nothing else; print `INFO [rules] layout: flat marker written — /unikit-rules optimise reorganizes later`. The refusal is final: the offer is never made for this file again.
   - `Not now` — run `discard`; nothing is written; the offer returns on the next call that finds the file `legacy`.
3. Ask with `AskUserQuestion`; without it, the same three options as numbered text — print them, then end your turn and wait for the answer. No answer → `Not now`.

## By hand

Only when `node` cannot run. The steps stay the same; you do the helper's part yourself:

1. **Parse** every list into rules exactly as Mode C step 2 does, remembering each rule's file and old `## ` section. A trailing `<!-- @no-migrate -->` is part of its rule. Anything that does not parse → write nothing: `WARN [rules] optimise: <n> items did not parse — file unchanged`, name the places, and stop.
2. **Preview** as D.3 shows, from your own proposal.
3. **Invariant, before any write:** the proposal holds exactly `N` rules, and every parsed rule stands in exactly one destination, word for word. Otherwise write nothing: `WARN [rules] optimise: <N> rules before, <M> after — file unchanged`, and stop.
4. **Write** with `Write` — topic files first, the root last, as D.5 describes; then delete each dropped topic file with `rm .unikit/rules/<slug>.md`.
5. **Read back** the written files and count their rules. A count other than `N` → `WARN [rules] optimise: wrote <M> rules, expected <N> — check git diff`.
