# Revision mode (Edit) — body

Loaded on demand by `unikit-gd-content/SKILL.md` → "Load the Mode Body" when Phase 2
resolves the mode to **Edit** (a **schema** change — catalog churn is data, handled
directly). The SKILL keeps Phase 0–2 + the switch + Phase 6; this file is the revision
body (classify → apply → delta tail). Returns to the SKILL's **Handoff** when done.

## Revision (Edit) — Change an Approved Schema

The doc exists and the user wants to **change the approved schema** (a field, a type,
the scale, `belongs_to`, a `ref<>`). This is the **single sanctioned way** to record a
schema change: a manual `.md` edit without a version bump and a changelog entry is an
**unrecorded delta** — the code side reads the schema and assumes it is current
(`gd-authoring` → Content delta). A schema change is a code contract change (and
implies a **data migration** of existing units), so its delta discipline is **full**.

> **Not a schema edit → not here.** Adding/removing units, a `bulk` `count` change,
> editing a curated row's values = **catalog churn**: data, not contract. No version
> bump, no changelog (`gd-authoring` → Content delta). Apply it directly to the
> `content[]` rows / the editor and stop.

### Classify the scale of change (from the description)

Infer the change scale from the user's description. Announce the inferred scale in one
line, then proceed:

| Scale | Trigger | How it is applied |
|-------|---------|-------------------|
| **Tuning** | a field's `range` / `default` / `required` changes (no new/removed field, no type change) | targeted `Edit` to section B; one approval |
| **Tweak** | one field added or a `ref<>` target re-pointed, no type churn elsewhere | targeted `Edit` to the affected section(s); one approval |
| **Rework** | a field's **type** changes, a field is **removed**, or the **scale** flips (`bulk` ⇄ `curated`) — a data migration | derive affected sections → confirm → section-cycle, old-vs-new per section; name the migration |
| **Structural** | a **new system** `belongs_to`/`ref<SYS>` needs, or a `GAME.md` content change | **REDIRECT** — the content zone never writes the system roster or `GAME.md` content |

When the scale is unclear between two levels (e.g. a "tweak" that actually retypes a
field → Rework), ask rather than assume.

### Apply the change

**Tuning / Tweak — targeted edit**
1. Show the **old → new** for each field changing, with the WHY (theory from the
   loaded rules, consumer fit) — Explain → Capture.
2. Get **one approval** (`AskUserQuestion`).
3. `Edit` the affected section(s) anchored on the unique heading. Approved text
   elsewhere is never touched.

**Rework — section-cycle (old-vs-new)**
1. Derive the affected sections from the description (e.g. "retype condition to enum" →
   B Schema, maybe E Validation; "switch to curated" → C Scale & Generation + the
   header `> Scale:` + `GD-IDS` `scale:`) and **confirm the set** before editing.
2. For each affected section, in order, run the **section-cycle contract** with the
   section's **current content as the starting draft**: Context → Questions → Options
   (2–4, pros/cons, theory, one **(Recommended)**) → Decision → present **old vs new**
   + Approval **in the same reply** → Write (Edit anchored on the heading). Persist
   each approved section immediately.
3. **Name the data migration.** A type change / field removal / scale flip invalidates
   existing units; state how they migrate (default-fill, drop, transform) — this is the
   cost the schema-vs-values line buys.
4. **Registry check** (`gd-authoring`): every new field / `ref<>` / `belongs_to` vs
   `GD-IDS` facts; conflicts surface immediately — obey the registry / route a new
   system through `unikit-gd-spec` add-system / park it in section F. Never silently
   override.

**Structural — redirect (does not edit)**
The content zone does not write the system roster or `GAME.md` content. Redirect and
STOP:

```
This is a structural change (new system / GAME.md content), which is outside
/unikit-gd-content. Use:
- a new system belongs_to/ref<SYS> needs → /unikit-gd-spec (add-system) → then detail it via /unikit-gd-system
- a GAME.md content edit                 → /unikit-gd-spec
```

### Delta tail (MANDATORY for a schema edit — `gd-authoring`)

Every Tuning / Tweak / Rework **schema** edit ends with the **full delta tail owned by
`gd-authoring` → Delta Discipline** — Version +1 (the `CONTENT-TYPE.md` header **and**
the type's `version` in `GD-IDS.yaml`), the **latest delta only (K1)** changelog block
(it **replaces** the previous one; format + git-is-history owned there), a registry
check (new fields / `ref<>` vs `GD-IDS` — conflicts surface, never silently win). Apply
it verbatim; **catalog churn skips the tail entirely** (data, not a schema edit). The
**content-zone specifics** on top:

- **Status → `revised`** in the **two places that must agree** — the `CONTENT-TYPE.md`
  header `> Status:` token and the `GD-IDS.yaml` `doc_status` (`gd-lifecycle` → Content
  axis).
- **The zone delta line is the fields-delta** — `- Fields: + rarity (new); condition
  retyped float→enum; **durability removed**` — the content counterpart of a system's
  AC-delta; add a `- Migration: <how existing units are migrated>` line (a schema change
  implies a data migration of the existing units). Cite a closed review finding in the
  essence: `… (RF-2026-06-14-2)`.
- **Final:** re-render the map (regen-on-write — `## Content Map [gen]`, `[gen]` block
  only, with the `· partial (n/m)` suffix when a `<!-- deferred -->` is present), then
  **recommend `unikit-gd-verify`** (changed scope) — it re-checks schema vs registry,
  appends the `Affected` line, and re-renders any stale `[gen]` block (freshness).
