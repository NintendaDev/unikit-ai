---
name: unikit-gd-verify
description: >-
  Mechanical consistency check for game design — "is the design consistent with
  itself?" — plus changed-scope impact analysis. Offline, deterministic, and
  binary: greps the facts registry against the documents (numbers, terms, IDs,
  duplicate IDs, dangling references, unregistered cross-doc facts, index↔disk,
  Depends 3-way, status/version coherence, AC presence, placeholder leaks) and,
  from a git diff,
  computes which dependent systems a change affects. Scope is inferred — no flags:
  a named system checks that system; an unverified diff triggers a changed-scope
  pass; otherwise it checks everything. Writes a report only on conflicts or a
  changed scope. Use when the user says "verify the design", "is this consistent",
  "what did this change affect", or "check the GDDs against the registry".
argument-hint: "[system name | SYS-slug | question]  (scope inferred; no flags)"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(date *)
  - Bash(mkdir *)
  - Bash(git diff *)
  - Bash(git status *)
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: game-design
---

# Game Design — Consistency & Impact Verification

Answer **"is the design consistent with itself?"** — a mechanical, deterministic
check of every document against the facts registry, plus the **changed-scope
impact** of a recent edit. This is the design-side mirror of `unikit-verify` and a
CI-linter to `unikit-gd-review`'s senior reviewer: cheap, binary, run after every
edit. A **verify conflict cannot be declined** (unlike a review finding) — it is
resolved.

