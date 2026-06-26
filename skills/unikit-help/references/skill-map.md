<!--
  UniKit skill map — the navigator's internal catalog.

  This is the single index `unikit-help` routes from. It is HAND-MAINTAINED but
  GUARDED: scripts/test-help-skill.sh fails if a skill exists under skills/ that has
  no `### <skill-name>` heading here (so the map can never silently fall behind the
  framework). When you add or remove a unikit skill, add or remove its heading here.

  Format contract (the guard depends on it): every skill is documented under a
  level-3 heading of the exact form `### <skill-name>` (no slash, no backticks).
-->

# UniKit Skill Map

Every `unikit-*` skill, what it owns, and what runs before/after it. Skills are
invoked as slash commands (e.g. `/unikit-plan`); on Codex the prefix is `$`
(`$unikit-plan`), on Qwen it is `/skills unikit-plan`.

Legend: **Required** = part of the minimum path · **Optional** = quality/extra ·
**Setup** = one-time · arrows show the usual neighbours.

---

## Setup

### unikit
- **Purpose:** One-time whole-project bootstrap. Scans the engine + real tech stack and
  generates the base context: `.unikit/config.yaml`, `.unikit/DESCRIPTION.md`, `AGENTS.md`,
  the memory knowledge base, and (delegated) `.unikit/ARCHITECTURE.md`.
- **When:** First thing in any project — "initialize/set up unikit", "bootstrap the project".
- **In:** optional project description (a sentence, or a path to a design doc). Needs the
  installer to have run first (engine chosen).
- **Out:** the `.unikit/` context files + `AGENTS.md` + `.unikit/memory/code/{core,stack}/`.
- **Required (Setup).** Before: the `unikit-ai init` installer. After: `/unikit-plan`,
  or `/unikit-gd-brainstorm` / `/unikit-gd-spec` for the design track.

### unikit-architecture
- **Purpose:** Generate / update `.unikit/ARCHITECTURE.md` — folder layout, dependency rules,
  module communication, chosen architecture pattern.
- **When:** "describe the architecture", "which architecture should I use", or to refresh it.
- **In:** an optional pattern name (else auto-detect). Reads DESCRIPTION.md + the project scan.
- **Out:** `.unikit/ARCHITECTURE.md`.
- **Required-context, auto-run by `/unikit`.** Standalone editor afterward. Before: `/unikit`.
  After: read by almost every skill's bootstrap.

---

## Code pipeline (spec-driven)

### unikit-roadmap
- **Purpose:** Strategic milestone roadmap (`.unikit/ROADMAP.md`) — break a big project into
  5-15 milestones; mark progress.
- **When:** "what should I build next", "milestones", "roadmap", "check what's done".
- **In:** a vision/requirements text or reference docs; `check` to auto-scan progress.
- **Out:** `.unikit/ROADMAP.md`.
- **Optional (strategy layer).** Before: `/unikit`. After: `/unikit-plan <milestone>`.

### unikit-explore
- **Purpose:** Read-only thinking partner for *technical* work — research a solution, design a
  feature's architecture, compare frameworks, or deep-dive a bug's root cause. Never writes code.
- **When:** "let's explore", "how should we architect this", "compare X vs Y", "why does this
  bug happen". Use before planning when you don't yet have technical direction.
- **In:** a topic / question / system name — or, when a design workspace exists, a **flow**
  / player sequence (a *first-class flow input* grounded on the dynamics axis via the shared
  `design-read` contract). `init` rebuilds the researches index.
- **Out:** `.unikit/code/researches/<date>_<name>/` (`RESEARCH_RESULT.md` + `RESEARCH_BRIEF.md`),
  and `researches/INDEX.md`.
- **Optional (research).** Before: `/unikit`. After: `/unikit-plan` (consumes the brief),
  `/unikit-fix` (if a bug was found).

### unikit-plan
- **Purpose:** Turn a feature into a dependency-ordered task plan + technical brief.
- **When:** "plan this feature", "create tasks". The first **required** step of building.
- **In:** a feature description, or a research brief, or a roadmap milestone. Modes: `fast`
  (flat `.unikit/code/PLAN.md`, no branch), `full` (folder + git branch + brief), `add` (extend)
  — each mode body loads on demand from `references/mode-*.md`.
  If a game-design workspace exists, planning resolves **flow-first** (*intent decides the
  door* — a flow-named request grounds on the flow, a system-named one on the system,
  ambiguous → ask) and pulls a `## Design` (+ optional `## Flow Context`) brief citing the
  system's `AC-<id>`s.
