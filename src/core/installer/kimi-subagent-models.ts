import path from 'path';
import { AGENT_REGISTRY } from '../agents.js';
import { systemDir } from '../constants.js';
import { KIMI_SUBAGENT_MODELS_FILE } from '../constants-kimi.js';
import { getDataDir, readTextFile, removeFile, writeTextFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

export async function installKimiSubagentModelsTemplate(projectDir: string, agentIds: string[]): Promise<void> {
  const target = path.join(projectDir, AGENT_REGISTRY.kimi.configDir, KIMI_SUBAGENT_MODELS_FILE);
  const legacyTarget = path.join(systemDir(projectDir), KIMI_SUBAGENT_MODELS_FILE);

  if (agentIds.includes(AGENT_REGISTRY.kimi.id)) {
    const content = await readTextFile(path.join(getDataDir(), KIMI_SUBAGENT_MODELS_FILE));
    if (!content) {
      logWarn('installKimiSubagentModelsTemplate', `${KIMI_SUBAGENT_MODELS_FILE} not found in data/, skipping`);
      return;
    }
    await writeTextFile(target, content);
    logInfo('installKimiSubagentModelsTemplate', `installed ${AGENT_REGISTRY.kimi.configDir}/${KIMI_SUBAGENT_MODELS_FILE}`);
  } else {
    await removeFile(target);
    logInfo('installKimiSubagentModelsTemplate', 'Kimi Code is not selected - template absent');
  }

  await removeFile(legacyTarget);
}
