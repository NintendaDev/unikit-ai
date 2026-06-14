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

## Phase 2 — How-Might-We framing (Basadur / NN/g)

Reframe the creative brief as 3–5 **"How might we…"** questions. Each must be:
positively framed, broad enough to admit many solutions, narrow enough to guide,
and **free of a baked-in solution** ("How might we make the player feel powerful?"
not "How might we add a combo system?"). The user picks one to diverge on.

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

## Phase 4 — Convergence methods

- **Pugh / decision-matrix scoring.** Score each surviving concept against
  criteria the user weights — typically *hook*, *scope-fit*, *team-fit*,
  *market-signal*, *personal-fire*. Show the arithmetic transparently; the score
  *informs*, it does not decide. Hybridize the strongest traits across concepts.
- **How-Now-Wow** (when "I like all of them"): plot ideas on
  *novelty × feasibility* — **Now** (easy, normal), **How** (hard, normal),
  **Wow** (easy, novel ← target), park **hard+normal**. Cuts an over-full field
  fast.
- **Idea backlog:** every rejected concept goes to `IDEAS.md` with *idea, essence,
  reason* (scope / not-fun / off-theme / duplicate) and a **revival condition** —
  so a killed idea is not re-pitched, and a good idea parked for scope can return.

## Phase 8 — Pre-mortem (Klein, HBR 2007)

Run the protocol **verbatim** — the framing is what makes it work:

> "Crystal ball: it is six months from now and the project **failed. That is a
> fact.** Why?"

Generate **8–12 reasons** across fun / scope / market / tech / team. The
*certainty framing* ("it failed, that is a fact" — not "what risks might there
be?") is the entire technique: it licenses the team to voice doubts that
optimism normally suppresses. The user marks which reasons are *real*; write
mitigations **only** for those.

## Phase 8 — Find-the-fun test (Cerny Method)

Before committing, define the **smallest prototype that proves or kills the core
fun** — the find-the-fun test. It must be buildable quickly and must answer the
single question "is the 30-second loop actually fun?" A concept whose core fun
cannot be cheaply tested is a scope risk — flag it.

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
