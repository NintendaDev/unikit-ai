import { DefaultTransformer } from './default.js';

/**
 * Universal / Other - the agent for runtimes UniKit does not name: any AI agent that reads the
 * shared project directory `.agents/skills`. Skills install exactly as for the default agents
 * (inherited `transform`: standard `SKILL.md` directories, `/unikit-*` left verbatim). The only
 * thing that differs is the onboarding text, because the runtime is not known in advance: the
 * user is told where the skills and the MCP settings went, and that an agent reading another MCP
 * file needs the servers added by hand. No `postInstall` (no rules file), no `transformReference`,
 * no `transformSubagent` - nothing is adapted to a runtime nobody has named.
 */
export class UniversalTransformer extends DefaultTransformer {
  getWelcomeMessage(): string[] {
    return [
      '1. Open your AI agent in this directory (any agent that reads .agents/skills/)',
      '2. UniKit skills are installed in .agents/skills/ - the shared project skills directory',
      '3. MCP servers selected during init are written to .mcp.json - if your agent reads another MCP file, add the servers there by hand',
      '4. Start the unikit skill (for example /unikit) to analyze the project and generate project-relevant skills',
    ];
  }
}
