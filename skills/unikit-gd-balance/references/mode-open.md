# Open — start a balance document

The branch for "start balancing a topic" and "start from a research". Say points by their goal
in every question and status line (`named by its goal`, TIER B of the membrane); codes stay in
the files.

## Order

1. **Input.** A topic from the request and/or a path to `researches/<slug>/RESEARCH_RESULT.md`.
   From a research read only the `## Active Summary` region and `## Findings` as needed; a
   record with no summary is read as text. Neither a topic nor a path (the branch was reached
   from an empty status) → ask once, with `AskUserQuestion`: the topic in a few words, or the
   path of a research.
2. **Slug.** ASCII kebab-case of the topic (translate or transliterate its words), at most 40
   characters, no date. If
   `balance/<slug>/` already exists, ask: continue it (the revise branch) or another name. An
   automatic suffix is forbidden. `resolve-target.md` owns the list.
3. **Investigation** — `investigation.md`, when facts from code or data are needed.
4. **Interview** by `closure-set.md`, in the order Q1–Q5. Decisions go through
   `AskUserQuestion`, the recommended option first; each answer carries a source tag.
5. **Draft** `BALANCE.md` from `template-balance.md`, and a coarse `## Roadmap`. Slicing
   principle: a point ends where the nearest data may change the decision; it holds the minimum
   of work for that data plus what does not depend on the unknown; later points are rows of the
   roadmap with no work.
6. **Feasibility.** Each work item of the current point is checked against the code of the
   named slice (`recon-agent`). Two grades, defined here and nowhere else: *not feasible as
   written* — the item is not issued, it is revised with the user; *feasible with a constraint*
   — the item is issued and the constraint is written into `Constraints`.
7. **Route.** Weigh the route of the issued point — `experiment-route.md` → `## Weighing the
   route`; the draft of the next step shows the route that was chosen.
8. **Approve, then write.** Show the draft in the interface language — the subject, the
   decisions with their sources, the roadmap as goals, the issued point's goal, its work and its
   route — and
   ask once (`AskUserQuestion`, the recommended option first): `1.` write it · `2.` change
   something · `3.` stop. Nothing is written before the answer (`gd-principles` → Collaborative
   Protocol). On `1.`, in this order: `mkdir -p .unikit/gamedesign/balance/<slug>/results` →
   `BALANCE.md` → `CHECKPOINTS.md` (`Status: open`, `Current: BCH-1`, `Updated` from
   `Bash(date *)`; on the experiment route its log holds the entry of `experiment-route.md` →
   `## Recording the route`) → redraw `INDEX.md`. If `mkdir` is refused, tell the user the path, write
   nothing, change no state.
9. **Report** (the terminal block, TIER A): what was created — the document by name, the issued
   point by its goal (the code only as a secondary tag in parentheses); the closing set status;
   the plan command last (`SKILL.md` → `## Closing block`); on the experiment route, instead of it,
   `experiment-route.md` → `## Now or later`.

Questions of the interview (step 4) and status lines along the way are TIER B: no codes.
