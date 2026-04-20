# Language Rules

This file defines how skills and agents handle language settings. It is the single source of truth for language behavior across all UniKit skills and agents.

## Reading the language setting

At the start of execution, silently `Read .unikit/config.yaml` (if it exists) and extract:

- `language.ui` — language for interactive communication (prompts, questions, explanations)
- `language.artifacts` — language for generated files (plans, specs, documentation, reports)
- `language.rules` — language for knowledge base rule files (everything under `.unikit/memory/`, `.unikit/RULES.md`, skill-context rules). **Default: `en`.** Intentionally decoupled from `ui` / `artifacts`.
- `language.technical_terms` — how to handle technical terms (`keep` or `translate`)

If `.unikit/config.yaml` doesn't exist or is unreadable, fall back to defaults: `en` for `language.ui`, `language.artifacts`, and `language.rules`; `keep` for `language.technical_terms`.

Do NOT announce, report, or print the detected language — just use it.

**`language.rules` is read-only from the skill's perspective.** Skills never write to this key, never prompt the user for it, and never suggest changing it. It changes only when the user manually edits `.unikit/config.yaml`. This is deliberate — rule files must stay in a stable language to avoid cross-agent prompt drift, and automatic re-localization would silently invalidate existing rule content.

## Technical terms handling

When `language.technical_terms` is `keep`: preserve original English technical terms even in non-English output. Examples: API, prefab, shader, ECS, dependency injection, singleton, component, ScriptableObject, coroutine, async/await, namespace, assembly, plugin, asset bundle.

When `language.technical_terms` is `translate`: translate technical terms where a common, widely-understood translation exists in the target language. Keep terms that have no established translation in English.

## What uses the configured language

All user-facing output uses the configured language unless explicitly listed in the "always English" section below. This includes:

- All user-facing messages (questions, reports, status updates, confirmations, summaries)
- AskUserQuestion prompts and option lists
- Generated artifacts and documents (plans, reports, research notes, roadmaps, patches, fix plans, etc.)
- Section headings and prose in generated templates and documents
- Commit message subjects and body text
- Task descriptions and refinements
- Analysis output, recommendations, and improvement reports

## Knowledge base rule files

The language of knowledge base rules — everything under `.unikit/memory/` (core/, stack/, references/), `.unikit/memory/RULES_INDEX.md`, `.unikit/RULES.md`, and skill-context rules — is controlled by **`language.rules`** in `.unikit/config.yaml` (default: `en`).

When generating or editing rule files (Branch A / B / C of `/unikit-memory`, Step 9.2 / 9.7 / 9.8 of `/unikit`, or any other rule-writing code path), write rule prose, section headings, explanations, examples, and comments in the language specified by `language.rules`. If the key is missing, the key is unreadable, or `.unikit/config.yaml` does not exist — use English.

This three-axis separation is deliberate:
- `language.ui` → how the agent talks to the user
- `language.artifacts` → the language of generated plans, reports, and research notes
- `language.rules` → the language of the knowledge base that other agents read

Rules are consumed by AI agents for prompt matching and instruction following. Keeping their language stable reduces semantic drift across agents and makes rule files portable between team members. This is why `language.rules` defaults to `en` and is decoupled from the other two axes: a user can read reports in Russian and receive explanations in Russian while the rule corpus the agents consult stays in English.

**Within rule files, the following fields always stay in English regardless of `language.rules`** (they are machine-parsed or used as stable identifiers):
- Frontmatter keys and fixed header labels: `> **Scope**:`, `> **Load when**:`
- Rule ids, rule filenames, section anchor ids
- Code identifiers, file paths, framework and package names

Only the **prose** (descriptions, rationales, examples, anti-patterns, "why this matters" paragraphs, section headings above the body) follows `language.rules`.

## What is always in English (regardless of any language setting)

The following always stay in English across ALL artifacts — UI, generated files, and rule files:

- Code identifiers (class names, function names, variable names, namespaces)
- File names, folder names, file paths, and branch names
- Code snippets, code examples, and inline code blocks
- Code documentation (XML docs, JSDoc, inline comments in source code)
- Architecture documentation (`.unikit/ARCHITECTURE.md`)
- JSON keys and machine-readable config files (e.g., `docs-config.json`, `config.yaml`)
- Framework, library, and package names (e.g., Zenject, UniTask, DOTween)
- Markdown anchor IDs (for URL stability)
- Conventional Commits type and scope prefix (`feat(scope):`, `fix:`, etc.)
- Rule frontmatter keys and header labels (see section above)

## Template translation

When a skill generates artifacts using templates (section headings, table headers, structured documents):

- Translate ALL section headings and ALL prose content into the configured language
- Keep code identifiers, code blocks, file paths, and table data (paths, types) in English
- The template defines the *structure*, not the literal text — adapt headings and prose to the target language

## Skill-specific overrides

Individual skills may define additional language rules in their own `## Language Awareness` section. When a skill adds rules beyond this file, the skill-specific rules take priority for that skill's output.
