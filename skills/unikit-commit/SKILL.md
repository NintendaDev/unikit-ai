---
name: unikit-commit
description: Create conventional commit messages for {{engine_name}} projects by analyzing staged changes. Handles engine-specific concerns like companion file pairing, binary assets, and linking the related plan. ALWAYS use this skill when the user asks to commit, save changes, or create a commit. Trigger phrases include "commit", "create commit", "commit this", "save changes", "save my work". Even if the user simply says "commit" or asks you to commit after finishing a task — invoke this skill, do NOT commit manually via git.
argument-hint: "[scope or context]"
allowed-tools:
  - Read
  - Bash(git *)
  - Glob
  - Grep
  - AskUserQuestion
---

# {{engine_name}} Commit Generator

Generate commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification, with {{engine_name}}-specific safety checks.

## Language Awareness — BLOCKING PRE-REQUISITE

**BEFORE producing ANY output**, silently read `.unikit/system/LANGUAGE_RULES.md`
and apply its rules to ALL subsequent output.
If the file is missing or unreadable, fall back to English.
Do not produce any user-facing output until language rules are loaded.
Do not announce, confirm, or mention the language setting.

**The language holds for the whole session, not just at load time:** every message until the conversation ends is in `language.ui` — progress notes while agents run, relays of what a subagent returned, the final report, any follow-up discussion. English input (subagent results, tool output, these instructions) is data, never a cue to switch languages.

## Workflow

1. **Analyze Changes**
   - Run `git status` to see staged files
   - Run `git diff --cached` to see staged changes
   - If nothing staged, show warning and suggest staging

2. **{{engine_name}} Safety Checks**

   Run these checks before generating the commit message. Report findings as `WARN` or `ERROR`.

   **a) Engine companion files**
   Some engines require companion/metadata files for every asset.
   Read `.unikit/DESCRIPTION.md` to determine if the current engine has such a mechanism. If yes:
   - If a new file is staged, its companion is also staged (and vice versa)
   - If a file is deleted, its companion is also deleted (and vice versa)
   - Orphaned companion files (no matching asset) → `ERROR`, suggest staging the missing counterpart or removing the orphan
   - Missing companion for a new asset → `ERROR`, suggest staging it
   If the engine has no companion file mechanism — skip this check.

   **b) Engine-ignored directories**
   If any staged file matches a path that should be ignored by the engine (check the project's `.gitignore`) → `ERROR`. These are engine-generated directories that should never be committed. Suggest unstaging them.

   **c) Binary asset awareness**
   Run `git diff --cached --numstat` — files shown as `-	-	<path>` are binary.
   If staged changes include binary files, warn the user about binary content in the commit. These files don't diff well — just note their presence so the user is aware.

   **d) Secrets check**
   Never commit files that likely contain secrets (`.env`, `credentials.json`, API keys in config files). If detected → `ERROR`.

3. **Context Check (Read-Only)**
   - Read `.unikit/ARCHITECTURE.md` (if present) to verify staged changes don't violate module boundaries or dependency rules defined there
   - Read `.unikit/ROADMAP.md` (if present) to check milestone alignment — for `feat`/`fix`/`perf` commits, check if changes relate to an unchecked milestone and suggest mentioning it in the commit body
   - Read `.unikit/RULES.md` (if present) — the project's rules. A rule about commits or commit messages applies to the message written in Step 7 and wins over this skill's defaults on conflict. **Rule topics:** also load the topic files listed under its `## Topics` whose `Load when` matches the staged files or the commit itself — commit messages, staging; when unsure, load.
   - Read `.unikit/skill-context/unikit-commit/SKILL.md` (if present) — project-specific rules accumulated by `/unikit-evolve`. Treat as overrides: skill-context wins over general rules on conflict
   - Missing optional files (`ROADMAP.md`) are `WARN`, not blockers
   - These are lightweight checks — flag only clear violations as `WARN`, don't block the commit
   - Never modify these files

