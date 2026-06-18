# Defective GDD fixture (ground truth)

Test data for the agent-driven `/unikit-gd-verify` (mechanical consistency) and
`/unikit-gd-review` (quality) skills, and for the Phase H manual smoke (#19).
These skills are LLM-driven, so there is **no bash assertion** here — this README
is the **ground truth** a reviewer checks the skill output against.
`test-skills.sh` Part 6 only asserts the fixture exists and is well-formed.

The fixture is a tiny, deliberately broken **Neon Drift** design workspace built
on the canonical schema:

```
GAME.md          master design (pillars PIL-1, PIL-2)
GD-INDEX.md      the map — one row per system (SYS-combat, SYS-boost, SYS-loot, SYS-hud)
GD-IDS.yaml      machine truth — pillars / systems / entities / formulas / terms / decisions
systems/combat.md
systems/boost.md
systems/hud.md
# systems/loot.md is intentionally ABSENT (see Index↔disk below)
```

## Mechanical defects — every row of the `/unikit-gd-verify` Phase 2 table has a seeded example

| Verify check | Where | Evidence (what verify must catch) |
|--------------|-------|-----------------------------------|
| **Facts** | `systems/combat.md` | the doc states `ENT-drone` has **30 HP**, but `GD-IDS.yaml` records `health: 40` |
| **Terminology drift** | `systems/combat.md` | the resource is called **"energy"**, a `forbidden_aliases` entry; the canonical term is **"stamina"** |
| **ID validity** (malformed) | `systems/boost.md` §D | `FORM_boost_decay` uses an underscore separator — the prefix must be `FORM-` |
| **Duplicate IDs** | `systems/boost.md` §D | `FORM-boost-curve` is declared **twice** for two different formulas (acceleration + decay) |
| **Dangling references** | `systems/combat.md` §F | depends on `SYS-inventory`, which exists in neither `GD-IDS.yaml` nor any system doc |
| **Unregistered cross-doc fact** | `combat.md` + `boost.md` | `FORM-combat-dps` is cited in **both** documents but has no `GD-IDS.yaml` entry |
| **Index ↔ disk** | `SYS-loot` | `GD-INDEX.md` + `GD-IDS.yaml` carry a `detailed` `SYS-loot` row pointing at `systems/loot.md`, but that file does not exist |
| **Depends 3-way** | `SYS-boost` vs `SYS-combat` | `boost.md` §F declares "depends on SYS-combat", yet the `GD-INDEX` Depends column and `GD-IDS` `depends_on` for `SYS-boost` are both empty |
| **Status coherence** | `SYS-boost` | header `> Status: detailed`, `GD-INDEX` row says `skeleton`, `GD-IDS` `doc_status: detailed` — the three disagree |
| **Version coherence** | `SYS-combat` | header `> Version: 1`, but `GD-INDEX` `Ver` is `2` and `GD-IDS` `version: 2` |
| **AC presence** | `systems/combat.md` §H | a `detailed` system with an **empty** section H (no Given-When-Then criteria) |
| **Placeholder leak** | `systems/boost.md` §E | a `detailed` document still carries a `[To be designed]` skeleton placeholder |

## Negative carve-outs — `/unikit-gd-verify` must NOT flag these

| Carve-out | Where | Why it is correct (not a conflict) |
|-----------|-------|------------------------------------|
| **Display precedence** | `SYS-hud` | `GD-IDS` marks it `status: deprecated`, so the `GD-INDEX` Status column shows `deprecated` over the underlying `doc_status: reviewed`; the header (`reviewed`) and `GD-IDS` `doc_status` (`reviewed`) agree. The `deprecated` display overlay is excluded from the three-way Status comparison. |
| **Lifecycle-enum scope** | `GAME.md` | `GAME.md` keeps `> Status: approved` — its **own** lifecycle enum (`drafted \| approved`). Status/Version coherence is scoped to **system** docs only, so `approved` here is not a status conflict. |

A smoke run that flags either carve-out as a conflict is a regression — the two
carve-outs are the reason `/unikit-gd-verify` scopes the coherence checks to the
system spine and treats `deprecated`/`implemented` as display overlays.

## Qualitative defects — flagged by `/unikit-gd-review`

5. **Balance hole (Major)** — `FORM-combat-dps` (`dps = base * buff_stacks`) has no
   upper bound, so stacking the buff scales damage to infinity (dominant strategy).
6. **Not implementation-ready (Major)** — `systems/combat.md` section H is empty
   (this is also the verify **AC presence** conflict above).
7. **Unfalsifiable pillar tie-in (Minor)** — `PIL-2` "Feels skillful" has no design
   test backing it.
