# unikit-implement — post-completion steps: the reasons behind the rules

A maintainer page. Nothing under `docs/` is delivered into a project by `unikit-ai init` or
`unikit-ai update`: the skill keeps what the model executes, this page keeps why. Grouped by
the step of `skills/unikit-implement/SKILL.md` → `### Step 5: Post-Completion Actions` that
carries each rule. The same split as the explore save pipeline, on the same criterion — see
[unikit-explore-save-rationale.md](unikit-explore-save-rationale.md).

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
- **The deletion prompt spells out the full path.** The folder manifest shares the name
  `PLAN.md` with the flat fast plan and differs from it only by path.

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
