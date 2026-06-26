# Authoring mode (Create / Fill) — body

Loaded on demand by `unikit-gd-system/SKILL.md` → "Load the Mode Body" when Phase 2
resolves the mode to **Create** or **Fill**. The SKILL keeps Phase 0–2 + the switch +
Phase 6; this file is the Decision-First section-cycle body. Returns to the SKILL's
**Phase 6** (Final) when done.

## Authoring (Create / Fill) — Decision-First

The system zone applies the **Decision-First Section-Cycle Contract** in
`gd-authoring`: the six-phase mechanic lives in the shard; below are the
system-specific **section map**, **core-set**, and per-section logic. **Address
sections by name in the dialogue, never by a bare letter** (A–K means nothing to the
user).

| § | Section | What it holds |
|---|---------|---------------|
| A | Overview | One paragraph for a newcomer; what the player does; why it exists. Non-goals (3–5 "the system does NOT…"). |
| B | Player Fantasy | "The player feels X when Y", tied to the pillar it serves. |
| C | Detailed Design | Core Rules (numbered, unambiguous); States & Transitions; Interactions with other systems. |
| D | Formulas | Each `FORM-<slug>`: expression, variable table (name/type/range/source), output range, numeric example. |
| E | Edge Cases | "If <condition>: <outcome>"; zero / maximum / simultaneity; degenerate strategies (Sirlin check) vs tuning knobs. |
| F | Dependencies | Direction, hard/soft, data interface; must agree with the GD-IDS `depends_on` (rendered in GAME.md `## System Map`) and the neighbor's F. |
| G | Tuning Knobs | knob / category (feel\|curve\|gate) / range / default / what breaks at the extremes → direct input for configs. |
| H | Acceptance Criteria | `AC-<slug>-N`: Given-When-Then; performance budgets. Quoted verbatim by the planning side. |
| I | Telemetry | event (English `snake_case`) / payload / the design question it answers. |
| J | Accessibility | GAG checklist items (basic minimum) / accommodations / justified deviations. |
| K | Open Questions & Changelog | open questions (owner/when); changelog blocks (added by this skill on a revision and by `unikit-gd-verify`). |

**Core-set (the floor for `detailed`, from `gd-lifecycle`):** A Overview · B Player
Fantasy · C Detailed Design · D Formulas · H Acceptance Criteria. The **depth** picked
in Phase 2 sets which sections this pass attempts (`core` = just the floor; `standard`
/ `full` layer on E/F/G/I/J + packs). **Fill** re-picks depth and runs Decision-First
only over the newly-attempted sections — earlier approved sections are untouched and
partiality stays honest.

### Phase 3 — Skeleton + Fork-Scan

1. **Skeleton (Create mode only).** Write the file from the SYSTEM template with
   **every** A–K header present and a `[To be designed]` placeholder under each, the
   header filled from the GD-IDS entry. Get **one approval** for the skeleton; a
   refusal sets `doc_status: skeleton` and stops (BLOCKED).

   ```
   # <System Name> — SYS-<slug>
   > Status: skeleton · Version: 1 · Last Updated: <date>
   > Implements: PIL-n[, PIL-m] · Layer: <Foundation|Core|Feature|Presentation> · Scope: <S|M|L|XL>
   ```

   When the system's domain has a **section-pack** (Phase 0 table), its sub-sections
   are appended after K (attached in Phase 4 — see `references/section-packs.md`).
2. **Fork-scan (silent).** Walk the in-scope sections (per the picked depth) and
   classify each **without asking** — **seeded** (the Phase 1 context: a SOURCE /
   recon / explore brief, the pillars, the loaded domain rules, or a neighbour already
   answers it → it will be drafted silently) vs **real fork** (a genuine design choice
   with no seeded answer). Catch pillar- and registry-conflicts **here**, before any
   prose is written. Emit `INFO [gd-system] depth=<tier>`.

### Phase 4 — Decision Interview + Generation

