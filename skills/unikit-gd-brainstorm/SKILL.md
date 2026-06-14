---
name: unikit-gd-brainstorm
description: >-
  Ideate a new game concept with the user — from a blank page or a one-line hint
  to a finished CONCEPT card. A structured divergence/convergence dialogue:
  creative discovery, How-Might-We framing, five concepts by five methods,
  delegated market validation (a market scan via /unikit-gd-explore), two-pass
  evidence-based Pugh scoring, loop stack, pillars, player + buyer motivation, and a
  pre-mortem with a find-the-fun test. Auto-resumes an in-progress concept from the index — no
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
and apply it to all output and artifacts (fall back to English if it is missing) —
including the rule to **translate concepts, not transliterate jargon**.
`gd-principles` → "Language" adds the game-design specifics: which IDs and stored
field values (e.g. `market_signal: red-ocean`) stay English. Do not announce the
language setting.

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

**Market validation is delegated, not ad-hoc.** This skill does **not** research the
market inline or early — early data anchors timid ideas (anti-anchoring,
`gd-principles`). Market evidence enters at **Phase 3.5**, where brainstorm spawns
`unikit-gd-explore` as a subagent to scan the shortlist and **return a brief into
this session** (see Phase 3.5 and `gd-principles` → "Cross-Skill Delegation"). General
`WebSearch` / `WebFetch` lookups remain available as read-only advisors — they never
write and never substitute for the Phase 3.5 scan.

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

On resume, jump to the saved phase — including the **fractional phases 3.5 and 8.5**
(a session interrupted mid-scan or mid-validation resumes there, not back at 3 or 8);
on a fresh start, begin at Phase 1.

## Phases 1–9

Run the phases in order (full method detail in `references/methods.md`). Diverge
and converge as **separate** moves — never score an idea as you generate it.

### Phase 1 — Creative Discovery (+ commercial frame)
Ask about the **person**, not the game: emotional anchors, three games they love
and what those left them wanting, plus constraints (solo/team, deadline, engine,
experience). Synthesize a **Creative Brief** (3–5 sentences) and confirm it.

Then capture a **commercial frame** (one screen, kept separate from the person
questions): target outcome tier (hobby / recoup / commercial), platform hypothesis
to test (Steam-first / mobile / cross), and kill-readiness (drop on bad data, or
passion-project regardless?). The frame **scopes Phase 3.5; it does not censor
divergence.** A user with no commercial intent leaves it **empty** — that is valid
and **skips Phase 3.5** (`market-signal` then stays an ordinary Pugh judgment, not a
delegated scan).

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

### Phase 3.5 — Market validation (delegated to explore) — **gated**
**Gate:** run this phase **only if Phase 1 produced a non-empty commercial frame.**
Empty frame → **skip**; `market-signal` stays an ordinary Phase 4 judgment, no
subagent.

Run **after** divergence, on the user's **shortlist (2–4 concepts)** — never earlier
(early data anchors timid ideas; `gd-principles`). brainstorm does **not** research
the market itself — it **delegates** to `unikit-gd-explore` and consumes the
evidence (`gd-principles` → "Cross-Skill Delegation").

**Delegate** — spawn explore as a subagent and **wait for the return**:

> `Agent(subagent_type: general-purpose, skills: ["unikit-gd-explore"],`
> `  prompt: "/unikit-gd-explore <commercial frame + shortlist>. Return the brief`
> `  into this session as text; do not save any files.")`

The prompt MUST carry the **canonical marker** verbatim, on one line:

> *"Return the brief into this session as text; do not save any files."*

so explore runs its market lens deterministically and persists nothing (the
contract). The subagent returns, per concept, `market_signal` +
`validation_confidence` + a short evidence brief **into this session**.

