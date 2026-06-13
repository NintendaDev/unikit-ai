# Review Lenses

The catalog of review lenses for `unikit-gd-review` — absorbed from the former
`review-lenses` memory rule. The **severity rubric** and the **critique stance**
(Braintrust, critique-vs-review, plussing) live in `gd-principles`; this file holds
only the lenses and their adversarial prompts.

**Adversarial framing (the whole point).** Every lens runs as a skeptic: *"Your
job is NOT to validate this design — find what is wrong with it."* A lens that
returns "looks good" without having tried to break the document has not run.
Default to finding a problem; only conclude clean after a genuine attempt to
falsify. Each finding cites the **document section AND the contradicted fact /
pillar / rule** (`gd-principles` — no citation → downgrade to Suggestion).

## Core lenses (run on every review)

| Lens | The question it attacks | Typical severity on a hit |
|------|-------------------------|---------------------------|
| **completeness** | Is any section empty, `[To be designed]`, or missing? Does every core rule and edge case have an AC? | Major (empty section / untestable AC) |
| **clarity / implementability** | Could a programmer build this without guessing? Find every ambiguous rule and undefined term. | Major (ambiguous rule); Critical (hole in core rules) |
| **pillar alignment** | Does the system serve ≥1 pillar? Does anything contradict a pillar (lower-numbered wins)? | Critical (contradicts a pillar) |
| **systems-math** | Are the formulas sound, ranges sane, no dominant strategy? Attack the numbers (cost curves, intransitivity). | Critical (dominant strategy); Major (untuned range) |
| **scope** | Is the S/M/L/XL realistic against the ambition and the team constraint? | Major (scope/ambition mismatch) |
| **feasibility** | Reads `DESCRIPTION.md`/`ARCHITECTURE.md` (the **single** sanctioned code-context read) to flag implementability risks against the actual stack/architecture. | Critical (unimplementable on this stack) |

## Domain lenses (add by the system's category)

Load the matching **core** domain rule (`.unikit/memory/gamedesign/`) and apply
its checks adversarially:

| System category | Domain lens | Load | Attacks |
|-----------------|-------------|------|---------|
| economy / loot | economy | `economy` | a faucet with no sink; uncapped inflation; broken value chains |
| ui / onboarding | ux-clarity | `ux-onboarding` | FTUE drop-off; buried information hierarchy; missing feedback |
| any system | accessibility | `accessibility` | section J below the GAG basic minimum; unjustified deviations |
| monetization | ethics | `monetization-ethics` | dark patterns (darkpattern.games categories); undisclosed odds |
| liveops / events | liveops | `liveops` | injection budget vs the economy guardrail; engagement→burnout |
| combat / progression | systems-math | `balance`, `progression` | dominant strategy; degenerate curve; broken TTK/TTC |

A finding from a domain lens that grades severity uses the **shared rubric in
`gd-principles`** — lenses never invent their own scale.

## Cross-scope lenses (only when the scope is "all" / "all systems")

Beyond running the core lenses on each document, a cross-review adds the checks no
single-document review can make:

- **Depends bidirectionality** — every `A depends on B` has the matching edge on B;
  asymmetric edges are Major.
- **Formula compatibility** — formulas shared across systems agree on units, ranges,
  and variable meaning.
- **Cross-AC consistency** — acceptance criteria in different systems do not
  contradict each other.
- **Pillar drift** — the set of systems collectively still serves every pillar; a
  pillar no system implements is a gap.
- **Total scope vs tiers** — the summed scope is realistic against the MVP / VS /
  Alpha / Full tiers.
- **End-to-end scenarios** — trace **3–5** "one moment through N systems" walkthroughs
  (e.g. *take damage → status applied → UI feedback → death → respawn economy hit*)
  and find where the systems disagree.

## Output discipline

- **Diagnose, don't prescribe** (`gd-principles`): name the problem and its
  evidence, not your fix. Prescriptions ("what if…", plussing) are offered **only
  when the user asks**.
- **Name what works** ("I like…") — honest calibration, not flattery.
- Separate **Required before implementation** (all Critical + Major) from the
  explicitly non-blocking **Suggestions** list.
