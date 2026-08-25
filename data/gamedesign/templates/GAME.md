# [Game Title]

> **Status**: drafted | approved
> **Version**: 1
> **Last Updated**: [YYYY-MM-DD]
> **Based on**: [concepts/<slug>/CONCEPT.md (v<N>) | researches/import-<slug>/SOURCE.md | —]

<!-- Resolved genre profile (set by unikit-gd-spec). The canonical id of the bundled
     genre profile spec best-fit the CONCEPT `genre:` hint to and installed (e.g.
     `tycoon`) — a RESOLVE result, distinct from the descriptive `genre:` intent in
     CONCEPT.md. Read by unikit-gd-review (genre-completeness lens via the profile's
     `critical_sections`). Empty when no genre / no profile fit closely (universal
     baseline). A bare non-id slug outside GD-IDS — inert for unikit-gd-verify. -->
> **genre_profile**: ""

The whole-game truth, kept to one page (Librande one-page principle: if it does
not fit, the vision is not yet sharp). Owns the premise, pillars, anti-pillars, the
core fantasy, the aesthetic ranking, the loop stack, win/lose intent, the
monetization stance, and non-goals. Per-system detail lives in SYSTEM GDDs;
machine-readable facts live in `GD-IDS.yaml`. Edits go through `unikit-gd-spec`
(version bump + light changelog — the GAME.md carve-out in `gd-authoring` → Delta
Discipline). The generated maps at the bottom (`## System Map [gen]` /
`## Flow Map [gen]` / `## Funnel [gen]` / `## Content Map [gen]`) are rendered
read-only from `GD-IDS.yaml` — they are an appendix, not part of the one-pager.

## Premise / Theme

[The theme stated as a **problem or tension**, not a setting label — the human
question the game puts the player inside (e.g. "scarcity forces betrayal", not
"post-apocalyptic"). One or two sentences. Setting, story, and systems serve this;
anything that does not is decoration.]

## Setting + World-Trauma

*Optional — narrative-driven games only; omit for abstract / sandbox / puzzle
titles.*

[The world and its **central wound** — the unresolved trauma or tension that gives
the setting dramatic charge and that the player's actions press on. Serves the
Premise/Theme above.]

## Protagonist + Core-Power

*Optional — games with a defined protagonist; omit for faceless / multiplayer /
abstract titles.*

[Who the player is and their **core power** — the defining capability the fantasy
is built around, and how it expresses the pillars.]

## Core Fantasy

[One short paragraph: the emotional promise. Why would someone choose THIS game?
Visceral and immediate — a feeling, not a feature list.]

## Target Aesthetics (MDA)

Ranked goals the pillars must collectively deliver (Hunicke, LeBlanc, Zubek).

| Rank | Aesthetic | How the game delivers it |
|------|-----------|--------------------------|
| 1 | [e.g. Challenge] | [Specific mechanism] |
| 2 | [e.g. Discovery] | [Specific mechanism] |
| 3 | [Optional] | [Mechanism] |

## Pillars

3–5 non-negotiable principles. Each is **falsifiable**, **constraining**
(forces a "no"), and carries a **design test** that resolves a real decision.

### PIL-1 — [Name]

- **Definition**: [One falsifiable sentence. Two people applying it to a design
  question reach the same answer.]
- **Design test**: [If we debate X vs Y, this pillar says we choose ___.]
- **Serves**: [Aesthetic(s) from the ranking above.]

### PIL-2 — [Name]

- **Definition**: [Falsifiable sentence.]
- **Design test**: [Decision it resolves.]
- **Serves**: [Aesthetic(s).]

### PIL-3 — [Name]

- **Definition**: [Falsifiable sentence.]
- **Design test**: [Decision it resolves.]
- **Serves**: [Aesthetic(s).]

> **Conflict order**: when two pillars collide, the lower-numbered pillar wins.
> Re-rank deliberately, never per-decision.

## Anti-Pillars (What This Game Is NOT)

Each "no" protects a "yes". Choose exclusions the team might actually be tempted
by — obvious ones are useless.

- **NOT [thing]**: [Which pillar it would compromise, what it would cost.]
- **NOT [thing]**: [Why excluded.]
- **NOT [thing]**: [Why excluded.]

## Loop Stack

The nested loops that structure play. The 30-second loop must be fun in
isolation before any outer loop is justified.

