---
name: unikit-gd-verify
description: >-
  Mechanical consistency check for game design — answers "is the design consistent with
  itself?" — plus changed-scope impact analysis. Offline, deterministic, and binary: greps
  the facts registry against the documents (numbers, terms, IDs, duplicate IDs, dangling
  references, unregistered cross-doc facts, roster↔disk, map freshness, Depends 3-way,
  status/version coherence, AC presence, placeholder leaks), and from a git diff computes
  which dependent systems a change affects. Scope is inferred: a named system checks that
  system; an unverified diff triggers a changed-scope pass; otherwise it checks everything.
  Use when the user wants a consistency or impact check, e.g. "verify the design", "is the
  design consistent", "check the GDDs against the registry", "what did this change affect",
  "find broken references in the design". This is the mechanical pass — for a subjective "is
  this design good" quality critique use /unikit-gd-review.
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
   systems, flows, entities, formulas, terms, decisions. Current values only.
   **Schema guard (clean break — no automatic migration):** it MUST be `version: 2`.
   On a pre-v2 `version: 1` registry, **STOP** and report that the design workspace
   is on the pre-v2 layout (the standalone markdown system-index was dropped; the
   roster now renders into `GAME.md` `## System Map [gen]`) — there is no automatic
   migration; tell the user to upgrade via `/unikit-gd-spec` before verifying.
3. **`.unikit/gamedesign/GAME.md`** — incl. its generated `## System Map [gen]`
   render of the roster (the human-readable map; the truth is `GD-IDS`).
4. **`.unikit/gamedesign/systems/*.md`** — the documents checked against the
   registry.

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
| **Roster ↔ disk** | compare `GD-IDS` `systems` ids to the `systems/*.md` files on disk | a `skeleton`-or-later system has no file, or a `systems/*.md` file has no `GD-IDS` entry (→ route to `unikit-gd-spec` to register it — verify never writes the roster) |
| **Map freshness (3-surface)** | compare the `GAME.md` `## System Map [gen]` rows to `GD-IDS` `systems` — membership, `Status`, `Ver`, `Depends` | the render disagrees with `GD-IDS` — **not a conflict to resolve**: re-render the block (self-heal, announced); see *Map freshness* below |
| **Depends 3-way** | for each `A → B` edge, check it agrees across A's section F, A's `GD-IDS` `depends_on`, and A's `## System Map` Depends cell, and that B carries the reciprocal | the three sources disagree, or the reciprocal edge is missing or contradictory |
| **Status coherence** | a system's `doc_status` agrees across the **two places that must agree** — the header `> Status:` and `GD-IDS` `doc_status` (enum `not-started · skeleton · detailed · reviewed · revised`) | the two disagree for a system — system docs only; see the carve-outs below |
| **Version coherence** | the header `Version` and `GD-IDS` `version` agree; a `not-started` system carries **no** version, a `skeleton`-or-later system carries one | the two disagree, or a `skeleton`+ system is missing a version / a `not-started` system has one |
| **AC presence** | for a `detailed`-or-later system, section H is non-empty and every `AC-<sys>-N` id is unique | a `detailed`+ system has an empty H, or repeats an `AC-<sys>-N` — gaps in the numbering are **not** a conflict (numbering is stable after an AC is removed) |
| **Placeholder leak** | grep `[To be designed]` inside `detailed`-or-later documents | a `detailed`+ document still carries a skeleton placeholder |

The registry is authoritative: when a document disagrees with `GD-IDS`, the
registry wins until the user resolves it the other way (`gd-principles`).

**Map freshness — self-heal, not a conflict.** The `## System Map [gen]` block in
`GAME.md` is a deterministic **render** of `GD-IDS` `systems` (`gd-principles` →
Lifecycle & Status), so a disagreement is a *freshness* issue, never a coherence
conflict to resolve. On any of —

- a `GD-IDS` system **missing from the map** (no row);
- a **phantom row** in the map with no matching `GD-IDS` system;
- a row whose **Status / Ver / Depends** differs from `GD-IDS`,