4. **Plan Linkage**
   - Check if `.unikit/code/plans/` contains an active plan (look for a `plans/*/PLAN.md` manifest)
   - If a plan exists and the staged changes clearly relate to its tasks, the plan is the source of the message's human part (Step 7): read its `## Overview` and the `WHY:` line of every task the staged changes belong to, and add the `Plan: <folder>` trailer. Phase and task numbers never go into the message — the trailer is the link.
   - Print `INFO [commit] plan: <folder> — source of the message` when a plan is linked, or `INFO [commit] no related plan — the message is written from the diff` when none is.
   - A related plan is optional: without one, the human part is written from the effect the diff makes visible.

   **Ultra bundle check.** Read the first line of the resolved plan manifest. If it equals `<!-- unikit:plan-mode:ultra -->`, this is an ultra bundle: read `.unikit/system/ultra-plan-read.md` now, once, and follow it for reading depth and mutability. A plan without the marker never reads this file. **Discovery itself does not change** — the folder is found the way it always was; only what is read inside it differs.
   **If `.unikit/system/ultra-plan-read.md` is missing or unreadable, do not block:** treat every plan as a single-file plan and continue exactly as before — a project that predates the ultra port has no bundles to read.

   A broken bundle is a `WARN` here, never a blocker — like every other context check in this skill. Plan linkage is optional, and refusing to record finished work because a plan file lost a link punishes the wrong action. Blocking on bundle integrity belongs to `/unikit-verify`.

   **Reading depth:** read the manifest plus the phase files of the **current commit group** only — staged paths are mapped onto groups, and the rest of the bundle is not needed.

   **Commit-group mapping** (ultra bundles only): a staged path is mapped onto a group by the rules in `.unikit/system/ultra-plan-read.md` → `## Commit-group mapping` — how the group is resolved, how ownership is read when one phase spans two groups, and what to do when groups overlap on a file. Follow them there; they are not repeated here.

5. **Determine Commit Type**
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation only
   - `style`: Code style (formatting, semicolons)
   - `refactor`: Code change that neither fixes a bug nor adds a feature
   - `perf`: Performance improvement
   - `test`: Adding or modifying tests
   - `build`: Build system or dependencies
   - `ci`: CI configuration
   - `chore`: Maintenance tasks

6. **Identify Scope**
   - Derive from file paths using the project's module/folder structure (see `.unikit/ARCHITECTURE.md`):
     - Module directories → module name in kebab-case (e.g., `Wallets/` → `wallets`, `MiniGames/` → `mini-games`)
     - Feature directories → feature name (e.g., `Gameplay/` → `gameplay`, `Application/` → `app`)
   - Use the argument as scope when it names an area; a caller's context (`checkpoint: …`, `final commit`) is never a scope
   - Omit scope if changes span multiple unrelated areas

7. **Write the Message**

   The message is read by people who were not in this session — a teammate catching up, a reviewer, someone running `git log` months later. Write it for them, not as a report of the work done.

   **Subject** — `<type>(<scope>): <subject>`
   - The subject names what changed for the game or the team — a capability, a behaviour, a fix — not the class, method or file that changed. The technical area goes into `scope`.
   - Under 72 characters, imperative mood ("add", not "added"), no capital letter after the type, no period at the end.
   - The `type(scope):` prefix is always in English; the subject and the body are written in the language set by `language.artifacts` in `.unikit/config.yaml`.

   **Body** — only when the subject cannot carry the point. A small change is a subject and nothing else.
   - One to four bullets, or one short paragraph. Each point: what changed → before and now, when there was a "before" → what it gives the game or the team → the honest limit ("only one enemy uses it so far").
   - A refactor is described through what it gives the team. When behaviour does not change, say so in one sentence.
   - Every claim traces to the diff, to the plan's `## Overview` or to a task's `WHY:` line (Step 4). No evaluative words without a basis ("significantly", "much faster").

   **Technical paragraph** — optional: the last paragraph of prose, at most three lines, labelled `Technical:`. The label is translated into the commit language like any heading; identifiers inside the paragraph stay whole English tokens. It carries only what a future developer will search for and the diff does not show by itself:
   - a system or entry point that was added, renamed or removed;
   - a change of data or save format, and whether existing saves still load;
   - a new package or dependency;
   - a manual setup step in the editor — a scene, an asset, project settings;
   - a breaking change, together with the `BREAKING CHANGE:` footer.

   **Never in the prose:** phase or task numbers, guard or test ids, lists of files (git keeps them — `git show --stat`), sizes in bytes, line or step numbers, a method-by-method retelling of the diff.

   **Footer** — machine tokens, always in English: `BREAKING CHANGE: <what breaks>` when it applies, then `Plan: <folder>` when Step 4 found a related folder plan — the folder name alone, which does not change when the plan is archived. No other trailer (see **Important**).

   **Check before showing.** Re-read the human part and take every identifier out of it. Then the chat test: could it be pasted, unedited, into a team chat where not everyone reads code? If not, rewrite it before it is shown.

