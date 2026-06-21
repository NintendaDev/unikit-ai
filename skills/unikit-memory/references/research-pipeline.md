# Research Pipeline (Branch B)

The `unikit-memory` router loads this file when the resolved intent is **RESEARCH**
(or when Branch A escalates to research in A.4). It is the module-agnostic research
workflow: gather material, enrich, synthesize, then write into the active module's
tiers. All file-format and scope decisions defer to the module contract
(`references/module-<id>.md`); this file owns only the workflow.

Prerequisites carried in from the router: the resolved `moduleId`, its `tiers`, the
target tier and file (Step 2), `integrationIntent`, and the loaded module contract.

## B.1: Gather Material

**Source Inventory (build as you gather — show it to the user).** Before deep
extraction, log every source in a running inventory table. It is a cheap planning
artifact that keeps multi-source research honest about coverage and gaps:

| Source | Type | Scope | Signal | Gaps |
|--------|------|-------|--------|------|
| {URL / path / "training knowledge"} | docs / book / code / paper / tutorial / notes | what it covers | why it matters for this rule | missing context that may need another source |

- One row per URL, file, folder, or Context7 library you pull from.
- Fill `Gaps` honestly — a non-empty `Gaps` cell is the signal to run an extra
  `WebSearch` (the enrich phase below) or to note a coverage limitation in the
  Final Step report.
