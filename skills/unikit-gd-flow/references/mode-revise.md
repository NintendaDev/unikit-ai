# Revision mode (Edit) — body

Loaded on demand by `unikit-gd-flow/SKILL.md` → "Load the Mode Body" when Phase 2
resolves the mode to **Edit**. The SKILL keeps Phase 0–2 + the switch + Phase 6; this
file is the revision body (classify → apply → delta tail). Returns to the SKILL's
**Handoff** when done.

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

Every Tuning / Tweak / Rework edit ends with the **full delta tail owned by
`gd-authoring` → Delta Discipline** — Version +1 (the `FLOW.md` header **and** the
flow's `version` in `GD-IDS.yaml`), the **latest delta only (K1)** changelog block (it
**replaces** the previous one, never accumulates; format + git-is-history owned there),
a registry check (new `GOAL`s / dependencies / events vs `GD-IDS` — conflicts surface,
never silently win). Apply it verbatim; the **flow-zone specifics** on top:

- **Status → `revised`** in the **two places that must agree** — the `FLOW.md` header
  `> Status:` token and the `GD-IDS.yaml` `doc_status` (`gd-lifecycle`). This skill marks
  **only the edited flow**; `unikit-gd-verify` marks affected **dependents** `revised`
  (cross-axis, verdict-gated). Each stays in the loop until `unikit-gd-review` clears it.
- **The zone delta line is the GOAL-delta** — `- GOAL: + GOAL-<flow>-3 (new);
  GOAL-<flow>-2 changed; **GOAL-<flow>-1 removed**` — the flow counterpart of a system's
  AC-delta; add an **event delta** line when funnel events change. Cite a closed review
  finding in the essence: `… (RF-2026-06-14-2)`.
- **Final:** re-render the maps (regen-on-write — `## Flow Map [gen]` + `## Funnel
  [gen]`, `[gen]` blocks only, with the `· partial (n/m)` suffix when a
  `<!-- deferred -->` is present), then **recommend `unikit-gd-verify`** (changed scope)
  — it computes cross-axis impact on dependent flows, appends the `Affected` line, and
  re-renders any stale `[gen]` block (freshness).
