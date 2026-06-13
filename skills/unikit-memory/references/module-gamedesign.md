# Module Contract — `gamedesign`

This file is the **content and format contract** for the `gamedesign`
knowledge-base module. The `unikit-memory` router loads it (relative to its own
skill directory: `{{skills_dir}}/{{self_name}}/references/module-gamedesign.md`)
**after** it resolves the active module to `gamedesign`. Everything that is
specific to *what the game-design module stores* and *how its rule files are
shaped* lives here — the router body stays module-agnostic and never hardcodes
tier names, paths, or templates.

This contract is deliberately **simpler** than `module-code.md`: the module is
not engine-partitioned and carries no integration-intent machinery — game-design
knowledge has no engine axis and no cross-framework integration concern.

## Module Identity

| Field | Value |
|-------|-------|
| `id` | `gamedesign` |
| `tiers` | `core`, `library` |
| `enginePartitioned` | `false` (registry side: `<registry>/gamedesign/<tier>` — no engine segment) |
| `skillPrefix` | `unikit-gd` |
| Memory layout | `.unikit/memory/gamedesign/<tier>` → `.unikit/memory/gamedesign/core/`, `.unikit/memory/gamedesign/library/` |
| Reference subfolder | `.unikit/memory/gamedesign/library/references/` (supplementary lookup docs for library rules) |
| Index file | `.unikit/memory/gamedesign/RULES_INDEX.md` |

These values mirror the `gamedesign` entry in `.unikit/system/modules.yml`. When
the router and this file disagree, `modules.yml` wins for structural fields
(`tiers`, `enginePartitioned`); this file is authoritative for tier *semantics*
and file *format*.

## Tiers — What Belongs Where

- **`core/`** — the working discipline of the game-design skill family, loaded
  always: the collaborative protocol (Question → Options → Decision → Draft →
  Approval; files are written only by the main session after approval), the
  section-cycle contract for GDD authoring, the one-way boundary invariant
  (game-design skills never read the `code/` workspace or project source — code
  reads design, design does not know code), the `gd-improve` delta discipline
  (every design edit bumps Version and writes a changelog block), ID conventions
  (`PIL-*`, `SYS-*`, `ENT-*`, `FORM-*`, `AC-<sys>-N`, `DD-*`), language rules
  (artifacts in the configured language, identifiers/keywords/canonical
  terms/formulas in English), and the Braintrust critique stance (diagnose,
  don't prescribe).
- **`library/`** — transferable game-design domain expertise, loaded on demand
  by design domain: frameworks (MDA, SDT/PENS, Flow), player motivation
  (Quantic Foundry), core loops, brainstorm methods, review lenses, balance,
  economy, progression, level design, narrative, UX/onboarding, accessibility,
  live-ops, monetization ethics. **Genre rules** (`genre-<slug>.md`) also live
  here — generated per project/studio through the `unikit-memory` research
  pipeline, never shipped by the official registry.

### What belongs in which tier

- Collaboration protocol, authoring discipline, ID/language conventions → `core/`
- Domain knowledge that transfers between projects (balance math, economy
  patterns, accessibility guidelines, …) → `library/`
- Genre-specific design knowledge the user researches (roguelike pacing,
  match-3 economy, …) → `library/` as `genre-<slug>.md`

## What Does NOT Belong in This Module

- **The project's own design content** (pillars, systems, facts, formulas,
  decisions of THIS game) → the `gamedesign` workspace artifacts:
  `.unikit/gamedesign/GAME.md`, `.unikit/gamedesign/systems/*.md`,
  `.unikit/gamedesign/GD-IDS.yaml`. Memory rules are transferable knowledge;
  project truth lives in the workspace. Never bake the current project's
  numbers or decisions into a memory rule.
- **Project-specific design principles and overrides** → `.unikit/RULES.md` via
  the `unikit-rules` skill, or the pillars section of
  `.unikit/gamedesign/GAME.md`.
- **Code rules** (framework usage, code style, testing) → the `code` module.
- **Architecture decisions** → `.unikit/ARCHITECTURE.md`.
- **Lessons from recurring design-verify conflicts** → the `unikit-evolve`
  skill-context flow (`.unikit/skill-context/unikit-gd-*`), not memory rules.

If the user provides content that falls into these categories, inform them and
suggest the correct destination.

## Content Classification (tier selection)

When the router has classified the **intent** and reaches content
classification, pick the tier for the `gamedesign` module:

