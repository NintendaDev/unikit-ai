# unikit-explore — The Contracts Artifact

Loaded on demand when an ultra research is deciding whether it owes a `CONTRACTS.md`.

## What it is

`CONTRACTS.md` is an **adaptive artifact**: the concrete, mechanical half of a research —
the interfaces whose contracts changed, the code an implementer should copy, the files to
create and modify, the DI bindings to register. It is the material a plan reasons *from*.

## When it is created

`CONTRACTS.md` is created **if and only if** the research produced at least one concrete
signature, one concrete file path or one concrete DI binding. An empty template and sections
filled with `N/A` are **forbidden**.

The threshold is strict on purpose. An empty template is exactly the disease this format was
changed to cure: a file that exists, looks authoritative, says nothing, and still has to be
kept in sync. And under-supplying the planner costs nothing, because `/unikit-plan` rebuilds
its `## Technical Context` against the live code anyway and declares its own section
authoritative — these contracts are a starting point, not a requirement.

An artifact that is **not** created is named with its reason in the `## Artifact Index` of
`RESEARCH.md`, by the general rule for adaptive artifacts.

## What it is not

`CONTRACTS.md` is **not the planner's machine input.** `/unikit-plan` reads
`## Active Summary` of `RESEARCH.md` and hashes it; contracts are optional reading "for the
rationale", in exactly the same class as an ADR or a C4 view. A requirement that lives only
here is invisible to the planner and its change produces no drift — which is why anything
requirement-bearing has to be lifted into `## Active Summary` (Integrity checks 5 and 6).

## Template

```markdown
# Contracts: <research title>

Research: [RESEARCH.md](RESEARCH.md)

## Interfaces
<!-- only interfaces with new or changed contracts; tag each [NEW|MODIFY|EXTEND] -->

## Key Patterns
<!-- code the agent uses as a template; only the non-trivial and project-specific -->

## Files
### CREATE
| Path | Type | Notes |
### MODIFY
| Path | Change |

## DI Bindings
<!-- which Installer, and which method to insert into -->
```

## Filling rules

**Interfaces.** Only interfaces whose contract is new or changed. Tag each one `[NEW]`,
`[MODIFY]` or `[EXTEND]`. For `[MODIFY]`, mark the delta inside the code block with
`// REMOVE:` and `// ADD:` comments — a modified interface shown without its delta makes the
reader diff it by eye against a file they have not opened. Write the namespace as the first
line inside the code block. Add one-line comments for non-obvious members.

**Key Patterns.** Code from the research that an implementer should follow as a template.
Include only what is non-trivial or project-specific; a pattern the language documentation
already teaches is noise. Add a one-line comment naming where it is used.

**Files.** `CREATE` carries the new files, with a `Type` and a `Notes` column that either
points at `## Interfaces` or gives a brief note. `MODIFY` carries one specific line per file
— `+method`, `-method`, `type A -> type B`. **`MODIFY` and `CREATE` never contain the same
path**: a file is either new or it is not, and a path in both columns means one of the two
statements is stale.

**DI Bindings.** Copy the bindings verbatim from the research and name, in a comment, which
Installer and which method they go into.

**Every code block declares its language** (```csharp, ```gdscript, …). A block with no
language is not rendered, not highlighted, and not greppable by tooling that filters on it.

## A section with no content is deleted

A section that has nothing to say is **removed from the file**, not filled with a placeholder.

This is a direct inversion of the rule the retired brief-filling reference carried ("do not
remove sections even if they seem empty — fill with placeholder `N/A`"), and the reason is
worth stating because the old rule looked tidier: **`N/A` is indistinguishable from "we did
not check".** A reader cannot tell a considered "this research needs no DI bindings" from a
section nobody got to, so the placeholder converts an absence of work into an appearance of
work. An absent section says the same thing honestly, and the `## Artifact Index` is where a
deliberate "not applicable" is recorded with its reason.

By the same rule, a research that would produce **only** empty sections produces no
`CONTRACTS.md` at all.

## What does not belong here

Reasoning does not live in this file. It belongs in `## Findings` of `RESEARCH.md`, or in an
ADR when the decision was material and hard to reverse:

- explanations of **why** a decision was taken;
- comparisons of alternatives;
- change history and commit references;
- diagrams drawn for humans;
- prose outside code blocks and tables.

## Where the retired brief's sections went

The three-file research format is gone, and its brief with it. Recorded here so the next
reader does not go looking through history for a section that moved:

| Brief section | New owner |
|---------------|-----------|
| `## CONTEXT` | `## Active Summary` → `Topic:` / `Goal:` / `Scope:` |
| `## CONSTRAINTS` | `## Active Summary` → `Constraints:` (`C-<n>`) |
| `## INTERFACES` | `CONTRACTS.md` → `## Interfaces` |
| `## KEY PATTERNS` | `CONTRACTS.md` → `## Key Patterns` |
| `## DEPENDENCY GRAPH` | `DEPENDENCY-GRAPH.md` |
| `## FILES` | `CONTRACTS.md` → `## Files` |
| `## DI BINDINGS` | `CONTRACTS.md` → `## DI Bindings` |
| `## OUT OF SCOPE` | `## Active Summary` → `Scope:` (the out-half) — the deliberate duplicate is dropped |

The last row is the one that mattered. The retired format instructed the writer to restate
the stop condition in a second section — "**duplicate explicitly**" — which is the only place
in this repository where a format ordered a value to be written twice. Its removal is half the
reason the coherence gate can now converge: one value, one owning section.
