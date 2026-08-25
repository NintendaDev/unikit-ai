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
   Skip and warn on a missing `RESEARCH_RESULT.md`.
4. Rewrite the index (header + entries, newest-date first; same-date alphabetical).
5. Report: `Kept N · Added N (names) · Removed N (names)`.

Empty/absent directory → write a header-only index and report "No researches
found". Then **STOP** — do not enter explore mode.