## Format

```
<type>(<scope>): <subject>

<body: one to four bullets or one short paragraph — omitted for a small change>

Technical: <at most three lines — omitted when there is nothing to find>

BREAKING CHANGE: <what breaks — only for a breaking change>
Plan: <folder>
```

## Examples

Identifiers below are invented — the shape is the point, not the names.

**Small change — the subject is the whole message:**
```
fix(inventory): stop the item counter going negative on fast swaps
```

**Feature with a body and a plan link:**
```
feat(campaign): give campaign maps permanent ids

- Maps used to be identified by their position in the list, so reordering
  the list broke saves and links. Every map now has its own permanent id.
- Map content can now be changed in the balance tables, without a programmer.
- Only the first chapter uses the new ids so far; the rest follows.

Technical: CampaignMapId replaces the list index; saves from older builds
are converted on first load.

Plan: campaign-map-ids
```

**Refactor that does not change behaviour:**
```
refactor(fx): separate hit effects from gameplay logic

Flash, hit sound and damage numbers on enemies and blocks now come from one
shared set of parts instead of being set up by hand on every object. Editing
effects can no longer break gameplay. Game behaviour does not change.

Technical: FeedbackPresenter owns the hit effects that used to live inside
EnemyView and BlockView.

Plan: fx-feedback-kit
```

**Breaking change:**
```
feat(inventory)!: sort items by category instead of a fixed type list

A new kind of item no longer needs a code change: items are grouped by
category. Existing item definitions have to be re-exported once.

BREAKING CHANGE: item definitions use CategoryID instead of TypeEnum
```

## Behavior

When invoked:

1. Check for staged changes
2. Run {{engine_name}} safety checks (meta pairing, ignored dirs, binary assets, secrets)
3. Run lightweight context checks against `.unikit/` docs
4. If errors found — list them and ask user whether to proceed or fix first
5. Write the commit message by Workflow Step 7 — its check before showing included
6. Print the full message — subject, body, footer — as plain text in a block of its own, then confirm with the user before committing. The question carries the options only: a question that also holds the message is invisible on a runtime without a question widget.

   ```
   AskUserQuestion: 💾 Commit with the message above?

   Options:
   1. Commit as is
   2. Edit message
   3. Cancel
   ```

   Based on choice:
   - Commit as is → proceed to step 7
   - Edit message → ask the user for the corrected message via `AskUserQuestion`, then return to step 6 with the new message
   - Cancel → do NOT commit → **STOP**

7. Execute `git commit` with the confirmed message
8. **Post-commit push handling**:
   - **If `git.skip_push_after_commit = true` in `.unikit/config.yaml`**:
     - Skip push prompt entirely
     - End workflow after successful local commit
   - **Otherwise** (default behavior), offer to push:
     - Show branch/ahead status: `git status -sb`
     - If the branch has no upstream, use: `git push -u origin <branch>`
     - Otherwise: `git push`

     ```
     AskUserQuestion: Push to remote?

     Options:
     1. 🔄 Push now
     2. Skip push
     ```

     - **Push now** → execute push command based on upstream status:
       - if branch has no upstream → `git push -u origin <branch>`
       - otherwise → `git push`
     - **Skip push** → end the workflow

