# Scenario 7 — a forwarded chat that mixes experiments

## Scenario
The designer attaches `input-chat-export.txt` (a forwarded group chat) and writes: "Here is what the testers said about the last two builds."

## Setup
`project/` holds two experiments (timer variant, tutorial arrow). `input-chat-export.txt` has ten messages: four name the timer variant, three name the tutorial arrow, one says only "it was confusing", one repeats an earlier message with the same message id, and one speaks about both.

## Expected
- Separate records per experiment, each comment attributed only by an explicit sign.
- The vague comment stays unassigned in `unassigned-feedback.md`, with a note of the likely candidate, and one question asks the designer; there is no tentative state.
- The repeated message adds no evidence; the message about both is stored once and referenced from the other experiment.
- If part of the export cannot be read, the assistant says so and proposes to split the export or give text or CSV.

## Must not
- Guess the owner of the vague comment or count the repeat twice.
- Merge the records of the two experiments.

## Anchors
- Anchor: references/mode-evaluate.md :: stays unassigned
- Anchor: references/mode-evaluate.md :: split the export
- Anchor: references/mode-evaluate.md :: one voice repeated is one voice
- Anchor: references/storage-and-index.md :: re-importing a chat creates no new evidence
- Anchor: references/storage-and-index.md :: There is no tentative state

## Run it yourself
Attach the chat export; afterwards check `feedback.md` of both experiments and `unassigned-feedback.md`.
