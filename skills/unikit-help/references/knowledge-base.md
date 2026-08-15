# Knowledge Base, Rules, Modules & Registry

Read this when the user asks about rules, memory, the knowledge base, the rules registry, or
turning documents into rules. This area changed substantially after the early tutorials — most
notably it is now **two modules**, and `/unikit-memory` can **distil books and articles** into
rules. Call those out when relevant; users coming from the old single-module world will not
expect them.

---

## Dynamic memory in one paragraph

Rules live under `.unikit/memory/<module>/<tier>/` and are listed in a per-module
`RULES_INDEX.md`. Skills don't load every rule at session start — they read the index and
**dynamically load only the rules relevant to the current task** (matched by each rule's
`Load when` line). Above the memory there is `.unikit/RULES.md`, a project-local override file
with the **highest priority**.

Priority (highest wins): `.unikit/RULES.md` → `.unikit/ARCHITECTURE.md` → module `core` rules →
module `stack`/`library` rules.

---

## The two modules (the key change)

UniKit's knowledge base is now **modular**. Two modules ship:

### `code` module — engine-aware development rules
- Path: `.unikit/memory/code/{core,stack}/`
- **core** = universal best practices independent of any framework (code style, architecture
  principles, testing conventions, performance). Engine-partitioned and bootstrapped on init.
- **stack** = per-framework rules (one file per library: a DI container, a tween library, a
  reactive library, an async library, etc.), loaded on demand.

### `gamedesign` module — GDD domain knowledge
- Path: `.unikit/memory/gamedesign/{core,library}/`
- **Semantics are inverted vs `code`:**
  - **core** = canonical, official-backed *design* knowledge (12 domain rules: frameworks,
    player-motivation, core-loops, balance, economy, progression, level-design, narrative,
    ux-onboarding, accessibility, liveops, monetization-ethics). Loaded on demand by `Load when`.
  - **library** = an empty *studio slot* for your project's own custom design rules.
- Not engine-partitioned. Resolves "per-id merge" (a studio rule overrides the canonical one of
  the same id; missing ids backfill from official).

When the user works with `/unikit-memory` or `/unikit-rules-registry`, the **module** is chosen
by the `--module code | gamedesign` flag, or inferred from context, or asked if ambiguous. For
design knowledge, pass `--module gamedesign`.

---

## System assets — not rules, not user-editable

Alongside the memory there is `.unikit/system/`, written by `init`/`update` and **rewritten every
time**. Editing these by hand is pointless. The user does not curate them; the CLI does.

Relevant to the dev pipeline:

- `dev-principles.md` — the canonical engine development principles + workflow. Read on Bootstrap
  by `/unikit-implement`, `/unikit-fix`, `/unikit-verify`, `/unikit-improve`, `/unikit-devcontext`.
- `engine-mcp/{capabilities,scene-authoring,verification}.md` — the profile of the **engine MCP
  server the project actually selected**: its bootstrap protocol, which tools are real, which
  report success while doing nothing, and which verification gates are reachable. Generated from
  the chosen MCP configs, so switching MCP or engine replaces them (stale shards are deleted).
  Binding: `capabilities` → implement / fix / verify / devcontext; `scene-authoring` → implement /
  fix / devcontext; `verification` → verify only, where it can mark a gate **GATE LIFTED** and
  `/unikit-verify` then skips that gate with the shard's reason instead of demanding the
  impossible. Not every MCP server ships a profile — a missing file is skipped silently.
- `cli-contract.md`, `gate-result-contract.md`, `modules.yml`, `gamedesign/` — contracts read on
  demand by the skills that need them.

---

## Turning a rule into the knowledge base (the everyday flow)

1. **Quick capture** — `/unikit-rules <one-liner>` appends to `.unikit/RULES.md`. Use it as a
   testing ground / inbox; it's auto-loaded by `/unikit-implement`.
2. **Promote** — `/unikit-memory migrate-rules` moves a matured `RULES.md` entry into the proper
   `core`/`stack`/`library` rule file (with conflict handling and a `no-migrate` tag option).
