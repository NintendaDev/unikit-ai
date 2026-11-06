# Compact research index replay cases

These are agent replay scenarios, not an executable renderer. Static guards and
installed-artifact checks cannot establish observed read order. Copy `project/` into
a scratch project with installed skills. Preserve snapshots and the actual tool
read/write journal outside the repository. Run the production index-render
instructions; never implement a test renderer that substitutes for the agent. A case
without a journal is unrun.

Setup below is incremental from the fixture. Every case requires before/after
snapshots plus the tool journal as Evidence; compare manifest bytes separately from
the derived index. For linked hashes use `.unikit/system/research-hash.mjs`. Do not
modify the fixture or a user's original research.

| Case | Setup | Expected | Must not | Evidence |
|---|---|---|---|---|
| C1 | Legacy index; save alpha | Whole v2 table for every readable manifest; Summary is `Topic:`, cut at 250 | Rewrite other manifests or read them whole | Rows, source byte diff, search call |
| C2 | A `Topic:` line the search output leaves out as too long | That one line is read and cut | Read the whole manifest or write `—` | Ordered read journal, the cell |
| C3 | No `Topic:` between the markers, one in Sessions | Summary is `—` | Take the Sessions line | The cell, the search output |
| C4 | Archive batch then restore batch | One whole render per scope per batch | Render after each research; change the Active Summary | Moves, both indexes, identical `research-hash.mjs` digest |
| C5 | Existing destination; then successful move followed by command failure | No overwrite; closing rebuild reflects successful moves | Roll back the move or claim the failed scope succeeded | Error and disk snapshots |
| C6 | Linked known archived slug in implement and verify | The script runs on the folder found; `INFO [research]` | Read an index or the Active Summary | Ordered read journal |
| C7 | Remove index, corrupt a row, point a row's link outside the root, in separate runs | `INFO [research-index]` and a folder search; the link is not followed | Write the index or print a drift warning | Three journals |
| C8 | Same slug in active and archive; read Based on | Active source and the duplicate INFO | Prefer archive or confuse restore | Read path and digest |
| C9 | Ask for a historic topic, then an ordinary plan | Selected history only; the plan offers active only | Restore or propose archived work automatically | Read and proposal journal |
| C10 | Empty scope; SOURCE-only; unreadable manifest | Header-only index; NOTE unfinished or WARN skip | Skip in silence | Membership and skip diagnostics |
| C11 | Special title/Target, dated slug, equal dates | One physical escaped row, precise dates and exact links, stable order | Fixed padding or slug from title | Rendered Markdown and decoded destinations |
| C12 | Gate repair edits `Topic:`; separately a Sessions-only edit | `Topic:` edit: one more render before confirm; Sessions-only: none | Extra coherence pass | Gate edits, write order |
| C13 | Named restore exact/dated/partial/ambiguous; active collision | Folders of the archive root, no index read; the collision blocks the move | Treat active-first reading as a successful restore | Separate selection/error/move journals |

Representative inputs: the tracked manifest follows explore's canonical Step 3
template, with standard/ultra, full-summary and Sessions markers. For the real
long-research replay also copy local `.ai-factory/research/research-archive/RESEARCH.md`
to the scratch project; adapt aif markers/header to the UniKit manifest and record
the adaptation. It is a real local source, not a CI fixture; never edit its original.
