# Game-Design Principles

This file is the canonical working discipline for the game-design skill family
(`unikit-gd-*`). Installed by `unikit-ai init` / `unikit-ai update` into
`.unikit/system/gd-principles.md` as a flat copy — engine-agnostic, with no
engine-variable substitution (unlike `dev-principles.md`). It is NOT
hash-tracked: every init/update rewrites it. Each game-design skill loads it once
at the start of a task (Bootstrap), the same way the code pipeline loads
`dev-principles.md`.

This file owns the cross-skill **process** contract: the **zone-ownership model**
and the **routing** rule, the user-driven collaboration protocol, the
section-cycle authoring contract, the one-way design→code boundary, delta
discipline, the facts-registry / ID conventions, the flow-axis contracts, the
language rules, the critique stance, and the shared severity rubric. **Domain knowledge** (frameworks,
motivation, balance, economy, progression, level design, narrative, UX,
accessibility, liveops, monetization ethics) lives in the `gamedesign` memory
rules under `.unikit/memory/gamedesign/` and is loaded on demand by `Load when` —
this file is process, never domain.

## Zone Ownership

The skill family is organized by **zones**, not verbs. The taxonomy is: a **noun
owns a thing** (an authoring zone, with the full create+update cycle inside it); a
**verb acts over things** (cross-cutting or upstream, owning no artifact).

**Authoring zones (nouns — each owns one artifact type, create + update):**

| Zone skill | Owns (create + update) |
|---|---|
| `unikit-gd-spec` | the **spec / map** zone — `GAME.md` (the authored one-pager **and** the regenerated `## System Map [gen]`), the system roster (add-system), the `## System Map` block |
| `unikit-gd-system` | the **system** zone — `SYSTEM.md` for one system (create skeleton + author sections + edit approved content) |
| `unikit-gd-flow` | the **flow** zone — `FLOW.md` for one flow (create + update), the `GOAL` rows, the wiring-mode selection, its own `GD-IDS` `flows:` / `events:` entries, and the regenerated `## Flow Map` / `## Funnel` blocks |

- One owner per artifact. The full lifecycle of an artifact (create, fill, edit,
  delta-discipline) lives inside its zone; there is no separate "editor" skill.
- `unikit-gd-spec` is the **single writer of the system roster** — only it adds a
  system (add-system). A **flow registers itself**: `unikit-gd-flow` writes its own
  `GD-IDS` `flows:` / `events:` entries and re-renders both `## Flow Map` and
  `## Funnel` — there is no add-flow in `unikit-gd-spec`. Downstream discovery that
  crosses into the *system* roster (a flow whose `GOAL → SYS` names a missing system,
  a system finding a missing dependency) still **routes back** to `unikit-gd-spec`; a
  system roster row is never written outside it.

**Cross-cutting verbs (act over every zone, own no artifact):**

- `unikit-gd-review` — qualitative verdicts (axis-aware: systems and flows).
- `unikit-gd-verify` — mechanical consistency + changed-scope impact (axis-aware).

**Upstream verbs (feed the zones, own no GDD artifact):**

- `unikit-gd-brainstorm` — ideation (concept).
- `unikit-gd-explore` — design research (read-only; thinks, briefs, and routes).

**Zones ⟂ domains.** Zones are **few** (the authoring skills: spec / system / flow)
and orthogonal to **domains**, which are **many** (`core` memory rules + the
`section-packs`: monetization, liveops, level design, narrative, accessibility, …).
A domain is knowledge that loads into whatever zone touches it — never a skill. So:

- A new **domain** → a new `core` rule (+ section-pack), loaded across the zones
  that touch it. **Not** a new skill.
- A new **artifact type** → a new authoring zone-skill. This is rare (the spec /
  system / flow trio is expected to be stable).

## Routing

A request finds its zone by three orthogonal questions:

