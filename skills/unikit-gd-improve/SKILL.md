---
name: unikit-gd-improve
description: >-
  Revise an already-approved game design document — a per-system GDD or GAME.md — after it
  was written. This is the one sanctioned way to record a design change: every edit
  classifies the change scale (a number change is Tuning, a small rule is a Tweak,
  restructuring a system is a Rework), bumps the version, appends a changelog entry, and
  re-checks the facts registry. Use when the user wants to actually change something in the
  design, e.g. "raise the damage by 10%", "tune the economy", "rework the status system",
  "change this rule", "update the combat GDD", "nerf X", "rebalance Y". A new system or map
  change is Structural and redirects to /unikit-gd-detail or /unikit-gd-spec. To explore
  options without committing a change use /unikit-gd-explore.
argument-hint: "<system name | SYS-slug | GAME.md> \"<what to change>\"  (scale inferred; no flags)"
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

# Game Design — Revise an Approved Document

Edit an **already-approved** design document — a per-system GDD
(`.unikit/gamedesign/systems/SYS-<slug>.md`) or the **content** of `GAME.md` —
and record the change as a versioned delta. This is the **single sanctioned way**
to change approved design: a manual `.md` edit without a version bump and a
changelog entry is an unrecorded delta — the planning side sees the same version
and assumes the code is current (`gd-principles` → Delta Discipline).

This skill **never creates** documents (that is `unikit-gd-detail` / `unikit-gd-spec`)
and **never touches structure** — which systems exist, the map, a new master spec.
Structural changes redirect to the owner skill.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and artifacts (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values stay English. Do not announce the language setting.

## Phase 0 — Bootstrap

Silently load — do not narrate:

1. **`.unikit/system/gd-principles.md`** — the working contract. **Delta
   discipline** (the mandatory Version +1 → changelog block → registry-check →
   recommend-verify tail), the **section-cycle** contract (used by Rework), the
   collaborative protocol, the facts registry / ID conventions, language rules,
   and the severity rubric all live there. This skill **applies** that contract;
   it does not restate the mechanics. If the file is missing, warn
   (`unikit-ai update`) and fall back to the tail summarized in this file.
2. **`.unikit/gamedesign/GD-INDEX.md`** and **`.unikit/gamedesign/GD-IDS.yaml`** —
   the system map and the facts registry (current values are constraints).
3. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — load the **core** domain rules
   for the target system's **behavioural domain** (the same domain vocabulary as
   `unikit-gd-detail` Phase 0 — read from the system's name/behaviour, not the
   coarse GD-INDEX `Category`) on demand by `Load When` (plus any studio `library`
   rule on the same topic), so options are grounded in theory:

   | Target domain | Core rules to load |
   |---------------|--------------------|
   | combat / mechanics | `balance`, `frameworks` |
   | ai-behavior | `balance`, `frameworks` |
   | economy / loot | `economy`, `balance` |
   | progression / unlock | `progression`, `balance` |
   | level / content | `level-design` |
   | narrative / dialogue | `narrative` |
   | ui / onboarding | `ux-onboarding` |
   | liveops / events | `liveops`, `economy` |
   | persistence | `progression` |
   | monetization | `monetization-ethics`, `economy` |
   | meta / GAME.md | `frameworks`, `core-loops` |

4. **`.unikit/RULES.md`** (if present) — project overrides, highest priority.

**One-way boundary:** never read `.unikit/code/`, project source, or build
artifacts. This skill reads only design documents and the registry.

## Phase 1 — Resolve the Target (no flags)

The argument is `<target> "<what to change>"`. Resolve the target document from the
argument and the prompt; on ambiguity, **ask — never guess** (`gd-principles`):

1. The argument names a system (`SYS-<slug>`, a system name, or a path under
   `systems/`) → that GDD.
2. The argument is `GAME.md` (or the change clearly concerns pillars, loops, the
   core fantasy, or non-goals) → `GAME.md` **content** (not its structure).
3. The target is unclear (no argument, or matches several rows / none):

   ```
   AskUserQuestion: Which document should I revise?
   Options: <each detailed/reviewed system from GD-INDEX> · GAME.md · None
   ```

If the resolved document does **not exist** yet, stop: there is nothing to
improve — recommend `/unikit-gd-detail <system>` (new system) or
`/unikit-gd-spec` (new master spec), and STOP.

