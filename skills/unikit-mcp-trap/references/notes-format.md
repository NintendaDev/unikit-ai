# `.unikit/MCP-RECHECK-NOTES.md` — the format

The project's log of what has to be re-checked about **this** engine MCP server.

**This file is the specification, and `/unikit-mcp-trap` owns it.** `/unikit-mcp-audit`
reads the same spec to curate what trap wrote (provider-owns-spec, the same arrangement
`unikit-gd-explore/references/delegation-contract.md` has with `unikit-gd-brainstorm`).
Neither skill may drift from it privately — a note is written by one skill and replayed
by another, months apart.

**Where it lives, and why there.** `.unikit/MCP-RECHECK-NOTES.md` sits at the root of
`.unikit/`, deliberately outside `.unikit/system/`. Everything under `system/` is
rewritten by every `init` / `update`; this file is the project's own accumulated
knowledge and no installer sweep may reach it. The installer only ever **renames** it,
when the selected server changes.

---

## Shape

```markdown
# MCP — what to re-check here
<!-- Written by /unikit-mcp-trap · curated by /unikit-mcp-audit · install only renames it -->

server:  <file id of the selected engine MCP server>
audited: <YYYY-MM-DD, or `never`>

## Check                                        ← read by the AGENT, by grep
| id | area | confirm that |
|---|---|---|
| R1 | rollback | the snapshot captured more than zero files |
| R2 | ui | markup file edit: a path inside the content root is accepted |
| R3 | visual | the baseline: where it landed, before anything leans on it |

## Observation protocol                         ← read ONLY by the audit
| id | observed | replay | evidence | from |
|---|---|---|---|---|
| R1 | 2026-08-18 | safe | `<call>(paths="…/DoesNotExist")` → `state=ready files=0` · the path is not validated | |
| R2 | 2026-08-18 | safe | `<call>(path="<content root>/X", action="read")` → `err: resolved path escapes the content root` | plans/2026-08-18_ui/PLAN.md#F2 |
| R3 | 2026-08-19 | manual | `<call>(name="probe")` → written under the client's working directory, not the project | |
```

### Two sections, because there are two readers

**Above the line — the instruction, with no names in it.** Read by every pipeline skill
that touches editor state, by grep, one area at a time. A name here would rot in days
and take the instruction down with it.

**Below the line — the protocol, with names in it.** Read only by `/unikit-mcp-audit`,
which needs the raw call to replay it. This is the **one** place in anything UniKit
ships or writes where a tool name is legitimate.

Merged into a single table, the two would force every executor to carry evidence twice
as long as the instruction it is reading, on every task.

### `observed` — a date, and nothing reads it

`observed` is the date the finding was **observed**. No skill reads it. It exists so that
a human opening this file can tell when they ran into this.

It is written by whoever did the observing, never by whoever moved the row here: a row
harvested out of a plan carries the date already in that plan's `## MCP Findings` table,
copied across verbatim, and a finding raised in the session being trapped carries today's.
Stamping the transfer date on both would relabel the column — it would then say when the
note was filed, which is a fact nobody needs and which is already implied by the ids.

**Replay order stays keyed on `R<n>`, not on this column.** Ids are allocated in order and
never reused, so they are already a monotonic clock; sorting a replay pass by a date would
add a second ordering that can tie, can be empty on a row lifted from an old plan, and can
disagree with the ids for no gain.

---

## Header

| field | written by | meaning |
|---|---|---|
| `server:` | trap, on creation | the file id of the server these entries were observed on |
| `audited:` | audit only | date of the last curation pass; `never` on a fresh file |

`server:` is compared against the delivery stamp at the top of
`.unikit/system/engine-mcp/INDEX.md`. **A mismatch is one WARN and nothing else** — the
entries are *suspect*, and still applied. A stale check costs one call; dropping checks
because the server moved costs the protection they existed for.

There is no `version:` field, and adding one back would not help. It used to be copied
here out of the delivery stamp, which the package writes — so both sides of the comparison
came from the same package constant, and the mismatch could only ever be produced by a
UniKit release, never by the server on this machine moving. A comparison that cannot fire
for the reason it was written is worse than none: it reads like a guard.

Trap never rewrites the header of an existing file. `audited:` moves only when an audit
pass has actually re-examined the entries behind it.

---

## Ids

`R<n>`, allocated in order, never reused. An id is the handle by which a note is
referenced from a plan (`from: <plan>#<id>`), retired by an audit, and cited in an
upstream diff. Reusing a freed id makes every one of those references point at the wrong
row.

An id appears in **both** tables, always. A check with no observation cannot be
replayed, retired, or upstreamed; an observation with no check is invisible to the
executors it was written for.

---

## `area` — the key

`area` is one of the 12 words in `.unikit/system/dev-principles.md` → A8:

