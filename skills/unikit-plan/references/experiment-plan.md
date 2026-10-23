# Experiment plan — a plan built from experiment cards

Read **only** when the input is an experiment: `EXP-<nnn>`, a path to an `experiment.md` card, an experiment folder, or a set of them. An ordinary plan does not read this file. The planner builds **one** plan of a disposable prototype from the cards and adds no phase, no task kind and no check: the plan is an ordinary plan plus the section `## Experiment Context`, whose grammar belongs to `{{skills_dir}}/{{self_name}}/references/TASK-FORMAT.md` → `### Experiment context section` and is not repeated here. Executors recognise the plan by that section and read the prototype profile (`.unikit/system/prototype-profile.md`), which this file does not own. The planner does not redesign the game idea: it builds what the cards say.

## Resolving the input

- The selector is `EXP-<nnn>` (`Glob` `.unikit/gamedesign/experiments/EXP-<nnn>-*` — exactly one folder), a path to `experiment.md`, an experiment folder, or several of them in one request. The word "experiment" in free text is not a selector: otherwise any "A/B experiment" mentioned in code would start this branch. Cards given together with free text: the cards are the input, the text is read as the user's constraints.
- A request that names a card by its description — "the latest experiment", "the experiment about onboarding" — is resolved first through `{{skills_dir}}/unikit-gd-experiment/references/lookup.md`, read only for such a request and only when the store holds a card: the card the user confirms is the selector from here on, and everything below works as for `EXP-<nnn>`. The lookup finds a card; whether it may be planned is decided by `## Checking the cards`.
- A card is not found → `ERROR [experiment] <selector>: no such card — plan not built; see /unikit-gd-experiment` and **STOP**. Two folders with one number → the same, with the explanation (the experiment skill blocks such numbers).
- Every `experiment.md` is read **in full**. `feedback.md` and `results.md` are not read unless the user asks. The experiments store is never written.
- The plan description comes from the cards: the search over `researches/INDEX.md` (Step 0.2) does not run. Step 4.5 does not run: a plan of an experiment has no `## Design`, `## Flow Context` or `## Content Context`, and a prototype does not feed `implemented_version`. Step 2 does not match researches by topic either: a research reaches the plan only by an `Experiment:` line, see `## The snapshot comes first`.

## Checking the cards

- Status `Ready for Planning` → goes on. `Draft` → that card goes back to its author: "<title> is a draft: <what the readiness checklist lacks> — finish it with /unikit-gd-experiment"; the rest go on (one question: continue with the ready ones · stop).
- Statuses `In Development`, `Ready for Testing`, `Testing`, `Evaluated`, `Archived` → one question: plan it again? (recommended: no).
- No card left → **STOP**. The `Version` of every card goes into the snapshot.

## The snapshot comes first

Order matters here: the snapshot is taken before any git command, because on a new branch cut from the base the card file may be missing, and the executor reads no cards. Cards stay where they were saved: the planner neither moves them between branches nor copies them whole into the plan, and the evaluation (the experiment skill) reads the files of the working tree — where it runs is told by `{{skills_dir}}/unikit-gd-experiment/references/planning-handoff.md`. The content of the snapshot follows `TASK-FORMAT.md` → `### Experiment context section`; a path without the content is not a snapshot.

**Researches of a card.** A research belongs to a card only when its Active Summary (between the `## Active Summary` markers) holds a line `Experiment: EXP-<nnn> v<k> — <title>` with that card's number; the topic is never guessed. Search both stores, one `Grep` each — `.unikit/code/researches/*/RESEARCH.md` and `.unikit/gamedesign/researches/*/RESEARCH_RESULT.md` — for `^Experiment: EXP-<nnn> v`; a hit outside the markers does not count. A research of the code store is linked as Step 2 links one: `research_linked = true`, an entry under `## Based on` hashed by `.unikit/system/research-link.md`. A research of the design store is not read by that contract: its Active Summary is copied as it stands into the block of its card in `## Experiment Context`, with no hash and no drift tracking. When `v<k>` is older than the card's `Version`, print `WARN [experiment] <folder> was written against v<k> of the card, now v<n> — it may describe an older test`; the research is still used.

**No research names the card.** Nothing is linked by topic, and the miss is not silent. One more `Grep -l -i` per store, over the header and the Active Summary, looks for the card's `EXP-<nnn>` and its title as fixed strings; the hits are candidates. Candidates → one question with the question tool of your agent (`AskUserQuestion`), at most four, each with its `Updated:`: `Link <title>` (recommended only for a single candidate that holds the number) · `None`; a confirmed one is linked as above. No candidate → `INFO [experiment] <title>: no research names this card — planned from the card alone` and go on.

## The mode question

- `fast`, `full` and `ultra` are shown (`add` extends an existing plan and does not take part in the creation question). One card — `full` is recommended. Two or more — ultra is recommended for a set of two or more cards, because there are several independent game slices and one shared launch; `full` second, `fast` third. The choice is the user's; a mode the user named (a leading word or in their wording) outranks the recommendation, and then the question is not asked.
- Before the question, print (as a message, not tool output) the number of cards and their titles.

