// System-file path variables: the one table `{{name}}` → path for every file the framework puts
// under `.unikit/system/`, and the one list of template variable names.
//
// Split out of `constants.ts` for the same mechanical reason as `constants-extension-points.ts`:
// that file sits at the Part 7i ceiling (`SIZE_LIMIT=500` over `src/core/*.ts`). Unlike its sibling
// it is NOT re-exported from `constants.ts`: this table reads constants while the module loads, so
// an `export *` back from `constants.ts` would make the two a cycle and the first read a TDZ error
// (guard SV-1c). It is a leaf of the import graph — it imports `./constants.js` and nothing else.
//
// The golden-guard #1 Part C exclusion is by FILE NAME (`constants\.ts|modules\.ts`) and this file
// does not match it — no module id, tier path or modules registry file name may be spelled out
// here: the registry file name is read from `MODULES_YML_FILE`, every other name from its constant.
//
// A variable name is PUBLIC API of extensions, like the extension-point anchor: the value (the path)
// follows the file, the name never does. Renaming one needs a release that warns first, which is
// why guard SV-1b pins the set of names (adding, removing or renaming one takes two edits).

import {
  BALANCE_HANDBACK_FILE,
  CLI_CONTRACT_FILE,
  DEV_PRINCIPLES_FILE,
  ENGINE_MCP_DIR_NAME,
  GAMEDESIGN_GENRES_DIR_NAME,
  GATE_RESULT_CONTRACT_FILE,
  GD_PRINCIPLES_FILE,
  MCP_RULES_INDEX_FILE,
  MERGE_ANALYSIS_FILE,
  MODULES_YML_FILE,
  PLAN_BOUNDARIES_FILE,
  PROTOTYPE_PROFILE_FILE,
  RESEARCH_LINK_FILE,
  SUBAGENT_ARGUMENTS_FILE,
  SUBAGENT_ROLES_FILE,
  SYSTEM_DIR_NAME,
  SYSTEM_GAMEDESIGN_DIR_NAME,
  ULTRA_PLAN_READ_FILE,
  UNIKIT_DIR,
  USER_QUESTIONS_FILE,
} from './constants.js';

// --- File names that have no constant in `constants.ts` ---
//
// Nine names the code never had to spell: the files are copied by directory listing, written by a
// skill, or delivered from a rules tree. They live here, not in `constants.ts` (at its ceiling), and
// are not exported — only the table below reads them.

/** The six game-design shards next to `gd-principles.md`; delivered by `installGamedesignSystemAssets` from `data/gamedesign/`. A moved or renamed file is caught by SV-4. */
const GD_AUTHORING_FILE = 'gd-authoring.md';
const GD_LIFECYCLE_FILE = 'gd-lifecycle.md';
const GD_FLOW_AXIS_FILE = 'gd-flow-axis.md';
const GD_CONTENT_AXIS_FILE = 'gd-content-axis.md';
const GD_PROVENANCE_FILE = 'gd-provenance.md';
const GD_CRITIQUE_FILE = 'gd-critique.md';

/** The shared design-read contract; delivered with the shards from `data/gamedesign/` (SV-4). */
const DESIGN_READ_FILE = 'design-read.md';

/** The verification file of the rules tree of the selected engine MCP server; present only while that server ships one (SV-3 with `--engine-tree yes`). */
const ENGINE_MCP_VERIFICATION_FILE = 'verification.md';

/** Written by the `/unikit` skill, not by the CLI; the CLI ships only its template, so SV-4 checks the template and SV-5 the path in the texts. */
const LANGUAGE_RULES_FILE = 'LANGUAGE_RULES.md';

// --- The table ---

/** `file` is a single file; `dir` is a directory whose content the table does not list. */
export type SystemFileVarKind = 'file' | 'dir';

/**
 * Who puts the entry on disk: `cli` — `init`/`update` always; `cli-generated` — `init`/`update`
 * write it from the module registry (there is no file in `data/`); `cli-conditional` — only when
 * the project asks for it (the rules tree of the selected engine MCP server, selected genre
 * profiles); `skill` — a skill writes it, the CLI never does.
 */
