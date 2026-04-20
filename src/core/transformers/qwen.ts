import type { AgentTransformer, TransformResult } from '../transformer.js';
import { rewriteInvocationPrefix } from '../transformer.js';

function toQwenInvocation(content: string): string {
  return rewriteInvocationPrefix(content, invocation => `/skills ${invocation}`);
}

export class QwenTransformer implements AgentTransformer {
  transform(skillName: string, content: string): TransformResult {
    return {
      targetDir: skillName,
      targetName: 'SKILL.md',
      content: toQwenInvocation(content),
      flat: false,
    };
  }

  getWelcomeMessage(): string[] {
    return [
      '1. Open Qwen Code in this directory',
      '2. Run /skills unikit to analyze project and generate project-relevant skills',
      '3. Qwen Code invokes skills via /skills <name> (e.g. /skills unikit-plan)',
    ];
  }

  getInvocationHint(): string {
    return 'Qwen Code: /skills unikit-plan, /skills unikit-commit';
  }
}
