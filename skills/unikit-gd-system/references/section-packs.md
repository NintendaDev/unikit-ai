# Domain Section-Packs

Conditional blocks appended **after section K** of a SYSTEM GDD when the system
touches a specific domain. A pack adds the domain-specific tables a generic A–K
document cannot carry. Attachment is **automatic on an unambiguous domain** — the
matching pack is auto-attached and the user is told in one **outcome-language phrase**
(the value it adds, never the word "pack" or a code) that they can **veto**; an
**ambiguous** domain is settled by a single plain Yes/No in the **Phase 4 decision
round** (orthogonal to depth — never a mandatory pass after the A–K sections). Each pack
below carries a ready **auto-attach announce** line to speak. Author each attached pack's
sub-sections through the same **Decision-First flow** as the A–K sections (fork-scan →
decision interview → generation → group review — `gd-authoring`), loading the extra rule
named in the pack header.

**Rules for every pack**

- Append the pack **after K**, under a heading `## Pack: <domain>` (when its domain is
  attached — auto on an unambiguous domain, or confirmed for an ambiguous one). The
  `## Pack:` heading is on-disk registry surface, not spoken.
- Apply only the pack(s) that match the system's **behaviour/domain** (one system
  may take more than one — e.g. a gacha shop is `economy` + `monetization`).
- Numbers live in tables; intent lives in prose. Every cross-system number that
  appears here must also be registered in `GD-IDS.yaml`.
- Findings that grade severity (e.g. a dark-pattern audit) use the **shared
  severity rubric in `gd-critique`** — packs never define their own.

---

## Pack: economy

**Apply when:** the system creates, converts, or consumes currencies/resources.
**Load:** `economy`, `balance`.
**Auto-attach announce (outcome language, vetoable):** "I'll also map how your currencies stay balanced — where value enters, where it drains, and what stops it inflating. Say if you'd rather skip that."

| Sub-section | Holds |
|-------------|-------|
| Currencies | Each currency: name, purpose, hard/soft, cap, conversion rules. |
| Sources & Sinks | Every faucet (where value enters) and drain (where it leaves), with rate. A currency with no sink inflates — `unikit-gd-review`'s economy lens owns checking that every currency has ≥1 sink. |
| Inflation Guardrails | What keeps the economy stable: sink scaling, decay, caps; the failure mode each guards against. |
| Value Chains | How raw resources flow into player power (Cook value chains). |

---

## Pack: combat

**Apply when:** the system resolves damage, threat, or direct conflict.
**Load:** `balance`, `frameworks`.
**Auto-attach announce (outcome language, vetoable):** "I'll also pin down the combat feel — how fast fights resolve, what counters what, and the difficulty budget per encounter. Tell me if you'd rather leave that out."

| Sub-section | Holds |
|-------------|-------|
| TTK / TTC Anchors | Target time-to-kill and time-to-clear per archetype, with the feel rationale. |
| Counter Matrix | What beats what (intransitive relationships); confirm no dominant strategy. |
| Threat Budget | Per-encounter difficulty budget and how enemy mixes spend it. |

---

## Pack: ai-behavior

**Apply when:** the system drives non-player decision-making (enemy AI, NPC
behavior, director/spawn logic, companions).
**Load:** `balance`, `frameworks`.
**Auto-attach announce (outcome language, vetoable):** "I'll also work out how the AI thinks and stays fair — what it senses, how it decides, what scales with difficulty, and how it telegraphs its moves. Say if you'd rather skip it."

| Sub-section | Holds |
|-------------|-------|
| Perception & Knowledge | What the agent can sense, range/cone, reaction latency, what it is allowed to "cheat" on (and why). |
| Decision Priority | Ordered behavior selection (FSM/BT/utility): the priority list and the tie-break rule — unambiguous enough to implement. |
| Difficulty Scaling | Which knobs scale with difficulty (numbers, not "smarter"); what must NOT scale (readability, fairness). |
| Tells & Readability | The telegraph for each threatening action and its lead time — the fairness contract with the player. |

---

## Pack: progression

**Apply when:** the system grows player power, unlocks, or mastery over time.
**Load:** `progression`, `balance`.
**Auto-attach announce (outcome language, vetoable):** "I'll also lay out how power grows over time — the curve, time-to-max per play style, and where pacing flattens or spikes. Tell me if you'd rather not."

| Sub-section | Holds |
|-------------|-------|
| XP / Growth Curve | The curve (table or formula `FORM-<slug>`), thresholds, and what each level grants. |
| Time-to-Max by Archetype | Expected time to cap for casual / core / hardcore play patterns. |
| Pacing & DDA | Where the curve flattens or spikes deliberately; any dynamic adjustment. |

---

## Pack: levels

