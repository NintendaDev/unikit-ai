# [Content Type Name] — CT-[slug]

> **Status**: skeleton | detailed | reviewed | revised
> **Scale**: bulk | curated
> **Belongs to**: SYS-[slug]
> **Version**: 1
> **Last Updated**: [YYYY-MM-DD]

A per-content-type design document — the **catalog** axis (the data the game is made
of), alongside the SYSTEM GDDs (the rules), the FLOW GDDs (the dynamics), and
`GAME.md` (the whole). A content type is a **schema + descriptor**, never the catalog
of values: `GD-IDS.yaml` carries the contract (the typed `CT.fields` + the `scale`
descriptor), while the bulk values live in the editor. Authored through the
section-cycle contract (see `.unikit/system/gamedesign/gd-authoring.md`). The `Scale`
(declared in the header and in `GD-IDS.yaml`) dictates the shape of section C;
`unikit-gd-verify` checks `Scale` ↔ structure. Machine-readable facts (the schema,
the units, `belongs_to`) live in `GD-IDS.yaml` `content_types` / `content`.

## A. Overview

[What this content type is and the consuming system it feeds: what one unit
represents, what the player encounters, and why the type exists. State the `Scale`
choice and why — `bulk` = many similar units whose values live in the editor (only a
`count` + `spec` descriptor is registered); `curated` = a small hand-tuned set whose
values live in the registry. One short paragraph — a skill scanning the catalog reads
only this to decide whether to read further.]

## B. Schema (CT.fields)

The typed field schema — **the contract the code side reads**, one row per field.
Field types: `int`, `float`, `string`, `bool`, `enum(values)`, `list<T>`,
`asset-ref`, `loc-ref`, `ref<PREFIX>` (a content↔X link — `ref<ENT>` / `ref<CU>` /
`ref<FORM>` / `ref<SYS>`; a link is a **field**, never metadata). This table must
agree with `content_types[].fields` in `GD-IDS.yaml`; `unikit-gd-verify` checks it.
A change here is a **schema edit** (version bump + data migration — see
`gd-authoring` → Content delta).

| Field | Type | Required | Default | Range / Values | Meaning |
|-------|------|----------|---------|----------------|---------|
| [name] | [int] | [yes] | [—] | [1–100000] | [what it means] |
| [name] | [enum] | [no] | [—] | [a, b, c] | [meaning] |
| [name] | [ref<RES>] | [no] | [—] | [—] | [a content↔resource link] |

## C. Scale & Generation

*Keep the form that matches the header `> Scale:`. `unikit-gd-verify` flags a
mismatch between `Scale` and the structure below (as it does `Mode` ↔ structure for a
flow).*

### If Scale = bulk — count + spec descriptor

Instances live in the editor / data files, **not** in `GD-IDS.yaml`; only this
descriptor is registered (a `content` row with `kind: set`). State how many, where,
and how they are produced.

| Descriptor | Value |
|------------|-------|
| Count (current) | [e.g. 480] |
| Spec (where + shape) | [e.g. `data/items.csv`, one row per the schema above] |
| Generator | [hand-authored / procedural / imported] |

### If Scale = curated — the catalog

Each unit is a `content` row (`kind: instance`) carrying `fields` ⊆ the schema above.
List the curated set (the authored, hand-tuned units); each `CU-<ct>-<n>` is the
content counterpart of a system's `AC-<sys>-<n>`.

| CU id | Name | Key field values |
|-------|------|------------------|
| CU-[slug]-1 | [Name] | [field: value, …] |
| CU-[slug]-2 | [Name] | [field: value, …] |

## D. Relationships & Dependencies

The `ref<>` fields above are this type's links to other content and facts — a
content↔content / content↔system link is a **field**, never metadata. `belongs_to`
(the header `> Belongs to:`) names the **consuming system** (`CT → SYS`, one-way) and
must agree with `content_types[].belongs_to` in `GD-IDS.yaml`. A `belongs_to` or a
`ref<SYS>` naming a missing or deprecated system is a verify conflict — route the new
system back through `unikit-gd-spec` add-system, never invent the roster row here.

| Link | Via | Nature |
|------|-----|--------|
| [SYS-inventory] | [`belongs_to`] | [the system that consumes these units] |
| [RES-coins] | [field `reward: ref<RES>`] | [each unit grants this resource] |

## E. Validation & Edge Cases

What makes a unit valid beyond its field types (cross-field rules, required
combinations) and how degenerate values are handled. These feed the **genre-blind**
checks `unikit-gd-verify` runs: each `fields` value ⊆ `CT.fields` by name + type,
every `ref<>` resolves, and a `bulk` type carries `count` + `spec`.

| Scenario | Expected handling | Rationale |
|----------|-------------------|-----------|
| [field out of range] | [clamp / reject] | [why] |
| [`ref<>` target deprecated] | [verify conflict → re-point] | [why] |

## F. Open Questions & Changelog

### Open Questions

| Question | Why it is open | What would resolve it |
|----------|----------------|-----------------------|
| [Undecided point] | [needs data / missing system] | [decision / prototype] |

### Changelog

[Appended by the content type's zone owner (`unikit-gd-content`) on every approved
**schema** edit. Catalog churn — adding / removing units, a `bulk` `count` change —
is **data, not a schema edit**: no version bump, no entry (see `gd-authoring` →
Content delta). Newest first. The **fields-delta line** is the content counterpart of
a system's AC delta — the code side consumes exactly this line. A system edit that
touches this type's `belongs_to` or a `ref<SYS>` can stale it: `unikit-gd-verify`
marks it `revised` (cross-axis staleness); the reverse never holds.]

```markdown
#### v1 — [YYYY-MM-DD] — initial schema
- Created from template; CT.fields authored, scale chosen.
- Fields: + [field] … (new)
- Affected (gd-verify): —
```
