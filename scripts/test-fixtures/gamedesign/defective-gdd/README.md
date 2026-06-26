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
GAME.md          master design + the [gen] maps (## System Map / ## Flow Map / ## Funnel / ## Content Map) + ## Win / Lose Conditions
GD-IDS.yaml      machine truth (version: 2) — pillars / systems / flows / events / entities / formulas / terms / content_types / content / resources / tracks / knobs
systems/combat.md         detailed; carries a non-core `<!-- deferred -->` (§I) — the partial-status case
systems/boost.md
systems/hud.md
# systems/loot.md is intentionally ABSENT (see Roster↔disk below)
flows/FLOW-first-run.md   one flow with seeded flow-axis defects (see Flow-axis defects below)
content-types/CT-item.md   one content type per seeded content-axis defect (see Content-axis defects below)
content-types/CT-card.md
content-types/CT-spawn.md
# content-types/CT-ghost.md is intentionally ABSENT (phantom Content-Map row — see below)
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

## Content-axis mechanical defects — one seeded example per content check

The fixture carries three content types (`content-types/CT-{item,card,spawn}.md`)
with their `GD-IDS.yaml` `content_types[]` / `content[]` / `resources[]` / `tracks[]`
/ `knobs[]` entries, seeding an example for every content check `/unikit-gd-verify`
gained with the Content axis. Content checks are **non-empty-gated** on `content_types`
(an empty catalog skips them silently) — this fixture populates the catalog so all
nine run.

| Content check | Where | Evidence (what verify must catch) |
|---------------|-------|-----------------------------------|
| **CT/CU id validity + duplicates** | `GD-IDS` `content[]` | `CU-item-2` is declared **twice** for two different units (Rare + Epic loot tables) |
| **CU.fields ⊆ CT.fields** | `CU-card-1` | the curated unit carries `rarity: epic`, a field **absent** from `CT-card.fields` |
| **`ref<>` resolution** | `CU-card-1` `link` | `link: SYS-inventory` (a `ref<SYS>` value) resolves to a system in neither `GD-IDS` nor any doc — **Critical** dangling `ref<SYS>` |
| **scale ↔ structure** | `content-types/CT-item.md` §C | header + `GD-IDS` declare `scale: bulk`, but §C renders the **curated** catalog table instead of a `count` + `spec` descriptor |
| **belongs_to 3-way** | `CT-card` | `belongs_to: SYS-hud`, which is `status: deprecated` — a content type cannot feed a deprecated system; routes to spec add-system |
| **Content status/version (2-place)** | `CT-spawn` | header `> Version: 1`, but `GD-IDS` `content_types[].version: 2` — the two places that must agree disagree |
| **Content map freshness (3-surface)** | `GAME.md` `## Content Map [gen]` | a **phantom `CT-ghost` row** with no `GD-IDS` entry — verify **self-heals** (re-renders from `content_types`), not a resolvable conflict |
| **RES/TRACK/KNOB coherence** | `content-types/CT-spawn.md` §D | cites `TRACK-elite`, a progression track with **no** `GD-IDS` `tracks[]` entry — an unregistered cross-doc fact (`tracks[]` is non-empty: `TRACK-rank` is registered, so the check runs) |
| **Cross-axis SYS→CT staleness** | `CT-spawn` ↔ `SYS-combat` | `CT-spawn` `belongs_to SYS-combat`; with `SYS-combat` as the **changed scope**, verify's impact pass must mark `CT-spawn` `revised` in `GD-IDS doc_status` (it is currently `reviewed`) — the dependent-lag rule on the content axis |

The `## Content Map [gen]` render is otherwise faithful to `GD-IDS` (CT-spawn shows
`Ver 2`, CT-card `reviewed`), so the **Content status/version** conflict above is a
header-vs-`GD-IDS` disagreement, never a map disagreement — the content map is a
freshness surface only, exactly like the system and flow maps. `belongs_to: SYS-loot`
(CT-item) and `SYS-combat` (CT-spawn) are **valid** edges (both systems are active) —
verify must NOT flag them; only `CT-card → SYS-hud` (deprecated) is the belongs_to defect.

**Genre-blind ground truth.** `/unikit-gd-verify` is **genre-blind**: it never reads a
genre profile's `critical_sections`. Even if a reviewer installs a genre profile into
this fixture's workspace (`unikit-ai genres install <id>`), verify must produce the
**same** content findings as above — it does not gain or lose a check from the profile.
Genre completeness (`critical_sections` present/filled?) is the job of `/unikit-gd-review`
alone (its declinable profile-completeness lens), not verify; a verify run that reports a
"missing genre-critical section" is a regression.

## Negative carve-outs — `/unikit-gd-verify` must NOT flag these

| Carve-out | Where | Why it is correct (not a conflict) |
|-----------|-------|------------------------------------|
| **Display precedence** | `SYS-hud` | `GD-IDS` marks it `status: deprecated`, so the `## System Map [gen]` Status shows `deprecated` over the underlying `doc_status: reviewed`; the header (`reviewed`) and `GD-IDS` `doc_status` (`reviewed`) agree. The `deprecated` display overlay is excluded from the two-place Status comparison. |
| **Lifecycle-enum scope** | `GAME.md` | `GAME.md` keeps `> Status: approved` — its **own** lifecycle enum (`drafted \| approved`). Status/Version coherence is scoped to **system** docs only, so `approved` here is not a status conflict. |
| **Deferred marker (not a leak) + partial render** | `systems/combat.md` §I | the Telemetry section carries `<!-- deferred -->` — **intentionally** skipped at the `core` depth, distinct from `[To be designed]`. Verify must **NOT** flag it as a placeholder leak. The core set A/B/C/D/H is fully authored, so SYS-combat stays `detailed` (the **core-floor** check does **not** fire — only a deferred *core* section would trip it). Instead the `## System Map [gen]` SYS-combat row renders `detailed · partial (1/5)` (1 deferred of the 5 non-core sections E/F/G/I/J), inferred from the marker — a freshness self-heal (the stale render omits it), never a resolvable conflict. |

A smoke run that flags any carve-out as a conflict is a regression — the three
carve-outs are the reason `/unikit-gd-verify` scopes the coherence checks to the
two-place system spine, treats `deprecated`/`implemented` as display overlays, and
treats `<!-- deferred -->` as an intentional omission (rendered `· partial`, never a
placeholder leak — distinct from the `[To be designed]` leak in `systems/boost.md` §E).

## Qualitative defects — flagged by `/unikit-gd-review`

5. **Balance hole (Major)** — `FORM-combat-dps` (`dps = base * buff_stacks`) has no
   upper bound, so stacking the buff scales damage to infinity (dominant strategy).
6. **Not implementation-ready (Major)** — `systems/combat.md` section H is empty
   (this is also the verify **AC presence** conflict above).
7. **Unfalsifiable pillar tie-in (Minor)** — `PIL-2` "Feels skillful" has no design
   test backing it.

## Handoff ground truth (`reviews/`)

`reviews/2026-06-25_review-all.md` is a seeded `/unikit-gd-review` output — the durable
**two-bucket** handoff interface the `review → [explore] → apply` pipeline reads. It is
the ground truth for the handoff smoke; an LLM-driven run is checked against the rows
below.

**Classification (the two buckets).** Every finding is sorted by the silent **ENTAILED**
criterion (`gd-critique` → Handoff Engine):

| RF | Bucket | Why |
|----|--------|-----|
| RF-2026-06-25-2 | **apply-ready** | entailed — one concrete target (the boost loop-stack citation), the correct value already authoritative in `GD-IDS` (`SYS-boost implements: PIL-2`), one local edit, no external knowledge. → `/unikit-gd-apply` |
| RF-2026-06-25-1 | **research** | NOT entailed — needs a math/playtest call to pick the damage-ramp fix. → `/unikit-gd-explore` |
| RF-2026-06-25-3 | **research** | NOT entailed — needs a design decision (what the stamina sink should be). → `/unikit-gd-explore` |
| RF-2026-06-25-4 | (declinable) | a **Suggestion** — plussing; the user may **Decline** it in the interview. |

**decline-vs-direction.** A **review** finding can be **declined** (RF-2026-06-25-4 above —
the interview offers `[I decide / To research / Decline]`); a **verify** conflict cannot —
the dangling `SYS-inventory` reference (`systems/combat.md` §F, the verify
Dangling-references conflict) is a **direction fork**: `[register SYS-inventory / remove
the reference / it is authoring → owner]`, with **no Decline**.

**Loop-guard.** Running `/unikit-gd-apply reviews/2026-06-25_review-all.md` applies the
**apply-ready** bucket (RF-2026-06-25-2) through the owners and closes with
`/unikit-gd-verify apply-phase3`. That closing pass must **self-heal + report only** — it
must **NOT** re-offer the handoff or open the interview (the `apply-phase3` sentinel
suppresses both), so `apply → verify → apply` never loops. A smoke run where the Phase 3
verify offers another `/unikit-gd-apply` is a regression.
