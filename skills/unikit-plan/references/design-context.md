# unikit-plan — Design Context (Step 4.5)

> Loaded on demand by `unikit-plan` Step 4.5 dispatch **only when
> `design_linked = true`** (the gate is resolved inline in Step 0.5 of `SKILL.md`;
> this body is not entered otherwise). It produces the plan's `## Design` (+
> optional `## Flow Context` / `## Content Context`) snapshot, then control returns
> to Step 5 in `SKILL.md`. One-way boundary: this body only *reads* design — it
> never writes `.unikit/gamedesign/`.

## Step 4.5: Resolve Design Context (game-design module)

**Runs only when `design_linked = true`** (a `version: 2` `.unikit/gamedesign/GD-IDS.yaml` exists). It
grounds the plan in the game's design and is the source of the plan's `## Design` section.
When `design_linked = false`, this body is never loaded.

This step embodies the **one-way boundary**: it only *reads* design artifacts. Never write
to `.unikit/gamedesign/`.

#### 4.5.0 — Load the shared READ contract

Read `.unikit/system/gamedesign/design-read.md` first. It is the canonical formulation of the
**read surfaces** (read the `GD-IDS.yaml` registry, not the `[gen]` render), the **Flow-First
Resolution** ladder (*intent decides the door*), and the **one-way boundary**. Apply its rules in
the mechanics below — do **not** restate the decision ladder here.

#### 4.5.0b — Choose the door (apply Flow-First Resolution)

A planning request can target either authoring axis. **Apply** the design-read Flow-First Resolution
rule to pick which axis to resolve first (do not re-author the ladder — it lives in `design-read.md`):

