# Enemy spawn wave — CT-spawn

> **Status**: reviewed
> **Scale**: bulk
> **Belongs to**: SYS-combat
> **Version**: 1

<!-- defect (#6 content version 2-place): this header says `> Version: 1`, but
GD-IDS `content_types[].version` for CT-spawn is `2` — the two places that must
agree disagree (the same shape as a system's version coherence). -->

A bulk catalog of patrol-drone spawn waves SYS-combat pulls from. The wave data
lives in the editor; only a `count` + `spec` descriptor is registered.

## A. Overview

One unit is a single spawn wave (which enemy, how fast, how many). Scale is **bulk**
— dozens of waves whose values live in `data/spawns.json`, not the registry.

## B. Schema (CT.fields)

| Field | Type | Required | Default | Range / Values | Meaning |
|-------|------|----------|---------|----------------|---------|
| enemy | ref<ENT> | yes | — | ENT-drone | which entity spawns |
| spawn_rate | float | no | 1.0 | 0.1–5.0 | spawns per second |
| wave_size | int | no | 5 | 1–50 | enemies per wave |

## C. Scale & Generation

*Scale = bulk — count + spec descriptor (instances live in the editor).*

| Descriptor | Value |
|------------|-------|
| Count (current) | 40 |
| Spec (where + shape) | `data/spawns.json`, one row per the schema above |
| Generator | hand-authored |

## D. Relationships & Dependencies

<!-- defect (#8 RES/TRACK/KNOB coherence): this section cites `TRACK-elite`, a
progression track that has NO entry in GD-IDS `tracks[]` — an unregistered fact
crossing a document boundary. defect (#9 cross-axis SYS→CT): this CT `belongs_to`
SYS-combat; when SYS-combat is the changed scope, verify's impact pass must mark
CT-spawn `revised` in GD-IDS `doc_status` (it is currently `reviewed`). -->

| Link | Via | Nature |
|------|-----|--------|
| SYS-combat | `belongs_to` | the system that runs these waves |
| ENT-drone | field `enemy: ref<ENT>` | the spawned entity |
| TRACK-elite | clearing elite waves advances it | the (unregistered) progression track |

## E. Validation & Edge Cases

| Scenario | Expected handling | Rationale |
|----------|-------------------|-----------|
| wave_size above 50 | clamp to 50 | frame budget |
| spawn_rate of 0 | reject | a wave that never spawns is dead content |

## F. Open Questions & Changelog

### Open Questions

| Question | Why it is open | What would resolve it |
|----------|----------------|-----------------------|
| Elite-wave cadence | TRACK-elite is unregistered (defect) | register the track via its owning zone |

### Changelog

```markdown
#### v2 — 2026-06-23 — wave_size added
- Fields: + wave_size (new)
- Affected (gd-verify): SYS-combat reads wave_size

#### v1 — 2026-06-23 — initial schema
- Created from template; CT.fields authored, scale chosen (bulk).
- Fields: + enemy, + spawn_rate (new)
- Affected (gd-verify): —
```
