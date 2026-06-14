---
name: unikit-gd-brainstorm
description: >-
  Ideate a new game concept with the user — from a blank page or a one-line hint
  to a finished CONCEPT card. A structured divergence/convergence dialogue:
  creative discovery, How-Might-We framing, five concepts by five methods, Pugh
  scoring, loop stack, pillars, player motivation, and a pre-mortem with a
  find-the-fun test. Auto-resumes an in-progress concept from the index — no
  flags; writes incrementally so an interrupted session is never lost. Use when
  the user says "brainstorm a game", "I have no idea yet", "help me come up with a
  concept", "explore game ideas", or gives a rough hint to develop into a concept.
argument-hint: "[hint or theme]  (auto-resumes an in-progress concept; no flags)"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(ls *)
  - Bash(find *)
  - Bash(wc *)
  - Bash(date *)
  - Bash(mkdir *)
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
disable-model-invocation: false
user-invocable: true
metadata:
  author: unikit
  version: "1.0"
  category: game-design
---

# Game Design — Concept Brainstorming

Generate game ideas with the user and crystallize the chosen one into a
**CONCEPT card** at `.unikit/gamedesign/concepts/<date>_<slug>/CONCEPT.md`, with
the rejected ideas parked in `IDEAS.md`. This is the **ideation** front of the
design pipeline — it produces concepts; `unikit-gd-spec` turns a concept into
`GAME.md` and a system map.

This skill **generates new ideas**. Analyzing an existing game or market
(reference dissection, trade-off tables) is `unikit-gd-explore`. The distinguishing
test: *five concept cards → brainstorm; a comparison table → explore.*

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply it to all output and artifacts. Regardless of the configured language,
keep **English**: IDs, keywords, canonical terms, and `PIL-*`/MDA aesthetic names.
Do not announce the language setting.

## Bootstrap (MANDATORY)

Before responding, silently load — do not narrate:

1. **`.unikit/system/gd-principles.md`** — the working contract: the collaborative
   protocol (Question → Options → Decision → Draft → Approval, Explain → Capture),
   the "never guess" rule, anti-anchoring, the language rules. This skill
   **applies** it. If missing, warn (`unikit-ai update`) and continue with the
   protocol summarized above.
2. **`.unikit/memory/gamedesign/RULES_INDEX.md`** — load on demand by `Load When`
   the rules ideation leans on: **`frameworks`** (MDA, SDT/PENS, Flow),
   **`player-motivation`** (Quantic Foundry, Bartle), **`core-loops`**. Re-read at
   skill start; never rely on a prior conversation's cache.
3. **`{{skills_dir}}/{{self_name}}/references/methods.md`** — the method
   cheat-sheets (divergence/convergence techniques, HMW, pre-mortem, find-the-fun).
4. **`.unikit/DESCRIPTION.md`** (optional) — existing project constraints, if this
   is ideation inside an established project.
5. **`.unikit/RULES.md`** (if present) — project overrides, highest priority.

**Web research is allowed** here for market and reference scans (`gd-principles`).
You may optionally launch inline `Agent(subagent_type: Explore)` to gather
comparable titles / market signal in parallel; fall back to `WebSearch` directly
if the Agent tool is unavailable. These are read-only advisors — they never write.

## Phase 0 — Auto-Resume (no flags)

Read `.unikit/gamedesign/concepts/INDEX.md` (if it exists). Each row carries a
slug, title, keywords, **status** (`in-progress | complete | promoted | abandoned`),
and the last phase reached. Semantically match the user's hint against the rows:

- A live `in-progress` concept matches the hint →

  ```
  AskUserQuestion: Found "<title>" (in-progress, phase <N>). What now?
  Options:
  1. Continue "<title>" from phase <N> (recommended)
  2. Start a fresh concept
  3. List all concepts
  ```

- No match, or the user chooses fresh → start a new concept (new dated slug).

`promoted` and `abandoned` concepts are **never offered for resume**, but their
`IDEAS.md` is read so the session does not re-pitch a killed idea. Repeated
brainstorms always create new slug directories.

On resume, jump to the saved phase; on a fresh start, begin at Phase 1.

## Phases 1–9

Run the phases in order (full method detail in `references/methods.md`). Diverge
and converge as **separate** moves — never score an idea as you generate it.

### Phase 1 — Creative Discovery
Ask about the **person**, not the game: emotional anchors, three games they love
and what those left them wanting, plus constraints (solo/team, deadline, engine,
experience). Synthesize a **Creative Brief** (3–5 sentences) and confirm it.

### Phase 2 — How-Might-We Framing
Reframe the brief as **3–5 "How might we…"** questions (positively framed, no
baked-in solution). The user picks one to diverge on.

### Phase 3 — Divergence
Generate **five concepts using five different methods** (verb-first, genre mashup
with the intersection-audience caveat, experience-first/MDA-backward, world-first,
constraint-first). Capture each as the **nine-field card**:

