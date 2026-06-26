---
name: unikit-gd-system
description: >-
  Author and own ONE system's design document (the A–K SYSTEM GDD) at
  .unikit/gamedesign/systems/SYS-<slug>.md — the depth layer of the GDD, single-system
  scope. Create the skeleton and walk the collaborative section-cycle to write its
  parameters, rules, formulas, and acceptance criteria ("detail the combat system",
  "write the GDD for the inventory system", "fill in the rest of this system doc",
  "spec out the parameters of X"), AND revise it after approval under the delta discipline
  ("raise the damage by 10%", "tune the economy", "rework the status system", "nerf
  X", "change this rule") — a number change is Tuning, a small rule a Tweak, restructuring
  a Rework; each bumps the version and logs the delta. To add a NEW system or
  restructure the system map use /unikit-gd-spec; to edit GAME.md content use /unikit-gd-spec;
  the moment an edit also touches a second system, a content type, a flow, or GAME.md (two
  or more zones) use /unikit-gd-apply; to invent a brand-new game concept use
  /unikit-gd-brainstorm.
argument-hint: "<system name | SYS-slug> [\"<what to change>\"]  (mode inferred from doc state + intent; no flags)"
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

# Game Design — Per-System GDD (Authoring & Revision)

Own **one system's design document** at
`.unikit/gamedesign/systems/SYS-<slug>.md` — eleven sections (A–K) plus any
domain section-packs. This skill owns the **system zone** (`gd-principles` → Zone
Ownership): the **full lifecycle** of a `SYSTEM.md` lives here — **create** the
skeleton, **fill** its placeholders, and **revise** approved content (Tuning /
Tweak / Rework) under the delta discipline. There is no separate editor skill.

It never creates the master spec or the map, and never edits `GAME.md` content —
that is `unikit-gd-spec`; player-action flows are `unikit-gd-flow`'s.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and artifacts (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English. Do not announce the language setting.

## Phase 0 — Bootstrap

Silently load — do not narrate:

1. **`.unikit/system/gamedesign/gd-principles.md`** (the core) — the collaborative
   protocol, the facts registry / ID conventions, and the language rules. Plus, from
   the same `gamedesign/` folder, the shards this skill needs: **`gd-authoring.md`**
   (the **section-cycle authoring contract** + the **delta discipline** — the
   mandatory Version +1 → changelog → registry-check → recommend-verify tail),
   **`gd-lifecycle.md`** (the lifecycle & status spine), and **`gd-provenance.md`**
   (the import provenance markers). This skill **applies** that contract; it does not
   restate the mechanics. If missing, warn (`unikit-ai update`) and fall back to the
   protocol as summarized in this file.
2. **`.unikit/gamedesign/GAME.md`** — pillars, loops, non-goals the system must
   serve (its roster is in `## System Map [gen]`). If it does not exist, **stop** —
   there is no master spec yet. Read `.unikit/gamedesign/concepts/INDEX.md` (if it
   exists) to route precisely: a `drafted`/`approved` concept present → recommend
   `/unikit-gd-spec` (build the master spec from it); no concept — or no
   `concepts/INDEX.md` (or no `concepts/` dir) at all → recommend
   `/unikit-gd-brainstorm` first, then `/unikit-gd-spec`.
3. **`.unikit/gamedesign/GD-IDS.yaml`** — find the target system's entry under
   `systems`. If there is **no entry**, the system is not on the map: offer to add
   it via `/unikit-gd-spec` (**add-system** — graft this one system onto the map, not
   a remap), or pick an existing `not-started` system. Do not author an off-map
   system.
4. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — load the **core** domain
   rules for this system's **behavioural domain**, on demand by `Load When`, plus
   any studio `library` rule on the same topic. Read the domain from the system's
   name and Overview (the behaviour it drives), **not** from the coarse GD-IDS
   `category`. When the behaviour is **unambiguous**, attach the matching domain
   automatically (its section-pack rides along — auto-attached with a veto, see item 6
   and Phase 4); when it is **ambiguous** or the category is coarse (Gameplay / Meta),
   settle it with one plain `AskUserQuestion` — framed as an outcome, no codes — rather
   than guessing. A system may match more than one domain; they combine:

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
   when authoring J. Obey the index's **Rule-Loading Discipline**: load by `Load When`,
   load a reference only from its parent rule's `> **References**:`, and **never glob the
   memory tree** (`.unikit/memory/gamedesign/**`) to discover rules.
5. **`.unikit/RULES.md`** (if present) — project overrides, highest priority.
6. **`{{skills_dir}}/{{self_name}}/references/section-packs.md`** — the catalog of
   domain section-packs. On an **unambiguous** domain the matching pack is
   **auto-attached** — announced to the user in one outcome-language phrase (what it
   adds for the player / the design, never the word "pack" or a code) that they can
   veto; on an **ambiguous** domain a single plain Yes/No decides it. Never a mandatory
   pass after section K, never surfaced as registry jargon. Load the pack named in the
   table above (when one applies).
7. **Schema guard (clean break — no automatic migration).** `GD-IDS.yaml` MUST be
   `version: 2`. If it is still `version: 1`, **STOP** and report: the design
   workspace is on the pre-v2 layout — v2 dropped the standalone markdown
   system-index and now renders the roster into `GAME.md` (`## System Map [gen]`);
   there is no automatic migration. Tell the user to bump `GD-IDS.yaml` to
   `version: 2` and fold the legacy system-index rows into GAME.md's
   `## System Map [gen]` before re-running.

**One-way boundary:** never read `.unikit/code/`, project source, or build
artifacts. The only external read is `SOURCE.md` during an import (Phase 1).

## Phase 1 — Context

Gather the facts the system must stay consistent with (read-only):

- **Known facts** from `GD-IDS.yaml` — pillars (`implements` targets), entities,
  formulas, and terms already locked by other systems. These are constraints, not
  suggestions.
- **Neighbor GDDs** — for each system this one depends on (from the GD-IDS
  `depends_on`, rendered in GAME.md `## System Map`), read its header and sections
  **D (Formulas)** and **F (Dependencies)** to match data interfaces.
- **Recent `unikit-gd-verify` reports** for this system, if any
  (`.unikit/gamedesign/reviews/`).
- **Import source** — if `GD-IDS`/GAME mention an import, or a
  `researches/<date>_import-*/SOURCE.md` covers this system, read it: section
  content is **extracted** from it, not regenerated. Mark provenance per
  `gd-provenance` → Provenance: place `<!-- provenance: extracted from SOURCE.md -->`
  under each section lifted from the source and `<!-- provenance: generated -->`
  under each section inferred to complete the skeleton; untagged sections are
  normal authored content.
- **Explore research (internal design lens)** — if this system was grafted from an
  `unikit-gd-explore` brief, discover the research **deterministically** (survives a
  `/clear`): read the system's `GD-IDS` `research:` pointer (authoritative), falling
  back to the `researches/INDEX.md` entry whose `Target:` is this `SYS-<slug>`. Read
  that research's `RESEARCH_BRIEF.md` → **`## New Feature Plan`** block and use its
  **section seeds** as the *starting drafts* — a **seeded** section is **drafted
  silently** in Generation (Phase 4) and confirmed in the group review (Phase 5); a
  seed is a draft, not an approved write. For
  a **revision** (Edit), the matching block is **`## Improvement Plan`** — its
  ready-to-apply delta lines (`<Section>: <old> → <new>`), expected scale, touched
  facts, and any `RF-<date>-n` it closes pre-fill the change set (the user still
  approves every edit). These explore-seeded drafts are **untagged normal authored
  content** — do **not** mark them `extracted` / `generated` (those markers are for
  **imports** only; this is the generalization of import-reading stated canonically
  in `gd-provenance` → Provenance, which this skill applies rather than restates).

## Phase 2 — Resolve Mode + Depth (no flags)

Check `.unikit/gamedesign/systems/SYS-<slug>.md` and read the intent in the prompt:

1. **Does not exist** → **Create**: build the skeleton (Phase 3), then author from
   section A.
2. **Exists** and the prompt describes a **change to approved content** (a value,
   rule, or structure: "raise damage", "tune the economy", "rework the status
   system", "nerf X", "change this rule") → **Edit**: classify the scale and apply
   the delta (Revision below). Approved text is changed **only** through this path.
3. **Exists with `[To be designed]` placeholders** and the intent is to continue /
   fill (or no change is described) → **Fill**: resume from the remaining placeholders.
   Approved text is **never overwritten** — only placeholders are filled. Skip the
   skeleton sub-step (Phase 3.1); still fork-scan and run Phases 4–5 over the
   placeholders.
4. **Exists, complete, no change described** → detailing is done; nothing to author.
   Offer review / verify (Phase 6) and stop.

If the system name is ambiguous (matches several entries, or none) →
`AskUserQuestion` listing candidates. Never guess the target.

**Depth gate (Create / Fill only).** Once the mode is Create or Fill, present **one**
depth picker — the named tiers `core/standard/full`, each with what it adds, not bare
letters:

```
AskUserQuestion: How deep should this pass go?
Options:
1. core (recommended) — the floor that gets the doc to a solid, usable base: Overview,
   Player Fantasy, Detailed Design, Formulas, Acceptance Criteria.
2. standard — core + Edge Cases, Dependencies, Tuning Knobs, Telemetry, Accessibility.
3. full — every section + the relevant domain pack(s).
```

The picked tier is the **ephemeral scope of this pass — NOT stored** (`gd-authoring` /
`gd-lifecycle`); the lasting fact is the inferred status at Phase 6. The matching
**section-pack** for the system's domain (Phase 0 table) is **auto-attached when the
domain is unambiguous** — announced in one outcome-language phrase you can veto; an
ambiguous domain gets a single plain Yes/No in the Phase 4 decision round. **Edit** mode
skips the depth gate entirely (it lies flat on the Revision flow).

---

## Authoring (Create / Fill) — Decision-First

The system zone applies the **Decision-First Section-Cycle Contract** in
`gd-authoring`: the six-phase mechanic lives in the shard; below are the
system-specific **section map**, **core-set**, and per-section logic. **Address
sections by name in the dialogue, never by a bare letter** (A–K means nothing to the
user).

| § | Section | What it holds |
|---|---------|---------------|
| A | Overview | One paragraph for a newcomer; what the player does; why it exists. Non-goals (3–5 "the system does NOT…"). |
| B | Player Fantasy | "The player feels X when Y", tied to the pillar it serves. |
| C | Detailed Design | Core Rules (numbered, unambiguous); States & Transitions; Interactions with other systems. |
| D | Formulas | Each `FORM-<slug>`: expression, variable table (name/type/range/source), output range, numeric example. |
| E | Edge Cases | "If <condition>: <outcome>"; zero / maximum / simultaneity; degenerate strategies (Sirlin check) vs tuning knobs. |
| F | Dependencies | Direction, hard/soft, data interface; must agree with the GD-IDS `depends_on` (rendered in GAME.md `## System Map`) and the neighbor's F. |
| G | Tuning Knobs | knob / category (feel\|curve\|gate) / range / default / what breaks at the extremes → direct input for configs. |
| H | Acceptance Criteria | `AC-<slug>-N`: Given-When-Then; performance budgets. Quoted verbatim by the planning side. |
| I | Telemetry | event (English `snake_case`) / payload / the design question it answers. |
| J | Accessibility | GAG checklist items (basic minimum) / accommodations / justified deviations. |
| K | Open Questions & Changelog | open questions (owner/when); changelog blocks (added by this skill on a revision and by `unikit-gd-verify`). |

**Core-set (the floor for `detailed`, from `gd-lifecycle`):** A Overview · B Player
Fantasy · C Detailed Design · D Formulas · H Acceptance Criteria. The **depth** picked
in Phase 2 sets which sections this pass attempts (`core` = just the floor; `standard`
/ `full` layer on E/F/G/I/J + packs). **Fill** re-picks depth and runs Decision-First
only over the newly-attempted sections — earlier approved sections are untouched and
partiality stays honest.

### Phase 3 — Skeleton + Fork-Scan

1. **Skeleton (Create mode only).** Write the file from the SYSTEM template with
   **every** A–K header present and a `[To be designed]` placeholder under each, the
   header filled from the GD-IDS entry. Get **one approval** for the skeleton; a
   refusal sets `doc_status: skeleton` and stops (BLOCKED).

   ```
   # <System Name> — SYS-<slug>
   > Status: skeleton · Version: 1 · Last Updated: <date>
   > Implements: PIL-n[, PIL-m] · Layer: <Foundation|Core|Feature|Presentation> · Scope: <S|M|L|XL>
   ```

   When the system's domain has a **section-pack** (Phase 0 table), its sub-sections
   are appended after K (attached in Phase 4 — see `references/section-packs.md`).
2. **Fork-scan (silent).** Walk the in-scope sections (per the picked depth) and
   classify each **without asking** — **seeded** (the Phase 1 context: a SOURCE /
   recon / explore brief, the pillars, the loaded domain rules, or a neighbour already
   answers it → it will be drafted silently) vs **real fork** (a genuine design choice
   with no seeded answer). Catch pillar- and registry-conflicts **here**, before any
   prose is written. Emit `INFO [gd-system] depth=<tier>`.

### Phase 4 — Decision Interview + Generation

**Decision interview.** Ask **only the real forks**, batched (1–2 `AskUserQuestion`
rounds) — never one gate per section. Options are **grounded** in the loaded
`balance` / `frameworks` theory, the pillars, and neighbours, **never a blank page**:
"which damage curve?" offers grounded **forms** (linear / diminishing / threshold) +
an open **"my own — I'll describe it"**. A truly-blank section with no grounded option
becomes an explicit **flagged open question** (section K), not a silent blank. A
**pillar or loop conflict** that surfaces here is escalated to `/unikit-gd-spec`
**before writing** — the real change is in GAME.md content or the map; name it, do not
force-fit. **Section-packs** ride this round: an **unambiguous** domain **auto-attaches**
its pack — announced in one outcome-language phrase (the value it adds for the player /
the design, never the word "pack" or a code) and **vetoable**; an **ambiguous** domain is
settled by a single plain Yes/No. Packs are orthogonal to depth and combine.

**Generation.** Draft each in-scope section — **seeded** sections **silently** (emit
`INFO [gd-system] seeded §<name> — drafted silently`), decided sections from their
decision. The section-specific logic (the rest follows the Decision-First flow):

- **C / Core Rules** — numbered, implementable without guessing. Record new game
  terms in `GD-IDS.yaml` `terms` (canonical English + translation + forbidden aliases).
- **D / Formulas** — each gets a `FORM-<slug>`, the expression, a variable table, the
  expected output range, and a worked numeric example. Name the degenerate **values** —
  inputs at zero / max / negative that break the curve — and state how the formula
  clamps them. (Degenerate **strategies** belong to E.)
- **Registry check after C and D** — compare every number and name against the known
  facts from Phase 1. On a mismatch, surface it **immediately**: obey the registry /
  change it through a `unikit-gd-verify` resolution / park it in section K. Never
  silently override a registry value.
- **E / Edge Cases** — ask "what at zero / at maximum / on simultaneity?"; test every
  degenerate strategy against the tuning knobs in G.
- **H / Acceptance Criteria — auto-derived** from C, D, and E, **never asked**: one
  Given-When-Then per core rule and per edge case, numbered `AC-<slug>-N`, stable —
  never reshuffled. The verbatim contract the code side quotes.
- **J Accessibility / I Telemetry at a low depth — auto-default from the rules + a
  "clarify" note**, a sensible default with a flag (never an empty marker —
  accessibility is **not** dropped; load `accessibility` when authoring J). At `full`
  depth they are authored through the normal flow.
- **Deferred** — a section the user chose to skip at this depth is written with a
  `<!-- deferred -->` marker (distinct from the skeleton `[To be designed]`). A
  **core** section (A/B/C/D/H) **may** be deferred, but then the status honestly stays
  below `detailed` (the Phase 6 soft floor guard) — emit `WARN [gd-system] core
  section §<name> deferred — status held below detailed`.
- **Section-packs** — when a pack was attached (auto-attached or confirmed), author its
  sub-sections after K with the same flow, loading the pack's extra rule as noted in
  `references/section-packs.md`.

### Phase 5 — Group Review

Present the generated sections **by tier-group** (core first, then standard, then
full). Before each section show a **card** — Context · why this section exists · what
it captures · its source — drawn from the SYSTEM template's `[]`-hints (the hint **is**
the card, surfaced to the user on `ru`; no duplication). Each group closes with **one
structural group gate** over the whole group:

```
AskUserQuestion: <group> review — <n>/<m> sections done.
Options: Accept & continue · Fix this · Defer this · Accept all the rest
```

*Fix* loops the section back through a decision; *Defer* writes its `<!-- deferred -->`
marker; *Accept all the rest* ends the review. **Write incrementally** — persist each
accepted section immediately (Edit anchored on its unique heading); the file is the
only memory that survives the session.

In **Fill mode** there is no skeleton step: re-pick depth (Phase 2), fork-scan the
remaining `[To be designed]` sections, and run Phases 4–5 over those only; approved
sections are never overwritten.

→ **Phase 6** writes the registry and the inferred status.

---

## Revision (Edit) — Change an Approved System

The doc exists and the user wants to **change approved content**. This is the
**single sanctioned way** to record a design change to a system: a manual `.md`
edit without a version bump and a changelog entry is an **unrecorded delta** — the
planning side sees the same version and assumes the code is current
(`gd-authoring` → Delta Discipline).

### Classify the scale (from the description)

Infer the change scale from the user's description (the CCGS `quick-design`
classifier). Announce the inferred scale in one line, then proceed:

