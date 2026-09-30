# Plan boundaries — where a plan, a module and a push start and end

Read by `/unikit-verify`, `/unikit-implement`, `unikit-implement-coordinator` (through the
`/unikit-implement` reference it reads), `/unikit-commit` and `/unikit-pr`. Each reads this file
only at its own point — the skill names that point — and names the section it needs rather than
restating it. Every service line this contract defines carries the tag `[plan-range]`.

Do not restate this contract inside a skill — that is the failure mode this file exists to
prevent. Four skills compute the same SHAs from it; a skill that repeats a rule drifts from it,
and nothing turns red when two answers disagree.

The plan grammar these sections read — `Planned at:`, `## Modules`, the `PR checkpoint:` task
and its labels — is declared by `unikit-plan/references/TASK-FORMAT.md` → `### Modules section`
and `### PR checkpoint task grammar`. Every command below is plain `git`.

## Base branch

The first hit wins:

1. `git.base_branch` from `.unikit/config.yaml`, when it is set and not empty — silently.
2. Otherwise `git symbolic-ref refs/remotes/origin/HEAD`, with the `refs/remotes/origin/` prefix
   removed.
3. Otherwise `master` when `origin/master` exists, else `main`.

On links 2-3 print one line, once per run:

```
INFO [plan-range] git.base_branch not set — base is <branch> (<origin/HEAD | fallback>)
```

At a PR checkpoint, the `→ <base>` of its `PR checkpoint:` line names the base of that module;
for `/unikit-pr` at that checkpoint it outranks the chain above.

No local branch `<base>` → compare with `origin/<base>`. The test is `git rev-parse --verify --quiet refs/heads/<base>` returning nothing.

## Plan start

The commit the plan's work starts from. The first hit wins:

1. `Planned at: <sha>` from the manifest header, when `git cat-file -e <sha>^{commit}` succeeds.
2. The parent of the earliest commit in the history of `HEAD` carrying the trailer
   `Plan: <folder>`: `git log --reverse --format=%H --grep='^Plan: <folder>$' HEAD` → the first
   line → `<sha>^`.
3. The parent of the first commit that added the manifest:
   `git log --diff-filter=A --format=%H -- .unikit/code/plans/<folder>/PLAN.md` → the last
   line → `<sha>^`.
4. Nothing → the plan has no start. Print the line below, and the caller takes `<base>...HEAD`:

```
WARN [plan-range] <folder>: plan start not found — the range falls back to the base branch
```

A root commit (`<sha>^` has no parent) → the start is the empty tree
`4b825dc642cb6eb9a060e54bf8d69288fbee4904`.

## Module boundary

For a module that carries a PR checkpoint task:

- `[x]` with `→ PR <sha>` and no `⏭️ MERGED` label → `<sha>`.
- `[x]` with `→ PR` and no SHA (a legacy label) → the commit that first brought that ticked line
  into the manifest: `git log --reverse --format=%H -G 'Task <N\.M>.*→ PR' -- <manifest>` → the
  first line. Nothing found → the boundary is unknown.
- A task carrying a ⏭️ MERGED label has no boundary of its own.
  This holds whether the label is still open (`⏭️ MERGED → task N.M`), closed with its
  target's `→ PR <sha>`, or the bare `[x]` of the last PR checkpoint.
- `[ ]` with no label → the boundary does not exist yet. The last module has no boundary until
  the pull request made after `/unikit-verify`.

## Module start

The start of module k is the boundary of the nearest earlier module that has one. Merged modules
have none, so the range widens through them. No such module → the plan start
(`## Plan start`).

## Last completed boundary

The newest module boundary that is an ancestor of `HEAD` (`git merge-base --is-ancestor <b> HEAD`).
None → there is none.

## Push target

**By default the target is the current state — `HEAD`.** A push or a pull request does what is
there now, and works without a plan. This section refines exactly one case: the checklist
carries at least one `PR checkpoint:` line (any plan, legacy included) **and `HEAD` is inside a
module**.

- "Inside a module" means: not every task of the plan is `[x]`, and `HEAD` is not the
  `## Last completed boundary`. The whole plan is closed, or `HEAD` equals that boundary → the
  target is `HEAD`, and nothing is asked.
- Inside a module the caller asks — it never cuts the push silently.
  It names the module `HEAD` stands in and offers two targets: `HEAD` (everything up to now; if
  the previous module's pull request is still open, the unfinished part lands in it) or the
  `## Last completed boundary` (the base branch stays whole).
- No module is finished yet → there is no choice: the target is `HEAD`, with one line saying that
  `HEAD` is inside the first module.
- Pushing a boundary is `git push origin <boundary>:refs/heads/<branch>`, without `-u` — the
  source is a SHA, not a branch. Pushing `HEAD` is the caller's ordinary push.
- **A SHA in a push is never typed from memory.** Resolve it once with
  `git rev-parse --verify <boundary>^{commit}` and paste that output exactly as printed — never
  lengthen a short SHA, complete it or retype it. When the end is `HEAD`, the source is the literal
  `HEAD`. After the push, `git ls-remote origin refs/heads/<branch>` prints the same SHA as that
  `git rev-parse`; a different one → `WARN [<skill>] origin/<branch> is at <short>, not <end short> — check the push`, and nothing that depends on the push runs.
- The automatic commits of a run (`/unikit-implement`, the coordinator) do not push at all
  (`no-push`, `TASK-FORMAT.md` → `### PR checkpoint task grammar`). This section concerns only a
  push or a pull request a human asked for.
- In a plan without `PR checkpoint:` lines this section does not apply — the target is `HEAD`,
  as before.

## Diff range of a check

- **The whole plan** (the closing `/unikit-verify`): `CHANGED_FILES` is the union of
  `git diff --name-only <plan start> HEAD` and `git diff --name-only <base>...HEAD`. Without a
  plan start, only the second, as before. The plan-start half is a two-dot diff — two
  arguments, never `...`: the start may be the empty tree (a root commit), `A...B` needs a
  common ancestor of two commits, and git fails on a tree.
- **Phases `K-L`:** `git diff --name-only <start> <end>`, where `<start>` is the
  `## Module start` of the module phase K falls in, and `<end>` is the boundary of the module
  phase L falls in when it has one, otherwise `HEAD`. K and L inside a module follow the same
  rule — the range widens to whole modules.
- **Phases without modules** (a plan without `## Modules`): `git diff --name-only <plan start> HEAD`.

## Not this contract

- Which modules a pull request describes, and its text — `/unikit-pr`.
- How the executor writes the labels — `TASK-FORMAT.md` → `### PR checkpoint task grammar`.
