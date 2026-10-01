# Safe merge

Read at Step 5, only at the `merge` level and only after the pull request was opened or updated. The steps run in order; the first refusal stops the merge, the pull request stays open, and the reason is printed as `PR #<n> stays open — <reason>`.

## Steps

1. **git can compute a merge without touching the work tree** — `git version` is 2.38 or newer. Older → `PR #<n> stays open — git <v> has no merge-tree --write-tree`.
2. **The merge brings nothing from the base branch.** `git fetch origin <base>`, then `git merge-tree --write-tree origin/<base> <end>`:
   - a non-zero exit code → `PR #<n> stays open — the merge conflicts with <base>`;
   - the first line of its output (the merged tree) differs from `git rev-parse <end>^{tree}` → `PR #<n> stays open — <base> has changes this branch does not — merge <base> into the branch and check them together first (a developer's decision)`.
3. **GitHub agrees the pull request can be merged** — `pull_request_read` with the method `get`. `mergeable` is not `true`, or `mergeable_state` is neither `clean` nor `unstable` → refuse, naming the state: `dirty` — a conflict; `blocked` — required checks or reviews; `behind` — the branch rules require merging the base in; `unknown` — GitHub is still computing: read it once more, then refuse. Any other value → refuse with the word GitHub returned. `unstable` does not refuse: it is mentioned in the confirmation — optional checks are red.
4. **The state of the tests is information, never a condition.** From the plan's `## Test Runs`, one of: the module's tests are green (task N.M) · the module's tests have not run — moved to task N.M · the last run of the module's tests was red (task N.M) · the plan has no tests — code no test has checked is being merged. A red run does not block the merge; it is said before the question.
5. **A separate confirmation**, with the test line from step 4 above it:

   ```
   AskUserQuestion: Merge PR #<n> into <base> with a merge commit?

   Options:
   1. Merge
   2. Leave it open
   ```

6. **Merge** — `merge_pull_request` with `merge_method: "merge"`; never a squash, never a rebase. Success → `PR #<n> merged: <url>`. An error → `PR #<n> stays open — GitHub refused the merge: <message>`.

## Why the trees, and not the ancestry

The safe condition is "the merge brings nothing from the base branch": the tree `git merge-tree --write-tree origin/<base> <end>` computes equals the tree of `<end>`. An ancestry test (`git merge-base --is-ancestor origin/<base> <end>`) looks equivalent and is not. Once the previous module was merged with a merge commit, that merge commit sits on the base branch and is not an ancestor of the feature branch, so the ancestry test refuses every later module — while the trees still match, because the merge commit brought nothing the branch lacks. Measured on git 2.46: the tree comparison lets the next module through after a merge-commit merge of the previous one, and refuses both a foreign file on the base branch and a textual conflict.

A squash merge does not fool the tree comparison, but it breaks the branch's continuation: the next pull request shows the merged module's commits again, because the merge base does not move. That is why the merge method is always `merge`.