Read the target document and the neighbor context the change depends on (the
Depends rows' headers and sections **D**/**F**, like `unikit-gd-detail` Phase 1).

**Explore research (internal design lens).** If the change originated from an
`unikit-gd-explore` brief, discover it **deterministically** (survives a `/clear`),
the same lookup `unikit-gd-detail` uses: read the system's `GD-IDS` `research:`
pointer (authoritative), falling back to the `researches/INDEX.md` entry whose
`Target:` is this `SYS-<slug>`. Read that brief's **`## Improvement Plan`** block and
pre-fill the change set from it — the ready-to-apply delta lines (`<Section>: <old> →
<new>`), the **expected scale** (a prediction Phase 2 confirms, never blindly
accepts), the touched GD-IDS facts, the rejected alternatives, and any
`RF-<date>-n` it closes (cite it in the changelog essence, Phase 4). The user still
approves every edit — the brief is a draft, not an approved change.

## Phase 2 — Classify the Scale (from the description)

Infer the change scale from the user's description — the same classifier as CCGS
`quick-design`. Announce the inferred scale in one line, then proceed:

| Scale | Trigger | How it is applied |
|-------|---------|-------------------|
| **Tuning** | a number changes ("raise damage by 10%", "drop the cap to 5") | targeted `Edit` to section G (knobs) and/or C; one approval |
| **Tweak** | a small rule change with **no new states/branches** | targeted `Edit` to the affected section; one approval |
| **Rework** | restructuring a system ("rework the status system", "redo the economy loop") | derive affected sections from the prompt → confirm → section-cycle, old-vs-new per section |
| **Structural** | a **new system**, a change to the map's composition, or a new master spec | **REDIRECT** — improve never touches structure |

When the scale is unclear between two levels (e.g. a "tweak" that actually adds a
new state → Rework), ask rather than assume.

## Phase 3 — Apply the Change

### Tuning / Tweak — targeted edit
1. Show the **old → new** for each value/rule changing, with the WHY (theory from
   the loaded rules, pillar alignment) — Explain → Capture.
2. Get **one approval** (`AskUserQuestion`).
3. `Edit` the affected section(s) anchored on the unique heading. Approved text
   elsewhere is never touched.

### Rework — section-cycle (old-vs-new)
1. Derive the affected sections from the description (e.g. "statuses" → C Core
   Rules, D Formulas, E Edge Cases) and **confirm the set** before editing.
2. For each affected section, in order, run the **section-cycle contract from
   `gd-principles`**, with the section's **current content as the starting draft**:
   Context → Questions → Options (2–4, pros/cons, theory, one **(Recommended)**) →
   Decision → present **old vs new** + Approval **in the same reply** → Write
   (Edit anchored on the heading). Persist each approved section immediately.
3. **Registry check after C and D** (`gd-principles`): every new number/name vs
   GD-IDS facts; conflicts surface immediately — obey the registry / change it via
   a `unikit-gd-verify` resolution / park it in section K. Never silently override.
4. Re-derive any affected **acceptance criteria (H)**: new ACs get the next stable
   number; changed ACs keep their id; obsolete ACs are marked removed (their
   numbers are never reused). The AC delta feeds the changelog line below.

### Structural — redirect (does not edit)
Improve does not change structure. Redirect and STOP:

```
This is a structural change (new system / map composition / new master spec),
which is outside /unikit-gd-improve. Use:
- a brand-new system          → /unikit-gd-spec (add-system) → then /unikit-gd-detail
- an existing system's placeholders → /unikit-gd-detail <system>
- the system map or a new GAME.md    → /unikit-gd-spec
```

**Escalation:** if a detail edit hits a pillar or loop constraint, the real change
is in `GAME.md` content (re-run this skill on `GAME.md`) or the map (redirect to
`/unikit-gd-spec` remap). Name the escalation; do not force-fit it into the
current document.

## Phase 4 — Delta Tail (MANDATORY — `gd-principles`)

Every Tuning / Tweak / Rework edit ends with the full tail; this is non-optional:

1. **Version +1** in the document header **and** in its `GD-INDEX.md` row; bump
   `version` in `GD-IDS.yaml`. Set the system's Status → `revised` in **all three
   coherent places**: the `SYSTEM.md` header (the `> Status:` token in the combined
   header line, not a separate bold line), the `GD-INDEX.md` row, and the
   `GD-IDS.yaml` `doc_status` (see gd-principles → Lifecycle & Status).

   **GAME.md carve-out** (target is `GAME.md`, not a system — canonical contract in
   gd-principles → Delta Discipline): bump the version **only** in the GAME.md header
   `> **Version**:` line. GAME.md has no `GD-INDEX.md` Ver column and no `GD-IDS.yaml`
   `systems` row, so there is nothing else to bump; its status stays
   `drafted | approved` and is **never** set to `revised`, and there is **no** 3-place
   coherence to keep.
2. **Changelog block** appended to section **K** (for a system) or to GAME.md's
   **`## Changelog`** section (for `GAME.md`) — format owned by `gd-principles`:

   ```markdown
   #### v<N> — <YYYY-MM-DD> — <essence of the change> (DD-<n>)
   - <Section>: <what changed>
   - AC: + AC-<sys>-7, AC-<sys>-8 (new); AC-<sys>-3 changed; **AC-<sys>-5 removed**
   ```

   The **AC-delta line** (new / changed / removed) is mandatory — the planning
   side consumes exactly this line to build delta plans. The `Affected
   (gd-verify):` line is added later by `unikit-gd-verify`, never here — it is a
   **human-readable record** of the impact pass, not what drives re-verification.
   When the edit **closes a `unikit-gd-review` finding**, cite its stable id in the
   essence: `… (DD-3; RF-2026-06-14-2)` — the `RF-<YYYY-MM-DD>-<n>` format is owned
   by `unikit-gd-review`.
   The pending-loop is driven by `Status: revised` itself: this skill marks **only
   the edited system** `revised` (step 1), and `unikit-gd-verify` marks affected
   **dependents** `revised` (verdict-gated). Each stays in the loop until
   `unikit-gd-review` clears it back to `reviewed`.

   **For `GAME.md`** the changelog block is **light** (gd-principles → Delta
   Discipline): version, date, essence, and one line per changed section — **no**
   AC-delta line and **no** `Affected (gd-verify):` line (GAME.md is a one-pager, not
   a system), and there is no `revised` pending-loop to drive.
3. **Registry check:** new numbers/names vs GD-IDS facts — conflicts surface, they
   never silently win. A significant decision also gets a **`DD-<n>`** record in
   `GD-IDS.yaml` `decisions` (options, rationale, affected systems).
4. **Recommend `unikit-gd-verify`** (changed scope) — it computes the impact on
   dependent systems and appends the `Affected` line.

## Phase 5 — Handoff

```
AskUserQuestion: <doc> revised to v<N>. What's next?

Options:
1. Verify the change impact — /unikit-gd-verify <SYS-slug> (recommended)
2. Review the revised design — /unikit-gd-review systems/SYS-<slug>.md (fresh session)
3. Nothing — I'll continue later
```

`unikit-gd-verify` is the recommended next step: it appends the `Affected` line to
the changelog and flags dependent systems that need re-review.

## Final: Compact Report

```
Target: <SYS-slug | GAME.md> — <name>
Scale: <tuning | tweak | rework | structural-redirect>
Sections edited: <list>  (or: redirected — no edit)
Version: v<prev> → v<new>   Status: revised
Changelog: appended to section K
AC delta: +<n> / changed <n> / removed <n>
Registry: <facts touched>   DD: <DD-n if any>
```

For a **`GAME.md`** target the report reflects the carve-out: `Status: <drafted |
approved> (unchanged)`, `Changelog: appended to GAME.md ## Changelog` (not section
K), and `AC delta: —` (GAME.md is not a system).

No summary document, no report file.

## Ownership Boundaries

- **Owns:** content edits to approved `systems/SYS-<slug>.md` and `GAME.md`
  sections; the version bump and changelog block for that edit. For a **system**
  edit this also includes the `revised` status (3-place) and the AC-delta line; a
  **`GAME.md`** edit carries neither — GAME.md keeps its `drafted | approved` status
  and has no AC delta (gd-principles → Delta Discipline).
- **Not this skill:** creating a document or filling placeholders →
  `unikit-gd-detail`; `GAME.md` structure / the system map / a new master →
  `unikit-gd-spec`; quality verdicts → `unikit-gd-review`; consistency &
  impact → `unikit-gd-verify`.
- **Never:** edit without approval; skip the version bump or changelog (unrecorded
  delta); change a `GD-IDS.yaml` value silently; delete or renumber an ID; touch
  structure; read the code workspace or project source.

## Quick Reference

```
/unikit-gd-improve SYS-combat "raise grunt damage by 10%"   → Tuning: Edit G/C, one approval
/unikit-gd-improve combat "small fix to the parry rule"     → Tweak: targeted edit
/unikit-gd-improve SYS-combat "rework the status system"    → Rework: section-cycle old-vs-new
/unikit-gd-improve GAME.md "sharpen pillar 2"               → GAME.md content edit
/unikit-gd-improve "add a crafting system"                  → Structural: redirect to gd-spec (add-system) → gd-detail
```
