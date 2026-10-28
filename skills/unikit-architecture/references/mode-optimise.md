# Mode C — Reorganize the Architecture Document into Topics (`optimise`)

Read **only** when one of two cases applies, and never otherwise:

- **Explicit** — the request asked for the reorganization: the whole argument is `optimise` or `optimize` (any letter case), or the request says so in plain words (SKILL.md → `## Modes`, which has already printed the Mode C announcement before this file was read). It works in every state: it reorganizes a `legacy` file, turns a `flat` one into topics and removes its marker, and regroups a `topics` one.
- **Offer** — the state was `legacy` and Mode B has just finished its report (`mode-update.md` U.7). Follow `## Offer` below.

The layout — the two shapes of the root, the header quote, the table row, the topic file, the marker — is SKILL.md → `## Layout of the architecture files`. This file only moves items into that layout.

**No item is deleted** — under any outcome. This mode changes where a block lives, never its wording: the text of every item is moved word for word, and adding or editing is Mode B.

It edits files in the user's project, so it runs **only on confirmation**. It touches only `.unikit/ARCHITECTURE.md` and `.unikit/architecture/`: never `RULES_INDEX.md`, never anything under `.unikit/memory/`.

## The helper

Everything that has to be exact — the inventory, the count, the verbatim move, the write — is done by `{{skills_dir}}/{{self_name}}/scripts/architecture-layout.mjs`, on Node, which every UniKit project has. You decide only where each item goes. Run it from the project root:

| Call | What it does |
|------|--------------|
| `node {{skills_dir}}/{{self_name}}/scripts/architecture-layout.mjs parse` | prints the state, the fingerprint, the number of items by kind, a table of the old `## ` sections and the list of items (id, section, size, first words); also the `WARN` lines of SKILL.md → `## Modes` |
| `node … apply --dry-run` | checks the plan in `.unikit/architecture-layout.plan.json` and prints the D.3 outline; writes nothing |
| `node … apply` | checks again, proves that every item lands exactly once and word for word, writes the topic files and then the root, deletes the topic files the plan drops and the plan file, reads everything back |
| `node … discard` | deletes the plan file |

Exit codes: `0` done · `1` usage · `2` the plan is invalid or the invariant failed — **nothing is written**, and the output names every reason · `3` the architecture files changed after `parse` — nothing is written; run D.1 again. Tool output is folded away from the user: whatever the user must see — the warnings, the outline, the report — print again as your own message.

Only when `node` cannot run: do the same steps by hand, as `## By hand` at the end of this file describes.

## D.1 Read

1. Run `parse`. `state: empty` → on an explicit call print `INFO [architecture] optimise: no architecture document — file unchanged` and stop; on an offer stop without a word.
2. Print its `WARN` lines. A file in `.unikit/architecture/` that no row lists is outside the layout and stays untouched.
3. Every item has an id. `P<n>` is a paragraph, `L<n>` a list item with its continuations and nested lines, `T<n>` one data row of a table (the helper copies the table head to every file the rows land in), `C<n>` a fenced code block. A shape the grammar does not recognise surfaces as a paragraph: nothing is dropped.
4. `N` is the number of items — the count the report must show.
5. Explicit call → print `Read <N> items from <K> files — grouping them into topics now; this is the longest step.` before starting D.2.

## D.2 Propose

Give every item exactly one destination — a topic or the root. **When unsure, the root.**

- **The root keeps** what every task needs: `Project`, `Tech Stack`, `Documentation Sources`, `Key Principles`, `Detailed Rules`; from `Folder Structure` the tree and the one-line module map; from `Dependency Rules` the edges and prohibitions that touch several areas; from `Cross-Module Communication` the common patterns; the global anti-patterns; a short `Architecture Overview`.
- **A topic takes** what belongs to one area — a subsystem, a module, a framework seam: its edges and prohibitions, the rows of the contract tables that name its types, the narrative of its mechanisms — **together, as one topic**, because a task names an area. A topic is an area, never a kind of text: edges in one file and contracts of the same area in another is a wrong split.
- The old `## ` sections are ready-made clusters, not topics by themselves: merge two sections, split one, or send one to the root, by the same criteria.
- For each topic write the slug (English kebab-case, one to three words), the title and the `Load when` in the words tasks use — folders, assemblies, types, frameworks, areas.
- **A `flat` file** is treated like a `legacy` one; the marker goes away in D.5 once there is a topic.
- **A `topics` file (regroup):** keep the slug and the file of every topic that stays; merge topics whose `Load when` overlap, or that hold an item or two a neighbour already covers; split a topic whose items answer two different `Load when`; move items between the root and the topics in both directions.

