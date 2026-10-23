# Balance link — origin block, reading a checkpoint, returning results

Read **only** when the request is a path to a CHECKPOINTS.md file (or a balance document folder or slug), or when a card or an evaluation carries an origin block. The balance skill calls this skill for a checkpoint whose route is an experiment, or prints the command for the user to run. This file is the single definition of the origin block and of what is read from the checkpoint; the weighing of the route, the time warning and the receiving of results belong to the balance skill.

## Entry

The input is a path to `CHECKPOINTS.md`, a balance document folder, or a slug under `.unikit/gamedesign/balance/` (the same forms the planner accepts: `{{skills_dir}}/unikit-plan/references/balance-plan.md` → `Resolving the input`). A slug without a file → `Glob` `.unikit/gamedesign/balance/*/CHECKPOINTS.md`, show the five latest by `Updated` (read only the first 12 lines of each) and ask once with the question tool of your agent (`AskUserQuestion`): the four latest as the options, the recommended one first; the fifth is named in the free-text answer. Nothing found → say "there is no balance document: /unikit-gd-balance" and stop.

## Reading the checkpoint

- Read **only** the first 12 lines (the header: `Slug`, `Status`, `Current`, `Updated`), the `## Roadmap` section and the `## Current Balance Checkpoint` section. BALANCE.md and results/ are read only when the user asks. The code workspace `.unikit/code/` is not scanned.
- The point is current when `Status: open`, `Current: BCH-<n>`, `## Roadmap` has exactly one `current` row with the same id, and the block's `Point:` matches. `Status: closed`, `Current: none` or a mismatch → create no cards, say it in words (the point is named by its goal, not by its code), point to `/unikit-gd-balance <slug>` and stop.
- Cards are designed from `Why` (which decisions the data will change), `Constraints` and `Not in this point`. `Work` items of the kinds tool, stand, data-edit and measure are the language of the direct route and are **not** carried into cards. The rule: one card per independent hypothesis; dependent future points do not enter the cards.
- Cards of this point that already exist (their origin block carries the same `Point:` and `Checkpoints updated:`; found by `Grep` over the experiments folder) are shown first, and the skill asks once, with the question tool of your agent (`AskUserQuestion`): continue with them (the Manage and Evaluate branches) or design further experiments for the point (Specify). A repeated call with the same path — the command the balance skill also prints for a point already waiting for results — therefore creates no duplicates.

## The origin block

The single definition. In a card (section 1, field `Origin`):

```markdown
- Origin: from balance
  - Balance document: <slug>
  - Point goal: <the goal of the point, in words>
  - Point: BCH-<n>
  - Checkpoints updated: <the Updated value of the header when the point was read>
  - Read on: YYYY-MM-DD
```

In the header of `results.md` the same five lines, unindented, directly under `Experiment: EXP-<nnn>` and `Origin: from balance` (within the first 12 lines of the file). The block is **immutable**: it copies the context of the question at the time of reading; a later change of the point is noticed by the balance skill from the `Checkpoints updated` value. There is no separate snapshot document of the point's question. The point code (`BCH-<n>`) is allowed in the file, but in speech the point is named by its goal.

## Returning the results

After an evaluation the skill prints **one** command as the last block (Handoff Tail):

```
🧭 /unikit-gd-balance <slug> "<path to results.md>"
```

With several results (a set of cards of one point) all paths are arguments of the same single command. Before the command the skill looks (`Grep`, as in `## Entry`) for cards with the same `Point:` and `Checkpoints updated:` that are not yet evaluated; if there are some, it says so in one line and asks, with the question tool of your agent (`AskUserQuestion`), whether to evaluate them first — otherwise the second card reaches the balance skill as late data and the rule "all results of a point in one command" is not met. A report and, when needed, an explanation come before the command; nothing comes after.

## When it is not a balance request

A card without an origin (`Origin: none`) does not read this file; an evaluation of a card without the block prints no return command to balance.
