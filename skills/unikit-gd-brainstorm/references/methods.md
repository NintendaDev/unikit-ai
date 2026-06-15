# Brainstorming Methods — Protocol Cheat-Sheets

The method theory for `unikit-gd-brainstorm`. The SKILL.md walks the phases; this
file holds the *how* of each technique so the skill body stays a workflow. Process
discipline (collaborative protocol, anti-anchoring, severity, language) lives in
`gd-principles` — this file is method, not process.

## Governing principles

- **Diverge and converge separately** (Double Diamond; IDEO "defer judgment").
  Never score an idea in the same breath you generate it — quantity first, judgment
  later. Mixing the two kills the timid ideas that become the good ones.
- **Dialogue with an LLM is brainwriting, not group brainstorming.** There is no
  *production blocking* (Diehl & Stroebe 1987): generate in batches, build on the
  user's fragments with "yes, and…", and never wait your turn. Push *count*.
- **Constraints are fuel, not walls** (Acar et al. 2019, inverted-U): some
  constraint sharpens creativity; too much or none flattens it. Pull the user's
  real constraints (solo/team, deadline, engine, experience) early and use them.
- **Recommend without capturing control:** present options, mark one
  **(Recommended)** with the WHY, and defer the choice to the user. State your own
  preference only *after* they choose (anti-anchoring — see `gd-principles`).
- **Idea-box over timebox:** "here is a batch of N — say *more* for another batch."
  The user controls depth.

## Phase 1 — Platform choice & the cross-market rule

The platform is a first-class commercial decision, asked **explicitly** — never
defaulted to Steam. Each platform is a *different market* with its own demand signals,
sources, clone-density, and economics:

| Platform | Demand signal | Economics | Clone / content note |
|----------|---------------|-----------|----------------------|
| **PC / Steam** | wishlists, tag volume, sales bands | premium / early access | long tail; discoverability is wishlist-driven |
| **Mobile** | store charts, retention, UA cost | F2P / ads / IAP | clone-dense — a proven genre is copied fast |
| **Web / instant** | portal plays, embed reach | ad / portal rev-share | instant play; hits get cloned across portals |

**The cross-market rule (the mobile/web shortcut).** Steam is the clearest *demand*
signal even for a game you will not ship there, so for a mobile or web target the Phase
3.5 scan validates across markets: **(1)** is the genre **proven on Steam**? **(2)** if
so, is the **target store already full of clones**? Genre proven on Steam **with no
strong clone on the target store** is the sweet spot — demand proven elsewhere, an open
lane on your platform — an excellent bet for fast mobile/web development. Proven on
Steam **but** the target store is clone-saturated → that lane is a red ocean no matter
how well the genre does on PC. Brainstorm only *states* this question; the scan engine
that runs it lives in `unikit-gd-explore/references/market-scan.md` (T7).

## Phase 2 — How-Might-We framing (Basadur / NN/g)

Reframe the creative brief as 3–5 **"How might we…"** questions. Each must be:
positively framed, broad enough to admit many solutions, narrow enough to guide,
and **free of a baked-in solution** ("How might we make the player feel powerful?"
not "How might we add a combo system?"). The user picks one to diverge on.

The questions are emitted as a table; its columns and a worked example are the single
source of truth in `references/tables.md` § Phase 2 — not duplicated here.

## Phase 3 — Divergence methods (generate 5, five different ways)

Run **one distinct method per concept** so the five do not collapse into variants
of one idea. Each concept is captured as the nine-field card (see the CONCEPT
template). Lead methods:

| Method | Prompt | Source |
|--------|--------|--------|
| **Verb-first** | Start from the core *verb* the player performs ("you *graft*", "you *negotiate*"), then build a world around it. | Anthropy & Clark |
| **Genre mashup** | Cross two genres ("X meets Y") — **but** warn about the intersection-audience trap: the mashup must please both audiences, not just exist (Zukowski). | Zukowski |
| **Experience-first / MDA-backward** | Pick the target *aesthetic* (Fellowship, Discovery…) first, then derive dynamics and mechanics that produce it (MDA read right-to-left). | Hunicke/LeBlanc/Zubek |
| **World-first** | Start from a setting/premise with inherent tension, then find the verb it demands. | — |
| **Constraint-first** | Adopt a hard constraint as the generator ("one button", "no text", "60-second sessions") in the GGJ diversifier spirit. | GGJ / Acar |

**"Give me five more":** apply a stimulus method to the current favorite —
**random input / random stimulus** (de Bono: force a random word/image into the
concept), **SCAMPER** (Substitute, Combine, Adapt, Modify, Put to other use,
Eliminate, Reverse — Eberle), or **Lotus Blossom** (expand each petal of the
center idea into its own center).