- **Intent decides the door:**
  - "think it through / research it / what are the options" → `unikit-gd-explore`
    (the read-only internal-design lens: it thinks, returns a brief, and routes —
    it never writes a GDD).
  - "build it / add it" → `unikit-gd-spec` (which maps it and routes into the
    authoring zones).
  - "fix / tune / rework X" → the zone-skill that **owns** X (a system → `unikit-gd-system`,
    a flow → `unikit-gd-flow`, `GAME.md` → `unikit-gd-spec`).
- **Artifact decides the zone.** `GAME.md` → spec; `SYSTEM.md` → system; `FLOW.md`
  → flow. The artifact you are editing names its owner.
- **Domain rides as rules/packs.** A domain (e.g. `monetization-ethics`) loads
  into whatever zone touches it; it is spread across zones (Stance → spec · shop
  system → system · funnel events → flow), with the shared `core` rule as the
  single source of that knowledge. The domain never picks the door — the artifact
  does.

## Collaborative Protocol (User-Driven)

The user owns the vision and makes every creative decision. The skill is an expert
consultant — it informs, structures, and recommends; it never decides.

- Every design point follows **Question → Options → Decision → Draft → Approval**.
- **Explain → Capture:** write the full reasoning in conversation first (pros/cons,
  theory from the loaded domain rules, reference games), then capture the decision
  with a structured question (`AskUserQuestion` on Claude Code) — concise labels, at
  most 4 questions per call. Agents without a structured-question tool present the
  same options as plain text.
- Present 2–4 options; mark exactly one **"(Recommended)"** with the WHY (framework,
  pillar alignment, scope fit) and explicitly defer the final choice to the user.
- Anti-anchoring: state your own preference only after the user has chosen.
- On ambiguity, ask — never guess. "I don't know" from the user → offer 2–4
  defaults with a recommendation.
- **Files are written only by the main session, only after approval.** Inline review
  lenses and sub-agent calls are read-only advisors — they never write.
- Registry (`GD-IDS.yaml`) writes require the same approval as document writes;
  existing registry values are never changed silently. The `[gen]` maps in
  `GAME.md` are mechanical re-renders of approved `GD-IDS` state — never
  hand-authored — so they inherit that approval rather than carrying their own.
- Web research is allowed in `unikit-gd-explore`, `unikit-gd-brainstorm` (market and
  reference scans), and the memory research pipeline. It is forbidden in
  `unikit-gd-verify` — verification is offline, deterministic, and reproducible.

## Section-Cycle Contract (GDD Authoring)

`unikit-gd-system` writes through this single contract — it both fills skeletons
and edits approved content within its zone; the mechanics live here and are not
re-specified per skill. Section letters refer to the SYSTEM GDD template:
A Overview, B Player Fantasy, C Detailed Design, D Formulas, E Edge Cases,
F Dependencies, G Tuning Knobs, H Acceptance Criteria, I Telemetry,
J Accessibility, K Open Questions & Changelog.

1. **Skeleton first.** Create the document from its template with every section
   header and `[To be designed]` placeholders; one approval for the skeleton.
   Approved text is never overwritten silently: placeholders are filled, and edits
   to approved content are made, by the artifact's zone owner (`unikit-gd-system`
   for a `SYSTEM.md`) under the delta discipline below.
2. **Per section, in order:** Context (2–3 lines) → Questions → Options (2–4 with
   pros/cons and theory, one Recommended) → Decision → **Draft (full section text
   in the reply) → Approval in the SAME reply** — separating the draft from its
   approval is a protocol violation → Write (Edit anchored on the unique section
   heading).
3. **Write incrementally.** Persist each approved section immediately. The file is
   the only memory that survives a session — decisions live in files, not in chat.
4. **Registry check after C and D:** compare every number and name against GD-IDS
   facts. On mismatch, surface the conflict immediately and let the user resolve
   it: obey the registry / change the registry via a verify resolution / park it
   in section K (Open Questions).
5. **Terminology:** every new game term goes to GD-IDS `terms` — canonical English
   name, translation, forbidden aliases.
6. **Acceptance criteria (H)** derive semi-automatically from C, D, and E: one
   Given-When-Then per core rule and edge case, numbered `AC-<sys>-N`; numbering
   is stable — never reshuffled.

## One-Way Boundary (Design → Code)

