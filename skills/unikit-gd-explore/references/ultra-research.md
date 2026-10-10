# unikit-gd-explore — Ultra Research Format

Ultra only. A standard research does not read this file: the record template, the identifier
rules and the write order bind every research, and they live in `references/save-research.md`.
An ultra research loads this file whole, from `## Ultra research (user-named)` in `SKILL.md` on
the leading token. An ultra research differs from a standard one in two ways: it pins its
dialogue log while the conversation goes on (`## Pinning`), and at save time it writes adaptive
artifacts into the research folder. Every section below is marked `Applies to: ultra only`; a
section a standard research would need does not belong here.

Ultra research adds artifacts **inside** the existing research folder. It creates no new root
and no second registry: the folder `.unikit/gamedesign/researches/<slug>/` is the same one a
standard research uses, and `researches/INDEX.md` is updated by the same procedure, whatever the
mode: a save prepends or revises its own entry, and `init` rebuilds the file from the folders,
keeping entries whose folder is still there.

## Mode marker

Applies to: ultra only

A standard research writes no marker. That the index rebuild READS one says nothing about the
mode that wrote it.

Written exactly like this, as the **first line** of `RESEARCH_RESULT.md`, exactly once, and
**never localized**:

```
<!-- unikit:research-mode:ultra -->
```

The namespace is the same `unikit:` prefix the rest of the repository uses. The plan marker and
the research marker are **different strings**, and no consumer may treat one as the other: a
plan reaches a research through `researches/INDEX.md`, never through this marker. The line is
declared here and nowhere else.

The marker has a second consumer: `references/init-index.md` reads the first line of every
record to fill the `**Mode**` field of the index entry it adds, so the first line of
`RESEARCH_RESULT.md` is read on every rebuild, not only when ultra is requested.

**Which saves write it.** A save made in an ultra session writes the marker and the `**Mode**`
field — also when it updates a record that was standard (the record becomes ultra). A save made in
a standard session of an ultra record leaves the marker and `**Mode**` as they are: a mode is never
removed by a save.

## Pinning: the log is written as you talk

Applies to: ultra only

A prompt-based **ultra** exploration does not assemble its dialogue log at the end: the log is
**pinned** to disk while the conversation is still going, and appended to from there on.
Pinning and saving are two different operations, and only the second one saves the research.
An ordinary exploration pins nothing — it writes nothing until the user agrees to save.

Ultra is recognised when the request is made. Naming ultra later in the conversation starts no
pinning; it changes only what is written at save time.

**When the first write happens is your judgement, with a floor.** Pin as soon as any one of
these has happened — the list is closed:

- a requirement or a constraint was stated;
- a decision was made;
- the user corrected you;
- a comparison, a table or a diagram was produced that the conversation then leans on.

Any one of them is enough, and nothing outside the list counts: "this feels like it is going
somewhere" is not a signal. The judgement asked of you here is the coarse one — *is this a
research yet?* — and you already make it in `SKILL.md` → *Saving Research Results*, where you
decide the conversation has crystallized. It is **not** the judgement of which words matter;
that one you are never allowed to make, and `## SOURCE.md` below says why.

**The floor.** The first write happens no later than the moment you would offer to save.

**Where, and the slug.** `.unikit/gamedesign/researches/<slug>/SOURCE.md`, with `<slug>` chosen
by the ordinary rule (`references/save-research.md`: kebab-case, no date, `researches/<slug>/`).
`.unikit/gamedesign/researches/` is created with `mkdir -p`, silently, when it is absent.

At the **first pin** the slug is fixed, and two things happen once:

- the slug is named to the user in one line — a different name is named **before** the first
  pin, not at save time;
- if `researches/<slug>/RESEARCH_RESULT.md` **or** `researches/<slug>/SOURCE.md` already exists
  (an abandoned ultra log counts: it is never overwritten by a first write), the collision question
  (`Update it` / `Save under another name`, its text lives in `references/save-research.md`) is
  asked **now**, and the save does not repeat it. An automatic suffix stays forbidden.

The slug is **not renamed at save time**: this skill cannot move a folder, so the save writes
under the pinned slug and asks no slug question. A user who wants another name renames the
folder afterwards, and `init` rebuilds the index.

**What goes into the first write:** the whole conversation from its first turn, verbatim, by
the rules in `## SOURCE.md` below — including the turns that came before the signal, minus the
framework questions, which are never logged, and with the *not verbatim* section when the
user's earliest words are gone.

