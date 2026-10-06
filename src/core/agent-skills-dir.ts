// The rule "two agents of one project never share one skills directory".
//
// Skills are written under the agent's `skillsDir` and checked against that agent's recorded
// hashes, so two agents that render different text into one directory overwrite each other on
// every `update`, and removing one removes the other's skills. The rule is a pure function of
// the directories and knows no agent names: it holds for any pair of agents, present or future.

import path from 'path';
import { AGENT_REGISTRY } from './agents.js';

export interface SharedSkillsDir {
  /** The directory as the first agent of the group spells it. */
  skillsDir: string;
  /** Ids of the agents that write into it, in the order given. */
  agentIds: string[];
}

// Compared form: forward slashes, no `./`, no trailing slash, lower case (Windows and macOS
// file systems do not tell `.Agents/Skills` from `.agents/skills`).
function comparable(skillsDir: string): string {
  return path.posix.normalize(skillsDir.replaceAll('\\', '/')).replace(/\/+$/, '').toLowerCase();
}

/** Groups of two or more distinct agents whose skills directories are the same directory. */
export function findSharedSkillsDirs(agents: ReadonlyArray<{ id: string; skillsDir: string }>): SharedSkillsDir[] {
  const groups = new Map<string, SharedSkillsDir>();

  for (const agent of agents) {
    const key = comparable(agent.skillsDir);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { skillsDir: agent.skillsDir, agentIds: [agent.id] });
    } else if (!group.agentIds.includes(agent.id)) {
      group.agentIds.push(agent.id);
    }
  }

  return [...groups.values()].filter(group => group.agentIds.length > 1);
}

function displayNames(agentIds: string[]): string {
  const names = agentIds.map(id => AGENT_REGISTRY[id]?.displayName ?? id);
  return names.length === 2
    ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The message for the user, or `null` when no two agents share a directory. One line per
 * shared directory; `AGENT_REGISTRY` is used only for the display names, an unknown id is
 * printed as it is.
 */
export function describeSharedSkillsDir(agents: ReadonlyArray<{ id: string; skillsDir: string }>): string | null {
  const groups = findSharedSkillsDirs(agents);
  if (groups.length === 0) {
    return null;
  }

  return groups
    .map(group => `${displayNames(group.agentIds)} would install skills into the same directory (${group.skillsDir}) and overwrite each other on every update. Select only one of them.`)
    .join('\n');
}
