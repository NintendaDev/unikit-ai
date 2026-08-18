---
name: unikit-mcp-audit
description: >-
  Curate .unikit/MCP-RECHECK-NOTES.md — the project's log of findings about the
  configured engine MCP server. Four jobs: re-stamp (the server or version moved,
  so every entry is suspect), replay (reproduce a `replay: safe` finding inside a
  disposable sandbox to see whether it still holds), retire (offer to drop what was
  fixed or went upstream), and upstream (print a ready diff for the packaged
  INDEX.md). Use for "audit the MCP notes", "are these findings still true",
  "recheck the MCP traps", "clean up MCP-RECHECK-NOTES", "the server was updated —
  revisit the notes". Replaying mutates a live editor, so it runs behind an
  eight-step safety envelope: refuses on a dirty scene, compilation, or Play Mode,
  shows everything it will create before one confirmation, and never saves the
  scene. To record a NEW finding use /unikit-mcp-trap instead.
argument-hint: "[optional: a note id such as R2, or `stamp` | `replay` | `retire` | `upstream`]  (mutates a live editor — gated)"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git *)
  - Bash(date *)
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: tools
---

# MCP Audit — curate the recheck notes

`.unikit/MCP-RECHECK-NOTES.md` accumulates. Findings get fixed upstream, calls disappear,
servers move. Left alone the file drifts from a protection into a superstition — every
row costing a call, none of them still true.

This skill is the pass that keeps it honest. It is a **project** tool, not a release
tool: it curates what this project observed, and it never edits the packaged rules tree
(`.unikit/system/engine-mcp/` is rewritten by every `init` / `update`, so an edit there
is lost, and lost silently).

**The format is not owned here.** `/unikit-mcp-trap` owns
`references/notes-format.md`; this skill reads it as the interface and curates against
it.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md` and
apply it to all output (fall back to English if it is missing). Ids, `area` keywords, and
the observation protocol stay **English** — other skills grep them. Do not announce the
language setting.

## Bootstrap

Silently load — do not narrate:

1. **`{{skills_dir}}/unikit-mcp-trap/references/notes-format.md`** — the format
   specification: header fields, the two sections, ids, the genre rejections, and the
   `replay: safe` definition. Mandatory; without it, curate nothing.
2. **`.unikit/system/dev-principles.md`** — the evidence contract (A1/A2), the failure
   classes (A3), the area vocabulary (A8), and `no rules ≠ no rights` (A9). Read the
   deep reference below the boundary too: this skill touches editor state, so it is a
   first Editor task by definition.
3. **`.unikit/system/engine-mcp/INDEX.md`** — the delivery stamp (`server:` /
   `version:`) and the base section, including **how a project-relative asset path is
   written for this engine** (see "The asset root is a contract" below). File absent →
   there are no known exceptions; that restricts nothing and switches nothing to
   `⏸️ MANUAL`.
4. **`.unikit/MCP-RECHECK-NOTES.md`** — the file being curated. Absent → say so and
   stop; there is nothing to audit and nothing to create.

Then pick the run id: `<runid>` is a short token unique to this run (a timestamp is
enough). Every object, asset, and file this skill creates carries it.

## The asset root is a contract, not a path

When a replay needs an asset, it goes under a **project-relative audit folder**:

```
<the project's asset root>/UNIKIT_AUDIT_<runid>/
```

**The literal form of that root is engine-specific and must not appear in this file.**
Take it from `.unikit/system/engine-mcp/INDEX.md` → the access/base section, which states
how project-relative paths are written for the configured engine. Not stated there → ask
the user once, and record the answer for this run only.

This is not pedantry about portability. A hard-coded root passes every guard in the
repository and then makes the sandbox contract **unsatisfiable on any other engine** —
silently, because the path simply resolves somewhere else. The whole safety of a replay
rests on "everything I created is under one prefix I can delete in one action". The same
split is why `unikit-gd-recon/SKILL.md` stays engine-agnostic and puts the per-engine
matrix into `references/code-recon.md`.

## Job 1 — stamp

Compare the notes header (`server:` / `version:`) against the delivery stamp.

Different → print one line and continue:

```
WARN [mcp-audit] server/version in notes header ≠ configured (<notes> ≠ <configured>)
```

A mismatch makes every entry **suspect**, not void. Suspect entries stay in force: a
stale check costs one call and fails safe, while dropping checks on a version bump
throws away the protection they were written for. What the mismatch changes is the
**priority** of the replay pass — these are the rows most worth replaying, and they are
offered first.

## Job 2 — replay

Only rows marked `replay: safe` are ever replayed. `replay: manual` rows are **shown,
never executed** — see Step 4.

Replaying executes an arbitrary call taken from a note's `evidence` field against a live
editor. That is a mutating operation and this skill is granted accordingly; the
restraint lives in the **behaviour below**, not in the tool perimeter, and it is
compensated by the structural rollback in Steps 2 and 8.

### The eight-step safety envelope

The order is load-bearing. It is "gates with no edits between them" — every measurement
happens before anything is created, and the confirmation happens before anything is
executed.

**1 — MEASURE.** Read from the server: is the scene dirty, is the editor playing, is it
compiling. Read the **project directory path from the server itself** and check the
cleanliness of the git working tree *there*. The agent runs in a different repository
than the project; checking the repository you happen to be standing in proves nothing
about the one you are about to mutate.

**2 — REFUSE.** Dirty scene → stop. Compiling → stop. Play Mode → stop. Report the
measurement that closed the route and what the user has to do about it. This step is why
the skill never creates a scene of its own: creating one is among the most dangerous
operations available — on one server it discards unsaved work, on another it loses a
flag and destroys it.

**3 — PRESENT.** Show, in one message: what was measured, **every name that will be
created**, and which rows will be replayed. Take **one informed confirmation** for the
whole run. Not one per row — a stream of prompts trains the user to accept without
reading, which is the failure mode this step exists to prevent.

**4 — FILTER.** Drop `replay: manual` rows from execution and simply display them, with
the reason they cannot be replayed automatically. `manual` is also the **default** for
any row whose `replay` field is missing or unreadable.

**5 — MARK.** Place a console marker. Everything after it is the delta this run is
answerable for.

**6 — REPLAY.** Execute strictly inside the sandbox:

```
UNIKIT_AUDIT_<runid>                     the single root object in the scene
<asset root>/UNIKIT_AUDIT_<runid>/       only if an asset is genuinely required
UNIKIT_AUDIT_<runid>_<name>              any file outside the project, baselines included
```

One root object, one folder, one filename prefix. Nothing is created outside them. If a
row cannot be reproduced inside the sandbox, it is not `safe` — record that and treat
the row as `manual` from here on.

Each replayed row yields a verdict on its own claim: does the trap still reproduce? Read
the state back — the response is not the answer, per A1.

**7 — SWEEP.** Delete the sandbox root in one action. One root, one deletion; that is
what the naming was for.

**8 — CONFIRM.** Search by the `<runid>` prefix and **do not save the scene**.

Step 8 is the structural guarantee: the scene was never saved, so even a sweep that
fails leaves nothing on disk. That is why the scene must not be saved even when
everything looks clean — saving would convert a recoverable mess into a committed one.

### The sweep is proved, not announced

```
CLAIM:    the sandbox is gone
EVIDENCE: search for UNIKIT_AUDIT_<runid> → 0 objects, 0 assets
          console delta from the marker → no new errors
