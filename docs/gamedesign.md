[← Plan Files](plan-files.md) · [Back to README](../README.md) · [Dynamic Memory →](dynamic-memory.md)

# Game-Design Module

UniKit ships a second knowledge module, **`gamedesign`**, dedicated to authoring a
**Game Design Document (GDD)**. It installs eleven `unikit-gd-*` skills, a
domain-knowledge rule library, and a set of system-asset contracts. Design artifacts
live in their own workspace (`.unikit/gamedesign/`) and are authored in the project's
configured language; **ids / keywords / canonical terms / formulas stay English**.

The boundary to the code module is deliberately **one-way**: code reads design, design
never reads code. Code writes back exactly one field (`implemented_version`, stamped by
code-side `/unikit-verify`); three narrow, individually-sanctioned reads cross the other
way. See **How code and design connect** below for the full detail.

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

See **The pipeline** below for the order these skills run in, **Research** for
`/unikit-gd-explore`'s lenses, **Multi-zone edits** for how `/unikit-gd-apply` dispatches,
and **Review vs Verify** for how the two quality gates hand results onward.

---

## Domain-knowledge rules

Alongside the eleven skills, the `gamedesign` module installs a **domain-knowledge rule
library** from the same registry that serves `code` rules — fetched via
`unikit-ai rules install` / `sync`, module-scoped with `--module gamedesign`. See
[Dynamic Memory](dynamic-memory.md#modules-code-vs-gamedesign) for how installation and
sync work; this section covers what the rules actually contain.

### `core` — canonical, official-backed theory

Twelve rules the design-track skills load by `Load when` match (not "always," unlike
`code`'s core tier) - each is a compact method reference, not a knowledge dump:

| Rule | Scope |
|------|-------|
| `frameworks` | MDA aesthetics, SDT/PENS motivation needs, the flow channel, game-feel responsiveness budgets |
| `player-motivation` | The Quantic Foundry 12-motivation model, audience definition, system-coverage checks |
| `core-loops` | Loop anatomy (action → reward → investment → re-entry), timescale layering, retention triggers |
| `balance` | Cost curves, payoff matrices for intransitive systems, power/difficulty curves, tuning-knob discipline |
| `economy` | Faucet/sink conservation, currency taxonomy, value chains, gacha/pity math, inflation guardrails |
| `progression` | Progression axes, XP curve families, unlock pacing, skill trees, power-vs-content coupling |
| `level-design` | Bubble diagrams, pacing beat sheets, the "gym" teaching pattern, movement/combat metrics |
| `narrative` | The story bible as canon, branching structures and their cost, reactive dialogue, ludonarrative consonance |
| `ux-onboarding` | Teach-by-doing onboarding, the FTUE funnel as a telemetry contract, cognitive-load budgets |
| `accessibility` | Game Accessibility Guidelines tiers, impairment categories, the legal floor, high-impact features |
| `liveops` | Battle-pass anatomy, content calendars vs team capacity, the engagement-vs-exploitation line |
| `monetization-ethics` | Dark-pattern taxonomy, loot-box/gacha odds disclosure, legal landscape, designing for minors |

Resolution is **per-id-merge** (`coreResolution: 'per-id-merge'`), not `code`'s
module-winner: for each id, a studio's own registry version overrides the canonical one;
missing ids backfill from official → bundled. The `Load when` text lives inside each rule
file, not in a separate index — the design-track skills read it directly to decide when a
rule is relevant to the current zone/section.

### `library` — the studio slot

Ships empty. Recurring review/verify conflicts, or house design conventions, route here via
`/unikit-memory --module gamedesign` - the same authoring skill that maintains `code` stack
rules, scoped to this module.

### Not a rule: `gd-principles` and its shards

The *process* contract (zone ownership, the Decision-First cycle, delta discipline, ID
conventions, severity rubric) is deliberately **not** a rule - it lives in the
`gd-principles` system asset (core + 6 shards: `gd-authoring`, `gd-lifecycle`,
`gd-flow-axis`, `gd-content-axis`, `gd-provenance`, `gd-critique`), installed to
`.unikit/system/gamedesign/` and read by each skill on Bootstrap. A regression guard fails
a `core` rule that grows a process/authoring section - core rules carry domain knowledge
only.

---

## The pipeline — from idea to verified GDD

The design track has exactly one required stop — `/unikit-gd-spec`, the GDD root every
other skill reads from. Everything else is optional-but-recommended quality, the same
shape as the code pipeline. A typical run:

```
recon:    /unikit-gd-recon        (brownfield) existing code but NO GDD → reconstruct a RECON.md skeleton
            │                                 (cold-start only; read-only on code; calls nothing) → spec import
ideate:   /unikit-gd-brainstorm    (optional) blank page → a CONCEPT card (pillars, loops, pre-mortem)
            │
spec:     /unikit-gd-spec          REQUIRED  master GDD (GAME.md + ## System Map [gen]) + GD-IDS.yaml registry
            │                                 (also: edit GAME.md content, import a GDD, add one system;
            │                                  Create seeds a genre profile — see "Genre profiles" below)
system:   /unikit-gd-system        REQUIRED per system  the A-K per-system doc — the *rules* (create/fill +
            │                                 revise as a versioned delta: tune / tweak / rework)
flow:     /unikit-gd-flow          per flow  the FLOW-<slug> doc — the *dynamics* (objectives, pacing, funnel);
            │                                 picks the wiring mode + re-renders ## Flow Map [gen] / ## Funnel [gen]
content:  /unikit-gd-content       per content type  the CT-<slug> doc — the *catalog* (typed CT.fields schema,
            │                                 scale bulk|curated) + re-renders ## Content Map [gen]; the editor owns the values
review:   /unikit-gd-review        (optional) "is it good/fun/balanced?" → verdict → two buckets (apply-ready / research)
            │
verify:   /unikit-gd-verify        (optional, recommended) "is it consistent with itself?" → 4 tracks → apply-ready
            │
handoff:  → /unikit-gd-apply (apply-ready, one pass) · /unikit-gd-explore (research)   review/verify → [explore] → apply
            │ └─ loops back: an edited system or flow is re-verified (status stays detailed; the version + changelog record the change)
docs:     /unikit-gd-docs          (optional) the GDD → human-readable docs/design/*.md (the export-out)
```

`/unikit-gd-system` / `/unikit-gd-flow` / `/unikit-gd-content` are **required per
instance** — a playable slice needs at least one system, but flows and content types are
added only as the design actually needs them. Review, verify, apply, and docs are
quality/export layers on top; maximum confidence comes from running the full chain, not
from skipping to implementation.

### Entry points — where to start

| You have... | Start with | Then |
|---|---|---|
| No game idea yet | `/unikit-gd-brainstorm` | `/unikit-gd-spec` |
| An idea but no GDD | `/unikit-gd-spec <description>` | `/unikit-gd-system` |
| An existing GDD file / URL | `/unikit-gd-spec <path-or-url>` (import) | `/unikit-gd-system` |
| A live game / existing code but no GDD | `/unikit-gd-recon` (reconstruct a `RECON.md` skeleton) | `/unikit-gd-spec <RECON.md>` (import) |
| A GDD, want to detail a system | `/unikit-gd-system <system>` | `/unikit-gd-review` / `/unikit-gd-verify` |
| A GDD, want a new mechanic | `/unikit-gd-explore <mechanic>` (routes onward) | spec add-system → system |
| A GDD, want to know how a system is actually built in code | `/unikit-gd-explore <system> in the code` (code lens, read-only) | the routed owner |
| A GDD, several decided edits across zones | `/unikit-gd-apply "<the edits>"` | `/unikit-gd-verify` |
| A GDD, want to publish/export it for people to read | `/unikit-gd-docs` (`--web` for HTML) | share the rendered docs |

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

## Research — `/unikit-gd-explore`'s lenses

`/unikit-gd-explore` is the design track's read-only research partner — it never authors
the GDD itself, it researches and then hands you (or auto-routes you to) the right next
command.

| Lens | Reads | Used for | Output |
|---|---|---|---|
| **Reference & market** | external references, market signals (`references/market-scan.md`) | dissecting a reference game's mechanics → dynamics → aesthetics, checking a genre/mechanic's market fit | `.unikit/gamedesign/researches/<date>_<slug>/` |
| **Internal design** | the GDD workspace, read-only | improving an existing system, inventing a new mechanic, or working out a flow — for *this* game | a research brief + a routed next command |
| **Code-grounded** | the named code slice, read-only, post-GDD | "how is our X actually built?" | a brief tagged `provenance: extracted from code` — see **Brownfield adoption** below |

`/unikit-gd-brainstorm` delegates to the reference & market lens at its Phase 3.5 for
market validation — the brief returns directly into the brainstorm session, with no
`researches/` file (an explore-owned spec, `unikit-gd-explore/references/delegation-contract.md`).

**The internal-design lens** is intent-inferred (no flag) — it deep-reads the target,
grounds its options in theory and the pillars ("which curve? linear / diminishing /
threshold, or describe your own" — never a blank page), and closes with a mode-aware
brief block per axis:

| Target axis | Create brief | Revise brief |
|---|---|---|
| System | `## New Feature Plan` | `## Improvement Plan` |
| Flow | `## Flow Feature Plan` | `## Flow Improvement Plan` |
| Content | `## Content Feature Plan` | `## Content Improvement Plan` |

For a **system**, the lens reads the target's `doc_status` and routes you without asking:

| Target state | Route |
|---|---|
| no doc / `not-started` | `/unikit-gd-spec` (add the system to the map) → `/unikit-gd-system` |
| `skeleton` (placeholders) | `/unikit-gd-system` (fill it in) |
| `detailed` / `reviewed` / `revised` | `/unikit-gd-system` (record the change as a delta) |

For a **flow** or **content type** the routing collapses to a single door — `/unikit-gd-flow`
and `/unikit-gd-content` each own their whole axis lifecycle (create + fill + revise) and
self-register, so there is no spec add-flow / add-content step to route through.

Two research artifacts behave differently on re-entry: a **review file**
(`reviews/*_review-*.md`) is mutated **in place** — the research bucket develops into an
apply-ready fix, closing with one `/unikit-gd-apply reviews/X.md` — while a fresh topic
gets its own `researches/<date>_<slug>/` folder, and a `RECON.md` keeps the reconstruction
and gains a `## Explorations` backlink.

---

## Multi-zone edits — `/unikit-gd-apply`

A design change that spans more than one zone at once — tune a system **and** add a
content field **and** retune a flow's pacing — doesn't need one-by-one owner calls.
`/unikit-gd-apply` dispatches it as a single ordered pass. It **owns nothing and writes
nothing itself** — no `Write`/`Edit` in its tool list, only `Skill` — it resolves, orders,
and delegates.

**Two gates run before anything dispatches:**

- **GATE 1 — explicit-edit only.** Every delta must be a concrete change you've already
  decided. An open question ("work out a better economy") is not an apply job — it routes
  to `/unikit-gd-explore` first. A mixed request gets split: decided deltas dispatch, the
  open one goes to explore.
- **GATE 2 — multi-zone only.** The resolved set must touch **two or more zones**. A
  single-zone request has nothing to dispatch — it bounces straight to that zone's owner
  (a real invocation, not a printed suggestion): one system edit → `/unikit-gd-system`,
  one schema edit → `/unikit-gd-content`, one flow edit → `/unikit-gd-flow`, one `GAME.md`
  edit or a lone new system → `/unikit-gd-spec`.

**Dispatch order is system-before-sinks** — `/unikit-gd-spec` → `/unikit-gd-system` →
`/unikit-gd-content` → `/unikit-gd-flow`, one zone at a time, never in parallel, so a
downstream owner (content, flow) always reads a fresh upstream (a just-added system). It
closes with exactly one bare `/unikit-gd-verify` call — no scope argument, since verify
derives the changed scope from the session itself.

**Three-tier dispatch mechanism**, in preference order: ① `Skill(skill:
"unikit-gd-<zone>", ...)` inline, when the agent supports it; ② the `/unikit-gd-<zone>`
slash-command fallback, invoked as a real call (not printed) — needed because 5 of the 6
supported agents don't expose the `Skill` tool; ③ a printed `Run: /unikit-gd-…` list, the
last resort when neither mechanism is available. On Codex, a `<!-- unikit:agents codex
-->` block makes tiers ①/② automatic rather than asking the user to run them by hand.

**Loop-guard.** Apply's closing verify call passes the sentinel `apply-phase3` as its
argument. Verify recognizes it as an in-apply gate (not a scope) and suppresses its own
handoff offer for that run — otherwise `apply → verify → apply` could recurse.

---

## Review vs Verify — and the handoff to Apply

`/unikit-gd-review` and `/unikit-gd-verify` are commonly confused — they ask different
questions and hand off differently.

| | `/unikit-gd-review` | `/unikit-gd-verify` |
|---|---|---|
| Question | "Is this design *good* — fun, balanced, coherent with the pillars?" | "Is the design consistent with *itself*?" |
| Method | Adversarial lens fan-out (fantasy-delivery, systems-math, provenance, feasibility, …) | Mechanical grep-first checks (IDs, terminology, dependency/status/version coherence) |
| Persists to | `.unikit/gamedesign/reviews/<date>_review-<scope>.md` — its only write | Nothing — fully read-only, prints an inline report |
| Finding id | `RF-<date>-n`, minted in severity order, cited later in changelogs | None — a verify hit is a *conflict*, not a numbered finding |
| Can it be declined? | Yes — `[Decline]` drops a finding | No — a conflict is a fact; you only choose *how* to fix it |

**Both end in the same triage.** Every finding/conflict runs through a shared **ENTAILED**
test (the `gd-critique` Handoff Engine) — it's **apply-ready** only when all five hold: a
concrete target, a value already authoritative in the workspace (never invented), exactly
one fix, a local edit (not a redesign), and no external knowledge needed (no market data,
math, or playtest). Anything failing even one of those joins the **research** bucket
instead of being silently applied. A short interview (batched `AskUserQuestion`, ≤4 items
per call) sorts what's left — a review finding can still be declined there; a verify
conflict only gets a choice of *direction*.

**The handoff itself is recommend-only.** Neither skill carries `Skill` in
`allowed-tools` — each **prints** the `/unikit-gd-apply` command rather than calling it,
and on Codex the same `<!-- unikit:agents codex -->` auto-invoke block runs it without
asking. Apply-ready findings go to `/unikit-gd-apply` (one ordered pass, see above); the
research bucket goes to `/unikit-gd-explore`, which develops it **in place** in the review
file, then closes with one `/unikit-gd-apply reviews/<file>.md`.

**Persistence is asymmetric on purpose.** A review is a durable, re-readable verdict —
worth keeping as a file, even a clean one (empty buckets render as `(none)`, though a
clean review skips the handoff offer). A verify pass is cheap to re-run after every edit,
so it hands off inline prose from the session instead of writing anything.

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
  across the docs under review? A miss is a **Major** (advisory, never a blocker). The
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

---

## How code and design connect — the one-way boundary

The relationship between the two modules is deliberately asymmetric: **design writes,
code only reads.** The mechanics of that read are formalized in one shared contract,
`design-read.md` (installed to `.unikit/system/gamedesign/design-read.md`), loaded by
both `/unikit-plan` and `/unikit-explore` once a linked design workspace exists (a
`version: 2` `GD-IDS.yaml` — an older workspace surfaces as `ERROR [design]` instead).

**Read the registry, not the render.** `GD-IDS.yaml` is the machine-readable source of
truth for ids, `status`/`doc_status`, `version`, `implemented_version`, `depends_on`, and
the flow/content facts (`goals`, `targets`, `scale`, `belongs_to`, `fields`). The
per-system/flow/content-type `.md` docs are cited by id (`AC-<id>`, `GOAL-<id>`,
`CU-<id>`) rather than copied. The `[gen]` maps at the bottom of `GAME.md` are
**orientation only** — read-only renders, never a fact source when the registry already
has the fact. Effective status is layered: start from `doc_status`, a `deprecated` status
overrides it, and a non-empty `implemented_version` overrides that again.

**Flow-first resolution — intent decides the door.** A request can target one of three
axes — system, flow, or content — and the contract resolves whichever the request
actually names, never defaulting to systems: a flow-named request ("plan the
first-session flow", a `FLOW-<slug>`) resolves a flow first; a mechanic or `SYS-<slug>`
resolves a system; "the item catalog" or a `CT-<slug>` resolves a content type. A
genuinely ambiguous request asks rather than guesses.

**What code pulls.** `/unikit-plan` copies a `## Design` brief into the plan (citing the
system's `AC-<id>`s and its version), plus optional `## Flow Context` (the `GOAL`-steps
and wiring mode) and `## Content Context` (the `CT.fields` schema, `scale`, `belongs_to`)
briefs when the feature touches those axes. `/unikit-verify` later checks the
implementation against the AC **snapshotted in the plan**, not the live GDD — so a design
edit mid-implementation doesn't retroactively change what's being verified.

**Exactly one write crosses back, and it's narrow.** When every cited AC is met,
`/unikit-verify` stamps `implemented_version` into `GD-IDS.yaml` — a single surface;
`GAME.md`'s `## System Map [gen]` renders that state read-only, and a flow's `Realized`
state is *derived* from its systems' `implemented_version` rather than ever written
directly (flow delivery is a playtest call, not a verify gate).

**Three narrow reads cross the other way**, each sanctioned individually rather than
opening the boundary generally:

1. The **feasibility lens** inside `/unikit-gd-review` may read exactly
   `.unikit/DESCRIPTION.md` and `.unikit/ARCHITECTURE.md` — never `.unikit/code/` or
   actual source — to flag a design the real tech stack can't support (a Critical
   finding, evidenced by the line it relied on).
2. The `implemented_version` writeback above.
3. The **brownfield research verbs** (`/unikit-gd-recon`, and the `/unikit-gd-explore`
   code-grounded lens) — covered next.

---

## Brownfield adoption — code ↔ design at the edges

A team with a **live game and no GDD** has nothing to import — the only source of design
facts is the code itself. The module resolves this without reopening the boundary above
by quantising the crossing into read-only research verbs sitting at the module's I/O
edges: two inputs (`/unikit-gd-recon`, and the `/unikit-gd-explore` code lens — item 3 in
the exceptions list above) and one output (`/unikit-gd-docs`, covered at the end of this
section). Each only ever *reads* code into a *document*, or *reads* the workspace into
human-readable pages — none of them author the GDD.

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
`recon-agent` dispatches (inline `Glob`/`Grep`/`Read` fallback) and writes
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

## See Also

- [Skills Reference](skills.md) — the full `unikit-*` skill list, including quick-reference entries for `/unikit-gd-content`, `/unikit-gd-apply`, and the `genres` CLI
- [Development Workflow](workflow.md) — the code pipeline this module feeds through `## Design` / `## Flow Context` / `## Content Context` briefs
- [Dynamic Memory](dynamic-memory.md) — how `gamedesign` rules (core + library) are installed and synced, module-aware alongside `code`

---

[← Plan Files](plan-files.md) · [Back to README](../README.md) · [Dynamic Memory →](dynamic-memory.md)