**Decision interview.** Ask **only the real forks**, batched (1–2 `AskUserQuestion`
rounds) — never one gate per section. Options are **grounded** in the loaded
`balance` / `frameworks` theory, the pillars, and neighbours, **never a blank page**:
"which damage curve?" offers grounded **forms** (linear / diminishing / threshold) +
an open **"my own — I'll describe it"**. A truly-blank section with no grounded option
becomes an explicit **flagged open question** (section K), not a silent blank. A
**pillar or loop conflict** that surfaces here is escalated to `/unikit-gd-spec`
**before writing** — the real change is in GAME.md content or the map; name it, do not
force-fit. **Section-packs** ride this round: an **unambiguous** domain **auto-attaches**
its pack — announced in one outcome-language phrase (the value it adds for the player /
the design, never the word "pack" or a code) and **vetoable**; an **ambiguous** domain is
settled by a single plain Yes/No. Packs are orthogonal to depth and combine.

**Generation.** Draft each in-scope section — **seeded** sections **silently** (emit
`INFO [gd-system] seeded §<name> — drafted silently`), decided sections from their
decision. The section-specific logic (the rest follows the Decision-First flow):

- **C / Core Rules** — numbered, implementable without guessing. Record new game
  terms in `GD-IDS.yaml` `terms` (canonical English + translation + forbidden aliases).
- **D / Formulas** — each gets a `FORM-<slug>`, the expression, a variable table, the
  expected output range, and a worked numeric example. Name the degenerate **values** —
  inputs at zero / max / negative that break the curve — and state how the formula
  clamps them. (Degenerate **strategies** belong to E.)
- **Registry check after C and D** — compare every number and name against the known
  facts from Phase 1. On a mismatch, surface it **immediately**: obey the registry /
  change it through a `unikit-gd-verify` resolution / park it in section K. Never
  silently override a registry value.
- **E / Edge Cases** — ask "what at zero / at maximum / on simultaneity?"; test every
  degenerate strategy against the tuning knobs in G.
- **H / Acceptance Criteria — auto-derived** from C, D, and E, **never asked**: one
  Given-When-Then per core rule and per edge case, numbered `AC-<slug>-N`, stable —
  never reshuffled. The verbatim contract the code side quotes.
- **J Accessibility / I Telemetry at a low depth — auto-default from the rules + a
  "clarify" note**, a sensible default with a flag (never an empty marker —
  accessibility is **not** dropped; load `accessibility` when authoring J). At `full`
  depth they are authored through the normal flow.
- **Deferred** — a section the user chose to skip at this depth is written with a
  `<!-- deferred -->` marker (distinct from the skeleton `[To be designed]`). A
  **core** section (A/B/C/D/H) **may** be deferred, but then the status honestly stays
  below `detailed` (the Phase 6 soft floor guard) — emit `WARN [gd-system] core
  section §<name> deferred — status held below detailed`.
- **Section-packs** — when a pack was attached (auto-attached or confirmed), author its
  sub-sections after K with the same flow, loading the pack's extra rule as noted in
  `references/section-packs.md`.

### Phase 5 — Group Review

Present the generated sections **by tier-group** (core first, then standard, then
full). Before each section show a **card** — Context · why this section exists · what
it captures · its source — drawn from the SYSTEM template's `[]`-hints (the hint **is**
the card, surfaced to the user on `ru`; no duplication). Each group closes with **one
structural group gate** over the whole group:

```
AskUserQuestion: <group> review — <n>/<m> sections done.
Options: Accept & continue · Fix this · Defer this · Accept all the rest
```

*Fix* loops the section back through a decision; *Defer* writes its `<!-- deferred -->`
marker; *Accept all the rest* ends the review. **Write incrementally** — persist each
accepted section immediately (Edit anchored on its unique heading); the file is the
only memory that survives the session.

In **Fill mode** there is no skeleton step: re-pick depth (Phase 2), fork-scan the
remaining `[To be designed]` sections, and run Phases 4–5 over those only; approved
sections are never overwritten.

→ **Phase 6** writes the registry and the inferred status.
