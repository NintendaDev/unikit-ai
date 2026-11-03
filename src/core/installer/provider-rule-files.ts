import fs from 'fs-extra';
import path from 'path';
import type { RuleCandidate } from '../registry/rule-candidate.js';
import { REFERENCES_DIR_NAME } from '../constants.js';
import { providerRulePath, PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES } from '../constants-provider-rules.js';
import { logWarn } from '../../utils/log.js';

/** Local rollback for a new body and its reference writes; never rolls back unrelated work. */
export async function withProviderFileRollback<T>(projectDir: string, id: string, candidate: RuleCandidate, install: () => Promise<T>): Promise<T> {
  const body = providerRulePath(projectDir, id);
  const paths = [body, ...candidate.references.map(ref => path.join(path.dirname(body), REFERENCES_DIR_NAME, ref.filename))];
  const before = new Map<string, Buffer | null>();
  for (const file of paths) {
    try {
      before.set(file, await fs.readFile(file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      before.set(file, null);
    }
  }
  try {
    return await install();
  } catch (error) {
    for (const [file, bytes] of [...before].reverse()) {
      try {
        if (bytes === null) {
          await fs.unlink(file).catch(cause => { if (cause.code !== 'ENOENT') throw cause; });
        } else {
          await fs.writeFile(file, bytes);
        }
      } catch (cause) {
        logWarn(PROVIDER_RULE_LOG, PROVIDER_RULE_MESSAGES.rollbackFailed(id, file, String(cause)));
      }
    }
    throw error;
  }
}
