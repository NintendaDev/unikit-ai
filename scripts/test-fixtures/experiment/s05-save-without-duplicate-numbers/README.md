# Scenario 5 — saving without duplicate numbers

## Scenario
The designer approves a new card titled "Tutorial arrow" and asks to save it.

## Setup
`project/` holds two experiments, numbered 1 and 3 (number 2 was never used here), and an index with their two rows.

## Expected
- The next number is the highest found plus one: 4. The gap at 2 is not reused.
- The folder is created with a plain `mkdir` of the last segment, and a search for the number finds exactly one folder.
- Writes in order: the card, then `feedback.md`, then `results.md`, then the index last.
- The new index row shows Not Tested and a dash for the score; the other rows are untouched.

## Must not
- Reuse number 2, overwrite an existing card or renumber anything.
- Report the card as saved if a later write failed.

## Anchors
- Anchor: references/storage-and-index.md :: the highest number found, plus one
- Anchor: references/storage-and-index.md :: A number is never reused
- Anchor: references/storage-and-index.md :: never with -p for the last segment
- Anchor: references/storage-and-index.md :: must list exactly one folder
- Anchor: references/storage-and-index.md :: card, then feedback.md, then results.md, then the index last
- Anchor: references/storage-and-index.md :: | ID | Experiment | Path | What We Test | Status | Outcome | Score |
- Anchor: references/storage-and-index.md :: Outcome shows Not Tested while the Evaluation status is Not Tested

## Run it yourself
Copy `project/`, run the save, then list the folder names and the index rows.
