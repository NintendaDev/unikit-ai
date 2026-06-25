---
name: unikit-gd-verify
description: >-
  Mechanical consistency check for game design — answers "is the design consistent with
  itself?" — plus changed-scope impact analysis across all three GDD axes: systems, flows,
  and content types. Offline and deterministic: greps the facts registry against the
  documents (numbers, terms, IDs, duplicate & dangling references, roster↔disk, map freshness,
  Depends 3-way, status/version, AC presence, placeholder leaks, flow mode↔structure & funnel,
  content CT/CU ids, ref<>, scale↔structure, belongs_to), and from a git diff computes which
  dependent systems, flows, and content a change affects. Scope is inferred: a named document
  checks that document; an unverified diff triggers a changed-scope pass; otherwise
  everything. Use when the user wants a consistency or impact check, e.g. "verify the
  design", "check the GDDs against the registry", "what did this change affect", "find
  broken references in the design". This is the mechanical pass — for a subjective "is this
  design good" quality critique use /unikit-gd-review.
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

1. **`.unikit/system/gamedesign/gd-principles.md`** (the core) — the **facts
   registry / ID conventions** (registry wins until the user resolves otherwise;
   never delete an ID — deprecate it) and the language rules. Plus, from the same
   `gamedesign/` folder, the shards this skill needs: **`gd-lifecycle.md`** (the
   status/version coherence spine), **`gd-flow-axis.md`** (the flow coherence
   contract — `mode:` ↔ structure, `GOAL → SYS`/`AC`, Win/Lose ↔ terminal GOAL),
   **`gd-content-axis.md`** (the content coherence contract — CU ⊆ CT, `ref<>`
   resolution, `scale` ↔ structure, `belongs_to` 3-way, content-map freshness,
   RES/TRACK/KNOB, cross-axis SYS→CT staleness), and **`gd-critique.md`** (the
   **severity rubric** — a conflict is Critical/Major evidence). This skill
   **applies** them. If missing, warn (`unikit-ai update`) and continue with the
   conventions summarized here.
2. **`.unikit/gamedesign/GD-IDS.yaml`** — the single source of truth: pillars,
   systems, flows, entities, formulas, terms, decisions. Current values only.
   **Schema guard (clean break — no automatic migration):** it MUST be `version: 2`.
   On a pre-v2 `version: 1` registry, **STOP** and report that the design workspace
   is on the pre-v2 layout (the standalone markdown system-index was dropped; the
   roster now renders into `GAME.md` `## System Map [gen]`) — there is no automatic
   migration; tell the user to upgrade via `/unikit-gd-spec` before verifying.
3. **`.unikit/gamedesign/GAME.md`** — incl. its generated `## System Map [gen]`,
   `## Flow Map [gen]`, and `## Funnel [gen]` renders (the human-readable maps; the
   truth is `GD-IDS`), and its `## Win / Lose Conditions` (for the Win/Lose ↔ terminal
   GOAL check).
4. **`.unikit/gamedesign/systems/*.md`** and **`.unikit/gamedesign/flows/*.md`** — the
   system and flow documents checked against the registry.

**One-way boundary:** never read `.unikit/code/`, project source, or build
artifacts. **Web research is forbidden here** (`gd-principles`) — verification must
stay deterministic. The only `git` use is reading the design-workspace diff.

## Phase 1 — Resolve Scope (no flags)

Scope is a function of context:

1. The argument names a system, flow **or content type** → check **that document** and
   its registry facts (a `FLOW-<slug>` runs the flow checks, a `CT-<slug>` the content
   checks below).
2. There is an **unverified diff** under `.unikit/gamedesign/` (`git diff` /
   `git status` shows changed design docs), or the prompt asks "what did this
   change affect" → **changed-scope** pass (Phase 3).
3. Otherwise → **full** check of every system, **every flow**, **every content type**,
   and the whole registry.

Announce the resolved scope in one line.

## Phase 2 — Mechanical Checks (grep-first)

Run every check deterministically; each mismatch is a **CONFLICT** with a citation:

| Check | Method | Conflict when |
|-------|--------|---------------|
| **Facts** | grep each `GD-IDS` entity/formula value across the docs — match the value on word boundaries, not as a bare substring | a document states a number/name that disagrees with the registry |
| **Terminology drift** | grep each term's `forbidden_aliases` **values** (the listed aliases, not the field name) across the docs | a forbidden alias is used in place of the canonical term |
| **ID validity** | scan every `SYS-`/`ENT-`/`FORM-`/`AC-`/`PIL-`/`DD-`/`FLOW-`/`GOAL-` id for shape (analytics `events` are `snake_case` tokens, not prefixed ids) | an id is malformed — wrong case, bad separator, or an unknown prefix |
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
`GAME.md` is a deterministic **render** of `GD-IDS` `systems` (`gd-lifecycle` →
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
- **Non-id metadata (`research:`).** The `GD-IDS` `research:` field — a **path pointer**
  to the explore research that seeded an artifact (written by `unikit-gd-spec`
  add-system on a **system** row, by `unikit-gd-flow` on a **flow** `flows[]` row, and by
  `unikit-gd-content` on a **content type** `content_types[]` row) — is non-semantic
  metadata, **not** a registry id and **not** a `doc_status` / `version`. It is excluded
  from status/version coherence on all three axes, and the id-resolving checks pass it
  over **by construction**: **Dangling references** only resolves id tokens
  (`SYS-`/`ENT-`/`FORM-`/`AC-`/`PIL-`/`DD-`/`FLOW-`/`GOAL-`/`CT-`/`CU-`), and **Unregistered
  cross-doc fact** only greps `FORM-`/`ENT-` ids — a folder path matches neither — so no
  special-case logic is needed.
- **Dependent-lag.** A verify-flagged dependent may transiently carry a header
  `Status` behind its `GD-IDS` `doc_status` (`gd-lifecycle` → Lifecycle & Status);
  that lag is expected, not a conflict. This applies on the **flow** axis too: a
  cross-axis-flagged dependent **flow** (Phase 3) may carry a `FLOW.md` header `Status`
  behind its `GD-IDS` `flows[].doc_status`.

### Flow checks (axis-aware — when `GD-IDS` `flows` is non-empty)

When the registry carries flows, run the dynamics-axis checks below — the mirror of the
system checks, plus the flow-specific ones (mode ↔ structure, Win/Lose ↔ terminal GOAL,
funnel continuity). An empty `flows: []` (or no `flows` key) → **skip this block
silently** (not a conflict). The registry-wins rule applies exactly as above.

| Check | Method | Conflict when |
|-------|--------|---------------|
| **GOAL id validity + duplicates** | scan every `FLOW-`/`GOAL-` id for shape; group `GOAL-<flow>-<n>` by value within its flow | a `FLOW-`/`GOAL-` id is malformed, or a `GOAL-<flow>-<n>` is declared twice in one flow — gaps after a removal are **not** a conflict (numbering is stable, like `AC-<sys>-n`) |
| **Dangling `GOAL → SYS` / `GOAL → AC`** | resolve every `GOAL`'s `targets` (and the `FLOW.md` §D edges) against `GD-IDS` | a `GOAL` points at a **missing or deprecated system** (Critical) or a **non-existent `AC-<sys>-n`** (Critical); a dangling `ENT-`/`FORM-`/term token is Major. A needed-but-missing system routes to `/unikit-gd-spec` add-system — verify never writes the roster |
| **Flow status/version 2-place** | a flow's `doc_status` / `version` agree across the **two places** — the `FLOW.md` header `> Status:` / `> Version:` and `GD-IDS` `flows[].doc_status` / `version` (same enum + version rules as systems) | the two disagree (the `research:` pointer is excluded — see the carve-out; flow dependent-lag is expected — see Phase 3) |
| **Flow Depends 3-way** | for each flow→`SYS` edge, check it agrees across the `FLOW.md` §D table, the `GD-IDS` `flows[].depends_on`, and the `## Flow Map` Depends (SYS) cell | the three sources disagree. (A flow→system edge is **one-way** — a flow *exercises* a system; there is **no** reciprocal edge on the system, unlike system↔system Depends) |
| **mode ↔ structure** | the `GD-IDS` `flows[].mode` matches the `FLOW.md` §B form — `linear`/`conditional` → an objective-flow table; `emergent` → an affordance/goal-template + a pacing envelope (§C) | the declared `mode` and the document's structure disagree (the same check shape as a system's `packs:` ↔ `## Pack:` headings) |
| **Win/Lose ↔ terminal GOAL** | grep each `GAME.md` `## Win / Lose Conditions` line for a cited `GOAL-<flow>-<n>`, and each terminal `GOAL` for a citing win/lose line | a win/lose condition cites **no** realizing terminal `GOAL` (orphan condition — Critical), or a terminal `GOAL` realizes **no** win/lose line (orphan terminal goal — Major). The deterministic signal is the citation in the GAME.md Win/Lose line; a missing citation routes to `/unikit-gd-spec` (GAME.md content). With no Win/Lose section **and** no terminal GOAL, the check is N/A |
| **Funnel continuity** | every retention/conversion-critical `GOAL` has an `events` entry; every `GD-IDS` `events` `flow:` back-pointer resolves to a real flow | a critical `GOAL` emits **no** event (a blind funnel step — Major), or an `events` entry names a `flow:` that does not exist (dangling — Major) |
| **Flow / Funnel map freshness (3-surface)** | compare the `## Flow Map [gen]` rows to `GD-IDS` `flows` (membership, Status, Ver, Depends, **Realized**) and the `## Funnel [gen]` rows to `GD-IDS` `events` | the render disagrees — **not a conflict to resolve**: re-render the block (self-heal, announced); see the `Realized` note below |

