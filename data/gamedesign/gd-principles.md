# Game-Design Principles

This file is the canonical working discipline for the game-design skill family
(`unikit-gd-*`). Installed by `unikit-ai init` / `unikit-ai update` into
`.unikit/system/gamedesign/gd-principles.md` as a flat copy — engine-agnostic, with
no engine-variable substitution (unlike `dev-principles.md`). It is NOT
hash-tracked: every init/update rewrites it. Each game-design skill loads it once
at the start of a task (Bootstrap), the same way the code pipeline loads
`dev-principles.md`.

This **core** file owns the cross-skill **process** contract that every game-design
skill needs: the **zone-ownership model** and the **routing** rule, the user-driven
collaboration protocol, the one-way design→code boundary, the facts-registry / ID
conventions, the language rules, and the anti-patterns. The rest of the contract is
split into **shards** under the same `.unikit/system/gamedesign/` folder, each
loaded on Bootstrap only by the skills that use it:

| Shard | Owns | Loaded by |
|---|---|---|
| `gd-authoring.md` | Section-Cycle Contract + Delta Discipline (incl. the GAME.md carve-out) | spec, system, flow, content |
| `gd-lifecycle.md` | Lifecycle & Status | spec, system, flow, verify, content |
| `gd-flow-axis.md` | Flow Axis | flow, verify, review |
| `gd-provenance.md` | Provenance (imports) | system, flow, review, explore |
| `gd-critique.md` | Critique Stance + Severity Rubric | review, verify, explore |

**Domain knowledge** (frameworks, motivation, balance, economy, progression, level
design, narrative, UX, accessibility, liveops, monetization ethics) lives in the
`gamedesign` memory rules under `.unikit/memory/gamedesign/` and is loaded on demand
by `Load when` — this file is process, never domain.

## Zone Ownership

The skill family is organized by **zones**, not verbs. The taxonomy is: a **noun
owns a thing** (an authoring zone, with the full create+update cycle inside it); a
**verb acts over things** (cross-cutting or upstream, owning no artifact).

**Authoring zones (nouns — each owns one artifact type, create + update):**

| Zone skill | Owns (create + update) |
|---|---|
| `unikit-gd-spec` | the **spec / map** zone — `GAME.md` (the authored one-pager **and** the regenerated `## System Map [gen]`), the system roster (add-system), the `## System Map` block |
| `unikit-gd-system` | the **system** zone — `SYSTEM.md` for one system (create skeleton + author sections + edit approved content) |
| `unikit-gd-flow` | the **flow** zone — `FLOW.md` for one flow (create + update), the `GOAL` rows, the wiring-mode selection, its own `GD-IDS` `flows:` / `events:` entries, and the regenerated `## Flow Map` / `## Funnel` blocks |
| `unikit-gd-content` | the **content** zone — `CONTENT-TYPE.md` for one content type (create + update), the `CT.fields` schema, the `CU` rows (`content`), its own `GD-IDS` `content_types:` / `content:` entries, and the regenerated `## Content Map` block |

- One owner per artifact. The full lifecycle of an artifact (create, fill, edit,
  delta-discipline) lives inside its zone; there is no separate "editor" skill.
- `unikit-gd-spec` is the **single writer of the system roster** — only it adds a
  system (add-system). A **flow registers itself**: `unikit-gd-flow` writes its own
  `GD-IDS` `flows:` / `events:` entries and re-renders both `## Flow Map` and
  `## Funnel` — there is no add-flow in `unikit-gd-spec`. Downstream discovery that
  crosses into the *system* roster (a flow whose `GOAL → SYS` names a missing system,
  a system finding a missing dependency) still **routes back** to `unikit-gd-spec`; a
  system roster row is never written outside it.
- **Content registers itself** (the same pattern as a flow): `unikit-gd-content`
  writes its own `GD-IDS` `content_types:` / `content:` entries — and the
  `resources:` / `tracks:` / `knobs:` facts it owns via a registry-check — then
  re-renders `## Content Map` — there is no add-content in `unikit-gd-spec`. A
  content type's `belongs_to` (`CT → SYS`, one-way) that names a system missing from
  the roster **routes back** to `unikit-gd-spec` (add-system); a system roster row is
  never written outside it.

**Cross-cutting verbs (act over every zone, own no artifact):**

- `unikit-gd-review` — qualitative verdicts (axis-aware: systems and flows).
- `unikit-gd-verify` — mechanical consistency + changed-scope impact (axis-aware).

**Upstream verbs (feed the zones, own no GDD artifact):**

- `unikit-gd-brainstorm` — ideation (concept).
- `unikit-gd-explore` — design research (read-only; thinks, briefs, and routes).

**Zones ⟂ domains.** Zones are **few** (the authoring skills: spec / system / flow /
content) and orthogonal to **domains**, which are **many** (`core` memory rules + the
`section-packs`: monetization, liveops, level design, narrative, accessibility, …).
A domain is knowledge that loads into whatever zone touches it — never a skill. So:

