# Game Design Index — Neon Drift

> **Last Updated**: 2026-06-13

The human-readable map of the design. One row per system. `GD-IDS.yaml` is the
machine truth; when the two disagree, `GD-IDS.yaml` wins until the conflict is
resolved through `unikit-gd-verify`.

## Pillars

| ID | Pillar | Design test (short) |
|----|--------|---------------------|
| PIL-1 | Momentum is king | Can the player always trade height for speed? |
| PIL-2 | Feels skillful | (no design test — see review defect) |

## Systems

`Status`: not-started · skeleton · detailed · reviewed · revised · deprecated · `implemented` (set by the code side only; read-only here). See `.unikit/system/gd-principles.md` → Lifecycle & Status.
`Depends`: SYS-ids this one needs (must match each system's section F **and** its `GD-IDS.yaml` `depends_on` — `unikit-gd-verify` checks all three).

| ID | System | Category | Tier | Status | Ver | Depends | Doc |
|----|--------|----------|------|--------|-----|---------|-----|
| SYS-combat | Combat | Gameplay | MVP | detailed | 2 | — | systems/combat.md |
| SYS-boost | Boost | Gameplay | MVP | skeleton | 1 | — | systems/boost.md |
| SYS-loot | Loot | Economy | Vertical Slice | detailed | 1 | — | systems/loot.md |
| SYS-hud | HUD | UI | Vertical Slice | deprecated | 1 | — | systems/hud.md |
