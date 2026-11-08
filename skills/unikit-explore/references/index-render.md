# Re-rendering the Researches Index

Loaded on demand at explore Step 4 and after archive/restore batches. One writer
serves `scope: active | archive`: roots `.unikit/code/researches/` and
`.unikit/code/archive/researches/`. Explore saves use active only; ultra pinning
SOURCE.md does not render an index. A reader of the index does not need this file.

## Format

Exactly one `<!-- unikit:research-index:2 -->`, a short heading, a generated warning
and one Markdown table. One physical row per research, without fixed-width padding:

```
| Research | Updated | Status | Lifecycle | Summary | Target |
|---|---|---|---|---|---|
| [Title](<slug>/RESEARCH.md) | <original timestamp> | completed | active | <Topic> | — |
```

The archive adds `Archived` immediately after `Updated`. Preserve date precision,
including time; absent dates are `—`, never Created or mtime. Missing Lifecycle has
effective value `active`. Status and Lifecycle remain independent axes. Column names
and enum values stay stable.

`Summary` is the `Topic:` line of the Active Summary without its prefix. Longer than
250 characters → cut at 250 and end with `…`. No `Topic:` between the two markers → `—`.
Never shorten or rewrite the manifest to fit the index.

Cut first, then collapse cell line breaks to spaces and escape backslashes, pipes
(`\|`), brackets and Markdown metacharacters in titles/Summary/Target. Encode
link-destination special characters (including spaces, parentheses, brackets and
pipes) so the link resolves exactly.

## Whole render

The index is **re-rendered whole** from real direct-child folders, never appended
or patched by row. Do not edit manually — edits are overwritten.

1. List the selected root's direct subfolders. One search with line numbers over
   `<root>/*/RESEARCH.md`, no manifest read whole, for the lines matching:

   ```
   ^(# |Created:|Updated:|Archived:|Status:|Lifecycle:|Target:|Topic:|<!-- unikit:active-summary:(start|end) -->)
   ```

   In each file the title and the header fields are the first hit of each above the
   start marker (no markers → the first hit in the file); `Topic:` counts only between
   the two markers. An output cut into pages → read the rest. A line left out as too
   long → read that one line. Current metadata always comes from disk.
2. No readable manifest → skip and announce. SOURCE.md without a manifest is
   expected unfinished work:

   ```
   NOTE [research] <folder> — unfinished exploration: SOURCE.md is there, the manifest is not.
                   Continue it with: /unikit-explore <folder>
   ```

   Continue through `{{skills_dir}}/{{self_name}}/references/continuing.md` in
   explore. Other missing/unreadable manifests:

   ```
   WARN [research] skipped <folder> — no readable RESEARCH.md
   ```

   Skipping in silence is forbidden. Missing manifest is the only exclusion; a broken
   H1 or broken summary markers do not exclude readable research (no H1 → the slug is
   the title).
3. Prepare the heading, generated warning, marker and table of `## Format`. Empty
   scope still writes the heading/marker and header-only table.
   Sort by `Updated` descending for active, then Created descending, slug ascending;
   archive prefixes Archived descending. Missing dates follow existing dates.
4. Compare old index membership (cards or table) with successfully indexed folders
   for reconciliation, then write INDEX.md whole. Write failure → WARN naming scope and
   path, never announce success. Moves never roll back.
5. Print as your own message, separately per scope:

   ```
   <scope>/INDEX.md re-rendered:
   - Kept: N
   - Added: N (list names)
   - Removed: N (list names)
   INFO [research-index] <scope>: N rows, N cut to 250, N without Topic
   ```
