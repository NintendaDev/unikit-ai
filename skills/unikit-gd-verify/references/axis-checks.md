# Axis-aware mechanical checks (flow + content) — body

Loaded on demand by `unikit-gd-verify/SKILL.md` → Phase 2 "Axis-aware checks" when the
registry carries flows and/or content types. The SKILL keeps the system checks +
carve-outs + the switch; this file holds the two axis-check families. The registry-wins
rule and the freshness-vs-conflict distinction apply exactly as in the SKILL's Phase 2 —
freshness is **print-only** (verify is read-only; the owner re-renders the `[gen]` map on
its next write, **B1**). The **cross-axis impact** of a system edit on dependent flows /
content types lives in the SKILL's Phase 3, not here.

### Flow checks (axis-aware — when `GD-IDS` `flows` is non-empty)

When the registry carries flows, run the dynamics-axis checks below — the mirror of the
system checks, plus the flow-specific ones (mode ↔ structure, Win/Lose ↔ terminal GOAL,
funnel continuity). An empty `flows: []` (or no `flows` key) → **skip this block
silently** (not a conflict). The registry-wins rule applies exactly as above.

| Check | Method | Conflict when |
|-------|--------|---------------|
| **GOAL id validity + duplicates** | scan every `FLOW-`/`GOAL-` id for shape; group `GOAL-<flow>-<n>` by value within its flow | a `FLOW-`/`GOAL-` id is malformed, or a `GOAL-<flow>-<n>` is declared twice in one flow — gaps after a removal are **not** a conflict (numbering is stable, like `AC-<sys>-n`) |
| **Dangling `GOAL → SYS` / `GOAL → AC`** | resolve every `GOAL`'s `targets` (and the `FLOW.md` §D edges) against `GD-IDS` | a `GOAL` points at a **missing or deprecated system** (Critical) or a **non-existent `AC-<sys>-n`** (Critical); a dangling `ENT-`/`FORM-`/term token is Major. A needed-but-missing system routes to `/unikit-gd-spec` add-system — verify never writes the roster |
| **Flow status/version 2-place** | a flow's `doc_status` / `version` agree across the **two places** — the `FLOW.md` header `> Status:` / `> Version:` and `GD-IDS` `flows[].doc_status` / `version` (same enum + version rules as systems) | the two disagree (the `research:` pointer is excluded — see the carve-out). The fix (header := `GD-IDS`) is apply-ready — verify prints it, never writes it |
| **Flow Depends 3-way** | for each flow→`SYS` edge, check it agrees across the `FLOW.md` §D table, the `GD-IDS` `flows[].depends_on`, and the `## Flow Map` Depends (SYS) cell | the three sources disagree. (A flow→system edge is **one-way** — a flow *exercises* a system; there is **no** reciprocal edge on the system, unlike system↔system Depends) |
| **mode ↔ structure** | the `GD-IDS` `flows[].mode` matches the `FLOW.md` §B form — `linear`/`conditional` → an objective-flow table; `emergent` → an affordance/goal-template + a pacing envelope (§C) | the declared `mode` and the document's structure disagree (the same check shape as a system's `packs:` ↔ `## Pack:` headings) |
| **Win/Lose ↔ terminal GOAL** | grep each `GAME.md` `## Win / Lose Conditions` line for a cited `GOAL-<flow>-<n>`, and each terminal `GOAL` for a citing win/lose line | a win/lose condition cites **no** realizing terminal `GOAL` (orphan condition — Critical), or a terminal `GOAL` realizes **no** win/lose line (orphan terminal goal — Major). The deterministic signal is the citation in the GAME.md Win/Lose line; a missing citation routes to `/unikit-gd-spec` (GAME.md content). With no Win/Lose section **and** no terminal GOAL, the check is N/A |
| **Funnel continuity** | every retention/conversion-critical `GOAL` has an `events` entry; every `GD-IDS` `events` `flow:` back-pointer resolves to a real flow | a critical `GOAL` emits **no** event (a blind funnel step — Major), or an `events` entry names a `flow:` that does not exist (dangling — Major) |
| **Flow / Funnel map freshness (3-surface)** | compare the `## Flow Map [gen]` rows to `GD-IDS` `flows` (membership, Status, Ver, Depends, **Realized**) and the `## Funnel [gen]` rows to `GD-IDS` `events` | the render disagrees — **not a conflict to resolve**: **print** a freshness notice; the owner (`unikit-gd-flow`) re-renders on its next write; see the `Realized` note below |

**Flow map freshness — print-only, and `Realized` is cross-axis derived.** Like the
System Map, a stale `## Flow Map [gen]` / `## Funnel [gen]` is a *freshness* issue, not
a coherence conflict — verify **prints** it (`## Flow Map [gen] stale — <rows>; owner
re-renders`), it does **not** re-render (read-only). The owner (`unikit-gd-flow`)
re-renders the block from `GD-IDS` (`flows` for the Flow Map, `events` for the Funnel) on
its next write (**B1**). **The `Realized` column is NOT a plain `flows:` render** — it is a
**cross-axis derived** value (`yes` once **every** system in the flow's `depends_on` has a
non-empty `implemented_version`). The owner's re-render MUST recompute `Realized` from
those systems' `implemented_version` (the same derived logic `unikit-gd-flow` uses on
regen-on-write) — rendering only the `flows:` rows without recomputing `Realized` would let
it drift. `Realized` is **never written back** onto a flow (there is no `implemented` field
on flows; flow delivery is confirmed by playtest). A `flows/*.md` file with **no `GD-IDS`
`flows[]` entry** is **routed** — verify routes the user to `/unikit-gd-flow` to register
it (the flow zone writes its own row).

