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
| Reference subfolder | `.unikit/memory/code/<tier>/references/` — both `.unikit/memory/code/core/references/` and `.unikit/memory/code/stack/references/` (supplementary lookup / large-optional docs for rules in **either** tier) |
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

## Integration Intent (stack rules only)

The `stack` tier may carry **integration content** — rules about how one framework
combines with another. This is gated behind an explicit `integrationIntent` flag,
**off by default**. The `core` tier is framework-agnostic and never subject to this
gate. The router detects `integrationIntent` while classifying the request and
threads it into the Add Rule / Research workflows; the detection signals live here
because they are specific to this module's `stack` tier.

Set `integrationIntent=true` if **any** of these fire:

- **T1 (prompt text):** $ARGUMENTS contains any of `integration`, `интеграция`,
  `with <framework>`, `связка X и Y`, `X + Y`, `использовать X из Y`, or equivalent
  phrasing that names two frameworks together.
- **T2 (URL or filename):** any input URL path or file path contains the tokens
  `integration` / `integrate` (case-insensitive).
- **T3 (post-fetch content, Research only):** after gathering material, the content
  shows integration signals — headings titled `integration` / `integrate` /
  `with <other framework>`, substantial blocks dedicated to combining the target
  framework with another library (not a one-line mention), or code examples whose
  central point is a cross-framework pattern (**not** a placeholder usage like
  `.ToUniTask()` on an arbitrary awaitable). T3 may upgrade `false` → `true` mid-run.

If none fire, `integrationIntent` stays `false`.

