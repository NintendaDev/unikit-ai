# Output table formats — single source of truth

The exact table shapes Phases 2 and 3 of `unikit-gd-brainstorm` emit. SKILL.md and
`methods.md` point here so each table is defined **once** — edit a format here and both
the workflow and the method notes follow it. Every table below shows its columns (the
header row *is* the contract) plus a worked example, so the format is unambiguous. One
running brief threads all of them — *"solo dev, wants a calm-but-tense feeling, loves
deckbuilders, needs short sessions"* — so Phase 2 and Phase 3 read as one session.

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