- **Out:** `.unikit/code/PLAN.md` or `.unikit/code/plans/<date>_<feature>/{TASKS.md,PLAN-BRIEF.md}`.
- **Required.** Before: `/unikit-explore` (optional). After: `/unikit-improve`, `/unikit-implement`.

### unikit-improve
- **Purpose:** Refine an existing plan — find missing tasks, wrong dependencies, made-up APIs,
  rule mismatches. Run it 1-3x; each pass digs into untouched parts.
- **When:** right after `/unikit-plan`, before implementing.
- **In:** the latest (or a named) plan. Optional `+check` validates findings in a fresh context.
- **Out:** edits the plan in place + an improvement report.
- **Optional but strongly recommended.** Before: `/unikit-plan`. After: `/unikit-implement`.

### unikit-implement
- **Purpose:** Execute the plan — write the code, mark tasks done, write tests (if the plan asks),
  commit at checkpoints. Resumable across sessions.
- **When:** "implement", "execute the plan", "continue", "do Phase 2".
- **In:** the latest plan, or `@<folder>`, or a phase/task selector. Bootstraps rules once, then
  codes inline.
- **Out:** project source code; updates `TASKS.md` checkboxes.
- **Required.** Before: `/unikit-plan` (+`/unikit-improve`). After: `/unikit-review` /
  `/unikit-verify` / `/unikit-commit`.

### unikit-review
- **Purpose:** Qualitative code review against the project's rules — bugs, security, performance,
  style. Read-only; emits findings + a machine-readable gate result.
- **When:** "review my code", "review this PR", "is this code okay". After implementing.
- **In:** nothing (staged changes), a file/folder, a PR number, or a branch/commit. Optional
  `+check`.
- **Out:** a findings report (no file changes).
- **Optional.** Before: `/unikit-implement`. After: `/unikit-fix` (apply the findings).

### unikit-verify
- **Purpose:** Verify the implementation *against the plan* — every task done, build clean, tests
  pass, no leftover TODOs, conventions honoured. Emits a gate result.
- **When:** "verify", "did we miss anything", "does it build and pass tests". After implementing.
- **In:** nothing (latest plan), or a feature name; `--strict` raises the bar.
- **Out:** a verification report. The **one** sanctioned code→design write: on all-AC-met it
  stamps `implemented_version` into the GDD's `GD-IDS.yaml` (a single surface; GAME.md's
  `## System Map [gen]` renders the `implemented` state read-only).
- **Optional (pre-merge gate).** Before: `/unikit-implement`. After: `/unikit-fix`, `/unikit-commit`.

### unikit-fix
- **Purpose:** Fix a specific bug — find the root cause, fix it, suggest a test, and always write
  a learning *patch*. Also applies `/unikit-review` and `/unikit-verify` findings.
- **When:** "fix this bug", an error / stack trace / console log, "apply the review findings".
- **In:** a bug description, or findings already in the conversation, or an existing `FIX_PLAN.md`.
  Modes: Fix-now or Plan-first.
- **Out:** a code fix + a patch in `.unikit/code/patches/`.
- **Optional (triggered by bugs).** Before: `/unikit-explore` (deep bugs), `/unikit-review`,
  `/unikit-verify`. After: `/unikit-verify`, `/unikit-commit`, and (after several patches)
  `/unikit-evolve`.

### unikit-commit
- **Purpose:** Generate conventional-commit messages from staged changes (with engine-specific
  safety checks), commit, and optionally push. Splits unrelated changes.
- **When:** "commit", "save changes". Always commit through this, not manual git.
- **In:** an optional scope hint.
- **Out:** a git commit (+ optional push).
- **Optional (terminal step).** Before: any of implement/fix/verify/review.

### unikit-evolve
- **Purpose:** Learn from accumulated fix-patches — extract prevention points and turn them into
  coding rules (`RULES.md`) or skill-workflow overrides (`skill-context/`).
- **When:** after several `/unikit-fix` sessions (it suggests itself at ~3 unprocessed patches);
  "learn from my fixes".
- **In:** `.unikit/code/patches/` (incremental via a cursor).
- **Out:** proposed rules → `.unikit/RULES.md` and/or `.unikit/skill-context/<skill>/SKILL.md`.
- **Optional (feedback loop).** Before: `/unikit-fix`. After: `/unikit-rules`, `/unikit-memory`.

