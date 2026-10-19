# Subagent roles — which role a launch has

Read together with `subagent-arguments.md` before the first subagent a skill or a file agent launches in a run, once per run and never at Bootstrap. The role of a launch picks the config key its model and its effort are read from: `subagents.model.<agent>.<role>` and `subagents.effort.<agent>.<role>`. Do not restate this table inside a skill: a skill names the rule and points to `subagent-arguments.md`; a copy of the table drifts, and a guard compares this file with the skills and the agent files of the package.

## The three roles

- **reader** — collects facts and returns them, including by writing the answer into its own working file of an exploration. It changes no deliverable of the project.
- **validator** — checks a finished result independently of whoever made it, and returns findings.
- **executor** — does work whose result becomes part of the project: code, documents, rules, plans, architecture.

## The table decides

The table is primary: a launch it names has the role of its row, even where a definition above would say otherwise. A launch is found by the alias it goes through, by the step of its skill, or by the name of its agent file.

| Launch | Role | Where |
|--------|------|-------|
| `recon-agent` | reader | Read-only parallel reconnaissance, declared by `/unikit-docs`, `/unikit-explore`, `/unikit-fix`, `/unikit-gd-balance`, `/unikit-gd-experiment`, `/unikit-gd-explore`, `/unikit-gd-recon`, `/unikit-improve`, `/unikit-plan` and `/unikit-verify` |
| `recon-writer-agent` | reader | `/unikit-plan` ultra, saved-state protocol: answers one reconnaissance question straight into its own file |
| `check-agent` | validator | A fresh-context check of a finished artifact or of findings: `/unikit-explore` and `/unikit-gd-explore` (coherence gate), `/unikit-improve` and `/unikit-review` (`+check`) |
| `lens-agent` | validator | `/unikit-gd-review`: one adversarial review lens, findings only |
| `develop-agent` | executor | `/unikit-implement`, `/unikit-fix` and `/unikit-verify`: a true parallel scope or a deep-dive single task |
| `docs-agent` | executor | `/unikit-implement` Step 5.3: updates or creates documentation |
| `/unikit` Step 9.8 | executor | One launch per stack rule to generate, through `unikit-memory` |
| `/unikit` Step 10 | executor | The architecture document, through `unikit-architecture` |
| `/unikit-gd-brainstorm` Phase 3.5 | executor | Market validation through `unikit-gd-explore`. It gathers facts, but it runs a skill that writes, and the user assigned it to the executors on purpose: while the executor value is `inherit`, this launch stays on the model and the effort of the session |
| `unikit-implement-worker` | executor | File agent: executes one phase of a plan, started by `unikit-implement-coordinator` |
| `unikit-plan-polisher` | executor | File agent: creates and refines a plan, started by `unikit-plan-coordinator` |
| `unikit-review-sidecar` | validator | File agent: background code-review sidecar |
| `unikit-architecture-sidecar` | validator | File agent: background architecture sidecar |
| `unikit-docs-sidecar` | validator | File agent: background documentation-drift sidecar |
| `unikit-commit-sidecar` | reader | File agent: assesses commit readiness and writes no commit message |
| `unikit-implement-coordinator` | none | File agent: started by the user as a top-level session; it settles the launches of the rows above and has no role of its own |
| `unikit-plan-coordinator` | none | File agent: the same, for the plan polishing loop |

## A launch the table does not name

A launch a skill decides on by itself, or an extension adds, is placed by the nature of its work: a launch that only gathers facts and returns them is a reader; a launch that judges a result which already exists is a validator; every other launch, and any launch you cannot place, is an executor.
