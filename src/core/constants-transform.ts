// Text and names the agent transformers write into installed files.
//
// Split out of `constants.ts` for the same mechanical reason as `constants-artifacts.ts`:
// that file had reached the Part 7i ceiling (`SIZE_LIMIT=500` over `src/core/*.ts`).
// `constants.ts` re-exports this module, so call sites keep one import path.
//
// The golden-guard #1 Part C exclusion is by FILE NAME (`constants\.ts|modules\.ts`) and
// `constants-transform.ts` does not match it — the module id, the modules registry file name
// and the memory path segment are forbidden here for the reason `constants-artifacts.ts`
// spells out.

/** Tag of the transformer-revision component in a skill's or subagent's source hash (`hashing.ts`). */
export const TRANSFORM_HASH_TAG = 'transform';

/**
 * Revision of what an agent's transformer WRITES. The source hash holds the package text, not the
 * transformer's logic, so a changed regex or adapter reaches an installed project only through
 * this number. RULE: raise an agent's revision whenever the output of its transformer changes —
 * the invocation pattern, an adapter, a line it inserts. An agent missing from the table has a
 * transformer that rewrites nothing and contributes nothing to the hash, which is why the hashes
 * of those agents did not move when this table was introduced. The key set is guarded against
 * the transformer hooks in `scripts/test-agent-profile.mjs` (group R).
 */
export const TRANSFORM_REVISIONS: Readonly<Record<string, string>> = {
  codex: '1',
  qwen: '1',
  kimi: '1',
};

/** The frontmatter field of a subagent file that names the skills to preload (Claude Code reads it, Kimi Code does not). */
export const SUBAGENT_SKILLS_FIELD = 'skills';

/**
 * Intro of the read list the Kimi adapter puts at the top of an agent file in place of the
 * `skills:` field, which Kimi Code does not read: the agent reads the skill files itself, and a
 * file it cannot read is to be reported, not worked around.
 * Must stay free of `{{` and of the built-in prompt placeholder (install tests assert both).
 */
export const KIMI_SKILLS_PREAMBLE =
  'Before you start, Read each file below and follow it as part of your instructions. '
  + 'If a file cannot be read, stop and report that instead of working without it.';