| Scale | Trigger | How it is applied |
|-------|---------|-------------------|
| **Tuning** | a number changes ("raise damage by 10%", "drop the cap to 5") | targeted `Edit` to section G (knobs) and/or C; one approval |
| **Tweak** | a small rule change with **no new states/branches** | targeted `Edit` to the affected section; one approval |
| **Rework** | restructuring a system ("rework the status system", "redo the economy loop") | derive affected sections from the prompt → confirm → section-cycle, old-vs-new per section |
| **Structural** | a **new system**, a change to the map's composition, or a `GAME.md` content/pillar change | **REDIRECT** — the system zone never touches structure or `GAME.md` |

When the scale is unclear between two levels (e.g. a "tweak" that actually adds a
new state → Rework), ask rather than assume.

### Apply the change

**Tuning / Tweak — targeted edit**
1. Show the **old → new** for each value/rule changing, with the WHY (theory from
   the loaded rules, pillar alignment) — Explain → Capture.
2. Get **one approval** (`AskUserQuestion`).
3. `Edit` the affected section(s) anchored on the unique heading. Approved text
   elsewhere is never touched.

**Rework — section-cycle (old-vs-new)**
1. Derive the affected sections from the description (e.g. "statuses" → C Core
   Rules, D Formulas, E Edge Cases) and **confirm the set** before editing.
