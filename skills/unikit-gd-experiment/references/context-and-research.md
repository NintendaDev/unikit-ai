# Context and research — read the project, write in game words

Read **only** when a fact about what the game already does is needed to write or judge a card — what exists, what could be reused, what is missing — and the GDD does not answer it. This is the only place where this skill looks at the project, and it only reads. The same file is the brief of the reader: the section `## For the reader` is written to be handed over by path.

## When and how to read

- Read only when the answer changes the card. The question and the slice (a folder or a system the user pointed at) are named **before** reading; stop as soon as the answer is found.
- The GDD, when there is one, is read first and read-only; a GDD is not required.
- The reading is done by a subagent through the `recon-agent` alias (its call is declared once in `SKILL.md` → `## Delegation agents`; it is not repeated here). The prompt is self-contained: it names the path `{{skills_dir}}/{{self_name}}/references/context-and-research.md` to read first, the question and the slice, and ends with the literal `You are read-only: edit and write nothing.` When the subagent is unavailable, read it yourself with the search and read tools under the same rules and print `WARN [delegation] recon-agent unavailable — read inline`.
- Not used: the general reconstruction workflow of another skill, the knowledge base of the code module, the development principles of the code pipeline, the code skills. The code workspace (plans, code researches) is not scanned; from it only a document the user named is read.

## For the reader

- You read the project to answer a question about the **observable behavior of the game**: what the player sees and does, which mechanics already exist and could be reused, what is missing.
- Return the answer in the words of a game designer: no names of classes, methods, fields, files, folders, assets or components, and no code.
- For each fact give a confidence: high — plainly visible; medium — inferred by convention; low — a guess, which is recorded as "unknown". List separately what could not be determined.
- A class name does not prove that a mechanic works: ask what happens in practice.
- You write no files. End with: You are read-only: edit and write nothing.

## What goes into the artifacts

- Behavior is written in game words; directly under the paragraph or list where it is said, a separate line carries the marker `<!-- provenance: extracted from code; confidence: <high|medium|low> -->` (one level value). The marker is the HTML comment of the form `<!-- provenance: extracted from code -->` from `gd-provenance.md`; the suffix `; confidence: …` is added by this skill. There is **no** reference to code (no path, no line, no name). Tell apart: a designer's decision, an agent's proposal, a fact from code — only a fact from code gets the marker.
- The experiment artifacts hold no technical traces (the self-check in `{{skills_dir}}/{{self_name}}/references/storage-and-index.md`). In chat the source of a fact may be named **at the user's request**: ask the reader again, allowing it to name the source; the answer is shown only in chat and never enters an artifact.
- A fact that cannot be said without a technical word is written `unknown — the planner will check the project`.

## The planner receives behavior, not pointers

The planner receives behavior without pointers and finds the implementation itself in its own reading of the code; the card does not tell it where to look.
