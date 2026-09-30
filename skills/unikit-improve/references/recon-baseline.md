# unikit-improve — Reconnaissance as the baseline of a pass

Read at Step 1 only when the plan folder holds `recon/` — the reconnaissance an ultra plan written
with saved state keeps beside its phase files (form and freshness:
`unikit-plan/references/RECON-TEMPLATE.md`). It sets the scope of Step 2 and adds one section to
the report. Without `recon/` the pass runs as the skill describes, and this file is not read.

A recon file can run to hundreds of lines and a plan can hold many of them. Reconnaissance does not
add a kind of improvement of its own — it names the areas of the plan, and inside the chosen area
the pass runs both of its layers.

## When

- The plan folder holds `recon/` and the manifest carries `## Recon` → this file applies.
- `recon/` without `## Recon` → build the topic list from the files' first two lines instead.
- A file named by `## Recon` that is not in `recon/` → `WARN [improve] recon file missing: recon/<name> — continuing without it`, and the topic is left out.

## Topic map

A topic is one recon file. Build the map without opening a body:

1. From `## Recon` of the manifest: the file, its `HEAD`, its question, its phases.
2. From the file's head — `## Summary` and `## Contents`, the lines above `## Current-Code Evidence` —
   the paths each section covers (the `Covers` column).
3. **Open tasks** — the `- [ ]` tasks of the topic's phases in the manifest's checklist. A topic whose
   phases are all `[x]` is `all done — skipped`: improving what is already built changes nothing.
4. **Freshness** — `git diff --name-only <HEAD>..HEAD`, run once for every distinct `HEAD`, crossed
   with the paths of the file's `## Contents`: none changed → `fresh`; some changed → `<n> of <m> paths changed`.
   Reconnaissance ages as the plan advances — the phases already carried out change the very files
   it read — so a stale topic is the ordinary state of a plan in progress, not a defect.

## Scope without a prompt

Print the map as a table, then ask one question:

```
Recon for this plan (<n> files):
 #  Topic                  Phases   Open tasks   Freshness
 1  <question of file 1>   6–9      12           fresh
 2  <question of file 2>   10–14    15           3 of 11 paths changed
 3  <question of file 3>   1–5      0            all done — skipped
```

```
AskUserQuestion: What should this pass improve?

Options:
1. All fresh topics with open tasks (Recommended)
2. Topics by number
3. Whole plan — standard pass
4. Cancel
```

- `Topics by number` → the numbers arrive as text in the next message: a plan can hold more topics
  than a question has options.
- `Whole plan — standard pass` → the pass runs as without `recon/`.
- An answer already given in the arguments ("topics 1 and 3", "the whole plan") counts, and nothing
  is asked.
- Without a question widget, print the options as a numbered list and end the turn.

## Scope with a prompt

No table and no question. Match the prompt against the map — each topic's question, the paths of
its `## Contents`, its phases — and take only the topics it touches. Print one line:

- `INFO [improve] recon: <file> (fresh), <file> (<n> paths changed — re-explored)` — the topics used;
- `INFO [improve] recon: no topic matches the request` — none; the pass runs as without `recon/`.

## Two layers

- **Plan logic** — dependencies, the module barrier, commit ranges, vague tasks, missing
  verification. It reads the plan, not the code, and runs over the **whole plan** whatever scope was
  chosen: it is cheap and it breaks across topics.
- **The code check** — whether the phases describe the code they will change. It runs over the
  **chosen topics** only:
  - a fresh evidence row is the baseline — no Explore task is launched to establish it again;
  - a changed path, and anything the reconnaissance does not cover, goes to the Explore tasks of
    Step 2, and only those.

## Reading budget

- The head of a file first: `## Summary` and `## Contents`.
- A section is read only to settle one finding, by its line range from `## Contents` (`Read` with
  `offset` and `limit`).
- A whole file is never read.

## Findings

- A finding built on reconnaissance cites its section: `recon/<file> § <section>` — it does not
  retell it.
- The report gets `### Recon-Based Findings` and, in its header, one line:
  `Recon: used <n> · re-explored <n> · skipped <n>`.

## Never

- The pass never creates, edits or deletes a recon file. A newer look at the code goes into the
  plan's phases, not into its reconnaissance.
- A row whose path changed since the file's `HEAD` is never presented as a fact — it is checked
  against the code first.
