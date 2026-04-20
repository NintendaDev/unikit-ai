# Documentation Review Checklists

## Technical Checklist

Verify structure, links, and completeness:

- [ ] README.md is under 150 lines
- [ ] README has: title, tagline, tech stack table, quick start, documentation table, license
- [ ] Each docs/ file has prev/next navigation header following the Documentation table order
- [ ] First doc page has no prev link; last page has no next link
- [ ] Each docs/ file has "See Also" section at bottom with 2-3 related links
- [ ] No content was lost during split/reorganization
- [ ] All internal links work (no broken references, no dead anchors)
- [ ] Code examples use the project's actual commands/syntax
- [ ] {{engine_name}} version matches `ProjectSettings/ProjectVersion.txt`
- [ ] Assembly names match real `.asmdef` files
- [ ] File paths reference real files in the project
- [ ] Class/interface names match actual code
- [ ] Framework versions match `Packages/manifest.json`
- [ ] Namespace examples follow the project's actual convention
- [ ] No duplicate content between README and docs/
- [ ] No scattered root-level `.md` files that should be in docs/
- [ ] Tech stack table populated from actual detection, not invented

## {{engine_name}}-Specific Checklist

Verify {{engine_name}} project documentation accuracy:

- [ ] Entry scene path is correct (verify scene exists)
- [ ] Module catalog lists all actual modules (compare with `Assets/Modules/`)
- [ ] Assembly dependency graph matches real `.asmdef` references
- [ ] DI installer map matches actual `*Installer.cs` files
- [ ] Signal/event catalog matches actual signal structs in code
- [ ] Test assembly list matches real test `.asmdef` files
- [ ] Excluded folders (`Plugins/`, `Third-Party Assets/`) are not documented as project code
- [ ] `docs-config.json` detected_stack matches reality

## Readability Checklist — "New User Eyes"

Read every page as if you are a developer who has **never seen this project before**. For each page, verify:

### First 10 seconds (above the fold)
- [ ] Can I understand what this project does within 10 seconds of reading README?
- [ ] Is the tagline clear and specific — not vague marketing?
- [ ] Is the Tech Stack table easy to scan?
- [ ] Is there a clear "how to open in {{engine_name}}" instruction?

### "Show, don't tell"
- [ ] Does README list real key features, not abstract descriptions?
- [ ] Do code blocks show real paths, real class names, real namespaces?
- [ ] Are examples concrete — no `<placeholder>` that the user must replace?

### Scannability
- [ ] Can I find any specific topic in under 5 seconds by scanning headers?
- [ ] Are paragraphs short (max 3-4 lines)?
- [ ] Are lists used instead of comma-separated inline enumerations?
- [ ] Are tables used for structured data (modules, assemblies, signals)?

### Jargon and assumptions
- [ ] Does the docs page explain framework-specific terms on first use?
- [ ] Are there no assumptions about internal knowledge?
- [ ] Would a developer new to this project understand each page without asking a colleague?

### Navigation and flow
- [ ] After reading README, is it clear where to go next?
- [ ] After finishing any docs/ page, do prev/next links and "See Also" guide logically?
- [ ] Is the Documentation table ordered by the path a new user would follow?

### Motivation
- [ ] Does the README answer "what is this?" before "how does it work?"
- [ ] Does the docs structure feel inviting, not overwhelming? (max 8-10 doc pages)

## Standards Compliance Check

Compare existing docs against current Core Principles. Common gaps:

| Missing standard | How to detect | Auto-fix |
|------------------|---------------|----------|
| No prev/next navigation | Header has only back link without sibling links | Add prev/next links following Documentation table order |
| No "See Also" section | File ends without `## See Also` | Add section with 2-3 related page links |
| Old navigation format | Link path or text doesn't match current pattern | Update to current format |
| Missing Documentation table | README has no table linking to docs/ pages | Add table |
| README too long | README over 150 lines despite docs/ existing | Propose moving excess to docs/ |
| Stale tech stack | Versions in docs don't match manifest.json | Update versions |
| Missing modules | New modules added since last doc generation | Add to project-map.md |
| Dead assembly refs | `.asmdef` renamed or removed | Update assembly references |

**When gaps are found**, include them in the audit report. Treat as regular improvements — show the plan and get user approval before applying.

**Do NOT ask about skill versioning** — silently detect what's missing and fix it.

## Presenting the Review

After running all checklists, present a summary:

```
Documentation Review

Technical:
  [ok] All links verified (14 internal links, 0 broken)
  [ok] README is 108 lines
  [ok] All pages have navigation
  [warn] docs/di-bindings.md references old installer name — needs update

{{engine_name}}-Specific:
  [ok] {{engine_name}} version correct (6000.0.68f1)
  [ok] All 6 domain modules documented
  [warn] New assembly Pawnshop.MiniGames.Stub not in project-map.md

Readability:
  [ok] README explains purpose in first 10 seconds
  [ok] All examples use real paths
  [warn] docs/architecture.md has a 12-line paragraph — should be split

Fixes applied:
  -> Updated installer name in docs/di-bindings.md
  -> Added Pawnshop.MiniGames.Stub to project-map.md
  -> Split long paragraph in docs/architecture.md

All checks passed [ok]
```
