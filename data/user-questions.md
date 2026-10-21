# User questions — how a skill asks the user and waits for the answer

Read before the first question a run asks the user, once per run and never at Bootstrap. Do not restate this contract inside a skill: the skill says what it asks — the question, its options, which one is recommended — and what each answer does, and points here for how it is asked; a copy that repeats these rules drifts, and no test turns red when the two disagree.

## The question tool

Every question goes through the question tool of your agent (`AskUserQuestion`) — the tool your agent offers for a question with options, whatever it is called there. Skill text names it with the name in brackets, and in every agent it means that same tool.

## A turn that waits for the user ends with a question

When the run needs the user — a decision, an approval, a name or a description it cannot find by itself — it asks, as below. A turn never ends on an explanation, a summary or a recommendation that leaves the next step to the user, and after an answer the run goes on to its next question or to its end.

## How to ask

1. Before every question — the first, the second and any later one, however obvious its options look — say what is being chosen and what each option changes, as a visible message of your own: the user does not see your reasoning, and tool output is folded away. Write it as a numbered list, one line per option, each with its concrete consequence, the recommended option first. Anything the user is asked to approve — a draft, a description, a table, a report — is printed in full in this message. Do not add a second list of the bare option names.
2. Then ask with the tool: the question in one short sentence, two to four options in the same order, the recommended one first with "(Recommended)" in its label, short labels without numbers. The question carries the options and nothing else: the explanation and the text to approve stay in the message of step 1. Questions that do not depend on each other go into one call, four at most; a question that depends on an earlier answer waits for that answer.
3. While the question is open, do not end your turn, do not give a final answer and do not write status lines: wait for the answer in this same turn — where your agent lets you wait, check back after a short wait — and say nothing and do nothing else while you wait. There is no time limit: time passing is not an answer.
4. Only if your agent has no such tool, or the call fails: print `WARN [questions] no question tool — asking as numbered text` once per run, ask the same questions as the numbered list of step 1 — the questions numbered, the options numbered under each — and end your turn. The user answers by number (`1 — 2`), and their next message is the answer.

## A question with no fixed answers

A question whose answer is the user's own words — a name, a number, a list, a description — goes through the tool as well, never as plain text while the tool works. Its options are two to four likely answers drawn from what the run already knows, the recommended first; with nothing to draw on, two short examples of the expected answer. The user picks one or writes their own in the free-text answer of the tool, and a written answer is taken as written. An answer the user sends as a message of their own counts the same.
