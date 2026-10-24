# Experiment lookup — finding the card a request names in words

Read **only** when a request names an experiment by its description instead of a selector — "the latest experiment", "the experiment about onboarding", a card title, a variant name — and `.unikit/gamedesign/experiments/` holds at least one `experiment.md`. A selector (`EXP-<nnn>`, a path to a card, a folder) never needs this file, and neither does a request when the store is absent or empty: an A/B switch in code then goes the ordinary way. This file is the single definition of how a card is found; the skills that need it name it and do not restate it. The layout of the store is `{{skills_dir}}/{{self_name}}/references/storage-and-index.md`; nothing here is written — no card, status, feedback, result or index changes.

## What counts as a reference

- "The latest", "the newest", "the last" experiment, in whatever language the user writes.
- "The experiment about <topic>" or "the one with <variant name>".
- A card title or its slug, as the user remembers it.

The bare word "experiment" is not a reference, and neither is a request that uses the word in another sense (an A/B switch in the project, a test of code paths): the lookup is for saved cards, and the confirmation below stops a false start.

## Finding the cards

1. `Glob` `.unikit/gamedesign/experiments/EXP-*/experiment.md`. The folders and the cards are the source of truth.
2. `Read` the first 25 lines of every card: section 1, Identification (`ID`, `Title`, `Summary`, `Category`, `Status`, `Version`, `Created`, `Updated`). A card that cannot be read is left out with `WARN [experiment] a card could not be read — listed as unreadable`; the rest goes on.
3. Two folders with one number are not settled by a guess: name both by their titles, say that the number repeats, and ask which one is meant.
4. A card with `Status: Archived` never answers "the latest". A request by topic may match it; it is then listed last and marked as archived.
5. Cross-check `index.md` last, and only to cross-check: a card the index lacks, or a row with no folder, gives one line, `WARN [experiment] index out of date — not repaired`. The answer comes from the cards, never from the index, which is checked and not silently repaired.

## The latest

Two candidates, both among the cards that are not archived:

- **the newest by number** — the highest `EXP-<nnn>`: numbers only grow and are never reused, so it is the card created last;
- **the newest by update** — the latest `Updated:` day; on a tie the higher number.

One card in both roles is one candidate. Two different cards are one question that names both by title and says which was created last and which was changed last.

## By topic

Compare the request with the title, `Category`, `Summary`, `What We Test` (section 4) and the variant names (section 7) of each card; sections 4 and 7 are read only for the cards the identification fields did not settle. Rank a title or slug match first, then `What We Test`, `Summary`, `Category`, the variant names. A relevance the text does not support is not claimed.

- One match → the confirmation below.
- Several → one question with at most four titles, best first; when more matched, it says how many were left out and the user narrows the request in the free-text answer.
- None → one line saying so, then the titles of the cards with their states in words, and no other question.

## The confirmation

Whatever was found, even one card, the user sees one line before anything else is loaded: an experiment changes the whole shape of what the caller does next (the planner takes a branch of its own and the prototype profile), so a wrong guess costs more than one question.

`<title> (<number>) — <state in words>, version <k>. <the caller's question>`

- The number is shown unless the caller speaks through the game-design membrane (`gd-principles`, The membrane): those skills name an experiment by its title and a state by a plain phrase, with no code in the line.
- The state is said in words, not as the stored token: a draft, ready for planning, in development, ready for testing, being tested, evaluated, archived.
- The question is the caller's: the planner asks to plan this one, an exploration asks to build on this one, a branch of this skill asks to work on this one.
- A caller that only prints a result — a list, a comparison — skips the line; a caller that acts on the card or changes course keeps it.
- A card that is not ready for planning says so in the line. When the caller plans and a ready card exists, an option offers the latest ready card by its title; whether a card that is not ready may be planned is the planner's decision, the lookup only finds.
- Options: yes (recommended) · another experiment (show the titles, ask again) · not a saved experiment (the request goes the ordinary way).
- Every question in this file is asked with the question tool of your agent (`AskUserQuestion`), the recommended option first.

## The result

One path, `.unikit/gamedesign/experiments/EXP-<nnn>-<slug>/experiment.md`, which the caller treats exactly like a selector the user typed. Cards live in the working tree of the current branch: one saved on another branch is not found — the lookup says so, searches no other branch and moves no file.