- Surface the finished inventory to the user as part of the research summary. It
  doubles as the provenance record for the `## Source Map` the module contract may
  ask you to persist in the rule file (see the contract's "Source Map" / provenance
  format — the inventory's rows map straight onto it).

Depends on the original input type from Step 1:

**URL input** — Two-phase deep extraction.

*Phase A — Collect & Study.* For EACH URL:

1. **Fetch the page** using `WebFetch` with a targeted prompt:
   ```
   WebFetch(url, "Extract ALL key information about this framework/technology:
   - Main topic and purpose
   - Key concepts, terms, and definitions
   - Code examples and usage patterns
   - API methods, parameters, return types
   - Configuration options
   - Best practices and recommendations
   - Anti-patterns and common mistakes
   - Links to related important pages
   Provide a comprehensive, structured summary.")
   ```
2. **Assess depth** — if the page references critical sub-pages (API reference, guides, examples), fetch those too (up to 5 additional pages per source URL, prioritize by relevance).
3. **Record findings** — for each source, capture: topic, core concepts, practical patterns with code examples, configuration / API surface, common pitfalls.
4. If a URL fails, report and continue with others.

*Phase B — Enrich with Web Search.* After collecting all URLs, evaluate coverage gaps. If the fetched URLs don't already provide comprehensive coverage, run 1-3 targeted `WebSearch` queries:

- `"<framework> best practices"` — latest recommendations
- `"<framework> common mistakes"` — pitfalls to document
- `"<framework> cheat sheet"` — concise reference material

Skip this phase if the URLs already cover the topic comprehensively.

**File input** — Two-phase enrichment.

1. Load the source content:
   - **Single small text file** (`.md` / `.txt` / `.json` / `.yaml` that fits in
     context) → use `Read` directly.
   - **Folder, PDF, or a file too large to read in one pass** → do **not** naively
     `Read` it. When the large-source pipeline is present
     (`{{skills_dir}}/{{self_name}}/references/large-sources.md`), load that file and
     follow its TOC-first → topic-map → chunk → cleanup workflow, then bring the
     distilled chunks back here. Add every extracted document to the Source Inventory
     above. If the large-source pipeline is absent, fall back to reading the largest
     readable portion and record the coverage limitation in the inventory's `Gaps`
     column.
2. Identify the framework/technology/topic from the loaded content.
3. Run 1-3 targeted `WebSearch` queries to enrich and validate:
   - `"<topic> best practices"` — latest recommendations
   - `"<topic> common mistakes"` — pitfalls to document
   - `"<topic> cheat sheet"` or `"<topic> API reference"` — concise reference material
4. For each promising search result, use `WebFetch` to extract detailed content (up to 3 pages).
5. B.2 will perform Context7 enrichment — do not skip web search here.

**Mixed input (URL + File)** — Process both sources together.

1. Apply the **URL input** pipeline to all http(s) URLs (WebFetch + conditional WebSearch).
2. Apply the **File input** pipeline to all file paths (Read + WebSearch).
3. Merge all gathered material before proceeding to B.2.

**Description input** (exploratory tone):

1. Use the provided text to identify the target framework/technology/topic.
2. Run 1-3 targeted `WebSearch` queries to gather material:
   - `"<topic> best practices {{engine_name}}"` — recommended approaches
   - `"<topic> common mistakes"` — pitfalls to document
   - `"<topic> cheat sheet"` or `"<topic> API reference"` — concise reference material
3. For each promising search result, use `WebFetch` to extract detailed content (up to 3 pages).
4. B.2 will attempt Context7 enrichment — but do not skip web search here.

**Interactive mode**: Ask the user which framework or technology they want to document. Offer examples based on the project's tech stack from `DESCRIPTION.md`.

## B.1.5: Upgrade Integration Intent (post-fetch)

This step applies only to tiers the module contract gates for integration content
(e.g. the `code` module's `stack` tier). After B.1 finishes gathering material, scan
the collected content for the post-fetch integration signals (T3) defined in the
module contract's "Integration Intent" section. If any such signal is found AND
`integrationIntent` is currently `false`, upgrade it to `true` — this honors
user-supplied sources that document an integration even when the original prompt did
not ask for it. If no signals are found, leave `integrationIntent` unchanged.

## B.2: Enrich with Context7

Always attempt when a specific framework/topic was identified:

1. Use `mcp__context7__resolve-library-id` to find the library ID.
2. Query the documentation with `mcp__context7__query-docs` across **all** topics (separate queries for each):
   - **Usage patterns** — key API conventions, core workflows, typical setup
   - **Best practices** — recommended approaches, idiomatic usage, performance tips
   - **Cheat sheets** — quick reference for common operations, method signatures, configuration options
   - **Common mistakes** — typical errors, pitfalls, misuse patterns, debugging hints
3. Integrate relevant findings into the gathered material.

**Fallback:** If context7 tools are unavailable or the lookup fails — print a yellow warning and proceed with web search results and training knowledge:

```
⚠️ Context7 MCP is not available — documentation enrichment skipped. Results may be less comprehensive.
```

Use yellow/warning styling if the output supports it. Do not block the workflow — this is informational only.

## B.3: Synthesize

Combine all gathered material (B.1 input + B.2 enrichment) into a structured Knowledge Base.

Structure the material into these sections (omit empty ones):

- **Core Concepts** — key terms, definitions, fundamental ideas
- **API / Interface** — method signatures, parameters, return types, key classes
- **Patterns & Examples** — practical code examples with context on when to use each
- **Configuration** — setup options, defaults, valid values, initialization patterns
- **Best Practices** — recommended approaches with reasoning
- **Common Pitfalls** — typical mistakes, what goes wrong, how to avoid

Keep only information relevant to using the framework in a {{engine_name}}/{{engine_code_language}} project. Discard web-framework specifics, non-{{engine_name}} platforms, and irrelevant content. Transform passive documentation into actionable rules ("Use X when..." instead of "X is a feature that...").

**Distill, don't copy.** Synthesis is transformation, not transcription. Never paste
long verbatim passages, marketing prose, or whole doc pages into a rule — rewrite
every borrowed idea in your own words as an actionable rule, heuristic, or checklist.
For code: when a source teaches a practice through an example, author an **original**
snippet that preserves the lesson without copying the source's code, and keep it in the
{{engine_code_language}} ecosystem unless the user asked otherwise. When two sources
conflict, keep the stronger rule and note why — retain both only when the context
genuinely differs.

**Example coverage (content-driven).** Decide per rule whether a worked example earns
its place: *will a concrete example make this rule easier to apply than prose alone?*
This is a **content** question, not a tier question — apply it to every tier the module
defines (for `code`, that means `core` rules like code-style / testing / performance
get examples too, not only `stack`). **What counts as an "example" is defined by the
active module contract** — code snippets for the `code` module; numeric tables, worked
formulas, or before/after tuning for `gamedesign`. While synthesizing, keep a quick
example inventory:

| Rule / topic | Example type | Distilled example target |
|--------------|--------------|--------------------------|
| {topic} | snippet / before-after / decision table / test / anti-pattern | {section in the rule, or "skip: prose is sufficient"} |

The inventory is a planning tool — it is not shipped. But the final rule file's
examples must visibly cover the major topics it raises; a topic may be left
example-free only with a specific reason (e.g. "covered by checklist; no reusable
pattern"). A rule that raises many code-facing topics yet shows only one or two
examples is incomplete — this is exactly what the Quality Gate re-checks before the
Final Step.

**Scope Isolation:** Apply the module contract's "Scope Isolation" section as a
second, independent pass over the synthesized material. The contract defines which
tier(s) it governs and the exact allowed/forbidden cases for integration content
based on `integrationIntent`. For the `code` module this applies to `stack` rules
only; `core` rules are framework-agnostic by construction and exempt. Run the
contract's self-test before writing.

## B.3.5: Identify Reference Candidates

Run the module contract's **Candidate Analyzer** ("Reference Candidate Extraction"
in `references/module-<id>.md`) over the synthesized content: score each block on
the three signals (**size** ≳ 40 lines / ≳ 1500 chars, **optionality**, **lookup
shape**) and sort the candidates into **Tier 1** (clear wins — large AND
optional/lookup) and **Tier 2** (borderline — one signal, or size near the
threshold). This is the same engine the retroactive `optimise` pass uses, so
on-add and optimise present candidates identically. Reference files live under the
rule's **own tier** `references/` subfolder as defined by the contract — for `code`
that now includes `core/references/`, not just `stack/references/`.

**Merge guard — check existing files before creating new ones (#9).** Before you
propose any *new* reference file, list what already exists for this rule: the target
rule file, its sibling rule files in the tier, and any files already in the tier's
`references/` subfolder. Match each intended topic against existing filenames and
headings. If an existing file already covers the topic, **update it** instead of
spawning a near-duplicate — keep filenames stable so future updates don't fragment the
rule (this mirrors the contract's "Anti-fragmentation / stable filenames" guidance).
Propose a brand-new reference file only for a genuinely new topic. Thread each
keep-vs-create decision into B.5 so the write step touches the right file. The
proposal below stays interactive regardless — the merge guard only changes *which*
files the proposal lists.

**Always report the analyzer result — including zero.** Reference extraction is a
visible decision, never a silent skip.

**If 0 candidates found** — say so explicitly with the reason ("0 candidates —
every section is conceptual, small, or read top-to-bottom"), then skip to B.4. Do
not stay silent about it.

**If 1+ candidates found** — present them **grouped into Tier 1 and Tier 2** (each
proposed reference file with what it contains, which of the three signals fired, and
the split strategy, per the contract's format) before writing anything, then use
`AskUserQuestion`:

Options:
1. Extract **Tier 1 only** — the clear wins
2. Extract **Tier 1 + Tier 2** — also the borderline blocks
3. Adjust — rename, merge, split, drop a file, change strategy, or move a block between tiers → revise proposal and ask again
4. No — keep all data inline in the main rule file

- **Tier 1 only / Tier 1 + Tier 2 / approved Adjust** → mark the approved files for creation; proceed to B.4.
- **No** → skip reference extraction; proceed to B.4 with all content staying inline.

## B.4: Cross-Check & Gap List (if target file exists)

**Same logic as A.2** in SKILL.md — read the existing file and related files, compare,
resolve contradictions with the user, and produce the **gap list** (what the new
material adds, what it changes, what it leaves untouched) that A.2 makes the default
behaviour for any update. A.2 is the single canon for this procedure; do **not** restate
the gap-list mechanics here. Carry the gap-list result forward into B.5.

If the target file doesn't exist — skip this step.

## B.5: Generate / Update File

Create or update the rule file following the **File Format Template** from the module contract. If updating, merge into existing sections without overwriting useful content.

If reference files were approved in B.3.5:
1. For each approved reference, **create a new file or update the existing matching file
   per the B.3.5 merge guard** — never fork a near-duplicate when a stable filename
   already holds the topic. Follow the **Reference File Format** from the module contract.
2. Add `> **References**:` to the main rule file header, listing each file with a one-word parenthetical (e.g., `(quick lookup)`, `(exhaustive index)`, `(converter catalog)`).
3. Add a `## {Content} Lookup Workflow` section to the main rule file instructing the LLM when to open which reference. Do **not** duplicate catalog data in the main file — only pointers and instructions.

If a NEW file was created — update `RULES_INDEX.md` (add row to appropriate table in alphabetical order).

→ Return to the router's **Final Step: Confirm**.
