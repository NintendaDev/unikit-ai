# Revise — change a decision, a band, a point

The branch for changing a decision, a band or the composition of a point, for dropping a point,
and for issuing the next point, adding one or reopening a closed document (status loads it for
those too). Confirmation questions name a point by its goal, never by its code or work-item id
(`named by its goal`, TIER B of the membrane).

## Changes

- Decisions and bands are edited in `BALANCE.md` (the decisions section, with a date and a
  source). The composition of the current point is edited in `## Current Balance Checkpoint`.
- Work-item ids `<point id>.W<n>` are stable: a new item takes the next number, a deleted one is
  never reused (the log records it).
- **Dropping a point:** its `status` in `## Roadmap` becomes `dropped` and the log gets an
  entry. If the dropped point was the current one, the next is issued by the ingest rules
  (`mode-ingest.md`, the decision and `CHECKPOINTS.md` steps).
- A change of design (numbers in the GDD) is not made here: put a proposal into `Design deltas`
  for `/unikit-gd-system`.

## Issue the next point, add a point, reopen

For an open document with no current point, a `planned` row (or a new row, its id the next
`BCH-<n>`, a used id never reused) becomes `current`; `## Current Balance Checkpoint` is
rewritten by the ingest rules; the header's `Current` takes its id. For a closed document: the
same plus `Status: open` (the reopening rule is in `closure-set.md`). The result must fall into
an allowed header combination (`template-checkpoints.md` → `Allowed header combinations`); the
log gets an entry as for any roadmap change.

## Every write

`Updated` (from `Bash(date *)`) and `INDEX.md` are refreshed on every write.

If a plan was already built for the point being edited, print one line: the plan is
synchronised by `/unikit-improve <plan>` through its `Item:` links.

## End

As in ingest (`mode-ingest.md`, the report step): the outcome by the point's goal, the closing
set status, the plan command last or the reason there is none.
