# unikit-archive — the researches protocol

> Loaded on demand by `unikit-archive` when researches are archived, restored or listed. Code
> researches only: `.unikit/code/researches/<slug>/` ⇄ `.unikit/code/archive/researches/<slug>/`.
> Design researches (`.unikit/gamedesign/researches/`) are never touched — `GD-IDS.yaml`,
> `RECON.md` and experiment cards point at them by path, and code does not write design. The
> steps are numbered R1…R6 so they never meet the `Step 2…4` of the plan protocol in
> `{{skills_dir}}/{{self_name}}/references/plans.md`; Step 0 (context) and Step 1 (mode) stay in `SKILL.md`.

## What moves, and what does not change

A research is a folder `.unikit/code/researches/<slug>/` with a `RESEARCH.md`. Archiving moves the whole folder to `.unikit/code/archive/researches/<slug>/`; restoring moves it back.

**The folder name never changes.** A plan links a research by that name, not by a path, and every reader that resolves an entry looks in `researches/` first and in `archive/researches/` second (`.unikit/system/research-link.md` → `## Finding the folder`). That is why no plan, open or archived, is edited by the move, and why the Active Summary and its `Summary SHA256` stay exactly as they were.

## R1: List what can be archived

Reads, never writes.

1. List `.unikit/code/researches/*/`. No folder → `Nothing to archive.` and stop this protocol.
2. One `Grep` for `^(Status|Lifecycle|Updated):` over `.unikit/code/researches/*/RESEARCH.md` gives the row data — take the first match of each key in a file. A folder without a readable `RESEARCH.md` is not offered: `NOTE [archive] <folder> — no RESEARCH.md, not offered` (that includes an unfinished exploration that holds only a `SOURCE.md`).
3. **Which plans link them.** One `Grep` for `^### (<slug>|<slug>|…)$`, in batches of at most 40 slugs (regex characters escaped), over `.unikit/code/plans/*/*.md` and `.unikit/code/PLAN.md`. A hit is a link only when its line stands inside the `## Based on` section of that file — from that heading to the next `## ` heading. Classify each plan that has a hit by items 1–4 of Step 2 in `{{skills_dir}}/{{self_name}}/references/plans.md` — the task file, the scope, the checkbox lines, the verdict — and by nothing else: no dates, no follow-ups, no git. The fast plan `.unikit/code/PLAN.md` goes through the same rule. A plan that is `incomplete` blocks the research it links; a `completed`, `empty` or `broken bundle` plan does not, and neither does any plan in `.unikit/code/archive/plans/`.
4. Print the table as your own message: `#` · folder · `Status` · `Lifecycle` · `Updated` (the date), the oldest `Updated` first. Under it, one line per hidden research and plan: `hidden <k>: <slug> — plan <folder>` (none hidden → no line). Then `INFO [archive] researches: <n> folders, <l> listed, <h> hidden by an unfinished plan`.
5. Every research hidden → `No research can be archived now.` and the hidden lines; stop this protocol.

## R2: Ask

Only once the whole table is on screen — the user names rows by `#`, and without the table the user chooses blind.

Under the table, in the same message, one line: `To choose yourself, write row numbers (3, 5-7) or a date rule (updated on or before 2026-09-01) in your own answer.`

```
The question tool of your agent (`AskUserQuestion`): Archive which researches?

Options:
1. All <n> — the completed and superseded ones
2. Cancel
```

`<n>` counts the rows with `Status: completed` or `Lifecycle: superseded`; every other row — the `in-progress`, `needs-follow-up` and `paused` ones — is chosen by number. With `<n>` = 0 the first option reads `All <m> in the list — unfinished ones included`: a question never has one option.

There is no option for typing a choice and no second question for it: what the user writes in their own answer is the choice, read as row numbers or as a date rule on the `Updated` column, the given day included. Print the folders the answer selects before anything moves. An answer that is neither → say what was not understood and ask this question again. A chosen research that is not completed or superseded moves like any other, with no extra question: its `Status` and `Lifecycle` stay in the header as they were.

**`researches --all`** prints the same list and asks one question instead: `Archive all <n> researches?` — `Yes, archive all <n>` / `Cancel`, over the same set as the button (the `<m>` wording when `<n>` = 0).

## R3: One research

`researches <name>`:

1. Resolve `<name>` inside `.unikit/code/researches/`: an exact folder name; else the one folder ending in `_<name>` (a folder dated `YYYY-MM-DD_`); else the one folder whose name contains `<name>` — a match by this last rule is confirmed before anything moves (ask with the question tool of your agent (`AskUserQuestion`): `Archive <matched folder>?` — `Yes` / `Cancel`). None → `Research not found: <name>` — with `(already archived)` added when `.unikit/code/archive/researches/<name>/` exists — and stop. More than one → list them and ask which one with the question tool of your agent (`AskUserQuestion`) — the matching folders are the options, the user writes a more specific name in the free-text answer — then resolve the answer by this step.
2. No readable `RESEARCH.md` → `NOTE [archive] <folder> — no RESEARCH.md, not archived` and stop.
3. Look for the plans that link it, as R1 item 3 does, for this one slug. An `incomplete` plan links it → name the plan and ask with the question tool of your agent (`AskUserQuestion`): `Archive <slug> although <folder> still links it?` — `Yes` / `Cancel`. This is the one way past the list's condition, and it is deliberate. Not linked → no question.
4. Archive it (R4).

