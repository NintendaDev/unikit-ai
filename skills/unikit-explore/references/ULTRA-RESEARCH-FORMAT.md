# unikit-explore — Ultra Research Format

Loaded on demand by `### Input handling` when the leading token is `ultra`.

Ultra research adds artifacts **inside** the existing research folder. It creates no new
root and no second registry: the folder `.unikit/code/researches/<slug>/` already exists,
and `researches/INDEX.md` is regenerated from the folders on every save — by the same
procedure, whatever the mode.

## Mode marker

Written exactly like this, as the **first line** of `RESEARCH.md`, exactly once, and
**never localized**:

```
<!-- unikit:research-mode:ultra -->
```

The namespace is the same `unikit:` prefix the rest of the repository uses. The plan marker
and the research marker are **different strings**, and no consumer may treat one as the
other: `/unikit-plan` reaches a research through `researches/INDEX.md`, never through this
marker. The line is declared here and nowhere else.

The marker has a second consumer now. The index generator reads the first line of every
manifest to fill the `Mode:` field of its record (`## Write order`, step 4), so the first
line of `RESEARCH.md` is read on every re-render, not only when ultra is requested.

## Manifest layout

One file carries the research. The header fields are machine-read; the sections below them
are the reasoning, and exactly one of those sections is the planner's input.

```markdown
<!-- unikit:research-mode:ultra -->   ← ultra only, first line
# <Research Title>

Created: YYYY-MM-DD HH:MM
Updated: YYYY-MM-DD HH:MM
Status: completed | in-progress | needs-follow-up
Lifecycle: active | paused | superseded
Research: <slug>
Target: SYS-<slug> | FLOW-<slug> | CONTENT-<slug>    (optional)
Kind: feature | improvement                          (optional)
Supersedes: <slug>                                   (optional)

## Table of Contents
## Artifact Index          ← ultra only
## Active Summary
<!-- unikit:active-summary:start -->
Topic:
Goal:
Scope:
Constraints:
Requirements:
Decisions:
Risks:
Open questions:
Success signals:
Next step:
<!-- unikit:active-summary:end -->
## Findings
## Sessions
<!-- unikit:sessions:start -->
### <YYYY-MM-DD HH:MM> — <session title>
<!-- unikit:sessions:end -->
```

Rules that travel with this layout:

- **The two state axes are independent, and neither is the other's synonym.** `Status` is
  completeness — its three values do not change and the field is never renamed, because the
  `/unikit-plan` registry filter greps it by name and answers "no researches found" rather
  than an error when it is gone. `Lifecycle` is currency: whether this research still
  describes the world. A paused research can be complete; a superseded one usually is.
- **Every age filter and all sorting run on `Updated:`.** `Created:` exists for display and
  for breaking ties, and no filter stands on it. In a research with a continuation cycle,
  freshness means "when this was last confirmed", not "when the folder was opened".
- **`## Sessions` is append-only.** Past entries are never rewritten; a new one is appended
  at the end, before the closing marker. The section is the record of how the summary above
  it came to say what it says.
- The region between the `## Active Summary` markers is the **hashed object**. Nothing else
  in the file is hashed, and the markers themselves are excluded from the bytes.

## Adaptive artifacts

Adaptivity is the whole point of this mode. The question is never "which four files does
ultra produce" but "which of these does this subject actually need".

| Artifact | File name | Include when |
|----------|-----------|--------------|
| Contracts | `CONTRACTS.md` | the research produced **at least one** concrete signature, file path or DI binding (threshold — `contracts-artifact.md`) |
| C4 context view | `C4-CONTEXT.md` | the change crosses an external-system boundary or a trust boundary |
| C4 container view | `C4-CONTAINER.md` | several runtime units are involved and the question "what executes where" genuinely came up |
| C4 component view | `C4-COMPONENT-<scope>.md` | responsibilities between components **inside one** container are materially unclear, and the dependency graph does not answer them |
| Dependency graph | `DEPENDENCY-GRAPH.md` | more than three nodes with non-linear links, or the order of edits matters |
| ADR | `ADR-NNNN-<kebab-slug>.md` | a **material, hard-to-reverse** decision was taken, with ≥2 real alternatives considered |