**After that, append.** Each of your replies ends by appending that exchange's user turns to the
end of the file — one `Edit`, and no judgement involved. An exchange that is a framework
question is skipped whole.

**What pinning is not.** The first write:

- does **not** create `RESEARCH_RESULT.md` or any adaptive artifact;
- does **not** rebuild `researches/INDEX.md`;
- does **not** run the coherence gate or the `## Integrity` checks;
- does **not** ask for confirmation to save the research — that question stays where it is;
- does **not** mean the research is finished, and you may not cite the file's existence as a
  sign that it is.

**A session that never crystallizes leaves nothing behind, and that is the correct outcome.**

**Failures.**

- The `Edit` did not go through — no permission, no disk. Print one line and **carry on with
  the conversation**:

  ```
  WARN [pin] could not append to SOURCE.md — pinning is off for the rest of this session
  ```

  This is also the one state in which the save has to pick the log up itself: it writes the
  whole log from the conversation as it stands.

**On a continuation** (a second session on the same slug, reached through the `Update it`
answer) pinning writes into the same file, into that session's
`## Session <YYYY-MM-DD HH:MM>` block — appended, never rewritten.

## SOURCE.md

Applies to: ultra only

`SOURCE.md` is a **log, not a derived representation of the research.** Two consequences, both
deliberate: it is not a durable-scope file of the coherence gate (`references/coherence-gate.md`
keeps it outside), and a log is allowed to be redundant with `RESEARCH_RESULT.md`.

**Template**:

```markdown
# Exploration Request

## Original Request
<The exact text of the user's initial request that started this exploration>

## Questions & Answers

### Q1: <Exact question text as it was asked>
Offered:
  A) <the option exactly as it was put to the user>
  B) <...>
**Answer**:
> <The user's own words, verbatim.>

### Q2: <Exact question text>
**Answer**:
> <verbatim>

## Additional Clarifications

<Every extra detail, correction or clarification the user gave, each as a blockquote in the
user's own words. If none — write "None">

## Conclusion
<What was decided and what understanding was reached. This is the one section written in
your own words.>
```

**An answer is a quotation, never a digest.** The blockquote is the only admissible form of an
answer the user gave. When the answer was not the user's but was found during the exploration,
say so on the line after the quote.

**A choice with no recorded menu is not an answer.** When the answer picked among options you
put to the user, write those options down next to it under `Offered:`; without them a reply like
"option 1" resolves to nothing.

**Framework questions are not logged.** Three exchanges belong to the machinery of this skill,
not to the subject, and are left out of the log whole — the question and its answer: *Save this
research?*; the choice of the folder name together with the existing-slug question; and the
coherence gate's question when its budget is spent. The list is closed. For anything else the
test is whether the answer could become or change a requirement, a constraint or a decision of
the subject: if it could, the exchange is logged, whoever asked. When the answer to a listed
question carries subject content as well ("yes, but also include X"), the content part is logged
as an ordinary user turn and the service part ("yes") is not.

**Mark your own cuts, and only your own.** `[…]` means *you* left something out of the
quotation. A bare `…` means the user spoke that way — trailed off or paused.

**Never cut inside a noun phrase that names a structure, an order or a quantity.** What tells
two such requirements apart is rarely the noun — it is the modifiers next to it, and they are the
words a cut removes first because they read as decoration. When in doubt, do not cut.

The one admissible exception is a secret: a credential, a token or a key quoted by accident is
cut, marked `[…]`, and the reason is written on its own line under the quote.

**When the user's words are no longer there.** If the oldest part of the context is a summary of
earlier turns instead of the turns themselves, those turns cannot be quoted and a digest must
not pass for a quotation. Do not reconstruct them; put a section directly under
`# Exploration Request`:

```markdown
## Earlier turns (not verbatim)
<!-- unikit:not-verbatim -->
These turns reached the log as a summary carried by the context, not as the user's words.
<the summary, as short as the context allows>
```

`## Original Request` then holds the exact request if it is still visible, and otherwise the
single line `Not available verbatim — see the section above.` A requirement that rests only on
what that section covers is not a quotation-backed one: it goes through a readback with the
user, and the user's answer there is logged and becomes its anchor.

**On a continuation, append — never rewrite.** A new session adds a fresh block
`## Session <YYYY-MM-DD HH:MM>` at the end of the file; everything already in the file stays
exactly as it is.

## Adaptive artifacts

