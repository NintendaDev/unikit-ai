# Module Contract — `code`

This file is the **content and format contract** for the `code` knowledge-base
module. The `unikit-memory` router loads it (relative to its own skill directory:
`{{skills_dir}}/{{self_name}}/references/module-code.md`) **after** it resolves the
active module to `code`. Everything that is specific to *what the code module
stores* and *how its rule files are shaped* lives here — the router body stays
module-agnostic and never hardcodes tier names, paths, or templates.

A future module (`gamedesign`, `library`, …) ships its own
`references/module-<id>.md` with the same section layout; the router picks the
right one by id.

## Module Identity

| Field | Value |
|-------|-------|
| `id` | `code` |
| `tiers` | `core`, `stack` |
| `enginePartitioned` | `true` (registry side: `<registry>/code/<engine>/<tier>`) |
| `skillPrefix` | `unikit` |
| Memory layout | `.unikit/memory/code/<tier>` → `.unikit/memory/code/core/`, `.unikit/memory/code/stack/` |
| Reference subfolder | `.unikit/memory/code/stack/references/` (supplementary lookup docs for stack rules) |
| Index file | `.unikit/memory/code/RULES_INDEX.md` |

These values mirror the `code` entry in `.unikit/system/modules.yml`. When the
router and this file disagree, `modules.yml` wins for structural fields
(`tiers`, `enginePartitioned`); this file is authoritative for tier *semantics*
and file *format*.

## Tiers — What Belongs Where

- **`core/`** — universal best practices independent of any framework: code style
  and naming conventions, design principles and architectural patterns, testing
  conventions, performance guidelines.
- **`stack/`** — framework- and library-specific rules: API patterns,
  conventions, anti-patterns, and code examples for tools like Zenject, DOTween,
  R3, UniTask, Addressables, etc.

### What belongs in which tier

- Code style conventions and naming rules → `core/`
- Design principles and architectural patterns → `core/`
- Testing conventions and best practices → `core/`
- Performance guidelines → `core/`
- Framework usage patterns and conventions → `stack/`
- Library-specific API rules and code examples → `stack/`
- Technology-specific anti-patterns and best practices → `stack/`
- Cross-framework integration guidelines → `stack/` **only when the user
  explicitly requests them or they are present in provided sources** (see the
  Scope Isolation section). Never auto-generated from the project stack.

## What Does NOT Belong in This Module

- **Architecture decisions** (module boundaries, dependency flow, DI structure) →
  `.unikit/ARCHITECTURE.md`
- **Project-specific overrides** (explicit deviations from core/stack rules) →
  `.unikit/RULES.md` via the `unikit-rules` skill

If the user provides content that falls into these categories, inform them and
suggest the correct destination. For RULES.md content, suggest using the
`unikit-rules` skill instead.

## Content Classification (tier selection)

When the router has classified the **intent** and reaches content classification,
pick the tier for the `code` module:

1. **`core` or `stack`?**
   - **`stack`** — content about a specific framework or technology (Zenject,
     DOTween, R3, etc.) → `.unikit/memory/code/stack/`
   - **`core`** — content about universal practices (code style, design
     principles, testing, performance) → `.unikit/memory/code/core/`
   - **Neither** — redirect the user to the correct destination:
     - Architecture → `.unikit/ARCHITECTURE.md`
     - Project-specific overrides → `.unikit/RULES.md` via the `unikit-rules` skill
     - **Stop here. Do NOT create any files.**

2. **Identify the target file.**
   - For **stack**: framework name → filename (e.g., `dotween.md`, `zenject.md`,
     `addressables.md`)
   - For **core**: topic → filename (e.g., `code-style.md`, `testing.md`,
     `performance.md`). Consult `RULES_INDEX.md` Core section.

3. **Does the file already exist?** Check the target tier directory
   (`.unikit/memory/code/stack/` or `.unikit/memory/code/core/`).

## Scope Isolation (stack rules only)

The rule describes ONLY the target framework/module. Apply this filter as a
second, independent pass over the synthesized material — not as a stylistic
guideline.

- **Always allowed:** other frameworks may appear as *minimal placeholders* in
  examples — an arbitrary async method being converted via `.ToUniTask()`, any
  `IObservable` feeding an R3 subscription, a generic `MonoBehaviour` hosting a
  binding. The example illustrates the target API; the other framework is
  incidental.
- **Forbidden when `integrationIntent=false`:**
  - Dedicated "Integration with X" sections (or equivalent wording)
  - Rules that prescribe how to combine the target framework with another library
  - Code examples whose main point is a cross-framework pattern rather than the
    target API
  - **Do NOT invent integration content from project-stack knowledge.** Even if
    the project's `DESCRIPTION.md` or installed packages show R3, Zenject,
    Addressables, or similar libraries, do not generate integration material
    unless it came from the user's input (prompt, URL, file) or was detected
    post-fetch. Project-stack awareness is for routing decisions only, not for
    content synthesis.
