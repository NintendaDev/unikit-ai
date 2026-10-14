# EXP-003: Timer variant

## 1. Identification
- ID: EXP-003
- Title: Timer variant
- Summary: A visible countdown on each capture, to see whether players act faster without getting confused.
- Category: pacing
- Status: Testing
- Version: 1
- Created: 2026-10-01
- Updated: 2026-10-01
- Related: none
- Origin: none

## 2. Problem
Capture rounds feel slow: players wait and watch instead of acting.

## 3. Hypothesis
If a visible countdown limits each capture, players move faster, because they feel time pressure.

## 4. What We Test
Does a visible countdown make players act faster without making the round confusing?

## 5. Design
Each capture shows a number counting down in the corner of the screen. When it reaches zero the capture fails and the flag returns to its place.
The card describes a disposable prototype, not production-ready functionality.

## 6. Gameplay Flow
The player enters the arena, picks up the flag and carries it to the base. The goal is the base, the progress is the distance and the countdown, success is the flag at the base, failure is the countdown reaching zero and the next action is the next flag.

## 7. Variants
A: no countdown. B: a sixty-second countdown

## 8. Interface and Feedback
A large number in the top corner that turns red in the last ten seconds, readable at a glance.

## 9. Minimum Scope
### Must Have
- The countdown number; the failure when it reaches zero; a switch between variant A and variant B.
### Can Be Simplified
- The look of the number; the sound of the last seconds.
### Out of Scope
- Leaderboards; a second arena.

## 10. How to Test
Six players, two rounds each, about ten minutes; notes are collected in a chat.

## 11. Success Criteria
Players in variant B finish a capture noticeably sooner and still say what the number means (a preliminary acceptance target).

## 12. Risks
Players may rush and never read the number; two rounds may be too few to see a change.

## 13. Follow-up Decisions
Supported: keep the countdown. Partially Supported: test other lengths. Not Supported: drop the countdown. Inconclusive: repeat with more players.

## 14. Evaluation Summary
- Evaluation status: Not Tested
- Score: Not Rated
- Outcome: Undetermined
- Evidence: None
- Confidence: —
- Assessed version: —