**Threading:** when `integrationIntent=true` and a rule spans two existing framework
files, use `AskUserQuestion` to pick the main framework's file — never split the rule
across both. The exact allowed/forbidden content for each value is defined in "Scope
Isolation" below.

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
> **References**: {Optional — omit if no reference files. Reference files live beside the rule in **its own tier's** subfolder — `.unikit/memory/code/<tier>/references/` (a core rule → `core/references/`, a stack rule → `stack/references/`). List each with a parenthetical label: `.unikit/memory/code/<tier>/references/{rule-id}-binders-quickref.md` (quick lookup), `.unikit/memory/code/<tier>/references/{rule-id}-binders-full.md` (exhaustive index).}

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

## Source Map

{Optional — include ONLY when the rule was synthesized from external sources (URLs,
files, folders, PDFs, Context7). Persists the B.1 Source Inventory as provenance. OMIT
the section entirely for a sourceless manual Add Rule. Format:
| Source | Used for |
|--------|----------|
| {url-or-path} | {sections / rules / examples it informed} |
}
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
- **Example coverage (content-driven, both tiers).** Decide per rule whether a code
  example earns its place by **content**, not by tier — a `core` rule (code style,
  testing, performance) is as code-facing as a `stack` rule, so examples are not
  stack-only. When a rule raises several code-facing topics, each should be illustrated
  by a small **original** snippet (or explicitly waived with a reason like "covered by
  checklist; no reusable pattern"). A rule that raises many topics but shows only one or
  two snippets is under-covered — the Quality Gate re-checks this before the Final Step.
  Author snippets that teach the lesson without copying source code.
- Keep rules actionable — "Use X", "Never Y", "Prefer Z over W"

**Source Map (provenance) — conditional section.** Include a `## Source Map` section in
a rule **only when it was synthesized from external sources** (URLs, files, folders,
PDFs, Context7). It persists the Source Inventory built in `research-pipeline.md` B.1
(the #1 → #6 link): each inventory row becomes a Source Map row mapping a source to the
sections / rules / examples it informed. **Omit the section entirely for a sourceless
manual Add Rule** (Branch A.3 / A.4 save-as-is writes the user's own words — there is no
external provenance, and an empty Source Map is a defect). Distillation is synthesis, so
the map explains provenance, not direct quotation. Source paths and URLs stay verbatim
regardless of `language.rules`.

## Reference File Format

Reference files live in the rule's **own tier** subfolder —
`.unikit/memory/code/<tier>/references/` (`core/references/` for a core rule,
`stack/references/` for a stack rule) — and hold lookup/catalog data or other
large, optional content extracted from a main rule. They have no frontmatter —
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
- **Stable filenames / anti-fragmentation:** reuse an existing reference's filename
  when extending its topic — never spawn `zenject-pools-2.md` or a near-duplicate
  beside `zenject-pools.md`. Before creating a new reference, scan the tier's
  `references/` folder and the main rule for a file that already covers the topic and
  update it instead (this is the merge guard `research-pipeline.md` B.3.5 runs). Keep
  names descriptive and durable so future updates land in the same place.
- Lead with the most useful lookup table first (task → answer, or type → class).
- Cross-link to related reference files when applicable (e.g., between `quickref`
  and `full` tiers, or between module references that overlap).
- Language follows `language.rules` from `.unikit/config.yaml` (same as main rule
  file).
- Code identifiers, class names, and paths always stay in English regardless of
  `language.rules`.

## Reference Candidate Extraction (the Candidate Analyzer)

After synthesis (on-add) — **or** when retroactively optimising an existing rule
(`optimise`, Branch E) — scan the rule's content for sections that should move
into a separate reference file under the rule's **own tier** subfolder
(`.unikit/memory/code/<tier>/references/`). This is the **single Candidate
Analyzer**: the same engine feeds the on-add reference step
(`research-pipeline.md` B.3.5) and the retroactive `optimise` pass, so a book
distilled into a `core` rule and an API catalog inside a `stack` rule are judged
the same way. It applies to **both tiers** — a large, optional, distilled `core`
section is as extractable as a `stack` lookup table; `core` is no longer
inline-only.

**Three signals per content block** — the analyzer scores each candidate block on:

| Signal | Fires when… |
|--------|-------------|
| **Size** | the block is large — orientation **≳ 40 lines or ≳ 1500 characters**. This is a documented *orientation*, not a hard cut: a 35-line block that is plainly optional still counts; a dense 30-line lookup table can too. |
| **Optionality** | the content is needed only in specific situations, not on every read of the rule — a subsystem rarely used alongside the rest, an edge-case catalog, an appendix, a deep-dive reached for occasionally. |
| **Lookup shape** | the content is "looked up", not "read in full" — a table of 20+ rows, a type→class map, an exhaustive index of variants. |

**Confidence buckets — the "Tiers".** These are **confidence levels of the
candidate**, NOT the `quickref`/`full` reference split and NOT the `core`/`stack`
memory tiers:

- **Tier 1 — extract (high confidence).** Strong signal: **large AND (optional OR
  lookup-shaped)**. Moving it out is a clear win — it distracts from the
  conceptual rules and is consulted piecemeal. Examples: a 20+ row lookup table, a
  large independently-used subsystem, an exhaustive variant index, a big distilled
  appendix.
- **Tier 2 — borderline (judgment call).** A single signal, or size hovering near
  the orientation threshold: a medium block that is somewhat optional, a lookup
  table just under 20 rows, a distilled deep-dive around 40 lines. Reasonable
  people could keep it inline or move it — so the user decides.

Content that is small, conceptual, and read top-to-bottom on every use is **not a
candidate** — it stays in the main rule.

| Extract → reference (a candidate) | Keep → main file (never a candidate) |
|-----------------------------------|--------------------------------------|
| Large subsystem rarely used alongside other parts | Architecture and lifecycle rules |
| Lookup table with 20+ rows | Code templates and examples |
| Exhaustive index of all variants | Naming and file-structure conventions |
| Large optional / appendix / deep-dive block (incl. distilled book material) | Configuration and registration patterns |
| Data the LLM "looks up", not "reads in full" | Workflow and decision instructions |

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

**Presenting candidates (identical for on-add B.3.5 and `optimise`).** Group the
found blocks into **Tier 1** and **Tier 2** and present both buckets before writing
anything — each proposed `.unikit/memory/code/<tier>/references/{filename}.md` with
what it contains, which of the three signals fired, and the split strategy. Then
confirm via `AskUserQuestion`, offering the scope choice:

1. Extract **Tier 1 only** (the clear wins)
2. Extract **Tier 1 + Tier 2** (also the borderline blocks)
3. Adjust — rename / merge / split / drop a file, or move a block between buckets → revise and ask again
4. None — keep everything inline

Always report the analyzer result **explicitly, including when nothing qualifies**
("0 candidates — every section is conceptual, small, or read-in-full"), so the
absence of extraction is a visible decision rather than a silent skip. The main
rule file lists approved references in a `> **References**:` header line and
includes a "{Content} Lookup Workflow" section explaining when to open each file.
Do **not** duplicate the moved content in the main file — only pointers and
instructions. When the analyzer runs under `optimise` (Branch E), the approved
content **moves** — it is cut from the main rule, not copied — and the proposal is
confirmed before any write.

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
