# SYS-combat — Combat

> Status: detailed
> Version: 1
> Last Updated: 2026-06-13

## A. Purpose

Short bursts of contact damage when the courier rams a drone.

## B. Player Experience

Tense, twitchy, rewards timing.

## C. Rules

Ramming a drone at boost speed destroys it. Each ram drains **energy**; a clean
chain refunds energy. (Term drift — the loop in GAME.md calls this resource
"stamina"; defect #3.)

## D. Formulas

| Fact | Formula | Notes |
|------|---------|-------|
| FORM-combat-dps | `dps = base * buff_stacks` | No cap — stacking the buff scales to infinity (defect #5). Cites FORM-combat-dps, which is not in GD-IDS.yaml (defect #4). |

## F. Dependencies

Depends on **SYS-inventory** (hard) for the buff item — but SYS-inventory does
not exist in GD-IDS.yaml or any system doc (defect #2).

## H. Acceptance Criteria

(none listed — the system is not implementation-ready; defect #6.)
