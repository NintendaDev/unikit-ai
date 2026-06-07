// Temporary re-export barrel — removed in the final unbundling task (Task 11).
//
// The installer monolith has been split into ./installer/* submodules. The four
// consumers (cli/commands/{init,update,rules}.ts, core/extension-ops.ts) still
// import from './installer.js'; this barrel keeps them building until their
// imports are rewritten to the submodules directly and this file is deleted.

export { installEngineTemplates, installCliContract, installDevPrinciples } from './installer/system-assets.js';
export { injectMcpRules } from './installer/mcp-injection.js';
export {
  installSkillWithTransformer, installSkills, getAvailableSkills,
  buildManagedSkillsState, updateSkills,
} from './installer/skills.js';
export type {
  SkillUpdateStatus, SkillUpdateEntry, UpdateSkillsResult, UpdateSkillsOptions, InstallSkillsOptions,
} from './installer/skills.js';
export {
  installSubagents, buildManagedSubagentsState, updateSubagents,
} from './installer/subagents.js';
export type {
  SubagentUpdateStatus, SubagentUpdateEntry, UpdateSubagentsResult, UpdateSubagentsOptions,
} from './installer/subagents.js';
export {
  installExtensionSkills, removeExtensionSkills,
  installExtensionSubagents, removeExtensionSubagents,
} from './installer/extensions.js';
export {
  generateRulesIndex, loadRequiredByMap, CORE_RULE_WHITELIST,
  parseRuleMetadataFromContent, normalizeRuleId,
} from './installer/rules-index.js';
export type { RequiredByMap, GenerateRulesIndexStatus } from './installer/rules-index.js';
export { syncRulesState } from './installer/rules-sync.js';
export type { SyncRulesEvent, SyncRulesResult, SyncRulesOptions } from './installer/rules-sync.js';
