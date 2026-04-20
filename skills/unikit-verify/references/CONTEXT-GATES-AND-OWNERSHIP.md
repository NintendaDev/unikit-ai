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
| `unikit-plan`        | `.unikit/PLAN.md` (fast), `.unikit/plans/{folder}/TASKS.md` + `PLAN-BRIEF.md` (full)      | `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`, `.unikit/ROADMAP.md`, `.unikit/researches/`         | `unikit-improve` may refine existing plan files                                                                                                                            |
| `unikit-improve`     | Refinements to `.unikit/PLAN.md` or existing plans in `.unikit/plans/`                       | `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`, `.unikit/researches/`                               | None                                                                                                                                                                      |
| `unikit-implement`   | Plan progress updates (checkboxes/task status)                                               | `.unikit/RULES.md`, `.unikit/ARCHITECTURE.md`, `.unikit/DESCRIPTION.md`, `.unikit/ROADMAP.md`, `.unikit/patches/`, `.unikit/memory/` | May update `.unikit/DESCRIPTION.md` and `.unikit/ARCHITECTURE.md` only when stack/structure changed; may update `.unikit/ROADMAP.md` milestone completion |
| `unikit-fix`         | `.unikit/FIX_PLAN.md` (plan mode), `.unikit/patches/*.md`                                   | `.unikit/DESCRIPTION.md`, `.unikit/ARCHITECTURE.md`, `.unikit/RULES.md`, `.unikit/memory/`, existing patches | None (context artifacts remain read-only by default)                                                                                                                       |
| `unikit-explore`     | `.unikit/researches/` only (`RESEARCH_RESULT.md`, `RESEARCH_BRIEF.md`)                                  | All context and codebase files for analysis                                                              | None                                                                                                                                                                      |
| `unikit-commit`      | Git commit object/message only                                                               | Context artifacts are read-only gates                                                                    | No context artifact writes by default                                                                                                                                      |
| `unikit-review`      | Review output/comments only                                                                  | Context artifacts are read-only gates                                                                    | No context artifact writes by default unless user explicitly asks                                                                                                          |
| `unikit-verify`      | Verification report output                                                                   | Context artifacts are read-only gates                                                                    | May move to fix flow after user confirmation; no default context artifact writes                                                                                           |

### Manually managed artifacts (owner: user)

| Artifact                          | Description                                            |
|-----------------------------------|--------------------------------------------------------|
| `.unikit/RULES.md`          | Naming, access modifiers, class structure, DI conventions |
| `.unikit/memory/core/*.md`, `.unikit/memory/stack/*.md` | Design principles and framework-specific rules |
| `.unikit/memory/RULES_INDEX.md` | Index of rules files                           |
| `CLAUDE.md`                       | Anti-patterns, conventions, project overview           |

These files are **read-only for all commands**. Only the user creates and edits them directly.

## Artifact Update Policy

- **Owner writes only:** An artifact should be updated by its owner command.
- **Implement may do factual deltas:** `unikit-implement` may update `.unikit/DESCRIPTION.md` and `.unikit/ARCHITECTURE.md` only when implementation materially changed stack/structure.
- **Verify stays read-only:** `unikit-verify` reports drift and suggests owner commands; it does not update context artifacts by default.
- **User-managed files are untouchable:** No command edits `RULES.md`, `rules/`, or `CLAUDE.md`. Commands may propose changes and instruct the user to edit manually.

## Context Gates (commit/review/verify)

These commands evaluate context consistency against:
- `.unikit/ARCHITECTURE.md`
- `.unikit/RULES.md` + `CLAUDE.md` (optional, graceful if missing)
- `.unikit/ROADMAP.md` (optional, graceful if missing)

Gate outputs must use:
- `WARN` for non-blocking mismatches or missing optional files
- `ERROR` for blocking violations

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
