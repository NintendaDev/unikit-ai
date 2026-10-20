# Card draft view — how a card is shown for approval

Read **only** when a card draft is about to be printed for the designer to approve — a new card, a changed card, or the card shown again after a "change" answer (the Specify and Manage branches). This file owns the form of that print; the content of the card belongs to `{{skills_dir}}/{{self_name}}/references/template-experiment.md`.

## The table

The card shown for approval is a table, never a numbered or bulleted list of sections: a long list of paragraphs cannot be scanned, a table can. It is the **review view only** — the file is written by `template-experiment.md` (headings and lists), and the table is not saved.

- One table per card, with the card's title and code in a line above it. Columns exactly `| № | Section | Content |`; one row per section of the card, in the card's order, 1…14, so the row number is the section number. The section names are the template's, translated into the interface language.
- A cell holds the section's text as plain sentences on one line, with no line break inside the cell: a row that grows long is cut by the sentence, not by a new line.
- Section 1 is one row: category, version, status `Draft` with the date, "no number yet" for a card not yet saved, the link to a balance checkpoint or "stand-alone".
- Section 9 is one row with its three parts named inside it: "Must have: …; can be simplified: …; out of scope: …".
- The closing sentence of section 5 (the card describes a disposable prototype) ends the cell of row 5.
- A pipe character inside a cell is written `\|`. Nothing is shortened or dropped for the table: every section the card will hold is in a row.

## When it is printed again

- A "change" answer at approval, or a change to a saved card, prints the table again in full, so the designer reads the card as it will be written; the rows that changed are named in the line below the table.
- Several cards: one table each, in the order they will be written.