Zero topics on an explicit call is a valid proposal: the file stays flat, with its marker if it had one. Write the proposal with `Write` to `.unikit/architecture-layout.plan.json`:

```json
{
  "version": 1,
  "fingerprint": "<the fingerprint parse printed>",
  "topics": [
    { "slug": "rendering", "title": "Rendering pipeline", "loadWhen": "render passes, shaders, the Render/ folder" }
  ],
  "assign": { "root": ["P1-P4", "L1-L12", "T1-T6"], "rendering": ["P5-P9", "C1"] },
  "sections": { "rendering": { "Cross-Module Communication": "Contracts" } }
}
```

Every item stands in exactly one `assign` list; a list takes ids and ranges (`L13-L19`); an empty `topics` list keeps the file flat. `sections` is optional: it renames a source section inside one topic file.

## D.3 Preview

Run `apply --dry-run`. Exit `2` → correct the plan by the reasons it printed and run it again; never work around it by hand. Exit `0` → print its output as your own message, in full, before any question. It is an outline, not the text: a table of the topics (`Items`, `Bytes`, `Change`) and, for every destination, the sections with the id, the size and the first words of each item. Every item is moved exactly once and word for word — the helper proves it before it writes.

`Change` is one of `new`, `kept`, `merged from <slugs>`, `split from <slug>`, or `removed` for a topic whose items all move elsewhere — its file is deleted in D.5.

## D.4 Ask (explicit call)

One question: `Apply` / `Cancel` — with the question tool of your agent (`AskUserQuestion`). `Cancel`, or no answer → run `discard`; nothing is written: `INFO [architecture] optimise: cancelled, file unchanged`.

## D.5 Write

Explicit call → first print `Writing <T> topic files and the root…`. Then run `apply`:

- `0` → D.6.
- `2` → nothing was written: print the reasons, correct the plan, and return to D.3 — the user confirms the corrected outline.
- `3` → the architecture files changed since D.1: nothing was written; start again at D.1.

`apply` writes the topic files first and the root last: the `# Architecture:` title, the header quote, the sections that still hold items, `## Topics` with one row per topic in alphabetical order of slug directly above `## Detailed Rules`. The flat marker, `---` separators and empty sections are not carried over; inside every destination the items keep their original relative order. It deletes only the topic files of the old table that the plan drops — never a file no row listed.

## D.6 Report

`apply` prints the report: `INFO [architecture] optimise: topics=<t> root=<c> items=<N>`, then a table `Topic | Items`. Print it as your own message. Not one line about length, and no suggestion to move anything into the knowledge base. When the file now has topics, or lost its last one, run Step 5 of SKILL.md: the `AGENTS.md` row names the topic directory while topics exist.

## Offer

Run by `mode-update.md` U.7 after the report of an update — only in the `legacy` state.

1. Run D.1 and D.2 — without the D.1 progress line: the offer is not a mode the user called, so nothing announces it. **No topic proposed → no question, nothing written, no line printed**: a file whose items all stay in the root has nothing to reorganize, and a question there is noise. No plan file is written either.
2. At least one topic → D.3, then one question with three options:
   - `Apply` — D.5 and D.6: the file takes the topic layout.
   - `Keep the flat format` — run `discard`, insert the marker line (SKILL.md → `## Layout of the architecture files`) directly under the `# Architecture:` line and nothing else; print `INFO [architecture] layout: flat marker written — /unikit-architecture optimise reorganizes later`. The refusal is final: the offer is never made for this file again.
   - `Not now` — run `discard`; nothing is written; the offer returns on the next update that finds the file `legacy`.
3. Ask with the question tool of your agent (`AskUserQuestion`). No answer → `Not now`.

## By hand

Only when `node` cannot run. The steps stay the same; you do the helper's part yourself:

1. **Parse** the root and the listed topic files into items exactly as D.1 describes, remembering each item's file and old `## ` section. Anything that does not parse → write nothing: `WARN [architecture] optimise: <n> items did not parse — file unchanged`, name the places, and stop.
2. **Outline** as D.3 shows, from your own proposal.
3. **Invariant, before any write:** the proposal holds exactly `N` items, and every parsed item stands in exactly one destination, word for word. Otherwise write nothing: `WARN [architecture] optimise: <N> items before, <M> after — file unchanged`, and stop.
4. **Write** with `Write` — topic files first, the root last, as D.5 describes; then delete each dropped topic file with `rm .unikit/architecture/<slug>.md`.
5. **Read back** the written files and count their items. A count other than `N` → `WARN [architecture] optimise: wrote <M> items, expected <N> — check git diff`.
