# unikit-explore — Ultra Research Format

Ultra only. A standard research does not read this file: the manifest template, the identifier
rules and the write order bind every research, and they live in `SKILL.md`. An ultra research
loads this file whole, from `### Input handling` on the leading token. Every section below is
marked `Applies to: ultra only`; a section a standard research would need does not belong here.

Ultra research adds artifacts **inside** the existing research folder. It creates no new
root and no second registry: the folder `.unikit/code/researches/<slug>/` already exists,
and `researches/INDEX.md` is regenerated from the folders on every save — by the same
procedure, whatever the mode.

## Mode marker

Applies to: ultra only
A standard research writes no marker. That the registry generator READS one says
nothing about the mode that wrote it.

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
manifest to fill the `Mode:` field of its record (`SKILL.md` → Step 4), so the first
line of `RESEARCH.md` is read on every re-render, not only when ultra is requested.

## Adaptive artifacts

Applies to: ultra only

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

Applies to: ultra only

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

Applies to: ultra only

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

## Integrity

Applies to: ultra only

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
8. **Every artifact that WAS created names its concrete inclusion signal in
   `## Artifact Index`.** The rule that an artifact which was *not* created is named with its
   reason already lives in `## Adaptive artifacts`, and it is checked; the created half is
   not. The asymmetry runs the wrong way — creating a file is cheaper than deciding against
   one, so the unchecked half is the one that fills a folder.
9. **The research is about its subject.** A passage explaining how this folder complies with
   a gate, or listing what to implement, is not a finding about the subject. Gate outcomes
   live in the `Gate:` field of the session entry; implementation belongs to a plan. A
   research that starts documenting its own process hands the next pass an assertion to
   check, and the check is about the process too.

## What ultra research does not change

Applies to: ultra only

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