- A new **domain** → a new `core` rule (+ section-pack), loaded across the zones
  that touch it. **Not** a new skill.
- A new **artifact type** → a new authoring zone-skill. This is rare (the spec /
  system / flow / content quartet is expected to be stable).

## Routing

A request finds its zone by three orthogonal questions:

- **Intent decides the door:**
  - "think it through / research it / what are the options" → `unikit-gd-explore`
    (the read-only internal-design lens: it thinks, returns a brief, and routes —
    it never writes a GDD).
  - "build it / add it" → `unikit-gd-spec` (which maps it and routes into the
    authoring zones).
  - "fix / tune / rework X" → the zone-skill that **owns** X (a system → `unikit-gd-system`,
    a flow → `unikit-gd-flow`, a content type → `unikit-gd-content`, `GAME.md` →
    `unikit-gd-spec`).
- **Artifact decides the zone.** `GAME.md` → spec; `SYSTEM.md` → system; `FLOW.md`
  → flow; `CONTENT-TYPE.md` → content. The artifact you are editing names its owner.
- **Domain rides as rules/packs.** A domain (e.g. `monetization-ethics`) loads
  into whatever zone touches it; it is spread across zones (Stance → spec · shop
  system → system · funnel events → flow), with the shared `core` rule as the
  single source of that knowledge. The domain never picks the door — the artifact
  does.

## Collaborative Protocol (User-Driven)

The user owns the vision and makes every creative decision. The skill is an expert
consultant — it informs, structures, and recommends; it never decides.

- Every design point follows **Question → Options → Decision → Draft → Approval**.
- **Explain → Capture:** write the full reasoning in conversation first (pros/cons,
  theory from the loaded domain rules, reference games), then capture the decision
  with a structured question (`AskUserQuestion` on Claude Code) — concise labels, at
  most 4 questions per call. Agents without a structured-question tool present the
  same options as plain text.
- Present 2–4 options; mark exactly one **"(Recommended)"** with the WHY (framework,
  pillar alignment, scope fit) and explicitly defer the final choice to the user.
- Anti-anchoring: state your own preference only after the user has chosen.
- On ambiguity, ask — never guess. "I don't know" from the user → offer 2–4
  defaults with a recommendation.
- **Files are written only by the main session, only after approval.** Inline review
  lenses and sub-agent calls are read-only advisors — they never write.
- Registry (`GD-IDS.yaml`) writes require the same approval as document writes;
  existing registry values are never changed silently. The `[gen]` maps in
  `GAME.md` are mechanical re-renders of approved `GD-IDS` state — never
  hand-authored — so they inherit that approval rather than carrying their own.
- Web research is allowed in `unikit-gd-explore`, `unikit-gd-brainstorm` (market and
  reference scans), and the memory research pipeline. It is forbidden in
  `unikit-gd-verify` — verification is offline, deterministic, and reproducible.

## One-Way Boundary (Design → Code)

Code reads design; design knows nothing about code.

- Game-design **authoring** zones (spec/system/content/flow) and the
  **`unikit-gd-apply`** dispatcher never read the code workspace (`.unikit/code/`),
  project sources, or build artifacts. The **read-only research verbs** —
  `unikit-gd-recon` (cold-start) and the `unikit-gd-explore` code-grounded lens — are
  the sole exception (see *Sanctioned exceptions* below): they read code to *extract*
  candidate design facts into a document, never to author.
- The code side consumes design exclusively through the `## Design` section of its
  plan brief — SYS-id, version snapshot, verbatim AC quotes (and, for flow-aware
  planning, the read-only flow brief — see Flow Axis). There is no reverse flow:
  no design documents reconstructed from code, and no code-to-design sync
  **except the single `implemented` writeback below**.
- **Content crosses as a contract, not as data.** When the code side reads the
  content axis it consumes the **schema + descriptor** — a `CT`'s typed `CT.fields`
  and its `scale` (`bulk` → a `count` + `spec` descriptor; `curated` → `fields`),
  never the bulk instance values, which live in the editor, not `GD-IDS`. A schema
  change is a `CT` version bump (and a data migration); the many instances a `bulk`
  `CT` describes never cross the boundary. `GD-IDS` carries the contract, not the
  catalog.
- Importing an existing GDD is a document operation — extract from the provided
  document; never reverse-engineer design from an implementation — **except the
  brownfield-bootstrap carve-out**: a team with a live game and no GDD has nothing to
  import, so the read-only research verbs may reconstruct *candidate* facts from code
  into a passive `RECON.md` (or an explore brief), consumed downstream as an ordinary
  document (the membrane: code → document → ordinary import). Every reconstructed fact
  is tagged `provenance: extracted from code` and held to a higher review bar (see
  `gd-provenance`). Authoring zones never reconstruct from code.
