# SYS-hud — HUD

> **Status**: reviewed
> **Version**: 1
> **Last Updated**: 2026-06-13
> **Implements**: PIL-2 · **Layer**: Presentation · **Scope**: S

## A. Overview

A minimal speed-and-stamina readout. Marked `deprecated` in `GD-IDS.yaml` in
favor of a diegetic readout; its underlying `doc_status` stays `reviewed`. The
`## System Map [gen]` Status shows `deprecated` (display precedence) — this is
correct, not a coherence conflict.

## B. Player Fantasy

Glanceable feedback — serves PIL-2 (feels skillful).

## C. Detailed Design

Two bars: speed (top) and stamina (bottom). No raw numbers shown.

## D. Formulas

(none — the HUD reads values, it does not compute them.)

## E. Edge Cases

| Scenario | Expected behavior | Rationale |
|----------|-------------------|-----------|
| Stamina at zero | The stamina bar flashes | Telegraphs the empty state |

## F. Dependencies

(none.)

## H. Acceptance Criteria

- **AC-hud-1** — Given the player is moving, when speed changes, then the speed bar updates within one frame.
