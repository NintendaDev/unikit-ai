# UniKit Pipelines & Entry Points

How the skills connect into workflows, and where a user should start depending on what
they already have. Use this when the user asks "where do I start", "what's the workflow",
or "how do the pieces fit together".

There are **two workflows** that meet at a single one-way boundary:
1. the **code pipeline** (spec-driven implementation), and
2. the **game-design workflow** (GDD authoring).

---

## 1. The code pipeline (spec-driven)

The idea: instead of one big "write my game" prompt (random results, fix-causes-bugs),
each step closes a specific gap, with documents the next step validates against.

```
one-time:   /unikit                 setup: scans stack, writes context + memory + architecture
              │
strategy:   /unikit-roadmap         (optional) break the project into milestones
              │
research:   /unikit-explore         (optional) work out the technical approach → RESEARCH_BRIEF
              │
plan:       /unikit-plan            REQUIRED  turn a feature into an ordered task plan
              │
refine:     /unikit-improve  (x1-3) (optional, recommended) find gaps / fake APIs / rule misses
              │
build:      /unikit-implement       REQUIRED  write the code, write tests, commit at checkpoints
              │
quality:    /unikit-review  ──► /unikit-fix     (optional) review vs rules, then apply findings
            /unikit-verify ──► /unikit-fix     (optional) check vs the plan, build & tests
              │
commit:     /unikit-commit          (optional terminal) conventional commit (+ push)
              │
learn:      /unikit-evolve          (optional) turn fix-patches into project rules
```

**Only two steps are mandatory: `/unikit-plan` and `/unikit-implement`.** Everything else
raises quality. Maximum quality comes from the full chain.

**Fast track** (game jams, MVPs, small fixes): `/unikit-plan fast <feature>` →
`/unikit-implement`. Fast plans are a single flat `.unikit/code/PLAN.md`, no git branch.

**Full mode** adds a git branch, a codebase recon pass, a richer `PLAN-BRIEF.md`, and optional
test/docs checkpoints — use it for real features.

**Why `/unikit-improve` matters:** an LLM never follows 100% of the rules on the first pass, so
the first plan always has small (sometimes large) issues — invented APIs, missed rules,
wrong installers. `improve` re-reads the rules and the research and fixes the plan. Running it
2-3 times (it digs into different parts each pass) is normal.

### The bug-fixing sub-flow
```
deep bug:   /unikit-explore "why does X happen"   (read-only root-cause, no fix)
              │
fix:        /unikit-fix <bug>      finds root cause, fixes, suggests a test, writes a PATCH
              │
            (after ~3 patches)
              ▼
learn:      /unikit-evolve         patches → prevention rules → RULES.md / skill-context
```
Fixing through `/unikit-fix` (not by hand) is what feeds the learning loop: each fix leaves a
patch in `.unikit/code/patches/`, and `/unikit-evolve` turns recurring patches into rules so the
agent makes the same mistake less often.

---

## 2. The game-design workflow (GDD authoring)

The design track produces a Game Design Document that the code pipeline can consume. It is a
separate module (`gamedesign`) with its own skills (`unikit-gd-*`) and its own workspace
(`.unikit/gamedesign/`). Artifacts are authored in the configured language; IDs / terms /
formulas stay in English.

```
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
review:   /unikit-gd-review        (optional) "is it good/fun/balanced?" → severity verdict
            │
verify:   /unikit-gd-verify        (optional, recommended) "is it consistent with itself?" + cross-axis impact
              └─ loops back: a revised system or flow is re-reviewed, re-verified
```

The GDD has **three authoring axes**: **systems** (`/unikit-gd-system`, the rules), **flows**
(`/unikit-gd-flow`, the dynamics — what the player does over time), and **content**
(`/unikit-gd-content`, the catalog — the data the game is made of). A flow's `GOAL`s *exercise*
systems (`GOAL → SYS → AC`) and emit funnel `event`s; `/unikit-gd-flow` registers the flow itself
(its `flows:` / `events:` entries) and re-renders the `## Flow Map [gen]` / `## Funnel [gen]` blocks
— there is no add-flow in `/unikit-gd-spec`. Likewise a **content type** `belongs_to` a consuming
system and registers itself (its `content_types:` / `content:` entries + `## Content Map [gen]`) —
there is no add-content in `/unikit-gd-spec`; a missing `belongs_to` system routes to spec
add-system.

**Genre profiles (seed layer).** A bundled, read-only catalog (`unikit-ai genres list/show/install`;
the §4.1–4.6 genre matrix) seeds authoring. `/unikit-gd-brainstorm` writes a descriptive `genre:` hint
into the concept (CLI-free); `/unikit-gd-spec` (Create) best-fits it to a profile, installs it
(skill-driven — the user never types `genres`), writes `genre_profile:` into GAME.md, and runs a seed
interview (or a universal baseline when no profile fits). `/unikit-gd-review` reads the profile for a
declinable genre-completeness lens; `/unikit-gd-verify` stays **genre-blind**. The profile is read-only —
every divergence lands in `GD-IDS.yaml`.

