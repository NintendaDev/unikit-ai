# unikit-plan — Recon file template

The form of one reconnaissance answer of an ultra plan written with saved state:
`.unikit/code/plans/<feature-name>/.planning/recon/<topic>.md`, in English. `recon-writer-agent`
fills it; the planning session reads it back a section at a time (`ultra-stateful.md` →
`## Recon files`).

The file has two layers. The head — `## Summary` and `## Contents` — is short, and it is all that
reaches the planning context: the agent returns its `## Summary` as its reply, and a reader opens the
file at the head and follows `## Contents` to the one section it needs. Everything below the head is
the answer itself, written whole and never condensed.

## Template

```markdown
HEAD: <short sha>
Question: <the question, one line>
Paths: <abbreviation = root · … — only when the sections below shorten long paths>

## Summary
- <a headline fact, its numbers exactly as found>
- Touches: <the paths the phases will change>
- Forces: <a decision the current code forces on the plan>
- Gaps: <what could not be established — or none>

## Contents
| Section | Lines | Covers |
|---------|-------|--------|
| ## Current-Code Evidence | <from-to> | <the paths and symbols in it> |
| ## Interfaces | <from-to> | <the types and members in it> |
| ## Tests and Fixtures | <from-to> | <the tests and fixtures in it> |
| ## Logging | <from-to> | <the log points in it> |
| ## Topic: <name> | <from-to> | <what it holds> |
| ## Gaps | <from-to> | <the open points> |

## Current-Code Evidence
| Path | Symbols / lines | Why it matters |
|------|-----------------|----------------|

## Interfaces
<exact signatures, as they stand in the code>

## Tests and Fixtures
<the tests and fixtures that cover this ground, and what they assert>

## Logging
<the log points on this path and their fields>

## Topic: <name>
<material specific to this question — a data table, a rule set, a flow; one section per topic>

## Gaps
<what the answer could not establish, and why>
```

## Rules

- **Every section is written, in this order.** A section with nothing to say holds `none`. A fixed set
  of headings is what lets a reader find a section without opening the file.
- **`## Summary` holds at most 30 lines.** It is the one condensed part of the file: the facts a plan
  is built on, numbers copied exactly, no reasoning. The writing agent returns it as its reply, word for word.
- **`## Contents` lists every section below the head**, `## Topic:` sections included, with its line
  range and what it covers — paths, symbols, topics — so a reader can pick a section without opening
  it. Write the file with `—` in the `Lines` column, then take the numbers from `grep -n '^## '` on the
  written file and put them in: the table keeps its length, so the numbers stay true.
- **Below the head the answer is whole, never condensed** — every row, number, formula, path and
  signature found. `## Topic:` sections carry what the fixed sections cannot; there may be none or
  several.
- `## Gaps` is the last section.
