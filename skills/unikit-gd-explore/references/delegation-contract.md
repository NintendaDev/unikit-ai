# Brainstorm → Explore Delegation Contract

The cross-skill contract that lets `unikit-gd-brainstorm` pull a market scan
without owning the engine. **Explore owns this spec** (provider-owns-spec):
brainstorm reads the *interface* here — what the delegate must be told and what
it must return — while the *how* (the scan techniques, modes, and evidence
discipline) lives in `references/market-scan.md`. This file is the only
sanctioned brainstorm→explore coupling.

The discipline mirrors the design→code boundary: brainstorm depends on this
**contract** (the shape of the returned brief), never on the engine
(`market-scan.md` — how the fields are produced). A market existing is not an
opportunity, and ideation must not grade a market from memory.

**Boundary invariant.** Brainstorm never reads `market-scan.md` itself; Explore
never reaches back into `concepts/`. Brainstorm loads *this file* (the interface)
on entering Phase 3.5; the engine stays Explore's.

## Principle — a market signal without data is a hypothesis

`market_signal` is only as trustworthy as its `validation_confidence` tag — an
ungraded or evidence-free signal is a guess and must be labelled one. Brainstorm
never promotes a hypothesis to a fact by restating it. This is the principle the
scan's "a `market_signal` with no evidence behind it is a hypothesis — tag it with
its `validation_confidence`" rule enforces from the engine side.

## The call

Brainstorm spawns Explore as a subagent — mirroring how the code orchestrator
delegates a skill — and **waits for the return**:

```
Agent(
  subagent_type: "general-purpose",
  prompt: "/unikit-gd-explore <commercial frame incl. target platform + budget/team + shortlist>. scan_mode: <quick|standard|default standard>. Validate cross-market per the platform rule. Return the brief into this session as text; do not save any files.",
  description: "Market-validate the shortlist",
  skills: ["unikit-gd-explore"]
)
```

## Input — the commercial frame

The shortlist of surviving concepts plus a **commercial frame**, each concept
phrased as an explicit market question (viability / discoverability / competition /
demand / platform-fit). The frame being explicit is what makes the delegate's
market lens fire deterministically, with no flag and no question.

The frame carried from brainstorm Phase 1:

- **Target platform** — `steam | mobile | web | cross`. Shapes every signal and
  the cross-market rule; never defaulted to Steam.
- **Target outcome tier** — hobby / recoup / commercial.
- **Kill-readiness** — drop on bad data, or passion-project regardless.
- **`scan_mode`** — `quick | standard | deep`; `standard` is the delegation
  default. Caps the confidence the scan may report (see `market-scan.md` →
  "Scan modes"). Absent from the prompt → default to `standard`.
- **Budget / team size** — solo / small team / funded; a *reachability*
  constraint the scan reads demand against. Until brainstorm Phase 1 captures it
  (commercial-frame expansion), it arrives `unknown` and the scan degrades
  gracefully — an `unknown` reachability input never fabricates a budget read.
- **`monetization_intent`** — premium / F2P-IAP / ads / portal rev-share / none.
  Feeds the T8 monetization-fit read. `unknown` until captured → `monetization_fit`
  returns `unknown`, never a guess.
- **Target session length** — shapes platform fit. `unknown` until captured.

`scan_mode`, `budget/team`, `monetization_intent`, and `session_length` are filled
once brainstorm's commercial frame carries them; until then the delegate treats a
missing field as `unknown` and never invents a value to fill it.

## Canonical marker (normative)

The prompt MUST contain, verbatim, on one line:

> **"Return the brief into this session as text; do not save any files."**

Explore detects subagent / delegation mode by this **exact phrase** —
deterministically, not by heuristic — and in that mode skips every
`AskUserQuestion` and writes no file. The marker is duplicated verbatim wherever
delegation is wired (brainstorm's delegate prompt, Explore's detector); it is a
shared token, not a single-home string.

## Output — the per-concept brief

Per concept on the shortlist, returned **into the session as text, never written to
a file**. The contract is the 13-field brief (the engine builds it from the
Evidence Table — `market-scan.md`):

```yaml
concept_id: <slug or frame>
target_platform: steam | mobile | web | cross
scan_mode: quick | standard | deep
cross_market_sources_checked: [<store/portal + what was checked>, ...]
market_signal: white-space | contested | red-ocean | unknown
validation_confidence: A | B | C        # capped by scan_mode
clone_density: none | light | moderate | saturated   # on the TARGET store
unmet_need: "<recurring complaint in players' words>" | none-found
trend_fit: rising | flat | declining | overheated | unknown   # from Trend Radar
monetization_fit: strong | workable | mismatch | unknown       # from T8
go_to_market_risk: "<discoverability / UA-budget / featuring note>"
key_evidence:
  - claim: "<one finding>"
    source: "<url or title>"
    date_checked: "<YYYY-MM-DD>"
    strength: A | B | C
recommendation: proceed | proceed-with-differentiation | validate-later | pivot | kill
```

Every quantitative claim in `key_evidence` MUST carry a `source` + `date_checked`
or be tagged `strength: C` as an explicit inference with a stated band. No bare
numbers.

## Ownership — the calling session owns persistence

- The machine fields (`market_signal`, `validation_confidence`, `clone_density`,
  `trend_fit`, `monetization_fit`, `recommendation`) are lifted **verbatim** by the
  calling brainstorm session into the **CONCEPT card** header machine-block,
  **outside** the nine-field table (the card stays "nine fields, no more").
- `key_evidence` and `go_to_market_risk` are distilled into the card's `## Notes`,
  alongside the comparables, the unmet need, and the reach risk.
- `recommendation` is **advisory** — it informs the Phase 3.5 gate below; the user
  decides.
- **No `researches/` file is created** for a delegated scan — that directory is
  Explore's, and a delegated scan is evidence for *this* concept, carried in the
  card. This avoids an ownership collision with Explore's own `researches/` output.

## Gate — four verdicts, not a binary

Consume the brief's `recommendation` per concept and surface it **before** Phase 4
scoring:

| Verdict | Meaning | Action |
|---------|---------|--------|
| **proceed** | white-space, confidence ≥ B | carry into Phase 4 as a strong candidate |
| **proceed-with-differentiation** | contested, conf ≥ B, a clear twist exists | carry forward; sharpen the hook |
| **validate-later** | white-space/contested at conf C, or `unknown` | carry forward but route the open risk to the Phase 8.5 validation plan |
| **pivot** | red-ocean **but** an adjacent white-space exists | cross-pollinate: graft the under-competed angle onto a stronger concept; render the hybrid as a full nine-field card |
| **kill** | red-ocean, no adjacent white-space, unreachable at scope | park in `IDEAS.md` with a revival condition |

Never silently carry a `kill`/`pivot` concept forward, and never `proceed` or
`kill` on `unknown` — `unknown` always routes to `validate-later`. The gate
informs; the user decides.

## The engine

The *how* of the scan — the modes, the platform matrix, the Evidence Table, the
technique catalogue (T1–T8), the Trend Radar — lives in
`references/market-scan.md`. This contract is the interface over that engine;
brainstorm reads the contract, Explore runs the engine.