export type SystemFileVarDelivery = 'cli' | 'cli-generated' | 'cli-conditional' | 'skill';

export interface SystemFileVarRow {
  /** The `{{name}}` an extension writes. */
  readonly name: string;
  /** Path segments from the project root; the value is `segments.join('/')`, one form on every platform and for every agent. */
  readonly segments: readonly string[];
  readonly kind: SystemFileVarKind;
  readonly delivery: SystemFileVarDelivery;
}

const SYSTEM_PATH_SEPARATOR = '/';

const SYSTEM_ROOT = [UNIKIT_DIR, SYSTEM_DIR_NAME] as const;
const GAMEDESIGN_ROOT = [...SYSTEM_ROOT, SYSTEM_GAMEDESIGN_DIR_NAME] as const;
const ENGINE_MCP_ROOT = [...SYSTEM_ROOT, ENGINE_MCP_DIR_NAME] as const;

export const SYSTEM_FILE_VARS = [
  { name: 'system_dir', segments: SYSTEM_ROOT, kind: 'dir', delivery: 'cli' },
  { name: 'system_gamedesign_dir', segments: GAMEDESIGN_ROOT, kind: 'dir', delivery: 'cli' },
  { name: 'system_genres_dir', segments: [...GAMEDESIGN_ROOT, GAMEDESIGN_GENRES_DIR_NAME], kind: 'dir', delivery: 'cli-conditional' },
  { name: 'system_engine_mcp_dir', segments: ENGINE_MCP_ROOT, kind: 'dir', delivery: 'cli-conditional' },
  { name: 'cli_contract', segments: [...SYSTEM_ROOT, CLI_CONTRACT_FILE], kind: 'file', delivery: 'cli' },
  { name: 'dev_principles', segments: [...SYSTEM_ROOT, DEV_PRINCIPLES_FILE], kind: 'file', delivery: 'cli' },
  { name: 'modules_yml', segments: [...SYSTEM_ROOT, MODULES_YML_FILE], kind: 'file', delivery: 'cli-generated' },
  { name: 'gate_result_contract', segments: [...SYSTEM_ROOT, GATE_RESULT_CONTRACT_FILE], kind: 'file', delivery: 'cli' },
  { name: 'ultra_plan_read_contract', segments: [...SYSTEM_ROOT, ULTRA_PLAN_READ_FILE], kind: 'file', delivery: 'cli' },
  { name: 'research_link_contract', segments: [...SYSTEM_ROOT, RESEARCH_LINK_FILE], kind: 'file', delivery: 'cli' },
  { name: 'plan_boundaries_contract', segments: [...SYSTEM_ROOT, PLAN_BOUNDARIES_FILE], kind: 'file', delivery: 'cli' },
  { name: 'merge_analysis_contract', segments: [...SYSTEM_ROOT, MERGE_ANALYSIS_FILE], kind: 'file', delivery: 'cli' },
  { name: 'balance_handback_contract', segments: [...SYSTEM_ROOT, BALANCE_HANDBACK_FILE], kind: 'file', delivery: 'cli' },
  { name: 'prototype_profile_contract', segments: [...SYSTEM_ROOT, PROTOTYPE_PROFILE_FILE], kind: 'file', delivery: 'cli' },
  { name: 'subagent_arguments_contract', segments: [...SYSTEM_ROOT, SUBAGENT_ARGUMENTS_FILE], kind: 'file', delivery: 'cli' },
  { name: 'subagent_roles_contract', segments: [...SYSTEM_ROOT, SUBAGENT_ROLES_FILE], kind: 'file', delivery: 'cli' },
  { name: 'user_questions_contract', segments: [...SYSTEM_ROOT, USER_QUESTIONS_FILE], kind: 'file', delivery: 'cli' },
  { name: 'gd_principles', segments: [...GAMEDESIGN_ROOT, GD_PRINCIPLES_FILE], kind: 'file', delivery: 'cli' },
  { name: 'gd_authoring', segments: [...GAMEDESIGN_ROOT, GD_AUTHORING_FILE], kind: 'file', delivery: 'cli' },
  { name: 'gd_lifecycle', segments: [...GAMEDESIGN_ROOT, GD_LIFECYCLE_FILE], kind: 'file', delivery: 'cli' },
  { name: 'gd_flow_axis', segments: [...GAMEDESIGN_ROOT, GD_FLOW_AXIS_FILE], kind: 'file', delivery: 'cli' },
  { name: 'gd_content_axis', segments: [...GAMEDESIGN_ROOT, GD_CONTENT_AXIS_FILE], kind: 'file', delivery: 'cli' },
  { name: 'gd_provenance', segments: [...GAMEDESIGN_ROOT, GD_PROVENANCE_FILE], kind: 'file', delivery: 'cli' },
  { name: 'gd_critique', segments: [...GAMEDESIGN_ROOT, GD_CRITIQUE_FILE], kind: 'file', delivery: 'cli' },
  { name: 'design_read_contract', segments: [...GAMEDESIGN_ROOT, DESIGN_READ_FILE], kind: 'file', delivery: 'cli' },
  { name: 'engine_mcp_rules_index', segments: [...ENGINE_MCP_ROOT, MCP_RULES_INDEX_FILE], kind: 'file', delivery: 'cli-conditional' },
  { name: 'engine_mcp_rules_verification', segments: [...ENGINE_MCP_ROOT, ENGINE_MCP_VERIFICATION_FILE], kind: 'file', delivery: 'cli-conditional' },
  { name: 'language_rules', segments: [...SYSTEM_ROOT, LANGUAGE_RULES_FILE], kind: 'file', delivery: 'skill' },
] as const satisfies readonly SystemFileVarRow[];