## Settings

The questions of Step C of the mode (tests, documentation, milestone, extra requirements) and of Step A of fast are **not asked**. Written: `Testing: no`, `Docs: no`. An explicit request in the user's words for tests or documentation is kept: "with tests" → `Testing: yes` with all the ordinary mechanics of the mode (`Test checkpoints` by the config policy). `PR checkpoints`: `pr_checkpoints = false`, `git.pull_requests.checkpoints` is not read, no PR checkpoint task is written, and the line `PR checkpoints:` is absent. `## Roadmap Linkage`: `Milestone: "none"` and `Rationale: "Experiment plan"` — there is no milestone binding. The editor mode (`Editor tasks`) resolves by the rules of the mode, unchanged: it is not a user preference.

## The branch and the base

This replaces `### Step A` of full and ultra; fast gets the same mechanics.

- The key is `git.experiment_branch_prefix` of `.unikit/config.yaml`; a missing file or key, or an empty value, defaults to experiment/ silently.
- The branch name is `<prefix><YYYY-MM-DD>-<topic>` (the date is today, `Bash(date *)`); `<topic>` is English kebab-case up to 40 characters: for one card its slug without the number (`timer-variant`), for a set a short name of what the set tests (2-4 words). The base: `--base` > `git.base_branch` > `main` (the chain of Step 0.1).
- `git.enabled = false` or `git.create_branches = false` → no question and no branch: the section gets `Branch: none` and `Base: none`; the user's settings are stronger.
- `--base <branch>` → no question, the branch is created (the flag implies intent; the general rule of step A).
- Otherwise in `full` and `ultra` the question "Create a branch for this experiment plan?" is asked **always**: full and ultra always ask, even on an experiment branch. Options: `1.` Yes — create `<name>` from `<base>` (recommended) · `2.` No — stay on the current branch.
- Yes → `git checkout <base>`, `git pull origin <base>` (an error — warn and go on from the local state), `git checkout -b <name>`; the branch exists → ask "switch or another name". The section gets `Branch: <name>`, `Base: <base>`. No → `Branch: <current branch>`, `Base: none`.
- `fast`: when the current branch starts with the experiment prefix, do not ask and do not create (`Branch: <current>`, `Base: none`); otherwise the same question and mechanics (recommended: yes). For an experiment plan this replaces the rule "fast creates no branch".
- Every git command is a separate Bash call (project rule: commands are not chained).

## The plan folder and the closing message

- `fast` writes `.unikit/code/PLAN.md`; `full` and `ultra` write the folder `.unikit/code/plans/experiment-<topic>/` (literally `experiment-<topic>`, without a date). This name replaces "invent a name" of Step 1; the collision check of Step 1 for `full` and `ultra` works unchanged. `fast` skips the collision check, so this file asks: `.unikit/code/PLAN.md` exists and holds `- [ ]` → ask with the question tool of your agent (`AskUserQuestion`): overwrite or take `full`.
- The branch name carries a date and the folder name does not, so the executors (`/unikit-implement` and its coordinator, `/unikit-verify`, `/unikit-improve`, `add`) find the plan by its own record, not by name: the `Branch:` line of its `## Experiment Context`, when `Base:` is not `none`. The closing message (Step 6) still names the folder: `full` and `ultra` — `/unikit-implement experiment-<topic>`, and the verify command and the others with the same folder name; `fast` — `/unikit-implement` (a fast plan is found first by auto-detection). The plan's branch and base are named in the message.

## One plan for a set

A set is one plan. A shared entry (a menu or a mode switch), when several cards need it, is planned once; then one module per experiment, so that any can be removed independently (`fast` has no modules). A shared launch of the set is a recommendation of the planner, not a requirement of a card. The `Out of Scope` of each card is the boundary of its prototype and goes into `### OUT OF SCOPE` of `## Technical Context`. The `WHY:` of a task names the hypothesis of its card. The implementation (files, symbols) is found by the planner itself in Step 4 — a card holds no pointers into the code.

## What the planner does not do

It adds no acceptance phases, no task kinds (`Measure:`, `Item:` and `Hand-back:` are not written here), no checks and no steps; it does not redesign the game idea; it reads no feedback and no results; it writes nothing to the store; it sets no card status; it prints no text of the profile — only the section and the executors refer to it; it creates no PR tasks and no milestone binding.

## Self-check before saving

(a) The manifest has exactly one `## Experiment Context` section before `## Settings`, the lines `Branch:` and `Base:` are in place, and every card has the snapshot of sections 2-11. (b) `Testing` and `Docs` follow `## Settings`. (c) There is no `PR checkpoints:` line and no `Hand-back:` or `Measure:` task. (d) The mode question was shown. (e) The folder name is `experiment-<topic>`. (f) The commands name the folder. (g) A card the user named in words was confirmed through the lookup before anything of it was read. (h) A research was linked to a card only by its `Experiment:` line or by the user's answer to the candidate question. A violation is fixed before saving.

Missing or unreadable file → the line of `SKILL.md` (`WARN [experiment] experiment-plan reference missing — …`) and an ordinary plan.
