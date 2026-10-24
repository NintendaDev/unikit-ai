# Specify — write the experiment card

Read **only** when an experiment card is to be written or changed — an idea was chosen, the user asks for a specification directly, asks to compare variants of one question, or asks to edit a draft. Load also `{{skills_dir}}/{{self_name}}/references/template-experiment.md`, `{{skills_dir}}/{{self_name}}/references/card-draft-view.md` and `{{skills_dir}}/{{self_name}}/references/storage-and-index.md` in the same turn, before drafting.

## Order

1. **Input.** A chosen idea (from Discover), a direct request, a request to compare variants, or an existing draft. When the input is a path to `CHECKPOINTS.md`, read `{{skills_dir}}/{{self_name}}/references/balance-link.md` first. A game-design research that the request names or attaches goes through `{{skills_dir}}/{{self_name}}/references/from-research.md` first (read it in the same turn).
2. **Understand.** **What the card judges is asked first and never taken as known:** a request, a research, a brief or a chat gives the idea, not the measure, unless the designer's own words in this request already say it. Ask which qualities the test is read against before any question about how it is run; for a research, `from-research.md` does it. Then ask only what the card cannot be written without, section by section, together: Question, Options, Decision (the `gd-principles` protocol); the recommended option first with its reason; each question is asked with the question tool of your agent (`AskUserQuestion`), its options the likely answers, and the designer writes their own in the free-text answer. The card is not interrogated "from cover to cover": what is known is filled in, and what is asked is what the planner could not decide alone.
3. **Facts about the existing game** (what exists, what can be reused) → `{{skills_dir}}/{{self_name}}/references/context-and-research.md`; the answer enters the card in game words.
4. **Draft** the whole card in the conversation and print it as your own message, in the table form owned by `{{skills_dir}}/{{self_name}}/references/card-draft-view.md`, headline first.
5. **Check** it by `## Quality of a card` below, by the technical-traces self-check (`storage-and-index.md`) and by `Readiness for planning` (`template-experiment.md`).
6. **Approve, then write.** One question with the question tool of your agent (`AskUserQuestion`), the recommended option first: `1.` save · `2.` change — the designer writes what to change in the free-text answer · `3.` stop. Nothing is written before the answer. After `1.`: `storage-and-index.md` → `Creating an experiment folder`, then the order of writes. Several chosen ideas → several cards, each with its own chain of writes, in the user's order.
7. **Report** (terminal block, TIER A): the saved cards by title (the code as a secondary parenthesis), each with its status; for a `Draft`, what is missing; then the closing block.

## Quality of a card

- The hypothesis is testable; there is one changed factor, or the reason several move together is written down.
- "What We Test" opens with one sentence, the question the evidence must answer; the line `Judged on:` under it names the qualities that sentence covers, and the success criteria hold signals for each.
- The player sees the goal, progress, success, failure and the next action (`template-experiment.md` owns the wording).
- Thresholds are preliminary acceptance targets; there are no invented numbers; the duration is not imposed.
- **Variants.** A request to compare variants of one question is one experiment with variants; each variant differs by a single factor; the card lists the parameters that switch the variants and how the tester switches them — a requirement of the card, not an implementation.
- The card is independently understandable: no "as we discussed" and no reference to a hidden context.
- The card does not prescribe engine classes, architecture, dependency injection, code files or implementation details.
- Section 5 carries, as its last line, the sentence from the template, "The card describes a disposable prototype, not production-ready functionality" (the skill never removes it, neither on creation nor on edit).
- A card built from a research or a balance document names it in `Based on:` (`from-research.md`, `balance-link.md`); without it the card stays a draft.
- A user-combined idea: check the one-factor rule; if two factors move, offer two experiments or record the reason; the user decides.

## Changing an existing card

- A rewording updates `Updated`; `Version` does not change. A material change (hypothesis, rules, parameters, variants, protocol, criteria): Version rises by one; on an assessed card `Evaluation status` becomes `Outdated` (the only write of this branch into section 14; the rest of it is written by the evaluate branch); say in one line that the earlier assessments belong to the earlier version.
- Archived cards are not edited (lift the archive first — the manage branch).
- Every change goes through the same path: show (the table of `card-draft-view.md`), approve, write; the index last.

## Closing block

When any card **saved or changed in this turn** has the status `Ready for Planning`, close with the plan command for those cards (the form belongs to `{{skills_dir}}/{{self_name}}/references/planning-handoff.md`). Other ready cards of the catalog do not enter the command; the manage branch offers them on request. With no ready card there is no command: say what is missing.

## Boundaries

- The card is written strictly by `template-experiment.md`; the write follows `storage-and-index.md`: card → `feedback.md` → `results.md` → index.
- A new card is `Draft` until the readiness check passes; only this branch sets `Ready for Planning`.
- This branch calls no planner and creates no git branch.
- The user stopped at approval (`3.`) → write nothing, change nothing. A failed write → stop, name the last file written and the pending write; a half-created card is not declared saved.
- A reference file is missing → `WARN [experiment] <file> missing — nothing is saved; run unikit-ai update` and stop writing.
