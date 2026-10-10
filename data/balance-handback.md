# Balance Hand-back Report Contract

This file defines the document that carries the results of a balance checkpoint's measurements
from the session that ran them back to the balance document that asked for them. It is a flat
system file: it is installed by `init`, refreshed by `update`, and contains no variables.

## Readers and ownership

This file is the single owner of the report format. Four skills read it: `unikit-plan` (the
fields of the `Hand-back:` task), `unikit-implement` (forming the report), `unikit-verify`
(checking its completeness) and `unikit-gd-balance` (receiving it).
Do not restate this contract inside a skill — that is the failure mode this file exists to prevent.
A skill names the format and points here. A skill group that is not installed does not cancel the
file: it is installed by `init` and `update` always.

## Place and name

The report lies in the plan's folder: `.unikit/code/plans/<plan folder>/handback-<point id>.md`.
A plan without a folder (a fast plan) keeps it next to `PLAN.md`:
`.unikit/code/handback-<point id>.md`, with no subfolder. `<point id>` is `BCH-<n>`. The
executing session writes the whole file (a repeated run overwrites it). The receiving side never
collects the file from the folder by itself: it reads the document a person named or pasted.

## Header

Five lines, in this order; the names are not localized:

```
Balance: <slug>
Point: BCH-<n>
Plan: <plan folder name>
Build: <short sha>
Date: YYYY-MM-DD
```

`Plan` is the plan folder's name; for a plan without a folder the value is the literal `fast`.
`Build` is `git rev-parse --short HEAD` at the moment of the last measurement; when git is
unavailable it is `unknown`. A report written by an executor always carries all five lines. The
receiving side completes missing header lines of a pasted report without a header by the rule in
`## Receiving`, where `Plan: unknown` is allowed.

## Body

Four sections of the **report**, in this order; the report's headings are fixed. They are listed
here as a numbered list, not as headings of this contract:

1. `## Measurements` — a table `id | stand | runs | summary | valid | band`. `id` is the id of a
   work item, `<point id>.W<n>`; `runs` is the number of runs performed; `summary` is the result
   in one cell (a number, an interval, a list); `valid` is `yes` or `no` (the run and the
   instrument were correct); `band` is `in`, `out` or `n-a` (whether the result fell into the
   acceptance band). The rows are a projection of the plan's `## Measurements` table.
2. `## Not measured` — one line per item that was not measured: `id — reason`; an empty section is
   written as the single line `none`.
3. `## Notes and anomalies` — free text, and lines of the form `<label>: <value>` for report fields
   that are not a table row.
4. `## Raw data` — paths to the raw data; when there is none, `none`.

**Report fields.** The `report:` list of a `Hand-back:` task (taken from the point's `Until`)
holds names of two kinds: a work-item id (then `## Measurements` must have a row with that `id`)
or a label (then `## Notes and anomalies` must have a line `<label>: <value>`). A report is
complete when every name of the list is present.

## Matching keys

The order in which a balance document is matched to a report: (1) `Balance` + `Point` — the slug
exists and `Point` is a point of its roadmap, whatever its status (whether it is the current one
is decided afterwards, by the receiving rules); (2) the ids of the `## Measurements` rows against the
ids of the work items of the documents' current points — exactly one document matched; (3) topic
proximity — it orders the list put to the user and never selects a document by itself. What
happens when the match is uncertain belongs to the receiving skill.

## Receiving

A verbatim copy of the report plus the completed header lines goes to `results/HB-<n>.md` of the
balance document (`n` is the next number; append only). Completion is needed only by a pasted
report without a header, and only after the document is determined: `Balance` is the slug of the
matched document; `Point` and `Build` come from the person's answer (`Build` without an answer is
`unknown`); `Plan` is `unknown`; `Date` is the day of receiving. The completed names are listed
on a separate line `Supplemented: <names>` at the very top of the copy, above the header; a report
that needed no completion has no such line. A duplicate is the same `Balance` + `Point` + `Build`
already present in `results/`. A report for a point that is not `current`, and a duplicate, stop
the receiving with a question. When the earlier report of the same key was judged invalid, or the
decision was to repeat the point, the question also offers to replace it: the new copy is the
next `results/HB-<n>.md` with a line `Supersedes: HB-<k>` at the very top (next to
`Supplemented:`); the earlier file is kept.

## What this contract does not say

How the numbers were obtained (principle A9 and the route ladder D3 of `dev-principles.md`);
whether the balance is good (the balance skill's decision); the grammar of the `Measure:` and
`Hand-back:` task lines (`unikit-plan/references/TASK-FORMAT.md`).
