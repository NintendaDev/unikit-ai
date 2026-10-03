import type { AgentTransformer, TransformResult } from '../transformer.js';
import { logInfo } from '../../utils/log.js';
import { swapGeneralPurposeSubagentType } from './kimi-skill-text.js';
import { toKimiAgentFile } from './kimi-agent-file.js';

/**
 * Kimi Code (v2, `kimi`) — own `.kimi-code/` directory; `/unikit-*` is accepted as a shorthand
 * for `/skill:unikit-*`, so invocations are NOT rewritten. Two things are adapted: the
 * `general-purpose` subagent type (Kimi has `coder`) in skill text and references, and the
 * subagent files themselves (`Agent(...)` entry, `subagents:` list, launch command,
 * `${base_prompt}` for the coordinators). See RESEARCH.md F-6, F-8, F-9.
 */
export class KimiTransformer implements AgentTransformer {
  transform(skillName: string, content: string): TransformResult {
    const rewritten = swapGeneralPurposeSubagentType(content);
    if (rewritten !== content) {
      logInfo('kimi', `${skillName}: general-purpose subagent type → coder`);
    }
    return { targetDir: skillName, targetName: 'SKILL.md', content: rewritten, flat: false };
  }

  transformReference(content: string): string {
    return swapGeneralPurposeSubagentType(content);
  }

  transformSubagent(subagentName: string, content: string): string {
    const adapted = toKimiAgentFile(content);
    if (adapted !== content) {
      logInfo('kimi', `${subagentName}: agent file adapted for Kimi Code`);
    }
    return adapted;
  }

  getWelcomeMessage(): string[] {
    return [
      '1. Open Kimi Code in this directory (run `kimi`)',
      '2. Trust the folder when Kimi Code asks - project MCP servers in .kimi-code/mcp.json are enabled only after that',
      '3. Run /unikit to analyze project and generate project-relevant skills (shorthand for /skill:unikit)',
      '4. Coordinators start as the main agent: kimi --agent unikit-implement-coordinator (or unikit-plan-coordinator)',
    ];
  }

  getInvocationHint(): string {
    return 'Kimi Code: /unikit-plan, /unikit-commit (or /skill:unikit-plan)';
  }
}