**Flow map freshness — self-heal, and `Realized` is cross-axis derived.** Like the
System Map, a stale `## Flow Map [gen]` / `## Funnel [gen]` is a *freshness* issue, not
a coherence conflict: re-render the block from `GD-IDS` (`flows` for the Flow Map,
`events` for the Funnel) and announce it (`re-rendered ## Flow Map [gen] (freshness)`).
**The `Realized` column is NOT a plain `flows:` render** — it is a **cross-axis derived**
value (`yes` once **every** system in the flow's `depends_on` has a non-empty
`implemented_version`). The re-render MUST recompute `Realized` from those systems'
`implemented_version` (the same derived logic `unikit-gd-flow` uses on regen-on-write) —
rendering only the `flows:` rows without recomputing `Realized` would let it drift.
`Realized` is **never written back** onto a flow (there is no `implemented` field on
flows; flow delivery is confirmed by playtest). A `flows/*.md` file with **no `GD-IDS`
`flows[]` entry** is **not** self-healed — verify **routes** the user to
`/unikit-gd-flow` to register it (the flow zone writes its own row), then the map
re-renders.

### Content checks (axis-aware — when `GD-IDS` `content_types` is non-empty)

When the registry carries content types, run the catalog-axis checks below — the
mirror of the system checks, plus the content-specific ones (CU ⊆ CT, `ref<>`
resolution, `scale` ↔ structure, `belongs_to` 3-way, content-map freshness,
RES/TRACK/KNOB coherence). An empty `content_types: []` (or no `content_types` key)
→ **skip this block silently** (not a conflict). The registry-wins rule applies
exactly as above.

| Check | Method | Conflict when |
|-------|--------|---------------|
| **CT/CU id validity + duplicates** | scan every `CT-`/`CU-`/`RES-`/`TRACK-`/`KNOB-` id for shape; group `CU-<ct>-<n>` by value within its content type | a `CT-`/`CU-`/`RES-`/`TRACK-`/`KNOB-` id is malformed, or a `CU-<ct>-<n>` is declared twice in one type — gaps after a removal are **not** a conflict (numbering is stable, like `AC-<sys>-n`) |
| **CU.fields ⊆ CT.fields** | for each `content[]` unit, resolve its `type` to a `CT` and check it against that CT's `scale` | a `kind: instance` (curated) unit carries a field **absent** from its `CT.fields`, or a value whose type mismatches the field's declared type; a `kind: set` (bulk) unit is **missing** `count`/`spec`, or carries inline `fields` (bulk values never enter the registry) |
| **`ref<>` resolution** | resolve every `ref<ENT/CU/FORM/SYS/RES>` value (in a `CT.fields` field or a curated unit) against `GD-IDS` | a `ref<>` points at a **missing or deprecated** target — **Critical** for a `ref<SYS>` / `ref<CT>` target, **Major** for `ref<ENT>` / `ref<FORM>` / `ref<RES>` / `ref<CU>`. A needed-but-missing system routes to `/unikit-gd-spec` add-system |
| **scale ↔ structure** | the `GD-IDS` `content_types[].scale` matches the `CONTENT-TYPE.md` §C form — `bulk` → a `count` + `spec` descriptor; `curated` → `fields` rows | the declared `scale` and the document's structure disagree (the same check shape as a flow's `mode:` ↔ structure or a system's `packs:` ↔ `## Pack:` headings) |
| **belongs_to 3-way** | for each `CT → SYS` edge, check it agrees across the `GD-IDS` `content_types[].belongs_to`, the `CONTENT-TYPE.md` §D, and a live (non-deprecated) `SYS` row in the roster | the three disagree, or `belongs_to` names a **missing or deprecated** system — the latter routes to `/unikit-gd-spec` add-system (the content zone never writes the roster). The edge is **one-way** — a system never lists its content types |
| **Content status/version 2-place** | a `CT`'s `doc_status` / `version` agree across the **two places** — the `CONTENT-TYPE.md` header `> Status:` / `> Version:` and `GD-IDS` `content_types[].doc_status` / `version` (same enum + version rules as systems) | the two disagree (the `research:` pointer is excluded — see the carve-out; content dependent-lag is expected — see Phase 3) |
| **Content map freshness (3-surface)** | compare the `## Content Map [gen]` rows to `GD-IDS` `content_types` (membership, Status, Ver, Scale, Belongs) | the render disagrees — **not a conflict to resolve**: re-render the block (self-heal, announced); see the note below |
| **RES/TRACK/KNOB coherence** | resolve every `ref<RES>` against `resources[]`; grep `RES-`/`TRACK-`/`KNOB-` ids that surface in a document but carry no `GD-IDS` entry | a `ref<RES>` is dangling (Major), or a `RES-`/`TRACK-`/`KNOB-` fact crosses a document boundary with no registry entry (unregistered fact). Empty `resources`/`tracks`/`knobs` → skip silently |