Applies to: ultra only

Adaptivity is the whole point of this mode. The question is never "which files does ultra
produce" but "which of these does this subject actually need".

| Artifact | File name | Include when |
|----------|-----------|--------------|
| Dialogue log | `SOURCE.md` | always in ultra (pinned) |
| Decision | `ADR-NNNN-<kebab-slug>.md` | a **material, hard-to-reverse** decision was taken, with ≥ 2 real alternatives considered |
| Model | `MODEL-<scope>.md` | the research produced a numeric model, a matrix or tables that other artifacts or a downstream document will cite |
| Measurement protocol | `MEASUREMENT.md` | it is settled how to measure: stands, metrics, bands, sample |
| Phases | `PHASES.md` | at least three phases with dependencies or return points |
| Dependency graph | `DEPENDENCY-GRAPH.md` | more than three nodes with non-linear links, or the order of edits matters |

A C4 view and a contracts file are **not** created by default: they describe the structure of a
program, not of a design. They are named in the "considered and not created" line with the reason.

An artifact that is **not** created is named too, with the reason, in the `## Artifact Index`.
"Not applicable here" is a finding; silence is indistinguishable from an oversight.

## Artifact Index

Applies to: ultra only

In ultra mode `RESEARCH_RESULT.md` carries this section immediately after `## Table of Contents`:

```markdown
## Artifact Index

| Artifact | Purpose | Why included | Status |
|----------|---------|--------------|--------|
| [MODEL-economy.md](MODEL-economy.md) | … | … | active |

Considered and **not** created: `MEASUREMENT.md` — … ; `ADR` — … .
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
overrides an older one carries `Supersedes: ADR-NNNN`; the older one gets `Status: superseded`
and is **not deleted** — it remains the trace of the reasoning, and removing it makes the
replacement look unmotivated.

## Integrity

Applies to: ultra only

Each check is **blocking**; saving stops until it passes. A finding names the check and the file;
a structural violation (an orphan, a broken link) is repaired as it stands, and a value
inconsistency only by the closed repair list of `references/coherence-gate.md`.

1. Every `## Artifact Index` link exists, is relative, and does not escape the folder.
2. Every `.md` in the folder other than `RESEARCH_RESULT.md`, `RESEARCH_BRIEF.md` and
   `SOURCE.md` is listed in the index — an unlisted one is an orphan.
3. ADR numbers are unique within the folder.
4. **Every identifier is unique within the research.** Two `DEC-7` in one research make any
   reference to them unresolvable, and nothing catches it except reading both.
5. **Every identifier an artifact cites resolves in the record, where it is defined:** `F-<n>` in
   `## Findings`, `DEC-<n>` and `RISK-<n>` in `## Conclusions`, `OQ-<n>` in `## Open Questions`.
   The summary defines nothing; it only cites.
6. **The opposite direction:** every `DEC-<n>`, `RISK-<n>` and `OQ-<n>` defined there or in an
   artifact is cited by the summary (the `Decisions:`, `Risks:` and `Open questions:` lines of
   `## Active Summary`). `F-<n>` is not required in the summary.
7. **Both marker pairs (the summary and the sessions) are present exactly once, in the right
   order, and the region between each pair is non-empty.** Without this the object a downstream
   reader relies on does not exist.
8. **Every artifact that WAS created names its concrete inclusion signal in
   `## Artifact Index`.** Creating a file is cheaper than deciding against one, so the unchecked
   half is the one that fills a folder.
9. **The research is about its subject.** A passage explaining how this folder complies with a
   gate, or listing what to implement, is not a finding about the subject. Gate outcomes live in
   the `Gate:` field of the session entry; implementation belongs to a plan. A research that
   starts documenting its own process hands the next pass an assertion to check, and the check
   is about the process too.

## What ultra research does not change

Applies to: ultra only

- The format of an entry of `researches/INDEX.md` except the `**Mode**` field, and
  `RESEARCH_BRIEF.md` with its mode-aware blocks for `unikit-gd-system`, `unikit-gd-flow` and
  `unikit-gd-content`; the Next Steps routing is the same.
- **What a downstream skill reads.** The zones `unikit-gd-system`, `unikit-gd-flow` and
  `unikit-gd-content` read `RESEARCH_BRIEF.md` and its mode-aware block; the `## Active Summary`
  serves a reader who comes back after `/clear`, and adaptive artifacts are optional reading "for
  the rationale", never a source of requirements.
