---
name: unikit-gd-verify
description: >-
  Mechanical consistency check for game design — "is the design consistent with
  itself?" — plus changed-scope impact analysis. Offline, deterministic, and
  binary: greps the facts registry against the documents (numbers, terms, IDs,
  dangling references, index↔disk, Depends symmetry) and, from a git diff,
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
| **Facts** | grep each `GD-IDS` entity/formula value across the docs | a document states a number/name that disagrees with the registry |
| **Terminology drift** | grep each term's `aliases-forbidden` | a forbidden alias is used instead of the canonical term |
| **ID validity** | scan `SYS-/ENT-/FORM-/AC-/PIL-/DD-` IDs | an ID is malformed, or the same ID is reused for two things |
| **Dangling references** | resolve every referenced ID against `GD-IDS` | a referenced ID does not exist (or points at a `deprecated` one) |
| **Index ↔ disk** | compare `GD-INDEX` rows to `systems/*.md` | a row has no file, or a file has no row |
| **Depends symmetry** | for each `A depends on B`, check B's row | the reciprocal edge is missing or contradicts |

The registry is authoritative: when a document disagrees with `GD-IDS`, the
registry wins until the user resolves it the other way (`gd-principles`).

## Phase 3 — Changed-Scope Impact (when a diff is unverified)

Compute the blast radius of a recent edit:

1. `git diff HEAD` (and `git status`) restricted to `.unikit/gamedesign/` → the
   **changed systems**.
2. Walk `GD-INDEX` Depends edges to the **transitive closure** of systems that
   depend (directly or indirectly) on a changed one.
3. Classify each affected system into an **Affected** table:

   | System | Relation | Verdict |
   |--------|----------|---------|
   | SYS-enemy-ai | depends on SYS-combat (changed) | **Needs Review** |
   | SYS-economy | soft dep, no touched interface | **Still Valid** |
   | SYS-loot | uses a removed AC | **Likely Stale** |

   Verdicts: **Still Valid** / **Needs Review** / **Likely Stale**.
4. **Append the `Affected (gd-verify):` line** to the latest changelog block in the
   changed system's section **K** — this is the line `unikit-gd-improve` leaves for
   verify to fill (`gd-principles` Delta Discipline, §11.1). With approval, bump
   affected rows to `Status: revised` in `GD-INDEX`.

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
and the GD-INDEX Status must reference something. Recurring conflicts are an
`/unikit-evolve` signal (→ `skill-context`).

## Final: Compact Report

```
Scope: <SYS-slug | changed | all>
Result: <PASS | CONFLICTS FOUND (<n>)>
Checks: facts · terms · IDs · dangling · index↔disk · Depends — <pass/fail each>
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
  GD-INDEX `revised` Status bumps (with approval).
- **Read-only:** every design document and (except the `Affected` line / approved
  conflict resolutions) `GD-IDS.yaml`, `GD-INDEX.md`, `GAME.md`.
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
