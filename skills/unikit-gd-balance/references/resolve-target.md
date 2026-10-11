# Resolving the balance document

Loaded by the branches that need a document: status, ingest, revise (and open, when the slug
may already exist). It owns the document list, the five latest, the choice of a document by an
argument and by a report. It does not own the header combinations
(`template-checkpoints.md` → `Allowed header combinations`) or the matching keys
(`.unikit/system/balance-handback.md` → `## Matching keys`) — it points there.

## The list

`Glob` `.unikit/gamedesign/balance/*/CHECKPOINTS.md`. From each file read **only the first 12
lines** — the header: `Slug`, `Status`, `Current`, `Updated`. A file is never read whole to
build the list.

A header that cannot be read, or lacks a key: the document is marked `unreadable` in the list,
is not taken into the five latest, and a line is printed:
`WARN [balance] <slug>: CHECKPOINTS.md header unreadable`.

## The five latest

Sort by `Updated` descending (`YYYY-MM-DD HH:MM`); equal values by `Slug`. Print the **five
latest** — no more — as your own message (tool output is folded away from the user): the
document name (the slug is a name, not a code), its state as a plain phrase (not the `open` /
`closed` tokens), the current point **by its goal** (taken from the `current` row of the
roadmap; never `BCH-<n>`), and what needs doing, by the header combinations table.

These are status lines and menus — TIER B of the membrane (`SKILL.md`, Language Awareness): a
point is named by its goal (`named by its goal`); codes stay in the file.

## The header combinations

Defined once, in `template-checkpoints.md` → `Allowed header combinations`; not repeated here.
A combination outside that table, or a header, a `current` row and a `Point` block that
disagree, is a file error: status reports "file inconsistent: <what exactly>" in words — "the
header names one current point, the roadmap another", without a code (the exact codes are
visible in the file itself), and offers the repair (`mode-revise.md` →
`Repair an inconsistent file`); the other branches do not continue.

## The index

`balance/INDEX.md` is derived. It is redrawn **whole** from the headers on every write and in
status: one line per document — slug, `Status`, `Current`, `Updated`, path. It is never edited
by hand; when it disagrees with the folders the headers are the truth:
`WARN [balance] INDEX.md out of date — redrawn from CHECKPOINTS.md headers`.

## By an argument

A slug is the exact folder name. An unknown slug: show the five latest and ask which one is
meant. A slug with no verb is status. A slug followed by a report (a path or a pasted table) is
the form the executors print: the slug names the document and the report is received into it;
when the report's own `Balance:` names another document, that is one question, never a silent
choice.

## By a report

The keys and their order are in `.unikit/system/balance-handback.md` → `## Matching keys`
(read there, not restated here). A pasted report without a header cannot use the first key; the
second and third work.

- **One winner** → announce the choice in one line, by the point's goal and in the interface
  language — "receiving into <slug>: <the point's goal in plain words>" — and continue. No point
  code is printed in that line (TIER B, `named by its goal`).
- **No winner, or several** → the five latest and one question "which document to add this to",
  with the option "none of these"; the recommended option first, by topic proximity; the
  options name a document by its slug and the goal of its current point. A report cannot start a
  document: "none of these" says so, changes nothing and points at `/unikit-gd-balance <topic>`.
  **Never guess silently.**

## A late report and a duplicate

A report for a point that is not the current one, or a duplicate (the same `Balance` + `Point` +
`Build` is already in `results/`), stops the receiving with a question; the point is named by
its goal in the question. Options: `1.` take it as late data (a log entry, the state does not
change) · `2.` another document · `3.` discard. A report for the current point whose earlier
report with the same key was judged invalid, or for which the decision was "repeat the point",
adds a fourth option — `4.` replace the earlier report: the new copy is the next `results/HB-<n>.md`
and carries a `Supersedes: HB-<k>` line (the contract's `## Receiving`); the earlier file stays.
This is how a repeated run on the same build is received, because a short SHA does not change
when only an uncommitted tool fix did.