### unikit-devcontext
- **Purpose:** The code-writing engine / senior-developer persona for direct, ad-hoc edits with
  **no plan** (e.g. a one-off refactor). The skill the pipeline delegates to as `develop-agent`.
- **When:** "just add this method", "refactor this", "do it directly, no plan".
- **In:** a task or file path; bootstraps the full knowledge base.
- **Out:** project code.
- **Optional / internal.** Used directly for quick edits, or spawned by implement/fix/verify
  for parallel or deep-dive work.

---

## Game design

### unikit-gd-recon
- **Purpose:** Cold-start **brownfield** reconnaissance — reconstruct CANDIDATE design facts
  from an existing codebase into one passive `RECON.md`, for a team with a live game but no
  GDD (nothing to import). A read-only research verb: it reads code, writes one document, and
  calls no skill.
- **When:** "we have a game but no GDD", "reconstruct the design from the code", "bootstrap a
  GDD from this Unity/Godot/Unreal project". STRICTLY cold-start — once a GDD exists use
  `/unikit-gd-explore` (code lens) for a targeted slice instead.
- **In:** an optional subsystem / path to focus the scan. The engine is auto-detected.
- **Out:** `.unikit/gamedesign/RECON.md` — a system roster + dependency graph (P0) and
  content-type schemas / resources / entities (P1), every fact `provenance: extracted from
  code`, plus a mandatory `## Intent Gap` for what code cannot know (pillars, fantasy, the
  "why"). Recommends `/unikit-gd-spec <RECON.md>` import; writes nothing else, calls no skill.
- **Optional (the brownfield entry of the design track).** After: `/unikit-gd-spec` import.

### unikit-gd-brainstorm
- **Purpose:** Ideate a brand-new game concept from a blank page or a one-line hint — pillars,
  loops, motivation, pre-mortem — into a CONCEPT card. Includes delegated market validation.
- **When:** "I don't know what game to make", "let's come up with a game", "a roguelike idea".
- **In:** an optional theme/hint. Auto-resumes an in-progress concept.
- **Out:** `.unikit/gamedesign/concepts/<date>_<slug>/CONCEPT.md` (+ rejected-idea backlog). Also
  writes a **descriptive `genre:` hint** into the card (a human genre name; CLI-free — `/unikit-gd-spec`
  resolves it to a bundled genre profile downstream).
- **Optional (entry of the design track).** After: `/unikit-gd-spec <slug>`.

### unikit-gd-explore
- **Purpose:** Read-only design research partner — dissect a reference game, scan a market, or
  (internal-design lens) work out how to improve a system or invent a new mechanic for *this* game.
  Never authors the GDD; it researches, then routes you onward.
- **When:** "is there a market for X", "break down the combat of <game>", "find a new mechanic",
  "how could we improve our economy".
- **In:** a topic / game reference / URL / design question; a `reviews/*_review-*.md` report
  (develop its research bucket); or a `RECON.md` (work a pre-GDD reconstruction). `init`
  rebuilds the researches index.
- **Out:** a research + brief in `.unikit/gamedesign/researches/<date>_<slug>/`, then a routed
  next command: no doc/not-started → `/unikit-gd-spec` add-system → `/unikit-gd-system`;
  skeleton/detailed/reviewed/revised → `/unikit-gd-system`. **Two file modes differ:** a review
  file is mutated **in place** (research → apply-ready) → one `/unikit-gd-apply reviews/X.md`
  (no `researches/`); a `RECON.md` keeps the research + gets a `## Explorations` backlink →
  `/unikit-gd-spec <RECON.md>` import.
- **Optional (research, cross-cutting).** Before: `/unikit-gd-spec`. After: spec / system.

### unikit-gd-spec
- **Purpose:** Create and own the master GDD (`GAME.md` — the authored one-pager **and** its
  generated `## System Map [gen]`) and the `GD-IDS.yaml` registry. Also **edits GAME.md content**
  (a pillar, the monetization stance…), imports an existing GDD, remaps, adds a single new system,
  or writes a pitch.
- **When:** "create the game design", "turn my concept into a GDD", "import this GDD", "add a
  crafting system to the GDD", "change a pillar", "rework the monetization stance".
- **In:** a concept slug, a description, a path/URL to an existing GDD, or a GAME.md edit. Mode is
  inferred (create / import / edit / remap / add-system / pitch); each mode body loads on demand
  from `references/mode-*.md`.