| Horizon | Loop | Player does… | Ends with |
|---------|------|--------------|-----------|
| Moment (≈30 s) | [Name] | [The most-repeated action] | [Immediate feedback] |
| Short (5–15 min) | [Name] | [The structuring objective/round] | ["one more" hook] |
| Session (30–120 min) | [Name] | [What a sitting accomplishes] | [Stop point + reason to return] |
| Long-term (days+) | [Name] | [How the player grows] | [What they work toward] |

## Player Needs (SDT)

Confirm the pillars cover all three needs; an uncovered need is a gap, not
necessarily a flaw.

| Need | Served by | How |
|------|-----------|-----|
| Autonomy | [PIL-n] | [Meaningful choice / agency] |
| Competence | [PIL-n] | [Mastery / clear feedback] |
| Relatedness | [PIL-n] | [Connection / belonging] |

## Win / Lose Conditions

*Conditional section — include it only if the game can be **won or lost**. A
sandbox / endless title omits it; when in doubt, ask the user.* These are the
author's high-level intent — they exist before any flow. A terminal `GOAL`
realizes each, and `unikit-gd-verify` links every win/lose condition to its
realizing flow objective (no orphan conditions, no orphan terminal goals).

- **Win**: [The condition(s) under which the player wins — high-level intent.]
- **Lose**: [The failure condition(s), if any.]

## Monetization Stance

[The game's posture toward monetization — the model (premium / F2P / hybrid), what
is sold and what is **never** sold (the ethical line), and how it serves rather
than fights the pillars. Detailed shop/economy systems live in their SYSTEM GDDs;
high-level conversion / LTV / retention intent is authored here, while per-flow
funnel instrumentation lives in `## Funnel [gen]`. Loads the `monetization-ethics`
domain rule. Keep to the stance; the systems carry the mechanics.]

## Reference Games

| Reference | What we take | What we change | Validates |
|-----------|--------------|----------------|-----------|
| [Game] | [Mechanic / feeling] | [Our twist] | [PIL-n] |
| [Game] | [What we learn] | [Our twist] | [PIL-n] |

## Open Questions

[Things needing prototyping or research before they can be answered. Move
resolved items into the relevant SYSTEM GDD or GD-IDS.]

- [Question — and what would answer it.]

## Design Order

Dependency sort × priority. Independent systems in the same layer can be designed
in parallel; a system's GDD should reach `detailed` before systems that depend on
it are detailed. (Authored here by `unikit-gd-spec` alongside the roster; the
live status of each system is in `## System Map [gen]` below.)

1. [SYS-slug] — [MVP] — [Foundation] — [why first]
2. [SYS-slug] — [MVP] — [Core] — depends on: [SYS-ids]

## Risks & Circular Dependencies

High-risk systems to prototype early regardless of tier; any dependency cycles and
how they are broken (interface, or design both at once).

| System | Risk type | Note / resolution |
|--------|-----------|-------------------|
| [SYS-slug] | [Technical / Design / Scope] | [What could go wrong, mitigation] |

## Changelog

The **latest delta only (K1)** — exactly ONE block, the current version's.
`unikit-gd-spec` **replaces** this block on every approved edit; it does not accumulate
a ledger here — the full history lives in git (`gd-authoring` → Delta Discipline).
GAME.md is a one-pager, not a system: the entry is **light** — version, date, essence,
and one line per changed section. No AC-delta line and no `Affected (gd-verify):` line
(those are SYSTEM GDD fields, and GAME.md has no `GD-IDS.yaml systems` row).

#### v1 — [YYYY-MM-DD] — initial draft
- <Section>: created from template

---

*Everything below is a generated appendix — read-only, not part of the one-pager.*

## Roster Legend

Static authoring reference for the grouping axes of the maps below (the enum values
`unikit-gd-spec` assigns when it adds a system).

**Categories**

| Category | What it covers |
|----------|----------------|
| Core | Foundations everything depends on (controller, input, camera, state) |
| Gameplay | The systems that make the game fun (combat, AI, movement, interaction) |
| Progression | How the player grows (XP, unlocks, skill trees, achievements) |
| Economy | Resource creation/consumption (currency, loot, crafting, shops) |
| UI | Player-facing information (HUD, menus, inventory, map) |
| Narrative | Story and dialogue delivery (quests, dialogue, lore) |
| Meta | Outside the core loop (analytics, onboarding, accessibility) |

**Priority Tiers**

