# Internal Design Lens — Explore's Own-Design Research Engine

The *how* of an **internal** design read: the protocol `unikit-gd-explore` loads on
demand when a prompt asks to **improve an existing system** or **work out a new
mechanic** for *this* game's GDD (not dissect a reference, not scan a market). The
*when/what* — the signal table, the decision rule, and the 3-way handoff routing
that trigger this load — lives in `unikit-gd-explore/SKILL.md` → "Internal design
lens — when it engages". This file is **method, not process**, the same split
`market-scan.md` keeps for the market lens.

The lens stays inside Explore's stance: **research only, read-only, it never writes
the GDD.** It produces a research record and a hand-off brief; the design change
itself is authored by the routed owner skill (`unikit-gd-spec` / `unikit-gd-system`).
Announce the read-only boundary when entering the lens and
again at handoff — the user should never expect this skill to edit `GAME.md` or a
system doc.

## Governing stance

- **Diagnose, don't prescribe** (`gd-critique` → Critique Stance). Name the tension
  and its evidence ("FORM-damage flattens past attack 40, which undercuts PIL-2's
  'patience over aggression' test"), then offer options — never a single decreed fix.
- **Grounded in this game.** Anchor every option to a pillar (`PIL-n`), a target
  aesthetic, or a locked registry fact — not to generic theory. An option that serves
  no pillar is a flag, not a feature.
- **Evidence over opinion.** A claim with no reference (a reference game, a loaded
  domain rule, a registry fact) is a hypothesis — mark it as one.
- **Respect the registry.** Treat every `GD-IDS.yaml` value the lens reads as a hard
  constraint. The lens *proposes* changing a fact; it never assumes the change.

## Deep-read protocol (read-only)

Before diagnosing or designing, silently read the target's full context — the lens is
only as good as the design it has actually read:

1. **`GAME.md`** — pillars (`PIL-n`) and their design tests, target aesthetics, the
   loop stack, non-goals. Every option is measured against these.
2. **`GAME.md` `## System Map [gen]`** — the read-only roster render: the target's
   row (category, tier, Depends, Status) and its neighbourhood on the map (the
   machine truth is `GD-IDS`, read next).
3. **`GD-IDS.yaml`** — locked facts the target must stay consistent with: the pillars
   it `implements`, entities, formulas, terms, plus the target's own
   `doc_status` / `version` / `implemented_version`.
4. **The target `systems/SYS-<slug>.md`** — all sections A–K, when the doc exists.
   For a brand-new mechanic with no doc, read the would-be neighbours instead.
5. **Depends-neighbours** — for each system the target depends on (or that depends on
   it), read sections **D (Formulas)** and **F (Dependencies)** so an option respects
   the existing data interfaces.
6. **Recent `reviews/`** — open `unikit-gd-verify` conflicts and `unikit-gd-review`
   findings for the target. An open `RF-<date>-n` finding is an input (see "RF bridge").

**Flow targets (the dynamics axis).** When the target is a `FLOW-<slug>` (improve a
flow) or a player-facing sequence with no flow yet (new flow), the deep-read mirrors
the system read but on the dynamics axis: read `GAME.md`'s **loop stack**, **target
aesthetics**, and **`## Win / Lose Conditions`** (a terminal `GOAL` realizes each);
the `FLOW.md` (sections A–F) when it exists; `GD-IDS` `flows` (the target's `mode`,
`goals`, `depends_on`) and `events`; the `## Flow Map [gen]` / `## Funnel [gen]`
read-only renders; and the **exercised systems'** sections **B (Player Fantasy)**,
**C (Core Rules)**, and **H (Acceptance Criteria)** so each `GOAL` lands on a real
rule/AC and the promised feeling is grounded.

**Content targets (the catalog axis).** When the target is a `CT-<slug>` (improve a
content type / its schema) or a catalog with no content type yet (new content area), the
deep-read works on **two altitudes** — the *schema* and the *catalog space*: read
`GAME.md`'s pillars and target aesthetics; the `CONTENT-TYPE.md` (sections A–F) when it
exists; `GD-IDS` `content_types` (the target's `scale`, `belongs_to`, `CT.fields`) plus
the `content` units it carries and any `resources` it references; the
`## Content Map [gen]` read-only render; and the **`belongs_to` system's** sections **B
(Player Fantasy)** and **C (Core Rules)** so the schema covers what that system needs to
read and the catalog delivers the promised feeling. The two altitudes: altitude 1 is the
**schema** (`CT.fields` / `scale` / `belongs_to`); altitude 2 is the **catalog space**
(what the units are, how many, how they are generated).

**One-way boundary — this lens reasons about *design*, not code:** by itself the
internal-design lens does not read `.unikit/code/`, project source, or build artifacts —
it works from the GDD. When the prompt **also** triggers the **code-grounded lens**
(`SKILL.md` → "Code-grounded lens — when it engages"), that lens — the sanctioned third
exception to the one-way boundary, shared with `unikit-gd-recon` — reads the named code
slice read-only and folds `provenance: extracted from code` findings into the same brief.
The two run together; neither edits the GDD or the code.

**Pre-GDD source (RECON-input mode).** When `unikit-gd-explore` enters the lens on a
`RECON.md` argument — the pre-GDD carve-out, no GDD yet (`SKILL.md` → "RECON-input mode") —
there is **no `GAME.md` or system doc** to deep-read: **`RECON.md` is the candidate design
surface**. Read its `## Systems` / `## Content Types` / `## Resources · Entities · Forms`
(the reconstructed skeleton, `provenance: extracted from code` — held ≥ Major), its
`## Provided Context` (author intent), and treat the **`## Intent Gap`** as the
open-questions registry the closure pass works through. Facts carried from the
reconstructed sections into the brief stay tagged `extracted from code`; the designer's
worked-out decisions on top are untagged. The route here is **`/unikit-gd-spec` import**
(not add-system), and the research is saved the normal way plus a `research:` backlink into
RECON.md's `## Explorations` (the asymmetry with review-file mode).

## Domain → rules to ground options

Read the behavioural **domain** from the target's name and Overview (the behaviour it
drives), **not** from the coarse `GD-IDS` `category`; on an ambiguous or coarse
category, confirm the domain with one `AskUserQuestion`. Load the matching core rules
(plus any studio `library` rule on the topic) so options carry theory. Domains are
opt-in and combinable — this is the **same keying vocabulary** `unikit-gd-system` uses
in its Phase 0 table (kept in sync, not byte-identical — this table loads rules to
*ground options*, its to *author sections*):

| Domain | Core rules to ground options |
|--------|------------------------------|
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
| meta / other | `frameworks`, `core-loops` |

## The lens flow

1. **Diagnose (improvement) or frame (new feature).**
   - *Improvement* — measure the current design against its pillars, target
     aesthetics, and the locked facts; name each tension with its evidence (the
     document section AND the contradicted fact/pillar/rule).
   - *New feature* — state which pillar(s) the mechanic must serve and which loop it
     plugs into; a mechanic serving no pillar is mis-scoped, surface that.
2. **Design options.** For each tension or design question, present **2–4 options**
   across the axes that matter (depth, readability, feel, dev-cost, retention,
   registry blast-radius), each with pros/cons and the theory from the loaded rules.
   Mark exactly **one (Recommended)** with the WHY, and defer the choice to the user
   (`gd-principles` anti-anchoring — state your own preference only after the user
   picks).
3. **Open-questions registry + closure pass.** Maintain a lightweight registry of the
   open questions the lens raises. Then run a **closure pass**: take each open
   question in turn → present 2–4 options + one (Recommended) → capture the user's
   decision (`AskUserQuestion`) → mark it closed. Repeat until the registry is empty,
   or the user explicitly defers the rest — unresolved items then ride into the
   brief's "Open questions" so they are not lost across a `/clear`. When evidence is
   thin for a question, a `WebSearch` is allowed (Explore only) before re-offering.

## Mode-aware brief — two blocks

The lens extends the **existing** `RESEARCH_BRIEF.md` (it does **not** invent a new
file, and it does **not** put these blocks in `RESEARCH_RESULT.md` — that file is the
full record). Emit the block that matches the resolved route; for a multi-target run,
emit one block per target. The block headings are **stable English anchors** so
`unikit-gd-system` finds them deterministically after a `/clear`, regardless of the
artifact's content language.

### `## Improvement Plan` — for `/unikit-gd-system`

For a system whose doc is already `detailed` / `reviewed` / `revised`. Fields:

- **Target**: `SYS-<slug>` · **Expected scale**: Tuning | Tweak | Rework (the
  `unikit-gd-system` classifier — let it confirm, this is the prediction).
- **Change**: ready-to-apply delta lines — `<Section>: <old> → <new>` per value/rule.
- **Touched GD-IDS facts**: entities/formulas/terms the delta moves (or `N/A`).
- **Rejected alternatives**: the options not taken, one line each, with the WHY-not.
- **Closes finding**: `RF-<date>-n` when the change resolves an open review finding
  (see "RF bridge"), else `N/A`.
- **Open questions**: anything the closure pass deferred.

### `## New Feature Plan` — for `/unikit-gd-spec` (add-system) → `/unikit-gd-system`

For a mechanic with **no system on the map yet**. Two parts:

- **Map fields** (for `unikit-gd-spec` add-system): proposed slug, Category, Tier,
  `implements: [PIL-n]` (≥1 — the coverage gate), `depends_on` (symmetric edges).
- **Section seeds** (for `unikit-gd-system` to pre-fill the section-cycle): the A–K
  content the lens worked out — Overview, Player Fantasy, Core Rules, draft Formulas,
  Edge Cases, candidate Tuning Knobs, draft Acceptance Criteria. These seeds are
  **untagged normal authored content** — `unikit-gd-system` does **not** mark them
  `extracted` / `generated` (those markers are for imports only; `gd-provenance` →
  Provenance).

### `## Flow Improvement Plan` — for `/unikit-gd-flow`

For a flow whose doc is already `detailed` / `reviewed` / `revised`. The flow axes are
**pacing** (does the tension arc rise and release?), **guidance** (is each `GOAL` step
legible — trigger → expected action → feedback?), **wiring-mode** fit, and **funnel**
coverage. Fields:

- **Target**: `FLOW-<slug>` · **Expected scale**: Tuning | Tweak | Rework (the
  `unikit-gd-flow` classifier — let it confirm, this is the prediction).
- **Change**: ready-to-apply delta lines — `<Section>: <old> → <new>` per
  GOAL / beat / cue / event (or a `mode` change).
- **Touched GD-IDS facts**: the `goals` / `events` / `depends_on` the delta moves
  (or `N/A`).
- **Rejected alternatives**: the options not taken, one line each, with the WHY-not.
- **Closes finding**: `RF-<date>-n` when the change resolves an open review finding
  (see "RF bridge"), else `N/A`.
- **Open questions**: anything the closure pass deferred.

### `## Flow Feature Plan` — for `/unikit-gd-flow` (create + register)

For a player-facing sequence with **no flow on the map yet**. A flow **registers
itself**, so this routes **straight to `/unikit-gd-flow`** — there is **no add-flow in
`unikit-gd-spec`** (unlike the system New Feature Plan, which goes through add-system
first). Two parts:

- **Flow fields** (for `unikit-gd-flow` to register the `flows[]` row): proposed slug,
  candidate `mode` (linear | conditional | emergent, with the WHY from genre/pillars),
  `implements: [PIL-n]` (≥1 — the pillar the flow serves), `depends_on: [SYS-ids]` (the
  systems its `GOAL`s exercise — route any **missing** system through `/unikit-gd-spec`
  add-system, never invent the roster row).
- **Section seeds** (for `unikit-gd-flow` to pre-fill the section-cycle): the A–F
  content the lens worked out — Overview, the objective-flow `GOAL`s (or the affordance
  set for `emergent`), Pacing (beats or envelope), Dependencies, Events. These seeds
  are **untagged normal authored content** — the import-only `extracted` / `generated`
  markers do not apply (`gd-provenance` → Provenance).

### `## Content Improvement Plan` — for `/unikit-gd-content`

For a content type whose doc is already `detailed` / `reviewed` / `revised`. Work the
**two altitudes** — the *schema* (`CT.fields` / `scale` / `belongs_to`) and the *catalog
space* (the units, their volume, generation). Fields:

- **Target**: `CT-<slug>` · **Expected scale**: Tuning | Tweak | Rework (the
  `unikit-gd-content` classifier — let it confirm, this is the prediction).
- **Change**: ready-to-apply delta lines — `<Section>: <old> → <new>` per field / type /
  `ref<>` / `scale` (the **schema** delta — catalog churn is data, not a brief).
- **Touched GD-IDS facts**: the `CT.fields` / `scale` / `belongs_to` / referenced
  `resources` the delta moves (or `N/A`).
- **Rejected alternatives**: the options not taken, one line each, with the WHY-not.
- **Closes finding**: `RF-<date>-n` when the change resolves an open review finding
  (see "RF bridge"), else `N/A`.
- **Open questions**: anything the closure pass deferred.

### `## Content Feature Plan` — for `/unikit-gd-content` (create + register)

For a content area with **no content type on the map yet**. A content type **registers
itself**, so this routes **straight to `/unikit-gd-content`** — there is **no add-content
in `unikit-gd-spec`** (like the Flow Feature Plan, unlike the system New Feature Plan).
Two parts:

- **Type fields** (for `unikit-gd-content` to register the `content_types[]` row):
  proposed slug, candidate `scale` (bulk | curated, with the WHY from the catalog space),
  `belongs_to: SYS-<slug>` (the consuming system — route any **missing** system through
  `/unikit-gd-spec` add-system, never invent the roster row), and the candidate
  `CT.fields` schema (typed, with any `ref<>` links).
- **Section seeds** (for `unikit-gd-content` to pre-fill the section-cycle): the A–F
  content the lens worked out — Overview, the `CT.fields` schema, Scale & Generation (the
  `count` + `spec` for `bulk`, or the curated catalog shape), Relationships (`belongs_to`
  + `ref<>`), Validation. These seeds are **untagged normal authored content** — the
  import-only `extracted` / `generated` markers do not apply (`gd-provenance` →
  Provenance).

Fill any field with `N/A` rather than inventing content the lens did not cover.

## Multi-target order

When the prompt names several targets, do not interleave them. Produce an **ordered
list of follow-up calls**, dependency-sorted (a system others depend on is improved
before its dependents), each as its own brief block with its own route. The brief's
Next Steps lists the calls in that order so the user runs them without re-deriving the
sequence.

## RF bridge

When the lens addresses an open `unikit-gd-review` finding, carry its stable
`RF-<YYYY-MM-DD>-<n>` id into the Improvement Plan's **Closes finding** field. The
`RF-<date>-n` format is owned by `unikit-gd-review`; the lens only references it so
`unikit-gd-system` can cite the closed finding in its changelog essence
(`… (RF-2026-06-14-2)`).

## Research tags & the discovery contract

So a downstream skill finds this research deterministically across a `/clear`, tag it
on save (the SKILL "Saving Research Results" step writes these):

- **`RESEARCH_RESULT.md` header** — add `Target: SYS-<slug>`, `Target: FLOW-<slug>`, **or**
  `Target: CONTENT-<slug>` and `Kind: feature | improvement` (English tokens, like every
  stored id/value).
- **`researches/INDEX.md` entry** — add a `**Target**: SYS-<slug> | FLOW-<slug> |
  CONTENT-<slug>` field to the row.

The hand-off ownership (do **not** write these here — the lens is read-only; this is
what the *routed* skills do):

- `unikit-gd-spec` (add-system), when it seeds a new **system** from a New Feature Plan,
  writes the **authoritative pointer** `research: researches/<folder-name>/` into the
  system's `GD-IDS.yaml` entry. The value is a **non-id path**, not a registry id, so
  `unikit-gd-verify` never tries to resolve it.
- `unikit-gd-flow`, when it registers a new **flow** from a Flow Feature Plan, writes
  the same `research:` pointer into the `flows[]` entry — the flow zone owns its own row
  (there is **no add-flow in `unikit-gd-spec`**), so the flow pointer is written by
  `unikit-gd-flow`, not `unikit-gd-spec`. Same non-id-path semantics.
- `unikit-gd-content`, when it registers a new **content type** from a Content Feature
  Plan, writes the same `research:` pointer into the `content_types[]` entry — the content
  zone owns its own row (there is **no add-content in `unikit-gd-spec`**), so the content
  pointer is written by `unikit-gd-content`. Same non-id-path semantics.
- `unikit-gd-system` / `unikit-gd-flow` / `unikit-gd-content` discover the research by
  **`GD-IDS` `research:` (authoritative) → `researches/INDEX.md` `Target:` (fallback)`**
  — the project's standard "registry pointer, disk fallback" idiom — then pre-fill their
  drafts/deltas from the matching brief block (`## Improvement Plan` / `## New Feature
  Plan` for systems, `## Flow Improvement Plan` / `## Flow Feature Plan` for flows,
  `## Content Improvement Plan` / `## Content Feature Plan` for content types).
