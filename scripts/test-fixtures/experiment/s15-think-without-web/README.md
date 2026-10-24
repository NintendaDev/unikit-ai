# Scenario 15 — a deep pass when the web is not there

## Scenario
The designer asks for a deep pass on the idea of a pushed barrel, as in scenario 14, in a client where the web tools are missing or every search fails.

## Setup
No saved experiments. The web tools are unavailable.

## Expected
- Exactly one warning line says that the web tools are unavailable, that precedents come from the designer and that the claims stay assumptions; it is printed once and the pass goes on.
- The designer is asked once which precedents they know; what they bring is recorded as an assumption, not as a sourced fact.
- A claim without a source is not a row of the precedents table; it appears in the Rationale as an assumption.
- The notes file is still written, first, and the card still carries its `Based on:` line of kind notes.
- Nothing about the missing web stops the pass or turns it into a question about whether to continue.

## Must not
- Invent a source, a date or a precedent to fill the table.
- Stop the pass, or repeat the warning.
- Skip the notes file because there is nothing from the web.

## Anchors
- Anchor: references/mode-think.md :: WARN [experiment] web tools unavailable
- Anchor: references/mode-think.md :: what they bring stays an `assumption`
- Anchor: references/mode-think.md :: and `notes.md` is still written
- Anchor: references/design-notes.md :: A claim without a source is not a row
- Anchor: references/mode-evaluate.md :: Never invent participants, quotes, metrics, counts, outcomes or sources

## Run it yourself
Run scenario 14 in a client with the web tools switched off and check that one warning appears, that the pass finishes, and that the notes file is on disk before the card.