```
by work kind   ui · scene · asset · anim · vfx · settings
cross-cutting  rollback · console · batch · compile · transport · visual
```

The key is an **area**, never a tool name. Executors grep their own `kind`'s area plus
every cross-cutting area; a key outside this vocabulary is unreachable and the note is
dead on arrival. Everything server- or engine-specific goes into the **text** of the
check, where it can be rewritten without breaking the index.

---

## Genre — the only real protection

> A note may contain **only a check**. Never a lifted gate, never a named workaround,
> never an assertion about the state of the server.

| a row that says | when the server fixes it |
|---|---|
| "confirm the snapshot captured more than zero files" | the check passes first try. Cost: one call |
| "GATE LIFTED — there is no test run here" | **the obligation is gone forever** |
| "use Y instead of X" | **the workaround outlives the fix**; that X works again is never discovered |

The danger is the genre, not the staleness. Under this rule the worst outcome of an
obsolete note is a redundant call, and an obsolete *wording* **fails safe**: the pipeline
stops rather than driving past.

Three rejections, applied to every candidate before it is offered:

- **an assertion about the server** ("the batch tool ignores errors") → rewrite as a
  check ("a batch report that contained an error is not evidence — re-read the state");
- **a pre-declared gate** (`GATE LIFTED`, "not reachable here", a list of what is
  missing) → refuse. `GATE LIFTED` is a **runtime verdict** of `/unikit-verify`,
  established by trying and producing the evidence of absence. It is never written into
  a file in advance;
- **a named replacement** ("call Y instead") → refuse. Say what to confirm, not what to
  call.

If a candidate cannot be expressed as a check, it does not belong in this file.

---

## `replay: safe` — the definition

> Admissible **only** if the evidence reproduces through changes that
> **(a)** live in the scene · **(b)** need no save · **(c)** do not write to the asset
> database · **(d)** do not enter Play Mode · **(e)** create no source files.
>
> Any one of them unmet → `manual`. **The default is `manual`.**

Source creation is excluded on purpose: it triggers a compile and a domain reload —
minutes of total unavailability that a skill session may not survive.

The asymmetry is deliberate. A wrongly-`manual` row is merely *shown* by an audit
instead of being replayed. A wrongly-`safe` row lets an audit mutate a real project. The
cost of the two mistakes is not comparable, so the tie goes to `manual`.

---

## Lifecycle of a note

| # | case | what happens |
|---|---|---|
| 1 | **new finding** | the executor puts a candidate in its run report and in the plan's `## MCP Findings` — never in this file; a human runs `/unikit-mcp-trap` |
| 2 | **the server changed** | the header names a different server than the delivery stamp: every row is suspect, **applied anyway**, one WARN |
| 3 | **trap fixed** | the audit replays the evidence of a `replay: safe` row → offers to retire it |
| 4 | **the call disappeared** | the replay fails → same outcome as "fixed"; no separate mechanism needed |
| 5 | **finding went upstream** | the packaged `INDEX.md` gained it → the audit sees the duplicate → offers to drop the local row |
| 6 | **genre violated** | rejected at write time by trap, and again at curation time by the audit |
| 7 | **useful to everyone** | the audit prints a diff for the packaged `INDEX.md` → PR → after merge, case 5 |

**Why the executor does not write here directly.** The same call failed one way with an
empty argument and "worked" with an explicit one. A single observation would have
recorded the wrong row, and it would have lived for months. The durable surface passes
through a human on purpose.

---

## Retiring — who owns which line

| line | lives in | retired by | how |
|---|---|---|---|
| a packaged trap | `mcp/<engine>/rules/<server>/INDEX.md` | the maintainers | a conformance run plus a diff |
| a local note | `.unikit/MCP-RECHECK-NOTES.md` | the project's own people | an audit that replays the evidence |

The audit is a **project** tool, not a release tool. It never edits the packaged tree —
that folder is rewritten by every `init` / `update`, so an edit there is lost silently.

---

## When the server changes

One file per server, always — active **or** archived, never both. On a change of the
selected engine MCP server the installer renames the active file to
`MCP-RECHECK-NOTES.archive.<previous server>.md`, and restores the archive of the new
server if one exists. Contents are never rewritten by the installer.

Consequence for both skills: the header is the only thing that says which server the
rows belong to, and it must never be silently "corrected" to match the current one. A
header that disagrees with the delivery stamp is information — that is exactly case 2.

Because the rename runs on every completed swap, that disagreement should be unreachable
in the ordinary course: it means the run that switched servers did not finish, or the file
was carried in by hand from another project. Both are worth one WARN and no more. Neither
is worth dropping the entries over — a check written against another server is at worst a
redundant call, and the genre above is what guarantees that.
