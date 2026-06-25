---
name: unikit-gd-apply
description: >-
  Dispatch an explicit, user-dictated set of edits that spans TWO OR MORE zones of the
  GDD — the master spec, systems, content types, and flows — in one ordered pass. Writes
  nothing itself: it resolves each delta to its (target, zone), orders them so a system
  change lands before the content or flow that depends on it, delegates each to the owning
  skill (/unikit-gd-spec, /unikit-gd-system, /unikit-gd-content, /unikit-gd-flow), and closes
  with one /unikit-gd-verify pass. Use when you already know the changes and they touch more
  than one part of the design, e.g. "apply these GDD changes", "update the combat system
  and its loot and the boss flow", "raise the damage, add a rarity field and retune the
  first-session pacing", "make all these design edits at once". For a change to a SINGLE
  zone call its owner directly; to research an open question or a mechanic you do not yet know
  how to design, use /unikit-gd-explore first.
argument-hint: "\"<the multi-zone changes to apply>\"  (each delta routed to its zone owner; no flags)"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(date *)
  - AskUserQuestion
  - Skill
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: game-design
---

# Game Design — Multi-Zone Edit Dispatcher

Apply **a set of explicit, user-dictated edits that crosses more than one zone of the
GDD** — the master spec (`GAME.md` + roster), systems, content types, and flows — in a
single ordered pass. This skill is a **dispatcher, not an author**: it owns **nothing**
and writes **nothing**. For each delta it resolves the `(target, zone)`, orders the set
so the change graph stays causally fresh, hands each delta to the zone that owns it
(`unikit-gd-spec` / `unikit-gd-system` / `unikit-gd-content` / `unikit-gd-flow`), and
closes with **one** consistency pass (`unikit-gd-verify`). The actual writing — sections,
registry facts, version bumps, `[gen]` re-renders — happens **inside the owner skills**,
under their collaborative protocol and delta discipline; this skill never bypasses it.

**When NOT to use it.** A change confined to **one** zone goes **straight to that owner**
— there is nothing to dispatch (Phase 1, GATE 2). A change you **do not yet know how to
design** (an open question, a mechanic to research, a balance to work out) goes to
`unikit-gd-explore` **first** — this skill only carries out edits you have already decided
(Phase 1, GATE 1).

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md` and
apply it to all output (fall back to English if it is missing) — including the rule to
**translate concepts, not transliterate jargon**. `gd-principles` → "Language" adds the
game-design specifics: which IDs and stored field values stay English (the owner skills
re-apply it on every delegated write). Do not announce the language setting.

## Phase 0 — Bootstrap

Silently load — do not narrate. This skill loads **only routing context**, never domain
rules (it authors nothing, so there is no system/flow/content to balance):

1. **`.unikit/system/gamedesign/gd-principles.md`** (the core) — the **Zone Ownership
   model + routing** (which zone owns what, the one-way boundary, the single sanctioned
   `implemented` code→design write) and the facts-registry / ID conventions. Plus, from
   the same `gamedesign/` folder, the two shards this skill needs to **order** a
   dispatch: **`gd-authoring.md`** (the **delta discipline** — so it knows a schema /
   approved-content edit is a versioned delta the owner must record, and catalog churn is
   not) and **`gd-lifecycle.md`** (the **lifecycle & status spine + cross-axis
   staleness** — so it knows a system edit stales the content / flows that depend on it,
   which fixes the dispatch order). This skill **applies** these contracts to sequence the
   work; it does **not** restate or perform the authoring mechanics. If missing, warn
   (`unikit-ai update`) and fall back to the ordering summarized in this file.
2. **`.unikit/gamedesign/GD-IDS.yaml`** — the registry, read-only here: the `systems`,
   `flows`, `content_types`, and their `depends_on` / `belongs_to` edges, used to resolve
   each delta's `(target, zone)` and to detect a delta that needs a **not-yet-registered**
   system (the create-precondition). If it does not exist, **stop** — there is no design
   to edit; route to `/unikit-gd-spec` (or `/unikit-gd-brainstorm` first) and stop.
3. **Schema guard (clean break — no automatic migration).** `GD-IDS.yaml` MUST be
   `version: 2`. If it is still `version: 1`, **STOP** and report: the design workspace is
   on the pre-v2 layout (the standalone markdown system-index was dropped; the maps now
   render into `GAME.md`); there is no automatic migration — tell the user to upgrade via
   `/unikit-gd-spec` before re-running.

**One-way boundary:** never read `.unikit/code/`, project source, or build artifacts
(`gd-principles` → One-Way Boundary). This skill does not load `RULES_INDEX.md` domain
rules — it dispatches, it does not design.

## Dispatch mechanism — how this skill delegates (3 tiers)

Delegation mirrors `unikit-implement`'s `## Delegation agents` + `Fallback:` pattern, but
to **owner skills** (not subagents — a read-only `Agent` could not write the GDD). Each
delta is handed to its zone owner **inline, one at a time, in the Phase 2 order**, waiting
for each to return before starting the next — **never in parallel** (the order is the
correctness guarantee).

