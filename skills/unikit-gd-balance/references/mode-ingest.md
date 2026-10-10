# Ingest — receive a hand-back report

The branch for a report pasted or named by path. Say points by their goal in every question,
menu and status line (`named by its goal`, TIER B of the membrane); codes stay in files and
tables. A missing item is described in words by its expected result, not by its `<id>.W<n>`.

## Order

1. **Get the report.** A path the person named, or pasted text. A paste with no header (only a
   table) is accepted as it is; the question "which point and which build" is not asked yet —
   it is asked after the document is determined (step 3), otherwise there is no default to offer.
   An unreadable path: tell the user the path, do not continue, change no state.
2. **Read** `.unikit/system/balance-handback.md`. Missing → print
   `WARN [balance] hand-back contract missing — report accepted without header validation; run unikit-ai update`.
3. **Determine the document** — `resolve-target.md` (the keys are in the contract's
   `## Matching keys`; a paste with no header has no first key). **Only after the document is
   determined**, and only when the report lacks some header lines, ask one question: which point
   the report is for and which build (the default is the found document's current point — ask to
   confirm; the point is named by its goal). Complete the missing lines as the contract's
   `## Receiving` says; every completed name goes into the `Supplemented:` line.
4. **Check completeness.** Five header lines (completed ones count as present but stay listed in
   `Supplemented:`); every name of the point's `Report:` list is present, by the contract's
   `## Body`. Incomplete → show what is missing and ask: `1.` go back to execution
   (recommended) · `2.` accept as partial (the missing become "not measured").
5. **Duplicate and "not the current point"** — `resolve-target.md`.
6. **Copy** to `results/HB-<n>.md` (`n` is the next number; append only): the report verbatim
   plus the completed header lines; the `Supplemented:` line first in the file (its form is the
   contract's `## Receiving`; none completed → no line).
7. **`BALANCE.md`:** move the rows into the tables, judge them against the bands (`in` /
   `out` / `n-a`; `valid = no` is not admitted into conclusions), revise the diagnosis by layer and
   the levers, update `Unverified and conflicts`.
8. **Decision.** One `AskUserQuestion`, the recommended option first: the next point of the
   roadmap · revise the roadmap · close the document · repeat the point (the data is invalid).
   The options are outcomes; the next point is named by its goal.
9. **`CHECKPOINTS.md`:** an entry in `## Balance Checkpoint Log` (date · point · what was done ·
   `results/HB-<n>.md` · decision · what changed in the roadmap); the point becomes `done`; the
   next becomes `current` with `## Current Balance Checkpoint` rewritten (`Done so far` points
   at the reports; new work-item ids take the next `W<n>`, a used number is never reused);
   `Updated` from `Bash(date *)`.
10. **Write order:** `results/HB-<n>.md` → `BALANCE.md` → `CHECKPOINTS.md` → `INDEX.md`. A write
    error at any step stops the chain and the user is told the last file written.
11. **Report** (the terminal block, TIER A): the outcome — the point by its goal (the code only
    as a secondary tag in parentheses); the closing set status by `closure-set.md`; the plan
    command last (`SKILL.md` → `## Closing block`), or the reason there is none.

If the copy into `results/` was not written, the chain stops before `BALANCE.md` and the cause
is named.
