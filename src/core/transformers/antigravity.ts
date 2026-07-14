import type { AgentTransformer, TransformResult } from '../transformer.js';
import { writeTextFile, fileExists, removeFile } from '../../utils/fs.js';
import path from 'path';

/**
 * Antigravity (Google) — IDE + CLI share one workspace `.agent/` and one global
 * MCP config, so they are a single agent. Skills-only port: every unikit skill
 * installs as an Antigravity **skill** (a `.agent/skills/<name>/` directory with
 * `SKILL.md` + `references/`), triggered by its `description` like Claude.
 *
 * Unlike the AI Factory original, there is NO workflows-split: unikit skills are
 * reference-heavy, and the installer's flat branch would collapse same-named
 * reference files (e.g. `CHECK-MODE.md` in unikit-improve and unikit-review) into
 * one `.agent/workflows/references/` directory — a silent last-writer-wins clash.
 * So `transform` mirrors DefaultTransformer (no `WORKFLOW_SKILLS`, no frontmatter
 * trimming, `/unikit-*` left verbatim).
 */
export class AntigravityTransformer implements AgentTransformer {
  transform(skillName: string, content: string): TransformResult {
    return {
      targetDir: skillName,
      targetName: 'SKILL.md',
      content,
      flat: false,
    };
  }

  async postInstall(projectDir: string): Promise<void> {
    const rulesPath = path.join(projectDir, '.agent', 'rules', 'unikit.md');

    const rulesContent = `# UniKit Guardrails

This project uses **UniKit** (\`unikit-ai\`) for AI-assisted Unity game development.

## Where things live

- **Skills** — \`.agent/skills/<name>/SKILL.md\` (+ optional \`references/\`). Antigravity
  auto-selects a skill by its \`description\`; there is no \`/unikit-*\` slash command here.
- **Knowledge base** — engine-aware rules in \`.unikit/memory/\`, system contracts in
  \`.unikit/system/\`.
- **Config** — \`.unikit.json\` at the project root.

## Getting started

- Start with the \`unikit\` skill — it bootstraps project context and installs
  engine-aware rules into \`.unikit/memory/\`.
- For day-to-day development use the pipeline skills: \`unikit-plan\`,
  \`unikit-implement\`, \`unikit-fix\`, \`unikit-verify\`, \`unikit-review\`.
- For game-design documents (GDD authoring) use the \`unikit-gd-*\` skills.

## Conventions

- Follow the existing code style and patterns; prefer editing existing files over
  creating new ones.
- Consult the rules in \`.unikit/memory/\` before writing engine code.

## Unity MCP (manual step)

UniKit does not configure MCP for Antigravity automatically. Antigravity reads a
**global** MCP config shared across the IDE and CLI:

    ~/.gemini/config/mcp_config.json

To enable the Unity MCP server, add it to the \`mcpServers\` object in that file yourself.
`;

    await writeTextFile(rulesPath, rulesContent);
  }

  async cleanup(projectDir: string, skillsDir: string): Promise<void> {
    const configDir = path.dirname(skillsDir);
    const rulesPath = path.join(projectDir, configDir, 'rules', 'unikit.md');
    if (await fileExists(rulesPath)) {
      await removeFile(rulesPath);
    }
  }

  getWelcomeMessage(): string[] {
    return [
      '1. Open Antigravity in this directory (IDE or CLI — they share .agent/)',
      '2. UniKit skills installed in .agent/skills/ (directories, triggered by description)',
      '3. Guardrails installed in .agent/rules/unikit.md',
      '4. Start with the "unikit" skill to bootstrap project context and rules',
      '5. For Unity MCP, add the server to ~/.gemini/config/mcp_config.json (global, manual)',
    ];
  }
}