The nine-field concept card and the five-concept comparison are emitted as tables; their
columns and worked examples are the single source of truth in `references/tables.md`
§ Phase 3 — not duplicated here.

## Phase 4 — Convergence methods

The two-pass matrix is emitted as two tables; their columns and a worked matrix are the
single source of truth in `references/tables.md` § Phase 4 — not duplicated here.

- **Two-pass Pugh / decision-matrix scoring.** Single-pass scoring lets an
  evidence-free *market-signal* guess ride at the same weight as a locked creative
  judgment — so split the matrix into two passes:
  - **Pass 1 — creative (lock it *before* the Phase 3.5 scan):** *hook*,
    *scope-fit*, *team-fit*, *personal-fire*. These are judgments the author owns;
    locking them first stops the market data from anchoring them.
  - **Pass 2 — evidence (from the explore brief):** *market-signal* and
    *validation-confidence*. Scored only after the scan returns.
  - **Hard rule — market ≤ validation confidence:** the *market-signal* score may
    **not exceed what *validation-confidence* allows.** A "huge market" read backed
    by one C-grade proxy is capped at the confidence of that proxy — optimism cannot
    out-vote evidence. Show Pass 1 and Pass 2 side by side; the score *informs*, it
    does not decide. A tie Pass 2 cannot break on confident evidence goes to the
    Phase 8.5 validation plan, not to taste. If Phase 3.5 was skipped (no commercial
    frame), *market-signal* is simply another Pass-1 judgment.
  - **Modifiers on the market score (caps/flags, not new vote-columns).** Keep Pass-2
    to its two scored criteria (`market-signal`, `validation-confidence`) so the
    matrix stays readable; fields from the brief act as **caps and flags on the market
    score**, never extra columns:
    - `monetization_fit: mismatch` → cap the market score at **1** regardless of
      signal (a market you cannot monetize on the target platform is not reachable
      demand for *you*). The cap stacks with the validation-confidence cap — the
      **lower of the two wins** (min-of-caps).
  - **Verdict mapping.** The brief's `recommendation` (proceed / proceed-with-
    differentiation / validate-later / pivot / kill) bridges Pass-2 to action:
    `validate-later` concepts are scored but their open risk is carried to Phase 8.5;
    `pivot` concepts are re-entered as hybrid cards before scoring.

  **Terminology — keep the boundary explicit.** `market-signal` (hyphen) is the
  **human Pugh criterion** scored here. `market_signal` (underscore) is the
  **machine field** the explore brief returns and the CONCEPT card stores. The
  criterion is the judgment; the field is the evidence the judgment may lean on —
  never conflate the two.
- **How-Now-Wow** (when "I like all of them"): plot ideas on
  *novelty × feasibility* — **Now** (easy, normal), **How** (hard, normal),
  **Wow** (easy, novel ← target), park **hard+normal**. Cuts an over-full field
  fast.
- **Idea backlog:** every rejected concept goes to `IDEAS.md` with *idea, essence,
  reason* (scope / not-fun / off-theme / duplicate) and a **revival condition** —
  so a killed idea is not re-pitched, and a good idea parked for scope can return.
- **Cross-pollinate, don't just cut (post-scan).** When the Phase 3.5 brief shows one
  shortlisted concept in a **red ocean** and another in **white-space / contested**,
  the crowded concept is raw material, not just a kill: offer a **genre mash-up** that
  grafts the under-competed angle onto the stronger concept (genre-mashup method, with
  the intersection-audience caveat — the hybrid must please *both* audiences). A
  saturated genre often hides a strong twist once crossed with a fresher one. Render the
  hybrid as a full nine-field card (`references/tables.md` § Phase 3) so it is comparable
  to the shortlist, then route it back through Pugh / the Phase 8.5 validation plan;
  recommend it on the evidence, never impose it.

## Content velocity — the hidden scope axis

Two games with the same headline scope can have wildly different *true* costs, because
the cost lives in the **content the design consumes**, not the systems. This is the
"how hard is it to make and keep making content" axis — scored in the Phase 3 card
(field 8), in Phase 4 Pass-1, and surfaced in the Phase 8 pre-mortem.

- **High velocity — content scales itself.** Procedural generation, systemic/emergent
  content, simulation, PvP, or user-generated content: a handful of systems produce
  effectively unbounded play. The author writes *rules*, and the rules make the content
  (roguelikes, sandbox sims, deckbuilders, competitive games).
- **Low velocity — content is hand-made.** Bespoke levels, scripted story, hand-drawn
  art, voiced dialogue: every hour of play costs author-hours, and players burn it
  *faster than you can make it* (narrative adventures, linear puzzle/platformers,
  hand-authored campaigns).
