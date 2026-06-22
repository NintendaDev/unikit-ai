---
name: unikit-gd-spec
description: >-
  Create and own the master game design document (GAME.md — the authored one-pager plus the
  generated [gen] system/flow maps) and the GD-IDS.yaml facts registry — the top-level,
  big-picture layer of the GDD and the machine interface the code side reads. Use it to write
  the master spec from a concept or dialogue, import an existing GDD (a file path or URL), edit
  GAME.md content ("change a pillar", "rework the monetization stance", "tweak the loop stack"),
  pitch the game ("pitch" → PITCH.md), re-decompose the systems ("remap"), and — importantly — to
  add a new system to the design map ("let's add a new system", "add a crafting system to the
  game design", "add this to the GDD"). This is the structural, map-level layer plus GAME.md
  content edits. To write or fill in the detailed parameters of one existing system, use
  /unikit-gd-system; to invent a brand-new game concept use /unikit-gd-brainstorm.
argument-hint: "[path-to-existing-GDD | URL | free-form description]  (mode inferred; no flags)"
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
  - WebFetch
  - AskUserQuestion
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: game-design
---

# Game Design — Master Spec & System Map

Author the **whole-game truth** and the **map of every system**. This skill owns the
**spec / map zone** in `.unikit/gamedesign/` (`gd-principles` → Zone Ownership):

- **`GAME.md`** — the one-page master GDD. This skill owns **both halves**: the
  **authored one-pager** (premise, pillars, loop stack, win/lose intent, monetization
  stance, non-goals) and the **generated `[gen]` maps** at the bottom (`## System Map
  [gen]` / `## Flow Map [gen]` / `## Funnel [gen]`), which are mechanical read-only
  re-renders of `GD-IDS.yaml`. Both **content edits** to its sections and **structure**
  edits (which systems exist, remap) live here — there is no separate editor skill.
- **`GD-IDS.yaml`** — the machine-truth registry of pillars, systems, flows, and facts,
  **and the interface the code side reads** (`unikit-plan` / `unikit-verify` /
  `unikit-explore`).

Optionally it produces **`PITCH.md`**. Per-system detail (`systems/<slug>.md`) is
**not** this skill's job — that is `unikit-gd-system`; player-action flows
(`flows/<slug>.md`) are `unikit-gd-flow`'s.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and artifacts (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English. Do not announce or mention the language setting.

## Bootstrap — Working Contract & Domain Knowledge (MANDATORY)

Before any authoring, silently load — do NOT narrate the loading:

1. **`.unikit/system/gd-principles.md`** — the cross-skill working contract:
   the zone-ownership model and routing rule, the collaborative protocol
   (Question → Options → Decision → Draft → Approval, Explain → Capture), the
   section-cycle authoring contract, the one-way design→code boundary, the delta
   discipline (incl. the **GAME.md carve-out** this skill implements), the
   facts-registry / ID conventions, the language rules, the critique stance, and the
   severity rubric. **This skill never re-specifies those mechanics — it applies them.**
   If the file is missing, warn the user that `gd-principles` is not installed
   (`unikit-ai update`) and continue with the protocol summarized above as a fallback.
2. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — the domain knowledge index.
   Load the core rules relevant to master-spec work **on demand** by their
   `Load When` column — most often `frameworks` (MDA, SDT/PENS, Flow),
   `player-motivation` (Quantic Foundry), `core-loops`, and `monetization-ethics`
   (for the Monetization Stance). Re-read at skill start; never rely on a prior
   conversation's cache.
3. **`.unikit/RULES.md`** (if present) — project overrides, highest priority.
4. **`.unikit/DESCRIPTION.md`** and **`.unikit/ROADMAP.md`** (optional) — project
   constraints and milestones; routing context only.
5. **Schema guard (clean break — no automatic migration).** When `GD-IDS.yaml`
   already exists it MUST be `version: 2`. If it is still `version: 1`, **STOP** and
   report: the design workspace is on the pre-v2 layout — v2 dropped the standalone
   markdown system-index that v1 kept beside the registry and now renders the maps
   read-only into `GAME.md` (`## System Map [gen]` / `## Flow Map [gen]` / `## Funnel
   [gen]`); there is no automatic migration. Tell the user to bump `GD-IDS.yaml` to
   `version: 2`, fold any rows from the legacy system-index into GAME.md's
   `## System Map [gen]`, and delete that legacy index file before re-running. Create
   mode (no `GD-IDS.yaml` yet) skips this check.

**One-way boundary:** this skill never reads `.unikit/code/`, project source, or
build artifacts. Importing a GDD reads only the document the user points at.

## Input

`$ARGUMENTS` — a single positional value, free-form, in any language. It may be a
**file path** or **URL** to an existing GDD, or a **description / intent**. There
are **no flags**: the mode is inferred (see Step 0). Ambiguity is always resolved
by asking — never by guessing.

## Workflow

### Step 0: Resolve Mode (no flags)

Mode is a function of the **artifact state on disk** and the **intent in the
prompt** (`gd-principles` "never guess" rule). Resolve in this order:

1. **The argument is a file path or URL** (contains `/`, ends in `.md`/`.markdown`,
   exists on disk, or starts with `http`) → **Import** mode. Confirm the target
   with the user if the path is uncertain.
2. The prompt asks for a **pitch** ("pitch", "питч", "one-pager to sell it") →
   **Pitch** mode.
3. The prompt asks to **rebuild / re-derive the system map** ("remap", "rebuild
   the map", "пересобери карту", "re-decompose systems") **and `GAME.md` exists**
   → **Remap** mode.
4. The prompt asks to **add one system** ("add a/new system", "let's add a crafting
   system", "add this to the GDD", "добавь систему", or it names a system **absent
   from the roster**) **and `GAME.md` exists** → **Add-System** mode. This is
   distinct from Remap: Remap re-derives the **whole** map, Add-System grafts **one**
   named system onto the existing map and **never touches the authored one-pager**.
   (It is the route the internal design lens hands a new mechanic to — see Add-System
   Mode.)
5. The prompt asks to **change GAME.md content** ("change/rework/tune a pillar, the
   fantasy, a loop, the monetization stance, an anti-pillar, win/lose intent…") **and
   `GAME.md` exists** → **Edit** mode. This is the content-edit zone the spec owns
   (absorbed under zone-ownership: there is no separate `improve` skill). Editing
   GAME.md's *authored* sections is Edit; re-deriving the *roster* is Remap/Add-System.
6. **`GAME.md` does not exist** (check `.unikit/gamedesign/GAME.md`) and no import
   path → **Create** mode.
7. **`GAME.md` exists** and the intent is none of the above → **ambiguous**. Ask:

   ```
   AskUserQuestion: GAME.md already exists. What do you want to do?

   Options:
   1. Edit GAME.md content — change a pillar / fantasy / loop / stance (GAME.md carve-out)
   2. Rebuild the system map (remap) — re-derive the roster from GAME.md
   3. Add one system to the map (add-system)
   4. Create a pitch (PITCH.md)
   5. Import a different GDD — give me the path/URL
   ```

Announce the resolved mode in one line, then proceed to the matching section.

### Step 1: Ensure the Workspace

Create `.unikit/gamedesign/` (and `systems/`, `flows/`, `concepts/`, `researches/`,
`reviews/` as needed) if missing. Get today's date in `YYYY-MM-DD` (`date +%F`).
If `GD-IDS.yaml` does not yet exist, you will create it from the canonical structure
described below (the `version: 2` registry); never overwrite an existing registry
value silently.

---

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
**collaborative protocol and section-cycle contract from `gd-principles`** —
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
  creates the skeleton (`gd-principles` → Lifecycle & Status).
- **`GAME.md` authored sections** — `## Design Order` (dependency sort × priority)
  and `## Risks & Circular Dependencies` (high-risk / cycle systems) live in the
  one-pager now (no standalone index). Author them alongside the roster.
- **`GAME.md` `## System Map [gen]`** — re-render it from the registry as the **last
  step** (see Regen-on-Write below). This is the human-readable map; it is generated,
  never hand-written.

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

---

## Regen-on-Write — `## System Map [gen]`

`GAME.md`'s `## System Map [gen]` block is a **mechanical re-render** of `GD-IDS.yaml`
`systems` (the `RULES_INDEX` model) — never hand-authored. `unikit-gd-spec` is its
primary writer: after **any** write that changes the roster or a system's registry
metadata (Create Phase B, Add-System, Remap, and a roster-affecting Edit), re-render
the block as the **last step**:

1. Read `GD-IDS.yaml` `systems`.
2. Group by `category` (omit empty categories); within a group sort by `tier`
   (MVP → Vertical Slice → Alpha → Full Vision) then design order.
3. One row per system: `ID | System | Tier | Status | Ver | Depends | Doc`.
   - `Status` mirrors `doc_status`, **overridden** by `deprecated` (from the
     `status` field) and by the code-set `implemented` (display-only — design never
     authors it; `gd-principles` → Lifecycle & Status).
   - `Ver` is `—` until `skeleton`.
   - `Doc` is `systems/SYS-<slug>.md`.
4. Replace **only** the content between `<!-- gen:system-map -->` and
   `<!-- /gen:system-map -->`; never touch the authored one-pager above it. Full
   map (one row per system); collapse to a single grouped table only as an escape
   hatch for very large rosters (150+).

The `## Flow Map [gen]` and `## Funnel [gen]` blocks are rendered by `unikit-gd-flow`
(the Flow axis) — out of scope here until that skill ships; leave their template
scaffold untouched. `unikit-gd-verify` independently re-renders a stale `[gen]` block
when its freshness check trips (`gd-principles` → Lifecycle & Status) — the render is
deterministic, so both writers always agree.

---

## Import Mode — Bring an Existing GDD into the Workspace

The argument is a path or URL to an existing design document. Import is a
**document operation** — extract from the source, never reverse-engineer design
from code (one-way boundary).

1. **Read the source.** A local path → Read it. A URL → WebFetch it.
2. **Preserve it verbatim.** Write the original, unchanged, to
   `.unikit/gamedesign/researches/<date>_import-<slug>/SOURCE.md`. This is the
   provenance record `unikit-gd-system` later pulls section content from.
3. **Extract GAME.md** (Create Mode Phase A structure) from the source —
   *extract, do not regenerate*. Pull the premise, core fantasy, pillars, loops, the
   win/lose and monetization intent, and references the document already states. For
   elements the source lacks (commonly anti-pillars, pillar **design tests**, the
   Quantic Foundry / SDT profile, explicit non-goals, the monetization stance),
   follow the section-cycle to **ask** the user rather than inventing them, and tell
   the user which elements the source lacked. GAME.md records its provenance through
   the header `> **Based on**:` line (step 5), **not** per-section provenance markers
   — the `<!-- provenance: … -->` markers (`gd-principles` → Provenance) are a
   SYSTEM-GDD device; GAME.md is a free-form one-pager and is deliberately outside
   their scope (cf. the SYSTEM.md skeleton).
4. **Decompose** (Create Mode Phase B): take the systems the document names as
   **explicit**, then **infer the implicit** ones the document omits and mark
   them inferred. Build the `GD-IDS.yaml` roster + GAME.md Design Order / Risks and
   re-render `## System Map [gen]`.
5. **Provenance:** fill the GAME.md header `> **Based on**:` line with
   `researches/<date>_import-<slug>/SOURCE.md` — the single provenance record,
   identical in shape to the concept-seeded case (Create Mode Phase A). Do **not**
   add a separate `## Based on` section.

Holes the source leaves in per-system detail (sections E/G/H/I/J are commonly
missing from real-world GDDs) are filled later by `unikit-gd-system`, which marks
generated-vs-extracted content. Tell the user which systems came from the
document and which were inferred.

---

## Edit Mode — Change GAME.md Content (the GAME.md carve-out)

`GAME.md` exists and the user wants to **change an authored section** — a pillar, the
core fantasy, a loop, an anti-pillar, the win/lose or monetization intent, the
premise. This zone is **owned here** (no separate editor skill); apply the **GAME.md
carve-out of the delta discipline** (`gd-principles` → Delta Discipline), which is
deliberately lighter than a SYSTEM GDD edit.

1. Read `GAME.md` (and `GD-IDS.yaml` if a pillar/term is involved).
2. Author the change with the collaborative protocol — Context → Questions →
   Options (2–4, one Recommended with the WHY) → Decision → **Draft + Approval in the
   same reply** → Write (Edit anchored on the unique heading). Never rewrite an
   approved section without approval.
3. **Registry sync.** A pillar change updates `GD-IDS.yaml` `pillars` (never delete
   a `PIL-n` — deprecate it); a new term goes to `terms`. Same approval as the edit.
4. **Mandatory tail (GAME.md carve-out):**
   - **Version +1** in the GAME.md header `> **Version**:` line **only** — GAME.md
     has no `GD-IDS.yaml systems` row, so there is no system `version` to bump.
   - Append a **light** entry to `## Changelog` (version, date, essence, one line per
     changed section). **No** AC-delta line and **no** `Affected (gd-verify):` line —
     those are SYSTEM GDD fields.
   - Status stays `drafted | approved`; it is **never** set to `revised`. No two-place
     coherence, no pending-loop (a GAME.md edit does not flag dependents).
5. **Roster touch?** If the edit changes a pillar that a system's coverage depends on,
   or otherwise shifts roster metadata, re-render `## System Map [gen]` (Regen-on-Write)
   — but Edit never adds or removes a system (that is Add-System / Remap).
6. Recommend `/unikit-gd-verify` (changed scope) after the edit.

A significant decision also gets a **DD record** in `GD-IDS` `decisions` (options,
rationale, affected systems).

---

## Remap Mode — Rebuild the System Map

`GAME.md` exists and the user wants the map re-derived (the game's scope changed,
or the map drifted). This touches **structure** (the roster), not the authored
one-pager's vision.

1. Read `GAME.md`, `GD-IDS.yaml`, and glob `systems/*.md`.
2. Re-run Create Mode Phase B (decompose → categorize → dependencies → tiers →
   design order → pillar coverage) against the current GAME.md.
3. Reconcile against existing rows — **never silently change a registry value or
   delete an ID**. Present a diff (added / changed / removed-→-deprecated systems)
   and get approval.
4. **Preserve detailed work:** a system that already has a `detailed`/`reviewed`
   GDD keeps its `doc_status` and `version`; only its map metadata (category,
   depends, tier) may change, with approval. Deprecate (never delete) systems that
   no longer fit — set `status: deprecated` in `GD-IDS.yaml` (the `## System Map [gen]`
   then renders `deprecated` via display precedence — see gd-principles → Lifecycle &
   Status); dangling references become verify conflicts.
5. Refresh `## Design Order` / `## Risks & Circular Dependencies` in GAME.md and
   re-render `## System Map [gen]` (Regen-on-Write).
6. Recommend `/unikit-gd-verify` afterwards to catch any dependency drift.

---

## Add-System Mode — Graft One System onto the Map

`GAME.md` exists and the user (or the internal design lens via a hand-off brief) wants
**one new system** added to the map — without re-deriving the whole map (Remap) and
without touching the **authored one-pager** (pillars, fantasy, loops). This is a
**slice of Phase B applied to a single system**: the same gates, scoped to one row.

**1. Seed the system.** Two entry paths:

- **From an explore brief** (the internal design lens routed here): locate the
  research and its `## New Feature Plan` block — discover it by the brief's
  **`research:` folder** named in the prompt, else by matching the target slug against
  `researches/INDEX.md` `Target:`. Read the block's **Map fields** (proposed slug,
  Category, Tier, `implements: PIL-n`, `depends_on`). Confirm them with the user — the
  brief is a draft, not a decree.
- **Free-form** ("add a crafting system"): work out the same fields collaboratively
  (Question → Options → Decision), grounded in the existing pillars/loops.

**2. Run the single-system Phase B gates** (the same rules as Create Mode Phase B,
scoped to this one system):

- **Slug + collision check** — `SYS-<slug>`; reject a slug already in the roster /
  `GD-IDS` (never reuse or renumber an ID). Pick a fresh, English, lowercase slug.
- **Category** — Core / Gameplay / Progression / Economy / UI / Narrative / Meta.
- **Coverage gate** — **≥1 `implements: PIL-n`**. A system serving no pillar is
  mis-scoped or signals a missing pillar — surface it; a pillar/loop change is **not**
  this mode's job (it escalates to a GAME.md content **Edit** or a remap). Add-System
  never edits pillars.
- **Symmetric Depends** — every `depends_on` edge is mirrored on **both** rows (this
  one and the neighbour's). Surface and resolve any cycle (break with an interface).
- **Priority tier** — MVP / Vertical Slice / Alpha / Full Vision.
- **Reserved Doc** — `systems/SYS-<slug>.md` (the file is created later by
  `unikit-gd-system`, not here).

**3. Write the map (with approval) — registry + rendered map, authored vision
untouched:**

- **`GD-IDS.yaml`** `systems` — append one entry (`id: SYS-<slug>`, name,
  `status: active`, tier, **category**, `doc_status: not-started`, **no `version`**,
  `implements`, `depends_on`, `source: systems/SYS-<slug>.md`, `added: <date>`).
- **`GAME.md`** — update the neighbour's dependency edge if needed; refresh
  `## Design Order` / `## Risks & Circular Dependencies` if the new edges change them;
  re-render `## System Map [gen]` (Regen-on-Write). The authored vision sections
  (Premise, Pillars, Fantasy, Loops…) are **untouched**.
- **When seeded from a brief, write the authoritative research pointer.** Add
  `research: researches/<folder-name>/` to the new `GD-IDS` `systems` entry — a
  **non-id path** pointer (the research folder, matching `researches/INDEX.md`'s
  `Path` / `Target`), so `unikit-gd-system` finds the `## New Feature Plan` block after
  a `/clear`. `unikit-gd-spec` **owns** this pointer (`unikit-gd-explore` never writes
  it); it is non-semantic metadata, excluded from `unikit-gd-verify` coherence and id
  resolution (its value is a path, not an id).

The system stays `not-started` until `unikit-gd-system` authors its GDD — lifecycle is
unchanged (`gd-principles` → Lifecycle & Status).

**4. Active seam → detail now?** Offer to continue straight into detailing in the
same session (a system grafted from a brief is detail-ready by construction — it
already satisfies the Phase B detail-ready gate):

```
AskUserQuestion: SYS-<slug> is on the map (not-started). Detail it now?

Options:
1. Yes — detail it now → /unikit-gd-system SYS-<slug> (recommended)
2. No — I'll detail it later
```

On **Yes**, continue into the `/unikit-gd-system SYS-<slug>` flow (it picks up the
`research:` pointer and pre-fills its section-cycle from the `## New Feature Plan`
seeds). On **No**, stop after the map write.

---

## Pitch Mode — PITCH.md

Produce `.unikit/gamedesign/PITCH.md` from `GAME.md` (read it first; if it does
not exist, build it via Create Mode first or ask). A pitch is a selling one-pager:

- **Hook** — understandable in ≤10 seconds.
- **Comparables** — 3 titles framed as hit / average / underperformer, with what
  this game does differently.
- **The Ask** — what the pitch is asking for (greenlight, funding, team).

Author it collaboratively (Question → Options → Decision → Draft + Approval), then
write the file (`> Status` / `> Version` / `> Last Updated: <date>`).

---

## Final: Compact Report & Next Steps

After artifacts are written, show a compact report (no summary document, no report
file):

```
Mode: <create | import | edit | remap | add-system | pitch>
Workspace: .unikit/gamedesign/
Written:
- GAME.md (vN, <drafted|approved>) — incl. ## System Map [gen] re-rendered
- GD-IDS.yaml (<P> pillars, <N> systems)
- [SOURCE.md / PITCH.md when applicable]

System map: <N> systems — <M> MVP, … ; design order: SYS-…, SYS-…
```

Then recommend the next step (do not auto-invoke):

```
AskUserQuestion: Master spec ready. What's next?

Options:
1. Detail the first MVP system — /unikit-gd-system <SYS-slug> (recommended)
2. Review the master spec — /unikit-gd-review (fresh session recommended)
3. Nothing — I'll continue later
```

## Ownership Boundaries

- **Owns:** all of `GAME.md` — the **authored one-pager** (its **content edits** under
  the GAME.md carve-out **and** its **structure**: which systems exist, remap) **and**
  its generated `## System Map [gen]` block (the primary regenerator). Owns the system
  roster (Create + Import Phase B, Add-System, Remap) and `GD-IDS.yaml`
  pillars + systems; optional `PITCH.md`; import `SOURCE.md`. Owns the `GD-IDS`
  `research:` pointer (written in Add-System when seeded from an explore brief) —
  `unikit-gd-explore` never writes it.
- **Not this skill:** per-system GDDs (`systems/<slug>.md`) → `unikit-gd-system`;
  player-action flows (`flows/<slug>.md`) and the `## Flow Map [gen]` / `## Funnel
  [gen]` renders → `unikit-gd-flow`; ideation / concepts → `unikit-gd-brainstorm`;
  research briefs → `unikit-gd-explore`.
- **Never:** write without explicit approval; change a `GD-IDS.yaml` value
  silently; delete or renumber an ID; read the code workspace or project source.

## Quick Reference

```
/unikit-gd-spec <description>            → create GAME.md (one-pager + maps) + GD-IDS.yaml
/unikit-gd-spec ./path/to/GDD.md         → import an existing GDD (extract, keep SOURCE.md)
/unikit-gd-spec https://…                → import from a URL
/unikit-gd-spec change PIL-2's design test → edit GAME.md content (GAME.md carve-out)
/unikit-gd-spec remap the systems        → re-derive the map (GAME.md must exist)
/unikit-gd-spec add a crafting system    → add-system: graft one system onto the map → seam to detail
/unikit-gd-spec pitch this game          → produce PITCH.md
```