| # | Field |
|---|-------|
| 1 | **Elevator pitch** — one sentence a stranger gets in 10 seconds |
| 2 | **Core fantasy** — "You are X doing Y, feeling Z" |
| 3 | **Unique hook** — passes the "and also" test (changes play, not just art) |
| 4 | **Primary aesthetics (MDA)** — top 2–3 of the 8 |
| 5 | **Core loop (30 s)** — the most-repeated moment-to-moment action |
| 6 | **Target player** — specific, with session length and the unmet need |
| 7 | **Comparables** — 2–3 titles, each with what we borrow and our twist |
| 8 | **Scope signal** — S/M/L + platform + player count |
| 9 | **Biggest risk / open question** — what most likely makes this not work |

Offer **"five more"** on request via a stimulus method (random input / SCAMPER /
Lotus Blossom) over the current favorite.

### Phase 4 — Convergence → **incremental write**
Score the surviving concepts with a **Pugh matrix** (hook / scope-fit / team-fit /
market-signal / personal-fire — the user weights; arithmetic shown transparently).
Use **How-Now-Wow** if "I like all of them". Select or hybridize. Rejected concepts
go to **`IDEAS.md`** (idea, essence, reason, revival condition). **Persist now** —
write the chosen card draft and `IDEAS.md`; an interruption after this loses
nothing.

### Phase 5 — Loop Stack
Define the nested loops (30 s / 5 min / session / meta). Audit **SDT**
(Autonomy / Competence / Relatedness — flag if only 1 of 3 is served). Confirm the
core verb has **≤100 ms** feel feedback (Swink).

### Phase 6 — Pillars & Anti-Pillars → **incremental write**
Derive **3–5 pillars**: active, each serving ≥1 emotion, each with a **design test**
and mutual tension; reject empty pillars and task-pillars. Add **≥3 anti-pillars**
("We will NOT <X> because PIL-n"). Run a Lock / Rename / Swap cycle. **Persist now.**

### Phase 7 — Player Motivation
**Quantic Foundry:** the user ranks the **top 3 of 12** motivations; the skill
checks them against the pillars and loops. Set MDA primary/secondary, a one-line
Bartle read, and an explicit **"who this is NOT for"**.

### Phase 8 — Pre-mortem & Scope → **incremental write**
Run **Klein's pre-mortem verbatim** ("six months from now the project failed —
that is a fact — why?"): 8–12 reasons across fun/scope/market/tech/team; the user
marks the real ones; mitigate only those. Then settle the platform, the **MVP cut**,
and the **find-the-fun test** (Cerny: the smallest prototype that proves or kills
the core). **Persist now.**

### Phase 9 — Record & Handoff
Present the **complete CONCEPT card** for **one approval** ("not yet" → edit
sections, do not split the approval). Set the card header
(`> Status: drafted · Version: 1 · Created: <date>`). Set the INDEX row status to
`complete`. Then recommend the follow-up (do not auto-invoke).

## Writing the Artifacts

```bash
mkdir -p .unikit/gamedesign/concepts/<date>_<slug>
```

- **`CONCEPT.md`** — the nine-field card with a `## Notes` section for the reasoning
  the table cannot hold (rejected alternatives, inspirations). Header:
  `> Status: <exploring|drafted|approved> · Version: 1 · Created: <date>`.
- **`IDEAS.md`** — the rejected-idea backlog: each entry is *idea · essence ·
  reason (scope / not-fun / off-theme / duplicate) · revival condition*.
- **`concepts/INDEX.md`** — prepend (newest first) a row:
  `slug · title · keywords · status · last phase`. Create with a
  `> Auto-maintained by /unikit-gd-brainstorm. Do not edit manually.` header if
  absent. Update the existing row's status/phase on resume.

## Final: Compact Report & Next Steps

```
Concept: <title>  (.unikit/gamedesign/concepts/<date>_<slug>/)
Status: <drafted|approved>  ·  reached phase 9
Pillars: PIL-1 … PIL-n   Anti: <n>   MDA: <primary>/<secondary>
Find-the-fun: <the prototype that proves the core>
Rejected → IDEAS.md: <n>
```

```
AskUserQuestion: Concept "<title>" is captured. What's next?

Options:
1. Build the master spec — /unikit-gd-spec <slug> (recommended)
2. Research a reference or the market — /unikit-gd-explore <topic>
3. Prototype-first — validate the find-the-fun before specing
4. Nothing — I'll continue later
```

No summary document, no report file.

## Ownership Boundaries

- **Owns:** `.unikit/gamedesign/concepts/` — `CONCEPT.md`, `IDEAS.md`, and the
  concepts `INDEX.md`.
- **Not this skill:** `GAME.md` + the system map → `unikit-gd-spec`; analyzing an
  existing game/market → `unikit-gd-explore`; per-system GDDs →
  `unikit-gd-detail`.
- **Never:** write a concept without approval; offer `promoted`/`abandoned`
  concepts for resume; read the code workspace or project source.

## Quick Reference

```
/unikit-gd-brainstorm                         → blank-page ideation (or resume from index)
/unikit-gd-brainstorm cozy farming roguelike  → seed divergence with a hint
/unikit-gd-brainstorm                         → auto-resumes a matching in-progress concept
```