2. For each affected section, in order, run the **section-cycle contract from
   `gd-authoring`**, with the section's **current content as the starting draft**:
   Context → Questions → Options (2–4, pros/cons, theory, one **(Recommended)**) →
   Decision → present **old vs new** + Approval **in the same reply** → Write
   (Edit anchored on the heading). Persist each approved section immediately.
3. **Registry check after C and D** (`gd-authoring`): every new number/name vs
   GD-IDS facts; conflicts surface immediately — obey the registry / change it via
   a `unikit-gd-verify` resolution / park it in section K. Never silently override.
4. Re-derive any affected **acceptance criteria (H)**: new ACs get the next stable
   number; changed ACs keep their id; obsolete ACs are marked removed (their
   numbers are never reused). The AC delta feeds the changelog line below.

**Structural — redirect (does not edit)**
The system zone does not change structure or `GAME.md`. Redirect and STOP:

```
This is a structural change (new system / map composition / GAME.md content),
which is outside /unikit-gd-system. Use:
- a brand-new system               → /unikit-gd-spec (add-system) → then detail it here
- the system map or a GAME.md edit  → /unikit-gd-spec
```

**Escalation:** if a system edit hits a pillar or loop constraint, the real change
is in `GAME.md` content (`/unikit-gd-spec`) or the map (`/unikit-gd-spec` remap).
Name the escalation; do not force-fit it into the current document.

