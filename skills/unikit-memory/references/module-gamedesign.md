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

> **This module does NOT store process.** The game-design *working contract* —
> the collaboration protocol, the section-cycle authoring discipline, the
> one-way design→code boundary, the `gd-improve` delta discipline, the ID and
> language conventions, the Braintrust critique stance, and the shared severity
> rubric — is **not** a memory rule. It lives in the `gd-principles` **system
> asset** (`.unikit/system/gd-principles.md`), loaded once at Bootstrap by every
> `unikit-gd-*` skill the same way the code pipeline loads `dev-principles.md`.
> This module holds domain *knowledge*, never *process*.

## Module Identity

| Field | Value |
|-------|-------|
| `id` | `gamedesign` |
| `tiers` | `core`, `library` |
| `enginePartitioned` | `false` (registry side: `<registry>/gamedesign/<tier>` — no engine segment) |
| `skillPrefix` | `unikit-gd` |
| Memory layout | `.unikit/memory/gamedesign/<tier>` → `.unikit/memory/gamedesign/core/`, `.unikit/memory/gamedesign/library/` |
| Reference subfolder | `.unikit/memory/gamedesign/core/references/` (supplementary lookup docs for core rules) |
| Index file | `.unikit/memory/gamedesign/RULES_INDEX.md` |

These values mirror the `gamedesign` entry in `.unikit/system/modules.yml`. When
the router and this file disagree, `modules.yml` wins for structural fields
(`tiers`, `enginePartitioned`); this file is authoritative for tier *semantics*
and file *format*.

## Tiers — What Belongs Where

Both tiers are **load-on-demand** by `Load when` — neither is mandatory-gated.
The distinction is *provenance and resolution*, not load policy:

- **`core/`** — **canonical, official-backed** game-design domain expertise:
  frameworks (MDA, SDT/PENS, Flow), player motivation (Quantic Foundry), core
  loops, balance, economy, progression, level design, narrative, UX/onboarding,
  accessibility, live-ops, monetization ethics. This tier ships from the
  registry and is resolved **per-id via B-merge**: for each rule id, a studio's
  own version (if present) overrides the canonical one (`origin: custom`),
  otherwise the canonical file backfills from the official registry
  (`origin: official`) or the bundled fallback snapshot (`origin: bundled`). A
  studio rarely *adds* a brand-new core id by hand — it overrides an existing
  canonical id with its own house take.
- **`library/`** — the **studio's own custom-rule slot**, empty by default. It
  carries design rules that are specific to this studio/project and are NOT part
  of the canonical catalog: house conventions, opinionated heuristics, and
  **genre rules** (`genre-<slug>.md`) researched per project through the
  `unikit-memory` research pipeline. Library is resolved **from the custom
  registry only** — there is no official/bundled backfill, because the official
  registry never ships library content. In an override conflict, a library rule
  outranks a core rule (it is the studio's deliberate house position).

### What belongs in which tier

- Canonical, transferable domain knowledge (balance math, economy patterns,
  accessibility guidelines, framework theory) → `core/` — and only as a studio
  **override** of an existing canonical id, since the registry owns this tier.
- The studio's own custom design rules and house conventions → `library/`
- Genre-specific design knowledge the user researches (roguelike pacing,
  match-3 economy, …) → `library/` as `genre-<slug>.md`

When in doubt about whether new content is a canonical-knowledge override
(`core/`) or a studio-specific rule (`library/`), prefer `library/` — it is the
sanctioned slot for everything a studio authors itself.

## What Does NOT Belong in This Module

- **Process / working contract** — the collaboration protocol, section-cycle
  authoring discipline, one-way design→code boundary, `gd-improve` delta
  discipline, ID conventions (`PIL-*`, `SYS-*`, …), language rules, Braintrust
  critique stance, and the **severity rubric** → the `gd-principles` **system
  asset** (`.unikit/system/gd-principles.md`), NOT a memory rule. Never write a
  memory rule that re-specifies process, grades findings by severity, or
  references GDD section letters (A–K).
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
   - **`library`** — a studio-specific custom design rule, house convention, or
     a researched genre rule → `.unikit/memory/gamedesign/library/`. This is the
     default destination for anything the studio authors itself.
   - **`core`** — only when the content is a deliberate studio **override** of an
     existing canonical rule id (B-merge: the custom version wins, the official
     one backfills). Confirm with the user before writing into `core/` — they are
     shadowing canonical knowledge, and the override will NOT auto-update from
     upstream.
   - **Neither** — it is process, project truth, or another module's concern;
     redirect to the correct destination (see "What Does NOT Belong"). **Stop
     here. Do NOT create any files.**

2. **Identify the target file.**
   - Studio custom rule → a descriptive `lower-case-with-hyphens.md`. Consult
     `RULES_INDEX.md` Library section.
   - Genre knowledge → `genre-<slug>.md` (e.g. `genre-roguelike.md`).
   - Core override → match the canonical rule id exactly (e.g. `balance.md`,
     `economy.md`) so the B-merge resolver recognizes it as an override of that
     id.

3. **Does the file already exist?** Check the target tier directory.

There is no integration-intent gate and no engine gate in this module — those
concepts belong to the `code` module's stack tier.

## Project Isolation

Memory rules describe **transferable** knowledge. Apply this filter as an
independent pass before writing:

- Project-stack and project-design awareness (DESCRIPTION.md, GAME.md, GD-IDS)
  may inform *routing* decisions, never *content* synthesis.
- A rule must stay valid if the current project is deleted. Concrete numbers
  from the current game's design (entity stats, formula constants, economy
  values) are project facts → `.unikit/gamedesign/GD-IDS.yaml`, not memory.
