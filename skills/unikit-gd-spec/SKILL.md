---
name: unikit-gd-spec
description: >-
  Create the master game design document (GAME.md) and the system map
  (GD-INDEX.md + GD-IDS.yaml) for a game, or import an existing GDD into the
  workspace. The one skill that owns GAME.md structure and the system
  decomposition. Mode is inferred from the argument and prompt — no flags:
  a file path or URL imports an existing GDD; "pitch" produces PITCH.md;
  "remap"/"rebuild the map" re-decomposes systems on an existing GAME.md;
  otherwise it creates the master spec from a concept or dialogue. Use when the
  user says "create the GDD", "master design doc", "map the systems", "import
  this design document", or "pitch this game".
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

Author the **whole-game truth** and the **map of every system**. This skill owns
three workspace artifacts in `.unikit/gamedesign/`:

- **`GAME.md`** — the one-page master GDD (core fantasy, pillars, loop stack,
  non-goals). This skill owns its *structure* (which systems exist, remap);
  *content* edits to its sections go through `unikit-gd-improve`.
- **`GD-INDEX.md`** — the human-readable map: one row per system.
- **`GD-IDS.yaml`** — the machine-truth registry of pillars, systems, and facts.

Optionally it produces **`PITCH.md`**. Per-system detail (`systems/<slug>.md`) is
**not** this skill's job — that is `unikit-gd-detail`.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and artifacts (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English. Do not announce or mention the language setting.

## Bootstrap — Working Contract & Domain Knowledge (MANDATORY)

Before any authoring, silently load — do NOT narrate the loading:

1. **`.unikit/system/gd-principles.md`** — the cross-skill working contract:
   the collaborative protocol (Question → Options → Decision → Draft → Approval,
   Explain → Capture), the section-cycle authoring contract, the one-way
   design→code boundary, the facts-registry / ID conventions, the language rules,
   the critique stance, and the severity rubric. **This skill never re-specifies
   those mechanics — it applies them.** If the file is missing, warn the user
   that `gd-principles` is not installed (`unikit-ai update`) and continue with
   the protocol summarized above as a fallback.
2. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — the domain knowledge index.
   Load the core rules relevant to master-spec work **on demand** by their
   `Load When` column — most often `frameworks` (MDA, SDT/PENS, Flow),
   `player-motivation` (Quantic Foundry), and `core-loops`. Re-read at skill
   start; never rely on a prior conversation's cache.
3. **`.unikit/RULES.md`** (if present) — project overrides, highest priority.
4. **`.unikit/DESCRIPTION.md`** and **`.unikit/ROADMAP.md`** (optional) — project
   constraints and milestones; routing context only.

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
4. **`GAME.md` does not exist** (check `.unikit/gamedesign/GAME.md`) and no import
   path → **Create** mode.
5. **`GAME.md` exists** and the intent is none of the above → **ambiguous**. Ask:

   ```
   AskUserQuestion: GAME.md already exists. What do you want to do?

   Options:
   1. Rebuild the system map (remap) — re-derive GD-INDEX from GAME.md
   2. Create a pitch (PITCH.md)
   3. Edit GAME.md content — this is /unikit-gd-improve's job (redirect)
   4. Import a different GDD — give me the path/URL
   ```

   Editing approved GAME.md content is **not** this skill — redirect to
   `/unikit-gd-improve` (and STOP). This skill only owns GAME.md *structure*.

Announce the resolved mode in one line, then proceed to the matching section.

### Step 1: Ensure the Workspace

Create `.unikit/gamedesign/` (and `systems/`, `concepts/`, `researches/`,
`reviews/` as needed) if missing. Get today's date in `YYYY-MM-DD` (`date +%F`).
If `GD-IDS.yaml` or `GD-INDEX.md` do not yet exist, you will create them from the
embedded structures below; never overwrite an existing registry value silently.

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

Author these sections (this is the GAME.md structure — do not invent others):

| Section | What it captures |
|---------|------------------|
| **Core Fantasy** | One paragraph: the emotional promise. Why choose THIS game? A feeling, not a feature list. |
| **Target Aesthetics (MDA)** | Ranked aesthetic goals the pillars must deliver (Hunicke/LeBlanc/Zubek). |
| **Pillars** (`PIL-n`) | 3–5 **falsifiable, constraining** principles, each with a **design test** (resolves a real decision) and the aesthetic it serves. Lower-numbered pillar wins on conflict. |
| **Anti-Pillars** | Each "NOT X" protects a "yes" — exclusions the team would actually be tempted by. |
| **Loop Stack** | Nested loops (≈30 s moment → short → session → long-term). The 30-second loop must be fun in isolation. |
| **Player Needs (SDT)** | Confirm pillars cover Autonomy / Competence / Relatedness; an uncovered need is a gap to flag. |
| **Reference Games** | What we take, what we change, which pillar it validates. |
| **Open Questions** | Things needing prototyping/research; resolved items migrate into a SYSTEM GDD or GD-IDS. |

GAME.md header: `> Status: drafted` · `> Version: 1` · `> Last Updated: <date>`.

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
   Narrative / Meta.
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
remove) before writing. Then write:

