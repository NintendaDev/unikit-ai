# Scenario 8 — evaluating again after the card changed

## Scenario
The designer pastes three comments from a new test of the timer variant and asks to evaluate it again.

## Setup
`project/` holds the timer variant card at version 2 (the countdown was shortened), with round 1 tested on version 1 and its assessment.

## Expected
- The earlier assessment is kept; a new round is added for version 2; the new assessment may supersede the old one with a stated reason.
- The current assessment is the latest one on the current version; before the new round it reads as not assessed on the current version.
- The two rounds are not averaged; the index shows the new outcome and score.

## Must not
- Rewrite round 1 or its assessment.
- Decide the outcome by the score instead of the hypothesis.

## Anchors
- Anchor: references/storage-and-index.md :: Not assessed on the current version
- Anchor: references/storage-and-index.md :: is decided by the hypothesis, not by the score
- Anchor: references/storage-and-index.md :: never averaged
- Anchor: references/mode-specify.md :: Version rises by one

## Run it yourself
Compare `results.md` before and after: round 1 must be byte-identical.
