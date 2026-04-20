# Explore Brief Filling Rules

## Section-by-Section Instructions

**CONTEXT**
Fill in 4-5 lines. Facts only, no explanations. Stop condition — explicitly state
what is NOT in scope for this part of the task.

**CONSTRAINTS**
Extract all architectural decisions from the research like "use X instead of Y",
"do not do Z". Each decision — one line with MUST or FORBIDDEN prefix.
Minimum 4 lines. Name specific methods, classes, patterns — not abstractions.

**INTERFACES**
Only interfaces with changed or new contracts. For each:
- Add tag: `[NEW]`, `[MODIFY]` or `[EXTEND]`
- For MODIFY add `// REMOVE:` and `// ADD:` comments
- Include one-line comments for non-obvious members
- Write namespace as first line inside code block

**KEY PATTERNS**
Extract code from the research that the agent should use as a template.
Include only patterns that are non-trivial or project-specific.
Add a one-line comment — context of where it is used.

**DEPENDENCY GRAPH**
Build a dependency graph only for new and modified classes.
Format: each class with indentation lists its dependencies via `<-`.
Order in the graph = recommended implementation order (from independent to dependent).

**FILES / CREATE**
Include all files from the research "New files" section.
Type column: interface / abstract class / class / signal / ASPID VM / ASPID V
Notes column: reference "see INTERFACES" if contract is described above, otherwise brief note.

**FILES / MODIFY**
Include all files from the research "Modified files" section.
Change — one line, specific: `+method`, `-method`, `type A -> type B`.

**DI BINDINGS**
Copy bindings from the research verbatim. Specify in comment:
which Installer and which method to insert into.

**OUT OF SCOPE**
Extract open questions, deferred features, stop condition from the research.
Formulate as an action that should NOT be done: not "day saving", but
"implement Save/Load for IDayCustomersManager".

## What NOT to Include in Explore Brief

- Explanations of "why" a decision was made
- Comparisons of alternatives (event vs Observable, etc.)
- Change history and commit references
- ASCII diagrams from the research (they are for humans)
- Any prose text outside code blocks and tables

## Output Format

Strictly follow the template structure. Do not add sections not in the template.
Do not remove sections even if they seem empty — fill with placeholder `N/A`.
Code blocks — always specify language (```csharp).
Tables — align columns.

## Verification Before Saving

Go through the checklist:
- [ ] Each CONSTRAINT names a specific class/method/pattern
- [ ] Each interface in INTERFACES has a [NEW/MODIFY/EXTEND] tag
- [ ] DEPENDENCY GRAPH is ordered from independent to dependent
- [ ] FILES/MODIFY does not contain files from FILES/CREATE and vice versa
- [ ] OUT OF SCOPE contains stop condition from CONTEXT (duplicate explicitly)
- [ ] No prose explanations outside code blocks
