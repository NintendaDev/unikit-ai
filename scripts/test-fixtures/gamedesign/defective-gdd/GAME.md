# Neon Drift — Master Design

> **Status**: approved
> **Version**: 1
> **Last Updated**: 2026-06-13
> **Based on**: —

NEG carve-out (lifecycle-enum scope): GAME.md keeps its **own** lifecycle enum
(`drafted | approved`), so `> Status: approved` here is correct — `unikit-gd-verify`
scopes Status/Version coherence to **system** docs only and must NOT flag it.

## Premise / Theme

The city is collapsing under you — stopping is dying. Speed is the only safety.

## Core Fantasy

A lone courier outruns a collapsing city on a hoverboard.

## Pillars

| ID | Pillar | Design test |
|----|--------|-------------|
| PIL-1 | Momentum is king | Can the player always trade height for speed? |
| PIL-2 | Feels skillful | (no design test — see review defect #7) |

## Loop Stack

Moment-to-moment: dodge → boost → chain. Boosting drains **stamina**; landing a
clean chain refunds it.

## Win / Lose Conditions

<!-- defect (Win/Lose ↔ terminal GOAL): the Win line below cites NO realizing
`GOAL`, while FLOW-first-run's terminal GOAL-first-run-3 ("reach the extraction
point") realizes it — an orphan on both sides. -->

- **Win**: reach the extraction point before the collapse catches the courier.
- **Lose**: the collapse overtakes the courier.

## Monetization Stance

Premium, one-time purchase. No ads, no loot boxes — selling pressure would fight
PIL-1 (momentum, not friction).

## Reference Games

Jet Set Radio, Mirror's Edge.

## Non-Goals

No combat against bosses; no open world.

## Design Order

1. SYS-combat — MVP — Gameplay — the contact-damage core.
2. SYS-boost — MVP — Gameplay — feeds ram damage; depends on SYS-combat.

## Risks & Circular Dependencies

| System | Risk type | Note / resolution |
|--------|-----------|-------------------|
| SYS-combat | Design | `FORM-combat-dps` is unbounded (review defect #5) — prototype the cap early. |

## Changelog

#### v1 — 2026-06-13 — initial draft
- All sections: created from template

---

*Everything below is a generated appendix — read-only, not part of the one-pager.*

## System Map [gen]

<!-- gen:system-map -->
Generated read-only from `GD-IDS.yaml` `systems` — do **not** hand-edit. (Fixture
note: this render is deliberately STALE — it carries a phantom `SYS-ghost` row that
has **no** `GD-IDS.yaml` entry (the **Map-freshness** defect), **and** the SYS-combat
row omits the `· partial (1/5)` suffix that combat's intentionally-deferred non-core
§I (`<!-- deferred -->`) implies; `unikit-gd-verify` **prints** both as stale (the owner
re-renders on its next write — verify is read-only), it does not file a conflict.)

### Gameplay

| ID | System | Tier | Status | Ver | Depends | Doc |
|----|--------|------|--------|-----|---------|-----|
| SYS-combat | Combat | MVP | detailed | 2 | — | systems/combat.md |
| SYS-boost | Boost | MVP | detailed | 1 | — | systems/boost.md |

### Economy

| ID | System | Tier | Status | Ver | Depends | Doc |
|----|--------|------|--------|-----|---------|-----|
| SYS-loot | Loot | VS | detailed | 1 | — | systems/loot.md |

### UI

| ID | System | Tier | Status | Ver | Depends | Doc |
|----|--------|------|--------|-----|---------|-----|
| SYS-hud | HUD | VS | deprecated | 1 | — | systems/hud.md |

### Meta

| ID | System | Tier | Status | Ver | Depends | Doc |
|----|--------|------|--------|-----|---------|-----|
| SYS-ghost | Ghost | Full | skeleton | 1 | — | systems/ghost.md |
<!-- /gen:system-map -->

## Flow Map [gen]

<!-- gen:flow-map -->
Generated read-only from `GD-IDS.yaml` `flows` — do **not** hand-edit. (Fixture note:
this render carries a phantom `FLOW-ghost` row with **no** `GD-IDS.yaml` entry — the
flow **Map-freshness** defect; `unikit-gd-verify` **prints** the stale row (the owner
re-renders on its next write — verify is read-only), it does not file a conflict.
`Realized` is DERIVED — `no` here because `SYS-combat` has no `implemented_version`.)

### Emergent

| ID | Flow | Mode | Status | Ver | Depends (SYS) | Realized | Doc |
|----|------|------|--------|-----|---------------|----------|-----|
| FLOW-first-run | First run | emergent | detailed | 2 | SYS-combat | no | flows/FLOW-first-run.md |
| FLOW-ghost | Ghost run | emergent | skeleton | 1 | — | no | flows/FLOW-ghost.md |
<!-- /gen:flow-map -->

## Funnel [gen]

<!-- gen:funnel -->
Generated read-only from `GD-IDS.yaml` `events` — do **not** hand-edit.

| Order | Event | Flow | Measures |
|-------|-------|------|----------|
| 1 | extraction_reached | FLOW-first-run | how many players finish the first run |
<!-- /gen:funnel -->

## Content Map [gen]

<!-- gen:content-map -->
Generated read-only from `GD-IDS.yaml` `content_types` — do **not** hand-edit.
(Fixture note: this render carries a phantom `CT-ghost` row with **no** `GD-IDS.yaml`
entry — the content **Map-freshness** defect; `unikit-gd-verify` **prints** the stale
row (the owner re-renders on its next write — verify is read-only), it does not file a
conflict. The render is otherwise faithful to
`GD-IDS` — `CT-spawn` shows `Ver 2`, matching the registry; the header-vs-`GD-IDS`
version drift lives in `content-types/CT-spawn.md`, never in this map.)

| ID | Content type | Scale | Belongs to | Status | Ver | Doc |
|----|--------------|-------|------------|--------|-----|-----|
| CT-item | Loot item | bulk | SYS-loot | detailed | 1 | content-types/CT-item.md |
| CT-card | Boost card | curated | SYS-hud | detailed | 1 | content-types/CT-card.md |
| CT-spawn | Enemy spawn wave | bulk | SYS-combat | detailed | 2 | content-types/CT-spawn.md |
| CT-ghost | Ghost catalog | bulk | SYS-combat | skeleton | 1 | content-types/CT-ghost.md |
<!-- /gen:content-map -->
