# Authoring mode (Create / Fill) — body

Loaded on demand by `unikit-gd-content/SKILL.md` → "Load the Mode Body" when Phase 2
resolves the mode to **Create** or **Fill**. The SKILL keeps Phase 0–2 + the switch +
Phase 6 (Registry & State); this file is the Decision-First section-cycle body. Returns
to the SKILL's **Phase 6** when done.

## Authoring (Create / Fill) — Decision-First

The content zone applies the **Decision-First Section-Cycle Contract** in
`gd-authoring`: the six-phase mechanic lives in the shard; below are the
content-specific **section map**, **core-set**, and per-section logic. **Address
sections by name in the dialogue, never by a bare letter.**

| § | Section | What it holds |
|---|---------|---------------|
| A | Overview | One short paragraph: what one unit represents, the consuming system it feeds, why the type exists, and why the `Scale` fits. |
| B | Schema (CT.fields) | The typed field schema — **the contract the code side reads**. One row per field (name · type · required · default · range/values · meaning). The field-type vocabulary is below. |
| C | Scale & Generation | **Scale = bulk →** count + spec descriptor (how many, where the data lives, how produced). **Scale = curated →** the catalog (one `CU-<ct>-<n>` row per authored unit). |
| D | Relationships & Dependencies | The `ref<>` fields (content↔X links) + `belongs_to` (the consuming system). Each must agree with `GD-IDS`; a missing system routes to `unikit-gd-spec` add-system. |
| E | Validation & Edge Cases | What makes a unit valid beyond field types (cross-field rules), degenerate-value handling — feeds the genre-blind verify checks. |
| F | Open Questions & Changelog | open questions (owner/when); changelog blocks (added by this skill on a **schema** revision; the `Affected (gd-verify):` line is appended by `unikit-gd-verify`). |

**Core-set (the floor for `detailed`, from `gd-lifecycle`):** A Overview · B Schema
(CT.fields) · C Scale & Generation (Scale is in core — it dictates code structure). The
**depth** picked in Phase 2 sets which sections this pass attempts (`core` = just the
floor; `standard` / `full` layer on D Relationships / E Validation). **Fill** re-picks
depth and runs Decision-First only over the newly-attempted sections — earlier approved
sections are untouched and partiality stays honest.

### Phase 3 — Skeleton + Fork-Scan

1. **Skeleton (Create mode only).** Write the file from the CONTENT-TYPE template with
   **every** A–F header present and a `[To be designed]` placeholder under each. Get
   **one approval** for the skeleton; a refusal sets `doc_status: skeleton` and stops
   (BLOCKED). The header `> Scale:` token is filled by the scale decision (the first
   Phase 4 decision); until then it reads `> Scale: <deciding>`.

   ```
   # <Content Type Name> — CT-<slug>
   > Status: skeleton · Scale: <bulk|curated> · Belongs to: SYS-<slug> · Version: 1 · Last Updated: <date>
   ```
2. **Fork-scan (silent).** Walk the in-scope sections (per the picked depth) and
   classify each **without asking** — **seeded** (the Phase 1 context: a SOURCE /
   recon / explore brief, the pillars, the loaded domain rules, or the consuming system
   already answers it → it will be drafted silently) vs **real fork** (a genuine design
   choice). The **scale** is the primary fork (asked first in Phase 4). Catch
   registry-conflicts **here**, before any prose. Emit `INFO [gd-content] depth=<tier>`.

### Phase 4 — Decision Interview + Generation

**Decision interview.** The **scale** (`bulk | curated`) is the **first decision** — it
dictates section C's structure and how units register (`gd-lifecycle` → Content axis),
so it is settled before section C is generated:

- **Infer** a candidate from the type's nature: many similar units whose values churn
  and live in a data file / editor (items, cards, levels by the hundreds) → `bulk`; a
  small hand-tuned set whose values are authored and balanced individually (a handful
  of bosses, a few minigames) → `curated`.
- **Explain → Capture:** state the candidate and the trade-offs (bulk = the registry
  stays a contract, the editor owns churn, but per-unit balancing is out of the GDD;
  curated = every unit is in the registry and reviewable, but it does not scale to
  hundreds), then confirm with one `AskUserQuestion` — never assume on ambiguity.
