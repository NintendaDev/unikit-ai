# Planning handoff — from cards to a plan

Read **only** when cards are to be handed to the planner — after saving a card marked Ready for Planning, or when the user asks to plan one or several saved experiments.

## What the planner needs from a card

The planner cannot ask a hidden context, so a card is handed over when its readiness checklist passes (`{{skills_dir}}/{{self_name}}/references/template-experiment.md` → `Readiness for planning`). From the card the planner reads: what to build and why (sections 2-6), what may be simplified and what is not built (section 9), the minimum interface (section 8), the test criteria (sections 10-11), and what is tuned between variants (sections 5 and 7). The card holds no technical instructions: the planner finds the implementation itself.

## The command

The command is printed as a fenced block, last in the answer (Handoff Tail):

```
🧭 /unikit-plan <path to experiment.md> [<path to experiment.md> …]
```

- Paths are relative to the project root, one per ready card; the command comes without a mode word — the planner asks the mode question itself, shows fast, full and ultra, and recommends ultra for a set of two or more cards.
- Several cards are one request, because a set goes into one plan: one command with all the paths, not one command per card.
- Only cards with Status Ready for Planning are listed; a `Draft` is named with what it lacks.
- A report comes before the command; nothing comes after.

## What this skill does not do

This skill does not create the plan, a branch or any git state. It does not set `In Development` (that is the designer's word); it does not prescribe engine classes, architecture, dependency injection or code files; it does not rework the game idea for the planner. The planner takes a **snapshot** of the cards; editing a card after the snapshot does not change the plan.

## A prototype is not a feature

A card describes a disposable prototype. Telling a prototype from finished functionality is done by the planner and by the prototype profile (a system contract); this skill does not restate that contract.

## Where the evaluation runs

Cards and records live in the working tree, while a plan's branch is cut from a base — cards saved and committed on another branch may be missing from it. The evaluation runs where the card files are: the skill sees only the working tree; when the card is not there, it says so, does not recreate it and does not move files between branches.

## Failures

No ready cards → no command, say why. An unreadable card → excluded with the reason. Logs carry nothing.
