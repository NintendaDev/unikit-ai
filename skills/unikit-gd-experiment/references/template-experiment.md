# Template — experiment.md

Read **only** when a card is being created or edited, or checked for readiness for planning (the Specify and Manage branches). This file is the single definition of the card, of its statuses and of what "ready for planning" means; other files name it and do not restate it. The section names are stable English anchors; the text written into them is in the interface language. Machine values — statuses, outcomes, ids — stay verbatim.

## The card

```markdown
# EXP-<nnn>: <title>

## 1. Identification
- ID: EXP-<nnn>
- Title: <title>
- Summary: <one or two sentences — what the experiment is>
- Category: <one word or a short phrase, for example onboarding>
- Status: Draft
- Version: 1
- Created: YYYY-MM-DD
- Updated: YYYY-MM-DD
- Related: none
- Origin: none

## 2. Problem
<The player or design problem: who is hurt, how it shows today, why it matters.>

## 3. Hypothesis
<One testable statement: if <change>, then <observable reaction of players>, because <reason>.>

## 4. What We Test
<One sentence: the single question the evidence must answer.>

## 5. Design
<The experience in the designer's words: what the player sees, does and gets; the rules; the parameters that differ between variants.>
The card describes a disposable prototype, not production-ready functionality.

## 6. Gameplay Flow
<The session from entry to exit: the goal, the progress, success, failure, the next action, the reset.>

## 7. Variants
<Each variant: its name, what differs, the one factor it moves. "Single version" when there is none.>

## 8. Interface and Feedback
<The minimum screens and signals. The key elements named, and why each is readable at a glance.>

## 9. Minimum Scope
### Must Have
- <what the prototype cannot work without>
### Can Be Simplified
- <what may be crude because it does not touch the hypothesis>
### Out of Scope
- <what is deliberately not built>

## 10. How to Test
<Who plays, for how long, how many rounds, what is observed or asked, what is recorded, how feedback comes back.>

## 11. Success Criteria
<Observable signals for each outcome. A threshold is written as a preliminary acceptance target.>

## 12. Risks
<What can make the result misleading, and what lowers the risk.>

## 13. Follow-up Decisions
<What each outcome — Supported, Partially Supported, Not Supported, Inconclusive — would change in the design.>

## 14. Evaluation Summary
- Evaluation status: Not Tested
- Score: Not Rated
- Outcome: Undetermined
- Evidence: None
- Confidence: —
- Assessed version: —
```

## Field rules

- **Status** — one of: Draft, Ready for Planning, In Development, Ready for Testing, Testing, Evaluated, Archived. A new card is `Draft`. `Ready for Planning` is set by `## Readiness for planning`. `In Development`, `Ready for Testing` and `Testing` are set on the designer's word — the skill never infers from silence that a prototype is built or being played. `Evaluated` is set by the evaluate branch after the first assessment. `Archived` is set by the manage branch. Executors and the planner never touch the card.
- **Version** — an integer ≥ 1, `1` on a new card. It grows by 1 when the **conditions of the test** change: the hypothesis, the rules, the parameters, the set of variants, the test protocol or the success criteria. A rewording, a typo or a swapped word does not change it. When the version grows on a card that was assessed before, its `Evaluation status` becomes `Outdated`.
- **Evaluation status** — `Not Tested` (no assessments), `Evaluated` (the latest assessment was made on the current `Version`), `Outdated` (assessments exist, but the latest was made on an earlier version).
- **Created** is set once; **Updated** is today's date (`Bash(date *)`) on every write of the card.
- **Related** is `none` or `EXP-<nnn>` numbers separated by commas; **Category** is a free word; **Summary** is one or two sentences.
- **Origin** is `none` or `from balance` with five nested lines; the format of those lines belongs to `{{skills_dir}}/{{self_name}}/references/balance-link.md` and is not repeated here.

## What each section must hold

- **Hypothesis** — testable; one changed factor, or the reason why several move together is named.
- **Design** — the player's experience in the designer's words; it does not prescribe engine classes, architecture, dependency injection, code files or implementation details. The sentence "The card describes a disposable prototype, not production-ready functionality" is the last line of section 5 of every card, so the planner tells a prototype from finished functionality; the specify branch keeps it in every card it writes.
- **Gameplay Flow** — visible: goal, progress, success, failure and the next action.
- **Interface and Feedback** — visual readability is essential; the key elements that must read at a glance are named.
- **How to Test** — a concrete protocol; the duration is chosen by the card: do not force every experiment to last five minutes.
- **Success Criteria** — any threshold is marked as a set of preliminary acceptance targets and is never presented as a fact.
- **Problem, What We Test, Variants, Minimum Scope, Risks, Follow-up Decisions** — as the line of the template says.

## Readiness for planning

Ready for Planning is set only when the planner could build the prototype without asking the designer about a rule that matters. The card is independently understandable: it does not lean on a hidden conversation context. Eight yes/no checks:

1. The hypothesis is testable, and the factor is one or the reason for several is named.
2. It is clear what to build — sections 5 and 6 describe the whole experience.
3. The parameters that differ between variants are named.
4. The minimum interface covers goal, progress, success, failure and the next action.
5. `Must Have`, `Can Be Simplified` and `Out of Scope` are filled.
6. There is a way to test it and there are success criteria.
7. No material question to the designer is left in the text.
8. The text holds no technical traces (the self-check in `{{skills_dir}}/{{self_name}}/references/storage-and-index.md`).

Any "no" keeps the status at `Draft`, and the closing block prints no plan command and names the reason.

## The evaluation summary

The initial values are those of the template. Section 14 is derived from `results.md`; only the evaluate branch writes it, never by hand. The one exception is the `Evaluation status` field: when `Version` grows, the specify branch sets it to `Outdated`. The fields `Status` and `Updated` belong to section 1, not to section 14. `Evidence` is `None` or a comma-separated list of evidence numbers, `E-<nnn>, E-<nnn>`, with no brackets and no count.
