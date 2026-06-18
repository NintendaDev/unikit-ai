# Game Design Index

> **Last Updated**: [YYYY-MM-DD]

The human-readable map of the design. One row per system, sorted by design order
(dependencies first). This file is for reading; `GD-IDS.yaml` is the machine
truth. When the two disagree, `GD-IDS.yaml` wins until the conflict is resolved
through `unikit-gd-verify`.

## Pillars

[Mirror of GAME.md pillars, for quick lookup. Full definitions live in GAME.md.]

| ID | Pillar | Design test (short) |
|----|--------|---------------------|
| PIL-1 | [Name] | [One line] |
| PIL-2 | [Name] | [One line] |
| PIL-3 | [Name] | [One line] |

## Systems

`Status`: not-started · skeleton · detailed · reviewed · revised · deprecated · `implemented` (set by the code side only; read-only here). See `.unikit/system/gd-principles.md` → Lifecycle & Status.
`Depends`: SYS-ids this one needs (must match each system's section F).

| ID | System | Category | Tier | Status | Ver | Depends | Doc |
|----|--------|----------|------|--------|-----|---------|-----|
| SYS-[slug] | [Name] | [Core/Gameplay/Progression/Economy/UI/Narrative/Meta] | [MVP/VS/Alpha/Full] | not-started | — | [SYS-ids or —] | [systems/SYS-[slug].md] |

## Categories

| Category | What it covers |
|----------|----------------|
| Core | Foundations everything depends on (controller, input, camera, state) |
| Gameplay | The systems that make the game fun (combat, AI, movement, interaction) |
| Progression | How the player grows (XP, unlocks, skill trees, achievements) |
| Economy | Resource creation/consumption (currency, loot, crafting, shops) |
| UI | Player-facing information (HUD, menus, inventory, map) |
| Narrative | Story and dialogue delivery (quests, dialogue, lore) |
| Meta | Outside the core loop (analytics, onboarding, accessibility) |

## Priority Tiers

| Tier | Definition | Design urgency |
|------|------------|----------------|
| MVP | Required for the core loop to be testable ("is this fun?") | Design FIRST |
| Vertical Slice | One complete, polished area | Design SECOND |
| Alpha | All systems present in rough form | Design THIRD |
| Full Vision | Polish, edge cases, nice-to-haves | As needed |

## Design Order

[Dependency sort × priority. Independent systems in the same layer can be
designed in parallel; a system's GDD should reach `reviewed` before systems that
depend on it are detailed.]

1. [SYS-slug] — [MVP] — [Foundation] — [why first]
2. [SYS-slug] — [MVP] — [Core] — depends on: [SYS-ids]

## Risks & Circular Dependencies

[High-risk systems to prototype early regardless of tier; any dependency cycles
and how they are broken (interface, or design both at once).]

| System | Risk type | Note / resolution |
|--------|-----------|-------------------|
| [SYS-slug] | [Technical / Design / Scope] | [What could go wrong, mitigation] |
