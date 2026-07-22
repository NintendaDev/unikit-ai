# Market-Scan — Explore's Market-Research Engine

The *how* of a market scan: the technique catalogue `unikit-gd-explore` loads on
demand when a prompt carries **market intent**. The *when/what* — the market-signal
table and the decision rule that triggers this load — lives in
`unikit-gd-explore/SKILL.md` → "Market lens — when it engages". The cross-skill
**delegation contract** that lets `unikit-gd-brainstorm` pull a scan without owning
this engine lives in `references/delegation-contract.md` (Explore owns the spec).
This file is **method, not process** — the same split methods.md keeps for
`unikit-gd-brainstorm`.

A scan answers one question: **does a reachable audience exist for this design, and
is there room in the market for it** — not "is the genre big". It produces evidence,
graded by confidence; it never produces a go/no-go decree (that is the user's, via
the owning skill's gate).

## Governing principles

- **Range, not a point.** Every estimate is a band with a low/high, never a single
  number ("~5–15k owners", not "10k"). A point estimate hides its own uncertainty.
- **Triangulate — two estimators minimum.** No claim rests on one source. Cross a
  store-page signal with a review-count proxy with a community-size proxy; where two
  disagree, report the disagreement, do not average it away.
- **Survivorship guard.** The visible hits are the survivors. For every breakout
  comparable, ask what the median and the failures in the same niche look like — a
  genre is not its top 1%.
- **Freshness.** Tag every data point with its age. Store algorithms, tag meanings,
  and audience size drift fast; a two-year-old "the genre is dead" take is a
  hypothesis, not a fact.
- **Reliability A/B/C.** Grade each finding: **A** = multiple primary / hard signals
  (store data, dated sales, large-n reviews); **B** = secondary or partial
  (single article, small-n reviews, indirect proxy); **C** = inference or one weak
  source. A scan's overall `validation_confidence` is the *weakest* link in its
  load-bearing chain, not the average.
- **A market existing is not an opportunity.** Demand with no *reachable white-space*
  is a red ocean. A `market_signal` with no evidence behind it is a hypothesis —
  tag it with its `validation_confidence` and say so (`references/delegation-contract.md`
  → "Principle").
- **No bare numbers (anti-hallucination).** Every quantitative market claim (sales,
  owners, installs, wishlists, ratings, revenue) MUST either cite a source with a
  check-date, or be stated as an explicit inference (grade **C**) with a low/high
  band and the proxy named. A number with neither is a fabrication — delete it. When
  unsure of a figure, report the band and the method, never a confident point. This
  rule overrides any request to "just give a number".

## Pre-scan — frame before you search

Pin these before issuing a single query (in delegation mode they arrive in the
prompt — see "Subagent mode" below):

- **The shortlist** — which concept(s) is this scan for? One named frame per concept.
- **The commercial question** — viability / discoverability / competition / demand /
  platform-fit. Different questions weight different techniques.
- **The anchor comparables** — 2–4 nearest existing titles to orient from.
- **Platform & store** — Steam, mobile, web, or console; the store shapes every
  signal, and demand vs. competition often live on *different* stores (see T7,
  cross-market validation). Name the **target** store and, when it is non-PC, the
  Steam reference market used to prove the underlying demand.
- **Time budget** — a 3-query sanity check and a deep scan use the same engine; say
  which depth before starting so the brief's confidence is honest about its effort.
  Formalized below as the **scan mode**, chosen before the first query.

## Scan modes — staged deepening (manage token cost up front)

A scan declares its **mode before the first query**. The mode fixes the query
budget, the triangulation bar, and — critically — the **confidence ceiling** a
scan in that mode may report. A scan can never claim more confidence than its
mode allows; this feeds the Pugh hard rule downstream (market ≤ validation).

| Mode | Query budget | Triangulation | Confidence ceiling | Output |
|------|--------------|---------------|--------------------|--------|
| **quick** | 3–6 | 1 estimator/claim (all flagged partial) | **C** | signal + one-line evidence per concept + mini Evidence Table |
| **standard** (delegation default) | 8–15 | ≥2 estimators per load-bearing claim | **B** | full delegation brief + Evidence Table + Comparable Games Map |
| **deep** (standalone for spec/detail) | 15–30 (+ paid data if the user has it) | ≥2; A-grade needs hard data | **A** (dated sales / paid-tool / large-n only) | RESEARCH_RESULT + brief + all matrices + Trend Radar |

- In delegation (subagent) mode the caller passes the mode in the prompt
  (`scan_mode: quick|standard|deep`); absent → default to **standard**.
- The confidence ceiling is a hard cap: a quick scan reporting
  `validation_confidence: A` is a contract violation. Round down, never up.
- A scan may upgrade its own mode mid-run only by saying so explicitly and
  spending the extra budget; it never silently exceeds the cap.
- **Deep-scan paid data.** Only a deep scan may lean on paid tools (Sensor Tower,
  VG Insights, Gamalytic pro) — and only when the user actually has access. A
  paid-tool figure with a check-date is the one path to an **A** grade; without it,
  deep caps at **B** like standard. Never assume paid data the user did not provide.

## The techniques

| # | Technique | What it produces | Lead question |
|---|-----------|------------------|---------------|
| **T1** | **Comparable mapping** | A table of nearest titles × axes (audience, price, scope, reception, the borrow/twist). | Who already serves this player, and how? |
| **T2** | **Demand classification** | A verdict: **exists / reachable / white-space** (see below). | Is there demand, can *we* reach it, and is any of it unmet? |
| **T3** | **Intersection & saturation** | For genre mashups: the size and crowding of the *intersection* audience, not either parent. | Does the X-meets-Y audience exist, or only X and Y separately? |
| **T4** | **Review mining** | Recurring praise / complaint themes from comparables' reviews — the unmet need in players' own words. | What do players of the nearest games keep asking for? |
| **T5** | **Audience ↔ buyer dissection** | The player profile *and* the buyer profile (often not identical: who plays vs who pays / wishlists). | Who plays this, and who actually spends on it? |
| **T6** | **Platform / store fit** | Tag/category fit, discoverability surface, price-point norms for the chosen store. | Will the storefront surface this to the right people? |
| **T7** | **Cross-market validation** | For a non-PC target: a Steam **demand** proof plus a target-store **clone** check — the "proven elsewhere, open lane here" read, per platform. | Is this proven somewhere, and is my actual store still open? |
| **T8** | **Monetization & business-model fit** | A verdict (strong / workable / mismatch) on whether the concept's natural business model survives the target platform's economics. | Can this concept make money *on this store* the way it must be built? |

**T2 — the demand classification framework** (the load-bearing verdict):

- **exists** — there is measurable demand for the *category* (comparables sell, the
  tag has volume). Necessary, never sufficient.
- **reachable** — *we* can actually get in front of that demand at our scope/budget
  (the tag is not pay-to-win on visibility; the audience is findable). Demand we
  cannot reach is somebody else's market.
- **white-space** — there is an *unmet* slice inside the reachable demand (a
  recurring complaint no comparable answers; an underserved intersection). This is
  the only one of the three that is an *opportunity*.

`market_signal` reports where the concept lands: **white-space** (reachable unmet
demand) → strong; **contested** (reachable demand, no clear white-space) → neutral,
differentiation-dependent; **red-ocean** (demand exists but saturated and/or
unreachable at our scope) → weak/kill-candidate; **unknown** → not enough signal,
say so rather than guessing.

**T7 — cross-market validation (platform transfer):** demand and competition often
live on *different* stores. Steam is the richest demand signal — hard sales bands,
wishlist data, tag volume — even for a game shipping to mobile or web, while the
*destination* store is where the clone risk is real. So when the prompt names a non-PC
target, scan in two moves and report a signal **per platform**:

1. **Demand, on Steam.** Is the genre proven on PC (sales bands, tag health, wishlist
   signal)? A genre that cannot sell on Steam rarely invents demand on mobile.
2. **Competition, on the target store.** App Store / Google Play / the web portal: how
   many clones, how good, how entrenched (ratings, install bands, update cadence)?

The read: **proven on Steam + no strong clone on the target store** → `white-space` on
the platform that matters (proven demand, open lane — the strongest signal for fast
mobile/web development). **Proven on Steam + clone-saturated target store** →
`red-ocean` *for this platform*, however well it does on PC. Never collapse PC and the
target store into one verdict — the whole point is that they can disagree.

**T7 web & hybrid extensions:**

- **Web target.** Prove demand on **Steam OR mobile**, then check clones on the **web
  portals** (Poki / CrazyGames / itch / Y8) and read the gap. Proven-elsewhere plus an
  open web lane is the strongest signal for fast web development; raw web demand
  (portal playcounts) is thin and fragmented, so it rarely stands on its own.
- **PC-proven mechanic → mobile/web (hybrid).** Check three things *separately*, never
  as one verdict: (a) does the loop survive the target platform's **session compression
  and control scheme** (game-feel risk)? (b) does the **monetization** survive the swap
  — a premium PC loop usually has no model on an ad-portal (T8)? (c) has the "open lane"
  already become a **clone graveyard** after the PC hit? A "yes" on game-feel and
  monetization with an open lane is the green light; any "no" is a per-axis flag, not a
  blanket kill.
- **Rule:** never collapse a verdict across two platforms into one — demand and
  competition live on different stores and routinely disagree.

**T8 — monetization & business-model fit:** a concept can be white-space and still
have no viable model on the target platform. Read the platform's dominant model
(Steam premium / mobile F2P-IAP-ads / web ad-portal rev-share) against the concept's
natural model. A slow premium-feeling loop on an ad-supported web portal, or a no-IAP
cozy game on a F2P mobile chart, is a **mismatch** — flag it; it caps the market score
(Phase 4, via the brief's `monetization_fit`). A model that fits but is unproven is
**workable**; one the platform clearly rewards is **strong**; `unknown` when no
`monetization_intent` was framed. Sources: store price norms (T6), ARPDAU/retention
bands by genre (mobile), portal rev-share + exclusivity terms (web).

## Platform scan matrix — where each signal lives

The generic Source map below still applies, but the *primary* source for each signal
differs by platform. Scan the target store for competition; scan the richest-demand
store (usually Steam) for demand — they are often different stores (see T7).
Tools/figures drift — re-verify, do not hardcode.

| Platform | Demand signal (where) | Supply / clone (where) | Monetization read | Discoverability surface | Key freshness risk |
|----------|----------------------|------------------------|-------------------|-------------------------|--------------------|
| **PC / Steam** | wishlist/follower count (store page, SteamDB); tag volume; Next-Fest medians; Boxleiter (reviews × ~20–60×, genre-dependent, median ~35×) triangulated w/ Gamalytic + VG Insights | tags + "More like this"; releases 2024–2026 by tag | premium / EA price norms by tag | wishlist-driven; trailer moment + capsule CTR | tag meanings + Discovery Queue drift; Next-Fest medians shift per season |
| **Mobile** | top-charts by category; ASO keyword volume; retention/session norms | category top-grossing; clone density (high) | F2P/IAP/ads; ARPDAU + retention norms (T8) | featuring + ASO + paid UA | ATT/privacy degrades download/revenue estimates — treat as less reliable than Steam |
| **Web / instant** | portal playcounts/MAU (Poki largest, CrazyGames ~20M, itch, Y8) | clones across *multiple* portals (fragmented) | ad/portal rev-share; realistic 1st-game ceiling ~$500–3000/mo; IAP rising | instant hook (first seconds), embeddability | portal algorithm + exclusivity terms change fast |
| **Cross / hybrid** | prove demand on Steam OR mobile | check clones on the *target* store/portals | model must survive the platform swap (premium-loop ≠ ad-portal) | per-target surface | "open lane" can close after a PC hit |

**Tooling note (re-verify each run):** App Annie is dead — it became data.ai,
acquired by Sensor Tower (2024). SteamSpy is historical-only post-2018. Prefer SteamDB
(free wishlist/follower/concurrent) + a sales estimator (Gamalytic / VG Insights) for
Steam; Sensor Tower / AppMagic for mobile; portal dev-docs for web economics. Never
cite a tool's number without a check-date.

### Source map (generic, grade inheritance unchanged)

| Source | Gives | Typical grade |
|--------|-------|---------------|
| Storefront page (Steam/itch/store) | tags, price, reviews count, release cadence | A (for that title) |
| Review count × age (Boxleiter-style proxy) | owners/sales *band* | B (proxy, wide band) |
| Player reviews (top + recent, positive + negative) | unmet need, complaint themes (T4) | B |
| Genre/tag listings, "more like this" | comparables, saturation (T1/T3) | B |
| Community size (subreddit, Discord, wishlists-if-public) | audience reachability (T2) | B/C |
| Press / creator coverage, dated articles | market narrative, freshness check | C (tag the date) |

Prefer **primary store signals** over aggregator opinion. Every secondary claim
inherits its source's grade; an A conclusion needs an A chain.

## Trend Radar & Freshness Rules

A market is a moving target. The scan must read *direction*, not just current size — a
rising niche strengthens a white-space read; an overheating niche is a pivot signal
even when demand "exists".

**Freshness Rules (hard):**

- Every data point carries a **check-date**. No date → it is an inference (grade **C**),
  never a hard signal.
- **Staleness cap:** a *trend* claim (rising / declining / overheated) must cite a
  source dated within **6 months**, or it is downgraded to a hypothesis and the trend
  cell reads "unknown". A *structural* fact (genre exists, tag is large) tolerates 12
  months.
- A "the genre is dead" take older than 6 months is a hypothesis to test, not a fact to
  act on.

**Trend Radar** (deep scan: required; standard: include only trends that bear on a
load-bearing claim; quick: skip). One row per relevant trend:

| Trend | Platform | Evidence (dated) | Direction | Relevance to concept | Risk | Confidence |
|-------|----------|------------------|-----------|----------------------|------|------------|
| <e.g. cozy-management rising> | steam | <source + date> | rising / flat / declining / overheated | high / med / low | <timing / saturation> | A/B/C |

- **overheated** is distinct from **declining**: high demand *and* high supply with
  falling per-title returns → routes the concept to **pivot**, not kill.
- The Trend Radar feeds the `trend_fit` field in the subagent brief and the Phase 8
  pre-mortem's market-timing failure mode.

## Query templates

```
<comparable title> steam reviews                      → T1, T4 (reception, complaints)
"<genre> roguelike" steam tag games 2024..2026        → T1, T3 (field, freshness)
<genre A> meets <genre B> game                         → T3 (intersection existence)
<comparable> "I wish" OR "needs" OR "disappointing"    → T4 (unmet need, players' words)
<genre> game audience OR "who plays"                   → T5 (player vs buyer)
<store> <genre> tag top sellers price                  → T6 (price norm, discoverability)
```

Adapt to the store; chain at least two templates per load-bearing claim
(triangulation principle).

## Evidence Table — the anti-hallucination backbone (mandatory)

Every market scan builds an Evidence Table *first*; the brief and the verdict are
distilled **from it**, never written ahead of it. In a standalone scan it lives in
`RESEARCH_RESULT.md` § Findings; in delegation it is the substrate the `key_evidence`
block is lifted from (each brief claim must trace to a row).

| Claim | Source | Date checked | Platform | Evidence type | Strength | Notes |
|-------|--------|--------------|----------|---------------|----------|-------|
| <one factual claim> | <url / title / tool> | <YYYY-MM-DD> | steam/mobile/web | store-data / review-proxy / community / press / inference | A/B/C | band, caveat, disagreement |

- A claim with no source row cannot appear in the brief.
- The scan's overall `validation_confidence` = the **weakest** strength among the
  load-bearing rows (weakest-link, not average), and is then capped by scan_mode.
- Where two sources disagree, log both rows and report the disagreement — never
  average it away.

## Demand / Supply / White-space Matrix

The output of **T2 + T3** — one row per concept × platform. It produces the
`market_signal` (white-space read), supplies `clone_density` for the brief, and feeds
the Pugh Pass-2 and the four-verdict gate. (standard: build it; quick: a one-line
read per concept; deep: full.)

| Concept | Platform | Demand signal | Supply density | Clone density | Player pain (T4) | White-space read | Confidence |
|---------|----------|---------------|----------------|---------------|------------------|------------------|------------|
| <frame> | steam | <band + proxy> | low/med/high | none/light/moderate/saturated | "<complaint>" | white-space/contested/red-ocean/unknown | A/B/C |

## Comparable Games Map

The output of **T1** — feeds field 7 (Comparables) of the CONCEPT card, the Evidence
cells under each pillar, and the anti-pillars (review-mining "hate"). The
**Monetization** column is what ties a comparable to the T8 read.

| Game | Platform | Why comparable | Audience signal | Monetization | Differentiation lesson | Risk |
|------|----------|----------------|-----------------|--------------|------------------------|------|
| <title> | steam | <axis of likeness> | <owners/review band> | <model + price> | <borrow / twist / what it leaves unmet> | <survivorship / IP-bound> |

## Output → brief

A scan yields a **brief**, in one of two shapes:

**1. Standalone brief** (Explore run directly, for `unikit-gd-spec`/`-detail`) —
folded into `RESEARCH_BRIEF.md` per the SKILL's Saving section: Question · Key
findings (each sourced + graded) · the comparable/demand tables · Implications ·
Recommended follow-up. Saved to `researches/` **only on the user's explicit yes**.

**2. Brainstorm-delegation brief** (Explore spawned by `unikit-gd-brainstorm`) — a
per-concept evidence packet, **returned into the session as text, never written to a
file** (the delegation contract — `references/delegation-contract.md`). Its exact
shape is the contract's **per-concept brief** (the 13-field YAML block there) —
**do not re-spell the field list here**; build the brief to the contract. The engine
side is only the discipline: every `key_evidence` row traces to a row in the Evidence
Table below, and every machine field is capped by the scan mode.

The machine fields (`market_signal`, `validation_confidence`, `clone_density`,
`trend_fit`, `monetization_fit`, `recommendation`) are **machine fields** (underscore)
the calling session lifts verbatim into the CONCEPT card header; `key_evidence` and
`go_to_market_risk` distil into its `## Notes`. They are distinct from the human Pugh
criterion `market-signal` (hyphen) in `brainstorm/references/methods.md` — the
criterion is a *judgment*; the field is the *evidence* that judgment may now lean on.

## Subagent mode (deterministic, no questions)

When Explore runs as a **spawned subagent** serving a brainstorm request, it detects
delegation by the **canonical marker** the contract requires in the prompt:

> **"Return the brief into this session as text; do not save any files."**

In this mode, **deterministically**:

- **Skip every `AskUserQuestion`** — the market lens is already mandated by the
  prompt (the contract requires the prompt be phrased as an explicit commercial
  question), so there is no lens tie-breaker to resolve and no save-offer to make. A
  subagent is non-interactive; a prompt would hang it.
- **Do not write any file** — `researches/` is owned by the calling session, which
  decides what to persist. "Do not save" means *skip the save step*, not *answer no*.
- **Prefer direct `WebSearch`/`WebFetch`** over a nested `Agent(subagent_type:
  Explore)` — nested spawning from inside a subagent is unreliable; lean on the
  SKILL's documented fallback.
- **Return** the brainstorm-delegation brief above, one block per shortlisted concept.

## Worked example — *Sutler* (Маркитант)

Concept frame (from brainstorm): *"a roguelike where you run a battlefield sutler's
cart — a contested-corpse-economy game; is there a reachable market for it?"*

- **T1 comparable mapping** → *Spiritfarer* (death-adjacent cozy commerce),
  *Moonlighter* (shopkeep-by-day/dungeon-by-night), *Backpack Hero* (inventory
  roguelike). Each sells; none is a *battlefield* economy.
- **T2 demand** → *exists* (cozy-management + roguelike both have volume, B-grade
  via review-count bands); *reachable* (mid-size tags, not visibility-locked);
  **white-space** = the *grim/contested* framing of the merchant fantasy — review
  mining of *Moonlighter* (T4) shows recurring "wanted more moral weight to the
  selling" complaints no comparable answers.
- **T3 intersection** → "cozy commerce" × "battlefield survival" is genuinely
  uncrowded; the risk is the intersection audience being *thin*, not absent — flag as
  a prototype question, not a kill.
- **Verdict** → `market_signal: white-space`, `validation_confidence: B` (proxies and
  small-n review themes; no hard sales data). Not a red ocean → survives the gate;
  the thin-intersection risk routes to the find-the-fun test, not to a cut.
