// Flat system contracts that do not fit into system-assets.ts (Part 7i caps a file at 500 lines).
//
// Same shape as the wrappers there: a flat copy from `data/` into `.unikit/system/` with NO
// substitution, NOT hash-tracked — every init/update rewrites it. The next flat contract goes here too.

import { RESEARCH_HASH_FILE, SUBAGENT_ARGUMENTS_FILE, SUBAGENT_ROLES_FILE, TEST_RUN_WIDTH_FILE, USER_QUESTIONS_FILE } from '../constants.js';
import { installFlatSystemAsset } from './shared.js';

/**
 * The subagent-arguments contract — a flat copy from `data/subagent-arguments.md`, NO
 * substitution, NOT hash-tracked. A system asset because every skill that can launch a subagent and
 * both coordinators settle the model and the effort of a launch by the same rule, and a per-skill copy would drift;
 * a system file rather than a reference of one skill so that it reaches a project whichever
 * skills the wizard installed. The installer never reads `.unikit/config.yaml`: the skill that
 * launches the subagent applies the rule to the values it finds there.
 */
export async function installSubagentArgumentsContract(projectDir: string): Promise<void> {
  await installFlatSystemAsset(projectDir, SUBAGENT_ARGUMENTS_FILE, 'installSubagentArgumentsContract');
}

/**
 * The subagent-roles table — a flat copy from `data/subagent-roles.md`, NO substitution, NOT hash-tracked.
 * It defines the three roles of a subagent launch and names the role of every launch the package ships (a
 * delegation alias, a launch without an alias, a file agent); `subagent-arguments.md` says what to do with a
 * role. A system asset for the same reason as that contract: skills and file agents read one table, and a
 * copy per skill would drift. The installer never reads `.unikit/config.yaml`.
 */
export async function installSubagentRolesContract(projectDir: string): Promise<void> {
  await installFlatSystemAsset(projectDir, SUBAGENT_ROLES_FILE, 'installSubagentRolesContract');
}

/**
 * The user-questions contract — a flat copy from `data/user-questions.md`, NO substitution, NOT hash-tracked.
 * How a skill asks the user: the explanation printed first, the question tool of the agent, the turn that stays
 * open while a question waits, numbered text only without that tool. A system asset because every skill that asks
 * reads one text — a copy per skill drifts — and the text names no agent, so one file serves every runtime.
 */
export async function installUserQuestionsContract(projectDir: string): Promise<void> {
  await installFlatSystemAsset(projectDir, USER_QUESTIONS_FILE, 'installUserQuestionsContract');
}

/**
 * The test-run-width contract — a flat copy from `data/test-run-width.md`, NO substitution, NOT hash-tracked.
 * How wide a run goes, what unsaved editor state does to it and when it is green. A system asset because
 * `/unikit-implement`, its coordinator, `/unikit-fix`, `/unikit-execute` and `/unikit-verify` read one text: as a
 * reference of one skill it would not reach a project that installed the others without it.
 */
export async function installTestRunWidthContract(projectDir: string): Promise<void> {
  await installFlatSystemAsset(projectDir, TEST_RUN_WIDTH_FILE, 'installTestRunWidthContract');
}

/**
 * The research-hash script — a flat copy from `data/research-hash.mjs`, NO substitution, NOT hash-tracked.
 * It computes `Summary SHA256` for `/unikit-plan`, `/unikit-improve`, `/unikit-implement` and `/unikit-verify`,
 * so a skill neither reads the summary for the hash nor builds a shell pipeline whose bytes depend on the shell.
 * A system asset because those four skills run one script at one path, whichever of them the wizard installed.
 */
export async function installResearchHashScript(projectDir: string): Promise<void> {
  await installFlatSystemAsset(projectDir, RESEARCH_HASH_FILE, 'installResearchHashScript');
}