**Consume — the calling session owns persistence:**
- Lift `market_signal` and `validation_confidence` into the **CONCEPT card** header
  machine-block, **outside the nine-field table** (the card stays "nine fields, no
  more").
- Distil the market argument (comparables, the unmet need, the reach risk) into the
  card's **`## Notes`** — not just the two fields.
- **Write no `researches/` file** — that directory is explore's; a delegated scan is
  evidence for *this* concept, carried in the card.

**Decision gate:** a concept whose `market_signal` is **red-ocean with no
white-space** is a **KILL candidate** — surface it explicitly **before** Phase 4
scoring; never silently carry it forward. The gate informs; the user decides.

### Phase 4 — Convergence (two-pass Pugh) → **incremental write**
Score the surviving concepts with a **two-pass Pugh matrix** (full method in
`references/methods.md`):
- **Pass 1 — creative** (lock *before* the scan): hook / scope-fit / team-fit /
  personal-fire.
- **Pass 2 — evidence** (from the Phase 3.5 brief, only if it ran): market-signal +
  validation-confidence.

**Hard rule:** the **market-signal** score may **not exceed what
validation-confidence allows** — an unproven market read cannot win on optimism.
Show Pass 1 and Pass 2 side by side; the user weights; arithmetic transparent. If
Phase 3.5 was skipped, `market-signal` is scored as an ordinary Pass-1 judgment. Use
**How-Now-Wow** if "I like all of them". Do **not** approve a hybrid whose winning
bet rests on a low-confidence market assumption — route it to Phase 8.5 instead.
Select or hybridize. Rejected concepts go to **`IDEAS.md`** (idea, essence, reason,
revival condition). **Persist now** — write the chosen card draft and `IDEAS.md`; an
interruption after this loses nothing.

### Phase 5 — Loop Stack
Define the nested loops (30 s / 5 min / session / meta) plus the **discoverability
loops** (first-session → retention, the 6-second trailer moment, the "one more run"
retention hook — full detail in `references/methods.md`). Audit **SDT** (Autonomy /
Competence / Relatedness — flag if only 1 of 3 is served). Confirm the core verb has
**≤100 ms** feel feedback (Swink).

### Phase 6 — Pillars & Anti-Pillars → **incremental write**
Derive **3–5 pillars**: active, each serving ≥1 emotion, each with a **design test**
and mutual tension; reject empty pillars and task-pillars. For each pillar add
**Evidence** (the data / comparable that justifies it — ideally the Phase 3.5 brief's
review-mining) and a **Cut rule** (what is cut first under scope pressure); a pillar
with no evidence is a slogan — flag it. Add **≥3 anti-pillars** ("We will NOT <X>
because PIL-n"); the brief's review-mining (love / hate / wish) feeds these. Run a
Lock / Rename / Swap cycle. **Persist now.**

### Phase 7 — Player Motivation (player + buyer)
**Quantic Foundry:** the user ranks the **top 3 of 12** motivations; the skill
checks them against the pillars and loops. Set MDA primary/secondary and a one-line
Bartle read. Then separate **player from buyer**: the **buying trigger** and the
**quitting / refund trigger** (from the Phase 3.5 brief when it ran), plus an
explicit **anti-persona** — "who this is NOT for".

### Phase 8 — Pre-mortem & Scope → **incremental write**
Run **Klein's pre-mortem verbatim** ("six months from now the project failed —
that is a fact — why?"): 8–12 reasons across fun/scope/market/tech/team; the user
marks the real ones; mitigate only those. Then settle the platform, the **MVP cut**,
and the **find-the-fun test** (Cerny: the smallest prototype that proves or kills
the core). **Persist now.**

### Phase 8.5 — Validation Plan & Kill Criteria
For each **Critical** risk the pre-mortem marked real, design the **cheapest test
that proves or kills it** before building the full game (prototype / fake-door Steam
page / Discord poll / capsule A/B). Each test names a **pass threshold + deadline +
the risk it retires**. State **2–4 explicit kill criteria with numbers** (reuse the
Phase 3.5 brief's benchmarks, e.g. genre wishlist medians). This is where a
low-confidence market bet from Phase 4 gets a cheap real-world check instead of a
taste call. Record the tests and kill criteria in the card's **`## Notes`** — **no
separate file** (brainstorm owns one card, not a research bundle).

### Phase 9 — Record & Handoff
Present the **complete CONCEPT card** for **one approval** ("not yet" → edit
sections, do not split the approval). When Phase 3.5 ran, the card must carry the
**market evidence** so it is traceable: the `market_signal` / `validation_confidence`
machine fields in the header block **and** the distilled argument in `## Notes` (no
`researches/` file was written — the card *is* the citation). Set the card header
(`> Status: drafted · Version: 1 · Created: <date>`). Set the INDEX row status to
`complete`. Then recommend the follow-up (do not auto-invoke).

## Writing the Artifacts

```bash
mkdir -p .unikit/gamedesign/concepts/<date>_<slug>
```

- **`CONCEPT.md`** — the nine-field card with a `## Notes` section for the reasoning
  the table cannot hold (rejected alternatives, inspirations, the Phase 3.5 market
  argument, the Phase 8.5 validation tests). When Phase 3.5 ran, the header carries a
  **machine block** with `market_signal` and `validation_confidence` **outside** the
  nine-field table (the table stays "nine fields, no more"). These underscore fields
  are *evidence* — distinct from the hyphenated `market-signal` Pugh *criterion*.
  Header: `> Status: <exploring|drafted|approved> · Version: 1 · Created: <date>`.
- **`IDEAS.md`** — the rejected-idea backlog: each entry is *idea · essence ·
  reason (scope / not-fun / off-theme / duplicate) · revival condition*.
- **`concepts/INDEX.md`** — prepend (newest first) a row:
  `slug · title · keywords · status · last phase · market_signal` (the last column
  blank when Phase 3.5 was skipped). Create with a
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