- **Hybrid** — a systemic core (high velocity) seeded with hand-made set-pieces (low
  velocity): the common, often best answer; always name *which* parts are which.

Why it belongs in the analysis: a low-velocity content model quietly caps a game's
length, replayability, and live-ops runway, and is one of the most common reasons a
promising scope is secretly impossible for a small team. Ask it early (it shapes the
concept), score it in Pugh (a real feasibility axis, not a footnote), and treat "we
ran out of content / it became too slow to make more" as a first-class pre-mortem
failure mode.

## Phase 5 — Loop stack & discoverability loops

Beyond the play loops (30 s / 5 min / session / meta), a commercial concept lives or
dies on **discoverability loops** — the ones that decide whether anyone *starts*:

- **First-session loop** — the first ~10 minutes that decide retention: does the core
  fun land before the player bounces?
- **Trailer moment** — the **6-second hook** the game can show in a trailer / GIF /
  capsule that makes a stranger stop scrolling. A concept with no trailer moment is a
  marketing risk, not just a design note.
- **Retention hook** — the "one more run / one more day" pull that brings the player
  back (the meta-loop read from the *retention* angle).

These are not separate loops — they are the play loops read from the *acquisition /
retention* angle. A concept strong on the 30-second loop but with no trailer moment
is a discoverability risk worth flagging into Phase 8.

The loop stack, the SDT audit, and the game-feel check are emitted as tables; their
columns and worked examples are the single source of truth in `references/tables.md`
§ Phase 5 — not duplicated here.

## Phase 8 — Pre-mortem (Klein, HBR 2007)

Run the protocol **verbatim** — the framing is what makes it work:

> "Crystal ball: it is six months from now and the project **failed. That is a
> fact.** Why?"

Generate **8–12 reasons** across fun / scope / market / tech / team. The
*certainty framing* ("it failed, that is a fact" — not "what risks might there
be?") is the entire technique: it licenses the team to voice doubts that
optimism normally suppresses. The user marks which reasons are *real*; write
mitigations **only** for those.

The reasons are emitted as a table (reason · category · real? · mitigation); its columns
and a worked example are the single source of truth in `references/tables.md` § Phase 8 —
not duplicated here.

## Phase 8 — Find-the-fun test (Cerny Method)

Before committing, define the **smallest prototype that proves or kills the core
fun** — the find-the-fun test. It must be buildable quickly and must answer the
single question "is the 30-second loop actually fun?" A concept whose core fun
cannot be cheaply tested is a scope risk — flag it.

## Phase 8.5 — Validation plan & kill criteria

The pre-mortem names the risks; the validation plan **retires them cheaply, before
full production**. For each *real* Critical risk, pick the cheapest test that proves
or kills it:

| Test | Retires | Typical signal |
|------|---------|----------------|
| **Fake-door Steam page** | "will anyone wishlist this?" | wishlist velocity vs the genre / Next-Fest median |
| **Prototype (find-the-fun)** | "is the core loop fun?" | playtest verdict on the 30-second loop |
| **Discord / subreddit poll** | "which direction do players want?" | direct audience preference before you build |
| **Capsule / key-art A/B** | "does the hook read?" | click-through on the framing |

Each test states a **pass threshold + a deadline + the single risk it retires**.
State **2–4 explicit kill criteria with numbers**, reusing the explore brief's
benchmarks — e.g. *"wishlists below the genre median after one month → the hook does
not read; reframe before spec."* The discipline is to spend the *cheapest* test that
retires the *biggest* market risk before committing to the whole game (Cerny's
find-the-fun logic, extended from fun to market).

The catalogue above is the *menu* of test types. The concept's actual plan — the chosen
tests and the kill criteria — is emitted as tables, single-sourced in
`references/tables.md` § Phase 8.5 (not duplicated here).

## References

MDA: users.cs.northwestern.edu/~hunicke/MDA.pdf · IDEO 7 rules:
ideou.com/blogs/inspiration/7-simple-rules-of-brainstorming · Production blocking:
Diehl & Stroebe 1987 · HMW (NN/g): nngroup.com/articles/how-might-we-questions/ ·
SCAMPER: en.wikipedia.org/wiki/SCAMPER · Verb-first: Anthropy & Clark, *A Game
Design Vocabulary* · Genre-mashup caution: howtomarketagame.com (Zukowski) · Pugh:
en.wikipedia.org/wiki/Decision-matrix_method · How-Now-Wow:
gamestorming.com/how-now-wow-matrix/ · Pre-mortem:
hbr.org/2007/09/performing-a-project-premortem · Cerny Method:
iterative.co.nz/mark-cerny-method · Constraints inverted-U:
hbr.org/2019/11/why-constraints-are-good-for-innovation