## R4: Archive one research

1. **Destination** `.unikit/code/archive/researches/<slug>/`. It already exists → one research: `ERROR [archive] <slug> is already in the archive — rename one of the two folders by hand` and stop; several: `WARN [archive] skipped <slug>: destination exists` and go on. Never overwrite, never rename.
2. `mkdir -p .unikit/code/archive/researches`
3. **Move.** The same rule as the plan protocol (Step 4 item 3 of `{{skills_dir}}/{{self_name}}/references/plans.md`), with the research's paths: `git mv` only when `git.enabled` is not `false`, `git rev-parse --is-inside-work-tree` succeeds and `git ls-files -- .unikit/code/researches/<slug>` prints at least one path; otherwise `mv`. Print which one and why: `INFO [archive] <slug>: git mv (tracked)` or `INFO [archive] <slug>: mv (git disabled | not a git work tree | untracked)`. A move that fails → `ERROR [archive] <slug>: <the command's error>`, then stop (one research) or skip it (several); never retry with the other command.
4. **Label.** In the moved `RESEARCH.md`, insert one line `Archived: <today>` (`date +%Y-%m-%d`) directly below `Updated:`; no `Updated:` → below `Created:`; neither → below the `# ` title line, after a blank line. Change nothing else: `Updated:` stays, the Active Summary and its two markers are not touched (its hash is the one the plans recorded), and the mode marker stays the first line when there is one.
5. Print `INFO [archive] archived: .unikit/code/researches/<slug> → .unikit/code/archive/researches/<slug>`.
6. **The index — once, after the last research of the run**, not after each one. Read `{{skills_dir}}/unikit-explore/references/index-render.md` and follow it: it re-renders `.unikit/code/researches/INDEX.md` whole from the folders on disk, so the moved researches drop out. Print its summary (`Kept` / `Added` / `Removed`) as your own message. The file cannot be read (`/unikit-explore` is not installed) → `WARN [research] index-render reference missing — researches/INDEX.md was not re-rendered; the next save in /unikit-explore does it`. The move stands.
7. **Still mentioned** — information only, nothing is edited. For each archived slug: the archived plans and the `completed` plans that link it (`Grep` for `^### <slug>$` over `.unikit/code/archive/plans/*/*.md`, and the R1 hits), the researches whose header says `Supersedes: <slug>`, and one `Grep -F "researches/<slug>"` over `.unikit/` for mentions by path. Print one line per slug that has any: `INFO [archive] <slug> is still mentioned by: <plan folders, researches, paths>` — a plan reaches it by name through the contract, a path does not move.

## R5: Restore

`researches restore [<slug>]`:

- **No slug.** `Glob` `.unikit/code/archive/researches/*/`. None → `Archive is empty — no research has been archived yet.` and stop. Otherwise print a table as your own message: `#` · folder · `Archived` · `Status` · `Lifecycle`, the latest archived first, then ask in the form of R2 — `Restore all <n>` / `Cancel`, row numbers or a date rule on the `Archived` column in the user's own answer.
- **With a slug.** Resolve it inside the archive by the rules of R3 item 1, and restore it at once.

For each research:

1. `.unikit/code/researches/<slug>/` already exists → one research: `ERROR [archive] <slug> already exists in researches/ — rename one of the two folders by hand` and stop; several: `WARN [archive] skipped <slug>: destination exists`. Never overwrite, never rename.
2. Move it back by the rule of R4 item 3, with the archive's paths (`git ls-files -- .unikit/code/archive/researches/<slug>`).
3. Remove its `Archived:` line with one exact edit; no such line → `INFO [archive] <slug>: no Archived line`. `Updated:` does not change.
4. The index, as R4 item 6 — once, after the last research.
5. Print `INFO [archive] restored: .unikit/code/archive/researches/<slug> → .unikit/code/researches/<slug>`.

## R6: Summary and rules

After the last research:

```
Archived <n> research(es) to .unikit/code/archive/researches/:
  - <slug>
Skipped <k>:
  - <slug> — <reason>
Researches left in .unikit/code/researches/: <m>

Nothing was committed. Commit the move with /unikit-commit.
```

For a restore: `Restored <n> research(es) to .unikit/code/researches/:`. Omit `Skipped` when `<k>` is 0.

Rules of this protocol: nothing is deleted, overwritten, renamed or committed; the only edits are the `Archived:` line of a `RESEARCH.md` and `researches/INDEX.md`, re-rendered through the reference of `/unikit-explore`; the folder name never changes, because a plan finds its research by it. Of the readers, only those that go through the research-link contract look in the archive for a research.

## `list`

Called from the router. `Glob` `.unikit/code/archive/researches/*/`. None → `Archive is empty — no research has been archived yet.` Otherwise print each folder with the date of its `Archived:` line (`—` when the line is missing), its `Status` and its `Lifecycle`, then `Total: <n> archived researches`.

## Reserved words

`plans`, `researches`, `restore`, `list` and `--all` as the first word are commands. A research whose folder is named `restore` or `--all` is archived by its row number.