- **Record `scale:`** in the `GD-IDS.yaml` `content_types[]` entry and the
  `CONTENT-TYPE.md` header `> Scale:` token. `unikit-gd-verify` checks `scale:` ↔ the
  document's structure (the count + spec descriptor for `bulk`, the catalog rows for
  `curated`) — exactly as it checks a flow's `mode:` ↔ structure. A scale change is a
  schema delta (Revision).

Then ask **only the remaining real forks**, batched (1–2 `AskUserQuestion` rounds) —
never one gate per section. Options are **grounded** in the loaded domain theory and
the consuming system, **never a blank page** (a grounded **form** + an open "my own —
I'll describe it"); a truly-blank section becomes a **flagged open question** (section
F). A registry conflict (a missing `belongs_to`/`ref<SYS>` system) is escalated through
the re-entry seam **before writing**. Emit `INFO [gd-content] depth=<tier> scale=<scale>`.

**Generation.** Draft each in-scope section — **seeded** sections **silently** (emit
`INFO [gd-content] seeded §<name> — drafted silently`), decided sections from their
decision. A section the user chose to **defer** is written with a `<!-- deferred -->`
marker (distinct from `[To be designed]`); a **core** section (A/B/C) may be deferred,
but then the status honestly stays below `detailed` (the Phase 6 soft floor guard —
emit `WARN [gd-content] core section §<name> deferred — status held below detailed`).
The section-specific logic (the rest follows the Decision-First flow):

- **B / Schema (CT.fields) — the contract.** Author the typed field schema, one row
  per field. The field-type vocabulary (English tokens — never translated):

  | Type | Use |
  |------|-----|
  | `int` / `float` | numeric values; add a `range: [min, max]` |
  | `string` / `bool` | free text / a flag |
  | `enum(values)` | a fixed choice set, e.g. `enum(common, rare, epic)` |
  | `list<T>` | a list of any other type, e.g. `list<ref<ENT>>` |
  | `asset-ref` / `loc-ref` | an art/audio asset handle / a localization key (the engine resolves it; the contract just names the kind) |
  | `ref<PREFIX>` | a link to another registry fact — `ref<ENT>` / `ref<CU>` / `ref<FORM>` / `ref<SYS>` / `ref<RES>` |

  Per field, name `required` (yes/no), a `default`, and a `range`/`values` where it
  applies. **`ref<>` is the universality lever: a content↔content / content↔system
  link is a FIELD, not metadata** — this is why the CU envelope never grows per genre.
  Keep section B's content equal to the `content_types[].fields` you will register in
  Phase 5.
- **C / Scale & Generation** — match the header `> Scale:`. **bulk →** state the
  `count` (current), the `spec` (where the data lives + the shape it follows, e.g.
  `data/items.csv` per the schema), and the generator (hand / procedural / imported).
  The individual instances are **not** listed — they live in the editor. **curated →**
  list each `CU-<ct>-<n>` row with its key field values; numbering is **stable**, never
  reshuffled, the content counterpart of a system's `AC-<sys>-<n>`.
- **D / Relationships + registry check** — list each `ref<>` field's target and the
  `belongs_to` system; every target MUST resolve in `GD-IDS`. Compare each `ref<SYS>`
  / `belongs_to` against the known facts from Phase 1. On a mismatch or a missing
  system, surface it **immediately**: obey the registry / route the new system through
  `unikit-gd-spec` add-system / park it in section F. Never silently invent a roster
  row.
- **E / Validation** — author the cross-field rules and degenerate-value handling that
  the genre-blind verify checks rely on (every `fields` value ⊆ `CT.fields` by name +
  type; every `ref<>` resolves; a `bulk` type carries `count` + `spec`).

**Re-entry seam (a content type crosses into the system roster).** When `belongs_to`
or a `ref<SYS>` needs a system that is **missing or deprecated**, do **not** write the
roster silently. Ask the user (add the system / pick another / defer), then route:

```
This content type's belongs_to / ref<SYS> crosses into the system roster, which the
content zone does not write. Use:
- a missing consuming/referenced system → /unikit-gd-spec (add-system) → then detail it via /unikit-gd-system
```

This is the active seam — offer it in the same session and continue once resolved.

### Phase 5 — Group Review

Present the generated sections **by tier-group** (core first, then standard, then
full). Before each section show a **card** — Context · why this section exists · what
it captures · its source — drawn from the CONTENT-TYPE template's `[]`-hints (the hint
**is** the card, surfaced on `ru`; no duplication). Each group closes with **one
structural group gate**:

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

→ **Phase 6** writes `content_types:` / `content:`, sets the inferred status, and
re-renders the map.
