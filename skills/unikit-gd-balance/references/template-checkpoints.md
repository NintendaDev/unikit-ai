# Template — CHECKPOINTS.md

Read only when the file is being created. This file is the single definition of the header, of
the allowed header combinations and of the anchors that `unikit-plan`, `unikit-implement` and
`unikit-verify` read. The anchors keep their wording; the header sits in the first 12 lines.

```markdown
# Balance Checkpoints: <slug>

Slug: <slug>
Status: open | closed
Current: BCH-<n> | none
Updated: YYYY-MM-DD HH:MM

## Roadmap
| id | goal (the decision the returned data will change) | status | depends on (data) |
|---|---|---|---|
| BCH-1 | … | current | — |
| BCH-2 | … | planned | BCH-1 |

## Current Balance Checkpoint
Point: BCH-1
Why: <which decisions the returned data will change>
Done so far: <earlier points and the state they left; refs to results/HB-<n>.md>
Start from: <where the work starts>
Work:
- BCH-1.W1 · kind: tool | stand | data-edit | measure | probe | human-check | tuning-loop · via: sim | play | probe (measure and probe only) · result: <what exists afterwards> · acceptance: <band or known-answer check> · depends: <ids | —>
Until: Stop: <stop condition, minimal sample> · Report: <names: work-item ids and labels>
Not in this point: <what is deliberately left for later points>
Constraints: <MUST / FORBIDDEN; documentation-vs-code conflicts>
Capabilities needed: <capability classes, never tool names>
Design deltas: <for /unikit-gd-system when a GDD exists, else —>

## Balance Checkpoint Log
<entries: date · point · what was done · report ref · decision · changes to the roadmap; dropped points are logged too>
```

The `status` of a roadmap row is one of `done | current | planned | dropped`.

## Allowed header combinations

| Status | Current | The `## Roadmap` rows |
|---|---|---|
| open | BCH-<n> | exactly one `current` row; its id equals `Current` and the `Point` of the block |
| open | none | no `current` row; `planned` rows are allowed |
| closed | none | no `current` row and no `planned` row |

`closed` with a `current` row is not allowed. The truth about which point is current is the
`current` row of the roadmap; `Current` of the header and `Point` of the block must equal it.

**The block with `Current: none`.** When no row is `current`, `## Current Balance Checkpoint`
keeps its heading and holds exactly two lines — `Point: none` and `Last point: see the
## Balance Checkpoint Log`; the fields `Why` … `Design deltas` are removed. `Point: none` is then
the value `Current` must equal. Ingest and revise write this form whenever they leave no row
`current`, and write the full form again when a point is issued.