- **`GD-INDEX.md`** — one row per system, columns:
  `ID | System | Category | Tier | Status | Ver | Depends | Doc`. Status starts
  `not-started`, Ver `—`, Doc `systems/SYS-<slug>.md`. Include the Pillars mirror
  table, Categories, Priority Tiers, Design Order, and Risks/Circular-Dependencies
  sections (header `> Last Updated: <date>`).
- **`GD-IDS.yaml`** `systems` — one entry per system (`id: SYS-<slug>`, name,
  `status: active`, tier, `doc_status: not-started`, `implements`, `depends_on`,
  `source: systems/SYS-<slug>.md`, `added: <date>`). A `not-started` system carries
  **no `version`** — it gets `version: 1` only when `unikit-gd-detail` creates the
  skeleton (see gd-principles → Lifecycle & Status).

Each system is `not-started` until `unikit-gd-detail` authors its GDD.

---

## Import Mode — Bring an Existing GDD into the Workspace

The argument is a path or URL to an existing design document. Import is a
**document operation** — extract from the source, never reverse-engineer design
from code (one-way boundary).

1. **Read the source.** A local path → Read it. A URL → WebFetch it.
2. **Preserve it verbatim.** Write the original, unchanged, to
   `.unikit/gamedesign/researches/<date>_import-<slug>/SOURCE.md`. This is the
   provenance record `unikit-gd-detail` later pulls section content from.
3. **Extract GAME.md** (Create Mode Phase A structure) from the source —
   *extract, do not regenerate*. Pull the core fantasy, pillars, loops, and
   references the document already states. For elements the source lacks
   (commonly anti-pillars, pillar **design tests**, the Quantic Foundry / SDT
   profile, explicit non-goals), follow the section-cycle to **ask** the user
   rather than inventing them. Mark any section absent from the source.
4. **Decompose** (Create Mode Phase B): take the systems the document names as
   **explicit**, then **infer the implicit** ones the document omits and mark
   them inferred. Build `GD-INDEX.md` + `GD-IDS.yaml`.
5. Add a `## Based on` note in GAME.md pointing at the imported `SOURCE.md`.

Holes the source leaves in per-system detail (sections E/G/H/I/J are commonly
missing from real-world GDDs) are filled later by `unikit-gd-detail`, which marks
generated-vs-extracted content. Tell the user which systems came from the
document and which were inferred.

---

## Remap Mode — Rebuild the System Map

`GAME.md` exists and the user wants the map re-derived (the game's scope changed,
or the map drifted). This touches **structure**, not GAME.md content.

1. Read `GAME.md`, `GD-INDEX.md`, `GD-IDS.yaml`, and glob `systems/*.md`.
2. Re-run Create Mode Phase B (decompose → categorize → dependencies → tiers →
   design order → pillar coverage) against the current GAME.md.
3. Reconcile against existing rows — **never silently change a registry value or
   delete an ID**. Present a diff (added / changed / removed-→-deprecated systems)
   and get approval.
4. **Preserve detailed work:** a system that already has a `detailed`/`reviewed`
   GDD keeps its Status and Ver; only its map metadata (category, depends, tier)
   may change, with approval. Deprecate (never delete) systems that no longer fit
   — set `status: deprecated` in `GD-IDS.yaml` **and `deprecated` in the system's
   `GD-INDEX.md` Status cell** (the display-precedence writer — see gd-principles →
   Lifecycle & Status); dangling references become verify conflicts.
5. Recommend `/unikit-gd-verify` afterwards to catch any dependency drift.

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
Mode: <create | import | remap | pitch>
Workspace: .unikit/gamedesign/
Written:
- GAME.md (vN, <drafted|approved>)
- GD-INDEX.md (<N> systems mapped)
- GD-IDS.yaml (<P> pillars, <N> systems)
- [SOURCE.md / PITCH.md when applicable]

System map: <N> systems — <M> MVP, … ; design order: SYS-…, SYS-…
```

Then recommend the next step (do not auto-invoke):

```
AskUserQuestion: Master spec ready. What's next?

Options:
1. Detail the first MVP system — /unikit-gd-detail <SYS-slug> (recommended)
2. Review the master spec — /unikit-gd-review (fresh session recommended)
3. Nothing — I'll continue later
```

## Ownership Boundaries

- **Owns:** `GAME.md` structure (which systems exist, remap), `GD-INDEX.md`,
  `GD-IDS.yaml` pillars+systems, optional `PITCH.md`, and import `SOURCE.md`.
- **Not this skill:** per-system GDDs (`systems/<slug>.md`) → `unikit-gd-detail`;
  content edits to approved GAME.md sections → `unikit-gd-improve`; ideation /
  concepts → `unikit-gd-brainstorm`; research briefs → `unikit-gd-explore`.
- **Never:** write without explicit approval; change a `GD-IDS.yaml` value
  silently; delete or renumber an ID; read the code workspace or project source.

## Quick Reference

```
/unikit-gd-spec <description>            → create GAME.md + GD-INDEX.md + GD-IDS.yaml
/unikit-gd-spec ./path/to/GDD.md         → import an existing GDD (extract, keep SOURCE.md)
/unikit-gd-spec https://…                → import from a URL
/unikit-gd-spec remap the systems        → re-derive the map (GAME.md must exist)
/unikit-gd-spec pitch this game          → produce PITCH.md
```
