// Flat system contracts that do not fit into system-assets.ts (Part 7i caps a file at 500 lines).
//
// Same shape as the wrappers there: a flat copy from `data/` into `.unikit/system/` with NO
// substitution, NOT hash-tracked — every init/update rewrites it. The next flat contract goes here too.

import { SUBAGENT_ARGUMENTS_FILE, SUBAGENT_ROLES_FILE } from '../constants.js';
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