— **re-render** the `## System Map [gen]` block from `GD-IDS` (the same deterministic
render `unikit-gd-spec` writes — group by category, sort by tier then design order,
display-precedence on `deprecated`/`implemented`) and **announce** it
(`re-rendered ## System Map [gen] (freshness)`). The one case verify does **not**
self-heal is a `systems/*.md` file with **no `GD-IDS` entry** (the Roster ↔ disk
check): the roster is `unikit-gd-spec`'s to write, so verify **routes** the user to
`/unikit-gd-spec` to register the system, then the map re-renders.

**Scope & carve-outs (Status / Version / AC / Placeholder).** These four checks
read the **system** spine only — the header ↔ `GD-IDS` pair of a `systems/*.md`
document (the `## System Map [gen]` render is *not* a coherence surface — its
agreement is handled by *Map freshness* above):

- **Lifecycle-enum scope.** `GAME.md` (`drafted | approved`) and `CONCEPT.md`
  (`exploring | drafted | approved`) keep their **own** lifecycle enums — a
  `Status: approved` there is correct and is **never** a status conflict.
- **Display precedence.** A system with `status: deprecated` legitimately shows
  `deprecated` in the `## System Map [gen]` Status over its underlying `doc_status`;
  the read-only `implemented` value (a code-set display overlay) behaves the same.
  Both are display overlays in the **render** — never part of the two-place header ↔
  `GD-IDS` `doc_status` comparison. The companion **`GD-IDS` `implemented_version`**
  field (also code-set, by `unikit-verify` on all-AC-met) is a code-owned field —
  **not** a `doc_status` and **not** a `version` — so it never participates in Status
  or Version coherence and is never flagged as drift.
- **Non-id metadata (`research:`).** The `GD-IDS` `research:` field — written by
  `unikit-gd-spec` (add-system) as a **path pointer** to the explore research that
  seeded the system — is non-semantic metadata, **not** a registry id and **not** a
  `doc_status` / `version`. It is excluded from status/version coherence, and the
  id-resolving checks pass it over **by construction**: **Dangling references** only
  resolves id tokens (`SYS-`/`ENT-`/`FORM-`/`AC-`/`PIL-`/`DD-`), and **Unregistered
  cross-doc fact** only greps `FORM-`/`ENT-` ids — a folder path matches neither — so
  no special-case logic is needed.
- **Dependent-lag.** A verify-flagged dependent may transiently carry a header
  `Status` behind its `GD-IDS` `doc_status` (`gd-principles` → Lifecycle & Status);
  that lag is expected, not a conflict.

## Phase 3 — Changed-Scope Impact (when a diff is unverified)

Compute the blast radius of a recent edit:

1. **Changed set** = the union of two sources:
   - `git diff HEAD` (and `git status`) restricted to `.unikit/gamedesign/` → the
     systems whose documents changed on disk, **and**
   - every system already carrying `doc_status: revised` in `GD-IDS` — a pending
     edit not yet cleared back to `reviewed`, so a `revised` system is re-checked
     even when its file shows no fresh git diff.
2. Walk `GD-IDS` `depends_on` edges (rendered in the `## System Map` Depends column)
   to the **transitive closure** of systems that depend (directly or indirectly) on
   a changed one.
3. Classify each affected system into an **Affected** table:

   | System | Relation | Verdict |
   |--------|----------|---------|
   | SYS-enemy-ai | depends on SYS-combat (changed) | **Needs Review** |
   | SYS-economy | soft dep, no touched interface | **Still Valid** |
   | SYS-loot | uses a removed AC | **Likely Stale** |

   Verdicts: **Still Valid** / **Needs Review** / **Likely Stale**.
