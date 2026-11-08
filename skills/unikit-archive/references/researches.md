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

**Research index.** The `INDEX.md` of a research root is a generated table (an older project has `### title` cards) and only navigates: take `<slug>` only from a link to a direct child of that root and read `<slug>/RESEARCH.md` before acting on a row. No readable index → print `INFO [research-index] <root>: no readable index — searching the folders`, search that root's `*/RESEARCH.md` for the title and header fields, and write nothing.

Verify selected manifests' current fields before acting. R1's plan-link checks and filters still apply.

1. Discover the active catalog (`.unikit/code/researches/`) by the rule above. No research → `Nothing to archive.` and stop this protocol.
2. Use the index fields for the table; do not bulk-read healthy manifests. Recheck selected fields before acting. A folder without a readable `RESEARCH.md` is not offered: `NOTE [archive] <folder> — no RESEARCH.md, not offered` (that includes an unfinished exploration that holds only a `SOURCE.md`).
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
6. **The indexes — once, after the last research of the run**, not after each one.
   Read `{{skills_dir}}/unikit-explore/references/index-render.md` and follow it for
   active and archive, once each after the batch. Print each scope's Kept / Added /
   Removed and its counters as your own message. Missing reference →
   `WARN [research] index-render reference missing — active/archive indexes not re-rendered; run unikit-ai update, then the next authorized archive/restore rebuild repairs both`.
   The move stands. A failed index write names the scope/path; do not claim
   both succeeded. Explore's next save repairs active only. If any move succeeded,
   perform this closing rebuild even before exiting after a later batch error.
   No successful moves (including Cancel) → no hidden rebuild.
7. **Still mentioned** — information only, nothing is edited. For each archived slug: the archived plans and the `completed` plans that link it (`Grep` for `^### <slug>$` over `.unikit/code/archive/plans/*/*.md`, and the R1 hits), the researches whose header says `Supersedes: <slug>`, and one `Grep -F "researches/<slug>"` over `.unikit/` for mentions by path. Print one line per slug that has any: `INFO [archive] <slug> is still mentioned by: <plan folders, researches, paths>` — a plan reaches it by name through the contract, a path does not move.

## R5: Restore

`researches restore [<slug>]`:

- **No slug.** Start with the index of `.unikit/code/archive/researches/` by the
  **Research index** rule of R1. No research there → `Archive is empty — no research has been archived yet.`
  and stop. Otherwise print the full numbered table as your own message:
  `#` · folder · `Archived` · `Status` · `Lifecycle`, latest archived first, then
  ask in the form of R2 — `Restore all <n>` / `Cancel`, row numbers or an Archived
  date rule in the user's own answer.
- **With a slug.** Go straight to the folders of `.unikit/code/archive/researches/`:
  match exact, dated suffix, then partial by R3 item 1, including its partial/ambiguous
  questions (say Restore). Verify the selected archive manifest before moving. Do not
  use active-first linked-reading resolution here: the active folder is a destination collision.

For each research:

1. `.unikit/code/researches/<slug>/` already exists → one research: `ERROR [archive] <slug> already exists in researches/ — rename one of the two folders by hand` and stop; several: `WARN [archive] skipped <slug>: destination exists`. Never overwrite, never rename.
2. Move it back by the rule of R4 item 3, with the archive's paths (`git ls-files -- .unikit/code/archive/researches/<slug>`).
3. Remove its `Archived:` line with one exact edit; no such line → `INFO [archive] <slug>: no Archived line`. `Updated:` does not change.
4. The indexes, as R4 item 6 — once each after the batch, including partial success.
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

Rules of this protocol: nothing is deleted, overwritten, renamed or committed;
edits are the Archived line and both scopes' INDEX.md through the shared writer.
No other research content changes; the folder name stays fixed. A reader of history
never restores implicitly.

## `list`

Called from the router. Read the index of `.unikit/code/archive/researches/` first by
the **Research index** rule of R1. No research there → `Archive is empty — no research has been archived yet.`
Otherwise print every folder's Archived (`—` if absent), Status and Lifecycle,
then `Total: <n> archived researches`. Read-only list never generates an index
or treats a missing index as an empty archive. Recheck selected metadata before use.

## Reserved words

`plans`, `researches`, `restore`, `list` and `--all` as the first word are commands. A research whose folder is named `restore` or `--all` is archived by its row number.
