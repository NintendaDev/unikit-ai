---
name: unikit-gd-detail
description: >-
  Author the detailed, per-system game design document (the A–K SYSTEM GDD) for one system
  from the map, or fill the empty placeholders of a partially-written one. This is the
  depth layer: it works out and writes the actual parameters, rules, and acceptance
  criteria of a single existing system, walking a collaborative section-cycle (Context →
  Options → Decision → Draft + Approval → Write). Use when the user wants to flesh out or
  detail one system, e.g. "detail the combat system", "write the GDD for the inventory
  system", "design this system in detail", "fill in the rest of this system doc", "spec
  out the parameters of X". To add a whole new system or restructure the system map use
  /unikit-gd-spec; to revise an already-approved system doc use /unikit-gd-improve.
argument-hint: "<system name | SYS-slug>  (mode inferred from the doc state; no flags)"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(date *)
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: game-design
---

# Game Design — Per-System GDD Authoring

Create and fill **one system's design document** at
`.unikit/gamedesign/systems/SYS-<slug>.md` — eleven sections (A–K) authored one at
a time through the section-cycle contract, then its facts and acceptance criteria
registered in `GD-IDS.yaml` and its row updated in `GD-INDEX.md`.

This skill **creates** a system GDD and **fills its placeholders**. It never
reworks already-approved content — that is `unikit-gd-improve`. It never creates
the master spec or the map — that is `unikit-gd-spec`.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and artifacts (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English. Do not announce the language setting.

## Phase 0 — Bootstrap

Silently load — do not narrate:

1. **`.unikit/system/gd-principles.md`** — the working contract. The
   **section-cycle authoring contract**, the collaborative protocol, the facts
   registry / ID conventions, delta discipline, language rules, and severity
   rubric live there. This skill **applies** that contract; it does not restate
   the mechanics. If missing, warn (`unikit-ai update`) and fall back to the
   protocol as summarized in this file.
2. **`.unikit/gamedesign/GAME.md`** — pillars, loops, non-goals the system must
   serve. If it does not exist, stop and recommend `/unikit-gd-spec` first.
3. **`.unikit/gamedesign/GD-INDEX.md`** — find the row for the target system. If
   there is **no row**, the system is not on the map: offer to add it via
   `/unikit-gd-spec` (**add-system** — graft this one system onto the map, not a
   remap), or pick an existing `not-started` system. Do not author an off-map system.
4. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — load the **core** domain
   rules for this system's **behavioural domain**, on demand by `Load When`, plus
   any studio `library` rule on the same topic. Read the domain from the system's
   name and Overview (the behaviour it drives), **not** from the coarse GD-INDEX
   `Category`; when the behaviour is ambiguous or the category is coarse (Gameplay
   / Meta), confirm the domain and pack(s) with one `AskUserQuestion` rather than
   guessing. Domains are opt-in and combinable — a system may match more than one:

   | Domain | Core rules to load | Section-pack |
   |--------|--------------------|--------------|
   | combat / mechanics | `balance`, `frameworks` | combat |
   | ai-behavior | `balance`, `frameworks` | ai-behavior |
   | economy / loot | `economy`, `balance` | economy |
   | progression / unlock | `progression`, `balance` | progression |
   | level / content | `level-design` | levels |
   | narrative / dialogue | `narrative` | narrative |
   | ui / onboarding | `ux-onboarding` | ux |
   | liveops / events | `liveops`, `economy` | liveops |
   | persistence | `progression` | persistence |
   | monetization | `monetization-ethics`, `economy` | monetization |
   | meta / other | `frameworks`, `core-loops` | — |

   Every system also touches **accessibility** (section J) — load `accessibility`
   when authoring J.
5. **`.unikit/RULES.md`** (if present) — project overrides, highest priority.
6. **`{{skills_dir}}/{{self_name}}/references/section-packs.md`** — the catalog of
   domain section-packs appended after section K. Load the pack named in the table
   above (when one applies).

**One-way boundary:** never read `.unikit/code/`, project source, or build
artifacts. The only external read is `SOURCE.md` during an import (Phase 1).

## Phase 1 — Context

Gather the facts the system must stay consistent with (read-only):

- **Known facts** from `GD-IDS.yaml` — pillars (`implements` targets), entities,
  formulas, and terms already locked by other systems. These are constraints, not
  suggestions.
- **Neighbor GDDs** — for each system this one Depends on (from the GD-INDEX row),
  read its header and sections **D (Formulas)** and **F (Dependencies)** to match
  data interfaces.
- **Recent `unikit-gd-verify` reports** for this system, if any
  (`.unikit/gamedesign/reviews/`).
- **Import source** — if `GD-IDS`/GAME mention an import, or a
  `researches/<date>_import-*/SOURCE.md` covers this system, read it: section
  content is **extracted** from it, not regenerated. Mark provenance per
  `gd-principles` → Provenance: place `<!-- provenance: extracted from SOURCE.md -->`
  under each section lifted from the source and `<!-- provenance: generated -->`
  under each section inferred to complete the skeleton; untagged sections are
  normal authored content.
- **Explore research (internal design lens)** — if this system was grafted from an
  `unikit-gd-explore` brief, discover the research **deterministically** (survives a
  `/clear`): read the system's `GD-IDS` `research:` pointer (authoritative), falling
  back to the `researches/INDEX.md` entry whose `Target:` is this `SYS-<slug>`. Read
  that research's `RESEARCH_BRIEF.md` → **`## New Feature Plan`** block and use its
  A–K **section seeds** as the *starting drafts* for the section-cycle (Phase 4) —
  the per-section approval still applies; a seed is a draft, not an approved write.
  These explore-seeded drafts are **untagged normal authored content** — do **not**
  mark them `extracted` / `generated` (those markers are for **imports** only; this
  is the generalization of import-reading stated canonically in `gd-principles` →
  Provenance, which this skill applies rather than restates).

## Phase 2 — Resolve Mode from Document State (no flags)

Check `.unikit/gamedesign/systems/SYS-<slug>.md`:

1. **Does not exist** → **Create**: build the skeleton (Phase 3), then author from
   section A.
2. **Exists with `[To be designed]` placeholders** → **Fill**: resume from the
   **first** placeholder. Approved text is **never overwritten** — only
   placeholders are filled. Skip Phase 3 skeleton creation.
3. **Exists, complete, no placeholders** → **Redirect**: detailing is done.
   Reworking approved content is `unikit-gd-improve`'s job:

   ```
   This system's GDD is complete (no placeholders). To change approved content,
   use /unikit-gd-improve <system> "<what to change>" — it bumps the version and
   records the change. Detailing stops here.
   ```
   → STOP.

If the system name is ambiguous (matches several rows, or none) →
`AskUserQuestion` listing candidates. Never guess the target.

## Phase 3 — Skeleton (Create mode only)

Write the file from the SYSTEM template with **every** section header A–K present
and a `[To be designed]` placeholder under each. Fill the header from the
GD-INDEX row. Get **one approval** for the skeleton; a refusal sets Status
`skeleton` and stops (BLOCKED).

SYSTEM GDD structure (header + sections — author in this order):

```
# <System Name> — SYS-<slug>
> Status: skeleton · Version: 1 · Last Updated: <date>
> Implements: PIL-n[, PIL-m] · Layer: <Foundation|Core|Feature|Presentation> · Scope: <S|M|L|XL>
```

| § | Section | What it holds |
|---|---------|---------------|
| A | Overview | One paragraph for a newcomer; what the player does; why it exists. Non-goals (3–5 "the system does NOT…"). |
| B | Player Fantasy | "The player feels X when Y", tied to the pillar it serves. |
| C | Detailed Design | Core Rules (numbered, unambiguous); States & Transitions; Interactions with other systems. |
| D | Formulas | Each `FORM-<slug>`: expression, variable table (name/type/range/source), output range, numeric example. |
| E | Edge Cases | "If <condition>: <outcome>"; zero / maximum / simultaneity; degenerate strategies (Sirlin check) vs tuning knobs. |
| F | Dependencies | Direction, hard/soft, data interface; must agree with GD-INDEX Depends and the neighbor's F. |
| G | Tuning Knobs | knob / category (feel\|curve\|gate) / range / default / what breaks at the extremes → direct input for configs. |
| H | Acceptance Criteria | `AC-<slug>-N`: Given-When-Then; performance budgets. Quoted verbatim by the planning side. |
| I | Telemetry | event (English `snake_case`) / payload / the design question it answers. |
| J | Accessibility | GAG checklist items (basic minimum) / accommodations / justified deviations. |
| K | Open Questions & Changelog | open questions (owner/when); changelog blocks (added by `unikit-gd-improve`/`unikit-gd-verify`). |

When the system's domain has a **section-pack** (Phase 0 table), append the
pack's sub-sections **after K** — see `references/section-packs.md`.

## Phase 4 — Section-Cycle (A → K)

Author each section in order through the **section-cycle contract from
`gd-principles`**: Context (2–3 lines) → Questions → Options (2–4 with pros/cons
and theory from the loaded domain rules, one **(Recommended)** with the WHY) →
Decision (Explain → Capture, `AskUserQuestion`) → **Draft + Approval in the SAME
reply** (separating them is a protocol violation) → Write (Edit anchored on the
unique section heading). Persist each approved section immediately — the file is
the only memory that survives the session.

Section-specific logic (the rest is the generic cycle):

- **C / Core Rules** — numbered, implementable without guessing. Record new game
  terms in `GD-IDS.yaml` `terms` (canonical English + translation +
  forbidden aliases).
- **D / Formulas** — each gets a `FORM-<slug>`, the expression, a variable table,
  the expected output range, and a worked numeric example. Name the degenerate
  **values** — inputs at zero / max / negative that break the curve — and state how
  the formula clamps them. (Degenerate **strategies** — exploitable or dominant play
  lines — belong to E, not here.)
- **Registry check after C and D** — compare every number and name against the
  known facts from Phase 1. On a mismatch, surface it **immediately** and let the
  user resolve it: obey the registry / change the registry through a
  `unikit-gd-verify` resolution / park it in section K. Never silently override a
  registry value.
- **E / Edge Cases** — ask "what at zero / at maximum / on simultaneity?"; test
  every degenerate strategy against the tuning knobs in G.
- **H / Acceptance Criteria** — derive **semi-automatically** from C, D, and E:
  one Given-When-Then per core rule and per edge case, numbered `AC-<slug>-N`.
  Numbering is **stable** — never reshuffled. These are the verbatim contract the
  code side quotes.
- **Section-packs** — when a pack applies, author its sub-sections after K with
  the same cycle, loading the pack's extra rule as noted in
  `references/section-packs.md`.

In **Fill mode**, run the cycle only for the placeholder sections, in order from
the first remaining `[To be designed]`; leave approved sections untouched.

## Phase 5 — Registry & Index

After the sections are authored:

1. **Scan the GDD** for registry candidates — entities, formulas, and constants
   referenced in **two or more places** (within this doc or cross-system). Internal
   single-use values stay in the GDD.
2. Present a **NEW / KNOWN** summary and get approval to write `GD-IDS.yaml`
   (`entities`, `formulas`, plus the `systems` entry's `doc_status`/`version`).
   Existing values are never changed silently; every fact carries its `source`.
3. **Update state:** set the system's Status → `detailed` in **all three places** —
   the `SYSTEM.md` header (edit the `> Status:` token inside the combined header
   line, not a separate bold line), the `GD-INDEX.md` row, and the `GD-IDS.yaml`
   `doc_status` — so the spine stays coherent (see gd-principles → Lifecycle &
   Status). Bump **Ver** in `GD-INDEX.md` and `GD-IDS.yaml` as before (extending
   version coherence to the header is out of scope here). Append the initial
   changelog block to section
   K (`#### v1 — <date> — initial design` with the `AC: + AC-<slug>-1 … N (new)`
   line). Record a `DD-<n>` in `GD-IDS.yaml` `decisions` for any significant
   decision.

## Phase 6 — Handoff

Recommend the next steps (do not auto-invoke):

```
AskUserQuestion: SYS-<slug> is detailed. What's next?

Options:
1. Review it — /unikit-gd-review systems/SYS-<slug>.md (recommended, fresh session)
2. Verify consistency — /unikit-gd-verify SYS-<slug>
3. Detail the next system — /unikit-gd-detail <SYS-slug>
4. Nothing — I'll continue later
```

A review is most independent in a **fresh session** (the reviewer should not have
authored the doc). Then `unikit-gd-verify` checks the doc against the registry.

## Final: Compact Report

```
System: SYS-<slug> — <name>
Mode: <create | fill>
Doc: .unikit/gamedesign/systems/SYS-<slug>.md (Status: <skeleton|detailed>, vN)
Sections authored: A–K [+ <pack>]
Registry: +<E> entities, +<F> formulas, +<T> terms  (GD-IDS.yaml)
Acceptance criteria: AC-<slug>-1 … AC-<slug>-N
```

No summary document, no report file.

## Ownership Boundaries

- **Owns:** creating `systems/SYS-<slug>.md` and filling its placeholders; the
  initial `GD-IDS.yaml` facts and `GD-INDEX.md` Status/Ver for that system.
- **Not this skill:** reworking approved content → `unikit-gd-improve`; `GAME.md`
  / the map → `unikit-gd-spec`; quality verdicts → `unikit-gd-review`; consistency
  checks → `unikit-gd-verify`.
- **Never:** write or fill without approval; overwrite approved text; change a
  `GD-IDS.yaml` value silently; delete or renumber an ID; read the code workspace
  or project source.

## Quick Reference

```
/unikit-gd-detail SYS-combat        → create skeleton + author A–K (if no doc yet)
/unikit-gd-detail combat            → resolve to the SYS-slug; same flow
/unikit-gd-detail SYS-combat        → resume filling placeholders (partial doc)
                                       → redirect to /unikit-gd-improve (complete doc)
```
