# Large Sources (folder / PDF / oversized files)

The `unikit-memory` research pipeline loads this file from `research-pipeline.md` B.1
("File input") when the source is a **folder**, a **PDF**, or a **text file too large
to read in one pass**. A naive `Read` either blows the context window or silently
truncates the source; this file is the staged-extraction workflow that keeps coverage
honest. After extraction you return to B.1's Source Inventory and continue the normal
pipeline (B.2 Context7 → B.3 Synthesize).

The goal is to fit the agent context **without losing structure** — extract a map
first, then sample intentionally.

## Workflow

1. **Extract** — turn the folder / PDF / large file into a `source-index.md` + chunk
   files (use the helper below when Python 3 is available; otherwise extract manually).
2. **Map first** — read `source-index.md`, then build a topic map. Do **not** read
   chunks linearly for a book.
3. **Sample intentionally** — open only the chunks each rule section needs, in this
   priority order:
   1. Table of contents or headings
   2. Introductions to each major part
   3. Checklists, summaries, and examples
   4. Sections that explain core techniques
   5. Edge-case sections and warnings
4. **Inventory** — add every extracted document to the B.1 Source Inventory (one row
   per document; fill `Gaps` for anything you could not read).
5. **Continue the pipeline** — feed the sampled material into B.2 (Context7) and B.3
   (Synthesize). Distill, don't copy — never paste raw chunks into a rule.
6. **Clean up** — extraction artifacts are working files, never rule content (see
   "Temporary Artifacts" below).

## Helper Script (probe-gated)

Use the helper **only when a working Python 3 interpreter is available**. Detect and
verify it by running these version probes in order:

```bash
python3 --version
python --version
py -3 --version
py --version
```

Use the first command that exits successfully and reports `Python 3.x`:

- `python3 --version` → `python3`
- `python --version` → `python`
- `py -3 --version` → `py -3`
- `py --version` → `py`

Then run the helper with that concrete command shape, using the **installed skill path**
(the same `{{skills_dir}}/{{self_name}}` idiom the router uses for its reference files —
never a source-tree path):

```bash
python3 {{skills_dir}}/{{self_name}}/scripts/material-prep.py <source...>
```

Use `python`, `py -3`, or `py` only if that was the selected Python 3 command. If no
probe reports Python 3, do **not** call the helper — fall back to the manual strategy
below and state the coverage limitation in the Final Step report.

The script:

- accepts local files, local folders, and URLs
- converts GitHub `blob` URLs to raw downloads when possible
- extracts text from PDFs with Python libraries when present (pypdf → PyPDF2 →
  pdfminer.six), then falls back to the `pdftotext` CLI (now louder — see
  "PDF extraction" below)
- extracts **FB2** and **EPUB** books with the standard library only (no new
  dependencies) and explicitly **rejects** MOBI/AZW (see "Supported book formats")
- walks directories while skipping common generated/vendor folders, hidden paths, and
  credential-like paths by default
- writes a `manifest.json`, a `source-index.md`, and chunk files; for sources that carry
  real headings (FB2, EPUB, markdown) the index also gains a `## TOC` (heading → chunk
  file) and each chunk file gets a `Headings:` breadcrumb
- writes output to a fresh temporary directory by default

**Supported flags (only these survived the port — do not pass any others):**

- `--out <dir>` — write to a specific output directory. Use only an empty directory or
  one previously created by this helper.
- `--chunk-chars <n>` — approximate max characters per chunk (default `18000`).
- `--cleanup <dir>` — remove an extraction output directory created by this helper
  (see "Temporary Artifacts").

There are **no** `--include-hidden` / `--include-sensitive` / `--include-symlinks` flags
and **no** source-map redaction flag — the helper applies safe defaults (skips hidden,
credential-like, and generated/vendor paths) with no opt-out, and provenance redaction
is not a knowledge-base concern. Passing an unknown flag makes the script exit non-zero.

Read `source-index.md` first, then read only the chunks each rule section needs.

## Supported book formats

The helper extracts these book formats with the **standard library only** — no new hard
dependencies:

- **FB2** (`.fb2`, plus the zipped `.fb2.zip` container) — parsed with `xml.etree`. The
  `<section>`/`<title>` hierarchy becomes markdown headings (`#`/`##`/`###`).
- **EPUB** (`.epub`) — read as a ZIP; reading order comes from the OPF spine and each
  spine document's `<h1>`–`<h3>` become markdown headings.

Because both formats guarantee headings, the extracted output drives a real `## TOC` in
`source-index.md` (heading → chunk file, grouped per document) plus a `Headings:`
breadcrumb at the top of each chunk file — so "map first, sample intentionally" runs
against an actual table of contents instead of blind offsets.

**MOBI / AZW / AZW3 are recognized but rejected.** They are binary, proprietary Kindle
containers the helper does not read. A single `.mobi` source fails with a clear message
(non-zero exit); inside a folder each rejected book is reported by name on stderr and
skipped (a coverage gap for that file). When you hit this, ask the user for an **EPUB
export** of the same book and re-run.

Archives (EPUB, `.fb2.zip`) are read **in memory** with size/member caps (zip-bomb guard)
and never extracted to disk; XML is parsed without external entities (XXE / billion-laughs
guard).

## PDF extraction

- For PDFs — **especially non-English (Cyrillic) ones** — install a Python PDF library
  first: `pip install pypdf`. Without one the helper falls back to the `pdftotext` CLI,
  which can silently drop non-Latin glyphs. That fallback now prints a loud `WARN` on
  stderr so the degradation is visible instead of silent.
- **Inspect chunk _files_ with the `Read` tool (UTF-8), not `cat`/`type`.** On a Windows
  console `cat`/`type` re-encodes non-ASCII text and makes healthy Cyrillic extraction
  *look* corrupted — open the chunk file directly instead.

## Chunk size and Cyrillic

The default `--chunk-chars 18000` is character-based. Cyrillic text averages more tokens
per character than English, so a Cyrillic chunk carries more tokens than the same-size
English one. The default is left as-is on purpose (no script-level language detection —
that would be premature optimization); lower `--chunk-chars` by hand if a Cyrillic source
pushes chunks past a comfortable context budget.

## Manual Strategy (no Python 3, or helper unusable)

When the helper is unavailable, extract by hand and be explicit about coverage:

- **Text / markdown / code file** — read in segments: headings first, then the sections
  each rule needs. Record which parts you skipped in the Source Inventory `Gaps` column.
- **Folder** — list the files, group them by topic, and read only the on-topic ones;
  skip generated / vendor / hidden / credential-like paths yourself.
- **PDF** — try, in order: (1) a different extractor if one is available; (2) ask the
  user for a text/markdown export; (3) distill only the accessible pages if the user
  accepts partial coverage. **Never pretend a full book was processed when only a sample
  was readable** — say so in the Final Step report.

## Temporary Artifacts

Extraction artifacts are working files, **not** knowledge-base content.

- Never write raw extracted full text, chunk files, or downloaded PDFs into a rule file
  or its `references/`.
- Remove the extraction directory once the rule is written.

Preferred cleanup command (same probe-selected Python 3 command):

```bash
python3 {{skills_dir}}/{{self_name}}/scripts/material-prep.py --cleanup <temp-dir>
```

The cleanup guard removes only directories carrying this helper's dedicated marker file.
If no probe reports Python 3, remove only known helper-generated temp files manually. If
cleanup cannot be completed, report the exact temporary path to the user.
