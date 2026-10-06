import { DefaultTransformer } from './default.js';

/**
 * Qwen Code. Skills install exactly as for the default agents (inherited `transform`: standard
 * `SKILL.md` directories, `/unikit-*` left verbatim): Qwen Code starts a skill as `/<name>`, while
 * `/skills <name>` only opens its skills panel and drops the argument (Qwen Code documentation;
 * confirmed by one live run). Only the onboarding text is Qwen's own. No `transformReference`, no
 * `transformSubagent` — nothing is rewritten, so there is no `TRANSFORM_REVISIONS` entry either.
 */
export class QwenTransformer extends DefaultTransformer {
  getWelcomeMessage(): string[] {
    return [
      '1. Open Qwen Code in this directory',
      '2. Run /unikit to analyze project and generate project-relevant skills',
      '3. Qwen Code invokes skills via /<name> (e.g. /unikit-plan)',
    ];
  }

  getInvocationHint(): string {
    return 'Qwen Code: /unikit-plan, /unikit-commit';
  }
}
