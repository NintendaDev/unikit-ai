# Short research summaries — writer-only cache

Loaded only by the index writer, never by ordinary readers. This is an instruction to
the saving agent, not an executable renderer or an external summarization API.

## Input and digest

Read the current manifest for every real folder, even on a cache hit. Input is its
single H1 title line plus the complete region between exactly one correctly ordered
pair of whole-line `<!-- unikit:active-summary:start -->` and
`<!-- unikit:active-summary:end -->` markers, excluding the markers. Topic is already
inside that region. Never silently add Findings, SOURCE or sibling artifacts.

Remove the document BOM, normalize CRLF to LF, trim trailing spaces on each line,
keep line order, leading whitespace and internal comments. Join H1 and the region
with one LF; end with exactly one LF. Compute `sourceSha256` via the stdin digest
primitive in `.unikit/system/research-link.md` → `### Digest` (shasum, then
sha256sum); no temporary files and no model-invented cryptography. This input is
different from a plan's `Summary SHA256`; never substitute one digest for the other.

Missing/ambiguous H1 or markers → keep the readable research in the index, use only
its available title/slug for a limited summary, print `WARN [research-index]
<scope>/<slug>: limited source — title-only summary, cache disabled`, and omit its
cache entry. No digest tool → generate normally but print WARN and omit reusable
entries. Neither condition excludes a readable manifest or blocks the save.

## Shape and reuse

Each scope has `INDEX.cache.json` beside `INDEX.md`:

```json
{"schema":1,"summaryVersion":1,"language":"ru","entries":{"example":{"sourceSha256":"<64 hex>","summary":"<text>"}}}
```

`language` is the resolved artifact language, never hardcoded to the example.
`summaryVersion: 1` identifies the rule below; increment it when that rule changes.
Validate JSON, schema, summaryVersion, language, entries and each entry's digest
(64 hex) and nonempty string summary before reuse. Reuse only when all versions,
language and the current source digest match, preserving the summary verbatim.
Updated, Archived, mtime and a previous index description are never proof of reuse.
Changing the source without changing Updated invalidates the entry. Metadata-only
or Sessions-only changes outside the input preserve reuse but refresh table fields.

Missing cache is normal `INFO [research-index] <scope>: cold start`. Malformed cache
or unsupported schema → WARN with the reason and regenerate; ignore invalid entries
individually. An absent fingerprint in an old index never counts as a checked hit.

Before archive/restore batch rebuilds, snapshot both old caches in memory. The writer
may look up a moved slug in the other snapshot, under exactly the same checks.
Do not let rebuilding the first scope destroy the second's reuse candidates.
New caches contain only successfully indexed real folders of their own scope;
deleted folders and limited-source entries disappear. Cache membership never adds
a research that is absent on disk.

## Generate and check

The agent writes one sentence identifying the subject and question from the input,
retaining distinguishing search names and important qualifications. Aim for about
200–250 characters; this is a soft guide, never a truncation position or rejection
threshold. Do not enumerate all findings/decisions or turn a proposal into an accepted
decision. Before writing, check the sentence against the input for faithful scope,
qualifications and no invented claims. Never shorten the manifest to fit the index.

Print verbose per-slug generated/reused reasons without source text, and totals
`INFO [research-index] <scope>: generated N, reused N, limited N`.

## Commit derived files

Prepare the whole index and cache in memory. Write INDEX.md first, then its cache.
Cache write failure → WARN with scope/path; keep the successful index and move.
The next authorized writer can regenerate. Cache is optional derived state, never
listed in a research's Artifact Index and never in that research's coherence scope.

## Final source check after the gate

The saving session retains each input used at the initial render. After every gate
repair, including user-authorized save with new OQ entries, and before confirming,
compare final inputs to those retained. A changed input requires a new summary for
that slug and a whole active render, reusing unchanged entries under the same rules.
Unchanged input (e.g. only Gate/Sessions edits) → no second write. Without a digest
tool compare normalized input text in memory for this same-run check; still persist
no reusable entry. No extra coherence pass and no changed gate budget. Check the
derived sentence here: the coherence gate does not automatically check the index.
