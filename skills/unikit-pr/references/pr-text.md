# Pull request text

Read at Step 2, every run. The text is written in `language.artifacts`; the examples below are in English only to show the form.

## Title

What the game or the team gets, in one phrase. A pull request of one module takes that module's name, in plain words.

## Body

- One feature per line. Each line says what can now be done, or what changed for the player or for the team — no class names, no paths, no formulas.
- With several modules, the lines are grouped under the modules' names.
- The last line is a service line: `Plan: <folder> · phases K–L` — the phase range of the modules covered. Without a plan there is no such line.
- An explicit request from the user ("modules 3-4", "a PR from abc123") outranks everything computed below.

## Which modules the text covers

Walk back from the module that ends at the pull request's end, including modules labelled `⏭️ MERGED`, down to the first module whose boundary is already an ancestor of `origin/<base>` (`git merge-base --is-ancestor <b> origin/<base>`) — that module and every earlier one are left out: they are already on the base branch. The last module, which carries no PR checkpoint, belongs to the final pull request.

The module inside which the pull request ends — the user chose "everything up to now" inside a module — is described by its finished tasks only, under its own name marked "in progress" in `language.artifacts`.

## Sources

- A module's `## Modules` line — its `delivers:` sentence is the first draft of its lines.
- The `WHY:` lines of the finished tasks of its phases.
- The subjects of the commits in the range — human by the `/unikit-commit` contract.
- Related items become one feature, not one line each.

## Reading the code

For **a branch without a plan**, and for **the commits of the range that carry no `Plan: <folder>` trailer of this plan**, the code is read. The code is the source of truth: commit subjects are hints.

1. `git log --format=%s <start>..<end>` — the subjects. A subject that says nothing ("wip", "fix", "update", ".", a single word) is not used.
2. `git diff --stat <start>..<end>` — which files changed, and how much.
3. The diff is read group by group, never all at once: `git diff <start>..<end> -- <files of the group>`, a group being a directory or a related set of files. A new file may be read whole with `Read` when the diff does not show enough. Binary, generated and lock files, and the engine's own service files, are not read — they are noted as changed content.
4. For every group: what the game or the team can do now — a new mechanic, a changed behaviour, a fixed bug, new content, a tool. Related groups become one feature.
5. Only the result goes into the text, in plain language. The code is read to understand it, never to quote it: no class names, no paths, no formulas here either.
6. What the code does not reveal is not invented: such a group is described honestly and briefly — "internal changes to <area> with no visible effect".

## A plan without PR checkpoints

The same sources. The lines are grouped by `## Modules` when the section exists. When the plan still has `[ ]` tasks, the first line of the body is `⚠️ <N> task(s) of the plan are still open` — it is an ordinary pull request, not a draft.

## A branch without a plan

The range is `merge-base..HEAD`, the text comes from reading the code as above, and there is no `Plan:` line.

## Example

Written in `language.artifacts`; English here only as a sample of the form.

```
Title: Players can trade items with merchants

Merchants
- A merchant sells and buys items at prices that depend on the item's rarity
- The shop window shows what the player can afford right now

Inventory (in progress)
- Items bought from a merchant land in the first free slot

Plan: merchant-trade · phases 1–3
```
