# Scenario 1 — an empty call

## Scenario
The designer types `/unikit-gd-experiment` with no arguments.

## Setup
No project files are needed.

## Expected
- One to three short, conversational questions: what feels weak, or which hypothesis the designer wants to test.
- Nothing is listed, nothing is saved, and no reference file is read before the request is understood.
- No command is printed.

## Must not
- Produce generic ideas or a specification before the problem is understood.
- Present a long questionnaire.
- Create any file under `.unikit/gamedesign/experiments/`.

## Anchors
- Anchor: SKILL.md :: no reference is read
- Anchor: SKILL.md :: Nothing is written before the designer approves it

## Run it yourself
Run the command with no argument; watch the first reply and the project tree.
