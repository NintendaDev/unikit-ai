# Authoring mode (Create / Fill) — body

Loaded on demand by `unikit-gd-flow/SKILL.md` → "Load the Mode Body" when Phase 2
resolves the mode to **Create** or **Fill**. The SKILL keeps Phase 0–2 + the switch +
Phase 6 (Registry & State); this file is the Decision-First section-cycle body. Returns
to the SKILL's **Phase 6** when done.

## Authoring (Create / Fill) — Decision-First

The flow zone applies the **Decision-First Section-Cycle Contract** in `gd-authoring`:
the six-phase mechanic lives in the shard; below are the flow-specific **section
map**, **core-set**, and per-section logic. **Address sections by name in the
dialogue, never by a bare letter.**

| § | Section | What it holds |
|---|---------|---------------|
| A | Overview | One short paragraph: the player situation that triggers the flow, the intended experience across it, the pillar(s) it serves, and why the `Mode` fits. |
| B | Objective Flow | **Mode = linear/conditional →** objective-flow table, one `GOAL` per row (Trigger → Expected action → Success/feedback → Beacon (opt.) → Event). **Mode = emergent →** affordance / goal-template (a set of `GOAL`s with no fixed order). |
| C | Pacing | **linear/conditional →** tension-by-beat table (Low/Med/High, what drives each). **emergent →** pacing envelope (tension floor/ceiling + what pulls a drifting player back). |
| D | Dependencies | The systems the `GOAL`s exercise (`GOAL → SYS`, refined to `GOAL → AC`); must agree with the `GD-IDS` `depends_on` (rendered in `## Flow Map` Depends) and each exercised system's H. A `GOAL` at a missing/deprecated system is a verify conflict — route it through `unikit-gd-spec` add-system, never invent the roster row here. |
| E | Events (Funnel) | The analytics events the flow emits — the third altitude of `AC · GOAL · event`. Each is registered in `GD-IDS` `events` and aggregated read-only into `## Funnel [gen]`. Event names are English `snake_case`. |
| F | Open Questions & Changelog | open questions (owner/when); changelog blocks (added by this skill on a revision; the `Affected (gd-verify):` line is appended by `unikit-gd-verify`). |

**Core-set (the floor for `detailed`, from `gd-lifecycle`):** A Overview · B Objective
Flow. The **depth** picked in Phase 2 sets which sections this pass attempts (`core` =
just the floor; `standard` / `full` layer on C Pacing / D Dependencies / E Events).
**Fill** re-picks depth and runs Decision-First only over the newly-attempted
sections — earlier approved sections are untouched and partiality stays honest.

### Phase 3 — Skeleton + Fork-Scan

1. **Skeleton (Create mode only).** Write the file from the FLOW template with
   **every** A–F header present and a `[To be designed]` placeholder under each. Get
   **one approval** for the skeleton; a refusal sets `doc_status: skeleton` and stops
   (BLOCKED). The header `> Mode:` token is filled by the wiring-mode decision (the
   first Phase 4 decision); until then it reads `> Mode: <deciding>`.

   ```
   # <Flow Name> — FLOW-<slug>
   > Status: skeleton · Mode: <linear|conditional|emergent> · Version: 1 · Last Updated: <date>
   ```
2. **Fork-scan (silent).** Walk the in-scope sections (per the picked depth) and
   classify each **without asking** — **seeded** (the Phase 1 context: a SOURCE /
   recon / explore brief, the pillars, the loaded domain rules, or an exercised system
   already answers it → it will be drafted silently) vs **real fork** (a genuine design
   choice). The **wiring mode** is the primary fork (asked first in Phase 4). Catch
   pillar- and registry-conflicts **here**, before any prose. Emit
   `INFO [gd-flow] depth=<tier>`.

### Phase 4 — Decision Interview + Generation

**Decision interview.** The **wiring mode** (`linear | conditional | emergent`) is the
**first decision** — it dictates the document's structure (`gd-flow-axis` → Flow Axis),
so it is settled before section B/C are generated:

- **Infer** a candidate from `GAME.md` genre / pillars / loop stack: a fixed tutorial
  or scripted sequence → `linear`; a flow that branches on world/player state →
  `conditional`; a sandbox / open objective the player sets themselves → `emergent`.
- **Explain → Capture:** state the candidate and the trade-offs (linear = authored
  control, low replay; conditional = reactive, more branches to balance; emergent =
  high agency, hardest to pace), then confirm with one `AskUserQuestion` — never
  assume on ambiguity.
- **Record `mode:`** in the `GD-IDS.yaml` `flows[]` entry and the `FLOW.md` header
  `> Mode:` token. `unikit-gd-verify` checks `mode:` ↔ the document's structure (the
  objective-flow table for linear/conditional, the affordance template + pacing
  envelope for emergent) — exactly as it checks a system's `packs:` ↔ `## Pack:`. A
  mode change is an ordinary delta step (Revision).

Then ask **only the remaining real forks**, batched (1–2 `AskUserQuestion` rounds) —
never one gate per section. Options are **grounded** in the loaded `core-loops` /
`player-motivation` theory and the pillars, **never a blank page** (a grounded **form**
+ an open "my own — I'll describe it"); a truly-blank section becomes a **flagged open
question** (section F). A **pillar or loop conflict** is escalated to `/unikit-gd-spec`
**before writing**. Emit `INFO [gd-flow] depth=<tier> mode=<mode>`.

**Generation.** Draft each in-scope section — **seeded** sections **silently** (emit
`INFO [gd-flow] seeded §<name> — drafted silently`), decided sections from their
decision. A section the user chose to **defer** is written with a `<!-- deferred -->`
marker (distinct from `[To be designed]`); a **core** section (A/B) may be deferred,
but then the status honestly stays below `detailed` (the Phase 6 soft floor guard —
emit `WARN [gd-flow] core section §<name> deferred — status held below detailed`). The
section-specific logic (the rest follows the Decision-First flow):

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

### Phase 5 — Group Review

Present the generated sections **by tier-group** (core first, then standard, then
full). Before each section show a **card** — Context · why this section exists · what
it captures · its source — drawn from the FLOW template's `[]`-hints (the hint **is**
the card, surfaced on `ru`; no duplication). Each group closes with **one structural
group gate**:

```
AskUserQuestion: <group> review — <n>/<m> sections done.
Options: Accept & continue · Fix this · Defer this · Accept all the rest
```

*Fix* loops the section back through a decision; *Defer* writes its `<!-- deferred -->`
marker; *Accept all the rest* ends the review. **Write incrementally** — persist each
accepted section immediately (Edit anchored on its unique heading).

In **Fill mode** there is no skeleton step: re-pick depth (Phase 2), fork-scan the
remaining `[To be designed]` sections, and run Phases 4–5 over those only; approved
sections are never overwritten.

→ **Phase 6** writes `flows:` / `events:`, sets the inferred status, and re-renders
the maps.
