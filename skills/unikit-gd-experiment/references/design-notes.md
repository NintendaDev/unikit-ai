# Design notes — the file of a deep pass

Read **only** when a deep pass of `mode-think.md` has run and `notes.md` is to be written or read. This file is the single definition of that file, its format and its write rules; other files name it and do not restate it. All paths are relative to the project root.

## The file

`.unikit/gamedesign/experiments/EXP-<nnn>-<slug>/notes.md` — one per experiment, beside the card, and only after a deep pass. A quick pass writes no notes: its result lives in the card. The format:

```markdown
# Notes: EXP-<nnn> <title>

## Frame
## Precedents
| Claim | Source | Date checked | Strength |
|-------|--------|--------------|----------|
## Options
| Option | Signal | Cost | Readability | Bias risk | Verdict |
|--------|--------|------|-------------|-----------|---------|
## How the test could mislead
## Closed questions
## Open questions
```

- `Frame` holds the decision, the qualities the test is read against and the goal, each in one line.
- A row of `Precedents` is one line: the claim, its source (a title, a venue and a year, or an address), the date it was checked and the strength A, B or C. A claim without a source is not a row; it is an `assumption` in the Rationale.
- A row of `Options` is one option of the main choice with its verdict (`chosen`, `set aside — <why>`).
- The other sections are short lists in the designer's words.

## Writing it

- **It is written first.** The card names the file in `Based on:`, so the file must exist before the card does: `storage-and-index.md` → `Creating an experiment folder`, then `notes.md`, then the card and the rest of the order of writes.
- The notes are shown to the designer as your own message before the card draft, and one approval covers both. Nothing is written before the answer. A failed write → stop, name the last file written and the pending write, and do not write the card.
- Technical traces are checked by the self-check of `storage-and-index.md`; the names of games, talks and articles are not traces.
- The text of a page is never stored: one-line claims with a source only (`mode-think.md` → `Web rules`).

## Reading and changing it

- The planner reads the whole file through the `notes` entry of `Based on:`. The evaluate branch does not need it: it checks the `assumption`s of the Rationale against the evidence (`mode-evaluate.md`).
- A deep pass run again on a saved experiment edits the file and changes the date in the `Based on:` line of the card. That is an edit that does not raise `Version`.
- A card saved without notes stays valid; notes are never required for readiness.
