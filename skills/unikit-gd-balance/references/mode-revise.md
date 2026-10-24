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
  entry. If the dropped point was the current one, no row is `current` until a point is issued
  (`Current: none`, the block in its none-form); the next is issued by `## Issue the next point,
  add a point, reopen` below — a dropped point never becomes `done`.
- A change of design (numbers in the GDD) is not made here: put a proposal into `Design deltas`
  for `/unikit-gd-system`.
- **The route of the current point** is changed on request through `experiment-route.md` →
  `## Weighing the route`; the log gets the entry that `## Recording the route` describes.

## Close the document

Asked for directly ("close it"), or reached from `mode-status.md`: write what the "close the
document" row of the table in `mode-ingest.md` step 9 says — that table is the one place; it is
not copied here. Closing is never refused; open questions are deferred with the owner `user`.

## Issue the next point, add a point, reopen

For an open document with no current point, a `planned` row (or a new row, its id the next
`BCH-<n>`, a used id never reused) becomes `current`; `## Current Balance Checkpoint` is
rewritten by **Compose the point** of `mode-ingest.md` step 9 — investigation when facts are
needed, the interview for Q6–Q8, `Work` and `Until` filled in, every item graded for feasibility
as in step 6 of `mode-open.md`; the header's `Current` takes its id. For a closed document: the
same plus `Status: open` (the reopening rule is in `closure-set.md`). The result must fall into
an allowed header combination (`template-checkpoints.md` → `Allowed header combinations`); the
log gets an entry as for any roadmap change.

## Repair an inconsistent file

Reached from `mode-status.md` (a file error) or asked for directly. The truth is the `current`
row of `## Roadmap`: the header's `Current` and the block's `Point` must equal it
(`template-checkpoints.md` → `Allowed header combinations`). Read `CHECKPOINTS.md` whole once, say
in words what disagrees (points by their goals, never by a code), and fix it by `Edit`: `Current`
and `Point` take the one `current` row, or the none-form when there is none. Several `current`
rows, or none while the header names one, is one question with the question tool of your agent (`AskUserQuestion`): which point is the current
one — the one the header names first. A `closed` document with a `current` or `planned` row asks
before any row is dropped. The log gets one entry; `## Every write` applies; the outcome is told
as `## End` says.

## Every write

`Updated` (from `Bash(date *)`) and `INDEX.md` are refreshed on every write.

If a plan was already built for the point being edited, print one line: the plan is
synchronised by `/unikit-improve <plan>` through its `Item:` links.

## End

As in ingest (`mode-ingest.md`, the report step): the outcome by the point's goal, the closing
set status, the plan command last or the reason there is none.