### Delta tail (MANDATORY — `gd-authoring`)

Every Tuning / Tweak / Rework edit ends with the full tail; this is non-optional:

1. **Version +1** in the document header **and** in the system's `version` in
   `GD-IDS.yaml`. Set the system's status → `revised` in the **two places that must
   agree**: the `SYSTEM.md` header (the `> Status:` token in the combined header
   line, not a separate bold line) and the `GD-IDS.yaml` `doc_status`
   (`gd-lifecycle` → Lifecycle & Status).
2. **Changelog block (latest delta only — K1)** — section K carries ONE block; this
   **replaces** the previous one (format + the replace-not-append rule owned by
   `gd-authoring`; the full history lives in git):

   ```markdown
   #### v<N> — <YYYY-MM-DD> — <essence of the change> (RF-<date>-n)
   - <Section>: <what changed>
   - AC: + AC-<sys>-7, AC-<sys>-8 (new); AC-<sys>-3 changed; **AC-<sys>-5 removed**
   ```

   The **AC-delta line** (new / changed / removed) is mandatory — the planning
   side consumes exactly this line to build delta plans. The `Affected
   (gd-verify):` line is added later by `unikit-gd-verify`, never here — it is a
   **human-readable record** of the impact pass, not what drives re-verification.
   When the edit **closes a `unikit-gd-review` finding**, cite its stable id in the
   essence: `… (RF-2026-06-14-2)` — the `RF-<YYYY-MM-DD>-<n>` format is owned
   by `unikit-gd-review`. The pending-loop is driven by `Status: revised` itself:
   this skill marks **only the edited system** `revised` (step 1), and
   `unikit-gd-verify` marks affected **dependents** `revised` (verdict-gated). Each
   stays in the loop until `unikit-gd-review` clears it back to `reviewed`.
