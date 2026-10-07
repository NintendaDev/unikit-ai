import type { SubagentProfile } from './agents.js';
import {
  READ_CALL, READ_CALL_NO_ARGS_NOTE, SKILLTOOL_CALL_FORM, SKILLTOOL_CALL_NO_ARGS, SKILLTOOL_CALL_WITH_ARGS,
  SKILL_CALL_DIR_MARK, SKILL_CALL_SKILL_MARK, SKILL_CALL_TOKEN_PATTERN, SUBAGENT_TYPE_KEY,
} from './constants-skill-call.js';
import type { SkillCallForm } from './constants-skill-call.js';
import { logInfo } from '../utils/log.js';

export type CallHeadRole = 'reader' | 'worker';

/**
 * The leading arguments of an `Agent(...)` call for one role, written the way the skills have always
 * written them: the type (quoted or bare — the two spellings are historic, a skill picks one by the
 * variable it uses), then the agent's extra arguments. An agent whose runtime takes no type gets the
 * extra arguments alone. Every part ends with its comma, so the skill text goes straight on.
 */
export function renderCallHead(profile: SubagentProfile, role: CallHeadRole, quoted: boolean): string {
  const type = role === 'reader' ? profile.readerType : profile.workerType;
  const parts: string[] = [];
  if (type !== '') parts.push(`${SUBAGENT_TYPE_KEY}: ${quoted ? `"${type}"` : type},`);
  if (profile.spawnArgs !== '') parts.push(profile.spawnArgs);
  return parts.join(' ');
}

function fill(phrase: string, skill: string, skillsDir: string): string {
  return phrase.replaceAll(SKILL_CALL_SKILL_MARK, () => skill).replaceAll(SKILL_CALL_DIR_MARK, () => skillsDir);
}

function skillCallText(form: SkillCallForm, skill: string, args: string, skillsDir: string): string {
  if (form === SKILLTOOL_CALL_FORM) {
    return args === ''
      ? fill(SKILLTOOL_CALL_NO_ARGS, skill, skillsDir)
      : `${fill(SKILLTOOL_CALL_WITH_ARGS, skill, skillsDir)} ${args}`;
  }
  return `${fill(READ_CALL, skill, skillsDir)} ${args === '' ? READ_CALL_NO_ARGS_NOTE : args}`;
}

/**
 * Replace every `{{agent_skill_call:<skill>}}` with the phrase of `form`. The text between the token
 * and the closing quote of its `prompt: "…"` line is the skill's arguments (trimmed); nothing there
 * means no arguments. `''` means "no form": the file is a subagent file or a system asset, the token
 * stays as written and the guard that bans `{{agent_` in `subagents/` and `data/` (AP-7) keeps it out of there.
 */
export function expandSkillCalls(content: string, form: SkillCallForm | '', skillsDir: string): string {
  if (form === '') return content;
  let count = 0;
  const expanded = content.replace(SKILL_CALL_TOKEN_PATTERN, (_match, skill: string, rest: string) => {
    count++;
    return skillCallText(form, skill, rest.trim(), skillsDir);
  });
  if (count > 0) logInfo('skill-call', `expanded ${count} call(s) as ${form}`);
  return expanded;
}
