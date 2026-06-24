---
name: unikit-gd-flow
description: >-
  Author and own one flow's design document (the FLOW.md objective flow) at
  .unikit/gamedesign/flows/FLOW-<slug>.md — the dynamics layer of the GDD (what the player
  does over time). Create the skeleton and walk the collaborative section-cycle to write its
  objectives, pacing, dependencies, and funnel events ("design the first-session flow", "map
  the onboarding sequence", "write the FLOW for the boss encounter"), AND revise it after
  approval under the delta discipline ("retune the pacing", "add a branch", "change a GOAL",
  "rework the onboarding") — a cue/number change is Tuning, a small step change a Tweak,
  restructuring a Rework; each bumps the version and appends a changelog. Selects the wiring
  mode (linear | conditional | emergent) and re-renders the ## Flow Map [gen] / ## Funnel
  [gen] blocks in GAME.md. To add or detail a system use /unikit-gd-system; to edit GAME.md
  content use /unikit-gd-spec; to apply a multi-zone edit use /unikit-gd-apply; for a new
  game concept use /unikit-gd-brainstorm.
argument-hint: "<flow name | FLOW-slug> [\"<what to change>\"]  (mode inferred from doc state + intent; no flags)"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(date *)
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: game-design
---

# Game Design — Per-Flow GDD (Authoring & Revision)

Own **one flow's design document** at `.unikit/gamedesign/flows/FLOW-<slug>.md` —
the **dynamics** axis of the GDD (what the player does over time), alongside the
system GDDs (the rules) and `GAME.md` (the whole). This skill owns the **flow zone**
(`gd-principles` → Zone Ownership): the **full lifecycle** of a `FLOW.md` lives here
— **create** the skeleton, **fill** its placeholders, and **revise** approved
content (Tuning / Tweak / Rework) under the delta discipline. There is no separate
editor skill.

A flow registers **itself**: this skill writes the flow's own `GD-IDS.yaml` `flows:`
and `events:` entries and re-renders the `## Flow Map [gen]` / `## Funnel [gen]`
blocks in `GAME.md` — there is **no add-flow in `unikit-gd-spec`**. It never authors
a system, never edits the `GAME.md` one-pager content, and never adds a system to the
roster — those are `unikit-gd-system` and `unikit-gd-spec`.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and artifacts (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English. Do not announce the language setting.

## Phase 0 — Bootstrap

Silently load — do not narrate:

1. **`.unikit/system/gamedesign/gd-principles.md`** (the core) — the collaborative
   protocol, the facts registry / ID conventions, and the language rules. Plus, from
   the same `gamedesign/` folder, the shards this skill needs: **`gd-authoring.md`**
   (the **section-cycle authoring contract** + the **delta discipline** — the
   mandatory Version +1 → changelog → registry-check → recommend-verify tail),
   **`gd-lifecycle.md`** (the lifecycle & status spine), **`gd-flow-axis.md`** (the
   **Flow Axis** contract — the `AC · GOAL · event` grammar, flow lifecycle, wiring
   mode, cross-axis staleness, Win/Lose ↔ terminal GOAL), and **`gd-provenance.md`**
   (the explore-seed / import provenance markers). This skill **applies** that
   contract; it does not restate the mechanics. If missing, warn (`unikit-ai update`)
   and fall back to the protocol as summarized in this file.
2. **`.unikit/gamedesign/GAME.md`** — pillars, loops, target aesthetics, win/lose
   intent, and non-goals the flow must serve; its `## System Map [gen]` is the system
   roster the flow's `GOAL`s depend on. If it does not exist, **stop** — there is no
   master spec yet. Read `.unikit/gamedesign/concepts/INDEX.md` (if it exists) to route
   precisely: a `drafted`/`approved` concept present → recommend `/unikit-gd-spec`
   (build the master spec from it); no concept — or no `concepts/INDEX.md` (or no
   `concepts/` dir) at all → recommend `/unikit-gd-brainstorm` first, then
   `/unikit-gd-spec`.
3. **`.unikit/gamedesign/GD-IDS.yaml`** — find the target flow's entry under `flows`.
   If there is **no entry**, this is a new flow: a flow registers itself, so author it
   here (Create — Phase 3 writes the `flows:` row). The `GOAL`s a new flow needs may
   reference systems that are **not yet on the map**; that crossing into the *system*
   roster routes back to `/unikit-gd-spec` add-system (see the re-entry seam in
   Phase 4) — never write a `systems:` row here.
4. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — load the **core** domain rules
   for this flow's **purpose**, on demand by `Load When`, plus any studio `library`
   rule on the same topic. Read the purpose from the flow's name and Overview (the
   dynamics it shapes), **not** from a coarse label; when the purpose is ambiguous,
   confirm the domain with one `AskUserQuestion` rather than guessing. Domains are
   opt-in and combinable — a flow may match more than one. Every flow shapes
   **pacing + guidance**, so `core-loops` is always relevant; `ux-onboarding` rides
   along whenever the flow teaches or guides:

   | Flow purpose | Core rules to load |
   |--------------|--------------------|
   | onboarding / first session | `ux-onboarding`, `core-loops` |
   | core loop / session arc | `core-loops`, `player-motivation` |
   | progression / mastery arc | `progression`, `core-loops` |
   | combat / encounter | `balance`, `frameworks` |
   | economy / shop funnel | `economy`, `monetization-ethics` |
   | narrative / quest | `narrative` |
   | level / mission | `level-design` |
   | liveops / event | `liveops`, `player-motivation` |
   | meta / retention | `player-motivation`, `liveops` |

   Obey the index's **Rule-Loading Discipline**: load by `Load When`, load a reference
   only from its parent rule's `> **References**:`, and **never glob the memory tree**
   (`.unikit/memory/gamedesign/**`) to discover rules.

5. **`.unikit/RULES.md`** (if present) — project overrides, highest priority.
6. **Schema guard (clean break — no automatic migration).** `GD-IDS.yaml` MUST be
   `version: 2`. If it is still `version: 1`, **STOP** and report: the design
   workspace is on the pre-v2 layout — v2 dropped the standalone markdown
   system-index and now renders the system, flow, and funnel maps into `GAME.md`
   (`## System Map [gen]` / `## Flow Map [gen]` / `## Funnel [gen]`); there is no
   automatic migration. Tell the user to bump `GD-IDS.yaml` to `version: 2` and fold
   the legacy index rows into GAME.md's `[gen]` maps before re-running.

**One-way boundary:** never read `.unikit/code/`, project source, or build
artifacts. Flow is a *read target* for the code side, never a writeback surface — a
flow's "realized" state is **derived**, never written here.

## Phase 1 — Context

Gather the facts the flow must stay consistent with (read-only):

- **Known facts** from `GD-IDS.yaml` — pillars (the flow serves them), the systems
  in `systems` (a `GOAL` exercises a system through `GOAL → SYS`, refined to
  `GOAL → AC`), and terms already locked. These are constraints, not suggestions.
- **Exercised system GDDs** — for each system this flow's `GOAL`s touch, read its
  header and sections **C (Detailed Design)**, **H (Acceptance Criteria)**, and
  **B (Player Fantasy)** so each `GOAL` lands on a real rule/AC and the promised
  feeling is grounded. A `GOAL` aimed at a missing or deprecated system is a
  registry gap (route it through `unikit-gd-spec` add-system — Phase 4).
- **Recent `unikit-gd-verify` reports** for this flow, if any
  (`.unikit/gamedesign/reviews/`).
- **Explore research (internal design lens)** — if this flow was seeded from a
  `unikit-gd-explore` brief, discover the research **deterministically** (survives a
  `/clear`): read the flow's `GD-IDS` `flows[].research:` pointer (authoritative),
  falling back to the `researches/INDEX.md` entry whose `Target:` is this
  `FLOW-<slug>`. Read that research's `RESEARCH_BRIEF.md` → **`## Flow Feature Plan`**
  block and use its objective/pacing/dependency **seeds** as the *starting drafts*
  for the section-cycle — the per-section approval still applies; a seed is a draft,
  not an approved write. For a **revision** (Edit), the matching block is
  **`## Flow Improvement Plan`** — its ready-to-apply delta lines, expected scale,
  touched `GOAL`s/systems, and any `RF-<date>-n` it closes pre-fill the change set
  (the user still approves every edit). These explore-seeded drafts are **untagged
  normal authored content** (`gd-provenance` → Provenance) — the import-only
  `extracted` / `generated` markers do not apply to flows.

## Phase 2 — Resolve Mode from Document State + Intent (no flags)

Check `.unikit/gamedesign/flows/FLOW-<slug>.md` and read the intent in the prompt:

1. **Does not exist** → **Create**: select the wiring mode (below), build the
   skeleton (Phase 3), then author from section A.
2. **Exists** and the prompt describes a **change to approved content** (a goal,
   pacing beat, dependency, event, or the wiring mode: "retune the pacing", "add a
   branch", "change a GOAL", "rework the onboarding") → **Edit**: classify the scale
   and apply the delta (Revision below). Approved text is changed **only** through
   this path.
3. **Exists with `[To be designed]` placeholders** and the intent is to continue /
   fill (or no change is described) → **Fill**: resume from the **first** placeholder.
   Approved text is **never overwritten** — only placeholders are filled. Skip Phase 3.
4. **Exists, complete, no change described** → authoring is done; nothing to write.
   Offer review / verify (Phase 6) and stop.

If the flow name is ambiguous (matches several entries, or none) → `AskUserQuestion`
listing candidates. Never guess the target.

### Wiring mode (`linear | conditional | emergent`) — select on Create

The mode dictates the document's structure (`gd-flow-axis` → Flow Axis), so it is
chosen **before** the skeleton:

- **Infer** a candidate from `GAME.md` genre / pillars / loop stack: a fixed tutorial
  or scripted sequence → `linear`; a flow that branches on world/player state →
  `conditional`; a sandbox / open objective the player sets themselves → `emergent`.
- **Explain → Capture:** state the candidate and the trade-offs (linear = authored
  control, low replay; conditional = reactive, more branches to balance; emergent =
  high agency, hardest to pace), then confirm with one `AskUserQuestion` — never
  assume on ambiguity.
- **Record `mode:`** in the `GD-IDS.yaml` `flows[]` entry and in the `FLOW.md` header
  `> Mode:` token. `unikit-gd-verify` checks `mode:` ↔ the document's structure (the
  objective-flow table for linear/conditional, the affordance template + pacing
  envelope for emergent) — exactly as it checks a system's `packs:` ↔ `## Pack:`. A
  mode change is an ordinary delta step (Revision).

---

## Authoring (Create / Fill)

### Phase 3 — Skeleton (Create mode only)

Write the file from the FLOW template with **every** section header A–F present and
a `[To be designed]` placeholder under each; choose section B's form from the wiring
mode. Get **one approval** for the skeleton; a refusal sets `doc_status` `skeleton`
and stops (BLOCKED).

FLOW GDD structure (header + sections — author in this order):

```
# <Flow Name> — FLOW-<slug>
> Status: skeleton · Mode: <linear|conditional|emergent> · Version: 1 · Last Updated: <date>
```

| § | Section | What it holds |
|---|---------|---------------|
| A | Overview | One short paragraph: the player situation that triggers the flow, the intended experience across it, the pillar(s) it serves, and why the `Mode` fits. |
| B | Objective Flow | **Mode = linear/conditional →** objective-flow table, one `GOAL` per row (Trigger → Expected action → Success/feedback → Beacon (opt.) → Event). **Mode = emergent →** affordance / goal-template (a set of `GOAL`s with no fixed order). |
| C | Pacing | **linear/conditional →** tension-by-beat table (Low/Med/High, what drives each). **emergent →** pacing envelope (tension floor/ceiling + what pulls a drifting player back). |
| D | Dependencies | The systems the `GOAL`s exercise (`GOAL → SYS`, refined to `GOAL → AC`); must agree with the `GD-IDS` `depends_on` (rendered in `## Flow Map` Depends) and each exercised system's H. A `GOAL` at a missing/deprecated system is a verify conflict — route it through `unikit-gd-spec` add-system, never invent the roster row here. |
| E | Events (Funnel) | The analytics events the flow emits — the third altitude of `AC · GOAL · event`. Each is registered in `GD-IDS` `events` and aggregated read-only into `## Funnel [gen]`. Event names are English `snake_case`. |
| F | Open Questions & Changelog | open questions (owner/when); changelog blocks (added by this skill on a revision; the `Affected (gd-verify):` line is appended by `unikit-gd-verify`). |

### Phase 4 — Section-Cycle (A → F)

Author each section in order through the **section-cycle contract from
`gd-authoring`**: Context (2–3 lines) → Questions → Options (2–4 with pros/cons and
theory from the loaded domain rules, one **(Recommended)** with the WHY) → Decision
(Explain → Capture, `AskUserQuestion`) → **Draft + Approval in the SAME reply**
(separating them is a protocol violation) → Write (Edit anchored on the unique
section heading). Persist each approved section immediately — the file is the only
memory that survives the session.

Section-specific logic (the rest is the generic cycle):

- **B / Objective Flow** — one `GOAL-<flow>-<n>` per row; numbering is **stable**,
  never reshuffled. **Two heights (discovery → detail):** at skeleton, point each
  `GOAL` at the **systems** it needs (`GOAL → SYS`) — this early mapping surfaces
  missing systems and leads the system map; once those systems reach `detailed`,
  refine the pointer to the specific **acceptance criterion** (`GOAL → AC-<sys>-n`).
  Every `GOAL` states its success/feedback (how the game confirms the player did it);
  a `GOAL` with no confirmation is a guidance gap. Keep section B's shape matched to
  the header `> Mode:`.
- **Terminal `GOAL` ↔ Win/Lose (C5).** A `GOAL` that **ends the run** realizes a
  `GAME.md` `## Win / Lose Conditions` line. The author's win/lose intent lives in
  `GAME.md` (`unikit-gd-spec`'s zone) and exists before any flow; the machine link is
  the **`GOAL-<flow>-<n>` citation in that Win/Lose line**. This skill does not edit
  `GAME.md` — when a terminal `GOAL` realizes a win/lose condition, surface a
  **re-entry seam** (below) to `/unikit-gd-spec` to add the citation, then
  `unikit-gd-verify` links the two (no orphan conditions, no orphan terminal goals).
- **C / Pacing** — make the tension arc explicit (a per-beat table for
  linear/conditional, an envelope for emergent). A flat line is a finding: the
  sequence must rise and release. Ground the beats in the loaded `core-loops` /
  `player-motivation` rules.
- **D / Dependencies + registry check** — list each exercised system and the `GOAL`
  that needs it; this set MUST equal the `GD-IDS` `flows[].depends_on`. Compare every
  `GOAL → SYS` / `GOAL → AC` against the known facts from Phase 1. On a mismatch or a
  missing system, surface it **immediately**: obey the registry / route the new
  system through `unikit-gd-spec` add-system / park it in section F. Never silently
  invent a roster row.
- **E / Events** — register each funnel event in `GD-IDS` `events` (id, name,
  `flow:` back-pointer, source). An event lives where its question lives: a
  flow/funnel step → here; a system's own internal metric → that system's section I;
  a global/meta metric → `GAME.md` `## Monetization Stance`. Instrument every
  retention/conversion-critical `GOAL` — a critical step with no event is a blind
  funnel step.

**Re-entry seam (a `GOAL` crosses into the system roster).** When a `GOAL` needs a
system that is **missing or deprecated**, or a **terminal `GOAL`** needs its `GAME.md`
Win/Lose citation, do **not** write the roster or the one-pager silently. Ask the
user (add the system / pick another / defer), then route:

```
This GOAL crosses into the system roster / GAME.md one-pager, which the flow zone
does not write. Use:
- a missing system a GOAL exercises   → /unikit-gd-spec (add-system) → then detail it via /unikit-gd-system
- a terminal GOAL's win/lose citation → /unikit-gd-spec (GAME.md content edit)
```

This is the active seam — offer it in the same session and continue once resolved.

In **Fill mode**, run the cycle only for the placeholder sections, in order from the
first remaining `[To be designed]`; leave approved sections untouched.

### Phase 5 — Registry & State (write `flows:` / `events:`, then re-render the maps)

After the sections are authored:

1. **Write the `GD-IDS.yaml` `flows[]` entry** (the flow's machine truth — the flow
   registers itself): `id: FLOW-<slug>`, `name`, `status: active`, `mode`,
   `doc_status`, `version`, `depends_on` (the `SYS` ids from section D), `goals:` (one
   `GOAL-<flow>-<n>` per row — `id`, `summary`, `targets:` the `SYS`/`AC` it
   exercises), `research:` (the explore-research folder if seeded — a non-id path;
   owned here, not by `unikit-gd-spec`), `source: flows/FLOW-<slug>.md`, `added`. Write
   each funnel event under `events[]` (`id`, `name`, `status`, `source`, `flow:`).
   Get approval before the write; existing values are never changed silently; every
   fact carries its `source` (`gd-principles` → Facts Registry).
2. **Update state:** set the flow's status → `detailed` in the **two places that must
   agree** — the `FLOW.md` header `> Status:` token and the `GD-IDS.yaml` `doc_status`
   — so the spine stays coherent (`gd-lifecycle` → Lifecycle & Status). Set
   `version: 1` (header + `GD-IDS`). Append the initial changelog block to section F
   (`#### v1 — <date> — initial design` with the `GOAL: + GOAL-<slug>-1 … N (new)`
   line and `Affected (gd-verify): —`).
3. **Regen-on-write — re-render the maps (B1).** As the last step, re-render
   `GAME.md`'s `## Flow Map [gen]` and `## Funnel [gen]` blocks from `GD-IDS`
   (the `RULES_INDEX` render model): replace **only** the content between
   `<!-- gen:flow-map -->` / `<!-- /gen:flow-map -->` and between
   `<!-- gen:funnel -->` / `<!-- /gen:funnel -->` — **never** touch the authored
   one-pager above, and **never** the `## System Map [gen]` block (that is
   `unikit-gd-spec`'s render).
   - **Flow Map** — one row per `flows[]` entry, grouped by wiring-mode
     (Linear/Conditional, Emergent): `ID | Flow | Mode | Status | Ver | Depends (SYS) |
     Realized | Doc`. `Status` mirrors `doc_status` (plus `deprecated` from the
     `status` field); `Ver` is `—` until `skeleton`.
   - **`Realized` is DERIVED, never written:** `yes` once **every** system in the
     flow's `depends_on` carries a non-empty `implemented_version` in `GD-IDS`
     (the code-set field), else `no`. It is computed from the systems' state on each
     render — there is no `implemented` field on flows.
   - **Funnel** — one row per `events[]` entry: `Order | Event | Flow | Measures`,
     ordered by funnel position.

---

## Revision (Edit) — Change an Approved Flow

The doc exists and the user wants to **change approved content**. This is the
**single sanctioned way** to record a design change to a flow: a manual `.md` edit
without a version bump and a changelog entry is an **unrecorded delta** — the
planning side sees the same version and assumes the code is current
(`gd-authoring` → Delta Discipline). The flow has a code contract and cross-axis
staleness, so its delta discipline is **full** (not the GAME.md light carve-out).

### Classify the scale (from the description)

Infer the change scale from the user's description. Announce the inferred scale in
one line, then proceed:

| Scale | Trigger | How it is applied |
|-------|---------|-------------------|
| **Tuning** | a cue / number / beat changes ("retune the pacing", "move the beacon", "shift the climax later") | targeted `Edit` to section C and/or B; one approval |
| **Tweak** | a small step change with **no new branch/goal** | targeted `Edit` to the affected section; one approval |
| **Rework** | restructuring the flow ("rework the onboarding", "add a branch", "redo the goal order"), or a **mode change** | derive affected sections → confirm → section-cycle, old-vs-new per section |
| **Structural** | a **new system** a `GOAL` needs, a change to the system map, or a `GAME.md` content/pillar/win-lose change | **REDIRECT** — the flow zone never writes the system roster or `GAME.md` content |

When the scale is unclear between two levels (e.g. a "tweak" that actually adds a new
`GOAL` or branch → Rework), ask rather than assume.

### Apply the change

**Tuning / Tweak — targeted edit**
1. Show the **old → new** for each goal/beat/cue changing, with the WHY (theory from
   the loaded rules, pillar alignment) — Explain → Capture.
2. Get **one approval** (`AskUserQuestion`).
3. `Edit` the affected section(s) anchored on the unique heading. Approved text
   elsewhere is never touched.

**Rework — section-cycle (old-vs-new)**
1. Derive the affected sections from the description (e.g. "add a branch" → B
   Objective Flow, C Pacing, maybe D Dependencies) and **confirm the set** before
   editing. A **mode change** restructures section B (table ↔ affordance template)
   and section C (beats ↔ envelope) — update the `> Mode:` header + `GD-IDS` `mode:`
   together.
2. For each affected section, in order, run the **section-cycle contract** with the
   section's **current content as the starting draft**: Context → Questions →
   Options (2–4, pros/cons, theory, one **(Recommended)**) → Decision → present
   **old vs new** + Approval **in the same reply** → Write (Edit anchored on the
   heading). Persist each approved section immediately.
3. **Registry check** (`gd-authoring`): every new `GOAL → SYS`/`AC`, dependency, and
   event vs `GD-IDS` facts; conflicts surface immediately — obey the registry / route
   a new system through `unikit-gd-spec` add-system / park it in section F. Never
   silently override.
4. Re-derive any affected **goals**: new `GOAL`s get the next stable number; changed
   `GOAL`s keep their id; obsolete ones are marked removed (numbers are never reused).
   The `GOAL` delta feeds the changelog line below.

**Structural — redirect (does not edit)**
The flow zone does not write the system roster or `GAME.md` content. Redirect and
STOP:

```
This is a structural change (new system / map composition / GAME.md content),
which is outside /unikit-gd-flow. Use:
- a new system a GOAL needs          → /unikit-gd-spec (add-system) → then detail it via /unikit-gd-system
- the system map or a GAME.md edit   → /unikit-gd-spec
```

### Delta tail (MANDATORY — `gd-authoring`)

Every Tuning / Tweak / Rework edit ends with the full tail; this is non-optional:

1. **Version +1** in the `FLOW.md` header **and** in the flow's `version` in
   `GD-IDS.yaml`. Set the flow's status → `revised` in the **two places that must
   agree**: the `FLOW.md` header `> Status:` token and the `GD-IDS.yaml` `doc_status`
   (`gd-lifecycle` → Lifecycle & Status).
2. **Changelog block** appended to section **F** — format owned by `gd-authoring`:

   ```markdown
   #### v<N> — <YYYY-MM-DD> — <essence of the change> (DD-<n>)
   - <Section>: <what changed>
   - GOAL: + GOAL-<flow>-3 (new); GOAL-<flow>-2 changed; **GOAL-<flow>-1 removed**
   ```

   The **GOAL-delta line** (new / changed / removed) is the flow counterpart of a
   system's AC-delta line — the planning side consumes it to build delta plans. Add
   an **event delta** line when funnel events change. The `Affected (gd-verify):` line
   is appended later by `unikit-gd-verify`, never here — it is a **human-readable
   record** of the impact pass. When the edit **closes a `unikit-gd-review` finding**,
   cite its stable id in the essence: `… (DD-3; RF-2026-06-14-2)`. The pending-loop is
   driven by `Status: revised` itself: this skill marks **only the edited flow**
   `revised` (step 1); `unikit-gd-verify` marks affected **dependents** `revised`
   (cross-axis, verdict-gated). Each stays in the loop until `unikit-gd-review` clears
   it back to `reviewed`.
3. **Registry check:** new `GOAL`s / dependencies / events vs `GD-IDS` facts —
   conflicts surface, they never silently win. A significant decision also gets a
   **`DD-<n>`** record in `GD-IDS.yaml` `decisions` (options, rationale, affected
   systems/flows).
4. **Re-render the maps** (the regen-on-write step from Phase 5 — `## Flow Map [gen]`
   + `## Funnel [gen]`, `[gen]` blocks only), then **recommend `unikit-gd-verify`**
   (changed scope) — it computes cross-axis impact on dependent flows, appends the
   `Affected` line, and re-renders any stale `[gen]` block (freshness).

---

## Phase 6 — Handoff

Recommend the next steps (do not auto-invoke):

```
AskUserQuestion: FLOW-<slug> is <detailed | revised to vN>. What's next?

Options:
1. Verify consistency & impact — /unikit-gd-verify FLOW-<slug> (recommended)
2. Review it — /unikit-gd-review flows/FLOW-<slug>.md (fresh session)
3. Detail an exercised system — /unikit-gd-system <SYS-slug>
4. Nothing — I'll continue later
```

A review is most independent in a **fresh session** (the reviewer should not have
authored the doc). `unikit-gd-verify` checks the flow against the registry, flags
dependent flows on cross-axis staleness, and refreshes the `## Flow Map [gen]` /
`## Funnel [gen]`.

## Final: Compact Report

```
Flow: FLOW-<slug> — <name>
Mode: <linear | conditional | emergent>
Action: <create | fill | edit (tuning|tweak|rework)>
Doc: .unikit/gamedesign/flows/FLOW-<slug>.md (Status: <skeleton|detailed|revised>, vN)
Registry: +<G> goals, +<E> events, depends_on [<SYS-ids>]  (GD-IDS.yaml)
Goals: GOAL-<slug>-1 … GOAL-<slug>-N   [GOAL delta on an edit: +<n> / changed <n> / removed <n>]
Maps: ## Flow Map [gen] + ## Funnel [gen] re-rendered
```

No summary document, no report file.

## Ownership Boundaries

- **Owns:** the **full lifecycle** of `flows/FLOW-<slug>.md` — creating the skeleton,
  filling placeholders, **and revising approved content** (Tuning / Tweak / Rework,
  with the version bump + changelog + `revised` status); the flow's `GD-IDS.yaml`
  facts (`flows[]` incl. `goals`, `mode`, `depends_on`, `research:`, and the flow's
  `events`) and its `doc_status` / `version`; the wiring-mode selection; and the
  **re-render** of the `## Flow Map [gen]` and `## Funnel [gen]` blocks in `GAME.md`
  (the `[gen]` regions only).
- **Not this skill:** systems → `unikit-gd-system`; the system roster, the `GAME.md`
  one-pager content (pillars, win/lose intent, monetization stance) **and** its
  `## System Map [gen]` render → `unikit-gd-spec`; quality verdicts →
  `unikit-gd-review`; consistency & cross-axis impact → `unikit-gd-verify`.
- **Never:** write, fill, or edit without approval; overwrite approved text outside
  the delta discipline; skip the version bump or changelog on an edit (unrecorded
  delta); change a `GD-IDS.yaml` value silently; delete or renumber an ID; write the
  `systems:` roster or the `GAME.md` one-pager content; touch the `## System Map
  [gen]` block; read the code workspace or project source.

## Quick Reference

```
/unikit-gd-flow FLOW-first-session                      → select mode + create skeleton + author A–F (if no doc yet)
/unikit-gd-flow first-session                           → resolve to the FLOW-slug; same flow
/unikit-gd-flow FLOW-first-session                      → resume filling placeholders (partial doc)
/unikit-gd-flow FLOW-first-session "retune the pacing"  → Tuning: edit C/B, one approval
/unikit-gd-flow first-session "add a stealth branch"    → Rework: section-cycle old-vs-new
/unikit-gd-flow FLOW-onboarding "switch to conditional" → Rework: mode change (B + C restructured)
```
