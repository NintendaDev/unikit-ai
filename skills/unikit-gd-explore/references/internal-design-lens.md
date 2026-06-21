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
itself is authored by the routed owner skill (`unikit-gd-spec` / `unikit-gd-detail`
/ `unikit-gd-improve`). Announce the read-only boundary when entering the lens and
again at handoff — the user should never expect this skill to edit `GAME.md` or a
system doc.

## Governing stance

- **Diagnose, don't prescribe** (`gd-principles` → Critique Stance). Name the tension
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
2. **`GD-INDEX.md`** — the target system's row (category, tier, Depends, Status, Doc)
   and its neighbourhood on the map.
3. **`GD-IDS.yaml`** — locked facts the target must stay consistent with: the pillars
   it `implements`, entities, formulas, terms, decisions, plus the target's own
   `doc_status` / `version` / `implemented_version`.
4. **The target `systems/SYS-<slug>.md`** — all sections A–K, when the doc exists.
   For a brand-new mechanic with no doc, read the would-be neighbours instead.
5. **Depends-neighbours** — for each system the target depends on (or that depends on
   it), read sections **D (Formulas)** and **F (Dependencies)** so an option respects
   the existing data interfaces.
6. **Recent `reviews/`** — open `unikit-gd-verify` conflicts and `unikit-gd-review`
   findings for the target. An open `RF-<date>-n` finding is an input (see "RF bridge").

**One-way boundary holds:** never read `.unikit/code/`, project source, or build
artifacts to learn how a system was implemented. The lens reasons about the *design*.

## Domain → rules to ground options

Read the behavioural **domain** from the target's name and Overview (the behaviour it
drives), **not** from the coarse `GD-INDEX` `Category`; on an ambiguous or coarse
category, confirm the domain with one `AskUserQuestion`. Load the matching core rules
(plus any studio `library` rule on the topic) so options carry theory. Domains are
opt-in and combinable — this is the **same keying vocabulary** `unikit-gd-detail` and
`unikit-gd-improve` use in their Phase 0 tables (kept in sync, not byte-identical —
this table loads rules to *ground options*, theirs to *author sections*):

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
`unikit-gd-detail` / `unikit-gd-improve` find them deterministically after a `/clear`,
regardless of the artifact's content language.

### `## Improvement Plan` — for `/unikit-gd-improve`

For a system whose doc is already `detailed` / `reviewed` / `revised`. Fields:

- **Target**: `SYS-<slug>` · **Expected scale**: Tuning | Tweak | Rework (the
  `unikit-gd-improve` classifier — let it confirm, this is the prediction).
- **Change**: ready-to-apply delta lines — `<Section>: <old> → <new>` per value/rule.
- **Touched GD-IDS facts**: entities/formulas/terms the delta moves (or `N/A`).
- **Rejected alternatives**: the options not taken, one line each, with the WHY-not.
- **Closes finding**: `RF-<date>-n` when the change resolves an open review finding
  (see "RF bridge"), else `N/A`.
- **Open questions**: anything the closure pass deferred.

### `## New Feature Plan` — for `/unikit-gd-spec` (add-system) → `/unikit-gd-detail`

For a mechanic with **no system on the map yet**. Two parts:

- **Map fields** (for `unikit-gd-spec` add-system): proposed slug, Category, Tier,
  `implements: [PIL-n]` (≥1 — the coverage gate), `depends_on` (symmetric edges).
- **Section seeds** (for `unikit-gd-detail` to pre-fill the section-cycle): the A–K
  content the lens worked out — Overview, Player Fantasy, Core Rules, draft Formulas,
  Edge Cases, candidate Tuning Knobs, draft Acceptance Criteria. These seeds are
  **untagged normal authored content** — `unikit-gd-detail` does **not** mark them
  `extracted` / `generated` (those markers are for imports only; `gd-principles` →
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
`unikit-gd-improve` can cite the closed finding in its changelog essence
(`… (DD-3; RF-2026-06-14-2)`).

## Research tags & the discovery contract

So a downstream skill finds this research deterministically across a `/clear`, tag it
on save (the SKILL "Saving Research Results" step writes these):

- **`RESEARCH_RESULT.md` header** — add `Target: SYS-<slug>` and
  `Kind: feature | improvement` (English tokens, like every stored id/value).
- **`researches/INDEX.md` entry** — add a `**Target**: SYS-<slug>` field to the row.

The hand-off ownership (do **not** write these here — the lens is read-only; this is
what the *routed* skills do):

- `unikit-gd-spec` (add-system), when it seeds a new system from a New Feature Plan,
  writes the **authoritative pointer** `research: researches/<folder-name>/` into the
  system's `GD-IDS.yaml` entry. The value is a **non-id path**, not a registry id, so
  `unikit-gd-verify` never tries to resolve it.
- `unikit-gd-detail` / `unikit-gd-improve` discover the research by
  **`GD-IDS` `research:` (authoritative) → `researches/INDEX.md` `Target:` (fallback)`**
  — the project's standard "registry pointer, disk fallback" idiom — then pre-fill
  their drafts/deltas from the matching brief block.
