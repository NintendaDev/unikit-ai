import type { AgentTransformer, TransformResult } from '../transformer.js';
import { AGENT_REGISTRY } from '../agents.js';
import { logInfo, logWarn } from '../../utils/log.js';
import { toKimiAgentFile } from './kimi-agent-file.js';

/**
 * Kimi Code (v2, `kimi`) — own `.kimi-code/` directory; `/unikit-*` is accepted as a shorthand
 * for `/skill:unikit-*`, so invocations are NOT rewritten. Skill text is the same as for every
 * other agent: the subagent types it names (`explore`, `coder`) are substituted by the
 * installer from `AGENT_REGISTRY.kimi.subagentProfile`. What this adapter changes are the
 * subagent files themselves (`Agent(...)` entry, `subagents:` list, launch command,
 * `${base_prompt}` for the coordinators, the `skills:` field turned into a read list). See
 * RESEARCH.md F-6, F-9.
 */
export class KimiTransformer implements AgentTransformer {
  transform(skillName: string, content: string): TransformResult {
    return { targetDir: skillName, targetName: 'SKILL.md', content, flat: false };
  }

  transformSubagent(subagentName: string, content: string): string {
    // An object, not a `let`: TypeScript does not see a closure's assignment and would narrow it to `null`.
    const skills: { paths: readonly string[] | null } = { paths: null };
    const adapted = toKimiAgentFile(content, AGENT_REGISTRY.kimi.skillsDir, paths => { skills.paths = paths; });
    if (skills.paths !== null && skills.paths.length === 0) {
      logWarn('kimi', `${subagentName}: the skills: field named no skills — field removed, no read list written`);
    }
    if (adapted !== content) {
      const readList = skills.paths !== null && skills.paths.length > 0
        ? `; skills: → read list (${skills.paths.length} paths)`
        : '';
      logInfo('kimi', `${subagentName}: agent file adapted for Kimi Code${readList}`);
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