4. **Record the impact** (with approval):
   - **Append the `Affected (gd-verify):` line** to the latest changelog block in the
     changed system's section **K** — the line the system's zone owner
     (`unikit-gd-system`) leaves for verify to fill (`gd-principles` → Delta
     Discipline).
   - For each affected **dependent**, bump it to `doc_status: revised` **only when
     its verdict is `Needs Review` or `Likely Stale`** (a `Still Valid` dependent is
     left untouched). Write the bump in the dependent's `GD-IDS.yaml` `doc_status`
     (the single machine-truth place); the dependent's `SYSTEM.md` header is left to
     catch up on its next authoring touch (full header coherence for flagged
     dependents is a later tier — see gd-principles → Lifecycle & Status), and the
     `## System Map [gen]` re-renders (Map freshness).
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
1. Registry is right — flag the document for correction (recommend /unikit-gd-system)
2. Document is right — update GD-IDS to <X> (with approval; record the change)
3. Defer — park it in the system's section K (Open Questions)
```

A registry change requires explicit approval and never silently overrides an
existing value; a deprecated ID is never deleted. Log each resolution in the report.

Not every conflict is a value mismatch. A **coherence** conflict (status / version
/ Depends 3-way) has no single value to pick: the resolution brings the surfaces
into agreement — `GD-IDS` is the machine truth, so the header is corrected to match
it (and the `## System Map [gen]` re-renders) unless the user resolves the registry
the other way. A **presence** conflict (empty H, duplicate id, placeholder leak,
unregistered cross-doc fact) is resolved by editing the offending document
(`/unikit-gd-system` for a system, `/unikit-gd-spec` for `GAME.md`), not the registry.

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

Why keep the file: it is the only cross-session memory and the rework checklist.
When the same conflict recurs across systems, record it as a `gamedesign` `library`
rule via `/unikit-memory --module gamedesign` — durable domain knowledge, not
re-discovered each pass.

## Final: Compact Report

```
Scope: <SYS-slug | changed | all>
Result: <PASS | CONFLICTS FOUND (<n>)>
Checks: facts · terms · IDs · dup-IDs · dangling · unregistered-fact · roster↔disk · map-freshness · Depends-3way · status · version · AC-presence · placeholder — <pass/fail each>
Affected (changed-scope): <k systems — Needs Review: …, Likely Stale: …>
Freshness: <re-rendered ## System Map [gen] | up to date>
Report: <path | none (clean PASS)>
```

```
AskUserQuestion: Verification done. What's next?

Options:
1. Fix the conflicts — /unikit-gd-system <system> "<conflict>" (recommended if CONFLICTS)
2. Review quality — /unikit-gd-review <system> (fresh session)
3. Nothing — I'll continue later
```

No summary document beyond the conditional report file.

## Ownership Boundaries

- **Owns:** the `Affected (gd-verify):` changelog line; verify report files; the
  `GD-IDS.yaml` `doc_status: revised` bump for a flagged dependent (with approval);
  and the **freshness re-render** of the `GAME.md` `## System Map [gen]` block (a
  deterministic re-render of `GD-IDS`, never an authored change).
- **Read-only:** every design document and (except the `Affected` line, approved
  conflict resolutions, a flagged dependent's `doc_status: revised` bump, and the
  `## System Map [gen]` freshness re-render) `GD-IDS.yaml`, `GAME.md`.
- **Not this skill:** quality judgment → `unikit-gd-review`; applying design fixes
  and authoring → `unikit-gd-system` (systems) / `unikit-gd-spec` (`GAME.md` + the
  roster).
- **Never:** use web research; guess where a grep settles it; change a `GD-IDS`
  value silently or without approval; delete or renumber an ID; write the roster
  (route to `unikit-gd-spec`); read the code workspace or project source.

## Quick Reference

```
/unikit-gd-verify SYS-combat        → check one system against the registry
/unikit-gd-verify                   → unverified diff → changed-scope impact; else full check
/unikit-gd-verify what did that change affect  → changed-scope impact from git diff
/unikit-gd-verify all               → full registry + roster + map-freshness + Depends pass
```