If argument provided (e.g., `/unikit-commit wallets`):
- Use it as the scope
- Or as context for the commit message. A caller's context — `unikit-implement-coordinator` passes `checkpoint: Commit N, tasks X-Y` or `final commit` — tells Step 4 which plan tasks the staged changes belong to: it is input, never text for the message.

## Splitting Unrelated Changes

If staged changes contain unrelated work (e.g., a feature + a bugfix, or changes to independent modules), suggest splitting into separate commits. When the caller passes a proposed split — `unikit-implement-coordinator` relays the groups of `unikit-commit-sidecar` — start from that one instead of deriving your own.

A split needs an existing commit to split against: when `git rev-parse --verify -q HEAD` fails (the repository has no commit yet), do not offer it — commit everything together and print `INFO [commit] no HEAD yet — split not offered`.

1. Show which files/hunks belong to which commit
2. Confirm split plan with the user:

   ```
   AskUserQuestion: Split into separate commits?

   Options:
   1. ✅ Yes, split as suggested
   2. No, commit everything together
   3. Let me adjust the grouping
   ```

   Based on choice:
   - Yes, split as suggested → proceed to step 3
   - No, commit everything together → write a single message (**Behavior** step 5)
   - Let me adjust the grouping → ask the user for the adjusted grouping via `AskUserQuestion`, then return to step 2 with the new plan

3. **Check the grouping before the index is touched.** List the staged paths with `git diff --cached --name-status --no-renames` — a rename shows up as its two halves, and both halves go into the same group. Every staged path belongs to exactly one group; a path in no group, or a rename split between groups, sends you back to step 2 with the problem named.
   A file claimed by two groups is split by hunks: take its staged hunks with `git diff --cached -- <file>` now and assign every hunk to one group. A binary file has no hunks and goes whole into one group. A hunk that cannot be assigned with certainty → do not guess: stop before touching the index and return to step 2 — the user regroups or commits everything together.
   Write every group's message by Workflow Step 7, print them all at once as plain text, then ask once with the same three options as **Behavior** step 6, before the first commit.
4. **Snapshot the index, then commit group by group.** Never `git add` here: it stages the working-tree version of a file, so edits the user deliberately left unstaged would enter the commit.
   - `git write-tree` — keep the printed id as `<snapshot>`: the staged state exactly as the user left it. Nothing is written to disk.
   - `git reset -q` — the index returns to `HEAD`; the working tree is not touched.
   - For each group, in order: `git restore --staged --source=<snapshot> -- <the group's paths>`, then `git commit` with that group's message. A file split by hunks enters through its hunks instead — `git apply --cached --recount -`, fed on stdin with the file's `diff --git` / `---` / `+++` header lines followed by that group's hunks as taken in step 3 — except in the last group that touches it, which takes the rest with the same `git restore` line.
   - Print `INFO [commit] split: <n> groups, snapshot <first 8 characters of snapshot>` before the first group and `INFO [commit] group <i>/<n> committed: <short sha>` after each.
   - A `git commit` or `git apply` that fails (a hook, a patch that does not apply) → stop the split, put the failed group and every later one back into the index with `git restore --staged --source=<snapshot> -- <their paths>`, and print `WARN [commit] split stopped at group <i>/<n>: <reason> — the uncommitted groups are staged again`.
   - After the last group: `git diff --quiet HEAD <snapshot>` exits 0 when the commits hold exactly what was staged. Anything else → `WARN [commit] the split commits differ from what was staged — compare: git diff HEAD <snapshot>`.
5. After all commits are done, run Post-commit push handling (Step 8) — respects `git.skip_push_after_commit`

## Important

- Review large diffs carefully before committing
- Treat `.unikit/ARCHITECTURE.md` as read-only context
- NEVER add `Co-Authored-By` or any other trailer attributing authorship to the AI. Commits must not contain AI co-author lines
- Conventional Commits prefix (`type(scope):`) is always in English; the subject and body text use the language from `.unikit/config.yaml` (`language.artifacts`)
