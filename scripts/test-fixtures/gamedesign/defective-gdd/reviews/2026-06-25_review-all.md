# Review: all — 2026-06-25
> Verdict: CONCERNS
> Scope signal: cross: 3 systems  ·  Mode: review

A seeded `unikit-gd-review` output for the **Neon Drift** fixture — the durable handoff
interface the `review → [explore] → apply` pipeline consumes. The two buckets below are
the ground truth for the handoff smoke (classification, decline-vs-direction, loop-guard);
see the README "Handoff ground truth" section.

## Findings
| RF | Severity | Document / Section | Lens | Diagnosis (problem + evidence) |
|----|----------|--------------------|------|--------------------------------|
| RF-2026-06-25-1 | Critical | SYS-combat / D | systems-math | FORM-damage ramps so steeply it rewards a single alpha-strike — a dominant "first-hit-wins" line that contradicts PIL-1 "twitch reflexes, sustained duels" |
| RF-2026-06-25-2 | Major | GAME.md / pillars | pillar-alignment | the loop stack cites boost as **PIL-3**, but `GD-IDS` records `SYS-boost implements: PIL-2` — the citation is wrong |
| RF-2026-06-25-3 | Major | SYS-boost / C | systems-math | the boost economy has no **sink** for surplus stamina — every run trends to a full meter, flattening the risk/reward the pillar promises |
| RF-2026-06-25-4 | Suggestion | HUD / B | fantasy-delivery | the combo counter is static; it could pulse on a milestone to sell the "flow-state" feeling — plussing, optional |

## Apply-ready  ← hand to /unikit-gd-apply
RF-2026-06-25-2 · GAME.md / pillars · Fix (entailed): correct the boost loop-stack citation from PIL-3 to **PIL-2** (the value `GD-IDS` already records as `SYS-boost implements`; one local edit, no external knowledge)

## Research  ← hand to /unikit-gd-explore
RF-2026-06-25-1 · SYS-combat / D · work out whether FORM-damage needs a softer ramp (or a diminishing-returns term) to kill the alpha-strike line — a math + playtest call, not a known value
RF-2026-06-25-3 · SYS-boost / C · decide whether the boost economy should carry a stamina sink, and what it should be — a design decision, not a mechanical fix

## I like
- The `AC · GOAL · event` spine on FLOW-first-run is clean: every funnel `event` ties to a real `GOAL`, so the first-session arc is measurable.