| Tier | Definition | Design urgency |
|------|------------|----------------|
| MVP | Required for the core loop to be testable ("is this fun?") | Design FIRST |
| Vertical Slice | One complete, polished area | Design SECOND |
| Alpha | All systems present in rough form | Design THIRD |
| Full Vision | Polish, edge cases, nice-to-haves | As needed |

## System Map [gen]

<!-- gen:system-map -->
Generated read-only from `GD-IDS.yaml` `systems` by `unikit-gd-spec` — **do not
hand-edit**. Re-rendered on every roster/registry change (`unikit-gd-verify` checks
freshness). Full map: one row per system, grouped by category (empty categories
omitted), sorted by tier then design order within a group. `Status` mirrors the
system's `doc_status` (plus `deprecated` from the `status` field and the code-set
`implemented`); `Ver` is `—` until `skeleton`. Collapse to a single grouped table
only as an escape hatch for very large rosters (150+ systems).

### Core

| ID | System | Tier | Status | Ver | Depends | Doc |
|----|--------|------|--------|-----|---------|-----|
| SYS-[slug] | [Name] | [MVP] | not-started | — | [SYS-ids or —] | [systems/SYS-[slug].md] |

### Gameplay

| ID | System | Tier | Status | Ver | Depends | Doc |
|----|--------|------|--------|-----|---------|-----|
| SYS-[slug] | [Name] | [MVP] | not-started | — | [SYS-ids or —] | [systems/SYS-[slug].md] |
<!-- /gen:system-map -->

## Flow Map [gen]

<!-- gen:flow-map -->
Generated read-only from `GD-IDS.yaml` `flows` by `unikit-gd-flow` — **do not
hand-edit**. Full map: one row per flow, grouped by wiring-mode. `Realized` is
DERIVED — `yes` once every system in `Depends` is `implemented` (never written; see
`gd-flow-axis` → Flow Axis). `Ver` is `—` until `skeleton`.

### Linear / Conditional

| ID | Flow | Mode | Status | Ver | Depends (SYS) | Realized | Doc |
|----|------|------|--------|-----|---------------|----------|-----|
| FLOW-[slug] | [Name] | linear | not-started | — | [SYS-ids] | no | [flows/FLOW-[slug].md] |

### Emergent

| ID | Flow | Mode | Status | Ver | Depends (SYS) | Realized | Doc |
|----|------|------|--------|-----|---------------|----------|-----|
| FLOW-[slug] | [Name] | emergent | not-started | — | [SYS-ids] | no | [flows/FLOW-[slug].md] |
<!-- /gen:flow-map -->

## Funnel [gen]

<!-- gen:funnel -->
Generated read-only from `GD-IDS.yaml` `events` by `unikit-gd-flow` — **do not
hand-edit**. The ordered measurement points (the third altitude of the
`AC · GOAL · event` grammar); each row is one analytics event, sourced from a
flow's `GOAL`. Global/meta metrics (retention, LTV, conversion) are authored in
`## Monetization Stance`, not here.

| Order | Event | Flow | Measures |
|-------|-------|------|----------|
| 1 | [event_name] | FLOW-[slug] | [what behaviour it captures] |
<!-- /gen:funnel -->

## Content Map [gen]

<!-- gen:content-map -->
Generated read-only from `GD-IDS.yaml` `content_types` by `unikit-gd-content`
(with `content` unit counts) — **do not hand-edit**. Re-rendered on every content-registry
change (`unikit-gd-verify` checks freshness). One row per content type, grouped by
`scale`. `Status` mirrors the type's `doc_status` (plus `deprecated` from the
`status` field); `Ver` is `—` until `skeleton`. `Units` is the registered `count`
for a `bulk` type (its instances live in the editor, not here) or the number of
`curated` rows.

### Bulk

| ID | Content Type | Scale | Status | Ver | Belongs (SYS) | Units | Doc |
|----|--------------|-------|--------|-----|---------------|-------|-----|
| CT-[slug] | [Name] | bulk | not-started | — | [SYS-slug] | [count] | [content-types/CT-[slug].md] |

### Curated

| ID | Content Type | Scale | Status | Ver | Belongs (SYS) | Units | Doc |
|----|--------------|-------|--------|-----|---------------|-------|-----|
| CT-[slug] | [Name] | curated | not-started | — | [SYS-slug] | [n] | [content-types/CT-[slug].md] |
<!-- /gen:content-map -->