VERDICT:  CONFIRMED | NOT CONFIRMED
```

`NOT CONFIRMED` → a loud, `ERROR`-level report listing **by name** everything that
remains, and **no blind repeat of the deletion**. A second delete against an unknown
state is how a failed cleanup becomes a destructive one.

### Two hard limits on what may be touched

- This skill may delete **only what it created in this run**. No pre-existing name is
  ever a legitimate target for deletion or modification — not "it looks like leftovers",
  not "it is obviously temporary".
- Leftovers from an **aborted earlier run** are recognisable: a different `<runid>` under
  the same prefix. They are reported and offered for sweeping as a **separate action
  with its own confirmation** — never folded into this run's cleanup, and never swept
  because the prefix matched.

## Job 3 — retire

A row is a retirement candidate when:

- its replay no longer reproduces the trap — the server fixed it; or
- the replay fails because the call is gone — same outcome, no separate mechanism
  needed; or
- the packaged `INDEX.md` now carries the same check — the finding went upstream and the
  local row is a duplicate.

Offer each candidate with its evidence. **Removal is proposed, never automatic**: a
replay is one observation, and one observation is exactly the sample size the whole
"executors do not write these notes" rule exists to distrust.

Accepted → remove the row from **both** tables, leaving the id retired. Ids are never
reused: they are referenced from plans (`from: <plan>#<id>`), from upstream diffs, and
from earlier reports.

Then stamp the header: `audited: <today>`. This is the **only** field of the notes header
this skill writes, and the only place `audited:` ever moves — it is the cursor
`/unikit-mcp-trap` reads to decide which plans are new.

## Job 4 — upstream

A local row that would help every project using this server belongs in the packaged tree
instead. Print a **ready diff** for `mcp/<engine>/rules/<server>/INDEX.md` — the check
row in the packaged form (`id | area | confirm that`), with the observation kept beside
it as PR context.

Print it. Do not apply it: the packaged tree lives in the UniKit repository, is owned by
the maintainers, and is retired there by a conformance run plus a diff. After the PR
merges, the local row becomes a duplicate and the next audit retires it under Job 3.

## What this skill never does

- **Never saves the scene.** Not on success, not to "clean up". Step 8.
- **Never deletes or edits anything it did not create in this run.**
- **Never repeats a failed sweep blindly** — it reports what remains, by name.
- **Never edits the packaged rules tree**, and never edits a plan.
- **Never rewrites `server:` / `version:`** in the notes header to make a mismatch go
  away. The mismatch is information: it is what makes rows suspect.
- **Never writes `⏸️ MANUAL`** because rules are missing, and never treats an
  unreachable editor as proof that a capability is absent — that is a stop-condition
  (A7), reported as a fact.

## See also

- `/unikit-mcp-trap` — record a new finding; owner of `references/notes-format.md`.
- `.unikit/system/dev-principles.md` — the evidence contract, the failure classes, and
  the degradation ladder this skill descends when a route is unavailable.
