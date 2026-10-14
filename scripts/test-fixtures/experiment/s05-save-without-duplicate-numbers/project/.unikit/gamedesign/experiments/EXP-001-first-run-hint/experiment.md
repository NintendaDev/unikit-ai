# EXP-001: First-run hint

## 1. Identification
- ID: EXP-001
- Title: First-run hint
- Summary: A one-line goal on the first screen, to see whether new players start the first level sooner.
- Category: onboarding
- Status: Evaluated
- Version: 1
- Created: 2026-10-01
- Updated: 2026-10-01
- Related: none
- Origin: none

## 2. Problem
New players do not know what to do first and wander for a while before the first level begins.

## 3. Hypothesis
If the first screen names the goal in one line, more new players start the first level within a minute, because they know what to do.

## 4. What We Test
Does a one-line goal on the first screen make new players start sooner?

## 5. Design
The first screen shows the game logo and one line that names the goal of the first level. Nothing else changes.
The card describes a disposable prototype, not production-ready functionality.

## 6. Gameplay Flow
The player sees the line, presses start, reaches the first gate and passes it. The goal is the gate, the progress is the distance bar, success opens the gate, failure sends the player back to the start and the next action is the second room.

## 7. Variants
Single version

## 8. Interface and Feedback
One line of text under the logo, large enough to read at a glance, and the existing start button.

## 9. Minimum Scope
### Must Have
- The goal line on the first screen; a way to see how long the player takes to press start.
### Can Be Simplified
- The wording of the line; the font; any animation.
### Out of Scope
- A full tutorial; new art; sound.

## 10. How to Test
Six players, two rounds each, about ten minutes; notes are collected in a chat.

## 11. Success Criteria
More than half of the players press start within a minute (a preliminary acceptance target).

## 12. Risks
Players who already know the game may start fast anyway; testers may read the line aloud to each other.

## 13. Follow-up Decisions
Supported: keep the line. Partially Supported: test a shorter line. Not Supported: look at the layout of the first screen. Inconclusive: repeat with new players.

## 14. Evaluation Summary
- Evaluation status: Evaluated
- Score: 6
- Outcome: Partially Supported
- Evidence: E-001, E-002, E-003
- Confidence: Medium
- Assessed version: 1
