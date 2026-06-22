# Game-Design Principles — Flow Axis

A shard of the `gd-principles` working contract, installed by `unikit-ai init` /
`unikit-ai update` into `.unikit/system/gamedesign/gd-flow-axis.md` as a flat copy
(engine-agnostic, no variable substitution, not hash-tracked). Loaded on Bootstrap
by `unikit-gd-flow`, `unikit-gd-verify`, and `unikit-gd-review`. See the core
`gd-principles.md` for zone ownership and routing.

## Flow Axis

A **flow** is the third design artifact, alongside the system. Where a system
answers "what are the rules", a flow answers "what the player does over time" —
the dynamics layer. Flows are owned by `unikit-gd-flow` (see Zone Ownership). The
flow document and the per-flow skill arrive with the Flow axis; this section is
the contract those rest on.

**The shared grammar — `AC · GOAL · event`.** One Given-When-Then primitive at
three altitudes: a *system* rule, a *flow* step, a *measurement*.

- **`AC-<sys>-<n>`** — a system acceptance criterion (the contract of a rule).
- **`GOAL-<flow>-<n>`** — a flow objective (the contract of a scenario step: what
  the player is trying to do, and the success/feedback that confirms it).
- **event** — a measurement (the contract of an analytics point; aggregated in
  `## Funnel [gen]`).

A `GOAL` references the systems it exercises — `GOAL → SYS` early (at skeleton,
when only the system map exists) and the specific `GOAL → AC` once those systems
are detailed. Flow IDs: **`FLOW-<slug>`** (the document) and **`GOAL-<flow>-<n>`**
(a row).

**Win / Lose ↔ terminal GOAL.** The `## Win / Lose Conditions` in `GAME.md` are the
author's high-level intent and exist before any flow. Each is realized by a
**terminal `GOAL`** — a flow objective that ends the run. `unikit-gd-verify` links
every win/lose condition to its realizing terminal `GOAL`, with **no orphan
conditions and no orphan terminal goals** on either side. The deterministic machine
signal is the **`GOAL-<flow>-<n>` citation in the GAME.md Win/Lose lines** (a
`terminal: true` marker on the `GD-IDS` `goals` entry is a fallback only). This
contract lives here, not only in the `GAME.md` template.

**Flow lifecycle.** A flow carries its own `doc_status`, with the same enum and
spine as a system: `not-started` (in the roster, no document yet) →
`skeleton → detailed → reviewed → revised`. The two-place spine (the header
`> Status:` line in `FLOW.md` + the `doc_status` field in `GD-IDS`) and the
read-only `## Flow Map [gen]` render apply exactly as for systems; the delta
discipline below governs flow edits, made by `unikit-gd-flow`.

**Wiring mode (`linear | conditional | emergent`).** Each flow declares a `mode:`
in `GD-IDS`, and the mode dictates the document's structure:

- `linear` / `conditional` → an **objective-flow table** (Trigger → Expected
  action → Success/feedback → Beacon (optional) → Event), one `GOAL` per row.
- `emergent` → an **affordance / goal-template** (a set of `GOAL`s with no fixed
  order) plus a **pacing envelope** (tension over beats, not a fixed sequence).

`unikit-gd-flow` selects the mode (infer from `GAME.md` genre/pillars → ask on
ambiguity → record `mode:` in `GD-IDS`); `unikit-gd-verify` checks `mode:` ↔ the
document's structure, exactly as it checks a system's `packs:` ↔ its `## Pack:`
headings. A mode change is an ordinary delta step of the same skill.

**Cross-axis staleness (one-way, within design).** Editing a **system** can stale
a **flow** that references it (through `GOAL → SYS` / `GOAL → AC`): `unikit-gd-verify`
marks the dependent flow `revised`, the same pending-loop systems use. The reverse
does **not** hold — editing a flow never stales a system. This is the design-layer
analogue of the dependent-lag rule in Lifecycle & Status, extended across the axis.

**Code reads flow (no new write surface).** Flow is a *read* target for the code
side — an ordinary design-read under the One-Way Boundary, never a new writeback:

- `unikit-plan` and `unikit-explore` read the flow brief — the `GOAL` steps, the
  `SYS`/`AC` each touches, the `wiring-mode` (it dictates the code structure), and
  the status of the systems the flow depends on.
- A flow's **readiness is derived, never written**: a flow is "realized" once the
  `implemented_version` of every system it depends on is met. The
  `## Flow Map [gen]` renders that derived state read-only. There is **no**
  `implemented`-style writeback onto flows — `implemented_version` lives only on
  systems, and flow delivery is confirmed by playtest, not by the verify gate.
