[Back to README](../../README.md) · [Skills Reference](../skills.md)

# unikit-plan — the reasons behind the rules

A maintainer page. Nothing under `docs/` is delivered into a project by `unikit-ai init` or
`unikit-ai update`: the skill keeps what the model executes, this page keeps why. Grouped by
the step of `skills/unikit-plan/SKILL.md` that carries each rule. The same split as the
explore save pipeline, on the same criterion — see
[unikit-explore-save-rationale.md](unikit-explore-save-rationale.md).

## Input and mode selection

- **The mode may be named inside the free-form text.** The user is talking, not typing a CLI,
  so the parser looks for the mode wherever it sits in the sentence, not only as a leading
  token.
- **Wording that only asks for care is not ultra — ask instead.** An unwanted bundle leaves the
  user a folder of phase files they never asked for, while a missed one costs them one word.
  The asymmetry is why the doubtful case falls through to the question rather than to ultra.

## Step 0.2 — Resolve Feature Description

- **A record carrying no `Lifecycle` line counts as `active`.** Records written before the
  field existed do not carry it; treating them as anything else would hide every older
  research.
- **`<Created>` is displayed, `Updated` is never substituted for it.** `Created` exists for
  display and for breaking ties; `Updated` drives every filter and all sorting.
- **A record with no `Created` is shown as `(date unknown)`, never with empty brackets.** An
  empty bracket is indistinguishable from normal and hides the gap in the dialogue the same way
  an unlogged filter hides it in Step 2.

## Step 0.5 — Bootstrap

- **What the base section of `engine-mcp/INDEX.md` decides for planning.** It carries access,
  the live failure classes, shape and cost, what is irreversible here, the lane, and what to do
  when the file is silent. An irreversible write decides where a commit boundary falls, the
  lane decides what may never run in parallel, shape and cost decide how the work splits into
  phases.
- **The `## Check` table is not read by the planner.** It is keyed by area for the executors,
  which grep their own task's area plus the cross-cutting ones on every editor task. A plan
  that carries checks forward has started making the executor's decisions with month-old
  information.
- **An absent `INDEX.md` is a normal path.** A server may ship no rules tree, or the project may
  have no engine MCP at all; neither is an error.
- **An absent `testing.plan.checkpoints` falls back to the mode default silently.** A project
  without a config is a normal case, and a line on every plan would turn the warning into
  wallpaper.

## Step 1 — Feature name and folder

- **Today's date goes into the manifest, not the folder name.** The manifest's `Created:` and
  `Updated:` fields are where it lives now; the folder is the feature name alone
  (`.unikit/code/plans/<feature-name>/`).
- **An automatic suffix (`-2`, `-v2`, a date) is forbidden.** The date used to be a separator as
  well as a sort key: two runs at the same feature produced two distinct names on their own.
  Without it there is one name, and a silently suffixed second folder is how the branch
  resolver starts finding the wrong plan again — the resolver matches the branch name, and the
  branch name has no suffix.

## Step 2 — Related researches

- **The age key is `Updated`, never `Created`.** With a continuation cycle, freshness means
  "when this was last confirmed", not "when the folder was opened".
- **The `Status` field name and its three values are fixed.** Renaming either makes the filter
  match nothing and report "no researches found" instead of an error, which is a failure nobody
  can see.
- **The drop line is printed always, including when nothing was dropped.** A line that appears
  only on a drop is a line nobody learns to expect.

## Step 4 — Ultra depth gate

- **Never paste an entire source file into a phase plan.** A file pasted whole goes stale on the
  first edit made against it, and it reads as more authoritative than a path-and-symbol
  citation while being less true.

## Step 4.6 — Reading the catalog negatively

- **Ask about capability, never about a name — and write neither into the plan.** A question of
  the shape "is there a test run at all" keeps its answer for months; a question about a name
  loses it in days.
- **Do not pre-write `⏸️ MANUAL` into a task.** It is a runtime verdict, reached by trying and
  producing the evidence of absence (A9); a planner that writes it in advance has lifted the
  executor's obligation to try.
- **The planner does not open the reference.** It is the executors' resource —
  `/unikit-implement` and `/unikit-fix` reach for it on two triggers, and neither of them is
  "planning".

## Step 5 — Settings and Guard B

- **The `Editor tasks` line is omitted when `ENGINE_RULES.md` is absent.** No `Editor:` field is
  generated for that engine, so the setting would have no consumer.
- **Guard B serializes an editor phase against every phase, not only against other editor
  phases.** The hazard is wider than editor-versus-editor: a neighbouring code phase writes a
  source file, the editor re-reads it, the domain reloads — total unavailability measured in
  minutes, landing in the middle of another phase's mutation. Any phase sharing a layer with
  editor work is the hazard, whatever that phase is doing.

## Important Rules

- **A plan is intent, not inventory — no tool name ever reaches it.** A name in a plan is a name
  that will be wrong by the time the plan is executed, and it silently overrides the executor's
  own discovery.

## See Also

- [unikit-explore save rationale](unikit-explore-save-rationale.md) — the rule classification behind the split
- [unikit-implement rationale](unikit-implement-rationale.md) — the same split, for the executor
- [Skills Reference](../skills.md) — what `/unikit-plan` does, for the people who use it