- **Flow door** — the request names/implies a flow (a `FLOW-<slug>` id, "the onboarding / first-session
  flow", a player sequence) → resolve a **flow first** (see *Flow door* below), then read the systems
  it exercises via 4.5.1–4.5.4 (cross-axis) for `## Design`.
- **System door** — the request names/implies a system (a mechanic, a `SYS-<slug>` id, a `category`) →
  resolve a **system first** (4.5.1), then read the flows that exercise it via 4.5.5 and the content
  types that feed it via 4.5.6 (cross-axis) for `## Flow Context` / `## Content Context`.
- **Content door** — the request names/implies a content type (a `CT-<slug>` id, "the item-catalog
  schema", "plan the catalog of items") → resolve the **content type first-class** via 4.5.6, then
  read its `belongs_to` system via 4.5.1–4.5.4 (cross-axis) for `## Design`. Outside a CT-shaped
  request, content is reached as the cross-axis read of the System / Flow door — not an independent
  option.
- **Ambiguous** (reads as more than one axis, or names several) → `AskUserQuestion` listing the
  candidate axes; **never guess** (per design-read). This mirrors the `/unikit-gd-explore` routing stance.

**Flow door — resolve the flow first.** When intent points at a flow:

1. Read `.unikit/gamedesign/GD-IDS.yaml` `flows` (the registry, not the `## Flow Map [gen]` render).
   Match the request against each flow's name / `FLOW-<slug>` id. One confident match → use it;
   several plausible matches, or none → `AskUserQuestion` listing candidate flows; **never guess**.
   An empty `flows: []` (or no `flows` key yet) against a flow-shaped request → tell the user no flow
   exists and point at `/unikit-gd-flow`; if they instead name a system, fall back to the System door.
2. Read the resolved flow's `FLOW.md` (`source` path) and build the **primary** `## Flow Context`
   using the 4.5.5 mechanics + template (the flow is the lead artifact here, not a secondary read).
3. **Cross-axis read** — for each system the flow `depends_on` / its `goals[].targets` reference,
   run system resolution 4.5.1 → 4.5.4 to produce `## Design`. The flow stays primary; its systems
   are grounded because the flow exercises them.

Under the **System door** the order is the reverse: resolve the system (4.5.1) first, then run 4.5.5
as the cross-axis flow read.

#### 4.5.1 — Resolve the target system

1. Read `.unikit/gamedesign/GD-IDS.yaml` `systems` (the machine-readable roster — the
   same data GAME.md's `## System Map [gen]` renders read-only; read the registry, not
   the render). Each entry carries `id`, `name`, `category`, `tier`, `status`
   (`active | deprecated`), `doc_status`, `version`, `implemented_version`, `depends_on`,
   and `source`.
2. Match the feature description against each system's `name` (and `category` —
   `unikit-gd-spec` records it for exactly this match). Exclude entries whose `status` is
   `deprecated` from candidate matching — emit
   `WARN [design] SYS-<id> deprecated; excluded from candidates` and do not plan against
   one. One confident match → use it. Several plausible matches, or none → resolve with
   `AskUserQuestion` (list the candidate systems); **never guess** the system. If the user
   confirms the feature has no design system (pure code/tech work) → set
   `design_linked = false` and continue to Step 5 with no `## Design` section.
3. For the resolved entry, read its system GDD from the `source` path
   (`.unikit/gamedesign/systems/*.md`). Capture: the system `SYS-id`, current `version`,
   the **effective status** (`doc_status`, overridden by `deprecated` from `status` and by
   `implemented` when `implemented_version` is non-empty — the same precedence the
   `## System Map [gen]` shows), and the **Acceptance Criteria** (verbatim, keyed by
   `AC-<id>`).

#### 4.5.2 — Status gate (warn, never block)

Plan generation continues regardless of status, but surface a `WARN [design]` line when the
resolved system's `Status` is not `detailed`:

- `not-started` / `skeleton` — the design is incomplete; the plan may rest on a partial
  spec. Suggest finishing `/unikit-gd-system <system>` first.
- `implemented` — code already exists for this version (the version is recorded in
  `GD-IDS.yaml` `implemented_version`, read as the baseline in 4.5.3); confirm intent (a
  re-plan usually implies an unrecorded delta).
- `deprecated` — the system was dropped in a remap; 4.5.1 filters it out of candidate
  matching. If the user explicitly targets it, `WARN [design]` and confirm intent before
  planning — a deprecated system normally should not receive new code.

#### 4.5.3 — Delta plan (design moved ahead of code)

Prompts like "plan the new version of Combat" or "bring combat up to the design" need no
`SYS-id` or version number — resolve them here:

1. **System** — resolved in 4.5.1.
2. **What is already implemented** — read the resolved system's `implemented_version`
   from `.unikit/gamedesign/GD-IDS.yaml` (set by code-side `unikit-verify` on
   all-AC-met). A **non-empty** `implemented_version` is the authoritative implemented
   baseline. When the field is **absent or empty (`""`)** — e.g. a system implemented
   before this field existed — fall back (migration grace) to scanning prior `## Design`
   blocks for this `SYS-id` across `.unikit/code/plans/*/*.md` (and the flat
   `.unikit/code/PLAN.md`); the highest version in a completed plan is the inferred
   baseline. The glob is **file-name-agnostic on purpose**: a completed plan folder is
   never rewritten by a migration, so its `## Design` block stays in whichever file the
   plan was originally written into — the block is located by its heading, not by the
   name of the file around it. The glob is also load-bearing — one that misses returns
   *no prior plan* rather than an error. Neither source → ask: "no implementation found
   — plan the full system?" — no match is **not** an error condition, and the question
   goes to the user rather than being answered silently.
3. **Delta** — collect the system GDD's changelog blocks (section K) over the interval
   `(implemented, current]`. Multiple edits → multiple blocks.
4. **Tasks** — new/changed `AC` → implementation tasks; **removed `AC` → tasks to rip out
   the old behavior**; changed formulas / tuning knobs → config tasks. If the delta is
   large or unclear, suggest `/unikit-explore` before planning.

#### 4.5.4 — Produce the `## Design` snapshot

Prepare a `## Design` block for the plan (written in Step 5 into the plan manifest,
directly after `## Based on`). It is a **snapshot at planning
time**: cite AC text by reference to the live doc (do not fork it), and record the version.
Checklist tasks reference the `AC-<id>`s.

```markdown
## Design
- **System**: SYS-combat — `.unikit/gamedesign/systems/combat.md`
- **Version**: 4 (prior plan 2026-06-10_combat-core implemented v3)
- **Delta v3→v4** (from changelog): stacks up to 5 (section C); FORM-status-tick → config; knob max_stacks → config
- **Acceptance Criteria (current, cited):**
  - AC-combat-3 (changed): Given …, When …, Then …
  - AC-combat-7, AC-combat-8 (new): …
  - AC-combat-5 — **removed in v4** → task to remove the old behavior
```

For a first-time plan (no prior implementation), drop the `Delta` line and list the
system's full current AC set.

#### 4.5.5 — Resolve flow context (the dynamics axis)

The **System door** runs this after the system is resolved (4.5.1) as the cross-axis read; the
**Flow door** runs it first (the flow is the primary artifact — 4.5.0b). The dynamics axis grounds
the plan in *what the player does* with this system over time, not just its rules — the flow's
wiring-mode is often the single most actionable fact for the implementer. This is a read-only
design read (One-Way Boundary); never write to `.unikit/gamedesign/`.

1. Read `.unikit/gamedesign/GD-IDS.yaml` `flows`. An empty `flows: []` (or a registry
   with no `flows` key yet) → **no flow context; skip silently** — never an error. For
   the resolved `SYS-id`, find every flow whose `depends_on` includes it **or** whose
   `goals[].targets` reference it (`GOAL → SYS`, or `GOAL → AC-<sys>-n`).
2. For each matching flow, read its `FLOW.md` (`source` path) and capture the **flow
   brief**: the `FLOW-id` + `mode`, the `GOAL` steps that touch this system (id +
   summary + the `SYS`/`AC` each targets), and the **status of the systems the flow
   depends on** (so the plan knows which dependencies are already `implemented`).
3. **Wiring-mode dictates code structure** — surface it explicitly:
   - `linear` → a fixed step sequence with a success check per `GOAL`;
   - `conditional` → a branch dispatch on world/player state;
   - `emergent` → a goal-set of independent affordances, no fixed order.
4. **`Realized` is derived, read-only** — a flow is realized once **every** system in
   its `depends_on` has a non-empty `implemented_version`. Report it; **never write it
   back** (flows have no `implemented` field — flow delivery is confirmed by playtest,
   not the plan/verify gate).

Prepare an optional `## Flow Context` block (written in Step 5 alongside `## Design`),
omitted entirely when no flow exercises the system:

```markdown
## Flow Context
- **Flow**: FLOW-first-session — `.unikit/gamedesign/flows/FLOW-first-session.md` (mode: linear)
- **Exercises this system at**: GOAL-first-session-2 → AC-combat-3 ("defeat the first enemy")
- **Code shape (from mode)**: linear → a fixed step sequence with a success check per GOAL
- **Dependency status**: SYS-combat detailed v4 · SYS-stamina implemented v2 — flow Realized: no
```

#### 4.5.6 — Resolve content context (the catalog axis)

The **System / Flow door** runs this after the primary artifact is resolved as the cross-axis
read; the **Content door** runs it first (the content type is the primary artifact — 4.5.0b). The
catalog axis grounds the plan in *what content the system consumes and by what schema* — the
`CT.fields` schema is the literal data contract the implementer codes against. This is a read-only
design read (One-Way Boundary); never write to `.unikit/gamedesign/`.

1. Read `.unikit/gamedesign/GD-IDS.yaml` `content_types`. An empty `content_types: []` (or a
   registry with no `content_types` key yet) → **no content context; skip silently** — never an
   error. Resolve by **two paths** (per the content door of the Flow-First Resolution ladder):
   - **(a) Content door** — the request named a content type first-class (a `CT-<slug>` id, "the
     item-catalog schema") → the brief is built from **that** `CT` (plus its `belongs_to` system as
     cross-axis context).
   - **(b) System / Flow door (cross-axis)** — for the resolved `SYS-id`, find every content type
     whose `belongs_to` names it **or** whose `CT.fields` carry a `ref<SYS>` to it.
2. For each resolved content type, read its `CONTENT-TYPE.md` (`source` path) and capture the
   **content brief**: the `CT-id` + `scale`, the `CT.fields` schema (the typed contract the code
   reads — field names, types, `required`/`default`/`range`), the `belongs_to` system, and the
   `ref<>` dependencies (`ref<RES>` / `ref<ENT>` / `ref<SYS>` / …).
3. **`scale` dictates code structure** — surface it explicitly:
   - `bulk` → a data table / loader driven by the `spec` descriptor (the instances live in data,
     not code); the code reads the `CT.fields` shape and ingests the catalog;
   - `curated` → a set of named instances built from the `fields` rows in the registry.
4. **No writeback** — content types have no `implemented_version`; content delivery is a playtest
   call, never a plan/verify gate (the same read-only stance as a flow's `Realized`). Report the
   schema; never write to `.unikit/gamedesign/`.

Prepare an optional `## Content Context` block (written in Step 5 alongside `## Design` /
`## Flow Context`), omitted entirely when no content type is bound:

```markdown
## Content Context
- **Content type**: CT-item — `.unikit/gamedesign/content-types/CT-item.md` (scale: bulk)
- **Feeds**: SYS-inventory (belongs_to) · referenced by GOAL-first-session-3 (cross-axis)
- **Schema (CT.fields, the code contract)**: base_value:int[1,100000] req · category:enum{jewelry,electronics,tools} · condition:float[0,1]=1.0 · reward:ref<RES>
- **Code shape (from scale)**: bulk → a data-driven loader over `data/items.csv` following CT-item.fields
```

**After producing the snapshot(s) → return to Step 5 in `SKILL.md`.**
