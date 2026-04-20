# Contributing to UniKit AI

Thanks for your interest in contributing! This guide covers what you need to get set up, submit changes, and have them merged.

For deep context on the codebase — architecture, layout, conventions, where things live — read [AGENTS.md](../AGENTS.md). It is the single navigation map for this repository.

## Prerequisites

- Node.js `>= 18` (CI runs on Node `22`)
- npm
- Git
- bash — the test suite is a set of bash scripts, not a JS test framework. On Windows use Git Bash or WSL.

## Setup

1. Fork the repository on GitHub.
2. Clone your fork:

   ```bash
   git clone https://github.com/<your-username>/unikit-ai.git
   cd unikit-ai
   ```

3. Install dependencies, fetch the bundled rules registry, and build:

   ```bash
   npm install
   npm run download:rules
   npm run build
   ```

   `npm run download:rules` clones [`NintendaDev/unikit-ai-rules`](https://github.com/NintendaDev/unikit-ai-rules) into `rules-registry/`. That directory is git-ignored and is required for the full test suite to pass.

4. Optional — link the CLI globally to try your build end-to-end:

   ```bash
   npm run link
   ```

## Development commands

```bash
npm run build              # Compile TypeScript (src/ -> dist/)
npm run watch              # Rebuild on changes
npm test                   # Full validation suite (bash, entry: scripts/test-skills.sh)
npm run lint               # Unused exports (tsc) + dead code (knip)
npm run generate:contract  # Regenerate data/cli-contract.md
```

Running a single test file in isolation:

```bash
bash scripts/test-rules-install.sh
bash scripts/test-rules-sync.sh
bash scripts/test-exit-codes.sh
```

## Repository layout

```
unikit-ai/
├── bin/              # CLI entry
├── src/              # TypeScript source (cli / core / utils)
├── skills/           # Built-in skills (unikit-* prefix)
├── subagents/        # Built-in subagents
├── mcp/              # MCP server templates per engine + universal
├── data/             # CLI contract, dev principles, manifests
├── scripts/          # Bash test runners and download-rules.sh
├── rules-registry/   # Bundled snapshot of unikit-ai-rules
│                     # (git-ignored, cloned by scripts/download-rules.sh — never hand-edit)
└── docs/             # User-facing documentation
```

AGENTS.md has the full "where to read what" map — skills, subagents, engines, agents, transformers, MCP writers, and tests.

## Contribution workflow

1. Create a feature branch from `main`:

   ```bash
   git checkout main
   git pull
   git checkout -b feature/your-change
   ```

2. Make your changes. Follow the conventions already in the repo:
   - ESM throughout (`"type": "module"`), `.js` extensions in imports
   - TypeScript strict mode, target ES2022, `module: NodeNext`
   - Skill names: lowercase, hyphenated, `unikit-` prefix
   - Every `SKILL.md` must have `name:` and `description:` in YAML frontmatter

3. Verify build, lint, and tests pass locally before pushing:

   ```bash
   npm run build
   npm run lint
   npm test
   ```

4. Commit using [Conventional Commits](https://www.conventionalcommits.org/). Examples from this repo:

   ```
   feat(wizard): add stable/beta agent grouping
   fix(mcp): skip non-stdio servers in opencode writer
   docs(readme): drop duplicate init snippet
   refactor(agents): remove universal agent
   test(install): tighten opencode mcp assertions
   ci(workflows): run tests on development push
   chore(release): bump version to 1.0.0
   ```

5. Push your branch and open a pull request **against `main`**. CI runs on every PR and must be green before merge.

## Memory rules

Knowledge-base rules do **not** live in this repo. They live in a separate repository: [`NintendaDev/unikit-ai-rules`](https://github.com/NintendaDev/unikit-ai-rules).

- To add or change a rule, open a PR against that repository.
- `rules-registry/` here is a cloned snapshot regenerated at publish time — do not hand-edit it.
- `data/rules-manifest.json` in this repo contains only the `requiredBy` map (which skills require which rules).

## Common changes

Quick index. AGENTS.md has the full map with pointers into the code.

| Change | Entry point |
|---|---|
| Add a skill | Create `skills/unikit-<name>/SKILL.md` with frontmatter, run `npm test` |
| Add an agent | Edit `AGENT_REGISTRY` in `src/core/agents.ts`; add a transformer in `src/core/transformers/` if the agent needs a non-default skill format |
| Add an engine | Edit `ENGINE_REGISTRY` in `src/core/engines.ts`; open a parallel PR in the rules repo |
| Add a memory rule | PR to `NintendaDev/unikit-ai-rules` — nothing to edit in this repo |
| Add a CLI test | Create `scripts/test-rules-<cmd>.sh` using helpers from `scripts/test-fixtures.sh`; wire it into `scripts/test-rules.sh` |

## Reporting issues

Open an issue at [github.com/NintendaDev/unikit-ai/issues](https://github.com/NintendaDev/unikit-ai/issues).