- **Allowed when `integrationIntent=true`:**
  - Integration sections sourced from the user's input or fetched material,
    written as concrete rules/examples
  - All integration content goes into the **main framework's rule file** (the
    framework the rule is primarily about). Never create a separate
    `{X}-{Y}-integration.md` file and never split the integration across both
    framework files.
  - If the "main" framework is ambiguous (the user's input names two frameworks
    symmetrically and both files exist), use `AskUserQuestion` to let the user
    pick the target file before writing.

**Self-test before writing:** mentally remove every mention of other frameworks
from the synthesized content. If the rule becomes incoherent, too much
integration material leaked in — rewrite with tighter scope (or confirm
`integrationIntent=true` applies).

This guardrail applies only to **stack** rules. **Core** rules (code style,
testing, performance, design principles) are framework-agnostic by construction
and are not subject to this filter.

## File Format Template

Use existing rules as a template (stack: `reactive-async.md`, `odin.md`; core:
`code-style.md`, `testing.md`).

```markdown
# {Framework Name / Topic}

> **Scope**: {What this file covers — specific APIs, patterns, conventions}
> **Load when**: {Comma-separated keywords and contexts that trigger loading this file}
> **References**: {Optional — omit if no reference files. List each with a parenthetical label: `.unikit/memory/code/stack/references/{rule-id}-binders-quickref.md` (quick lookup), `.unikit/memory/code/stack/references/{rule-id}-binders-full.md` (exhaustive index).}

---

## {Section 1}

{Rules, code examples, patterns}

## {Section 2}

{More rules}

## {Content} Lookup Workflow

{Optional — include only when reference files exist. Step-by-step instructions for when to open which reference file. Example:
1. First — open `{rule-id}-{content}-quickref.md`. Covers the most common scenarios.
2. If nothing fits — open `{rule-id}-{content}-full.md`. Exhaustive index of all variants.
Do NOT guess — always verify against the reference files.}

## Anti-patterns

{Common mistakes to avoid — if applicable}
```

**Writing `Scope` and `Load when`:**

Both lines must read as **prose**, not as a dump of class names, variable names,
or API identifiers. A future LLM must be able to decide from the header alone
whether this rule is relevant to the task at hand.

- `> **Scope**:` — one sentence answering *"what does this rule cover?"*. Name the
  domain (framework, concern, pattern) and the kinds of decisions the rule helps
  make. Identifiers may appear only as examples of *what* is governed, never as
  the entire answer.
- `> **Load when**:` — one line listing *developer situations* that should trigger
  loading this rule. Phrase from the developer's perspective, using actionable
  gerunds ("authoring …", "wiring …", "debugging …", "designing …"),
  comma-separated. Identifiers may appear only inside a task phrase, never as
  standalone tokens.

**Example — `node-canvas.md`**

Bad (reads like a class list, useless for intent matching):

```
> **Scope**: `Graph`, `Task`, `Condition`, `BT`, `ServiceBus`, `INode`, `NodeCanvas.Framework`
> **Load when**: Graph, Task, Condition, BT, ServiceBus, INode, NodeCanvas
```

Good (reads like prose, tells a future LLM *when* to load this rule):

```
> **Scope**: NodeCanvas behavior tree authoring — custom Task and Condition nodes, service injection via ServiceBus, graph composition patterns, and NodeCanvas.Framework lifecycle hooks.
> **Load when**: building AI behaviors with NodeCanvas, authoring custom Tasks or Conditions, wiring services into a behavior tree, debugging graph execution order, designing reusable BT subtrees.
```

Both lines follow `language.rules` from `.unikit/config.yaml` like the rest of the
prose. Framework names, type names, and other code identifiers stay in English
regardless of the configured language.

**Guidelines:**
- Filename: `lower-case-with-hyphens.md` (e.g., stack: `dotween.md`, `zenject.md`;
  core: `code-style.md`, `testing.md`)
- Location: `.unikit/memory/code/stack/` for Stack, `.unikit/memory/code/core/`
  for Core
- Language: follow `language.rules` from `.unikit/config.yaml` (default: `en`).
  Rule prose, section headings, explanations, and examples use that language.
  Frontmatter keys (`> **Scope**:`, `> **Load when**:`), filenames, rule ids, code
  identifiers, file paths, and framework names always stay in English regardless
  of `language.rules`. See `.unikit/system/LANGUAGE_RULES.md` → "Knowledge base
  rule files" for the full specification. Never prompt the user for this setting
  and never write to it — it is manually edited only.
