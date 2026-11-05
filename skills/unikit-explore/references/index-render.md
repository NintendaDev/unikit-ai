# Re-rendering the Researches Index

Loaded on demand at explore Step 4 and after archive/restore batches. One writer
serves `scope: active | archive`: roots `.unikit/code/researches/` and
`.unikit/code/archive/researches/`. Explore saves use active only; ultra pinning
SOURCE.md does not render an index or create a cache.

Read `.unikit/system/research-link.md` → `## Reading an index` for the table format,
escaping and compatibility. Read
`{{skills_dir}}/unikit-explore/references/index-summary-cache.md` for summarization,
fingerprints, reuse and write ordering. If either reference is unreadable, announce
`WARN [research-index] <scope>: writer reference missing — index/cache not rebuilt;
run unikit-ai update`, and continue the saving gate or keep the successful moves.

## Whole render

The index is **re-rendered whole** from real direct-child folders, never appended
or patched by row. Do not edit manually — edits are overwritten. Cache is never
the source of membership. Before either scope is rebuilt after a move/restore,
retain both old cache snapshots as the cache reference requires.

1. List the selected root's direct subfolders. Read each `RESEARCH.md` and take
   its H1 and first header Created / Updated / Archived / Status / Lifecycle /
   Target fields; current metadata always comes from disk. Generate/reuse the
   short description by the cache reference, never by copying the whole Topic.
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

   Skipping in silence is forbidden. Missing manifest is the only exclusion;
   broken cache, H1 or summary markers do not exclude readable research.
3. Prepare the v2 heading, generated warning, marker and table specified by the
   contract. Empty scope still writes the heading/marker and header-only table.
   Sort by `Updated` descending for active, then Created descending, slug ascending;
   archive prefixes Archived descending. Missing dates follow existing dates.
   Keep full date precision and the contract's escaping, without fixed-width padding.
4. Compare old index membership (legacy or v2) with successfully indexed folders
   for reconciliation. Prepare the new cache too, containing only this scope's
   successful entries. Write INDEX.md, then INDEX.cache.json by the cache protocol.
   Index write failure → WARN naming scope and path, never announce success or
   write its new cache. Cache failure keeps the index; moves never roll back.
5. Print as your own message, separately per scope:

   ```
   <scope>/INDEX.md re-rendered:
   - Kept: N
   - Added: N (list names)
   - Removed: N (list names)
   INFO [research-index] <scope>: generated N, reused N, limited N
   ```

## Save closure

Keep the normalized summary inputs used by this render in the saving session.
After all coherence-gate edits, apply `index-summary-cache.md` → `## Final source
check after the gate` before Step 5. A changed input causes a whole active render;
an unchanged input causes no repeat write. This check belongs to the saving
session, adds no coherence pass and does not change the gate's budget.
