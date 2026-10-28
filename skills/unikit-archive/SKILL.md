---
name: unikit-archive
description: >-
  Archive completed plans. Moves finished folder plans from .unikit/code/plans/<folder>/
  to .unikit/code/archive/plans/<folder>/, so plan lookup and the plan lists stop offering
  them; an unfinished plan moves only when the user picks it, and is marked as unfinished.
  Lists every plan with its created and last-change dates; plans can be picked by number
  or by date. Never deletes, renames or commits. Use when user says "archive plans",
  "archive completed", "archive old plans", "clean up plans", or "show archived plans".
  Not for .unikit/code/PLAN.md or FIX_PLAN.md; to check that a plan is really done use
  /unikit-verify, to commit the move use /unikit-commit.
argument-hint: "[list | --all | <plan-folder>]"
allowed-tools:
  - Read
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

# Plan Archive

Move finished folder plans out of `.unikit/code/plans/` into `.unikit/code/archive/plans/`. Plan lookup in `/unikit-implement`, `/unikit-verify` and `/unikit-improve`, the plan lists and the "latest plan" choice walk `.unikit/code/plans/*/` and nothing else, so an archived plan simply stops being offered — there is no index to update. Nothing is deleted and nothing is committed.

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
| empty | **interactive** — classify every plan, ask which completed ones to archive |
| `list` | **list** — show what is already archived, then stop |
| `--all` | **all** — archive every plan that qualifies, after one confirmation |
| anything else | **one plan** — the named folder; a leading `@` and a leading `.unikit/code/plans/` are stripped first |

`list` or `--all` together with a folder name → `ERROR [archive] conflicting arguments: <args>` and stop.

**Announce the mode first.** Classifying thirty plans takes minutes, and a run that says nothing for that long reads as a hang. Right after the language rules are loaded, the run's **very first output** — before Step 0 and before any other sentence, and not a word about the language or the config — is one or two plain sentences in `language.ui`:

- interactive: `I'll check every plan in .unikit/code/plans/ — how far each one got and what is left to hand over — then ask which completed ones to archive. Nothing moves before you answer.`
- `list`: `Showing the plans already archived.`
- `--all`: `I'll check every plan and archive the completed ones after one confirmation.`
- one plan: `I'll check <folder> and archive it if every task is done.`

**Then say what you are doing, as you do it.** Before each step that reads, runs or writes something, one short line in `language.ui` saying what is happening right now — `Found 30 plan folders — checking each one…`, `Reading the dates from git…`, `Looking for MCP findings that never reached the notes…`, `Moving <folder>…`. One line per step, at the moment it starts: not a plan announced in advance, and not a retelling of what went fine. The per-folder `INFO [archive]` lines of Step 2 are the progress of the longest step.

**What the user must see, print as your own message.** Tool output is folded away from the user: a table, a list or an `INFO [archive]` line that only a command printed never reaches the screen. The table, the lists printed before a question and the summary are printed as your own message, in full — never left in a script's output, never cut down to a one-line summary.

## Protocols

Read `{{skills_dir}}/{{self_name}}/references/plans.md` and follow it from `## Scope` on, in the mode `## Step 1` chose.