// --- Derived: values, names, types ---

/** The literal union of the registry names; `TemplateVars` gets one field of this type per member. */
export type SystemVarName = (typeof SYSTEM_FILE_VARS)[number]['name'];

/** One `string` field per registry name — what `TemplateVars` extends, so `vars.user_questions_contract` exists without being declared by hand. */
export type SystemTemplateVars = { [K in SystemVarName]: string };

/**
 * `{ name: value }` for every registry row. The value does not depend on the agent or the engine,
 * so skills, extension text, subagent files and `dev-principles.md` all get the same string —
 * unlike the `{{agent_*}}` variables, which are empty wherever no agent is installing the text.
 */
export const SYSTEM_PATH_VARS = Object.fromEntries(
  SYSTEM_FILE_VARS.map((row) => [row.name, row.segments.join(SYSTEM_PATH_SEPARATOR)]),
) as SystemTemplateVars;

export const SYSTEM_VAR_NAMES: readonly SystemVarName[] = SYSTEM_FILE_VARS.map((row) => row.name);

/**
 * The variables that existed before the registry, in the order of the old alternation: the skills
 * path, the settings file and the engine words first, then the agent's delegation profile. The
 * skill-call form (`agent_skill_call_form`) is internal and not a name; `{{agent_skill_call:<skill>}}`
 * is a parameterised token with its own pass.
 */
export const FIXED_TEMPLATE_VAR_NAMES = [
  'skills_dir',
  'home_skills_dir',
  'settings_file',
  'skills_cli_agent_flag',
  'self_name',
  'engine_name',
  'engine_code_language',
  'engine_mcp_tool',
  'agent_id',
  'agent_reader_type',
  'agent_worker_type',
  'agent_model_default',
  'agent_call_reader',
  'agent_call_worker_quoted',
  'agent_call_worker',
] as const;

/**
 * Every name `processTemplate` substitutes — the ONLY list of names: the pattern of `processTemplate`
 * and every "an unresolved token is left" check are built from it (tests read it from the build).
 */
export const TEMPLATE_VAR_NAMES: readonly string[] = [...FIXED_TEMPLATE_VAR_NAMES, ...SYSTEM_VAR_NAMES];
