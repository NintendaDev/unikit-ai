# Merge analysis — how to read a merge before it happens

Read by `/unikit-explore` (merge mode, `references/merge-research.md`) and by `/unikit-plan` (merge plan, `references/merge-plan.md`). Each reads this file once, when the user asks to merge a named branch into the current one, and names the section it needs rather than restating it. Every service line this protocol defines carries the tag `[merge]`.

Do not restate this contract inside a skill — that is the failure mode this file exists to prevent. Two skills run the same analysis from it; a copy in each drifts, and nothing turns red when two answers disagree.

The analysis changes neither the working tree, nor the index, nor any ref. Its output is a prediction and a set of directives; the merge itself is made later, by a plan, with the editor closed. Every command below is plain `git`, one command per call — no pipelines, no shell substitution.

Words used here. **ours** is the current branch (`HEAD`), **theirs** is the branch being merged in, **base** is their `git merge-base`. An **explicit conflict** is a file git could not merge. An **implicit conflict** is a merge that went through, or a conflict elsewhere, whose result still breaks the build or the behaviour.

## Pin the three commits

- **ours** — `git rev-parse HEAD`.
- **theirs** — the named branch resolved to a commit: `git rev-parse --verify <ref>^{commit}`, where `<ref>` is the local branch or `<remote>/<branch>`.
- **base** — `git merge-base <ours> <theirs>`. When `git merge-base --all <ours> <theirs>` prints more than one commit, record all of them and call the merge criss-cross (`merge-tree` resolves it).

Record the three full SHAs. The branch is found neither locally nor on a remote → print one line and STOP; never guess a name.

## Fetch

Only the named branch, and only when it exists on a remote: `git fetch <remote> <branch>`, the remote being the branch's upstream, else `origin`. A purely local branch is not fetched. A local and a remote version that differ → ask the user which one is meant. Print:

```
INFO [merge] fetched <branch>: <old sha> → <new sha>
```

`git fetch` updates refs and adds objects under `.git`; the working tree, the index and the project files are left alone. Whether it may run without a prompt is the reader's concern.

## Start state

Exactly one of four holds:

| № | Condition | What the merge phase of a plan does |
|---|-----------|-------------------------------------|
| 1 | `git merge-base --is-ancestor <theirs> HEAD` fails and `git rev-parse -q --verify MERGE_HEAD` prints nothing | start the merge → check the anchors → resolve → commit the merge |
| 2 | `MERGE_HEAD` exists and `git diff --name-only --diff-filter=U` is not empty | check the anchors → resolve → commit the merge |
| 3 | `MERGE_HEAD` exists and no file is unmerged | only the commit that completes the merge |
| 4 | `MERGE_HEAD` is absent and `--is-ancestor` succeeds | no merge in the plan |

`MERGE_HEAD` is not the pinned theirs → another merge is in progress: say so and STOP.

State 4: the merge already happened, so `merge-tree` has nothing to predict. What the merged branch changed is `git diff <base> <theirs>`; the analysis looks for implicit conflicts by surface class (below) in the real tree.

Ours is an ancestor of theirs (`git merge-base --is-ancestor HEAD <theirs>` succeeds): a fast-forward is possible and there are no conflicts. The merge is still a merge commit — the user's answer — and the output names the case.

## Divergence

How far the two sides have drifted: `git rev-list --count <base>..<ours>` and `git rev-list --count <base>..<theirs>` give the commits on each side; `git diff --name-only <base> <ours>` and `git diff --name-only <base> <theirs>` give the touched files, and the reader intersects the two lists itself. A plan prints these numbers before it asks which mode to plan in.

## Predict the result

```
git merge-tree --write-tree --name-only --messages <ours> <theirs>
```

It leaves the working tree, the index and the refs alone, but writes tree and blob objects under `.git/objects`. Reading the output: the first line is the object id of the resulting tree; on a conflict the conflicted files follow, one per line, then an empty line, then the messages. Exit code 0 — clean; 1 — conflicts; anything else — an error, so say that no prediction was obtained.

Needs git 2.38 or later (`git --version`). Older: `git merge-tree <base> <ours> <theirs>` prints a "changed in both" diff with conflict markers (checked on 2.46; older versions were not checked), and one line is printed:

```
WARN [merge] git older than 2.38 — merge-tree --write-tree unavailable, old form used
```

The kinds of explicit conflict seen: content; modify/delete (`deleted in theirs and modified in ours`); rename/rename — three paths in the list, the original and both new ones. One implicit class is invisible to git: a file renamed on one side and edited on the other merges silently, the edit lands in the renamed file. Look for it as an implicit class.

The result is read without a checkout: `git show <tree>:<path>`, `git grep -n <pattern> <tree>`, `git ls-tree <tree>`. Whatever is taken from there is marked "exists only after the merge".

## Surface classes

Where implicit conflicts hide. These are classes, not file names:

- code symbols and contracts;
- wiring — dependency injection, enums and their `switch`, factories, events, registries;
- serialized engine content (the plan's `ENGINE_RULES.md`, §6);
- identity records that other files point at;
- project settings, manifests, lock files, module descriptors;
- id sequences, localization keys, migrations, save and network formats;
- generated files and caches;
- "formatting only" commits and line-ending changes;
- tests and documents tied to the changed code, and the artifacts under `.unikit/`.

Take the file names of each class from the repository (`.gitattributes`, `.gitignore`, the extensions in the diff itself), from §6 (and §1, §2) of `ENGINE_RULES.md` — the `references/ENGINE_RULES.md` inside the `unikit-plan` skill directory — and from Context7 and the engine MCP. Nothing available → say what was not checked. No engine fact is written into this file or into a skill: engine documentation is not stored here.

## Directive for a conflicted file

For every explicit conflict: the file, the side or the combination, the rule of the combination, the reason. The rule sits on top of §6 of `ENGINE_RULES.md`:

- 🟢 — resolve as text;
- 🟡 — resolve as text when the conflict fits the Bounds column of that format, otherwise treat it as 🔴;
- 🔴 — and any conflict where both sides added, removed or re-bound objects beyond the Bounds — take one side whole and apply the other side's delta as a separate `Editor:` task;
- §6 not found → every format is 🔴, with one line saying why.

A fork of the kind "whose behaviour wins" is settled before the merge: the reader asks and records the answer. A conflict for which no directive can be written is a blocking question; how it is written down is the reader's concern.

## Anchors and the check after the merge

Fixed by the analysis: ours, theirs and base as three full SHAs; the predicted list of conflicted files; the object id of the resulting tree.

The first step after the merge compares them with reality: `MERGE_HEAD` equals the recorded theirs; the set printed by `git diff --name-only --diff-filter=U` lies inside the predicted list; `HEAD` equals the recorded ours (ours has not moved on); for a clean merge, `git write-tree` equals the recorded tree id. A mismatch → recompute that part of the analysis and say so.
