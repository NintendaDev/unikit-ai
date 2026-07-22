# SYS-boost — Boost

> **Status**: skeleton
> **Version**: 1
> **Last Updated**: 2026-06-13
> **Implements**: PIL-1 · **Layer**: Core · **Scope**: M

## A. Overview

The hoverboard's boost: spend **stamina** for a burst of speed that feeds ram
damage against a patrol drone (ENT-drone).

## B. Player Fantasy

Acceleration as flow — serves PIL-1 (momentum is king).

## C. Detailed Design

Holding boost spends stamina; landing a clean chain banks the charge. Boost speed
feeds `FORM-combat-dps` (defined in systems/combat.md) — the same unregistered
formula is cited across both documents.

## D. Formulas

### FORM-boost-curve — Acceleration curve

```
speed = speed + charge * 5
```

### FORM-boost-curve — Decay curve

```
speed = speed - drag * 2
```

(The id `FORM-boost-curve` is declared twice here for two different formulas — a
duplicate-id defect.)

### FORM_boost_decay — Stamina drain

```
stamina = stamina - 3 per tick
```

(`FORM_boost_decay` uses an underscore separator — a malformed id; the prefix
must be `FORM-`.)

## E. Edge Cases

[To be designed]

## F. Dependencies

This system depends on **SYS-combat** — but the `## System Map` Depends cell and the
GD-IDS `depends_on` for SYS-boost are both empty (a Depends 3-way disagreement).

| System | Direction | Nature of dependency |
|--------|-----------|----------------------|
| SYS-combat | this depends on it | boost speed feeds ram damage |

## H. Acceptance Criteria

- **AC-boost-1** — Given a full stamina bar, when the player holds boost, then speed rises along FORM-boost-curve.
- **AC-boost-2** — Given empty stamina, when the player holds boost, then no acceleration occurs.
