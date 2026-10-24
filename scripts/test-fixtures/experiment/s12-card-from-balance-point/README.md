# Scenario 12 — cards for a balance point

## Scenario
The balance skill calls the experiment skill with the path to a balance document whose current point is issued on the experiment route.

## Setup
A balance document is open under `.unikit/gamedesign/balance/`, its current point is the one the cards are designed for, and no cards exist for the point yet.

## Expected
- The point is read as the balance link says, and the cards are designed from its why, its constraints and what is not in this point.
- Each card carries the origin block, unchanged, and under `Based on:` in section 1 the line `balance: <slug> · <path to the document> · updated <value>`.
- The headline of the draft names what the card is based on; a card without the line stays a draft.
- The planner, given the card, reads the file named by the line (the header, the roadmap and the current point) and uses it: what is not in the point is out of scope for the prototype, the constraints are constraints, and the why is the reason of the tasks.

## Must not
- Change the origin block, or copy the balance document into the store.
- Leave the reference to prose in a section of the card.
- Skip a reference silently when its file is gone: the planner says so and plans from the card alone.

## Anchors
- Anchor: references/balance-link.md :: The reading list
- Anchor: references/balance-link.md :: balance: <slug>
- Anchor: references/template-experiment.md :: Ten yes/no checks
- Anchor: references/template-experiment.md :: nothing of the document is copied into the store
- Anchor: ../unikit-plan/references/experiment-references.md :: the card wins, because the designer approved it
