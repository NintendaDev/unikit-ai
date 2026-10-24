# Init: Rebuilding the Researches Index (maintenance body)

Loaded on demand by `unikit-gd-explore/SKILL.md` → "Init" when the argument is exactly
`init`. The SKILL keeps the switch; this file holds the maintenance procedure.

## Init: Rebuilding the Researches Index

When the argument is exactly `init`, synchronize
`.unikit/gamedesign/researches/INDEX.md` with the directory contents — a
maintenance command, no exploration:

1. List subdirectories of `.unikit/gamedesign/researches/`.
2. Parse the existing index for indexed `**Path**`s.
3. **Keep** entries whose directory still exists (unchanged); **Remove** entries
   whose directory is gone; **Add** directories with no entry — read their
   `RESEARCH_RESULT.md` for title/status/topic (date from the `Date:` line — the only
   source, now that the folder name carries none; `Updated` falls back to `Date`), and
   **when the header carries a `Target:` line, carry it into the entry's `**Target**`
   field** (internal-design
   lens researches — see "Research tags"; omit the field when the header has none).
   The **first line** of the file equals `<!-- unikit:research-mode:ultra -->` (the marker
   `{{skills_dir}}/{{self_name}}/references/ultra-research.md` defines) → add `**Mode**: ultra` to the entry; no such
   line → the field is not written. A marker on any other line does not set the mode and
   prints nothing — the record is a valid standard one. The entry's title comes from the
   first line that starts with `# `; the mode marker never plays that role.
   Skip and warn on a missing `RESEARCH_RESULT.md` — **except** a folder that has no
   `RESEARCH_RESULT.md` but does have `SOURCE.md`: do not warn, print
   `NOTE [research] <folder> — unfinished exploration: SOURCE.md is there, the record is not.`
   once, skip the folder, and do not count it in `Added`. A folder with neither file keeps
   the `WARN`.
4. Rewrite the index (header + entries, newest-date first; same-date alphabetical).
5. Report: `Kept N · Added N (names) · Removed N (names)`.

Empty/absent directory → write a header-only index and report "No researches
found". Then **STOP** — do not enter explore mode.