3. **Registry check:** new numbers/names vs GD-IDS facts — conflicts surface, they
   never silently win. A significant decision needs no separate registry record — its
   rationale rides the changelog essence (+ the `RF-<date>-n` it closes), the full
   "why" lives in git.
4. **Recommend `unikit-gd-verify`** (changed scope) — it computes the impact on
   dependent systems, appends the `Affected` line, and re-renders the stale
   `## System Map [gen]` (freshness).

---

## Phase 6 — Final: Registry & State + Handoff

### Registry & State (Create / Fill)

After the sections are authored and accepted:

1. **Scan the GDD** for registry candidates — entities, formulas, and constants
   referenced in **two or more places** (within this doc or cross-system). Internal
   single-use values stay in the GDD.
2. Present a **NEW / KNOWN** summary and get approval to write `GD-IDS.yaml`
   (`entities`, `formulas`, plus the `systems` entry's `doc_status` / `version`).
   Existing values are never changed silently; every fact carries its `source`.
3. **Status (inferred — `gd-lifecycle`).** Set the system's status in the **two places
   that must agree** — the `SYSTEM.md` header `> Status:` token (inside the combined
   header line, not a separate bold line) and the `GD-IDS.yaml` `doc_status`:
   - `detailed` once the whole **core-set (A/B/C/D/H)** is authored.
   - **held at `skeleton`** while any **core** section carries `<!-- deferred -->` (the
     soft floor guard; the WARN in Phase 4) — the status does **not** rise to
     `detailed`.
   - when the core is complete but ≥1 **non-core** section is deferred, the status is
     `detailed` and the `## System Map [gen]` renders it `detailed · partial (n/m)`
     (inferred from the markers, never a stored field).

   Set `version: 1` in `GD-IDS.yaml` (and the header), write the initial changelog
   block to section K (`#### v1 — <date> — initial design` with the
   `AC: + AC-<slug>-1 … N (new)` line) — the single current block (K1).

The `## System Map [gen]` renders this system's status/version (incl. the `· partial`
suffix) **read-only** from `GD-IDS`; it is **not** this skill's surface — it
re-renders on the next `unikit-gd-verify` freshness check or `unikit-gd-spec` touch
(`gd-lifecycle` → Lifecycle & Status). Recommending verify (below) closes that loop.

