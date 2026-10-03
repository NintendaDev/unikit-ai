import { GENERAL_PURPOSE_SUBAGENT_TYPE, KIMI_CODER_SUBAGENT_TYPE } from '../constants.js';

// `subagent_type: "general-purpose"` and `subagent_type: general-purpose`: the key, an optional
// quote pair, the name, and NOT a longer identifier (`general-purposeX`, `general-purpose-x`).
const TYPE_AFTER_KEY = new RegExp(
  `(subagent_type:\\s*)(["']?)${GENERAL_PURPOSE_SUBAGENT_TYPE}(?![\\w-])\\2`,
  'g',
);
// Prose that names the type in backticks: "`general-purpose` and not `Explore`".
const TYPE_IN_BACKTICKS = new RegExp(`\`${GENERAL_PURPOSE_SUBAGENT_TYPE}\``, 'g');

/**
 * Kimi Code rejects `subagent_type: general-purpose` (types are matched by exact name).
 * Rewrites the two spellings skill text uses and nothing else — the bare English word
 * ("a general-purpose helper") is left alone. Pure, idempotent, safe on `''`.
 */
export function swapGeneralPurposeSubagentType(content: string): string {
  return content
    .replace(TYPE_AFTER_KEY, (_match, key: string, quote: string) => `${key}${quote}${KIMI_CODER_SUBAGENT_TYPE}${quote}`)
    .replace(TYPE_IN_BACKTICKS, `\`${KIMI_CODER_SUBAGENT_TYPE}\``);
}