**Apply when:** the system defines level/content structure or layout.
**Load:** `level-design`.
**Auto-attach announce (outcome language, vetoable):** "I'll also lay out the level structure — the pacing beats, the concrete metrics, and how much content it needs. Say if you'd rather skip that."

| Sub-section | Holds |
|-------------|-------|
| Beat Sheet | The intended pacing beats (intro → rising → climax → release; kishōtenketsu where it fits). |
| Level Metrics | Concrete metrics: traversal distances, sightlines, timing windows, jump arcs. |
| Content Requirements | How much content the system needs (count, variety, reuse rules). |

---

## Pack: narrative

**Apply when:** the system delivers story, dialogue, or characters.
**Load:** `narrative`.
**Auto-attach announce (outcome language, vetoable):** "I'll also lay out the story side — what each character is for, how dialogue triggers, and the delivery limits. Tell me if you'd rather leave it out."

| Sub-section | Holds |
|-------------|-------|
| Character Functions | Each character's narrative function and arc, not just biography. |
| Dialogue & Bark Triggers | Trigger conditions, cooldowns, and priority for reactive lines/barks. |
| Delivery Constraints | Branching limits, localization hooks, performance budget for text/VO. |

---

## Pack: ux

**Apply when:** the system is player-facing UI, onboarding, or feedback.
**Load:** `ux-onboarding`.
**Auto-attach announce (outcome language, vetoable):** "I'll also lay out the player-facing flow — the first-time funnel, what they must notice, and the feedback timing. Say if you'd rather skip it."

| Sub-section | Holds |
|-------------|-------|
| FTUE Funnel | First-time-user steps as a funnel: each step, its goal, the drop-off risk. |
| Information Hierarchy | What the player must see, may see, and must never be distracted by. |
| Feedback & Game Feel | The juice budget: response timing (~100 ms targets), readability. |

---

## Pack: liveops

**Apply when:** the system runs recurring events, seasons, or passes.
**Load:** `liveops`, `economy`.
**Auto-attach announce (outcome language, vetoable):** "I'll also lay out the live cadence — the event calendar, how much each one injects, and the line that keeps engagement from tipping into burnout. Tell me if you'd rather not."

| Sub-section | Holds |
|-------------|-------|
| Calendar | Cadence of events/seasons and how they overlap. |
| Injection Budget | How much currency/content each event injects, and the economy guardrail it respects. |
| Engagement vs Fatigue | The retention mechanic and the burnout it risks; the limit that prevents it. |

---

## Pack: persistence

**Apply when:** the system owns state that must survive a session (saves,
profiles, inventories, progression, settings).
**Load:** `progression` (when it persists player power), else none.
**Auto-attach announce (outcome language, vetoable):** "I'll also pin down what survives a session — exactly what's saved, when it's written, how old saves migrate, and what happens on a bad write. Say if you'd rather skip that."

| Sub-section | Holds |
|-------------|-------|
| Persisted State | Exactly what is saved vs recomputed; the authoritative source for each field. |
| Save Triggers & Granularity | When state is written (autosave points, manual, on-quit); what a mid-action crash loses. |
| Migration & Versioning | How an old save loads after a design change — the forward-compat rule for added/removed/renamed fields. |
| Failure & Integrity | Corruption / partial-write behavior; what the player sees; never silently lose progress. |

---

## Pack: monetization

**Apply when:** the system sells, offers purchases, or uses chance-based rewards.
**Load:** `monetization-ethics`, `economy`.
**Auto-attach announce (outcome language, vetoable):** "I'll also lay out the selling side — the offers and disclosed odds, an audit against dark patterns, and the age/region limits. Tell me if you'd rather leave it out."

| Sub-section | Holds |
|-------------|-------|
| Offers & Odds | Each offer/pack; for chance-based items, the disclosed odds and any pity rule. |
| Dark-Pattern Audit | Audit against known dark patterns (darkpattern.games categories); grade findings by the `gd-critique` severity rubric. |
| Age & Region Matrix | Age-gating and regional/legal constraints (e.g. odds disclosure, children's-code limits). |

---

## Pack: accessibility

**Apply when:** any system — section J is the basic minimum; add this pack when
the system has accessibility surface beyond the J checklist.
**Load:** `accessibility`.
**Auto-attach announce (outcome language, vetoable):** "I'll also lay out the accessibility surface beyond the basics — each barrier and its accommodation, what's on by default, and any justified deviation. Say if you'd rather skip it."

| Sub-section | Holds |
|-------------|-------|
| Barrier → Accommodation | Each barrier (motor/visual/auditory/cognitive), affected players, the concrete option, and its tier (basic/intermediate/advanced). |
| Defaults & Presets | What ships on by default; any one-tap accessibility preset. |
| Justified Deviations | Any standard guideline (GAG/XAG/APX) deliberately not met, with the reason. |
