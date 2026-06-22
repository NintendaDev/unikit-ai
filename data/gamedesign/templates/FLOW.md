# [Flow Name] — FLOW-[slug]

> **Status**: skeleton | detailed | reviewed | revised
> **Mode**: linear | conditional | emergent
> **Version**: 1
> **Last Updated**: [YYYY-MM-DD]
> **Exercises**: [SYS-ids whose rules this flow's goals touch]

A per-flow design document — the **dynamics** axis (what the player does over
time), alongside the SYSTEM GDDs (the rules) and `GAME.md` (the whole). Authored
one objective at a time through the section-cycle contract (see
`.unikit/system/gd-principles.md` → Flow Axis). Each row is a `GOAL-<slug>-<n>`,
the flow counterpart of a system's `AC-<sys>-<n>`. The wiring `Mode` (declared in
the header and in `GD-IDS.yaml`) dictates the shape of section B; `unikit-gd-verify`
checks `Mode` ↔ structure. Machine-readable facts (goals, mode, depends, events)
live in `GD-IDS.yaml` `flows` / `events`.

## A. Overview

[What this flow is and when it happens: the player situation that triggers it, the
intended experience across it, and why the `Mode` fits — linear = a fixed sequence;
conditional = branches on world/player state; emergent = the player sets their own
goal. One short paragraph.]

## B. Objective Flow

*Keep the form that matches the header `> Mode:`. `unikit-gd-verify` flags a
mismatch between `Mode` and the structure below.*

### If Mode = linear / conditional — Objective-flow table

One `GOAL` per row, in play order (linear) or with the branching condition named
(conditional). The **Beacon** (guidance cue) is optional.

| GOAL | Trigger | Expected action | Success / feedback | Beacon (opt.) | Event |
|------|---------|-----------------|--------------------|---------------|-------|
| GOAL-[slug]-1 | [what opens it: state / prior goal] | [what the player does] | [how the game confirms success] | [cue that guides the player] | [event_name] |
| GOAL-[slug]-2 | [condition / completion of -1] | [action] | [feedback] | [cue] | [event_name] |

### If Mode = emergent — Affordance / goal-template

A set of `GOAL`s with **no fixed order** — the player chooses which to pursue. List
the affordances (what the world makes possible) and the goal-template each can
satisfy; there is no Trigger chain.

| GOAL | Affordance (what the world offers) | Player-set objective | Success / feedback | Event |
|------|------------------------------------|----------------------|--------------------|-------|
| GOAL-[slug]-1 | [system / world affordance] | [what the player might aim for] | [confirmation] | [event_name] |

## C. Pacing

### If Mode = linear / conditional — tension by beat

[The tension curve as a per-beat table (not a graph): the intended Low/Med/High
across the flow, so the sequence has shape rather than a flat line.]

| Beat | Tension | What drives it |
|------|---------|----------------|
| [opening] | Low | [setup] |
| [mid] | Med | [rising stakes] |
| [climax] | High | [peak] |

### If Mode = emergent — pacing envelope

[No fixed beat sequence — describe the **envelope**: the floor and ceiling of
tension the affordances should keep the player within, and what pulls them back if
they drift out (too safe / too punishing).]

## D. Dependencies

[The systems this flow exercises (`GOAL → SYS`, refined to `GOAL → AC` once those
systems are detailed). This must agree with the flow's `GD-IDS.yaml` `depends_on`;
`unikit-gd-verify` checks it. A `GOAL` pointing at a missing or deprecated system
is a verify conflict — route the new system back through `unikit-gd-spec`
add-system, never invent the roster row here.]

| System | Exercised by | Nature |
|--------|--------------|--------|
| [SYS-combat] | [GOAL-[slug]-1] | [the goal requires its damage rule] |

## E. Events (Funnel)

[The analytics events this flow emits — the third altitude of the
`AC · GOAL · event` grammar. Each is registered in `GD-IDS.yaml` `events` and
aggregated read-only into `GAME.md` `## Funnel [gen]`. Event names are English
`snake_case`.]

| Event | Emitted at | Funnel question it answers |
|-------|-----------|----------------------------|
| [event_name] | [which GOAL completes / step] | [e.g. where do players drop off?] |

## F. Open Questions & Changelog

### Open Questions

| Question | Why it is open | What would resolve it |
|----------|----------------|-----------------------|
| [Undecided point] | [needs playtest / missing system] | [prototype / decision] |

### Changelog

[Appended by the flow's zone owner (`unikit-gd-flow`) on every approved edit.
Newest first. The **GOAL delta line** is the flow counterpart of a system's AC
delta. A system edit that touches a `GOAL`'s `SYS`/`AC` can stale this flow:
`unikit-gd-verify` marks it `revised` (cross-axis staleness — see Flow Axis); the
reverse never holds.]

```markdown
#### v1 — [YYYY-MM-DD] — initial design
- Created from template; objectives authored.
- GOAL: + GOAL-[slug]-1 … GOAL-[slug]-N (new)
- Affected (gd-verify): —
```
