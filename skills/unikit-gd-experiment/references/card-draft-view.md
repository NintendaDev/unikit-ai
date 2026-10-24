# Card draft view — how a card is shown for approval

Read **only** when a card draft is about to be printed for the designer to approve — a new card, a changed card, or the card shown again after a "change" answer (the Specify and Manage branches). This file owns the form of that print; the content of the card belongs to `{{skills_dir}}/{{self_name}}/references/template-experiment.md`.

## The headline

Before the table, at most five lines, each one line long, taken from the card and adding nothing to it: the question of section 4 with what it is judged on (`Judged on:`); what the card is based on (`Based on:`); who plays and how many (section 10); what differs between the variants (section 7); what is out of scope (section 9). This is what the designer approves first; the table below is the proof.

## The table

The card shown for approval is a table, never a numbered or bulleted list of sections: a long list of paragraphs cannot be scanned, a table can. It is the **review view only** — the file is written by `template-experiment.md` (headings and lists), and the table is not saved. Its purpose is the approval before the write, so it shows the text that will be written, in the order of the file, with the numbers and the names of the file.

- One table per card. The order of the print is the card's title and code in a line, then the headline, then one line that says what the table is — the text that will be written to `experiment.md`, whose section numbers and names are the file's (the names are English there, the text is in the interface language) — then the table. Columns exactly `| № | Section | Content |`; the number is the number of the section in the file.
- **The `Section` cell is the heading of the file, word for word** (`Follow-up Decisions`, not its translation). On the first row of a section a short gloss in the interface language follows it in parentheses, so that the designer can find the section in the file and also knows what it is for. A row that carries one part of a section names the part as the file words it, after a middle dot: the outcome, a variant, a stage (`Follow-up Decisions · Inconclusive`). No number that the file does not have is ever written: there is no `13.1` and no `5.2` in `experiment.md`.
- **A row holds one idea** — a rule, a step, a variant, a risk, an outcome — as plain sentences on one line, about 250 characters at most. A host that cannot fit a long row on the screen draws the table as `Header: value` blocks, and the designer reads a wall of text instead of a table. This was seen once, with rows of thousands of characters; the limit is not measured, so the 250 is a working budget.
- A section that does not fit in one row **continues in the next row with the same №** and the same heading, and the row names its part as above, so each row stands alone. Sections 5, 6, 9, 10, 11, 12 and 13 usually take several rows: one per rule or screen (5), per slice of time (6), per part (9: Must Have, Can Be Simplified, Out of Scope — each part named in its row), per aspect of the protocol (10), per outcome (11, 13) and per risk (12).
- The four outcomes keep their tokens from the file — `Supported`, `Partially Supported`, `Not Supported`, `Inconclusive` — and are never translated in the table. When the table holds section 11 or 13, one line under the headline says in the interface language what they mean: the hypothesis is confirmed · confirmed in part · not confirmed · the result cannot be read.
- Section 1 is one row: category, version, status `Draft` with the date, "no number yet" for a card not yet saved, the link to a balance checkpoint or "stand-alone".
- The closing sentence of section 5 (the card describes a disposable prototype) is the last row of section 5.
- The `Rationale` rows come last, with `—` in the № column, because the section has no number in the file; the heading in the `Section` cell is `Rationale`, and each line of the section is one row.
- A pipe character inside a cell is written `\|`. Nothing is shortened or dropped for the table: every sentence the card will hold is in a row. A card that needs more rows than a designer can review is over-specified — cut what the planner can decide alone, not what the designer must approve.

## When it is printed again

- A "change" answer at approval, or a change to a saved card, prints the headline and the table again in full, so the designer reads the card as it will be written; the rows that changed are named in the line below the table.
- Several cards: a headline and a table each, in the order they will be written.