1. **`core` or `library`?**
   - **`library`** — domain or genre design expertise (balance, economy,
     narrative, a researched genre, …) → `.unikit/memory/gamedesign/library/`
   - **`core`** — a change to the working discipline itself (protocol,
     conventions). Core content ships from the registry; user additions here
     are rare — confirm with the user before writing.
   - **Neither** — redirect to the correct destination (see "What Does NOT
     Belong"). **Stop here. Do NOT create any files.**

2. **Identify the target file.**
   - Domain knowledge → the matching library file (e.g. `balance.md`,
     `economy.md`, `narrative.md`). Consult `RULES_INDEX.md` Library section.
   - Genre knowledge → `genre-<slug>.md` (e.g. `genre-roguelike.md`).

3. **Does the file already exist?** Check the target tier directory.

There is no integration-intent gate and no engine gate in this module — those
concepts belong to the `code` module's stack tier.

## Project Isolation

Library rules describe **transferable** knowledge. Apply this filter as an
independent pass before writing:

- Project-stack and project-design awareness (DESCRIPTION.md, GAME.md, GD-IDS)
  may inform *routing* decisions, never *content* synthesis.
- A library rule must stay valid if the current project is deleted. Concrete
  numbers from the current game's design (entity stats, formula constants,
  economy values) are project facts → `.unikit/gamedesign/GD-IDS.yaml`, not
  memory.
- **Self-test before writing:** mentally move the rule to a different game
  project. If any sentence stops being true, it is project content — relocate
  it.

## File Format Template

Use the same header/format contract as the `code` module's rules:

```markdown
# {Domain / Genre / Topic}

> **Scope**: {What this file covers — the design domain and the kinds of decisions it helps make}
> **Load when**: {Comma-separated designer situations that trigger loading this file}
> **References**: {Optional — omit if no reference files. List each with a parenthetical label: `.unikit/memory/gamedesign/library/references/{rule-id}-{descriptor}.md` (quick lookup).}

---

## {Section 1}

{Principles, heuristics, named frameworks with attribution}

## {Section 2}

{More guidance — tables for numbers, prose for intent}

## Anti-patterns

{Common design mistakes to avoid — if applicable}
```

**Writing `Scope` and `Load when`:**

Both lines must read as **prose** a future LLM can match against a design task.

- `> **Scope**:` — one sentence answering *"what design domain does this rule
  cover?"* and what decisions it helps make.
- `> **Load when**:` — designer situations phrased with actionable gerunds
  ("balancing combat numbers", "designing an FTUE funnel", "auditing a gacha
  pity system"), comma-separated.

**Example — `balance.md`**

```
> **Scope**: Game balance methodology — cost and power curves, TTK/TTC anchors, transitive vs intransitive relationships, and tuning-knob design for feel/curve/gate parameters.
> **Load when**: balancing combat or unit stats, designing cost curves, auditing dominant strategies, defining tuning knobs, reviewing a system's numeric model.
```

**Guidelines:**

- Filename: `lower-case-with-hyphens.md` (e.g. `player-motivation.md`,
  `genre-roguelike.md`)
- Location: `.unikit/memory/gamedesign/library/` for library,
  `.unikit/memory/gamedesign/core/` for core
- Language: follow `language.rules` from `.unikit/config.yaml` (default: `en`).
  The registry-shipped rules are authored in English. Frontmatter keys, rule
  ids, canonical terms, framework names, and formulas always stay in English
  regardless of `language.rules`. See `.unikit/system/LANGUAGE_RULES.md` →
  "Knowledge base rule files".
- Numbers in tables, intent in prose; name the source framework when one exists
  (MDA, Quantic Foundry, GAG, …)
- Keep rules actionable — "Anchor X to Y", "Never ship Z without W"

## Reference File Format

Reference files live in `.unikit/memory/gamedesign/library/references/` and hold
lookup/catalog data extracted from a main library rule (e.g. a motivation
taxonomy table, an accessibility checklist). They have no frontmatter — they are
supplementary documents, not standalone rules.

**Naming convention:** `{rule-id}-{descriptor}.md` (e.g.
`accessibility-gag-checklist.md`, `player-motivation-quantic-table.md`).

Follow the `code` module's reference-extraction guidance: extract when content
is a large lookup catalog read piecemeal; keep conceptual guidance in the main
rule; propose the split and confirm with `AskUserQuestion` before creating
files; the main rule lists approved references in its `> **References**:` line.

## RULES_INDEX.md Format

The index lives at `.unikit/memory/gamedesign/RULES_INDEX.md` and carries two
tables. The Core table has a **Required By** column (core rules are
mandatory-gated); the Library table is load-on-demand:

```markdown
## Core (`.unikit/memory/gamedesign/core/`)

| File | Description | Required By | Load When |

## Library (`.unikit/memory/gamedesign/library/`)

| File | Description | Load When |
```

Place new entries in alphabetical order within the appropriate table. When
validating the index against disk, scan `.unikit/memory/gamedesign/core/*.md`
and `.unikit/memory/gamedesign/library/*.md`, then add missing rows (read each
file's `> **Scope**:` / `> **Load when**:` header) and remove phantom rows whose
files no longer exist. The CLI regenerates this index on `rules install` /
`rules sync` from the same headers.