Code reads design; design knows nothing about code.

- Game-design skills never read the code workspace (`.unikit/code/`), project
  sources, or build artifacts.
- The code side consumes design exclusively through the `## Design` section of its
  plan brief — SYS-id, version snapshot, verbatim AC quotes (and, for flow-aware
  planning, the read-only flow brief — see Flow Axis). There is no reverse flow:
  no design documents reconstructed from code, and no code-to-design sync
  **except the single `implemented` writeback below**.
- Importing an existing GDD is a document operation — extract from the provided
  document; never reverse-engineer design from an implementation.
- **Sanctioned exceptions (two, narrow):**
  - the **feasibility lens** inside `unikit-gd-review` may read `DESCRIPTION.md` /
    `ARCHITECTURE.md` to flag implementability risks (a design-reads-code-context
    read, never `.unikit/code/` or source);
  - the **`implemented` writeback** — the lone sanctioned **code→design write**:
    code-side `unikit-verify`, on all-AC-met for a cited `SYS-id`@version, writes
    `implemented_version` into `GD-IDS.yaml`. That is the **single** sanctioned write
    surface — there is no second one. The `## System Map [gen]` block in `GAME.md`
    re-renders the `implemented` state from `GD-IDS` (read-only); design never sets
    it and never reads code to learn it.

## Lifecycle & Status

Every system carries a `doc_status` recording how far its GDD has progressed. The
value lives in **two places that must always agree** — the document header (the
`> Status:` line in `SYSTEM.md`) and its `doc_status` field in `GD-IDS.yaml`. On
any disagreement **`GD-IDS.yaml` wins** (it is the machine truth); the conflict
surfaces through `unikit-gd-verify`. The `## System Map [gen]` block in `GAME.md`
**renders** each system's status read-only from `GD-IDS` — it is a generated view,
never an authored coherence surface (a stale render is a *freshness* conflict,
fixed by a re-render, not a status disagreement).

**System `doc_status` — the design-writable set, in order:**

| Status | Meaning | Set by | Next |
|---|---|---|---|
| `not-started` | mapped in the roster, no document yet | `unikit-gd-spec` | `skeleton` |
| `skeleton` | A–K headers + `[To be designed]` placeholders | `unikit-gd-system` | `detailed` |
| `detailed` | every section authored, facts registered | `unikit-gd-system` | `reviewed` / `revised` |
| `reviewed` | passed `unikit-gd-review` with no Critical/Major | `unikit-gd-review` (on approval) | `revised` |
| `revised` | edited after `detailed`/`reviewed`; **pending re-verify** | `unikit-gd-system` (edit) · `unikit-gd-verify` (flags a stale dependent) | `reviewed` (after re-review) |

- `not-started` carries **no version** — no `version` in GD-IDS (the
  `## System Map [gen]` shows `Ver —`). A version of `1` appears only from
  `skeleton` onward.
- `revised` is the "needs re-verify" state: a system stays `revised` until
  `unikit-gd-review` re-clears it back to `reviewed`.
