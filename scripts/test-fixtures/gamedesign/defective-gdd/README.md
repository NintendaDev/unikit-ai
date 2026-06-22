# Defective GDD fixture (ground truth)

Test data for the agent-driven `/unikit-gd-verify` (mechanical consistency) and
`/unikit-gd-review` (quality) skills, and for the Phase H manual smoke (#19).
These skills are LLM-driven, so there is **no bash assertion** here — this README
is the **ground truth** a reviewer checks the skill output against.
`test-skills.sh` Part 6 only asserts the fixture exists and is well-formed.

The fixture is a tiny, deliberately broken **Neon Drift** design workspace built
on the canonical GD-IDS **v2** schema (no standalone markdown index — the roster
renders read-only into `GAME.md` `## System Map [gen]`):

```
GAME.md          master design + the [gen] maps (## System Map / ## Flow Map / ## Funnel) + ## Win / Lose Conditions
GD-IDS.yaml      machine truth (version: 2) — pillars / systems / flows / events / entities / formulas / terms / decisions
systems/combat.md
systems/boost.md
systems/hud.md
# systems/loot.md is intentionally ABSENT (see Roster↔disk below)
flows/FLOW-first-run.md   one flow with seeded flow-axis defects (see Flow-axis defects below)
```

The roster lives in two surfaces: `GD-IDS.yaml` `systems` (the truth) and the
`## System Map [gen]` render in `GAME.md` (read-only). `GD-IDS.yaml` wins on any
disagreement; a stale render is a *freshness* issue verify self-heals, not a
conflict to resolve.

## Mechanical defects — every row of the `/unikit-gd-verify` Phase 2 table has a seeded example

| Verify check | Where | Evidence (what verify must catch) |
|--------------|-------|-----------------------------------|
| **Facts** | `systems/combat.md` | the doc states `ENT-drone` has **30 HP**, but `GD-IDS.yaml` records `health: 40` |
| **Terminology drift** | `systems/combat.md` | the resource is called **"energy"**, a `forbidden_aliases` entry; the canonical term is **"stamina"** |
| **ID validity** (malformed) | `systems/boost.md` §D | `FORM_boost_decay` uses an underscore separator — the prefix must be `FORM-` |
| **Duplicate IDs** | `systems/boost.md` §D | `FORM-boost-curve` is declared **twice** for two different formulas (acceleration + decay) |
| **Dangling references** | `systems/combat.md` §F | depends on `SYS-inventory`, which exists in neither `GD-IDS.yaml` nor any system doc |
| **Unregistered cross-doc fact** | `combat.md` + `boost.md` | `FORM-combat-dps` is cited in **both** documents but has no `GD-IDS.yaml` entry |
| **Roster ↔ disk** | `SYS-loot` | `GD-IDS.yaml` carries a `detailed` `SYS-loot` entry whose `source` is `systems/loot.md`, but that file does not exist |
| **Map freshness (3-surface)** | `GAME.md` `## System Map [gen]` | the render carries a **phantom `SYS-ghost` row** with no `GD-IDS.yaml` entry — a stale render. Verify **self-heals** (re-renders the block from `GD-IDS`, announced) — it does **not** file a resolvable conflict |
| **Depends 3-way** | `SYS-boost` vs `SYS-combat` | `boost.md` §F declares "depends on SYS-combat", yet the `## System Map` Depends cell and `GD-IDS` `depends_on` for `SYS-boost` are both empty |
| **Status coherence** (2-place) | `SYS-boost` | header `> Status: reviewed`, but `GD-IDS` `doc_status: detailed` — the two places that must agree disagree |
| **Version coherence** (2-place) | `SYS-combat` | header `> Version: 1`, but `GD-IDS` `version: 2` |
| **AC presence** | `systems/combat.md` §H | a `detailed` system with an **empty** section H (no Given-When-Then criteria) |
| **Placeholder leak** | `systems/boost.md` §E | a `reviewed` document still carries a `[To be designed]` skeleton placeholder |

The `## System Map [gen]` render is otherwise faithful to `GD-IDS` (combat shows
`Ver 2`, boost `detailed`, hud `deprecated`, all Depends `—`), so the Status,
Version, and Depends-3way conflicts above are header/§F-vs-`GD-IDS` disagreements,
never map disagreements — the map is a freshness surface only, never a coherence one.

## Flow-axis mechanical defects — one seeded example per flow check

The fixture carries one flow, `flows/FLOW-first-run.md` (with its `GD-IDS.yaml`
`flows[]` + `events[]` entries), seeding an example for every flow check
`/unikit-gd-verify` gained with the Flow axis:

| Flow check | Where | Evidence (what verify must catch) |
|------------|-------|-----------------------------------|
| **GOAL id validity + duplicates** | `GD-IDS` `FLOW-first-run.goals` | `GOAL-first-run-4` is declared **twice** for two different objectives |
| **Dangling `GOAL → SYS`** | `FLOW-first-run` `GOAL-first-run-2` | targets `SYS-inventory`, which exists in neither `GD-IDS` nor any doc (Critical) |
| **Flow status coherence** (2-place) | `FLOW-first-run` | header `> Status: reviewed`, but `GD-IDS` `flows[].doc_status: detailed` |
| **Flow version coherence** (2-place) | `FLOW-first-run` | header `> Version: 1`, but `GD-IDS` `flows[].version: 2` |
| **Flow Depends 3-way** | `FLOW-first-run` §D | §D lists SYS-combat **and** SYS-boost, but `GD-IDS` `depends_on` and the `## Flow Map` Depends cell carry SYS-combat only |
| **mode ↔ structure** | `FLOW-first-run` | header + `GD-IDS` declare `mode: emergent`, but §B uses the **linear** objective-flow table form |
| **Win/Lose ↔ terminal GOAL** | `GAME.md` + `FLOW-first-run` | the `## Win / Lose Conditions` Win line cites **no** `GOAL`, while `GOAL-first-run-3` (terminal — "reach the extraction point") realizes it — orphan on both sides |
| **Funnel continuity** | `FLOW-first-run` `GOAL-first-run-1` | the retention-critical first-chain `GOAL` emits **no** event (a blind funnel step) |
| **Flow map freshness (3-surface)** | `GAME.md` `## Flow Map [gen]` | a **phantom `FLOW-ghost` row** with no `GD-IDS` entry — verify **self-heals** (re-renders, recomputing the derived `Realized` column from the depended-on systems' `implemented_version`), not a resolvable conflict |

## Negative carve-outs — `/unikit-gd-verify` must NOT flag these

| Carve-out | Where | Why it is correct (not a conflict) |
|-----------|-------|------------------------------------|
| **Display precedence** | `SYS-hud` | `GD-IDS` marks it `status: deprecated`, so the `## System Map [gen]` Status shows `deprecated` over the underlying `doc_status: reviewed`; the header (`reviewed`) and `GD-IDS` `doc_status` (`reviewed`) agree. The `deprecated` display overlay is excluded from the two-place Status comparison. |
| **Lifecycle-enum scope** | `GAME.md` | `GAME.md` keeps `> Status: approved` — its **own** lifecycle enum (`drafted \| approved`). Status/Version coherence is scoped to **system** docs only, so `approved` here is not a status conflict. |

A smoke run that flags either carve-out as a conflict is a regression — the two
carve-outs are the reason `/unikit-gd-verify` scopes the coherence checks to the
two-place system spine and treats `deprecated`/`implemented` as display overlays.

## Qualitative defects — flagged by `/unikit-gd-review`

5. **Balance hole (Major)** — `FORM-combat-dps` (`dps = base * buff_stacks`) has no
   upper bound, so stacking the buff scales damage to infinity (dominant strategy).
6. **Not implementation-ready (Major)** — `systems/combat.md` section H is empty
   (this is also the verify **AC presence** conflict above).
7. **Unfalsifiable pillar tie-in (Minor)** — `PIL-2` "Feels skillful" has no design
   test backing it.
