# Scenario 9 — handing cards to the planner

## Scenario
The designer writes: "Plan the ready experiments."

## Setup
`project/` holds two cards marked Ready for Planning (loot pop, minimap toggle) and one Draft (combo meter, with an undecided rule).

## Expected
- One command listing the paths of the two ready cards, with no mode word, printed as the last block with the icon in front.
- The draft is named, with what is missing; it is not in the command.
- The assistant does not create a plan, a branch or any git state.

## Must not
- Print one command per card or include the draft.
- Name a planning mode in the command.

## Anchors
- Anchor: references/planning-handoff.md :: without a mode word
- Anchor: references/planning-handoff.md :: a set goes into one plan
- Anchor: references/planning-handoff.md :: Only cards with Status Ready for Planning are listed
- Anchor: references/planning-handoff.md :: does not create the plan
- Anchor: SKILL.md :: nothing after it

## Run it yourself
Check that the last line of the reply is the command and that it holds exactly two paths.
