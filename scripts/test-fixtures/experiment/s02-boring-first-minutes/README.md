# Scenario 2 — the first minutes are boring

## Scenario
The designer writes: "The first five minutes of my game feel boring. What can we test?"

## Setup
No saved experiments. A GDD may or may not exist.

## Expected
- If the problem, the audience or the goal is unclear: one to three short questions first.
- Then a table printed as the assistant's own message with at least five ideas, each with a different causal hypothesis, and exactly the columns ID, Experiment, Hypothesis, What We Test, Prototype Cost, Learning Value.
- Cost and value are rated Low, Medium or High, each with a reason.
- A short rationale, recommendations, and one question: choose one or several, combine, change, or search again.
- Nothing is saved; the ideas have no experiment numbers.

## Must not
- Offer five variants of one lever as five ideas.
- State player data, market numbers or facts about other games that cannot be supported.
- Write files or index rows for unselected ideas.

## Anchors
- Anchor: references/mode-discover.md :: at least five meaningfully distinct experiment ideas
- Anchor: references/mode-discover.md :: different causal hypotheses
- Anchor: references/mode-discover.md :: | ID | Experiment | Hypothesis | What We Test | Prototype Cost | Learning Value |
- Anchor: references/mode-discover.md :: get no experiment number and no index row
- Anchor: references/mode-discover.md :: Nothing is saved in this branch
- Anchor: references/mode-discover.md :: proposals, not evidence

## Run it yourself
Give the prompt in a project with no `experiments/` folder and check that nothing appears on disk.
