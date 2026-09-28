# Push in a plan with PR checkpoints

Read by Behavior step 8 only, when the branch's plan carries a `PR checkpoint:` line. The boundaries themselves are computed by `.unikit/system/plan-boundaries.md` — named here, never restated. The default target is the current state, `HEAD`.

The question texts and option labels below are templates: say them in `language.ui`. `INFO` / `WARN` and the `[commit]` tag stay as they are; the words after them are in `language.ui`.

A module's name comes from its `## Modules` line (`M<k> · <name>`), or — when the plan has no such section — from its PR checkpoint task (`PR checkpoint: <module name> → <base>`).

## Steps

The order matters: "the whole plan is closed" is checked **before** any boundary is computed. In a closed plan the last module has no boundary, so the newest boundary would be the one before it, and step 6 would claim that `HEAD` is inside a module it has already finished.

1. Read `.unikit/system/plan-boundaries.md`. Missing or unreadable → print `WARN [commit] plan-boundaries contract missing — module boundaries unknown, the ordinary push offer is used; run unikit-ai update` and ask the ordinary question of Behavior step 8, case 4 — the target is `HEAD`.
2. Every task of the plan is `[x]` — the head is the target (`## Push target`). Ask the ordinary question of Behavior step 8, case 4, and stop here.
3. Find the `## Last completed boundary` of the contract → `B`.
4. No `B` → print `INFO [commit] no module of <folder> is finished yet — HEAD is inside module <first module name>` and ask the ordinary question of case 4. The target is `HEAD`: there cannot be an open pull request of an earlier module.
5. `B` equals `HEAD` → ask the ordinary question of case 4, naming the target in it as "the end of module <name> (<B short>)".
6. `B` is an ancestor of `HEAD` but not `HEAD` → print `WARN [commit] HEAD is inside module <name of the module after B> — pushing it now puts that unfinished part into an open PR of <name of B's module>, if there is one`, then ask:

   ```
   AskUserQuestion: Where should the push end?

   Options:
   1. Push everything up to now (HEAD)
   2. Push up to the end of <name of B's module> (<B short>)
   3. Skip push
   ```

   - **Push everything up to now (HEAD)** → the push of Behavior step 8, case 4.
   - **Push up to the end of <name of B's module>** → `git push origin <B>:refs/heads/<branch>`.
   - **Skip push** → end the workflow.

   `HEAD` comes first because the current state is the default; the boundary is the choice that keeps the base branch whole if the open pull request is merged now.

Without a question widget, print the options as a numbered list and end the turn — the answer arrives as the next message.

## Never

- The boundary is not yours to pick — never cut the push silently: inside a module the user decides where it ends, and the `WARN` line names what the head would bring into an open pull request before the question is asked.
- Never add `-u` to a boundary push — its source is a SHA, not a branch, and there is nothing to track.
- Never force a push, and never merge the base branch into this one.
- The remote refuses the push (non-fast-forward, a protected branch) → print git's answer and `WARN [commit] push refused by the remote — nothing was forced`. No retry.

Short SHAs only. The remote's URL and any token never reach the output.
