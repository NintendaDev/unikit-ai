// Flat system contracts that do not fit into system-assets.ts (Part 7i caps a file at 500 lines).
//
// Same shape as the wrappers there: a flat copy from `data/` into `.unikit/system/` with NO
// substitution, NOT hash-tracked — every init/update rewrites it. The next flat contract goes here too.

import { SUBAGENT_ARGUMENTS_FILE } from '../constants.js';
import { installFlatSystemAsset } from './shared.js';

/**
 * The subagent-arguments contract — a flat copy from `data/subagent-arguments.md`, NO
 * substitution, NOT hash-tracked. A system asset because twelve skills settle the model and the
 * effort of a subagent by the same rule, and a per-skill copy would be twelve copies that drift;
 * a system file rather than a reference of one skill so that it reaches a project whichever
 * skills the wizard installed. The installer never reads `.unikit/config.yaml`: the skill that
 * launches the subagent applies the rule to the values it finds there.
 */
export async function installSubagentArgumentsContract(projectDir: string): Promise<void> {
  await installFlatSystemAsset(projectDir, SUBAGENT_ARGUMENTS_FILE, 'installSubagentArgumentsContract');
}
