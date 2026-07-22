# Output table formats — single source of truth

The exact table shapes the phases of `unikit-gd-brainstorm` emit. SKILL.md and
`methods.md` point here so each table is defined **once** — edit a format here and both
the workflow and the method notes follow it. Every table below shows its columns (the
header row *is* the contract) plus a worked example, so the format is unambiguous. One
running brief threads them all — *"solo dev, wants a calm-but-tense feeling, loves
deckbuilders, needs short sessions"* — so the examples read as one continuous session.

Render as plain markdown only: no circled/enclosed glyphs (①②③, 🅰), which smudge in
terminals — bold and short cells carry the structure (see SKILL.md "Readable plain
markdown only").

## Phase 2 — How-Might-We table

Present the 3–5 reframings as a table so the framings compare side by side; each row
names which part of the brief it reattacks and what answers it opens. Mark the strongest
**(Recommended)** with a one-line WHY. The user picks one row to diverge on.

| # | How might we… | Reframes (which part of the brief) | Invites (kinds of answers) |
|---|---------------|------------------------------------|----------------------------|
| 1 | …make a calm activity carry real tension? | the core feeling | risk/pacing systems that threaten a peaceful state |
| 2 | …let a 15-minute session feel like real progress? | the session-length constraint | run structure, meta-progression |
| 3 **(Recommended)** | …turn deckbuilding into something you *tend* rather than *fight*? | the genre frame | gardening/crafting verbs in place of combat — *widest, still aimed* |
| 4 | …make losing feel like a story, not a punishment? | the failure loop | narrative-roguelike framing |

## Phase 3 — Concept card (nine fields)

Render **each** of the five concepts as its own `Field | Value` table — a card is read
top-to-bottom while deciding, so the table keeps the fields aligned instead of buried in
prose. The first three columns below are the **field contract**; the last is a worked
value from the running brief (verb-first method). When emitting a card the model writes
only the `Field | Value` pair — the "What it captures" column is guidance, not output.

**This same card also renders the Phase 3.5 cross-pollinate hybrid:** a proposed genre
mash-up is a *new candidate concept*, so it gets a full nine-field card here too (not a
prose pitch), which is what makes it directly comparable to the shortlist.

| # | Field | What it captures | Example value |
|---|-------|------------------|---------------|
| 1 | **Elevator pitch** | one sentence a stranger gets in 10 s | A deckbuilder where your cards are plants you grow, prune, and harvest between fights. |
| 2 | **Core fantasy** | "You are X doing Y, feeling Z" | You are a battle-gardener cultivating a living deck — calm mastery under a slow-rising threat. |
| 3 | **Unique hook** | passes the "and also" test (changes play, not just art) | Cards aren't drafted, they *grow*; tending the garden between runs **is** the deckbuilding. |
| 4 | **Primary aesthetics (MDA)** | top 2–3 of the 8 | Sensation · Expression · Challenge |
| 5 | **Core loop (30 s)** | the most-repeated moment-to-moment action | Play a plant-card → it matures or wilts → harvest its effect → soil shifts the next draw. |
| 6 | **Target player** | specific, with session length and the unmet need | Lapsed Slay-the-Spire players wanting 15-min sessions and less combat math; unmet need is *calm* progression. |
| 7 | **Comparables** | 2–3 titles, each with what we borrow and our twist | Slay the Spire (run structure; twist: growth, not draft) · Stardew (tending; twist: it feeds combat) |
| 8 | **Scope signal** | S/M/L + platform + player count + **content model** (procedural / hand-authored / hybrid — *how* the game makes the content it consumes, and how fast new content ships) | M · PC/Steam · single-player · **hybrid** (systemic growth engine + ~40 hand-authored plant cards) |
| 9 | **Biggest risk / open question** | what most likely makes this not work | Does "tending" stay tense, or does removing draft pressure make it boring? |

## Phase 3 — Five-concept comparison

After the five cards, present one comparison table across all of them — the shortlist
decision is a side-by-side judgment ("which two hooks are strongest?") that five separate
cards cannot support at a glance. Keep every cell to a short phrase; the full reasoning
already lives in each card. The method is noted so the field reads as genuinely varied,
not five repaints of one idea.

| # | Concept | Hook | Core loop | Scope | Biggest risk |
|---|---------|------|-----------|-------|--------------|
| 1 (verb-first) | Gardener's Gambit | you *tend* a living deck | plant → mature → harvest | M · hybrid | tending may lack tension |
| 2 (genre mashup) | Spire & Soil | deckbuilder × farm-sim | run by day, garden by night | M · hybrid | two audiences, one game (caveat) |
| 3 (experience-first) | Quiet Harvest | aesthetic-led: calm mastery | slow-burn resource tending | S · systemic | "calm" may read as "boring" |
| 4 (world-first) | The Last Greenhouse | post-collapse seed vault | scavenge → cultivate → defend | L · hybrid | scope balloons past a solo dev |
| 5 (constraint-first) | One-Bed Garden | one tile, one action per turn | optimize a single plot | S · systemic | one tile may exhaust fast |

## Phase 4 — Two-pass Pugh matrix

A decision matrix *is* a table: concepts as rows, criteria as columns. Keep the two
passes in **separate** tables so locked creative judgment and market evidence stay
visibly apart — optimism cannot out-vote data when they never share a column. Score each
criterion (here 0–3, higher = stronger fit) and sum.

**Pass 1 — creative** (lock *before* the Phase 3.5 scan):

| Concept | Hook | Scope-fit | Team-fit | Fire | Content-velocity | Σ Pass 1 |
|---------|:----:|:---------:|:--------:|:----:|:----------------:|:--------:|
| **Gardener's Gambit** | 3 | 2 | 2 | 3 | 2 | **12** |
| Spire & Soil | 2 | 1 | 1 | 2 | 2 | 8 |
| Quiet Harvest | 2 | 3 | 2 | 1 | 3 | 11 |

**Pass 2 — evidence** (only if Phase 3.5 ran; the **hard rule** caps the market score at
what validation-confidence allows):

| Concept | Market-signal (raw) | Validation-confidence | Market score (capped) |
|---------|---------------------|------------------------|:---------------------:|
| **Gardener's Gambit** | white-space (3) | B / medium → cap 2 | **2** |
| Spire & Soil | contested (2) | C / low → cap 1 | 1 |
| Quiet Harvest | unknown (—) | D / none → cap 0 | 0 |

Combine = Σ Pass 1 + capped market score. A tie Pass 2 cannot break on *confident*
evidence goes to the Phase 8.5 validation plan, not to taste. If Phase 3.5 was skipped,
`market-signal` is simply one more Pass-1 column.

> **Caps before scoring:** `monetization_fit: mismatch` → market score ≤ 1;
> `trend_fit: overheated` → market score ≤ "contested" (route the concept to pivot).
> These apply on top of the validation-confidence cap — the **lowest ceiling wins**
> (min-of-caps).

## Phase 5 — Loop stack, SDT audit, game feel

Three small tables, so a gap is visible at a glance instead of lost in prose: the nested
+ discoverability loops, the Self-Determination audit, and the game-feel check on the
core verb.

**Loop stack** — the nested play loops plus the discoverability loops (the same loops
read from the acquisition/retention angle):

| Loop | Cadence | What repeats (the pull) |
|------|---------|-------------------------|
| **Core** | 30 s | play a plant-card → it matures/wilts → harvest → soil shifts |
| **Short** | ~5 min | clear a plant-boss with a tuned bed |
| **Session** | one sitting | finish a run, bank a meta-unlock |
| **Meta** | across sessions | grow the seed-vault, unlock new soil rules |
| **First-session** | first ~10 min | does "tending = fighting" click before the bounce? |
| **Trailer moment** | 6 s | a card visibly *blooms* into a board-clearing effect |
| **Retention hook** | "one more run" | a new seed teased at run's end |

**SDT audit** — name what serves each need; **flag if only 1 of 3 is served** (a single
strong axis is a thin motivational base):

| SDT need | Served by (loop / mechanic) | Verdict |
|----------|-----------------------------|---------|
| **Autonomy** | which plants to grow, when to harvest vs hold | served |
| **Competence** | mastering the tend↔fight rhythm under threat | served |
| **Relatedness** | none yet — solo, no sharing | **gap — flag** |

**Game feel (core verb, Swink)** — the core verb must answer instantly and on more than
one channel, or it reads flat:

| Aspect | The read | Verdict |
|--------|----------|---------|
| **Latency** | bloom/harvest fires ~80 ms after the play | within ≤100 ms |
| **Channels** | visual bloom + audio chime + card settle | multi-channel |
| **Overall** | reads "juicy", not a spreadsheet click | pass |

## Phase 6 — Pillars & anti-pillars

Two tables. A pillar earns its place only if every column fills: an empty **Evidence**
cell is a slogan, an empty **Cut rule** means it was never scope-tested — the grid makes
that visible where prose hides it.

**Pillars** (3–5, each active, each serving ≥1 emotion, with mutual tension):

| ID | Pillar | Emotion | Design test | Evidence | Cut rule |
|----|--------|---------|-------------|----------|----------|
| PIL-1 | Tending *is* mastery | Competence | "Does this reward skilled cultivation, not luck?" | StS reviews praise build depth | cut cosmetic plant variants first |
| PIL-2 | Calm under threat | Sensation | "Does the threat stay legible, never frantic?" | players want "StS without the math stress" | cut any timed pressure first |
| PIL-3 | Every card has a life | Expression | "Can the player tell a story about one card?" | Stardew-style attachment to crops | cut filler cards first |

**Anti-pillars** (≥3, each tied to a pillar or a review-mining "hate"):

| We will NOT… | Because |
|--------------|---------|
| add twitch / real-time combat | PIL-2 (calm) |
| gate plant growth behind paywalls | PIL-1 (mastery, not wallet) |
| ship 200 hand-drawn unique cards | content-velocity / solo scope |

## Phase 7 — Player + buyer

One table that pins the player psychologically *and* commercially, then names who it is
NOT for — the split matters because the person who plays and the person who
pays/wishlists are often not moved by the same thing.

| Lens | Read |
|------|------|
| **Plays for (Quantic Foundry top-3)** | Mastery · Discovery · Completion |
| **MDA primary / secondary** | Challenge / Discovery |
| **Bartle** | Achiever-leaning Explorer |
| **Buys / wishlists because** | "a calm Slay-the-Spire with real build depth" |
| **Quits / refunds because** | early hours feel grindy, breaking the calm promise |
| **Anti-persona (NOT for)** | twitch & PvP players who want fast, reflex combat |

## Phase 8 — Pre-mortem

The reasons-it-failed list, marked for which are real (the user marks them), with a
mitigation written **only** for the real ones. The table keeps the verdict and the
mitigation on the same row, so an unmitigated real risk is obvious.

| # | Reason it failed | Category | Real? | Mitigation (real only) |
|---|------------------|----------|:-----:|------------------------|
| 1 | tending removed all tension → it's boring | fun | yes | add a visible per-turn threat clock |
| 2 | ran out of hand-made cards by month 3 | content | yes | systemize 70% of cards, hand-author 30% |
| 3 | target store already clone-dense | market | no | — |
| 4 | scope crept past a solo dev | scope | yes | cut to one biome for the MVP |
| 5 | mobile save/sync bugs | tech | no | — |

Categories: fun / scope / market / tech / team / content. Mitigate **only** the rows
marked real — a "no" row needs no work.

## Phase 8.5 — Validation plan & kill criteria

Two tables: the cheapest test that retires each real risk, and the kill criteria with
numbers. (The *catalogue* of test types lives in `methods.md` § Phase 8.5; this is the
concept's actual plan.)

**Validation plan** — one test per real Critical risk, each with a pass threshold and a
deadline:

| Test | Risk it retires | Pass threshold | Deadline |
|------|-----------------|----------------|----------|
| Fake-door Steam page | "will anyone want this?" | ≥ genre-median wishlists in 2 weeks | before prototype |
| Prototype (find-the-fun) | "is tending tense *and* fun?" | testers replay the 30-s loop unprompted | week 4 |
| Discord poll | "which threat model do players want?" | clear majority for one direction | week 2 |

**Kill criteria** (2–4, with numbers — reuse the Phase 3.5 brief's benchmarks):

| Metric | Kill threshold | What it means |
|--------|----------------|---------------|
| Wishlists (1 month) | below genre median | hook doesn't read → reframe before spec |
| Prototype replay rate | < 30% replay the core loop | tending isn't fun → kill or pivot |