### Handoff

Recommend the next steps (do not auto-invoke):

- ✅ Verify consistency & impact — /unikit-gd-verify SYS-<slug>
- 🔍 Qualitative review (fresh session) — /unikit-gd-review systems/SYS-<slug>.md
- 🧩 Detail the next system — /unikit-gd-system <SYS-slug>

A review is most independent in a **fresh session** (the reviewer should not have
authored the doc). `unikit-gd-verify` checks the doc against the registry, flags
dependent systems, and refreshes the `## System Map [gen]`.

## Final: Compact Report

The terminal plaque (TIER A — `gd-principles` → Language): lead with the **name**; the
`SYS-` / `AC-` ids ride along as parenthetical copy-paste tags; render the lifecycle
status as a **plain phrase**, never the raw enum.

```
System: <name>  (SYS-<slug>)
Mode: <create | fill | edit (tuning|tweak|rework)>   ·   Depth: <core | standard | full>  (create/fill)
Doc: .unikit/gamedesign/systems/SYS-<slug>.md — <ready | ready, a couple of optional blocks left | skeleton, main blocks not filled yet | updated, awaiting re-review>, vN
Sections authored/edited: <the named list>   [deferred: <names carrying <!-- deferred --> > | none]
Registry: +<E> entities, +<F> formulas, +<T> terms  (GD-IDS.yaml)
Acceptance criteria: AC-<slug>-1 … AC-<slug>-N   [AC delta on an edit: +<n> / changed <n> / removed <n>]
```

