# unikit-gd-spec — Create Mode

> Loaded on demand by the `unikit-gd-spec` mode dispatch when the resolved mode is
> **Create** (no `GAME.md` yet). It also carries the canonical **Phase A** (author
> GAME.md) and **Phase B** (decompose into the system map) that Import / Remap /
> Add-System reference. After writing, re-render via **Regen-on-Write** (in `SKILL.md`)
> and run the Final report (in `SKILL.md`).

## Create Mode — Master Spec from Concept or Dialogue

The primary flow: no `GAME.md` yet. Build it, then decompose into a map.

### Find the seed

1. If the argument names a concept (a slug or a path under
   `.unikit/gamedesign/concepts/`) → read that `CONCEPT.md` as the seed.
2. Else read `.unikit/gamedesign/concepts/INDEX.md` (if it exists); if a recent
   `drafted`/`approved` concept matches the description, offer it:

   ```
   AskUserQuestion: Found concept "<title>" (<date>). Use it as the seed for GAME.md?
   Options: 1. Yes — build from this concept   2. No — I'll describe the game now
   ```
3. Else use the free-form description, or ask for one if empty.

### Phase A — Author GAME.md (section-cycle)

`GAME.md` is one page (Librande one-page principle: if the vision does not fit on
a page, it is not yet sharp). Author it section by section using the
**collaborative protocol (`gd-principles`) and section-cycle contract (`gd-authoring`)** —
skeleton first (one approval), then per section: Context → Questions → Options
(2–4, pros/cons, theory from the loaded `frameworks`/`player-motivation` rules,
one **(Recommended)** with the WHY) → Decision (Explain → Capture via
`AskUserQuestion`) → **Draft + Approval in the same reply** → Write (Edit anchored
on the unique heading). Persist each approved section immediately.

Author these sections (this is the GAME.md structure — do not invent others; the
two narrative sections and Win/Lose are conditional, see notes):

| Section | What it captures |
|---------|------------------|
| **Premise / Theme** | The theme stated as a **problem or tension**, not a setting label — the human question the game puts the player inside ("scarcity forces betrayal", not "post-apocalyptic"). Setting, story, and systems serve this. |
| **Setting + World-Trauma** *(opt.)* | Narrative-driven games only — the world and its **central wound** that the player's actions press on. Omit for abstract / sandbox / puzzle titles. |
| **Protagonist + Core-Power** *(opt.)* | Games with a defined protagonist — who the player is and their **core power**, the capability the fantasy is built around. Omit for faceless / multiplayer / abstract titles. |
| **Core Fantasy** | One paragraph: the emotional promise. Why choose THIS game? A feeling, not a feature list. |
| **Target Aesthetics (MDA)** | Ranked aesthetic goals the pillars must deliver (Hunicke/LeBlanc/Zubek). |
| **Pillars** (`PIL-n`) | 3–5 **falsifiable, constraining** principles, each with a **design test** (resolves a real decision) and the aesthetic it serves. Lower-numbered pillar wins on conflict. |
| **Anti-Pillars** | Each "NOT X" protects a "yes" — exclusions the team would actually be tempted by. |
| **Loop Stack** | Nested loops (≈30 s moment → short → session → long-term). The 30-second loop must be fun in isolation. |
| **Player Needs (SDT)** | Confirm pillars cover Autonomy / Competence / Relatedness; an uncovered need is a gap to flag. |
| **Win / Lose Conditions** *(cond.)* | Include **only if the game can be won or lost** (a sandbox/endless title omits it; when in doubt, ask). The author's high-level intent — a terminal `GOAL` realizes each (`gd-verify` links every condition to its realizing flow objective). |
| **Monetization Stance** | The posture toward monetization — model (premium / F2P / hybrid), what is sold and what is **never** sold (the ethical line), how it serves rather than fights the pillars. Loads the `monetization-ethics` rule. Keep to the stance; the systems carry the mechanics; high-level conversion / LTV / retention intent is authored here, per-flow funnel instrumentation lives in `## Funnel [gen]`. |
| **Reference Games** | What we take, what we change, which pillar it validates. |
| **Open Questions** | Things needing prototyping/research; resolved items migrate into a SYSTEM GDD or GD-IDS. |

GAME.md header — write it in the template's **bold, one-token-per-line** form so the
authored header is byte-consistent with the scaffold:

```
> **Status**: drafted
> **Version**: 1
> **Last Updated**: <date>
> **Based on**: concepts/<slug>.md (v<N>)
```

- **`> **Based on**`** records provenance. Seeded from a concept card → write
  `concepts/<slug>.md (v<N>)`; authored free-form (no concept) → write `—`. Import
  Mode fills the same line with the source path (see below).
- **Carry forward from the concept card** (when one seeded this GAME.md): seed
  **Open Questions** from the concept's biggest-risk / open-question field, and
  carry a `market_signal: red-ocean` into Open Questions **verbatim** as a
  `[market] …` line. The spec **consumes** the card — it does not grade markets or
  re-run market research (that is `unikit-gd-explore`'s job).

**Registry:** as pillars are approved, record each in `GD-IDS.yaml` `pillars`
(`PIL-n`, name, `source: GAME.md`, `added: <date>`) — with the same approval as
the document write. New game terms go to `GD-IDS.yaml` `terms`.

### Phase B — Decompose into the System Map

Derive every system the game needs and write the map. This is collaborative —
concept docs never enumerate every system (CCGS map-systems pattern). Steps:

1. **Explicit systems** — scan GAME.md (loop stack, pillars, reference games) and
   the concept for systems named directly.
2. **Implicit systems** — for each explicit system, infer the hidden ones it
   requires and *explain why* in conversation. Examples: "Combat" implies damage
   calc, health, status effects, enemy AI, combat UI, death/respawn; "Inventory"
   implies item DB, slots, capacity rules, inventory UI, save/load;
   "Progression" implies XP, level-up, unlock tracking, progression UI.
3. **Categorize** each system: Core / Gameplay / Progression / Economy / UI /
   Narrative / Meta. This `category` is stored in the GD-IDS entry — `unikit-plan`
   matches its plan brief on it, and it is the grouping axis of `## System Map [gen]`.
4. **Dependencies** — for each system, list what it depends on (hard/soft,
   direction). The edge must be symmetric across both systems' rows. Surface and
   **resolve cycles** (break with an interface, or design both at once).
5. **Priority tier** — MVP (needed to test "is it fun?") / Vertical Slice /
   Alpha / Full Vision.
6. **Design order** — dependency sort × priority; independent same-layer systems
   can be designed in parallel.
7. **Coverage gate** — **every system must implement ≥1 pillar** (`PIL-n`). A
   system serving no pillar is either mis-scoped or a missing pillar — flag it.

Present the enumeration grouped by category and **get approval** (add/merge/split/
remove) before writing. Then write — the roster lives in **two surfaces**, the
registry (truth) and the GAME.md map (rendered):

- **`GD-IDS.yaml`** `systems` — one entry per system: `id: SYS-<slug>`, name,
  `status: active`, `tier`, **`category`**, `doc_status: not-started`, `implements`,
  `depends_on`, `source: systems/SYS-<slug>.md`, `added: <date>`. A `not-started`
  system carries **no `version`** — it gets `version: 1` only when `unikit-gd-system`
  creates the skeleton (`gd-lifecycle` → Lifecycle & Status).
- **`GAME.md` authored sections** — `## Design Order` (dependency sort × priority)
  and `## Risks & Circular Dependencies` (high-risk / cycle systems) live in the
  one-pager now (no standalone index). Author them alongside the roster.
- **`GAME.md` `## System Map [gen]`** — re-render it from the registry as the **last
  step** (see Regen-on-Write in `SKILL.md`). This is the human-readable map; it is
  generated, never hand-written.

Each system is `not-started` until `unikit-gd-system` authors its GDD.

**Handoff to `unikit-gd-system` (detail-ready gate).** A system is *detail-ready* —
eligible to be picked up by `unikit-gd-system` — only once the map already satisfies
the Phase B conditions for it: a **priority tier** assigned (step 5), **≥1
`implements: PIL-n`** (the coverage gate, step 7), a **symmetric `depends_on`** edge
on both rows (step 4), and a **reserved Doc path** `systems/SYS-<slug>.md` in its
GD-IDS entry (and rendered in `## System Map [gen]`). A system caught in a **dependency
cycle** is not detail-ready until the cycle is broken (step 4); until then it stays a
Risk / Circular-Dependency entry, not a detail target. This gate only **names** what
Phase B already enforces — it adds no new rule.

**After writing → re-render `## System Map [gen]` (Regen-on-Write in `SKILL.md`), then run the Final report (in `SKILL.md`).**
