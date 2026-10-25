// MCP rules injection into installed skill / subagent frontmatter.
//
// Walks the per-agent allowed-tool lists collected from MCP server configs
// and injects them into the installed artifacts' frontmatter (idempotent dedup
// handled by the mcp.ts injectors).

import path from 'path';
import { getSkillsDir, fileExists } from '../../utils/fs.js';
import type { AgentInstallation } from '../config.js';
import { injectToolsIntoSkillFrontmatter, injectToolsIntoAgentFrontmatter } from '../mcp.js';
import type { McpAllowedTools } from '../mcp.js';
import { resolveSkillPaths } from './hashing.js';

/**
 * @param managedPrefixes the prefixes of the entries the installer owns (`collectManagedGrantPrefixes`):
 *                        only an entry that starts with one of them is removed when the selection no
 *                        longer grants it.
 */
export async function injectMcpRules(
  projectDir: string,
  installedAgents: AgentInstallation[],
  allowedTools: McpAllowedTools,
  managedPrefixes: readonly string[],
): Promise<void> {
  // Inject into subagent files
  for (const [agentName, tools] of Object.entries(allowedTools.agents)) {
    for (const agent of installedAgents) {
      const filePath = path.join(projectDir, agent.subagentsDir, agentName + '.md');
      if (await fileExists(filePath)) {
        await injectToolsIntoAgentFrontmatter(filePath, tools, managedPrefixes);
      }
    }
  }

  // Inject into skill files
  for (const [skillName, tools] of Object.entries(allowedTools.skills)) {
    for (const agent of installedAgents) {
      const sourceSkillDir = path.join(getSkillsDir(), skillName);
      const paths = resolveSkillPaths(projectDir, agent.skillsDir, agent.id, skillName, sourceSkillDir);
      if (await fileExists(paths.targetSkillFile)) {
        await injectToolsIntoSkillFrontmatter(paths.targetSkillFile, tools, managedPrefixes);
      }
    }
  }
}