- **Out:** `.unikit/gamedesign/GAME.md` (incl. `## System Map [gen]`), `GD-IDS.yaml` (+ optional `PITCH.md`).
- **Genre seed (Create mode):** best-fits the concept's `genre:` hint to a bundled **genre profile**
  (`unikit-ai genres list` → `genres install <id>`, skill-driven), writes `genre_profile:` into GAME.md,
  and runs a seed interview (or a universal baseline when no profile fits). The profile is read-only —
  divergence lands in `GD-IDS.yaml`; `/unikit-gd-review` reads it for the genre-completeness lens.
- **Required for the design track (the GDD root).** Before: `/unikit-gd-brainstorm`. After:
  `/unikit-gd-system`.

### unikit-gd-system
- **Purpose:** Own one system's GDD (sections A-K: overview, fantasy, design, formulas, edge
  cases, dependencies, tuning, acceptance criteria, telemetry, accessibility, open questions) —
  **create** the skeleton, **fill** placeholders, **and revise** approved content (Tuning a
  number / Tweak a small rule / Rework a restructure, each a versioned delta + changelog).
- **How (Decision-First — the reference flow flows/content mirror):** pick a **depth**
  (`core/standard/full`, ephemeral, never stored), draft seeded sections silently, ask only
  the real design forks (1–2 batches), then review by tier-group behind one structural gate —
  ~4–6 gates, not one per section; sections addressed by name, not letters. A skipped section is
  marked `<!-- deferred -->`; once the **core-set** (Overview / Player Fantasy / Detailed Design /
  Formulas / Acceptance Criteria) is authored the doc is `detailed`, and a deferred non-core
  section renders **`detailed · partial (n/m)`** (inferred from the markers, never stored — not a
  `[To be designed]` leak).
- **When:** "detail the combat system", "write the GDD for inventory", "spec out the parameters",
  "raise the damage 10%", "rework the status system", "nerf X", "tune the economy".
- **In:** a system name or `SYS-slug` (+ optionally what to change). Mode (create/fill/edit) and
  edit scale are inferred. Off-map → it routes to spec add-system; a `GAME.md`/pillar change → spec.
- **Out:** `.unikit/gamedesign/systems/SYS-<slug>.md` + registers facts/IDs in `GD-IDS.yaml`; on a
  revise, version bump + changelog and status → `revised`.
- **Required per system.** Before: `/unikit-gd-spec`. After: `/unikit-gd-review`, `/unikit-gd-verify`.

### unikit-gd-flow
- **Purpose:** Own one flow's design document (`flows/FLOW-<slug>.md`) — the **dynamics** axis of
  the GDD (what the player *does* over time), alongside the system docs (the rules). Create the
  skeleton, fill it (objectives, pacing, dependencies, funnel events), **and revise** it as a
  versioned delta. Picks the wiring mode (linear | conditional | emergent) and re-renders the
  `## Flow Map [gen]` / `## Funnel [gen]` blocks in `GAME.md`. A flow registers itself — there is
  no add-flow in `/unikit-gd-spec`. Authored **Decision-First** (the same flow as
  `/unikit-gd-system`): a depth picker, the **Mode** decided in the decision round, deferred
  sections marked `<!-- deferred -->`; core-set = Overview / Objective Flow, so a deferred non-core
  section renders `detailed · partial (n/m)`.
- **When:** "design the first-session flow", "map the onboarding sequence", "write the FLOW for the
  boss encounter", "retune the pacing", "add a branch", "rework the onboarding".
- **In:** a flow name or `FLOW-slug` (+ optionally what to change). Mode and edit scale are inferred;
  a `GOAL` that needs a missing system, or a `GAME.md` win/lose edit, routes to `/unikit-gd-spec`.
- **Out:** `.unikit/gamedesign/flows/FLOW-<slug>.md` + its `flows:` / `events:` entries in
  `GD-IDS.yaml`; re-renders `## Flow Map [gen]` / `## Funnel [gen]`; on a revise, version bump +
  changelog and status → `revised`.
- **Required per flow (the dynamics axis).** Before: `/unikit-gd-spec` (+ `/unikit-gd-system` for the
  systems it exercises). After: `/unikit-gd-review`, `/unikit-gd-verify`.

