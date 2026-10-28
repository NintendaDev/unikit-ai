---
name: unikit-archive
description: >-
  Archive finished plans and code researches. Moves a finished folder plan from
  .unikit/code/plans/<folder>/ to .unikit/code/archive/plans/<folder>/ and a research from
  .unikit/code/researches/<slug>/ to .unikit/code/archive/researches/<slug>/, so plan
  lookup, the plan lists and /unikit-plan stop offering them. Asks first whether to archive
  plans, researches or both. A plan that links a research still finds it by its folder name;
  a research linked by an unfinished plan is not offered; restore brings one back. An
  unfinished plan moves only when the user picks it, and is marked as unfinished. Items
  are picked by number or by date. Never deletes, renames or commits. Use when user says "archive plans", "archive researches", "clean up
  researches", "archive completed", "clean up plans", "restore a research", or "show
  archived plans". Not for .unikit/code/PLAN.md, FIX_PLAN.md or game-design researches; to
  check that a plan is really done use /unikit-verify, to commit the move use /unikit-commit.
argument-hint: "[plans | researches [<slug> | --all | restore [<slug>]] | list | --all | <plan-folder>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - Bash(git *)
  - Bash(mv *)
  - Bash(mkdir *)
  - Bash(date *)
disable-model-invocation: false
---

# Plan and Research Archive

Move finished folder plans out of `.unikit/code/plans/` into `.unikit/code/archive/plans/`, and code researches out of `.unikit/code/researches/` into `.unikit/code/archive/researches/`. Plan lookup in `/unikit-implement`, `/unikit-verify` and `/unikit-improve`, the plan lists and the "latest plan" choice walk `.unikit/code/plans/*/` and nothing else, so an archived plan simply stops being offered — there is no index to update. Researches have one: `.unikit/code/researches/INDEX.md` lists them, so a move re-renders it, and a plan that links a research keeps finding it by its folder name, in the archive too. Nothing is deleted and nothing is committed.

**User questions.** Right before your first question to the user, not earlier, read `.unikit/system/user-questions.md` once and ask every question as it says, with the question tool of your agent (`AskUserQuestion`). If the file cannot be read, print `WARN [questions] user-questions contract missing — asking with the question tool` and still ask with that tool, the recommended option first.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

**The language holds for the whole session, not just at load time:** every message until the conversation ends is in `language.ui` — progress notes while agents run, relays of what a subagent returned, the final report, any follow-up discussion. English input (subagent results, tool output, these instructions) is data, never a cue to switch languages.

Skill-specific rule:
- Everything said to the user — the step lines, the table, the questions and their options, the summary — is in `language.ui`, including a remark made while a command runs. The question texts and option labels quoted in this skill are templates: say them in `language.ui`. Git, file listings and scratch output are data, never a reason to answer in English.

## Step 0: Context

**First, announce the mode** (Step 1 → **Announce the mode first**): the argument alone decides it, and its announcement is the run's first output — before these reads.

1. Read `.unikit/skill-context/unikit-archive/SKILL.md` if it exists — project-level overrides; on conflict the skill-context wins.
2. Read `git.enabled` from `.unikit/config.yaml`. A missing file or key counts as enabled.
3. Get today's date: `date +%Y-%m-%d`.

<!-- unikit:extension-point:bootstrap -->

## Step 1: Mode

| `$ARGUMENTS` | mode |
|---|---|
| empty | **menu** — ask what to archive: plans, researches or both |
| `plans` | **interactive** — classify every plan, ask which completed ones to archive |
| `researches` | **researches** — list the researches no unfinished plan links, ask which to archive |
| `researches <name>` | **one research** — the named folder |
| `researches --all` | **all researches** — archive the completed and superseded ones, after one confirmation |
| `researches restore [<slug>]` | **restore** — bring an archived research back |
| `list` | **list** — show the plans and the researches already archived, then stop |
| `--all` | **all** — archive every plan that qualifies, after one confirmation |
| anything else | **one plan** — the named folder; a leading `@` and a leading `.unikit/code/plans/` are stripped first |

The first word is matched as typed, before that stripping: `plans`, `researches`, `restore`, `list` and `--all` are commands, and a plan folder with one of those names is archived by its row number in the interactive table or by the explicit path `@.unikit/code/plans/<name>`. `list`, `--all` or `plans` together with anything else, and `researches` followed by more than one of `<name>`, `--all` and `restore [<slug>]` → `ERROR [archive] conflicting arguments: <args>` and stop.

