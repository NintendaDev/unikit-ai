# Status — where are we

The branch for "what next", "where are we", a list, a slug alone, and a call with no
arguments. It writes only `INDEX.md` (the redraw, when it disagrees).

Load `resolve-target.md` first: the list, the five latest and the file-error rule are there.
Say points by their goal, never by a code, in every line and menu (`named by its goal`, TIER B
of the membrane): states are spoken as plain phrases, not as the header's tokens.

## No documents at all

One `AskUserQuestion`, the recommended option first: what to balance — `1.` start from a topic
(recommended) · `2.` start from an existing research · `3.` nothing. A choice of `1` or `2`
loads `mode-open.md` in the same turn.

## Documents exist

Print the five latest (`resolve-target.md`) as state only: name, a plain phrase for the state and
the goal of the current point. Then offer exactly one action — for the most recent document only;
actions for any other document belong to `## One slug`. The action is chosen by the document's
header:

- **Open, with a current point** → "run the plan" and the plan command — its form is defined
  once, in `SKILL.md` → `## Closing block`; it is printed last, and nothing follows it.
- **Open, no current point** → "the next point is needed". One `AskUserQuestion`, the
  recommended option first: `1.` issue the next point (recommended) · `2.` revise the roadmap ·
  `3.` nothing. A choice of `1` or `2` loads `mode-revise.md` in the same turn. A command
  `/unikit-gd-balance <slug>` is not printed as advice — it would come back here and loop.
- **Closed** → "closed". One `AskUserQuestion`, the recommended option first: `1.` reopen this
  document (a new point; `mode-revise.md`, the reopening rule is in `closure-set.md`) ·
  `2.` start a new balance (`mode-open.md`) · `3.` nothing.
- **A file error** — a header combination outside the table, or a header, a `current` row and a
  `Point` block that disagree → report "file inconsistent: <what exactly>" in words and offer the
  repair: one `AskUserQuestion`, the recommended option first: `1.` repair it (`mode-revise.md` →
  `Repair an inconsistent file`, loaded in the same turn) · `2.` nothing.

The header values are the key for choosing the action; the user is shown a plain phrase and the
point's goal.

## One slug

Print, in plain words: the state of the document (open with a current point, open and waiting for
the next point, or closed); the roadmap as a short list of **goals** with a word for each one's
state — done, current, planned, dropped — no ids and no table of codes; the summary of the closing
set from `BALANCE.md` (how many questions are closed, deferred, open — read the status table
only); the latest log entry in a sentence. The header itself is read, not printed. Then the next
action as above. A file whose header combination is not allowed is reported as inconsistent, the
repair is offered as above, and nothing else continues.
