# Research Pipeline (Branch B)

The `unikit-memory` router loads this file when the resolved intent is **RESEARCH**
(or when Branch A escalates to research in A.4). It is the module-agnostic research
workflow: gather material, enrich, synthesize, then write into the active module's
tiers. All file-format and scope decisions defer to the module contract
(`references/module-<id>.md`); this file owns only the workflow.

Prerequisites carried in from the router: the resolved `moduleId`, its `tiers`, the
target tier and file (Step 2), `integrationIntent`, and the loaded module contract.

## B.1: Gather Material

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

1. Use `Read` to load the file content.
2. Identify the framework/technology/topic from the file content.
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

**Scope Isolation:** Apply the module contract's "Scope Isolation" section as a
second, independent pass over the synthesized material. The contract defines which
tier(s) it governs and the exact allowed/forbidden cases for integration content
based on `integrationIntent`. For the `code` module this applies to `stack` rules
only; `core` rules are framework-agnostic by construction and exempt. Run the
contract's self-test before writing.

## B.3.5: Identify Reference Candidates

Follow the module contract's "Reference Candidate Extraction" guidance to decide
whether parts of the synthesized content should be split into separate reference
files (large subsystems, lookup catalogs, exhaustive indexes). Reference files live
under the tier's `references/` subfolder as defined by the contract.

**If 0 candidates found** — skip to B.4.

**If 1+ candidates found** — propose the split strategy and the exact file list (per
the contract's format) before writing anything, then use `AskUserQuestion`:

Options:
1. Yes — create all proposed reference files
2. Adjust — user specifies changes (rename, merge, split, drop a file, change strategy) → revise proposal and ask again
3. No — keep all data inline in the main rule file

- **Yes / approved Adjust** → mark the approved files for creation; proceed to B.4.
- **No** → skip reference extraction; proceed to B.4 with all content staying inline.

## B.4: Cross-Check (if target file exists)

Same logic as **A.2** in SKILL.md — read existing file and related files, compare, resolve contradictions with user.

If the target file doesn't exist — skip this step.

## B.5: Generate / Update File

Create or update the rule file following the **File Format Template** from the module contract. If updating, merge into existing sections without overwriting useful content.

If reference files were approved in B.3.5:
1. Create each reference file following the **Reference File Format** from the module contract.
2. Add `> **References**:` to the main rule file header, listing each file with a one-word parenthetical (e.g., `(quick lookup)`, `(exhaustive index)`, `(converter catalog)`).
3. Add a `## {Content} Lookup Workflow` section to the main rule file instructing the LLM when to open which reference. Do **not** duplicate catalog data in the main file — only pointers and instructions.

If a NEW file was created — update `RULES_INDEX.md` (add row to appropriate table in alphabetical order).

→ Return to the router's **Final Step: Confirm**.