### Content checks (axis-aware — when `GD-IDS` `content_types` is non-empty)

When the registry carries content types, run the catalog-axis checks below — the
mirror of the system checks, plus the content-specific ones (CU ⊆ CT, `ref<>`
resolution, `scale` ↔ structure, `belongs_to` 3-way, content-map freshness,
RES/TRACK/KNOB coherence). An empty `content_types: []` (or no `content_types` key)
→ **skip this block silently** (not a conflict). The registry-wins rule applies
exactly as above.

| Check | Method | Conflict when |
|-------|--------|---------------|
| **CT/CU id validity + duplicates** | scan every `CT-`/`CU-`/`RES-`/`TRACK-`/`KNOB-` id for shape; group `CU-<ct>-<n>` by value within its content type | a `CT-`/`CU-`/`RES-`/`TRACK-`/`KNOB-` id is malformed, or a `CU-<ct>-<n>` is declared twice in one type — gaps after a removal are **not** a conflict (numbering is stable, like `AC-<sys>-n`) |
| **CU.fields ⊆ CT.fields** | for each `content[]` unit, resolve its `type` to a `CT` and check it against that CT's `scale` | a `kind: instance` (curated) unit carries a field **absent** from its `CT.fields`, or a value whose type mismatches the field's declared type; a `kind: set` (bulk) unit is **missing** `count`/`spec`, or carries inline `fields` (bulk values never enter the registry) |
| **`ref<>` resolution** | resolve every `ref<ENT/CU/FORM/SYS/RES>` value (in a `CT.fields` field or a curated unit) against `GD-IDS` | a `ref<>` points at a **missing or deprecated** target — **Critical** for a `ref<SYS>` / `ref<CT>` target, **Major** for `ref<ENT>` / `ref<FORM>` / `ref<RES>` / `ref<CU>`. A needed-but-missing system routes to `/unikit-gd-spec` add-system |
| **scale ↔ structure** | the `GD-IDS` `content_types[].scale` matches the `CONTENT-TYPE.md` §C form — `bulk` → a `count` + `spec` descriptor; `curated` → `fields` rows | the declared `scale` and the document's structure disagree (the same check shape as a flow's `mode:` ↔ structure or a system's `packs:` ↔ `## Pack:` headings) |
| **belongs_to 3-way** | for each `CT → SYS` edge, check it agrees across the `GD-IDS` `content_types[].belongs_to`, the `CONTENT-TYPE.md` §D, and a live (non-deprecated) `SYS` row in the roster | the three disagree, or `belongs_to` names a **missing or deprecated** system — the latter routes to `/unikit-gd-spec` add-system (the content zone never writes the roster). The edge is **one-way** — a system never lists its content types |
| **Content status/version 2-place** | a `CT`'s `doc_status` / `version` agree across the **two places** — the `CONTENT-TYPE.md` header `> Status:` / `> Version:` and `GD-IDS` `content_types[].doc_status` / `version` (same enum + version rules as systems) | the two disagree (the `research:` pointer is excluded — see the carve-out). The fix (header := `GD-IDS`) is apply-ready — verify prints it, never writes it |
| **Content map freshness (3-surface)** | compare the `## Content Map [gen]` rows to `GD-IDS` `content_types` (membership, Status, Ver, Scale, Belongs) | the render disagrees — **not a conflict to resolve**: **print** a freshness notice; the owner (`unikit-gd-content`) re-renders on its next write; see the note below |
| **RES/TRACK/KNOB coherence** | resolve every `ref<RES>` against `resources[]`; grep `RES-`/`TRACK-`/`KNOB-` ids that surface in a document but carry no `GD-IDS` entry | a `ref<RES>` is dangling (Major), or a `RES-`/`TRACK-`/`KNOB-` fact crosses a document boundary with no registry entry (unregistered fact). Empty `resources`/`tracks`/`knobs` → skip silently |

**Content map freshness — print-only, not a conflict.** Like the System and Flow Maps,
a stale `## Content Map [gen]` is a *freshness* issue, not a coherence conflict — verify
**prints** it (`## Content Map [gen] stale — <rows>; owner re-renders`), it does **not**
re-render (read-only). The owner (`unikit-gd-content`) re-renders the block from `GD-IDS`
`content_types` on its next write (the same deterministic render — display-precedence on
`deprecated`). A `content-types/*.md` file with **no `GD-IDS` `content_types[]` entry** is
**routed** — verify routes the user to `/unikit-gd-content` to register it (the content
zone writes its own row).