**Research is cross-cutting**, not a fixed stage. `/unikit-gd-explore` can:
- feed brainstorm (delegated market validation),
- research a reference game (mechanics → dynamics → aesthetics),
- or run the **internal-design lens** — read-only research aimed inward at *this* game, to
  improve an existing system, invent a new mechanic, or work out a **flow** (pacing /
  progression / a new player journey). It then **routes you** (see below).

### The internal-design-lens 3-way routing
After `/unikit-gd-explore` researches a change/addition for your game, it reads the target's
status and hands you the right next command (you don't pick):

| Target state | Route |
|--------------|-------|
| no doc / not-started | `/unikit-gd-spec` (add the system to the map) → `/unikit-gd-system` |
| skeleton (placeholders) | `/unikit-gd-system` (fill it in) |
| detailed / reviewed / revised | `/unikit-gd-system` (record the change as a delta) |

For a **flow** target the routing collapses to a single door — `/unikit-gd-flow` owns the flow's
whole lifecycle (create / fill / revise) and a flow registers itself, so there is no spec
add-flow step. The lens pre-fills it from a `## Flow Feature Plan` (new flow) or
`## Flow Improvement Plan` (revision) brief.

### gd-review vs gd-verify (commonly confused)
- **`/unikit-gd-review`** = subjective quality ("is this design *good*?") — adversarial lenses,
  severity verdict. The senior-reviewer pass.
- **`/unikit-gd-verify`** = mechanical consistency ("is the design consistent with *itself*?") —
  broken IDs, terminology drift, dependency/status coherence. The linter pass.

---

## 3. How code and design connect — the one-way boundary

**Design → code, never code → design** (with one tiny sanctioned exception).

- `/unikit-plan` and `/unikit-explore` read the GDD through the shared **`design-read`** contract
  (`.unikit/system/gamedesign/design-read.md`): its read surfaces, the **flow-first resolution**
  (*intent decides the door* — a flow-named request resolves a flow first, a system-named one a
  system, ambiguous → ask), and the one-way boundary.
- `/unikit-plan` copies a `## Design` snapshot into the plan brief, citing the system's acceptance
  criteria (`AC-<id>`s) and a version. The code is built to satisfy those AC.
- `/unikit-plan` also grounds in the **flow** axis: under the flow door (or when a system in scope
  is exercised by a flow), it adds an optional `## Flow Context` brief (the `GOAL`-steps + the
  flow's wiring mode, which shapes the code structure) parallel to `## Design`. A flow's `Realized`
  state is **derived** from its systems' `implemented_version` — code never writes back into flows.
- `/unikit-verify` checks the implementation against the AC snapshotted **in the plan** (not the
  live GDD), preserving the boundary.
- **The one exception:** when every cited AC is met, `/unikit-verify` stamps `implemented_version`
  into the GDD's `GD-IDS.yaml` (a single surface; GAME.md's `## System Map [gen]` renders the
  `implemented` state read-only). That is the only write from code back into design.

So a "GDD-first" project flows: design track → `GAME.md`/systems → `/unikit-plan` (pulls the AC) →
`/unikit-implement` → `/unikit-verify` (confirms AC, stamps implemented).

---

## 4. Entry points — where to start

Pick the row that matches what the user already has:

| The user has... | Start with | Then |
|-----------------|------------|------|
| **Nothing / a fresh project** | `/unikit` (one-time setup) | `/unikit-plan` or the design track |
| **No game idea yet** | `/unikit-gd-brainstorm` | `/unikit-gd-spec` |
| **An idea but no GDD** | `/unikit-gd-spec <description>` (or `<concept-slug>`) | `/unikit-gd-system` |
| **An existing GDD file/URL** | `/unikit-gd-spec <path-or-url>` (import) | `/unikit-gd-system` |
| **A GDD, wants to detail a system** | `/unikit-gd-system <system>` | `/unikit-gd-review` / `/unikit-gd-verify` |
| **A GDD, wants a new mechanic** | `/unikit-gd-explore <mechanic>` (routes onward) | spec add-system → system |
| **A feature idea, needs direction** | `/unikit-explore <topic>` | `/unikit-plan` |
| **A clear feature** | `/unikit-plan [fast\|full] <feature>` | `/unikit-improve` → `/unikit-implement` |
| **A research brief already** | `/unikit-plan` (it finds the latest research) | `/unikit-implement` |
| **A plan, wants code** | `/unikit-implement` | `/unikit-verify` → `/unikit-commit` |
| **Written code to check** | `/unikit-review` and/or `/unikit-verify` | `/unikit-fix` |
| **A bug** | `/unikit-fix <bug>` (deep bug → `/unikit-explore` first) | `/unikit-verify` → `/unikit-commit` |
| **Rules to capture / books to learn from** | `/unikit-rules` (one-liner) or `/unikit-memory` (sources) | — |

If the user can't place themselves in this table, fall back to the diagnostic in
`scenarios.md`.
