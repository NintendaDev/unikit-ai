# Revision mode (Edit) — body

Loaded on demand by `unikit-gd-system/SKILL.md` → "Load the Mode Body" when Phase 2
resolves the mode to **Edit**. The SKILL keeps Phase 0–2 + the switch + Phase 6; this
file is the revision body (classify → apply → delta tail). Returns to the SKILL's
**Phase 6** (Final) when done.

## Revision (Edit) — Change an Approved System

The doc exists and the user wants to **change approved content**. This is the
**single sanctioned way** to record a design change to a system: a manual `.md`
edit without a version bump and a changelog entry is an **unrecorded delta** — the
planning side sees the same version and assumes the code is current
(`gd-authoring` → Delta Discipline).

### Classify the scale (from the description)

Infer the change scale from the user's description (the CCGS `quick-design`
classifier). Announce the inferred scale in one line, then proceed:

| Scale | Trigger | How it is applied |
|-------|---------|-------------------|
| **Tuning** | a number changes ("raise damage by 10%", "drop the cap to 5") | targeted `Edit` to section G (knobs) and/or C; one approval |
| **Tweak** | a small rule change with **no new states/branches** | targeted `Edit` to the affected section; one approval |
| **Rework** | restructuring a system ("rework the status system", "redo the economy loop") | derive affected sections from the prompt → confirm → section-cycle, old-vs-new per section |
| **Structural** | a **new system**, a change to the map's composition, or a `GAME.md` content/pillar change | **REDIRECT** — the system zone never touches structure or `GAME.md` |

When the scale is unclear between two levels (e.g. a "tweak" that actually adds a
new state → Rework), ask rather than assume.

### Apply the change

**Tuning / Tweak — targeted edit**
1. Show the **old → new** for each value/rule changing, with the WHY (theory from
   the loaded rules, pillar alignment) — Explain → Capture.
2. Get **one approval** (`AskUserQuestion`).
3. `Edit` the affected section(s) anchored on the unique heading. Approved text
   elsewhere is never touched.

**Rework — section-cycle (old-vs-new)**
1. Derive the affected sections from the description (e.g. "statuses" → C Core
   Rules, D Formulas, E Edge Cases) and **confirm the set** before editing.
2. For each affected section, in order, run the **section-cycle contract from
   `gd-authoring`**, with the section's **current content as the starting draft**:
   Context → Questions → Options (2–4, pros/cons, theory, one **(Recommended)**) →
   Decision → present **old vs new** + Approval **in the same reply** → Write
   (Edit anchored on the heading). Persist each approved section immediately.
3. **Registry check after C and D** (`gd-authoring`): every new number/name vs
   GD-IDS facts; conflicts surface immediately — obey the registry / change it via
   a `unikit-gd-verify` resolution / park it in section K. Never silently override.
4. Re-derive any affected **acceptance criteria (H)**: new ACs get the next stable
   number; changed ACs keep their id; obsolete ACs are marked removed (their
   numbers are never reused). The AC delta feeds the changelog line below.

**Structural — redirect (does not edit)**
The system zone does not change structure or `GAME.md`. Redirect and STOP:

```
This is a structural change (new system / map composition / GAME.md content),
which is outside /unikit-gd-system. Use:
- a brand-new system               → /unikit-gd-spec (add-system) → then detail it here
- the system map or a GAME.md edit  → /unikit-gd-spec
```

**Escalation:** if a system edit hits a pillar or loop constraint, the real change
is in `GAME.md` content (`/unikit-gd-spec`) or the map (`/unikit-gd-spec` remap).
Name the escalation; do not force-fit it into the current document.

### Delta tail (MANDATORY — `gd-authoring`)

Every Tuning / Tweak / Rework edit ends with the **full delta tail owned by
`gd-authoring` → Delta Discipline** — Version +1 (the `SYSTEM.md` header **and** the
system's `version` in `GD-IDS.yaml`), the **latest delta only (K1)** changelog block
(it **replaces** the previous one, never accumulates; the block format + the
git-is-history rule are owned there), a registry check (new numbers/names vs `GD-IDS`
facts — conflicts surface, never silently win), and `unikit-gd-verify` (changed scope)
at the end. Apply it verbatim; the **system-zone specifics** on top:

- **Status → `revised`** in the **two places that must agree** — the `SYSTEM.md` header
  `> Status:` token (inside the combined header line, not a separate bold line) and the
  `GD-IDS.yaml` `doc_status` (`gd-lifecycle`). This skill marks **only the edited
  system**; `unikit-gd-verify` marks affected **dependents** `revised` (verdict-gated).
  Each stays in the loop until `unikit-gd-review` clears it back to `reviewed`.
- **The zone delta line is the AC-delta** — `- AC: + AC-<sys>-7, AC-<sys>-8 (new);
  AC-<sys>-3 changed; **AC-<sys>-5 removed**` — mandatory; the planning side consumes
  exactly this line to build delta plans. Cite a closed review finding in the essence:
  `… (RF-2026-06-14-2)`.
- **Final:** `unikit-gd-verify` computes dependent impact, appends the `Affected
  (gd-verify):` line, and re-renders the stale `## System Map [gen]` (freshness).