3. **Generate / research** — `/unikit-memory <description or source>` creates a full rule. It
   checks the registry first and offers to install a vetted version instead of regenerating.

Rule of thumb: a rule is only worth keeping if it carries **your** experience or is distilled
from **real documentation**. A rule the agent could've written from its own training just wastes
context.

---

## Distilling books / articles / docs into rules (new capability)

`/unikit-memory` can take a **source** and distil it into rules — not just a typed description:

- **Sources:** a URL, a local file, a whole folder, a PDF, or an EPUB/FB2 book.
- It runs a research pipeline: builds a Source Inventory, enriches via Context7 docs, then
  **distils (does not copy)** the material into actionable rules with original examples, and
  records provenance in a `## Source Map` section.
- **Reference extraction (Candidate Analyzer):** large/optional/lookup-shaped sections (big
  tables, exhaustive component indexes) are split into on-demand reference files so the main rule
  stays lean. It asks before extracting (Tier 1 = confident, Tier 2 = borderline).
- **Big sources** (folders, PDFs, EPUB/FB2, oversized text) go through a helper that chunks them
  first; it needs a Python 3 interpreter (probe-gated — falls back to manual extraction if absent).
- **`optimise`** — `/unikit-memory optimise [rule names]` retroactively slims existing bloated
  rules by moving big sections into reference files (content moves, never deleted; confirmed first).

So "make rules from this Zenject docs page / this design book / this folder of articles" →
`/unikit-memory <path-or-url>` (add `--module gamedesign` for design material).

A practical technique for large frameworks: first generate a table-of-contents reference (full +
short) of the framework's components, then `/unikit-memory` builds the rule pointing at those
references — so the agent never duplicates a component that already exists.

---

## The external rules registry (sharing rules across projects)

Rules can be published to a registry and pulled into other projects. Resolution uses a 3-level
fallback chain: your **primary custom** registry → the **official** registry → a **bundled**
snapshot shipped with the package.

Drive it from the skill or the CLI:

- **Skill — `/unikit-rules-registry`** (orchestrates the CLI, with a write-capability gate):
  - `create` — scaffold a new local registry and seed it from your `.unikit/memory/`.
  - `update` — push your memory changes into the local registry with automatic semver bumps.
  - `sync` — pull registry updates back into your project.
  - Important: **create/update require a local-folder registry** (version bumping doesn't work
    against a plain GitHub-URL registry — clone it locally first). `sync` works against either.

- **CLI — `unikit-ai rules ...`** (direct/scriptable):
  - `rules list` — what the registry offers (module-aware).
  - `rules show <id>` — preview a rule.
  - `rules install <id> [<id>...]` — install specific rules; `rules install defaults` bootstraps.
  - `rules status` — what's installed (source, origin, version).
  - `rules sync` — reconcile disk ↔ state + regenerate the index.
  - `rules registry show | set <url> | reset | init [path] | migrate [path] | status` — manage which
    registry the project uses (`set`/`reset`/`init`/`migrate` don't auto-sync; pair with `rules sync`).

Schema note: the registry layout is **schema:2** (module-partitioned). `rules registry migrate`
upgrades an old schema:1 local registry in place.

---

## Skill vs CLI — which to tell the user

- **Use `/unikit-memory`** for anything source-backed (a link, file, folder, book, PDF) or a
  researched rule — it does the research, distillation, reference extraction, and index update.
- **Use `/unikit-rules`** for a quick one-line convention typed as a prompt.
- **Use `/unikit-rules-registry`** to publish/pull rules between projects (handles seeding,
  diffing, semver, manifest, and state in one go).
- **Use the raw `unikit-ai rules ...` CLI** for direct, scriptable ops: install a specific rule,
  inspect the catalog/state, reconcile after manual edits, or point the project at a registry.

---

## Further reading (project docs)

- `docs/dynamic-memory.md` — how dynamic memory and the Bootstrap pattern work.
- `docs/rules-registry.md` — the underlying `unikit-ai rules` CLI in depth.
- `docs/getting-started.md` — install, supported agents, CLI commands.
- `docs/evolve.md` — the fix → patch → evolve → rules learning loop.
