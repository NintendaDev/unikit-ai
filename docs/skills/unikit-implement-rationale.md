[Back to README](../../README.md) · [Skills Reference](../skills.md)

# unikit-implement — the reasons behind the rules

A maintainer page. Nothing under `docs/` is delivered into a project by `unikit-ai init` or
`unikit-ai update`: the skill keeps what the model executes, this page keeps why. Grouped by
the step of `skills/unikit-implement/SKILL.md` that carries each rule. The same split as the
explore save pipeline, on the same criterion — see
[unikit-explore-save-rationale.md](unikit-explore-save-rationale.md).

## Step 0 — Plan resolution

- **Two branch-matching folders are a question, never a choice by format precedence.** Two
  folders for one feature is exactly the state the date in the folder name used to prevent,
  and choosing silently is how the resolver starts finding the wrong one.
- **A manifest with no `Updated:` is never dated from its file's mtime.** `git checkout` and a
  fresh clone rewrite the mtime, so it says when the file landed on this disk, not when the plan
  was last touched.

## Step 1.5 — Bootstrap

- **The knowledge base is loaded once, before the first task.** This replaced per-task
  delegation to `/unikit-devcontext` for sequential work.
- **A notes header naming another server is a warning, and the entries still apply.** They are
  suspect, not void, and a suspect check still fails safe. Retiring them belongs to
  `/unikit-mcp-audit`, never to this skill.

## Step 3 — Execute

- **Sequential tasks never go through `Skill(unikit-devcontext)`.** Invoking it per task
  defeats the rules-loading optimization: the rules are already in context from Step 1.5 and
  Step 3.0.
- **A `⏸️ MANUAL` task is written `- [x]`.** The checkbox must be `[x]` so Step 2 does not pick
  the task up again on every subsequent run; the marker is what keeps it honest, and it sits in
  the task text so `/unikit-verify` sees it during the task audit.
- **A rule candidate carries a `full formulation` column.** That column is the reason the short
  `rule` form is allowed to stay short.
- **Future-phase compilation errors do not block the phase commit.** They indicate planned work,
  not broken code.
- **The safety valve fires at 70 % of the suites.** A filter of twenty names costs more than
  one full run, and assembling it is the more error-prone half. The skill says the threshold is
  assigned, not measured, so the next reader does not take it for a measurement.
- **A degenerate case widens to a full run.** Failing to narrow means widening — fail-safe, not
  refusal.
- **Module manifests are searched, never read.** Reading the whole module graph costs thousands
  of tokens and buys no accuracy.
- **A red run has one reporter — the Step 3.3 blocker.** Two places printing one failure drift
  apart.
- **A test-checkpoint task is ticked by the `Edit` that records its run.** One write surface,
  one `Edit` — the rule `## MCP Findings` is written by as well.
- **Why the test-run block is a reference** (`skills/unikit-implement/references/test-runs.md`).
  Its gate, `Testing: yes`, is known at plan load, before the context fills: a plan without
  tests never pays for the ~10 KB, and a plan with tests pays at the cheapest moment of the run.
  The step headings (`### Step 2.5`, `**3.8**`) and a one-line stub at each use site stay in the
  skill, because `data/ultra-plan-read.md` and the coordinator point at those steps by name.

## The editor procedures (dev-principles D6–D8)

- **Why they moved.** The same procedure was restated by four executors and drifted in
  wording; one copy under the lazy-read boundary is read only when a plan carries an `Editor:`
  task.
- **Why the reference line is printed.** Without it the run reads as if everything came from
  observation — the confusion a source biased toward confidence should not get for free. The
  reference is also a network dependency, which makes two runs of the same plan diverge.
- **Why the boundary read is line-limited.** The marker splits the file on paper only until
  readers stop at it; the upper half is what every Bootstrap needs.
- **Why the finding row is appended by the `Edit` that ticks the task.** The finding and the
  task that produced it are one unit of work: written together, the two survive or fail as one,
  while a table filled at the end of the run is lost to every session that stops early.

## Step 4 — Completion Summary

- **The `Research drifted` line.** It carries the re-plan offer forward past the point where the
  Step 1 warning scrolled away; it is not a blocker.
- **`Manual (editor targets)` is not "not done".** The user chose to carry these targets out
  themselves, and `/unikit-verify` does not treat them as blockers.

## 5.2 — Propose New Rules

- **No `open` candidate means silence.** A run without candidates is the ordinary case, and a
  line about it on every run turns the signal into wallpaper — the same rule the empty findings
  table follows in Step 5.5.
- **Print first, ask second.** A question that also holds the payload is invisible on a runtime
  that has no question mechanism — a measured failure, not a supposition.
- **At most three candidates.** Three candidates and the "Add nothing" refusal are exactly four
  options, the question tool's limit.
- **The one-line rule form.** The full rule text goes in an option's `description`, so the
  one-line form is a condition of readability there rather than decoration.
- **`INFO [rules] open candidates: <n>, proposed: <m>`** is the one line explaining why fewer
  candidates were proposed than recorded.
- **Statuses stay unchanged when the dispatch only printed the command.** The rule was not
  written, and marking it `added` would be a lie.

## 5.4 — Handle the plan file

- **A folder plan is kept.** It is a durable record of what was done; the user may delete it
  before merging.
- **The deletion prompt spells out the full path, and a folder manifest is never offered for
  deletion.** The folder manifest shares the name `PLAN.md` with the flat fast plan and differs
  from it only by path.

## 5.5 — MCP Findings handoff

- **No rows means silence.** A run with no findings is the ordinary case, and a line announcing
  it every time is how a signal becomes wallpaper.
- **The explicit plan path** is what makes `/unikit-mcp-trap` read this plan and nothing else —
  see that skill's `## Input`.
- **The step sits before review and commit.** The findings are the part of a run's result with
  no other keeper: the code is in git, the tasks are in the plan, and a finding lives only in a
  table nobody has read yet. After review it competes with a discussion of code quality for the
  user's attention — and loses, every time, ending up "later", which is where it was before the
  step existed.

## 5.6 — Verify or Commit

- **Tier 2 exists because `Skill(...)` is not rewritten.** The slash form is rewritten per agent
  by the installer, while non-Claude agents have no `Skill` tool at all — without the slash tier
  the step is dead on five agents out of six.
- **Review is stated as NOT delegated because the file argues the other way.** A step above says
  "Delegate to `docs-agent`" and a `Subagent Delegation — BLOCKING PRE-REQUISITE` block sits at
  the top; generalising from the neighbours is exactly how this step came to be read as a
  delegation. Step 5.2 is delegated to nobody at all — it blocks on the user, and only the answer
  decides what is written.
- **Why review in particular stays in this session.** A review is a conversation: in a subagent
  its `file:line` references stop being clickable, no follow-up question can be asked about a
  finding, and its `+check` validator would run as an agent inside an agent. `docs-agent` is
  delegated because it writes a file and finishes.

## See Also

- [unikit-explore save rationale](unikit-explore-save-rationale.md) — the rule classification behind the split
- [unikit-plan rationale](unikit-plan-rationale.md) — the same split, for the planner
- [research-link rationale](research-link-rationale.md) — why the Step 1 drift check and its `Research drifted` line in the Step 4 completion summary both read from the system asset, not a restated procedure
- [Skills Reference](../skills.md) — what `/unikit-implement` does, for the people who use it