- `approved` is **not** a system `doc_status` — it was merged into `reviewed`.
  The word "approved" elsewhere in this contract ("approved content", "approved
  edit", "after approval") means collaborative approval, not a status. `GAME.md`
  (`drafted | approved`) and `CONCEPT.md` (`exploring | drafted | approved`) keep
  their **own** lifecycle enums — those are not system `doc_status`.
- `doc_status: revised` (this lifecycle state) is distinct from the GD-IDS
  `revised:` **date field** (when a fact's value last changed). Status writers
  touch `doc_status` only; they never repurpose the `revised:` date as a status.

**Two values that design never writes as `doc_status`:**

- `deprecated` lives in the system's **`status` field** (`active | deprecated`),
  not in `doc_status`. `unikit-gd-spec` sets it on a remap; the document file and
  the GD-IDS entry are **kept** (never deleted — dangling references are verify
  conflicts). **Display precedence:** while `status: deprecated`, the
  `## System Map [gen]` Status shows `deprecated` regardless of the row's
  underlying `doc_status`.
- `implemented` is **code-set only** — the lone sanctioned code→design write,
  applied by the code pipeline (`unikit-verify` on all-AC-met — see One-Way
  Boundary) and **read-only** to every design skill. It is rendered (read-only) in
  the `## System Map [gen]` as a display value; design skills never set it and
  never read code to learn it. The version it pins lives in the `GD-IDS.yaml`
  `implemented_version` field (also code-set), not in `doc_status`.

**Who writes the two places.** The authoring skills — `unikit-gd-spec`,
`unikit-gd-system`, `unikit-gd-flow`, `unikit-gd-review` — write the status into
**both places** (the document header `> Status:` line in `SYSTEM.md` / `FLOW.md` and
the `GD-IDS` `doc_status` field) on every status change, so the spine stays
coherent; the `## System Map [gen]` / `## Flow Map [gen]` then re-render from
`GD-IDS`.

**Dependent-lag exception (intentional).** `unikit-gd-verify` is deliberately
**not** a full two-place writer. When it flags a *dependent* system as stale it
bumps that dependent to `revised` in the **GD-IDS `doc_status` only**, leaving the
dependent's document header to catch up on its next authoring touch. So a
verify-flagged dependent may transiently carry a header `Status` behind its GD-IDS
value — this is expected, and full header alignment for flagged dependents is a
later tier. The "both agree" invariant holds for every system **except** a
dependent caught between a verify flag and its next authoring edit.

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

## Delta Discipline

Every authoring zone applies this discipline to edits **within its own zone** — it
is zone-agnostic, owned here once, and never re-specified per skill. Every edit to
an approved design document is made by that artifact's zone owner
(`unikit-gd-system` for a `SYSTEM.md`, `unikit-gd-flow` for a `FLOW.md`,
`unikit-gd-spec` for `GAME.md` — see the carve-out below). A manual `.md` edit
without a version bump and changelog entry is an **unrecorded delta**: the planning
side sees the same version and assumes the code is current. The design→plan loop is
only as honest as your use of it.

The mandatory tail of every design edit:

1. **Version +1** in the document header and in the system's `version` in `GD-IDS`.
2. **Changelog block** appended to section K:

   ```markdown
   #### v<N> — <YYYY-MM-DD> — <essence of the change> (DD-<n>)
   - <Section>: <what changed>
   - AC: + AC-<sys>-7, AC-<sys>-8 (new); AC-<sys>-3 changed; **AC-<sys>-5 removed**
   - Affected (gd-verify): <systems with Still Valid / Needs Review / Likely Stale verdicts>
   ```

   Mandatory elements: version, date, essence, DD reference for significant
   decisions; one line per affected section; the **AC delta line** (new / changed /
   removed) — the planning side consumes exactly this line to build delta plans.
   The "Affected" line is appended by `unikit-gd-verify`, never by the editor — it
   is a **human-readable record** of the impact pass, not the mechanism that
   re-checks dependents. The pending-loop is driven by each system's own `Status:
   revised`: the editing zone owner (`unikit-gd-system`) marks **only the system it
   edited** `revised`, and `unikit-gd-verify` marks affected **dependents**
   `revised` (verdict-gated — see Lifecycle & Status). A `revised` system stays in
   the loop until `unikit-gd-review` clears it back to `reviewed`.
3. **Registry check:** new numbers vs GD-IDS facts — conflicts surface, they never
   silently win.
4. Recommend `unikit-gd-verify` (changed scope) after the edit.

**GAME.md exception (not a system).** An edit to `GAME.md` bumps the version
**only** in the GAME.md header `> **Version**:` line — GAME.md has no
`GD-IDS.yaml` `systems` row, so the "and in the system's `version` in `GD-IDS`"
part of step 1 does not apply. It appends a **light** block to GAME.md's own
`## Changelog` (version, date, essence, one line per changed section) — **no**
AC-delta line and **no** `Affected (gd-verify):` line, since those are SYSTEM GDD
fields. Its status stays `drafted | approved`; it is **never** set to `revised`,
and there is no two-place coherence and no pending-loop. `unikit-gd-spec`
implements this carve-out — `GAME.md` is its zone — this is the canonical
statement.

A significant decision also gets a **DD record** in GD-IDS `decisions`: the options
considered, the rationale, and the affected systems (decision-log practice —
Nygard).

GD-IDS stores **current values only**; history lives in changelog blocks and git.

## Facts Registry & ID Conventions

`GD-IDS.yaml` is the single source of truth for numbers, names, and decisions.
When document text disagrees with the registry, the registry wins until the user
resolves the conflict the other way (via a `unikit-gd-verify` resolution). The
user is the arbiter of every conflict.

| Prefix | Meaning | Recorded in |
|---|---|---|
| `PIL-<n>` | Pillar | GAME.md + GD-IDS `pillars` |
| `SYS-<slug>` | System | GD-IDS `systems` (rendered in GAME.md `## System Map [gen]`) |
| `FLOW-<slug>` | Flow (player-action scenario) | GD-IDS `flows` (rendered in GAME.md `## Flow Map [gen]`) |
| `ENT-<slug>` | Entity with facts (stats) | GD-IDS `entities` |
| `FORM-<slug>` | Formula | GDD section D + GD-IDS `formulas` |
| `AC-<sys>-<n>` | Acceptance criterion (system) | GDD section H |
| `GOAL-<flow>-<n>` | Flow objective (scenario step) | FLOW.md table + GD-IDS `flows` |
| `DD-<n>` | Design decision | GD-IDS `decisions` |

- IDs are English lowercase slugs, stable across versions.
- Never delete an ID — mark it deprecated. Dangling references are verify
  conflicts.
- Every registry fact carries its `source` — the system that owns it.

## Provenance (imports)

When a system GDD is built by importing an existing document (the
`unikit-gd-system` import path), each section records where its content came from,
so a later review can hold inferred material to a higher bar than author-sourced
material. The markers are HTML comments placed directly under the section heading
they describe:

- `<!-- provenance: extracted from SOURCE.md -->` — the section's content was
  lifted from the imported source document (verbatim or lightly edited). It is
  trusted as author-sourced; review does not second-guess it on provenance grounds.
- `<!-- provenance: generated -->` — the section had no counterpart in the source
  and was inferred to complete the skeleton. It carries no author authority; the
  provenance lens (`unikit-gd-review`) holds every generated claim against the
  source and the registry at **≥ Major**.
- **Untagged is normal authored content** — a section with no provenance marker is
  ordinary collaborative authoring (the non-import default). Absence of a marker is
  never itself a finding. **Drafts seeded from a `unikit-gd-explore` internal-design
  lens brief are untagged normal authored content too** — the lens is collaborative
  authoring carried out in research, not an import, so `unikit-gd-system` leaves its
  explore-seeded section drafts and deltas **unmarked**: the `extracted` /
  `generated` markers belong to the import path alone.

Rules:

- `unikit-gd-system` writes the markers on import (one per section that needs one);
  the regular collaborative authoring path leaves sections untagged.
- **Explore research is an allowed authoring source.** `unikit-gd-explore` research
  may seed `unikit-gd-system` and `unikit-gd-flow` section drafts and deltas (a
  generalization of the import-reading path) — discovered by the `GD-IDS` `research:`
  pointer (authoritative) → `researches/INDEX.md` `Target:` (fallback). The system
  `research:` pointer is owned by `unikit-gd-spec` (written in add-system); the flow
  `research:` pointer (under `flows[]`) is owned by `unikit-gd-flow` (there is no
  add-flow in spec — the flow zone registers itself). Either is a **non-id path**,
  inert to `unikit-gd-verify` coherence, and the seeded artifact's **lifecycle is
  unchanged** — it stays `not-started` until its zone owner authors it.
- An edit **never strips a provenance marker** — it may change a generated
  section's content, but the marker survives so its origin stays auditable across
  versions. Promoting `generated` → `extracted` is a deliberate, recorded act,
  never a silent side effect of editing.
- Markers are **inert to the code side** — they are HTML comments, never parsed by
  the plan brief or any code-module skill; they live entirely inside the design
  layer.

## Language

- Design artifacts follow the configured artifact language; conversation follows the
  configured UI language (see `.unikit/system/LANGUAGE_RULES.md`). The general
  **"translate the concept, not the label"** rule — no transliterating jargon, no
  mid-sentence code-switching — lives there and applies to every skill; this section
  adds only the game-design specifics.
- **Always English — but only stored identifiers and machine values, never
  vocabulary:** IDs (`PIL-*`, `SYS-*`, `ENT-*`, `FORM-*`, `AC-*`, `DD-*`), MDA
  aesthetic names, formula expressions and variables, telemetry event names, and the
  literal **field values** stored in artifacts (e.g. `market_signal: red-ocean`,
  `validation_confidence: B`). These are parsed or referenced as stable tokens, so
  they never translate. The list is exhaustive — "keywords" and "canonical terms"
  are *not* a licence to keep arbitrary jargon English. A stored `market_signal:
  red-ocean` field in the card is correct; the same words spliced into chat are not —
  render them in the user's language.
- **Numbers live in tables, intent lives in prose.** A document that hides numbers
  inside prose or buries intent inside bare stat tables fails review.

## Critique Stance (Braintrust)

Reviews follow the Pixar Braintrust model (Catmull): the room has no authority —
the user decides; honesty over politeness, about the work, never the person.

- **Diagnose, don't prescribe:** name the problem and the evidence ("FORM-damage's
  output range contradicts PIL-2's design test"), not your solution.
- Prescriptions are opt-in: offer "what if…" suggestions (plussing — d.school
  "I like / I wish / What if") only when the user asks for them.
- Critique (iteration on a draft) and review (verdict on a finished document) are
  different activities — never blur them (Connor & Irizarry). A verify conflict
  cannot be "declined"; a review finding can.
- Name what works ("I like…") — honest calibration, not flattery.

## Severity Rubric

The single source of truth for finding severity, shared by `unikit-gd-review`
(quality verdicts), `unikit-gd-verify` (consistency conflicts), and the domain
memory rules that grade their own findings (notably `balance` and
`monetization-ethics`). Lenses and review report structure live in
`unikit-gd-review`; this file owns only the rubric so there is one definition.

| Severity | Meaning | Examples |
|---|---|---|
| **Critical** | blocks handoff | contradicts a pillar or a registry fact; unimplementable; hole in core rules; dominant strategy; monetization-ethics violation |
| **Major** | risk if unaddressed | ambiguous rule; empty section; missing edge case; untestable AC; terminology drift |
| **Minor** | text quality | missing example; weak rationale |
| **Suggestion** | "what if…" (plussing) | never blocks; offered, not required |

- Severity attaches to **evidence, not taste**: a finding cites the document
  section AND the contradicted fact, pillar, or rule. No citation → it is an
  opinion; downgrade it to Suggestion.
- **Required before implementation** = all Critical + Major findings; Minor and
  Suggestion items go to a separate, explicitly non-blocking list.
- A verify conflict cannot be declined; a review finding can. The severity is
  advisory input to the user's Status decision (recorded in `GD-IDS` `doc_status`,
  rendered in the `## System Map [gen]`) — it never auto-applies.

## Anti-patterns

- Writing or editing any artifact without an explicit approval.
- Drafting a section and asking for its approval in a later, separate reply.
- Manual edits to approved documents bypassing the owning zone's delta discipline
  (unrecorded delta).
- A design skill reading `.unikit/code/` or project sources.
- Changing a GD-IDS value silently because "the document says otherwise".
- Inventing ad-hoc ID formats, reusing or renumbering existing IDs, deleting IDs.
- Prescribing solutions in a review nobody asked for.
- Severity inflation: filing a taste disagreement as Critical, or a finding with
  no section-and-evidence citation above Suggestion.
- Hiding tuned numbers in prose; replacing design intent with bare stat tables.
- Putting a domain (monetization, liveops, level design) into a new skill instead
  of a `core` rule + section-pack; or splitting one artifact across two zones.
