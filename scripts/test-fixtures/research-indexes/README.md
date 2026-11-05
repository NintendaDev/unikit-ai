# Compact research index replay cases

These are agent replay scenarios, not an executable renderer. Static guards and
installed-artifact checks cannot establish summary quality or observed read order.
Copy `project/` into a scratch project with installed skills. Preserve snapshots
and the actual tool read/write journal outside the repository. Run the production
index-render instructions with that project's language policy; never implement a
test renderer that substitutes for the agent. A case without a journal is unrun.

Setup below is incremental from the fixture. Every case requires before/after
snapshots plus the tool journal as Evidence; compare manifest bytes separately
from the derived index/cache. For linked hashes use research-link's full-summary
digest, not the cache fingerprint. Check summaries semantically, not against one
preferred sentence. Do not modify the fixture or a user's original research.

| Case | Setup | Expected | Must not | Evidence |
|---|---|---|---|---|
| C1 | Legacy index, no cache; save alpha | Whole v2 table, agent summaries for every readable manifest | Rewrite other manifests or blindly copy long Topic | Rows, source byte diff, generated counter |
| C2 | Repeat C1 unchanged | Identical summaries; reused count | Rephrase a checked hit | Both caches and table cells |
| C3 | Edit Active Summary without Updated; separately change language/version | Only affected source or incompatible policy regenerates | Trust Updated/mtime | Input digest and generated reasons |
| C4 | Edit only Archived, Updated, or Sessions separately | Reuse summaries, refresh metadata | Hash metadata into sourceSha256 | Each mutation and counters |
| C5 | Archive batch then restore batch | One whole render per scope per batch; checked cross-scope reuse | Drop the transferred cache before snapshotting it | Moves, both caches, identical full-summary hash |
| C6 | Existing destination; then successful move followed by command failure | No overwrite; closing rebuild reflects successful moves | Roll back move or claim failed scope succeeded | Error and disk snapshots |
| C7 | Linked known archived slug | Archive index read before selected manifest | Bypass index or read unrelated manifests | Ordered read journal |
| C8 | Remove index, omit row, corrupt row, remove folder in separate runs | INFO navigation fallback, filesystem source authority | Write index/cache or turn navigation into drift | Four journals; actual hash outcomes |
| C9 | Same slug in active and archive; read Based on | Active source and duplicate INFO | Prefer archive or confuse restore | Read path and full-summary digest |
| C10 | Ask for historic topic, then ordinary plan | Selected history only; plan offers active only | Restore or propose archived work automatically | Read and proposal journal |
| C11 | Empty scope; SOURCE-only; unreadable manifest | Header-only index; NOTE unfinished or WARN skip | Cache resurrects missing source | Membership and skip diagnostics |
| C12 | Missing Updated/Lifecycle/cache; malformed cache; no hash tool | Effective active, missing-date diagnostic; generate without reusable fingerprint if no tool | Invent date or exclude readable source for bad cache | Separate journals and cache shapes |
| C13 | Special title/Target, dated slug, equal dates | One physical escaped row, precise dates and exact links, stable order | Fixed padding or slug from title | Rendered Markdown and decoded destinations |
| C14 | Qualified proposal whose faithful sentence exceeds guide | Qualification and search names retained | Truncate or present proposal as accepted | Compare source and sentence by meaning |
| C15 | Legacy archive without index | Read-only fallback; first later move creates archive index | Init/update migration or hidden list writes | Read-only diff, later writer diff |
| C16 | Gate repair edits summary; authorized OQ save; Sessions-only edit | Before confirm: changed source refreshes derived output; Sessions-only no repeat render | Extra coherence pass or stale fingerprint | Gate edits, final digest, write order |
| C17 | Healthy catalog plus SOURCE-only; then one missing/broken row | No false mismatch; only affected manifest supplemented in memory | Read healthy manifests or repair on disk | Ordered reads and zero writer calls |
| C18 | Named restore exact/dated/partial/ambiguous; missing index; active collision | Archive index first, old matching/questions; collision blocks move | Treat active-first read as successful restore | Separate selection/error/move journals |

Representative inputs: the tracked manifest follows explore's canonical Step 3
template, with standard/ultra, full-summary and Sessions markers. For the real
long-research replay also copy local `.ai-factory/research/research-archive/RESEARCH.md`
to the scratch project; adapt aif markers/header to the UniKit manifest and record
the adaptation. It is a real local source, not a CI fixture; never edit its original.

Measure old/new indexes on the same membership: count, bytes, physical lines.
Measure cache bytes separately: ordinary readers do not load it. Bytes are not tokens.
