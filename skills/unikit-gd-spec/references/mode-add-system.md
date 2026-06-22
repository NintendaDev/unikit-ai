# unikit-gd-spec — Add-System Mode

> Loaded on demand by the `unikit-gd-spec` mode dispatch when the resolved mode is
> **Add-System** (`GAME.md` exists; graft one named system onto the map without
> re-deriving the whole map and without touching the authored one-pager). It applies a
> single-system slice of **Phase B** from `mode-create.md`. After writing, re-render via
> **Regen-on-Write** (in `SKILL.md`) and run the Final report (in `SKILL.md`).

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

**2. Run the single-system Phase B gates** (the same rules as Create Mode Phase B —
`mode-create.md` § Phase B — scoped to this one system):

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
  re-render `## System Map [gen]` (Regen-on-Write in `SKILL.md`). The authored vision
  sections (Premise, Pillars, Fantasy, Loops…) are **untouched**.
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

**After writing → run the Final report (in `SKILL.md`).**