<!-- unikit:agents codex -->
## Dispatch — BLOCKING PRE-REQUISITE

When the pipeline reaches a DISPATCH step, the assistant MUST **automatically invoke** the
owning skill itself — the Tier 1 `Skill(...)` call if available, otherwise the Tier 2
slash-command fallback — in order, one zone at a time, waiting for each to return. Do
**NOT** print the list of `/unikit-gd-*` commands and ask the user to run them: rendering
the list instead of executing it is a known failure mode. The invocation must be a real
call, not text wrapped in backticks. The Tier 3 `Run:` print is reserved for the single
case where no inline invocation mechanism exists at all.
<!-- unikit:end -->

- **Tier 1 — primary (`Skill`).** `Skill(skill: "unikit-gd-<zone>", args: "<the delta>")`
  inline. The owner runs its full interactive cycle in the main session (so its
  collaborative protocol, approvals, and writes all hold) and returns control here; then
  dispatch the next delta. This is the path on Claude Code.
- **Tier 2 — Fallback (slash-command).** If the `Skill` tool is unavailable in the current
  environment, **invoke `/unikit-gd-<zone>` inline**, one zone at a time, in the Phase 2
  order, waiting for each to return. The slash form is rewritten per agent by the installer
  (Codex `$unikit-gd-*`, Qwen `/skills unikit-gd-*`); `Skill(...)` is **not** rewritten and
  non-Claude agents have no `Skill` tool, so without this tier the dispatch is dead on
  5 of 6 agents. This must be a **real call**, not a printed recommendation.
- **Tier 3 — degenerate (print).** Only when **no** inline invocation mechanism exists at
  all, print the ordered `Run: /unikit-gd-…` list for the user to execute by hand
  (`unikit/SKILL.md` invariant). This is the last resort, never the default.

## Pipeline — ROUTING → DISPATCH → VERIFY

### Phase 1 — ROUTING (resolve every delta → `(target, zone)`)

Split the request into individual deltas. For each, resolve the **target** (a `SYS-`/
`CT-`/`FLOW-` id or `GAME.md`) and the **zone** that owns it:

| The delta is… | Target | Zone owner |
|---------------|--------|------------|
| a `GAME.md` content edit (pillar, win/lose intent, monetization stance, loop stack) | `GAME.md` | `unikit-gd-spec` |
| a **new system** added to the map | the roster | `unikit-gd-spec` (add-system) |
| a system's rules / numbers / formulas / AC | `SYS-<slug>` | `unikit-gd-system` |
| a content type's schema (a field, a type, the scale, a `ref<>`, `belongs_to`) | `CT-<slug>` | `unikit-gd-content` |
| catalog churn (add/remove units, a `bulk` count) | `CT-<slug>` | `unikit-gd-content` |
| a flow's objectives / pacing / dependencies / events / wiring mode | `FLOW-<slug>` | `unikit-gd-flow` |