### unikit-gd-content
- **Purpose:** Own one content type's design document (`content-types/CT-<slug>.md`) — the
  **content / catalog** axis of the GDD (the data the game is made of: cards, items, levels,
  enemies, quests). Create the skeleton, fill it (the typed `CT.fields` schema, scale,
  relationships, validation), **and revise the schema** as a versioned delta. Picks the scale
  (bulk | curated), self-registers `content_types:` / `content:` (+ `resources`/`tracks`/`knobs`
  facts) and re-renders the `## Content Map [gen]` block in `GAME.md`. A content type registers
  itself — there is no add-content in `/unikit-gd-spec`. Authored **Decision-First** (the same
  flow as `/unikit-gd-system`): a depth picker, the **Scale** decided in the decision round,
  deferred sections marked `<!-- deferred -->`; core-set = Overview / Schema / Scale, so a deferred
  non-core section renders `detailed · partial (n/m)`.
- **When:** "design the item content type", "define the card schema", "add a CT for enemies",
  "add a rarity field", "switch to curated". (Adding/removing units or a bulk count is catalog
  churn — data, not a schema edit.)
- **In:** a content type name or `CT-slug` (+ optionally what to change). Scale and edit scale are
  inferred; a missing `belongs_to` / `ref<SYS>` system routes to `/unikit-gd-spec` add-system.
- **Out:** `.unikit/gamedesign/content-types/CT-<slug>.md` + its `content_types:` / `content:`
  entries in `GD-IDS.yaml`; re-renders `## Content Map [gen]`; on a schema revise, version bump +
  changelog and status → `revised`.
- **Required per content type (the catalog axis).** Before: `/unikit-gd-spec` (+ `/unikit-gd-system`
  for the consuming system). After: `/unikit-gd-review`, `/unikit-gd-verify`.

### unikit-gd-apply
- **Purpose:** Dispatch an explicit, **multi-zone** GDD edit (spec + systems + content types +
  flows) in one ordered pass. Writes nothing itself — it resolves each delta to its
  `(target, zone)`, dispatches them **system-before-sinks** (`/unikit-gd-spec` →
  `/unikit-gd-system` → `/unikit-gd-content` → `/unikit-gd-flow`), and closes with one
  `/unikit-gd-verify`.
- **When:** "apply these GDD changes", "update the combat system and its loot and the boss flow",
  "raise the damage, add a rarity field and retune onboarding". A **single-zone** edit goes to
  the owner directly; an open question to research goes to `/unikit-gd-explore` first.
- **In:** the multi-zone changes to apply (no flags). Each delta routes to its zone owner; a new
  system a delta needs is created via `/unikit-gd-spec` add-system in the first tier.
- **Out:** nothing of its own — the owner skills do the writing (docs, `GD-IDS.yaml`, `[gen]`
  re-renders); then one `/unikit-gd-verify` pass.
- **Optional (multi-zone edits only).** Before: a decided set of edits. After: `/unikit-gd-verify`.

### unikit-gd-review
- **Purpose:** Qualitative design review ("is this design good/fun/balanced?") via adversarial
  lenses → severity-graded verdict + report. The design-side mirror of `/unikit-review`.
- **When:** "review the combat GDD", "is this design good", "critique this system", "review all GDDs".
- **In:** a system / path / `all` (scope inferred). Optional `+check`.
- **Out:** `.unikit/gamedesign/reviews/<date>_review-*.md`; on approval sets `doc_status: reviewed`.
- **Optional.** Before: `/unikit-gd-system`. After: `/unikit-gd-system` (fix findings).

### unikit-gd-verify
- **Purpose:** Mechanical consistency check ("is the design consistent with itself?") + changed-scope
  impact — broken references, ID validity, terminology drift, dependency/status/version coherence,
  acceptance-criteria presence. Deterministic, offline.
- **When:** "verify the design", "is the design consistent", "what did this change affect".
- **In:** a system / `SYS-slug` / question, or the unverified design diff. Conflicts can't be declined.
- **Out:** a conflicts/impact report (only when something is found); flags affected dependents `revised`.
- **Optional (recommended after every design edit).** Before: `/unikit-gd-system`. After:
  `/unikit-gd-system` (fix conflicts).

