# Boost card — CT-card

> **Status**: reviewed
> **Scale**: curated
> **Belongs to**: SYS-hud
> **Version**: 1
> **Last Updated**: 2026-06-23

A small hand-tuned set of boost cards the courier equips before a run. Scale is
**curated** — a handful of units, each balanced by hand, so each is a registry row.

## A. Overview

One unit is a single equippable boost card (title, power, a linked system). Scale is
**curated** — the set is small and hand-tuned, so each unit's values live in the
registry (`kind: instance`).

## B. Schema (CT.fields)

| Field | Type | Required | Default | Range / Values | Meaning |
|-------|------|----------|---------|----------------|---------|
| title | string | yes | — | — | display name |
| power | int | no | 1 | 1–10 | boost magnitude |
| link | ref<SYS> | no | — | — | the system this card augments |

<!-- NB: there is intentionally NO `rarity` field — CU-card-1 carries one anyway
(defect #2 below). -->

## C. Scale & Generation

### The catalog

<!-- defect (#2 CU.fields ⊆ CT.fields): CU-card-1 carries `rarity: epic`, a field
ABSENT from the schema above. defect (#3 ref<> resolution): its `link` resolves to
SYS-inventory, a system that exists in neither GD-IDS nor any doc — a Critical
dangling `ref<SYS>`. -->

| CU id | Name | Key field values |
|-------|------|------------------|
| CU-card-1 | Overdrive | title: "Overdrive", power: 8, link: SYS-inventory, rarity: epic |

## D. Relationships & Dependencies

<!-- defect (#5 belongs_to 3-way): `belongs_to` names SYS-hud, which is
`status: deprecated` in GD-IDS — a content type cannot feed a deprecated system.
Route the real consuming system through /unikit-gd-spec add-system. -->

| Link | Via | Nature |
|------|-----|--------|
| SYS-hud | `belongs_to` | the (deprecated) consuming system |
| SYS-inventory | field `link: ref<SYS>` | the augmented system (missing) |

## E. Validation & Edge Cases

| Scenario | Expected handling | Rationale |
|----------|-------------------|-----------|
| power above 10 | clamp to 10 | the cap protects PIL-2 balance |
| `link` target deprecated/missing | verify conflict → re-point | a card cannot augment a non-system |

## F. Open Questions & Changelog

### Open Questions

| Question | Why it is open | What would resolve it |
|----------|----------------|-----------------------|
| Which system cards augment | belongs_to / link are wrong (defects) | spec add-system for the real target |

### Changelog

```markdown
#### v1 — 2026-06-23 — initial schema
- Created from template; CT.fields authored, scale chosen (curated).
- Fields: + title, + power, + link (new)
- Affected (gd-verify): —
```
