# unikit-explore — Continuing a research

> Loaded on demand by `unikit-explore` when the argument names an existing folder in
> `.unikit/code/researches/`, or when the user chooses *Continue the existing research* in the
> slug-collision dialogue of a save. The stance and the save pipeline of `SKILL.md` stay in
> force; this file adds what a continuation does differently.

A research is not finished when it is saved — it is **continued**. This is the reason the
folder name carries no date.

## Procedure

1. Read the folder's `RESEARCH.md` in full — the header, `## Active Summary`, `## Findings`
   and every past `## Sessions` entry. In ultra, read the files in `## Artifact Index` too.
2. Explore further, exactly as in a fresh session.
3. When saving:
   - **Append** a new entry to `## Sessions`, immediately **before** the closing marker.
     Past entries are reproduced verbatim — the section is append-only.
   - Move `Updated:` to now (from `date`). `Created:` never changes.
   - **Revise `## Active Summary` in place.** New IDs continue the existing numbering; an ID
     is never reused; a superseded item **keeps its number**, is marked superseded, and names
     what replaced it. Revising the summary is the point of a continuation — a session that
     only appends to `## Findings` has recorded evidence without ever updating the conclusion.
   - Reconsider `Status` and `Lifecycle` **explicitly**, and say what they became. Neither
     carries over by default; a research that has quietly stayed `in-progress` across four
     sessions is telling the registry something nobody decided.
   - **The log is already on disk.** `## Pinning` in `SKILL.md` owns `SOURCE.md` and has been
     appending this session's dialogue to it as you talked. Append the remainder here only
     where pinning did not run: it was switched off for the session (`WARN [pin]`), or the
     session started before it was in effect. Appending unconditionally writes the same
     dialogue into the file twice, and a doubled log is indistinguishable from a session that
     said everything twice.
   - Re-render the registry and run the coherence gate, exactly as on a first save.
4. **Say it out loud when the folder has outgrown its question.** From the fourth session, or
   past fifteen artifacts, print one line and continue — a note, never a gate:

   ```
   NOTE: 4th session, 17 artifacts — a research that keeps growing past its original question
         is cheaper to close and restart with `Supersedes:` than to extend.
   ```

   The threshold counts **sessions**, not artifacts: repeated passes are what multiply the
   carriers of one value. A large folder written in one sitting is not the problem this note
   is about. Closing and restarting is a new research, not a continuation — `SKILL.md` →
   `## Superseding a research` covers it.
