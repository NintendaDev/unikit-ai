# SYS-combat — Combat

> **Status**: detailed
> **Version**: 1
> **Last Updated**: 2026-06-13
> **Implements**: PIL-1 · **Layer**: Core · **Scope**: M

## A. Overview

Short bursts of contact damage when the courier rams a patrol drone (ENT-drone)
at boost speed.

## B. Player Fantasy

Tense, twitchy — rewards timing. Serves PIL-1 (momentum is king).

## C. Detailed Design

Ramming a drone at boost speed destroys it. Each ram drains **energy**; a clean
chain refunds energy. (Term drift — GAME.md and the registry call this resource
"stamina"; "energy" is a forbidden alias.)

ENT-drone has **30 HP** — but `GD-IDS.yaml` records the drone at `health: 40`
(a facts conflict).

## D. Formulas

### FORM-combat-dps — Ram damage

```
dps = base * buff_stacks
```

No upper bound — stacking the buff scales damage to infinity. `FORM-combat-dps`
is cited here (and in systems/boost.md) but is absent from `GD-IDS.yaml`
(unregistered cross-doc fact).

## E. Edge Cases

| Scenario | Expected behavior | Rationale |
|----------|-------------------|-----------|
| Two drones rammed at once | Both take full damage | Keeps the chain alive |

## F. Dependencies

Depends on **SYS-inventory** (hard) for the buff item — but SYS-inventory exists
in neither `GD-IDS.yaml` nor any system document (dangling reference).

| System | Direction | Nature of dependency |
|--------|-----------|----------------------|
| SYS-inventory | this depends on it | provides the buff item |

## H. Acceptance Criteria

(none listed — section H is empty, so the system is not implementation-ready.)
