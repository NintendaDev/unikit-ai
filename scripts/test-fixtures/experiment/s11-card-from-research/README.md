# Scenario 11 — a card from a design research

## Scenario
The designer writes: "A card for the hint arrow, from the research first-session-hints."

## Setup
`project/` holds one design research under `.unikit/gamedesign/researches/first-session-hints/`: a record whose success signals speak only of understanding, a brief, and the original request, in which the designer asks whether the start is more fun and whether the player feels clever. No experiments are saved.

## Expected
- One confirmation line naming the research by its title, with its state in words, before anything else of the research is loaded.
- A ledger table `| Research item | Goes to |` of at most twelve short rows; a piece the research sets apart or postpones appears as another experiment and in the out-of-scope part of the card.
- One question about what the test should show, several answers allowed, the source named in each candidate, asked before any question about how the test is run; the qualities named in the designer's own words come first and are recommended.
- A headline of up to five lines, then a table of short rows; a long section continues as 5.1, 5.2 and so on.
- Section 4 holds one question sentence and a `Judged on:` line; the success criteria are written quality by quality.
- Nothing is written before the designer approves.

## Must not
- Take the success signals of the research as the only measure.
- Ask about a control, a hint or the number of players before the qualities are settled.
- Print one cell of thousands of characters, or a table the screen falls back to blocks for.
- Invent example qualities when no source names one.
- Write to the experiment store before approval.

## Anchors
- Anchor: references/from-research.md :: A research gives the idea and the design, not the measure
- Anchor: references/from-research.md :: Nothing is dropped silently
- Anchor: references/from-research.md :: before the questions about how the test is run
- Anchor: references/mode-specify.md :: never taken as known
- Anchor: references/card-draft-view.md :: A row holds one idea
- Anchor: references/card-draft-view.md :: ## The headline
- Anchor: references/template-experiment.md :: is read as judged on its question alone

## Run it yourself
Copy `project/` into a scratch project that has the skills installed, give the prompt from `## Scenario`, and check the order of the questions and the shape of the draft against `## Expected`.