**Content map freshness — self-heal, not a conflict.** Like the System and Flow Maps,
a stale `## Content Map [gen]` is a *freshness* issue, not a coherence conflict:
re-render the block from `GD-IDS` `content_types` (the same deterministic render
`unikit-gd-content` writes — display-precedence on `deprecated`) and announce it
(`re-rendered ## Content Map [gen] (freshness)`). A `content-types/*.md` file with
**no `GD-IDS` `content_types[]` entry** is **not** self-healed — verify **routes** the
user to `/unikit-gd-content` to register it (the content zone writes its own row),
then the map re-renders.

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

   | System / Flow | Relation | Verdict |
   |---------------|----------|---------|
   | SYS-enemy-ai | depends on SYS-combat (changed) | **Needs Review** |
   | SYS-economy | soft dep, no touched interface | **Still Valid** |
   | SYS-loot | uses a removed AC | **Likely Stale** |
   | FLOW-first-session | exercises SYS-combat (changed) via GOAL→AC | **Needs Review** |

   Verdicts: **Still Valid** / **Needs Review** / **Likely Stale**.
4. **Record the impact** (with approval):
   - **Append the `Affected (gd-verify):` line** to the latest changelog block in the
     changed system's section **K** — the line the system's zone owner
     (`unikit-gd-system`) leaves for verify to fill (`gd-authoring` → Delta
     Discipline).
   - For each affected **dependent**, bump it to `doc_status: revised` **only when
     its verdict is `Needs Review` or `Likely Stale`** (a `Still Valid` dependent is
     left untouched). Write the bump in the dependent's `GD-IDS.yaml` `doc_status`
     (the single machine-truth place); the dependent's `SYSTEM.md` header is left to
     catch up on its next authoring touch (full header coherence for flagged
     dependents is a later tier — see gd-lifecycle → Lifecycle & Status), and the
     `## System Map [gen]` re-renders (Map freshness).
   - A `revised` dependent returns to `reviewed` only through `unikit-gd-review`,
     never here.
   - **Idempotent:** re-running on the same diff yields the same Affected table and
     re-bumps nothing already at `revised`.

**Cross-axis impact (system → flow, one-way).** A system edit can stale a **flow** that
exercises it (through `GOAL → SYS` / `GOAL → AC`) — `gd-flow-axis` → Flow Axis. Extend
the pass across the axis (skip when `flows: []`):

- **Changed set** also includes every flow already at `doc_status: revised` (a pending
  cross-axis flag not yet cleared back to `reviewed`).
- **Reverse-edge walk:** for each changed **system**, find every flow whose
  `flows[].depends_on` includes it, or whose `goals[].targets` reference it
  (`GOAL → SYS` / `GOAL → AC`). Those flows join the **Affected** table as **flow rows**
  (Relation: `exercises SYS-x (changed)`), with the same Still Valid / Needs Review /
  Likely Stale verdicts (a flow using a **removed** `AC` is Likely Stale). The reverse
  does **not** hold — editing a flow never stales a system.
