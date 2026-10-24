# Discover — experiment ideas for a problem

Read **only** when the request is a normal ask for experiment ideas — a design problem or a feeling to test is already understood, for example "the first five minutes are boring". A bare call and an unclear problem do not read this file: the briefing stays a conversation (`SKILL.md` → Intent resolution). Nothing is saved in this branch.

## Understand the problem first

- When the problem, the audience or the goal is unclear, ask one to three short questions in plain language (what feels weak, for whom, what was tried already) with the question tool of your agent (`AskUserQuestion`); the options of each are the likely answers drawn from the request and the GDD, or two short examples, and the designer writes their own in the free-text answer. This is not a questionnaire: ask only what is still unclear. Once the answer is enough, move on.
- Context when it exists: if `.unikit/gamedesign/GAME.md` and `GD-IDS.yaml` are there, read them read-only (pillars, systems); a GDD is not required. Domain rules are taken by their `Load when` line from `RULES_INDEX.md` (`ux-onboarding`, `core-loops`, `player-motivation`, `frameworks`, `level-design`, `accessibility`, `balance`, `progression`), without walking the rules tree. Facts about what the game **already** does come only through `{{skills_dir}}/{{self_name}}/references/context-and-research.md`.

## What to produce

- For every normal request: at least five meaningfully distinct experiment ideas. "Distinct" means different causal hypotheses: a different reason the problem exists and a different lever on the player — not five variants of one lever.
- A request to compare variants of **one** question (for example three navigation hints) is not an idea search: it goes straight to `{{skills_dir}}/{{self_name}}/references/mode-specify.md` as one experiment with variants.
- The table is printed as your own message (a tool result is folded and the user does not see it). The columns are exactly `| ID | Experiment | Hypothesis | What We Test | Prototype Cost | Learning Value |`. `ID` is a plain row number 1…n, **not** an experiment number; ideas get no experiment number and no index row until a card is saved.
- `Prototype Cost` and `Learning Value` are Low, Medium or High, each with a short reason in the same cell. A rating without a reason is not allowed.
- After the table: a short justification of the ratings; recommendations (where to start and why; which two combine well; which are risky); one bold idea, labelled as such, to support creative search.

## Quality bars for an idea

- An idea is worth running when its answer changes a design decision: optimize for learning, not for feature count.
- Hypotheses differ; avoid invalid comparisons (two things change at once; different testers; different conditions).
- Avoid false precision: no invented percentages and no invented number of players.
- A negative result must be useful: say what a failure would teach.
- Tell "fun" from "understood": the idea tests understanding, enjoyment or both, and says which.
- Focus on the player's experience; each idea names the problem it answers (traceability).
- The table holds proposals, not evidence: nothing about player data, the market or other games is claimed unless it can be confirmed, and an idea never passes itself off as a fact.

## After the choice

- One or several chosen → each goes to `mode-think.md` for the depth question first, then to `mode-specify.md`, in the user's order. A number is assigned only when a card is saved.
- "Search more" → a new table of ideas that do not repeat the earlier ones, with a note on how they differ.
- The choice is asked as one question with the question tool of your agent (`AskUserQuestion`), the recommended option first: choose one · choose several · combine or change · search more. For the first three the designer writes the row numbers, or the change, in the free-text answer.