- Include code examples wherever they clarify usage
- Keep rules actionable — "Use X", "Never Y", "Prefer Z over W"

## Reference File Format

Reference files live in `.unikit/memory/code/stack/references/` and hold
lookup/catalog data extracted from a main stack rule. They have no frontmatter —
they are supplementary documents, not standalone rules.

**Naming convention:** `{rule-id}-{descriptor}.md`

| Part | Meaning | Example |
|------|---------|---------|
| `{rule-id}` | Parent rule filename without `.md` | `zenject`, `aspid-mvvm` |
| `{descriptor}` | Module name, content type, or tier label — whatever best describes the file's scope | `pools`, `factories`, `binders-quickref`, `binders-full`, `converters` |

Examples:
- Module split: `zenject-pools.md`, `zenject-factories.md`
- Lookup tier split: `aspid-mvvm-binders-quickref.md`, `aspid-mvvm-binders-full.md`
- Single reference: `aspid-mvvm-converters.md`

**Internal structure:**

```markdown
# {Parent Rule} — {Descriptor label}

> **Base path:** {optional — package/folder path these names are relative to}
> See also: [{related-reference}.md]({related-reference}.md)    ← cross-link to related reference if applicable

---

## {Lookup Section}

| {Key column} | {Value column} | ... |
|-------------|---------------|-----|
| ...         | ...           | ... |
```

**Writing guidelines:**
- No `Scope` / `Load when` / `References` frontmatter — those belong only to main
  rule files.
- Lead with the most useful lookup table first (task → answer, or type → class).
- Cross-link to related reference files when applicable (e.g., between `quickref`
  and `full` tiers, or between module references that overlap).
- Language follows `language.rules` from `.unikit/config.yaml` (same as main rule
  file).
- Code identifiers, class names, and paths always stay in English regardless of
  `language.rules`.

## Reference Candidate Extraction

After synthesis, scan the structured content for sections that are **large,
rarely needed all at once, or used as a lookup rather than read in full**. Such
sections are candidates for extraction into separate reference files under
`.unikit/memory/code/stack/references/`.

**Extract to a reference file when the content is:**

| Extract → reference | Keep → main file |
|---------------------|-----------------|
| Large subsystem rarely used alongside other parts | Architecture and lifecycle rules |
| Lookup table with 20+ rows | Code templates and examples |
| Exhaustive index of all variants | Naming and file-structure conventions |
| Data the LLM "looks up", not "reads in full" | Configuration and registration patterns |
| Content large enough to distract from conceptual rules | Workflow and decision instructions |

**Choose a split strategy based on content type. Common strategies:**

- **Module split** — the framework has large, independently-used subsystems. Each
  subsystem gets its own reference file. File name: `{rule-id}-{module}.md`.
  *Example: Zenject has pools and factories as large, rarely-needed features →
  `zenject-pools.md`, `zenject-factories.md`.*
- **Lookup tier split** — the framework has a large catalog of variants (classes,
  components, nodes) where the user needs to "pick one". Split into a compact
  quick-reference and an exhaustive index. File names:
  `{rule-id}-{content}-quickref.md` + `{rule-id}-{content}-full.md`.
  *Example: ASPID MVVM has dozens of binders → `aspid-mvvm-binders-quickref.md` +
  `aspid-mvvm-binders-full.md`.*
- **Single reference** — the data is a standalone catalog that doesn't need
  tiering (one file is sufficient). File name: `{rule-id}-{content}.md`.
  *Example: `aspid-mvvm-converters.md` — converter catalog, compact enough as one
  file.*
- **Mixed** — combine strategies when a framework has both large subsystems and
  lookup catalogs.

The choice of strategy is driven by the content: choose what makes sense for this
specific framework, don't force a pattern that doesn't fit.

When 1+ candidates are found, propose the split strategy and exact file list
before writing anything, listing each proposed
`.unikit/memory/code/stack/references/{filename}.md` with what it contains and
why, then confirm with `AskUserQuestion` before creating them. The main rule file
lists approved references in a `> **References**:` header line and includes a
"{Content} Lookup Workflow" section explaining when to open each file. Do **not**
duplicate catalog data in the main file — only pointers and instructions.

## RULES_INDEX.md Format

The index lives at `.unikit/memory/code/RULES_INDEX.md` and carries two tables
(`## Core` and `## Stack`). When adding a new entry:

```markdown
| {FILENAME}.md | {Brief description of what the file covers} | {Comma-separated keywords and contexts} |
```

Place in alphabetical order within the appropriate table (`## Core` or
`## Stack`). When validating the index against disk, scan
`.unikit/memory/code/core/*.md` and `.unikit/memory/code/stack/*.md`, then add
missing rows (read each file's `> **Scope**:` / `> **Load when**:` header) and
remove phantom rows whose files no longer exist.
