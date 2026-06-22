# First run — FLOW-first-run

> **Status**: reviewed
> **Mode**: emergent
> **Version**: 1
> **Last Updated**: 2026-06-22

NB (fixture): the header `> Status: reviewed` / `> Version: 1` disagree with
`GD-IDS.yaml` `flows[].doc_status: detailed` / `version: 2` — the seeded flow
status/version 2-place defects.

## A. Overview

The courier's first descent through the collapsing city: learn to chain boosts,
grab a buff, and reach the extraction point before the collapse catches up.

## B. Objective Flow

<!-- defect (mode↔structure): the header + GD-IDS declare Mode `emergent`, which
requires an affordance / goal-template + a pacing envelope — but this section uses
the LINEAR objective-flow table form. -->

| GOAL | Trigger | Expected action | Success / feedback | Beacon (opt.) | Event |
|------|---------|-----------------|--------------------|---------------|-------|
| GOAL-first-run-1 | run starts | land a clean boost chain | combo meter lights | chain arc | — |
| GOAL-first-run-2 | buff crate ahead | grab the buff from inventory | buff icon appears | crate glow | — |
| GOAL-first-run-3 | extraction in sight | reach the extraction point | run complete (win) | exit marker | extraction_reached |
| GOAL-first-run-4 | ramp ahead | boost off the ramp | airtime + speed kept | ramp light | — |

## C. Pacing

| Beat | Tension | What drives it |
|------|---------|----------------|
| opening | Low | empty street, learn the chain |
| mid | Med | drones appear, the buff crate |
| climax | High | the collapse catches up to the extraction point |

## D. Dependencies

<!-- defect (flow Depends 3-way): §D lists SYS-combat AND SYS-boost, but GD-IDS
`flows[].depends_on` and the ## Flow Map Depends cell carry SYS-combat only. -->

| System | Exercised by | Nature |
|--------|--------------|--------|
| SYS-combat | GOAL-first-run-1, GOAL-first-run-3 | the ram / chain rule |
| SYS-boost | GOAL-first-run-4 | the boost curve |

## E. Events (Funnel)

| Event | Emitted at | Funnel question it answers |
|-------|-----------|----------------------------|
| extraction_reached | GOAL-first-run-3 completes | how many players finish the first run? |

<!-- defect (blind funnel step): GOAL-first-run-1 is retention-critical (the first
thing a player must learn) but emits no event — the funnel cannot see first-chain
drop-off. -->

## F. Open Questions & Changelog

### Open Questions

| Question | Why it is open | What would resolve it |
|----------|----------------|-----------------------|
| Is the collapse timer too tight? | needs playtest | first-run completion telemetry |

### Changelog

#### v1 — 2026-06-22 — initial design
- Created from template; objectives authored.
- GOAL: + GOAL-first-run-1 … GOAL-first-run-4 (new)
- Affected (gd-verify): —
