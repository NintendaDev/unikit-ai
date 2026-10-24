# Scenario 16 — a card from a research that carries an experiment block

## Scenario
The designer writes: "A card from the research dodge-window-test."

## Setup
`project/` holds one design research under `.unikit/gamedesign/researches/dodge-window-test/`, saved by the experiment lens of the design exploration: its record is tagged `Kind: experiment` and has no `Target:` line, and its brief ends with an `## Experiment Plan` block (a hypothesis, the judged qualities with their signals, the design essentials with reasons, the rejected alternatives, the protocol options, how the test could mislead, what each outcome decides, the open questions). No experiments are saved.

## Expected
- One confirmation line naming the research by its title, with its state in words, before anything else of it is loaded.
- The block is read first. The ledger table is filled from its fields: a rule of the design essentials, a rejected alternative, a way the test could mislead, an open question; the piece set aside for a later experiment appears as another experiment and in the out-of-scope part of the card.
- The judged qualities are taken from the `Judged on` field with their signals of success and failure; one question only confirms them, asked before any question about how the test is run.
- The card names the research under `Based on:`, and its Rationale is filled from the design essentials, the rejected alternatives and the findings; section 12 comes from how the test could mislead, section 13 from what each outcome decides.
- Nothing of the research is copied into the store, and nothing is written before the designer approves.
- A research that has no such block (scenario 11) still goes the old way.

## Must not
- Read the summary from scratch and ignore the block, or ask the judged-qualities question open when the block names them.
- Invent signals, reasons or outcomes that the block does not hold.
- Write into the research store, give the research a number, or copy the block into the experiment store.
- Skip the Rationale because the research is long.

## Anchors
- Anchor: references/from-research.md :: `## Experiment Plan` is read first
- Anchor: references/from-research.md :: its `Judged on` field is the first source
- Anchor: references/from-research.md :: the rows come from its fields
- Anchor: references/from-research.md :: card, Rationale
- Anchor: ../unikit-gd-explore/references/experiment-lens.md :: What each outcome decides
- Anchor: ../unikit-gd-explore/references/experiment-lens.md :: `Target:` is **not** written
- Anchor: ../unikit-gd-explore/references/save-research.md :: Kind: feature | improvement | experiment
- Anchor: ../unikit-gd-explore/SKILL.md :: inferred from the prompt, never a flag

## Run it yourself
Copy `project/` into a scratch project that has the skills installed, give the prompt from `## Scenario`, and check that the block is read first, that the ledger and the judged qualities come from it, and that the card ends with a Rationale.
