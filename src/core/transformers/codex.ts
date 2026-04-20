import type { AgentTransformer, TransformResult } from '../transformer.js';
import { rewriteInvocationPrefix } from '../transformer.js';

function toCodexInvocation(content: string): string {
  return rewriteInvocationPrefix(content, invocation => `$${invocation}`);
}

export class CodexTransformer implements AgentTransformer {
  transform(skillName: string, content: string): TransformResult {
    return {
      targetDir: skillName,
      targetName: 'SKILL.md',
      content: toCodexInvocation(content),
      flat: false,
    };
  }

  getWelcomeMessage(): string[] {
    return [
      '1. Open Codex CLI in this directory',
      '2. Run $unikit to analyze project and generate project-relevant skills',
      '3. Approve project as trusted when prompted by Codex CLI (required for .codex/config.toml to be loaded)',
    ];
  }

  getInvocationHint(): string {
    return 'Codex CLI: $unikit-plan, $unikit-commit';
  }
}
