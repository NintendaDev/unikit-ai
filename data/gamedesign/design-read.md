# Design Read Contract

> Shared **READ contract** for the game-design workspace. Code-side skills
> (`/unikit-plan`, `/unikit-explore`) load this on demand once a design workspace
> is linked. It formulates *how* to read design — the read surfaces, the
> flow-first resolution rule, and the one-way boundary. Consumers **apply** these
> rules to their own resolution mechanics; they do **not** restate the decision
> ladder (a duplicated ladder across two or three files is the anti-pattern a
> source-guard watches for).

## When this applies

The consumer establishes `design_linked` **inline** before loading this contract:
a `version: 2` `.unikit/gamedesign/GD-IDS.yaml` exists (a pre-v2 `version: 1`
registry is an `ERROR [design]` at the consumer and never reaches this read). This
contract does **not** re-run that gate — it assumes a linked, valid v2 workspace
and governs the read that follows.

## Read Surfaces

Read the **registry**, not the render.

- `.unikit/gamedesign/GD-IDS.yaml` — the machine-readable roster: `systems`,
  `flows`, `events`, and the content axis (`content_types`, `content`,
  `resources`). It is the source of truth for ids, `status`, `doc_status`,
  `version`, `implemented_version`, `depends_on`, `goals`/`targets`,
  `scale`/`belongs_to`/`fields` (the `CT.fields` schema), and `source` paths. Read
  this, not the maps that render from it.
- `.unikit/gamedesign/systems/*.md` — one system GDD each (rules + Acceptance
  Criteria, keyed `AC-<id>`). Cite AC by `AC-<id>` referencing the live doc; do
  not fork its text.
- `.unikit/gamedesign/flows/*.md` — one flow each (the **dynamics** axis: `GOAL`
  steps, the wiring `mode`, pacing). Cite `GOAL-<id>` referencing the live doc.
- `.unikit/gamedesign/content-types/*.md` — one content-type GDD each (the
  **catalog** axis: the `CT.fields` schema, the `scale`, the `belongs_to` system).
  Cite `CU-<id>` referencing the live doc; the schema is the contract the code reads.
- `GAME.md` `## System Map [gen]` / `## Flow Map [gen]` / `## Funnel [gen]` /
  `## Content Map [gen]` — **read-only renders**. Use them only to orient; never
  treat a render as the source of a fact that already lives in `GD-IDS.yaml`.

**Effective status precedence** (mirror what the `[gen]` render shows): start from
`doc_status`, override with `deprecated` (from the entry's `status`), and override
with `implemented` when `implemented_version` is non-empty.

## Flow-First Resolution — intent decides the door

A request can target any of the three authoring axes — **`system | flow | content`**
(a **system**, a **flow**, or a **content type**). **Intent decides the door** —
resolve the axis the request names; do **not** default to systems:

- Request names/implies a **flow** ("plan the first-session flow", "the onboarding
  sequence", a `FLOW-<slug>` id) → resolve a **flow first** (flow → flow).
- Request names/implies a **system** (a mechanic, a `SYS-<slug>` id, a `category`)
  → resolve a **system** (system → system).
- Request names/implies a **content type** ("the item catalog", "the CT-item
  schema", a `CT-<slug>` id) → resolve the **content type first-class** (content →
  content): its `CT.fields` schema, `scale`, and `belongs_to`.
- **Ambiguous** (reads as more than one axis, or names several) → `AskUserQuestion`
  listing the candidates; **never guess** the axis.

This is the canonical decision ladder. Consumers reference it and apply it to
their own resolution mechanics (system match by `name`/`category`, flow match by
`depends_on`/`goals[].targets`, content match by `CT-<slug>`/`belongs_to`); they
must not re-author the ladder.

Once the primary axis is resolved, the **cross-axis read is secondary and
read-only**: a resolved system may be exercised by flows (`depends_on` /
`goals[].targets`) and fed by content types (`belongs_to` / a `ref<SYS>` field); a
resolved flow depends on systems; a resolved content type names its consuming
system. Walk that edge per the consumer's own mechanics — this contract fixes only
the door-choice rule above. The phrasing mirrors the `/unikit-gd-explore` routing
stance (intent-inferred, never a flag; ambiguity → ask).

## One-Way Boundary

Code **reads** design; design never reads code. This contract only ever *reads*
`.unikit/gamedesign/` — `GD-IDS.yaml`, `systems/*.md`, `flows/*.md`, and the
read-only `[gen]` renders. It **never writes or edits** any `.unikit/gamedesign/`
artifact; design changes flow exclusively through the `/unikit-gd-*` skills.

The single sanctioned code→design write — `implemented_version`, stamped by
`/unikit-verify` on all-AC-met — is **systems-only** and is **not** part of this
read contract. A flow's `Realized` state is **derived** (read-only) from its
depended systems' `implemented_version` and is **never** written back: flow
delivery is a playtest call, not a verify gate.