An artifact that is **not** created is named too, with the reason, in the `## Artifact Index`.
"Not applicable here" is a finding; silence is indistinguishable from an oversight.

## Artifact Index

In ultra mode `RESEARCH.md` carries this section immediately after `## Table of Contents`:

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
| `C-<n>` | a constraint the subject imposes | `RESEARCH.md` → `## Active Summary` → `Constraints:` |
| `REQ-<n>` | a requirement established by evidence | `## Active Summary` → `Requirements:` |
| `DEC-<n>` | a decision taken | `## Active Summary` → `Decisions:` |
| `RISK-<n>` | a material risk | `## Active Summary` → `Risks:` |
| `OQ-<n>` | an open question | `## Active Summary` → `Open questions:` |
| `ADR-<nnnn>` | a decision heavy enough to need its own file | its own file; the ID **is** the filename |

**An ID that affects the plan's requirements must exist in `## Active Summary` of `RESEARCH.md`.**
That section is the one input `/unikit-plan` takes and hashes, so a requirement-bearing ID
that lives anywhere else is invisible to the planner and its change produces no drift. IDs
that live only in `## Findings` trace the reasoning rather than state a requirement — that is
allowed, and it is said out loud here so the split is a choice and not an oversight.

**One fact is stated in exactly one owning section.** Any other mention is a reference by ID,
never a retelling. `## Findings` holds the evidence and the reasoning; `## Active Summary`
holds the requirement; an artifact holds the rationale. This is the rule that makes the
coherence gate decidable: a fact stated twice is a discrepancy even when the two statements
agree, because the second one is a copy that has to be kept true by hand.

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
2. `RESEARCH.md` — with the `## Artifact Index` pointing at files already written.
3. `SOURCE.md` (prompt-based explorations only).
4. `researches/INDEX.md` — **re-rendered whole** from the contents of the folders.
5. The Integrity checks.
6. The coherence gate.

Never write the index of artifacts before the artifacts — the links would point at files that
do not exist. The registry is re-rendered before the gate for the same reason in the other
direction: the gate reads durable files from disk, and would otherwise judge a registry that
does not yet describe what was just written.

## Integrity

Each check is **blocking**; saving stops until it passes:

1. Every `## Artifact Index` link exists, is relative, and does not escape the folder.
2. Every `.md` in the folder other than `RESEARCH.md` and `SOURCE.md` is listed in the index —
   an unlisted one is an orphan.
3. ADR numbers are unique within the folder.
4. **Every ID is unique within the research.** Two `DEC-7` in one research make any reference
   to them unresolvable, and nothing catches it except reading both.
5. **Every ID an adaptive artifact cites resolves in `## Active Summary`.** An artifact citing
   a code the summary does not define is the one way a second source of truth arrives
   unnoticed. This is the lift as an obligation: a C4, ADR or dependency-graph conclusion that
   changes requirements must reach the machine input, and saving stops until it does.
6. **Every requirement-bearing ID defined in `## Findings` or in an artifact is present in
   `## Active Summary`.** This is check 5 in the opposite direction, and it is what replaces
   the old reconciliation of two prose documents: instead of comparing retellings, resolve
   references both ways.
7. **Both `## Active Summary` markers are present exactly once, in the right order, and the
   region between them is non-empty** — and the same for `## Sessions`. Without this the
   hashed object does not exist, and the drift field of every plan built on this research has
   nothing to be filled from.

## What ultra research does not change

- The top-level `researches/INDEX.md` **format**, including the `Summary` field, which still
  comes from `Topic:`. The file itself is no longer hand-written: it is regenerated whole on
  every save, and the format is what stayed a contract while the authorship changed.
- **The input to `/unikit-plan`.** The plan reads `## Active Summary`; adaptive artifacts are
  optional reading "for the rationale", never a source of requirements.

The research-drift check needs no special case for an ultra research folder. It hashes the
region between the `## Active Summary` markers — one fixed section in one fixed file — and
adaptive artifacts sit beside it without touching it. A bundle-validation branch (a sibling
marker plus an `## Artifact Index` link) is needed only where the research source path varies
between a single configured file and a bundle entry point; UniKit's does not. Do not add such
a branch.
