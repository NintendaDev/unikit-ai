# Loot item — CT-item

> **Status**: detailed
> **Scale**: bulk
> **Belongs to**: SYS-loot
> **Version**: 1
> **Last Updated**: 2026-06-23

A drop the courier picks up off a wrecked drone — the bulk catalog SYS-loot pulls
from. Hundreds of items; their values live in the editor, so only a `count` + `spec`
descriptor should be registered.

## A. Overview

One unit is a single loot item (value, rarity tier, icon). Scale is **bulk** — there
are hundreds of these and their values live in the data files, not the registry.

## B. Schema (CT.fields)

| Field | Type | Required | Default | Range / Values | Meaning |
|-------|------|----------|---------|----------------|---------|
| value | int | yes | — | 1–9999 | scrap value when sold |
| rarity_tier | enum | no | common | common, rare, epic | drop bucket |
| icon | asset-ref | no | — | — | inventory sprite |
| drop_resource | ref<RES> | no | — | RES-scrap | the resource granted on pickup |

## C. Scale & Generation

<!-- defect (#4 scale ↔ structure): the header + GD-IDS declare `scale: bulk`, but
this section renders the CURATED form (a per-unit catalog table) instead of the bulk
`count` + `spec` descriptor. verify must flag the scale↔structure mismatch (the same
shape as a flow's `mode:` ↔ structure check). -->

### The catalog

| CU id | Name | Key field values |
|-------|------|------------------|
| CU-item-1 | Rusty bolt | value: 3, rarity_tier: common |
| CU-item-2 | Plasma core | value: 900, rarity_tier: epic |

## D. Relationships & Dependencies

| Link | Via | Nature |
|------|-----|--------|
| SYS-loot | `belongs_to` | the system that rolls these on a kill |
| RES-scrap | field `drop_resource: ref<RES>` | selling a unit grants this resource |

## E. Validation & Edge Cases

| Scenario | Expected handling | Rationale |
|----------|-------------------|-----------|
| value below 1 | reject | a free item breaks the sink |
| rarity_tier missing | default to common | most drops are common |

## F. Open Questions & Changelog

### Open Questions

| Question | Why it is open | What would resolve it |
|----------|----------------|-----------------------|
| Final catalog size | balance pass pending | a drop-rate prototype |

### Changelog

```markdown
#### v1 — 2026-06-23 — initial schema
- Created from template; CT.fields authored, scale chosen (bulk).
- Fields: + value, + rarity_tier, + icon, + drop_resource (new)
- Affected (gd-verify): —
```
