# unikit-explore — Ultra Research Format

Loaded on demand by `### Input handling` when the leading token is `ultra`.

Ultra research adds artifacts **inside** the existing research folder. It creates no new
root, no new index and no new naming convention: `.unikit/code/researches/{YYYY-MM-DD}_{name}/`
already exists and is already registered in `researches/INDEX.md`.

## Mode marker

Written exactly like this, as the **first line** of `RESEARCH_RESULT.md`, exactly once, and
**never localized**:

```
<!-- unikit:research-mode:ultra -->
```

The namespace is the same `unikit:` prefix the rest of the repository uses. The plan marker
and the research marker are **different strings**, and no consumer may treat one as the
other: `/unikit-plan` reaches a research through `researches/INDEX.md`, never through this
marker. The line is declared here and nowhere else.

## Adaptive artifacts

Adaptivity is the whole point of this mode. The question is never "which four files does
ultra produce" but "which of these does this subject actually need".

| Artifact | File name | Include when |
|----------|-----------|--------------|
| C4 container view | `C4-CONTAINER.md` | several runtime units are involved and the question "what executes where" genuinely came up |
| C4 context view | `C4-CONTEXT.md` | the change crosses an external-system boundary or a trust boundary |
| ADR | `ADR-NNNN-<kebab-slug>.md` | a **material, hard-to-reverse** decision was taken, with ≥2 real alternatives considered |
| Dependency graph | `DEPENDENCY-GRAPH.md` | more than three nodes with non-linear links, or the order of edits matters |

An artifact that is **not** created is named too, with the reason, in the `## Artifact Index`.
"Not applicable here" is a finding; silence is indistinguishable from an oversight.

## Artifact Index

In ultra mode `RESEARCH_RESULT.md` carries this section immediately after
`## Table of Contents`:

```markdown
## Artifact Index

| Artifact | Purpose | Why included | Status |
|----------|---------|--------------|--------|
| [C4-CONTAINER.md](C4-CONTAINER.md) | … | … | active |

Considered and **not** created: `C4-CONTEXT.md` — … ; `ADR` — … .
```

Rules:

- Links are **relative and inside the folder** — never `../`.
- Every row carries its reason for existing, not just its name.
- The "considered and not created" line is **mandatory**, even when nothing was declined:
  then it reads `Considered and not created: none`.

## ADR format

Minimal, and deliberately not invented here:

```markdown
# ADR-NNNN: <title>

Status: proposed | accepted | superseded
Date: YYYY-MM-DD

## Context
## Decision
## Alternatives Considered
| Option | Benefits | Costs | Why not selected |
## Consequences
## Evidence
```

`NNNN` is sequential **within one research folder**, starting at `0001`. A new ADR that
overrides an older one carries `Supersedes: ADR-NNNN`; the older one gets
`Status: superseded` and is **not deleted** — it remains the trace of the reasoning, and
removing it makes the replacement look unmotivated.

## Identifiers

IDs are optional. Add one only when something else references it — another artifact or a
handoff. Do not add IDs to make a short note look formal; an unreferenced ID is noise with a
version number.

The vocabulary is closed. Six prefixes, and adding a seventh is a decision, not a
convenience:

| Prefix | Means | Lives in |
|--------|-------|----------|
| `C-<n>` | a constraint the subject imposes | `RESEARCH_BRIEF.md` → `## CONSTRAINTS` |
| `REQ-<n>` | a requirement established by evidence | `RESEARCH_BRIEF.md` → `## CONTEXT` |
| `DEC-<n>` | a decision taken | `RESEARCH_RESULT.md` → `## Decisions` |
| `RISK-<n>` | a material risk | `RESEARCH_RESULT.md` → `## Conclusions` |
| `OQ-<n>` | an open question | `RESEARCH_RESULT.md` → `## Open Questions` |
| `ADR-<nnnn>` | a decision heavy enough to need its own file | its own file; the ID **is** the filename |

**An ID that affects the plan's requirements must exist in `RESEARCH_BRIEF.md`.** The brief is
the one file `/unikit-plan` takes as input and hashes, so a requirement-bearing ID that lives
anywhere else is invisible to the planner and its change produces no drift. IDs that live only
in `RESEARCH_RESULT.md` trace the reasoning rather than state a requirement — that is allowed,
and it is said out loud here so the split is a choice and not an oversight.

**An ID is stable and is never reused.** A withdrawn question keeps its number out of
circulation; the next one takes the following number. Reuse silently rewrites the history of
anything that already cited it.

**A superseded item keeps its ID.** Mark it superseded, name what replaced it, and leave it
in place. `ADR-<nnnn>` additionally carries `Supersedes:` / `Status: superseded` per the ADR
format above.

Numbering is per research folder and starts at 1 — `ADR-` at `0001`, zero-padded to four
because it is a filename and must sort lexically.

## Write order

1. The adaptive artifacts.
2. `RESEARCH_RESULT.md` — with the `## Artifact Index` pointing at files already written.
3. `RESEARCH_BRIEF.md`.
4. `RESEARCH_SOURCE.md` (prompt-based explorations only).
5. `researches/INDEX.md`.

Never write the index of artifacts before the artifacts — the links would point at files that
do not exist.

## Integrity

Each check is **blocking**; saving stops until it passes:

1. Every `## Artifact Index` link exists, is relative, and does not escape the folder.
2. Every `.md` in the folder other than the three canonical files is listed in the index —
   an unlisted one is an orphan.
3. ADR numbers are unique within the folder.
4. **Every ID is unique within the research.** Two `DEC-7` in one research make any reference
   to them unresolvable, and nothing catches it except reading both.
5. **Every ID an adaptive artifact cites resolves in `RESEARCH_BRIEF.md` or in
   `RESEARCH_RESULT.md`.** An artifact citing a code neither file defines is the one way a
   second source of truth arrives unnoticed. This check also covers the lift: a C4, ADR or
   dependency-graph conclusion that changes requirements, constraints, interfaces or patterns
   and has not reached the brief leaves the folder unfinished, and saving stops until it does.

## What ultra research does not change

- The folder name and its `{YYYY-MM-DD}_{name}` convention.
- The three canonical files, and the format of each.
- The top-level `researches/INDEX.md` format, including the `Summary` field, which still
  comes from `## Topic`.
- The `init` rebuild branch.
- **The input to `/unikit-plan`.** The plan reads `RESEARCH_BRIEF.md`; adaptive artifacts are
  optional reading "for the rationale", never a source of requirements.

**The lift is an obligation, not a courtesy.** Any C4, ADR or dependency-graph conclusion that
changes requirements, constraints, interfaces or patterns **must** be carried into
`RESEARCH_BRIEF.md` before the folder is handed to `/unikit-plan`. The artifact stays the place
of the reasoning; the brief is the place of the requirement. This is the producer's duty: the
planner has no way to learn that an ADR in the folder was never lifted, and because only the
brief is hashed, superseding an unlifted ADR produces no drift at all.

The research-drift check (`## Based on` → `Brief SHA256`) needs no special case for an ultra
research folder. It hashes `RESEARCH_BRIEF.md` — one fixed filename in one fixed location —
and adaptive artifacts sit beside it without touching it. A bundle-validation branch (a
sibling marker plus an `## Artifact Index` link) is needed only where the research source path
varies between a single configured file and a bundle entry point; UniKit's does not. Do not
add such a branch.