- **Record impact (dependent flow):** list affected flows in the changed system's
  `Affected (gd-verify):` line (section K). For each `Needs Review` / `Likely Stale`
  dependent flow, bump it to `doc_status: revised` in the **`GD-IDS` `flows[].doc_status`
  only** (the dependent-lag rule, on the flow axis) — verify does **not** write the
  `FLOW.md` header `> Status:` (it catches up on the next `unikit-gd-flow` touch), and
  the `## Flow Map [gen]` re-renders (freshness). Append a one-line human-readable note
  to the flow's **section F** (Open Questions & Changelog) — the flow analogue of the
  `Affected (gd-verify):` line a system carries in section K — so the next author sees
  why the flow is `revised`. A `revised` flow returns to `reviewed` only through
  `unikit-gd-review`.

**Cross-axis impact (system → content type, one-way).** A system edit can stale a
**content type** that feeds it (through `belongs_to` / a `ref<SYS>` field) —
`gd-content-axis` → Content Axis. Extend the pass across the axis (skip when
`content_types: []`):

- **Changed set** also includes every content type already at `doc_status: revised`
  (a pending cross-axis flag not yet cleared back to `reviewed`).
- **Reverse-edge walk:** for each changed **system**, find every content type whose
  `content_types[].belongs_to` names it, or whose `CT.fields` carry a `ref<SYS>` to it.
  Those types join the **Affected** table as **content rows** (Relation: `feeds SYS-x
  (changed)`), with the same Still Valid / Needs Review / Likely Stale verdicts (a type
  whose consuming system removed a relied-on contract is Likely Stale). The reverse does
  **not** hold — editing a content type never stales a system.
- **Record impact (dependent CT):** list affected types in the changed system's
  `Affected (gd-verify):` line (section K). For each `Needs Review` / `Likely Stale`
  dependent type, bump it to `doc_status: revised` in the **`GD-IDS`
  `content_types[].doc_status` only** (the dependent-lag rule, on the content axis) —
  verify does **not** write the `CONTENT-TYPE.md` header `> Status:` (it catches up on
  the next `unikit-gd-content` touch), and the `## Content Map [gen]` re-renders
  (freshness). Append a one-line human-readable note to the type's **section F** (Open
  Questions & Changelog) — the content analogue of the `Affected (gd-verify):` line — so
  the next author sees why the type is `revised`. A `revised` content type returns to
  `reviewed` only through `unikit-gd-review`.

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
| System / Flow | Relation | Verdict |
|---------------|----------|---------|

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
Flow checks (when flows exist): GOAL-ids · dangling-GOAL · flow-status/version · flow-Depends-3way · mode↔structure · win/lose↔terminal-GOAL · funnel-continuity · flow/funnel-freshness — <pass/fail each>
Content checks (when content_types exist): CT/CU-ids · CU⊆CT · ref<>-resolve · scale↔structure · belongs_to-3way · content-status/version · content-map-freshness · RES/TRACK/KNOB · cross-axis SYS→CT — <pass/fail each>
Affected (changed-scope): <k systems + flows + content types — Needs Review: …, Likely Stale: …>
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

- **Owns:** the `Affected (gd-verify):` changelog line (system section K) and the flow /
  content cross-axis note (flow / content type section F); verify report files; the
  `GD-IDS.yaml` `doc_status: revised` bump for a flagged dependent system, **flow, or
  content type** (with approval); and the **freshness re-render** of the `GAME.md`
  `## System Map [gen]`, `## Flow Map [gen]`, `## Funnel [gen]`, and `## Content Map
  [gen]` blocks (deterministic re-renders of `GD-IDS`, never an authored change — the
  Flow Map `Realized` column recomputed from the depended-on systems'
  `implemented_version`).
- **Read-only:** every design document and (except the `Affected` line / flow & content
  section-F notes, approved conflict resolutions, a flagged dependent's
  `doc_status: revised` bump, and the `[gen]`-map freshness re-renders) `GD-IDS.yaml`,
  `GAME.md`.
- **Not this skill:** quality judgment → `unikit-gd-review`; applying design fixes and
  authoring → `unikit-gd-system` (systems) / `unikit-gd-flow` (flows) / `unikit-gd-content`
  (content types) / `unikit-gd-spec` (`GAME.md` + the roster).
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
