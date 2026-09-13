# Context Gates and Artifact Ownership Contract

Canonical contract for unikit workflow commands. This file defines:
- which command owns each artifact,
- which commands consume artifacts as read-only context,
- and how context gates behave in normal vs strict verification.

## Command-to-Artifact Matrix

| Command              | Primary write ownership                                                                      | Read-only context                                                                                        | Approved exceptions                                                                                                                                                       |
|----------------------|----------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `unikit`             | `.unikit/DESCRIPTION.md`, `AGENTS.md` (setup map)                                            | Existing project files and context artifacts                                                             | May invoke `unikit-architecture` to create/update `.unikit/ARCHITECTURE.md` during setup                                                                                  |
| `unikit-architecture`| `.unikit/ARCHITECTURE.md`                                                                    | `.unikit/DESCRIPTION.md`                                                                                 | May update `AGENTS.md` context table                                                                                                                                      |
| `unikit-roadmap`     | `.unikit/ROADMAP.md`                                                                         | `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`                                                      | `unikit-implement` may mark completed milestones after implementation                                                                                                      |
| `unikit-plan`        | `.unikit/code/PLAN.md` (fast), `.unikit/code/plans/{folder}/PLAN.md` (full/ultra)      | `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`, `.unikit/ROADMAP.md`, `.unikit/code/researches/`         | `unikit-improve` may refine existing plan files                                                                                                                            |
| `unikit-improve`     | Refinements to `.unikit/code/PLAN.md` or existing plans in `.unikit/code/plans/`                       | `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`, `.unikit/code/researches/`                               | None                                                                                                                                                                      |
| `unikit-implement`   | Plan progress updates (checkboxes/task status)                                               | `.unikit/RULES.md`, `.unikit/ARCHITECTURE.md`, `.unikit/DESCRIPTION.md`, `.unikit/ROADMAP.md`, `.unikit/code/patches/`, `.unikit/memory/` | May update `.unikit/DESCRIPTION.md` and `.unikit/ARCHITECTURE.md` only when stack/structure changed; may update `.unikit/ROADMAP.md` milestone completion; may append a candidate row to the plan's `## Rule Candidates` (a plan edit — it never writes `.unikit/RULES.md`) |
| `unikit-fix`         | `.unikit/code/FIX_PLAN.md` (plan mode), `.unikit/code/patches/*.md`                                   | `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`, `.unikit/RULES.md`, `.unikit/memory/`, existing patches | None (context artifacts remain read-only by default)                                                                                                                       |
| `unikit-explore`     | `.unikit/code/researches/` only (`RESEARCH.md`, `SOURCE.md`, adaptive artifacts)                                  | All context and codebase files for analysis                                                              | None                                                                                                                                                                      |
| `unikit-commit`      | Git commit object/message only                                                               | Context artifacts are read-only gates                                                                    | No context artifact writes by default                                                                                                                                      |
| `unikit-review`      | Review output/comments only                                                                  | Context artifacts are read-only gates                                                                    | No context artifact writes by default unless user explicitly asks                                                                                                          |
| `unikit-verify`      | Verification report output + the machine-readable `unikit-gate-result` block (gate: `verify`) | Context artifacts are read-only gates                                                                    | May move to fix flow after user confirmation; no default context artifact writes. **Single sanctioned design write:** on all-AC-met for a cited GDD `SYS-id`@version, stamps `implemented_version` in `.unikit/gamedesign/GD-IDS.yaml` — the lone code→design write (a single surface; GAME.md's `## System Map [gen]` renders the `implemented` state read-only from it; see `gd-principles` → One-Way Boundary)                                                                                           |

**A plan manifest is edited, never rewritten.** `/unikit-implement`, `/unikit-verify` and `unikit-implement-{coordinator,worker}` touch only checkbox lines and the `## MCP Findings`, `## Rule Candidates` and `## Test Runs` sections. `## Technical Context` belongs to `/unikit-plan` and `/unikit-improve`.

### Manually managed artifacts (owner: user)

| Artifact                          | Description                                            |
|-----------------------------------|--------------------------------------------------------|
| `.unikit/RULES.md`          | Naming, access modifiers, class structure, DI conventions |
| `.unikit/memory/code/core/*.md`, `.unikit/memory/code/stack/*.md` | Design principles and framework-specific rules |
| `.unikit/memory/code/RULES_INDEX.md` | Index of rules files                           |
| `CLAUDE.md`                       | Anti-patterns, conventions, project overview           |

These files are **read-only for every command except the two named in the Artifact Update Policy below**: `/unikit-rules` writes `.unikit/RULES.md`, and only with a batch the user selected; `/unikit-memory` removes from it the entries it has migrated into the knowledge base. Everything else here only the user creates and edits directly.

## Artifact Update Policy

- **Owner writes only:** An artifact should be updated by its owner command.
- **Implement may do factual deltas:** `unikit-implement` may update `.unikit/DESCRIPTION.md` and `.unikit/ARCHITECTURE.md` only when implementation materially changed stack/structure.
- **Verify stays read-only:** `unikit-verify` reports drift and suggests owner commands; it does not update context artifacts by default. There are **two named exceptions**, and neither weakens the other: (1) the all-AC-met `implemented` writeback to the design layer (`GD-IDS.yaml` `implemented_version` — a single surface; GAME.md's `## System Map [gen]` renders it read-only), per the `unikit-verify` row above and `gd-principles` → One-Way Boundary; (2) appending a candidate row to the plan's `## Rule Candidates` — a plan edit, not a context-artifact edit, and never a write to `.unikit/RULES.md`.
- **User-managed files are untouchable, with one named writer:** `.unikit/RULES.md` is written **only** by `/unikit-rules`, and every other command reaches it exclusively by invoking that skill with a batch the **user has selected** — never on its own judgement. `/unikit-memory` may **remove** entries it has migrated into the knowledge base (Branch C, removal only). `rules/` and `CLAUDE.md` are edited by no command at all. A command may record a *candidate* rule in the plan's `## Rule Candidates` — that is a plan edit, not a rules edit.

## Context Gates (commit/review/verify)

These commands evaluate context consistency against:
- `.unikit/ARCHITECTURE.md`
- `.unikit/RULES.md` + `CLAUDE.md` (optional, graceful if missing)
- `.unikit/ROADMAP.md` (optional, graceful if missing)

Gate outputs must use:
- `WARN` for non-blocking mismatches or missing optional files
- `ERROR` for blocking violations

Additionally, `unikit-verify` and `unikit-review` each emit a machine-readable `unikit-gate-result` fenced JSON block as the **last** fence of their output (schema: `.unikit/system/gate-result-contract.md`). `unikit-verify` owns the `verify` gate (projecting its task-audit + context gates); `unikit-review` owns the `review` gate (projecting its Findings table). `unikit-commit` emits no gate-result block.

### Architecture Gate
- **Pass:** Changes follow documented module/layer boundaries and asmdef dependency rules.
- **Warn:** Architecture document appears stale or mapping is ambiguous.
- **Fail:** Clear boundary/dependency violation against explicit architecture rules (e.g. `Assets/Modules/` → `Assets/Game/`).

### Rules Gate
- **Pass:** Changes comply with explicit project rules from `RULES.md` and `CLAUDE.md`.
- **Warn:** Rule relevance is uncertain or cannot be verified confidently.
- **Fail:** Clear violation of an explicit rule (e.g. `async void`, missing `CancellationToken`, `System.Linq` in hot path).

### Roadmap Gate (only when `.unikit/ROADMAP.md` exists)
- **Pass:** `feat`/`fix`/`perf` work has milestone linkage in the plan's `## Roadmap Linkage` section.
- **Warn:** `.unikit/ROADMAP.md` missing, ambiguous milestone mapping, or no milestone linkage for `feat`/`fix`/`perf` work.
- Missing milestone linkage for `feat`/`fix`/`perf` when `.unikit/ROADMAP.md` exists: **warn** (never fail, even in strict mode).

## Threshold Decisions

### Verify normal mode
- Architecture/rules clear violations: **fail**
- Ambiguous or stale context artifacts: **warn**

### Verify strict mode
- Architecture clear violations: **fail**
- Rules clear violations: **fail**
- Stale context artifacts (DESCRIPTION.md, ARCHITECTURE.md out of sync): **warn**

### Commit and review mode
- Context gates are read-only and non-destructive.
- Blocking behavior is only allowed when explicitly requested by the user or policy extension.