### unikit-gd-docs
- **Purpose:** Render the design workspace into a **human-readable GDD** — read-only Markdown
  chapters under `docs/design/` (the export end of the design track, the mirror of
  `unikit-gd-recon`'s code→design import). Facts are resolved inline from `GD-IDS.yaml`; drafts
  are flagged 🚧.
- **When:** "render the GDD", "export the game design to docs", "generate readable design docs",
  "publish the GDD".
- **In:** nothing, or `--web` (also emit an HTML site from the `unikit-docs` template; MD-only +
  `WARN` if that template is absent).
- **Out:** `docs/design/{index,systems,flows,content,economy,glossary}.md` (+ `.html` under
  `--web`). Read-only on the GDD — it never authors. `unikit-docs` owns `docs/*.md`; this owns
  `docs/design/**`.
- **Optional (the export-out of the design track).** Before: `/unikit-gd-verify`. After: share the
  rendered docs.

---

## Knowledge base, rules & registry

### unikit-rules
- **Purpose:** Quick-capture a short project convention/override into `.unikit/RULES.md` (the
  highest-priority rule file, auto-loaded by `/unikit-implement`).
- **When:** "always do X", "never use Y", "remember this", correcting the agent for next time.
- **In:** a rule typed as a prompt (no files/URLs).
- **Out:** appends to `.unikit/RULES.md`.
- **Optional.** After: `/unikit-memory migrate-rules` (promote a mature rule into the knowledge base).

### unikit-memory
- **Purpose:** Curate the indexed knowledge base under `.unikit/memory/<module>/<tier>/`. Adds rules
  from a description **or distils sources** (URL, file, folder, PDF, EPUB/FB2 book) into rules;
  migrates `RULES.md` entries; `optimise` extracts big sections into reference files. Module-aware
  (`--module code` | `--module gamedesign`).
- **When:** "add a stack rule for <framework>", "make rules from this book/article/docs",
  "migrate the rules", "optimise the knowledge base".
- **In:** a description / source(s) / `migrate-rules` / `optimise` / `validate`; `--skip-registry`.
- **Out:** rule + reference files under `.unikit/memory/`, and a regenerated `RULES_INDEX.md`.
- **Optional.** Pairs with `/unikit-rules` (capture) and `/unikit-rules-registry` (publish).

### unikit-rules-registry
- **Purpose:** Orchestrate the external rules registry lifecycle (so rules move between projects):
  `create` a local registry from your memory, `update` it (with semver bumps), or `sync` updates
  back into your project. Module-aware. Wraps the `unikit-ai rules ...` CLI.
- **When:** "make a registry for my rules", "publish my rules", "pull registry updates".
- **In:** `create | update | sync` (+ `--module`). create/update need a **local-folder** registry.
- **Out:** writes the registry file tree + manifest; reconciles project state via the CLI.
- **Optional.** Counterpart to the `unikit-ai rules` CLI.

### unikit-skills-context
- **Purpose:** Customize how a built-in skill behaves *in this project* by writing per-skill workflow
  overrides into `.unikit/skill-context/<skill>/SKILL.md` (never edit the base skill — updates wipe it).
- **When:** "make /unikit-fix always add logging", "customize the review skill", "validate stale overrides".
- **In:** `<skill-name> [rule text]` or `validate [skill-name]`.
- **Out:** `.unikit/skill-context/<skill>/SKILL.md`.
- **Optional.** Manual counterpart to `/unikit-evolve`'s workflow-rule output.

---

## Docs & utilities

### unikit-docs
- **Purpose:** Generate/maintain project documentation — a lean README + topic pages in `docs/`;
  optional HTML with `--web`.
- **When:** "generate docs", "update the README", "document the project".
- **In:** `--web` flag; reads the codebase + context.
- **Out:** `README.md`, `docs/*.md` (+ `docs-html/` with `--web`).
- **Optional.** Often delegated by `/unikit-implement` when the plan asks for docs.

### unikit-todo
- **Purpose:** A lightweight deferred-task list `.unikit/TODO.md` — park reminders without acting now.
- **When:** "remind me to...", "note for later", "todo list", "mark this done".
- **In:** a task / `complete <desc>` / `list` / `purge`.
- **Out:** `.unikit/TODO.md`.
- **Optional.** Implement/fix auto-close matching items.

### unikit-help
- **Purpose:** This navigator. Diagnoses what the user is trying to do and points to the right skill
  or pipeline. Read-only — it never does the work, it routes.
- **When:** "what do I do next", "where do I start", "which skill should I use", "I'm lost in unikit".
- **In:** a question, or nothing (then it asks one short diagnostic).
- **Out:** guidance (no file changes).
- **Optional (meta).** Routes to every skill above.