The dispatcher is **dumb on purpose**: it resolves `(target, zone)` and hands the raw
delta to the owner — it does **not** pre-classify Tuning vs Tweak vs Rework, schema vs
churn, or create vs revise. Each owner makes that call under its own contract (subtlety
② below).

**GATE 1 — explicit-edit only (else → `unikit-gd-explore`).** Every delta must be a
**concrete change the user has already decided**. A delta that is an open question, needs
research, or is "work out how to…" is **not** an apply job — route it to
`/unikit-gd-explore` (research first, then come back with the decided edit). If the
request mixes the two, dispatch the decided deltas and hand the open one to explore;
announce the split. This skill never researches.

**GATE 2 — multi-zone only (else → the single owner).** The resolved set must touch
**two or more zones** (or be a genuine multi-delta job). A request that resolves to a
**single zone** has nothing to dispatch — **bounce it to that owner directly** and stop:

- one system edit → `/unikit-gd-system <SYS>` · one schema edit → `/unikit-gd-content <CT>`
- one flow edit → `/unikit-gd-flow <FLOW>` · one `GAME.md` edit → `/unikit-gd-spec`
- a lone **catalog churn** → `/unikit-gd-content <CT>` (it is data, not even a versioned
  edit — there is nothing to order) · a lone **standalone create** → `/unikit-gd-spec`
  add-system (this skill does not write the roster — `unikit-gd-spec` does).

A single-zone bounce is a real invocation (Tiers 1–2), not a printed suggestion.

### Phase 2 — DISPATCH (ordered, one delta at a time)

Dispatch the resolved deltas in this **fixed order** — the carrying invariant is that
**every system dispatch lands BEFORE any content or flow dispatch** that could depend on
it, so the downstream owners read a fresh upstream and `unikit-gd-verify` never stale-flags
falsely (subtlety ① below):

```
1. GAME.md / roster   → /unikit-gd-spec      (content edits, and add-system for any new system a later delta needs)
2. systems            → /unikit-gd-system     (the single upstream source — always before content/flow)
3. content types      → /unikit-gd-content    (a sink of the system axis)
4. flows              → /unikit-gd-flow        (a sink of the system axis)
```

- **Create-precondition (write goes to the owner, not here).** A delta that needs a
  **new system** — a content type's `belongs_to` / `ref<SYS>`, a flow's `GOAL`, or an
  explicit "add system X and then change Y" — is dispatched as a `unikit-gd-spec`
  **add-system** in the **first (spec) tier**, *before* the dependent revise. That yields
  "create + dependent revise in one pass". The roster write is **gd-spec's**; this skill
  only sequences it. A standalone create with no other delta does not reach here — GATE 2
  bounced it.
- **Content ↔ flow order is staleness-neutral** (both are sinks of systems; neither
  stales the other) — it is fixed `content → flow` purely for **determinism** (subtlety
  ⑤). What matters is only that both follow every system dispatch.
- **One delta at a time.** Invoke the owner (Tier 1/2), let it run its full cycle
  (Context → Options → approval → write → delta tail → `[gen]` re-render), wait for it to
  return, then dispatch the next. Each owner records its own version bump / changelog and
  re-renders its own `[gen]` map — this skill touches none of that.
- **A delta the owner bounces** (e.g. a flow whose `GOAL` crosses into a missing system,
  surfaced mid-dispatch) re-enters Phase 1 as a new system delta slotted into the spec
  tier; re-order and continue.

### Phase 3 — VERIFY (one bare pass, last)

After **every** delta has been dispatched and its owner has returned, run **one**
consistency pass:

```
Skill(skill: "unikit-gd-verify")        ← bare, NO argument
```