Verification is **offline and reproducible**: no web research, no expert judgment,
no LLM guessing where a grep will do. The same inputs always yield the same result
(idempotent).

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and the report (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English. Do not announce the language setting.

## Phase 0 — Bootstrap

Silently load — do not narrate:

1. **`.unikit/system/gd-principles.md`** — the working contract: the **facts
   registry / ID conventions** (registry wins until the user resolves otherwise;
   never delete an ID — deprecate it), the **severity rubric** (a conflict is
   Critical/Major evidence), and the language rules. This skill **applies** them.
   If missing, warn (`unikit-ai update`) and continue with the conventions
   summarized here.
2. **`.unikit/gamedesign/GD-IDS.yaml`** — the single source of truth: pillars,
   systems, entities, formulas, terms, decisions. Current values only.
3. **`.unikit/gamedesign/GD-INDEX.md`** — the map: rows, Depends edges, Status/Ver.
4. **`.unikit/gamedesign/systems/*.md`** and **`GAME.md`** — the documents checked
   against the registry.

**One-way boundary:** never read `.unikit/code/`, project source, or build
artifacts. **Web research is forbidden here** (`gd-principles`) — verification must
stay deterministic. The only `git` use is reading the design-workspace diff.

## Phase 1 — Resolve Scope (no flags)

Scope is a function of context:

1. The argument names a system → check **that system** and its registry facts.
2. There is an **unverified diff** under `.unikit/gamedesign/` (`git diff` /
   `git status` shows changed design docs), or the prompt asks "what did this
   change affect" → **changed-scope** pass (Phase 3).
3. Otherwise → **full** check of every system and the whole registry.

Announce the resolved scope in one line.

## Phase 2 — Mechanical Checks (grep-first)

Run every check deterministically; each mismatch is a **CONFLICT** with a citation:

| Check | Method | Conflict when |
|-------|--------|---------------|
| **Facts** | grep each `GD-IDS` entity/formula value across the docs — match the value on word boundaries, not as a bare substring | a document states a number/name that disagrees with the registry |
| **Terminology drift** | grep each term's `forbidden_aliases` **values** (the listed aliases, not the field name) across the docs | a forbidden alias is used in place of the canonical term |
| **ID validity** | scan every `SYS-`/`ENT-`/`FORM-`/`AC-`/`PIL-`/`DD-` id for shape | an id is malformed — wrong case, bad separator, or an unknown prefix |
| **Duplicate IDs** | group every declared id by value | the same id is declared for two different things |
| **Dangling references** | resolve every referenced id against `GD-IDS` | a referenced id does not exist, or a live (non-deprecated) section points at a `deprecated` entry |
| **Unregistered cross-doc fact** | grep `FORM-`/`ENT-` ids that surface in **two or more** documents | a fact crosses a document boundary yet has no `GD-IDS` entry |
| **Index ↔ disk** | compare `GD-INDEX` rows to `systems/*.md` | a row has no file, or a file has no row |
| **Depends 3-way** | for each `A → B` edge, check it agrees across A's section F, A's `GD-INDEX` Depends, and A's `GD-IDS` `depends_on`, and that B carries the reciprocal | the three sources disagree, or the reciprocal edge is missing or contradictory |
| **Status coherence** | a system's `doc_status` agrees across its **three** places — the header `> Status:`, the `GD-INDEX` row, and `GD-IDS` `doc_status` (enum `not-started · skeleton · detailed · reviewed · revised`) | the three disagree for a system — system docs only; see the carve-outs below |
| **Version coherence** | the header `Version`, the `GD-INDEX` `Ver`, and `GD-IDS` `version` agree; a `not-started` system carries **no** version, a `skeleton`-or-later system carries one | the three disagree, or a `skeleton`+ system is missing a version / a `not-started` system has one |
| **AC presence** | for a `detailed`-or-later system, section H is non-empty and every `AC-<sys>-N` id is unique | a `detailed`+ system has an empty H, or repeats an `AC-<sys>-N` — gaps in the numbering are **not** a conflict (numbering is stable after an AC is removed) |
| **Placeholder leak** | grep `[To be designed]` inside `detailed`-or-later documents | a `detailed`+ document still carries a skeleton placeholder |

The registry is authoritative: when a document disagrees with `GD-IDS`, the
registry wins until the user resolves it the other way (`gd-principles`).

**Scope & carve-outs (Status / Version / AC / Placeholder).** These four checks
read the **system** spine only — the header ↔ `GD-INDEX` ↔ `GD-IDS` triple of a
`systems/*.md` document:

- **Lifecycle-enum scope.** `GAME.md` (`drafted | approved`) and `CONCEPT.md`
  (`exploring | drafted | approved`) keep their **own** lifecycle enums — a
  `Status: approved` there is correct and is **never** a status conflict.
- **Display precedence.** A system with `status: deprecated` legitimately shows
  `deprecated` in the `GD-INDEX` Status column over its underlying `doc_status`;
  the read-only `implemented` value (a code-set display overlay) behaves the same.
  Both are display overlays — excluded from the three-way comparison.
- **Dependent-lag.** A verify-flagged dependent may transiently carry a header
  `Status` behind its `GD-INDEX`/`GD-IDS` `doc_status` (`gd-principles` →
  Lifecycle & Status); that lag is expected, not a conflict.

## Phase 3 — Changed-Scope Impact (when a diff is unverified)

Compute the blast radius of a recent edit:

1. **Changed set** = the union of two sources:
   - `git diff HEAD` (and `git status`) restricted to `.unikit/gamedesign/` → the
     systems whose documents changed on disk, **and**
   - every system already carrying `Status: revised` in `GD-INDEX` — a pending edit
     not yet cleared back to `reviewed`, so a `revised` system is re-checked even
     when its file shows no fresh git diff.
2. Walk `GD-INDEX` Depends edges to the **transitive closure** of systems that
   depend (directly or indirectly) on a changed one.
3. Classify each affected system into an **Affected** table:

   | System | Relation | Verdict |
   |--------|----------|---------|
   | SYS-enemy-ai | depends on SYS-combat (changed) | **Needs Review** |
   | SYS-economy | soft dep, no touched interface | **Still Valid** |
   | SYS-loot | uses a removed AC | **Likely Stale** |

   Verdicts: **Still Valid** / **Needs Review** / **Likely Stale**.
4. **Record the impact** (with approval):
   - **Append the `Affected (gd-verify):` line** to the latest changelog block in the
     changed system's section **K** — the line `unikit-gd-improve` leaves for verify
     to fill (`gd-principles` → Delta Discipline).
   - For each affected **dependent**, bump it to `Status: revised` **only when its
     verdict is `Needs Review` or `Likely Stale`** (a `Still Valid` dependent is left
     untouched). Write the bump in **two places** — the `GD-INDEX` row and the
     dependent's `GD-IDS.yaml` `doc_status`; the dependent's `SYSTEM.md` header is
     left to catch up on its next authoring touch (full header coherence for flagged
     dependents is a later tier — see gd-principles → Lifecycle & Status).
   - A `revised` dependent returns to `reviewed` only through `unikit-gd-review`,
     never here.
   - **Idempotent:** re-running on the same diff yields the same Affected table and
     re-bumps nothing already at `revised`.

## Phase 4 — Resolve Conflicts

Every CONFLICT must be resolved — it cannot be "declined". For each, ask and log
the resolution:

```
AskUserQuestion: CONFLICT — <doc/section> says <X>, GD-IDS says <Y>. Resolve how?
Options:
1. Registry is right — flag the document for correction (recommend /unikit-gd-improve)
2. Document is right — update GD-IDS to <X> (with approval; record the change)
3. Defer — park it in the system's section K (Open Questions)
```

A registry change requires explicit approval and never silently overrides an
existing value; a deprecated ID is never deleted. Log each resolution in the report.

Not every conflict is a value mismatch. A **coherence** conflict (status / version
/ Depends 3-way) has no single value to pick: the resolution brings the three
surfaces into agreement — `GD-IDS` is the machine truth, so the header and
`GD-INDEX` are corrected to match it unless the user resolves the registry the
other way. A **presence** conflict (empty H, duplicate id, placeholder leak,
unregistered cross-doc fact) is resolved by editing the offending document
(`/unikit-gd-improve`), not the registry.

## Phase 5 — Report (only when needed)

**Write a report file only on `CONFLICTS FOUND` or a changed-scope pass.** A clean
full PASS is a single chat line — no file (decision 2026-06-12). When a file is
written, it is `.unikit/gamedesign/reviews/<date>_verify-<scope>.md` (`mkdir -p`):

```markdown
# Verify: <scope> — <YYYY-MM-DD>
> Result: <PASS | CONFLICTS FOUND>  ·  Scope: <SYS-slug | changed | all>

## Conflicts
| Severity | Document / Section | Check | Conflict (evidence) | Resolution |
|----------|--------------------|-------|---------------------|------------|

## Affected (changed-scope only)
| System | Relation | Verdict |
|--------|----------|---------|

## Status changes
<rows bumped to `revised`, with approval>
```

Why keep the file: it is the only cross-session memory, it is the rework checklist,
and the GD-INDEX Status must reference something. When the same conflict recurs
across systems, record it as a `gamedesign` `library` rule via
`/unikit-memory --module gamedesign` — durable domain knowledge, not re-discovered
each pass.

## Final: Compact Report

```
Scope: <SYS-slug | changed | all>
Result: <PASS | CONFLICTS FOUND (<n>)>
Checks: facts · terms · IDs · dup-IDs · dangling · unregistered-fact · index↔disk · Depends-3way · status · version · AC-presence · placeholder — <pass/fail each>
Affected (changed-scope): <k systems — Needs Review: …, Likely Stale: …>
Report: <path | none (clean PASS)>
```

```
AskUserQuestion: Verification done. What's next?

Options:
1. Fix the conflicts — /unikit-gd-improve <system> "<conflict>" (recommended if CONFLICTS)
2. Review quality — /unikit-gd-review <system> (fresh session)
3. Nothing — I'll continue later
```

No summary document beyond the conditional report file.

## Ownership Boundaries

- **Owns:** the `Affected (gd-verify):` changelog line; verify report files; the
  GD-INDEX `revised` Status bumps and the matching `GD-IDS.yaml` `doc_status: revised`
  bump for a flagged dependent (with approval).
- **Read-only:** every design document and (except the `Affected` line, approved
  conflict resolutions, and a flagged dependent's `doc_status: revised` bump)
  `GD-IDS.yaml`, `GD-INDEX.md`, `GAME.md`.
- **Not this skill:** quality judgment → `unikit-gd-review`; applying design fixes →
  `unikit-gd-improve`; authoring → `unikit-gd-detail`/`unikit-gd-spec`.
- **Never:** use web research; guess where a grep settles it; change a `GD-IDS`
  value silently or without approval; delete or renumber an ID; read the code
  workspace or project source.

## Quick Reference

```
/unikit-gd-verify SYS-combat        → check one system against the registry
/unikit-gd-verify                   → unverified diff → changed-scope impact; else full check
/unikit-gd-verify what did that change affect  → changed-scope impact from git diff
/unikit-gd-verify all               → full registry + index + Depends consistency pass
```
