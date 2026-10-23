# Experiment source — a plan built from something other than cards

Read **only** when the planner is on the experiment branch (`SKILL.md` → **An experiment request**) and the source is not an experiment card: a game-design research, a file, a description in the request, the session, or nothing at all. An ordinary plan and a plan built from cards do not read this file. The planner builds **one** plan of a disposable prototype, the kind `{{skills_dir}}/{{self_name}}/references/experiment-plan.md` describes, with the same section `## Experiment Context`, whose grammar belongs to `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md` → `### Experiment context section` and is not repeated here. Nothing is written to `.unikit/gamedesign/`.

## The request

An experiment request is a request addressed to the planner: the text asks for an experiment plan, or for a plan of the experimental branch. A feature that is about experiments (an A/B switch, an experiment framework) is an ordinary plan, and so is a description that only contains the word. Everything in `experiment-plan.md` that does not concern cards stays in force: `## Settings`, `## The branch and the base`, `## The plan folder and the closing message`.

## The source

What is left of the request after its wording is stripped is read in this order; the first rule that applies decides.

1. A selector of a card (`EXP-<nnn>`, a path to `experiment.md`, an experiment folder): not this file. The cards go the way of `experiment-plan.md`, and the text beside them is read as the user's constraints.
2. A path to a design research: a folder under `.unikit/gamedesign/researches/`, or its `RESEARCH_RESULT.md` or `RESEARCH_BRIEF.md` → `## Design researches`. A path is a selector: no search and no confirmation line.
3. Words that name a design research — "the latest game-design research", "the research about onboarding", "the last exploration of the economy" → `## Design researches`, with the search and the confirmation.
4. A path to another file, or plain text → `## Other sources`.
5. Nothing. Collect one candidate per kind that exists: the topic of a `/unikit-gd-explore`, `/unikit-gd-brainstorm` or `/unikit-explore` result earlier in this conversation; the card with Status `Ready for Planning` and the latest `Updated:` (the first 25 lines of every `.unikit/gamedesign/experiments/EXP-*/experiment.md`); the latest design research. None → one open question with the question tool of your agent (`AskUserQuestion`), asking what the prototype should test, with no example options invented. One → the confirmation line of `## Design researches`, offering "describe it myself" in place of the other-research option. Several → one question naming each by title and date, at most three, the session first and recommended, otherwise the newest. A card chosen here is a confirmed selector: go the way of `experiment-plan.md`.

The planner builds what the source says and invents no game idea.

## Design researches

**Where they live.** A design research is a folder `.unikit/gamedesign/researches/<slug>/` written by `/unikit-gd-explore`, which owns the format and is not read here. Its record is `RESEARCH_RESULT.md`: a header with the title (`# …`), `Date:`, `Updated:`, `Status:` (`completed`, `in-progress` or `needs-follow-up`) and, for an internal-design research, `Target:` and `Kind:`; the region `## Active Summary` between `<!-- unikit:active-summary:start -->` and `<!-- unikit:active-summary:end -->`; `## Conclusions` with `DEC-<n>` and `RISK-<n>`. `RESEARCH_BRIEF.md` beside it is the brief for the design skills. `researches/INDEX.md` lists the records, newest first.

**Finding.** `Glob` `.unikit/gamedesign/researches/*/RESEARCH_RESULT.md` and read the first 12 lines of each. The folders and the records are the source of truth. A folder with no `RESEARCH_RESULT.md` is not a record; when it holds `SOURCE.md`, print `NOTE [research] <folder> — unfinished exploration: SOURCE.md is there, the record is not.` once. `INDEX.md` is cross-checked last, and only to cross-check: a record it lacks, or a row with no folder, gives one line, `WARN [experiment] researches index out of date — not repaired`. A record that cannot be read is left out with `WARN [experiment] a research could not be read — listed as unreadable`. No record at all: one line saying so, then `## Other sources` for the same words.

**The latest.** The latest design research is the one with the latest Updated line among the completed records; a tie goes to the later `Date:`. A record that is not completed never becomes "the latest" silently: when one is newer than the best completed record, the confirmation line names both and says in words what state the newer one is in (still being written, or waiting for a follow-up).

**By topic.** Compare the words with the title, `Target:`, the `## Topic` section and the `Goal:` line of the Active Summary, a title match first. One match → the confirmation. Several → one question with at most four titles, best first. None → one line saying so, then the titles with their states in words, and no other question.