No summary document, no report file.

## Ownership Boundaries

- **Owns:** the **full lifecycle** of `systems/SYS-<slug>.md` — creating the
  skeleton, filling placeholders, **and revising approved content** (Tuning / Tweak
  / Rework, with the version bump + changelog + `revised` status); the system's
  `GD-IDS.yaml` facts (`entities`, `formulas`, `terms`) and its `doc_status` /
  `version`.
- **Not this skill:** `GAME.md` content **or** structure / the system map →
  `unikit-gd-spec`; player-action flows → `unikit-gd-flow`; quality verdicts →
  `unikit-gd-review`; consistency & impact (and the `## System Map [gen]` freshness
  render) → `unikit-gd-verify`.
- **Never:** write, fill, or edit without approval; overwrite approved text outside
  the delta discipline; skip the version bump or changelog on an edit (unrecorded
  delta); change a `GD-IDS.yaml` value silently; delete or renumber an ID; touch
  structure or `GAME.md`; read the code workspace or project source.

## Quick Reference

```
/unikit-gd-system SYS-combat                        → create skeleton + author A–K (if no doc yet)
/unikit-gd-system combat                            → resolve to the SYS-slug; same flow
/unikit-gd-system SYS-combat                        → resume filling placeholders (partial doc)
/unikit-gd-system SYS-combat "raise grunt damage 10%" → Tuning: edit G/C, one approval
/unikit-gd-system combat "small fix to the parry rule" → Tweak: targeted edit
/unikit-gd-system SYS-combat "rework the status system" → Rework: section-cycle old-vs-new
```