Invoke `unikit-gd-verify` **with no argument** — it derives its own scope (an unverified
design diff → changed-scope impact across the just-touched systems, flows, and content
types; otherwise a full check). Do **not** construct a union list of the touched ids and
pass it (verify's argument is a single system / question, not a set) — the bare call is
exactly what surfaces the cross-axis impact of the whole batch in one pass. This is the
only place gd-apply uses Tier 2's `/unikit-gd-verify` fallback / Tier 3 print, on the same
rules as a dispatch.

## Content-axis subtleties

The content zone is the **fourth** authoring zone, **isomorphic to flow** and, like flow,
a **sink** of the system axis. These five points govern how this skill orders and routes
content deltas:

1. **Content is a sink, never a source.** The change graph is
   `GAME.md (vision) → systems (the single source) → { content, flows } (sinks)`.
   Cross-axis staleness is **one-way** — a system edit stales the content types and flows
   that depend on it (`SYS → CT`, `SYS → FLOW`); the reverse never holds. That is the whole
   reason systems dispatch **before** content and flows (Phase 2).
2. **Churn vs schema is the owner's call, not the dispatcher's.** This skill resolves
   `(target = CT, zone = unikit-gd-content)` and hands over the raw delta; **`unikit-gd-content`
   classifies** catalog churn (data — no version bump) vs a schema revise (a versioned code
   contract). A lone pure churn never reaches dispatch — GATE 2 bounces it straight to
   `/unikit-gd-content`.
3. **Churn does not clear a cross-axis stale-mark** — only a schema revise does. That is
   correct and **not this skill's concern**: the stale-marks are `unikit-gd-verify`'s, set
   and cleared in the final pass, never by the dispatcher.
4. **Content's create-precondition mirrors flow's.** A content delta whose `belongs_to` /
   `ref<SYS>` needs a **missing system** routes through `unikit-gd-spec` add-system in the
   first tier (create + dependent schema revise in one pass) — exactly like a flow `GOAL`
   that needs a missing system. gd-apply sequences it; gd-spec writes the roster.
5. **Content ↔ flow order is fixed for determinism.** Because neither stales the other, the
   `content → flow` order is a convention (reproducibility), not a correctness edge — only
   the system-before-sinks edge is load-bearing.

## Ownership Boundaries

- **Owns:** **nothing** — no document, no registry fact, no `[gen]` render, no status or
  version. This skill's only product is the **ordering and delegation** of a multi-zone
  edit batch plus the single closing verify. There is deliberately **no `Write`/`Edit`** in
  `allowed-tools`: gd-apply *cannot* write the GDD, only route to the owners that can.
- **Not this skill (every write):** `GAME.md` content + the system roster (add-system) →
  `unikit-gd-spec`; a system's A–K doc → `unikit-gd-system`; a content type's schema +
  catalog → `unikit-gd-content`; a flow's doc → `unikit-gd-flow`; consistency & cross-axis
  impact → `unikit-gd-verify`; quality verdicts → `unikit-gd-review`; research / open
  questions → `unikit-gd-explore`.
- **Never:** write or edit any GDD file or `GD-IDS.yaml` directly; classify a content delta
  as churn vs schema (the owner does); pre-decide an edit scale (Tuning/Tweak/Rework);
  dispatch content or a flow **before** the system it depends on; dispatch in parallel;
  pass a union of ids to `unikit-gd-verify` (use the bare call); print the `Run:` list when
  an inline invocation is possible; read the code workspace or project source.

## Quick Reference

```
/unikit-gd-apply "buff combat damage 10%, add a rarity field to loot, retune onboarding pacing"
                                                  → 3 deltas across 3 zones: dispatch SYS-combat (system) →
                                                    CT-loot schema (content) → FLOW-onboarding (flow) → verify
/unikit-gd-apply "add a crafting system and a recipe content type that belongs_to it"
                                                  → create-precondition: gd-spec add-system SYS-crafting (first) →
                                                    gd-content CT-recipe (belongs_to SYS-crafting) → verify
/unikit-gd-apply "raise the damage by 10%"        → single zone → bounce to /unikit-gd-system SYS-combat
/unikit-gd-apply "add three more sword cards"     → lone catalog churn → bounce to /unikit-gd-content CT-card
/unikit-gd-apply "work out a better economy"      → open question → route to /unikit-gd-explore first
```
