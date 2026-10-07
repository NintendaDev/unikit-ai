import chalk from 'chalk';
import { describeSharedSkillsDir } from '../core/agent-skills-dir.js';
import { logInfo } from '../utils/log.js';

/**
 * Stop a command that is about to write skills for two agents into one directory: print the
 * reason and exit with code 1 before anything is written. Applies to configs edited by hand
 * into that state — the init wizard refuses the selection itself (`validateAgentSelection`).
 */
export function exitOnSharedSkillsDir(agents: ReadonlyArray<{ id: string; skillsDir: string }>): void {
  const message = describeSharedSkillsDir(agents);
  if (message === null) {
    logInfo('guards', `skills directories checked for ${agents.length} agent(s): none is shared`);
    return;
  }

  console.log(chalk.red(`Error: ${message}`));
  console.log(chalk.dim('Run "unikit-ai init" and deselect one of them.'));
  process.exit(1);
}