**The confirmation.** Whatever was found, even one research, the user sees one line before anything else is loaded, because a wrong guess starts a branch of its own: `<title> — <state in words>, updated <date>. Plan an experiment from it?` Options, asked with the question tool of your agent (`AskUserQuestion`), the first recommended: yes · another research (show the titles, ask again) · not a saved research (the words go the way of `## Other sources`).

**A research already tied to a card.** An Active Summary line `Experiment: EXP-<nnn> v<k> — <title>` means the research was grounded on that card. Print `INFO [experiment] <title> is grounded on EXP-<nnn> — planning from the card`, take the card as the selector and go the way of `experiment-plan.md`; the research joins the plan there.

**What is read.** Of the chosen record: the header, `## Active Summary`, `## Conclusions`, and `## Findings` only for the passages a line of the brief rests on. `RESEARCH_BRIEF.md`, when it exists: `Recommended follow-up` and, for an internal-design research, the block `## Improvement Plan`, `## New Feature Plan`, `## Flow Improvement Plan`, `## Flow Feature Plan`, `## Content Improvement Plan` or `## Content Feature Plan` — the best source of what to build. `SOURCE.md` of an ultra research only when the user asks. No record, status or index changes.

## Other sources

- **A description:** the request text, word for word and untranslated, is the source.
- **A file:** read in full; several files are one source. The snapshot keeps the brief and the passages it rests on, not the file.
- **A research of the code store** (`.unikit/code/researches/`, named by path or as "a code research"): read and linked the way Step 0.2 links one (`research_pre_linked = true`, an entry under `## Based on` by `.unikit/system/research-link.md`); its Active Summary is the source of the brief.
- **The session:** the topic and findings of the exploration earlier in this conversation.
- **A link:** a URL is not fetched, because the skill has no tool to load it; ask the user to paste the text.

## The prototype brief

The planner writes the brief from the source, in the fields of `### Prototype brief`: `What is tested` (one sentence, the question the prototype answers), `Must Have`, `Can Be Simplified`, `Out of Scope`, and `How to test` (only what the source states).

- Every line rests on the source. What it does not say is written `not stated`; no gap is filled with a game idea of the planner's own.
- `Out of Scope: not stated` is replaced by "whatever Must Have does not need", so that the prototype has a boundary.
- The minimum is `What is tested` and at least one item of `Must Have`. Short of it, one question (Step 3) with the question tool of your agent (`AskUserQuestion`) names what is missing and asks for it in the user's words; the answer is kept in the block `#### Source · your answer`. Still short → `ERROR [experiment] <source>: nothing to build from — plan not built` and **STOP**.
- A research with nothing buildable in it (a market scan, a dissection of a reference game) gives the question "what should the prototype test?"; the research stays context.
- The request's own constraints (a time box, "only the menu") go into `Must Have` and `Out of Scope` as the user said them.

## The snapshot

The snapshot is taken before any git command, for the reason `experiment-plan.md` → `## The snapshot comes first` gives. Its form is `TASK-FORMAT.md` → `### Experiment context section`, the part for a plan without cards. `Sources:` has one line per source. The Active Summary of a design research is copied as it stands, with no hash and no drift tracking; a code research is linked, not copied.

## What differs from a card plan

- Not applied: `## Checking the cards` (a source has no status; a research that is not completed is named in the confirmation line), `## The snapshot comes first`, `## One plan for a set` (a source is one plan, with no module per card).
- The mode question is the ordinary one of Step 0.2: `fast` and `full`, `full` recommended, ultra only when the user named it. A mode named in the request is not asked again.
- `<topic>` of the branch and of the folder `experiment-<topic>`: a short English name (2-4 words) of what `What is tested` asks.
- Step 4.5 does not run, as for cards. Step 2 runs no topic matching; a code research chosen as the source is read there as a pre-linked one.
- The closing message is the one of `experiment-plan.md`, plus one line: this plan has no card, so what the players show has nothing to be attached to; to keep the record, ask `/unikit-gd-experiment` to write one. The line is printed, not asked, and the planner does not create the card.

## Self-check before saving

(a) One `## Experiment Context` before `## Settings`, `Branch:` and `Base:` in place, no `Cards:`, and `Input:`, `Sources:` and `### Prototype brief` present. (b) Every line of the brief rests on the source or says `not stated`. (c) `What is tested` and `Must Have` are filled. (d) A source named in words was confirmed by one line. (e) There is no `PR checkpoints:` line and no `Measure:` or `Hand-back:` task. (f) The folder is `experiment-<topic>` and the commands name it. A violation is fixed before saving.

Missing or unreadable file → the line of `SKILL.md` (`WARN [experiment] experiment-source reference missing — …`) and an ordinary plan.
