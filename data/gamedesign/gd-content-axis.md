# Game-Design Principles — Content Axis

A shard of the `gd-principles` working contract, installed by `unikit-ai init` /
`unikit-ai update` into `.unikit/system/gamedesign/gd-content-axis.md` as a flat
copy (engine-agnostic, no variable substitution, not hash-tracked). Loaded on
Bootstrap by `unikit-gd-content`, `unikit-gd-verify`, and `unikit-gd-review`. See
the core `gd-principles.md` for zone ownership and routing.

## Content Axis

A **content type** is the fourth design artifact, alongside the system and the
flow. Where a system answers "what are the rules" and a flow "what the player does
over time", a content type answers **"what content exists and by what schema"** —
the catalog layer. Content types are owned by `unikit-gd-content` (see Zone
Ownership). The `CONTENT-TYPE.md` document and the per-type skill arrive with the
Content axis; this section is the contract those rest on.

**The CT / CU model.** A **content type** (`CT-<slug>`) is a **schema +
descriptor**, never the catalog of values; a **content unit** (`CU-<ct>-<n>`) is a
thin, genre-agnostic envelope around that schema. All per-genre variability lives
in the schema, never in the envelope — so the CU shape never grows as genres change.

- **`CT.fields` is a typed schema** — the contract the code side reads. Field types:
  `int · float · string · bool · enum · list<T> · asset-ref · loc-ref · ref<PREFIX>`.
- **`ref<PREFIX>` makes a content↔X link a *field*, not metadata** —
  `ref<ENT>` / `ref<CU>` / `ref<FORM>` / `ref<SYS>` / `ref<RES>`. A reward, a
  consumed resource, a referenced entity is a typed field of the schema, so the CU
  envelope never sprouts a per-genre relationship slot.

**Scale (`bulk | curated`) ↔ structure.** Each content type declares a `scale:` in
`GD-IDS`, and the scale dictates the `CONTENT-TYPE.md` section-C structure and what
enters the registry:

- `bulk` → a **`count` + `spec` descriptor**. The instances live in the editor /
  data files; only the count and the spec (where the data lives + the shape it
  follows) enter `GD-IDS`. The values themselves never cross the registry boundary.
- `curated` → **`fields` rows** in the registry — each curated unit carries
  `fields` ⊆ its `CT.fields` (by field name + type).

`unikit-gd-content` selects the scale (infer from the type's nature → ask on
ambiguity → record `scale:` in `GD-IDS`); `unikit-gd-verify` checks `scale:` ↔ the
document's section-C structure, exactly as it checks a flow's `mode:` ↔ structure or
a system's `packs:` ↔ its `## Pack:` headings. A scale change (`bulk` ⇄ `curated`)
is a schema edit — an ordinary delta step of the same skill (full delta discipline,
`gd-authoring` → Content delta).

**`belongs_to` (`CT → SYS`, one-way).** A content type names the consuming system it
feeds; the edge is one-way (a system never lists its content types), and a
`belongs_to` naming a missing/deprecated system **routes back to `unikit-gd-spec`
add-system** — the content zone never writes a roster row itself. The full contract
of this edge (display precedence, kept-not-deleted) lives in `gd-lifecycle` →
Content axis; this is the pointer, not a restatement.

**Content lifecycle.** A content type carries its own `doc_status` on the **same
enum and two-place spine as systems and flows** (`not-started → skeleton →
detailed`; the `CONTENT-TYPE.md` header `> Status:` line ↔ the
`content_types[].doc_status` field in `GD-IDS`, `GD-IDS` winning) — apply it exactly
as for systems (`gd-lifecycle` → Content axis). `detailed` is terminal readiness;
only a **schema edit** bumps a `CT`'s version (`Ver+1`, status stays `detailed`),
and catalog churn never does (`gd-authoring` → Content delta).

**Cross-axis staleness (one-way, within design).** Editing a **system** can stale a
**content type** that feeds it (through `belongs_to` / a `ref<SYS>` field):
`unikit-gd-verify` **prints** the dependent `CT` as affected (informational) and
recommends a re-author pass — it never changes the `CT`'s status. The reverse does
**not** hold — editing a content type never stales a system. This mirrors the flow
axis's cross-axis staleness; acting on the print (the `Ver+1` + changelog touch) is
the owner's call via `unikit-gd-content`.

**RES / TRACK / KNOB are facts.** Resources (`RES-<slug>`), progression tracks
(`TRACK-<slug>`), and global tuning knobs (`KNOB-<slug>`) are cross-boundary facts,
not documents. Each is registered by the **owning zone via a registry-check** (not a
profile edit) — a `ref<RES>` field on a content type, a track a system exposes, a
knob more than one system reads. They live in `GD-IDS` under their own sections and
are subject to the unregistered-fact check like any other fact.

**Code reads content (no new write surface).** Content is a *read* target for the
code side — an ordinary design-read under the One-Way Boundary, never a new
writeback:

- `unikit-plan` and `unikit-explore` read the content brief — the `CT.fields`
  schema (the contract), the `scale` (it dictates the code structure: `bulk` → a
  data table / loader per `spec`; `curated` → named instances from the `fields`
  rows), the `belongs_to` system, and the `ref<>` dependencies.
- A content type's **delivery is a playtest call, never written back**: there is
  **no** `implemented`-style writeback onto content types. `implemented_version`
  lives **only on systems** (the lone sanctioned code→design write, systems-only);
  content "realized" is confirmed by playtest, not by the verify gate — exactly as a
  flow's readiness is.
