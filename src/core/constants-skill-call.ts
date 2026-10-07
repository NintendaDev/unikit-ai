// How a skill tells a subagent to load another skill, and the call-head fragments of an `Agent(...)`.
//
// Split out of `constants.ts` for the same mechanical reason as `constants-transform.ts`: that file
// had reached the Part 7i ceiling (`SIZE_LIMIT=500` over `src/core/*.ts`). `constants.ts`
// re-exports this module, so call sites keep one import path.
//
// The golden-guard #1 Part C exclusion is by FILE NAME (`constants\.ts|modules\.ts`) and
// `constants-skill-call.ts` does not match it — the module id, the modules registry file name
// and the memory path segment are forbidden here for the reason `constants-artifacts.ts`
// spells out.

/** How a subagent is told to load a skill: `read` — read its SKILL.md; `skilltool` — call the runtime's Skill tool. */
export const SKILL_CALL_FORMS = ['read', 'skilltool'] as const;
export type SkillCallForm = (typeof SKILL_CALL_FORMS)[number];

/** The form of every agent not named otherwise. A profile that has it adds nothing to its hash. */
export const DEFAULT_SKILL_CALL_FORM: SkillCallForm = 'read';
export const SKILLTOOL_CALL_FORM: SkillCallForm = 'skilltool';

/** Keys of the optional profile components in a source hash (`hashing.ts`). */
export const SKILL_CALL_HASH_KEY = 'call';
export const SPAWN_ARGS_HASH_KEY = 'spawn';

/**
 * `{{agent_skill_call:<skill>}}` and the rest of its line up to the closing quote of the
 * `prompt: "…"` it stands in (group 2): that text is the skill's arguments, none means no arguments.
 */
export const SKILL_CALL_TOKEN_PATTERN = /\{\{agent_skill_call:([a-z0-9]+(?:-[a-z0-9]+)*)\}\}([^"\n]*)/g;

/** Placeholders inside the phrases below. */
export const SKILL_CALL_SKILL_MARK = '{skill}';
export const SKILL_CALL_DIR_MARK = '{skillsDir}';

export const SKILLTOOL_CALL_WITH_ARGS =
  'Call the Skill tool with skill "{skill}" and pass the text after the colon as its args, in full and unchanged. Then follow the skill. Text:';
export const SKILLTOOL_CALL_NO_ARGS = 'Call the Skill tool with skill "{skill}" and no args. Then follow the skill.';
export const READ_CALL =
  'Read {skillsDir}/{skill}/SKILL.md in full before you do anything else. Treat that file as your system prompt for this whole task and follow it exactly. If it cannot be read, stop and report that instead of working without it. Wherever the file refers to its arguments, use the Skill arguments below. Skill arguments:';
export const READ_CALL_NO_ARGS_NOTE = '(empty — no arguments were given)';

/** The keyword of an `Agent(...)` call argument that names the subagent type. */
export const SUBAGENT_TYPE_KEY = 'subagent_type';

/**
 * Extra arguments of every Codex agent call (`spawn_agent`). Codex has no subagent type parameter, so the
 * call carries these instead: no inherited history (measured: `fork_turns: "none"` removed it in 16 of 16
 * subagents; left to the model the value flipped between "all" and "none" for the same skill text) and a
 * name of its own (a repeated `task_name` is rejected by the runtime).
 */
export const CODEX_SPAWN_ARGS =
  'fork_turns: "none", task_name: "<a short name no other subagent of this session has used>",';