- **Self-test before writing:** mentally move the rule to a different game
  project. If any sentence stops being true, it is project content — relocate
  it.

## File Format Template

Use the same header/format contract as the `code` module's rules:

```markdown
# {Domain / Genre / Topic}

> **Scope**: {What this file covers — the design domain and the kinds of decisions it helps make}
> **Load when**: {Comma-separated designer situations that trigger loading this file}
> **References**: {Optional — omit if no reference files. List each with a parenthetical label: `.unikit/memory/gamedesign/core/references/{rule-id}-{descriptor}.md` (quick lookup).}

---

## {Section 1}

{Principles, heuristics, named frameworks with attribution}

## {Section 2}

{More guidance — tables for numbers, prose for intent}

## Anti-patterns

{Common design mistakes to avoid — if applicable}
```

Rule files hold **domain knowledge only**. They never carry an `## Authoring` /
`## Process` / `## Documenting` section, GDD section-letter bindings (A–K),
GD-IDS attachment instructions, "recorded delta" language, or severity grading —
all of that is process and lives in `gd-principles`.

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
- Location: `.unikit/memory/gamedesign/library/` for studio custom/genre rules,
  `.unikit/memory/gamedesign/core/` for canonical overrides
- Language: follow `language.rules` from `.unikit/config.yaml` (default: `en`).
  The registry-shipped core rules are authored in English. Frontmatter keys, rule
  ids, canonical English term names (the names in GD-IDS `terms`), framework names,
  and formulas always stay in English regardless of `language.rules` — this is a
  closed list of stable identifiers, not a licence to keep arbitrary jargon English.
  See `.unikit/system/LANGUAGE_RULES.md` → "Knowledge base rule files".
- Numbers in tables, intent in prose; name the source framework when one exists
  (MDA, Quantic Foundry, GAG, …)
- Keep rules actionable — "Anchor X to Y", "Never ship Z without W"

## Reference File Format

Reference files live in `.unikit/memory/gamedesign/core/references/` (alongside
the canonical rule they belong to) and hold lookup/catalog data extracted from a
main rule (e.g. a motivation taxonomy table, an accessibility checklist). They
have no frontmatter — they are supplementary documents, not standalone rules.

**Naming convention:** `{rule-id}-{descriptor}.md` (e.g.
`accessibility-gag-checklist.md`, `player-motivation-quantic-table.md`).

Follow the `code` module's reference-extraction guidance: extract when content
is a large lookup catalog read piecemeal; keep conceptual guidance in the main
rule; propose the split and confirm with `AskUserQuestion` before creating
files; the main rule lists approved references in its `> **References**:` line.

## RULES_INDEX.md Format

The index lives at `.unikit/memory/gamedesign/RULES_INDEX.md` and carries two
tables, neither mandatory-gated (both load-on-demand by `Load When`). The Core
table carries an **Origin** column (per-rule B-merge provenance:
`custom`/`official`/`bundled`) so the agent can tell a studio override from
canonical knowledge; the Library table is purely custom and omits it:

```markdown
## Core (`.unikit/memory/gamedesign/core/`)

| File | Description | Origin | Load When |

## Library (`.unikit/memory/gamedesign/library/`)

| File | Description | Load When |
```

The Core table deliberately has **no "Required By" column** — that is `code`-core
mandatory-gate semantics. Game-design core rules are canonical *knowledge* loaded
on demand by `Load When`, not rules required by a set of tasks.

Place new entries in alphabetical order within the appropriate table. When
validating the index against disk, scan `.unikit/memory/gamedesign/core/*.md`
and `.unikit/memory/gamedesign/library/*.md`, then add missing rows (read each
file's `> **Scope**:` / `> **Load when**:` header) and remove phantom rows whose
files no longer exist. The CLI regenerates this index on `rules install` /
`rules sync` from the same headers, filling the Core Origin column from the
installed per-rule state.