- **Sanctioned exceptions (three, narrow):**
  - the **feasibility lens** inside `unikit-gd-review` may read `DESCRIPTION.md` /
    `ARCHITECTURE.md` to flag implementability risks (a design-reads-code-context
    read, never `.unikit/code/` or source);
  - the **`implemented` writeback** — the lone sanctioned **code→design write**:
    code-side `unikit-verify`, on all-AC-met for a cited `SYS-id`@version, writes
    `implemented_version` into `GD-IDS.yaml`. That is the **single** sanctioned write
    surface — there is no second one. The `## System Map [gen]` block in `GAME.md`
    re-renders the `implemented` state from `GD-IDS` (read-only); design never sets
    it and never reads code to learn it.
  - the **read-only research verbs** read code to extract candidate design facts (the
    brownfield-bootstrap carve-out above): `unikit-gd-recon` (cold-start only — no GDD
    yet) scans the whole project into a passive `RECON.md`, and the `unikit-gd-explore`
    **code-grounded lens** (post-GDD, targeted) grounds an in-flight slice. Both are
    read-only on code, call no authoring zone, and emit a *document* (`RECON.md` / an
    explore brief) — never a GDD edit. The shared extraction engine is
    `unikit-gd-recon/references/code-recon.md`. Facts carry
    `provenance: extracted from code` (review ≥ Major). The authoring zones
    (spec/system/content/flow) and the `unikit-gd-apply` dispatcher are **never** in
    this exception.

## Facts Registry & ID Conventions

`GD-IDS.yaml` is the single source of truth for numbers, names, and decisions.
When document text disagrees with the registry, the registry wins until the user
resolves the conflict the other way (via a `unikit-gd-verify` resolution). The
user is the arbiter of every conflict.

| Prefix | Meaning | Recorded in |
|---|---|---|
| `PIL-<n>` | Pillar | GAME.md + GD-IDS `pillars` |
| `SYS-<slug>` | System | GD-IDS `systems` (rendered in GAME.md `## System Map [gen]`) |
| `FLOW-<slug>` | Flow (player-action scenario) | GD-IDS `flows` (rendered in GAME.md `## Flow Map [gen]`) |
| `ENT-<slug>` | Entity with facts (stats) | GD-IDS `entities` |
| `FORM-<slug>` | Formula | GDD section D + GD-IDS `formulas` |
| `AC-<sys>-<n>` | Acceptance criterion (system) | GDD section H |
| `GOAL-<flow>-<n>` | Flow objective (scenario step) | FLOW.md table + GD-IDS `flows` |
| `CT-<slug>` | Content type (the document/schema) | GD-IDS `content_types` (rendered in GAME.md `## Content Map [gen]`) |
| `CU-<ct>-<n>` | Content unit (one registry row of a `CT`) | GD-IDS `content` |
| `RES-<slug>` | Resource (currency / consumable fact) | GD-IDS `resources` |
| `TRACK-<slug>` | Progression track (season / battle-pass fact) | GD-IDS `tracks` |
| `KNOB-<slug>` | Global tuning knob (cross-system balance fact) | GD-IDS `knobs` |
| `DD-<n>` | Design decision | GD-IDS `decisions` |

- IDs are English lowercase slugs, stable across versions.
- Never delete an ID — mark it deprecated. Dangling references are verify
  conflicts.
- Every registry fact carries its `source` — the system that owns it.

## Language

- Design artifacts follow the configured artifact language; conversation follows the
  configured UI language (see `.unikit/system/LANGUAGE_RULES.md`). The general
  **"translate the concept, not the label"** rule — no transliterating jargon, no
  mid-sentence code-switching — lives there and applies to every skill; this section
  adds only the game-design specifics.
- **Always English — but only stored identifiers and machine values, never
  vocabulary:** IDs (`PIL-*`, `SYS-*`, `ENT-*`, `FORM-*`, `AC-*`, `DD-*`), MDA
  aesthetic names, formula expressions and variables, telemetry event names, and the
  literal **field values** stored in artifacts (e.g. `market_signal: red-ocean`,
  `validation_confidence: B`). These are parsed or referenced as stable tokens, so
  they never translate. The list is exhaustive — "keywords" and "canonical terms"
  are *not* a licence to keep arbitrary jargon English. A stored `market_signal:
  red-ocean` field in the card is correct; the same words spliced into chat are not —
  render them in the user's language.
- **Numbers live in tables, intent lives in prose.** A document that hides numbers
  inside prose or buries intent inside bare stat tables fails review.

## Anti-patterns

- Writing or editing any artifact without an explicit approval.
- Drafting a section and asking for its approval in a later, separate reply.
- Manual edits to approved documents bypassing the owning zone's delta discipline
  (unrecorded delta).
- A design skill reading `.unikit/code/` or project sources.
- Changing a GD-IDS value silently because "the document says otherwise".
- Inventing ad-hoc ID formats, reusing or renumbering existing IDs, deleting IDs.
- Prescribing solutions in a review nobody asked for.
- Severity inflation: filing a taste disagreement as Critical, or a finding with
  no section-and-evidence citation above Suggestion.
- Hiding tuned numbers in prose; replacing design intent with bare stat tables.
- Putting a domain (monetization, liveops, level design) into a new skill instead
  of a `core` rule + section-pack; or splitting one artifact across two zones.
