# Merge exploration — what merging a named branch will do, before it happens

Read **only** when the user asks to merge a named branch into the current one (`SKILL.md` → Input handling). An ordinary exploration does not read this file.

The exploration stays what it is — a thinking partner that writes nothing before the user agrees to save. This file changes its subject: the question is "what happens when branch X is merged into this one", and the saved research has one job — to give an agent everything it needs to resolve every conflict after the merge, so that the user resolves none. The user then closes the editor, merges (or lets a plan merge), and starts `/unikit-plan`.

## Trigger

A request to merge a **named** branch into the current one. Three things are not merges in this sense — **rebase**, **cherry-pick**, and merging by a pull request number. Say so in one line and offer an ordinary exploration instead.

The branch is not named → ask which one with `AskUserQuestion` (options from `git for-each-ref`), and go on with the answer.

## Bootstrap

1. Read `.unikit/system/merge-analysis.md` — the protocol this exploration runs. It is missing → print

   ```
   WARN [merge] merge-analysis.md missing — run unikit-ai update
   ```

   and STOP: without the protocol the exploration would have no ground to stand on.

2. Read `{{skills_dir}}/unikit-plan/references/ENGINE_RULES.md` **once** — §6 (direct-edit feasibility), and §1 and §2 for the surface classes. Nothing else from it. The file is missing → every format is 🔴 and one line says why.

## Run the protocol

Follow `merge-analysis.md` whole, in its order: pin the three commits, fetch, start state, divergence, predict the result, surface classes, a directive for every conflicted file, anchors. Show the user what you find as you go — this is still a conversation, not a batch job.

**What this writes, and where.** `git fetch` and `git merge-tree` write into `.git` only — refs and objects. The working tree, the index and the project's files do not change. The rule that an ordinary exploration writes nothing to disk until the user agrees to save (`SKILL.md` → The Stance) is about the research files and the project, and it stands.

**Commands.** Only those the frontmatter allows: they read history, trees and refs. A grant matches the start of a command, not its flags. Never pass a flag that writes a file or starts a program: `--output` makes `git diff`, `git log` and `git show` write a file, and `-O` of `git grep` hands the matching files to a program. `git fetch` is not among the grants on purpose — the permission prompt is the user's decision to let it run. **Never** `git merge`, `checkout`, `reset`, `stash`, `worktree`, and never a temporary working tree to build the result: in an engine project it costs a full reimport of the project. The tree `merge-tree` produced is read in place (`git show`, `git grep`, `git ls-tree`).

## Forks and blocking questions

- A fork of the kind "whose behaviour wins" is settled **now**, through the standard readback (`SKILL.md` → Step 3.5). The answer is recorded as a `DEC-<n>` with its reason.
- An explicit conflict for which no directive can be written is an `OQ-<n>` whose first word is `blocking`. The identifier vocabulary stays closed on its six prefixes — nothing new is introduced for this.

## What the saved research looks like

- **Actions after the merge** are `REQ-<n>`, grouped, each marked `inferred` — they come from the code, not from the user, so each goes through the standard readback before it counts.
- **The lists of places** (every file, every symbol, every record) go to `## Findings`, not to the Active Summary.
- **Evidence** carries a `path:line` reference, read from the predicted tree (`git show <tree>:<path>`) and marked that it exists only after the merge. A line that does not exist in the current tree is not a mistake; an unmarked one is.
- **A directive** per conflicted file, in the form `merge-analysis.md` defines: the file, the side or the combination, the rule, the reason.

## Anchors

The Active Summary is hashed (a plan checks it for drift), so the prediction is fixed there, in `Constraints:`:

```
C-<n>   — Merge anchors: ours=<sha>, theirs=<sha>, base=<sha>, result-tree=<oid>
C-<n+1> — Predicted conflicts: <path>; <path>      (or: none)
```

The first `REQ` of the research is the check against reality, per the last section of `merge-analysis.md`: compare `MERGE_HEAD`, the unmerged set, and `HEAD` with these anchors before anything is resolved. `/unikit-plan` compares the SHAs of its own run with the line that starts `Merge anchors:` to decide whether the research is still fresh.

`Next step:` of the Active Summary names the user's move: close the editor, then either merge by hand and run `/unikit-plan`, or run `/unikit-plan` and ask it to merge the branch.
