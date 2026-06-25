[← Skills Reference](skills.md) · [Back to README](../README.md)

# Game-Design Module

UniKit ships a second knowledge module, **`gamedesign`**, dedicated to authoring a
**Game Design Document (GDD)**. It installs nine `unikit-gd-*` skills, a
domain-knowledge rule library, and a set of system-asset contracts. Design artifacts
live in their own workspace (`.unikit/gamedesign/`) and are authored in the project's
configured language; **ids / keywords / canonical terms / formulas stay English**.

The boundary to the code module is deliberately **one-way**: code reads design, design
never reads code (with one sanctioned exception — code-side `/unikit-verify` stamps a
system's `implemented_version` back into the registry).

## The four authoring axes

A GDD is authored along three machine-readable axes plus the one-page whole:

| Axis | Skill | Owns | Answers |
|------|-------|------|---------|
| **whole** | `/unikit-gd-spec` | `GAME.md` (the one-pager) + `GD-IDS.yaml` registry roster | the premise, pillars, loops, win/lose |
| **systems** | `/unikit-gd-system` | `systems/SYS-<slug>.md` | "what are the rules" |
| **flows** | `/unikit-gd-flow` | `flows/FLOW-<slug>.md` | "what the player does over time" (dynamics) |
| **content** | `/unikit-gd-content` | `content-types/CT-<slug>.md` | "what content exists and by what schema" (the catalog) |

Ideation (`/unikit-gd-brainstorm`), research (`/unikit-gd-explore`), multi-zone dispatch
(`/unikit-gd-apply` — carries out an explicit edit spanning several axes by routing each
delta to its owner, then verifying), quality review (`/unikit-gd-review`), and mechanical
verification (`/unikit-gd-verify`) round out the module. The machine truth for every axis is `GD-IDS.yaml`; the human-readable maps at
the bottom of `GAME.md` (`## System Map [gen]` / `## Flow Map [gen]` / `## Funnel [gen]`
/ `## Content Map [gen]`) are **rendered read-only** from it — never hand-edited.

---

## Decision-First authoring (how a zone is filled)

The three zone skills (`/unikit-gd-system`, `/unikit-gd-flow`, `/unikit-gd-content`) share
one authoring contract — **Decision-First** (the `gd-authoring` shard). The old flow
walked every section in order through a full Context → Options → Decision → Draft →
Approval cycle — roughly **14 near-identical gates** to detail one system. Decision-First
captures the same facts in **~4–6 gates** by scaling the ceremony to the actual choice.

**The six phases.**

0. **Bootstrap** — load the contract + the zone's section map and core-set.
1. **Depth** — one gate: a picker of the named tiers **`core / standard / full`** (each
   with what it adds, not bare letters). The pick is the *ephemeral scope of this pass* —
   it is **never stored**; the lasting fact is the status.
2. **Fork scan (silent)** — classify each in-scope section without asking: **seeded** (a
   SOURCE / recon / explore brief, the pillars, the domain rules, or a neighbour already
   answers it → drafted silently) vs a **real fork** (a genuine design choice). Pillar
   conflicts surface here, early.
3. **Decision interview** — ask **only the real forks**, batched. Options are always
   grounded in theory and the pillars — never a blank page ("which curve? linear /
   diminishing / threshold, or describe your own"). A flow's **Mode** and a content
   type's **Scale** are decided here.
4. **Generation** — draft each section: seeded ones silently; acceptance criteria
   auto-derived; accessibility / telemetry auto-defaulted at a low depth; a section you
   choose to skip is marked **`<!-- deferred -->`**.
5. **Group review** — present sections by tier-group, each behind a **card** (why / what /
   source, drawn from the template hints) and one **structural gate** — *Accept &
   continue · Fix · Defer · Accept all the rest* — with a progress indicator.
6. **Final** — write the registry, set the inferred status, append the changelog,
   re-render the `[gen]` map.

**Sections have names, not letters.** The dialogue never says "section J"; it says
"Accessibility". The letters are the template's internal index only.

**Depth is a picker; status is inferred.** Depth (`core/standard/full`) is chosen per pass
and forgotten. The lasting fact is the `doc_status`, and it stays honest about partiality
**without storing it**:

- **`core` is the floor.** A doc reaches `detailed` only when its whole core-set is
  authored — system: Overview / Player Fantasy / Detailed Design / Formulas / Acceptance
  Criteria; flow: Overview / Objective Flow; content: Overview / Schema / Scale. Defer a
  *core* section and the status honestly stays below `detailed`.
- **`detailed · partial (n/m)`** — when the core is complete but some *non-core* sections
  were deferred, the map renders `detailed · partial (n/m)`, **inferred from the
  `<!-- deferred -->` markers** in the document. There is no stored "depth" field, so it
  cannot drift. (`<!-- deferred -->` is an *intentional* omission; the older
  `[To be designed]` is an *unfilled* skeleton placeholder and remains a leak.)

The `· partial` suffix is rendered identically by every `[gen]`-map writer
(`/unikit-gd-spec`, `/unikit-gd-flow`, `/unikit-gd-content`) and by `/unikit-gd-verify`'s
freshness pass — all from the one canonical rule in `gd-lifecycle`.

---

## The Content axis (the catalog)

The content axis is the data the game is made of — items, cards, levels, spawn waves,
quests. It is owned end-to-end by **`/unikit-gd-content`** (create the schema, fill it,
revise it). The contract lives in the `gd-content-axis` system-asset shard.

### Content types and content units (CT / CU)

- A **content type** (`CT-<slug>`) is a **schema + descriptor**, never the catalog of
  values.
- A **content unit** (`CU-<ct>-<n>`) is a thin, genre-agnostic envelope around that
  schema. All per-genre variability lives in the schema, so the CU envelope never grows
  as genres change.

### `CT.fields` — the typed schema

`CT.fields` is the contract the code side reads — one typed field per row:

```
int · float · string · bool · enum · list<T> · asset-ref · loc-ref · ref<PREFIX>
```

### `ref<>` — a link is a field, not metadata

`ref<ENT>` / `ref<CU>` / `ref<FORM>` / `ref<SYS>` / `ref<RES>` make a content↔X link a
**typed field of the schema**, so the CU envelope never sprouts a per-genre relationship
slot. A reward (`ref<RES>`), a referenced entity (`ref<ENT>`), an augmented system
(`ref<SYS>`) — each is a field. `unikit-gd-verify` resolves every `ref<>` value; a
dangling `ref<SYS>` / `ref<CT>` is **Critical**, the rest **Major**.

### Scale: `bulk` vs `curated`

Each content type declares a `scale:` in `GD-IDS`, and the scale dictates the
`CONTENT-TYPE.md` section-C structure and what enters the registry:

| Scale | Registry shape | Where the values live | Use for |
|-------|----------------|-----------------------|---------|
| **bulk** | a `count` + `spec` descriptor (one `content` row, `kind: set`) | the editor / data files — the values never cross the registry boundary | hundreds of similar units (loot items, beatmaps, spawn waves) |
| **curated** | `fields` rows in the registry (one `content` row, `kind: instance`, each `fields` ⊆ `CT.fields`) | the registry itself | a small hand-tuned set (heroes, boss cards) |

`unikit-gd-verify` checks `scale:` ↔ the document's section-C structure, exactly as it
checks a flow's `mode:` ↔ structure. A scale change is a **schema edit** (version bump +
data migration); **catalog churn** — adding/removing units, a `bulk` `count` change — is
data, **not** a schema edit (no version bump).

### `belongs_to` — CT → SYS (one-way)

A content type names the consuming system it feeds. The edge is **one-way** (a system
never lists its content types). A `belongs_to` naming a missing or deprecated system is a
verify conflict that **routes back to `/unikit-gd-spec` add-system** — the content zone
never writes a roster row itself.

### RES / TRACK / KNOB — cross-boundary facts

Resources (`RES-<slug>`), progression tracks (`TRACK-<slug>`), and global tuning knobs
(`KNOB-<slug>`) are cross-boundary **facts**, not documents. Each is registered by its
**owning zone via a registry-check** and lives under its own `GD-IDS` section, subject to
the unregistered-fact check like any other fact.

### The `## Content Map [gen]`

`/unikit-gd-content` re-renders the `## Content Map [gen]` block in `GAME.md` from
`GD-IDS.yaml` `content_types` whenever it writes (there is **no add-content in
`/unikit-gd-spec`** — a content type registers itself). Like the system and flow maps, it
is a **freshness surface only**: a stale render self-heals on the next verify, never a
coherence conflict.

### Code reads content (read-only)

Content is a *read* target for the code side, never a writeback. `/unikit-plan` emits an
optional **`## Content Context`** brief (the `CT.fields` schema, the `scale`, the
`belongs_to` system, the `ref<>` dependencies) parallel to `## Design` and
`## Flow Context`; `/unikit-explore` grounds first-class on `content_types`. The `scale`
dictates the code structure: `bulk` → a data table / loader per `spec`; `curated` → named
instances from the `fields` rows. A content type carries **no `implemented_version`** —
its delivery is a playtest call, exactly as a flow's readiness is.

---

## Genre profiles (the seed layer)

A **bundled, read-only genre-profile catalog** seeds GDD authoring so a new project does
not start from a blank page. Profiles ship in the npm package as JSON
(`data/gamedesign/genres/<id>.json`) — there is **no registry and no network**.

### The catalog

The catalog is the industry **genre matrix** (§4.1–4.6 of the design research), each row
authored strictly from the matrix — **no invented genres**. ~43 profiles span casual /
mobile, RPG, strategy, roguelike / sim / sandbox, action / competitive, and
narrative / social / niche families. Each profile is **confidence-graded**
(`high | medium | low`): the P0 "content = game" genres (match-3, puzzle, hidden-object,
tower-defense, roguelike, rhythm, CCG, deckbuilder) and mainstream genres are `high`;
cross-cut and partially-covered genres are `medium`; niche (educational, location-based)
are `low`. Platform profiles (mobile / console / VR …) are a separate, **deferred** layer
— VR/AR is excluded from the genre catalog for that reason.

A profile carries: a one-line `summary` (the match signal), `default_flow_mode`,
`default_packs`, *suggested* `seed_systems` / `seed_content_types` / `seed_entities` /
`seed_resources`, and the review-only `critical_sections` / `review_emphasis`.

### CLI: `genres list / show / install`

```
unikit-ai genres list                 # the catalog (with an installed marker); --json
unikit-ai genres show <id|alias>      # one profile (--json = the full profile object)
unikit-ai genres install <id|alias…>  # copy profile(s) into the project + record state
```

`genres install` delivers selectively — only the ids in `.unikit.json` `genres.installed`
land in `.unikit/system/gamedesign/genres/`, refreshed on `unikit-ai update`. Exit codes
are a subset of the rules CLI: **0** success · **1** not found / no `.unikit.json` · **3**
invalid args. There is no network (no exit 2) and no migration gate (no exit 8).

### How profiles seed authoring

The flow is **skill-driven — the user never types a `genres` command**:

1. **`/unikit-gd-brainstorm`** writes a **descriptive `genre:` hint** into the concept
   card — a human genre name ("симулятор ломбарда", "match-3 puzzle"), an *intent*, not a
   catalog id. It is CLI-free; it never installs a profile.
2. **`/unikit-gd-spec`** (Create mode) reads that hint, opens the catalog
   (`genres list`), **best-fits** the hint to a profile by `name` / `aliases` / `summary`
   (the hint may not equal any id — "симулятор ломбарда" → `tycoon`), runs
   `genres install <id>`, and writes the resolved id into the GAME.md header
   `genre_profile:`.
3. It then runs a **seed interview** — a subtractive multi-select over the profile's
   seeds plus additions, with `confidence` as the pre-fill knob (`high` pre-checks more,
   `low` asks more). Seeds are **proposals**, never auto-written. Kept seeds apply through
   the existing owner paths: systems → spec / add-system; content → `/unikit-gd-content`
   add-CT; RES/TRACK/KNOB → their zone-owner.

### Universal baseline

When there is no genre, no concept, or **no profile fits closely**, spec authors with a
**universal baseline** (treat as `confidence: low` — ask more, assume less), installs no
profile, and leaves `genre_profile:` empty.

### Read-only — divergence lands in `GD-IDS`

A profile is **never edited**. Every divergence — a dropped seed, an added field, a custom
content type — lands in **`GD-IDS.yaml`** (the project's custom configuration = the
registry, imported from the profile and augmented at spec). The genre layer dissolves into
the registry as it is used.

### Genre-blind verify, completeness lens in review

- **`/unikit-gd-verify` is genre-blind** — it never reads a profile's `critical_sections`.
  Both genre fields (`genre:` in CONCEPT, `genre_profile:` in GAME) are bare non-id slugs
  outside `GD-IDS`, inert to its id-resolving checks.
- **`/unikit-gd-review`** reads the resolved profile for one **declinable
  profile-completeness lens**: are the genre's `critical_sections` present and filled
  across the reviewed docs? A miss is a **Major** (advisory, never a blocker). The
  profile's `review_emphasis` is an advisory re-weight of the lens priorities.

---

## Adding a genre profile

Adding a genre profile is **zero code** — the accessor reads the whole folder. Author one
JSON file at `data/gamedesign/genres/<id>.json` following the schema (every field required
except `platform_default`):

```jsonc
{
  "schema_version": 1,
  "version": 1,
  "id": "match3",
  "name": "Match-3",
  "aliases": ["match3", "match-3", "swap-puzzle"],
  "summary": "...one-line match signal (for which games)...",
  "confidence": "high",                      // high | medium | low
  "default_flow_mode": "linear",             // linear | conditional | emergent
  "default_packs": ["level-design", "economy", "progression"],
  "seed_systems": [{ "slug": "board", "category": "Gameplay", "tier": "MVP", "why": "..." }],
  "seed_content_types": [{ "slug": "level", "belongs_to": "SYS-board", "scale": "bulk", "why": "..." }],
  "seed_entities": [{ "slug": "blocker", "why": "..." }],
  "seed_resources": [{ "slug": "coins", "kind": "soft", "why": "..." }],  // soft | hard | event
  "critical_sections": ["level-design.LevelMetrics", "economy.SourcesAndSinks"],
  "review_emphasis": ["...advisory review re-weight phrase..."],
  "platform_default": "mobile"               // optional
}
```

Source the seeds from the genre matrix (each row's *critical blocks* → `critical_sections`
/ `review_emphasis`; *specific entities* → the `seed_*` arrays; *what to add* → the content
types + packs + priority/confidence). The bundled package ships `data/` automatically, so a
new profile needs no build step — only `npm test` (the structural schema guard validates
required fields + enum values, NOT cross-refs, so forward-refs to not-yet-built packs are
fine).

## Brownfield adoption — code ↔ design at the edges

The module's core rule is a **one-way boundary**: code reads design, design never reads
code. But a team with a **live game and no GDD** has nothing to import — the only source of
design facts is the code itself. The module resolves this without breaking the boundary by
quantising the crossing into **three read-only research verbs** at the module's I/O edges.
Reconstructing design from an implementation is normally forbidden; these verbs are the
**third sanctioned exception** (alongside the review feasibility lens and the `implemented`
writeback), and they only ever *read* code into a *document* — they never author the GDD.

```
INPUT (code → design)            CORE (authoring zones)           OUTPUT (design → human)
  unikit-gd-recon        ┐                                      ┌  unikit-gd-docs
  (cold-start, whole     ├─▶  spec · system · flow · content  ─┤  (workspace → docs/design/)
   project → RECON.md)   │       (these NEVER read code)        │
  unikit-gd-explore      ┘                                      └
   (code lens, a slice)
```

### `unikit-gd-recon` — cold-start reconstruction

For a project with code but **no GDD yet**. It scans the whole project (engine
auto-detected — Unity / Godot / Unreal, via generic globs, never assumed) using
`Agent(subagent_type: Explore)` subagents (inline `Glob`/`Grep`/`Read` fallback) and writes
one passive `.unikit/gamedesign/RECON.md`: a **system roster + `depends_on` graph** (P0),
**content-type schemas / resources / entities** (P1), and — crucially — a mandatory
**`## Intent Gap`** for everything code cannot carry (pillars, the target fantasy, the
"why", whether numbers are balanced). Flows (the dynamics axis) are **excluded** — they are
not recoverable from code. Recon **recommends** `/unikit-gd-spec <RECON.md>` (import mode,
interactive) but **calls no skill** (it has no `Skill` tool). It is strictly cold-start;
once a GDD exists, use the explore code lens instead. You may pass an **optional seed** with
the invocation — a free-text game description, design notes, or file / folder / link
references — which sharpens the scan and is recorded verbatim in a `## Provided Context`
section (author-supplied intent, never confused with the code-extracted facts), pre-answering
Intent-Gap items the code is silent on.

> **The honest limit.** Code gives the *skeleton*, never the *soul*. A filled-but-soulless
> GDD is worse than an empty one, so every reconstructed fact is tagged
> `provenance: extracted from code` and the Intent Gap is never trimmed to look more
> complete.

### `unikit-gd-explore` — the code-grounded lens

The post-GDD, **targeted** counterpart: when a GDD already exists and the question is "how
is *our* X actually built?", the explore lens reads the named code slice (read-only) and
folds the findings into a research brief, tagged the same `provenance: extracted from code`.
Recon and this lens share one extraction engine (`unikit-gd-recon/references/code-recon.md`)
so the heuristics never diverge.

### Provenance — code-sourced is *suspect*, not trusted

`extracted from code` is held by the `unikit-gd-review` provenance lens at **≥ Major** — the
opposite of the trusted `extracted from SOURCE.md` (author-sourced). Because the import path
copies a `RECON.md` verbatim into `SOURCE.md`, the reconstruction carries a **durable banner**
the review lens detects, so it holds even the import's `extracted from SOURCE.md` sections to
≥ Major. This stops the import membrane from laundering code-inferred facts into trusted
author-sourced content.

### `unikit-gd-docs` — design → human (the export-out)

The conceptual mirror of recon. A **read-only** renderer that turns the workspace into a
human-readable GDD under `docs/design/` — Variant-B chapters (`index`, `systems`, `flows`,
`content`, `economy`, `glossary`), facts resolved inline from `GD-IDS`, drafts flagged 🚧.
`--web` additionally renders HTML from the `unikit-docs` template (absent → Markdown-only +
a `WARN`). The two doc generators split the tree cleanly: `unikit-docs` owns the top-level
`docs/*.md`, `unikit-gd-docs` owns `docs/design/**`.

---

[← Skills Reference](skills.md) · [Back to README](../README.md)