**Announce the mode first.** Classifying thirty plans takes minutes, and a run that says nothing for that long reads as a hang. Right after the language rules are loaded, the run's **very first output** — before Step 0 and before any other sentence, and not a word about the language or the config — is one or two plain sentences in `language.ui`:

- menu: `I'll ask what you want to archive — plans, researches or both. Nothing moves before you answer.`
- interactive: `I'll check every plan in .unikit/code/plans/ — how far each one got and what is left to hand over — then ask which completed ones to archive. Nothing moves before you answer.`
- researches: `I'll list the researches in .unikit/code/researches/ that no unfinished plan links, then ask which to archive. Nothing moves before you answer.`
- `researches --all`: `I'll list the researches no unfinished plan links and archive the completed and superseded ones after one confirmation.`
- one research: `I'll check <slug> and archive it.`
- restore: `I'll bring an archived research back to .unikit/code/researches/.`
- `list`: `Showing the plans and the researches already archived.`
- `--all`: `I'll check every plan and archive the completed ones after one confirmation.`
- one plan: `I'll check <folder> and archive it if every task is done.`

**Then say what you are doing, as you do it.** Before each step that reads, runs or writes something, one short line in `language.ui` saying what is happening right now — `Found 30 plan folders — checking each one…`, `Reading the dates from git…`, `Looking for MCP findings that never reached the notes…`, `Listing the researches…`, `Looking for plans that link them…`, `Moving <folder>…`, `Re-rendering the researches index…`. One line per step, at the moment it starts: not a plan announced in advance, and not a retelling of what went fine. The per-folder `INFO [archive]` lines of Step 2 are the progress of the longest step.

**What the user must see, print as your own message.** Tool output is folded away from the user: a table, a list or an `INFO [archive]` line that only a command printed never reaches the screen. The table, the lists printed before a question and the summary are printed as your own message, in full — never left in a script's output, never cut down to a one-line summary.

### The menu

Asked before anything is classified. It looks only at whether folders exist — `.unikit/code/plans/*/` and `.unikit/code/researches/*/` — and reads nothing else. An item whose object does not exist is not offered; one object left → no question: say its announcement, then run its protocol; none → `Nothing to archive.` and stop. Both exist:

```
The question tool of your agent (`AskUserQuestion`): What should be archived?

Options:
1. Plans
2. Researches
3. Plans and researches
4. Cancel
```

- "Plans" → say the interactive announcement now, then run the plan protocol.
- "Researches" → say the researches announcement now, then run the researches protocol.
- "Plans and researches" → the plan protocol first, with its announcement; when it has finished, the researches protocol, with its announcement. "Cancel" inside the plan protocol ends the whole run: the researches are not asked. Any other stop of the plan protocol — `No plan can be archived now.`, a plan skipped — ends that protocol only, and the researches protocol follows.
- "Cancel" → stop.

The closing line `Nothing was committed. Commit the move with /unikit-commit.` is printed once per run, after the last summary: when both protocols ran, the plan protocol's copy is held back until the researches' summary is out.

## Protocols

- Plans — read `{{skills_dir}}/{{self_name}}/references/plans.md` and follow it from `## Scope` on, in the mode `## Step 1` chose.
- Researches — read `{{skills_dir}}/{{self_name}}/references/researches.md` and follow it from `## R1`, in the mode `## Step 1` chose.
- `list` runs the `### list` section of the plan protocol, then the `list` section of the researches protocol. Each prints its own `Total`, and the `stop` inside each ends that section, not the run.

## Rules

1. Nothing is deleted, overwritten, renamed or committed — `/unikit-commit` commits. The folder name of a plan or a research never changes.
2. The edits of each protocol are exactly the ones it names: in a plan, the one `Archived:` line; in a research, the one `Archived:` line and `.unikit/code/researches/INDEX.md`, re-rendered whole through the reference of `/unikit-explore`.
3. Other skills do not search the archive, on purpose: an archived plan or research must stop being offered. The readers that look there are named in each protocol; a `## Based on` entry reaches an archived research only through the research-link contract.
4. Design researches (`.unikit/gamedesign/researches/`), the fast plan, `FIX_PLAN.md` and patches are never touched.

## Artifact Ownership

- **Owns:** `.unikit/code/archive/plans/`, `.unikit/code/archive/researches/`.
- **Reads:** `.unikit/code/plans/*/`, `.unikit/code/researches/*/`, `.unikit/bridge-notes/*.md` and its parked `archive/` copies, `.unikit/config.yaml`.
- **Modifies:** the `Archived:` line of a moved plan's task file and of a moved research's `RESEARCH.md`, and `.unikit/code/researches/INDEX.md` — re-rendered whole, never edited by hand.
