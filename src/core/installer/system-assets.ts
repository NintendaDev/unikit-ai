// System asset installation: engine templates + .unikit/system files.
//
// These flat-write per-engine ENGINE_RULES.md into installed skill reference
// dirs (installEngineTemplates) and the cli-contract / dev-principles files
// into .unikit/system (installCliContract / installDevPrinciples). The system
// files are NOT hash-tracked — every init/update rewrites them with the
// current engine vars substituted.

import path from 'path';
import {
  getDataDir, getEngineTemplatesDir,
  fileExists, readTextFile, writeTextFile,
} from '../../utils/fs.js';
import type { AgentInstallation } from '../config.js';
import { getAgentConfig } from '../agents.js';
import { getEngineConfig } from '../engines.js';
import { getTransformer } from '../transformer.js';
import { processTemplate } from '../template.js';
import { logInfo, logWarn } from '../../utils/log.js';
import {
  REFERENCES_DIR_NAME, ENGINE_RULES_FILE, CLI_CONTRACT_FILE, DEV_PRINCIPLES_FILE,
  GD_PRINCIPLES_FILE, GD_DESIGN_READ_FILE, GATE_RESULT_CONTRACT_FILE, GAMEDESIGN_MODULE_ID,
  MODULES_YML_FILE, systemDir, systemGamedesignDir,
} from '../constants.js';
import { listModules } from '../modules.js';
import { buildSubagentTemplateVars } from './shared.js';

// --- Engine template installation ---

export async function installEngineTemplates(
  projectDir: string,
  engineId: string,
  installedAgents: AgentInstallation[],
): Promise<void> {
  let engineConfig;
  try {
    engineConfig = getEngineConfig(engineId);
  } catch {
    return;
  }

  const templatesBaseDir = path.join(getEngineTemplatesDir(), 'skills');

  for (const [skillName, templateFilename] of Object.entries(engineConfig.skillTemplates)) {
    const sourcePath = path.join(templatesBaseDir, skillName, templateFilename);
    if (!(await fileExists(sourcePath))) continue;

    const content = await readTextFile(sourcePath);
    if (!content) continue;

    for (const agent of installedAgents) {
      const transformer = getTransformer(agent.id);
      const agentConfig = getAgentConfig(agent.id);
      const transformed = transformer.transform(skillName, '');

      let targetRefsDir: string;
      if (transformed.flat) {
        targetRefsDir = path.join(projectDir, agentConfig.configDir, transformed.targetDir, REFERENCES_DIR_NAME);
      } else {
        targetRefsDir = path.join(projectDir, agent.skillsDir, transformed.targetDir, REFERENCES_DIR_NAME);
      }

      await writeTextFile(path.join(targetRefsDir, ENGINE_RULES_FILE), content);
    }
  }
}

// --- CLI Contract installation ---

export async function installCliContract(projectDir: string): Promise<void> {
  const srcPath = path.join(getDataDir(), CLI_CONTRACT_FILE);
  const destDir = systemDir(projectDir);
  const destPath = path.join(destDir, CLI_CONTRACT_FILE);

  const content = await readTextFile(srcPath);
  if (!content) {
    logWarn('installCliContract', 'cli-contract.md not found in data/, skipping');
    return;
  }

  await writeTextFile(destPath, content);
  logInfo('installCliContract', 'installed .unikit/system/cli-contract.md');
}

// --- Gate-result contract installation ---

/**
 * Install the machine-readable quality-gate result contract into
 * `.unikit/system/gate-result-contract.md`. Modeled on {@link installCliContract}:
 * a flat copy from `data/gate-result-contract.md` with NO substitution
 * (engine-agnostic). NOT hash-tracked — every init/update rewrites it;
 * `unikit-verify` and `unikit-review` read it on Bootstrap to emit/recompute
 * the `unikit-gate-result` fenced block.
 */
export async function installGateResultContract(projectDir: string): Promise<void> {
  const srcPath = path.join(getDataDir(), GATE_RESULT_CONTRACT_FILE);
  const destDir = systemDir(projectDir);
  const destPath = path.join(destDir, GATE_RESULT_CONTRACT_FILE);

  const content = await readTextFile(srcPath);
  if (!content) {
    logWarn('installGateResultContract', 'gate-result-contract.md not found in data/, skipping');
    return;
  }

  await writeTextFile(destPath, content);
  logInfo('installGateResultContract', 'installed .unikit/system/gate-result-contract.md');
}

// --- Dev Principles installation ---

export async function installDevPrinciples(
  projectDir: string,
  engineId: string,
  engineMcpKey?: string | null,
): Promise<void> {
  const srcPath = path.join(getDataDir(), DEV_PRINCIPLES_FILE);
  const destDir = systemDir(projectDir);
  const destPath = path.join(destDir, DEV_PRINCIPLES_FILE);

  const raw = await readTextFile(srcPath);
  if (!raw) {
    logWarn('installDevPrinciples', 'dev-principles.md not found in data/, skipping');
    return;
  }

  const vars = buildSubagentTemplateVars('dev-principles', engineId, engineMcpKey);
  const content = processTemplate(raw, vars);
  await writeTextFile(destPath, content);
  logInfo('installDevPrinciples', 'installed .unikit/system/dev-principles.md');
}

// --- Game-design principles installation ---

/**
 * Install the game-design principles system asset into
 * `.unikit/system/gd-principles.md`. Modeled on {@link installCliContract}:
 * a flat copy with NO engine-var substitution (gd-principles is
 * engine-agnostic, unlike {@link installDevPrinciples}). Source lives under
 * `data/<gamedesign>/gd-principles.md`. NOT hash-tracked — every init/update
 * rewrites it; the `unikit-gd-*` skills read it on Bootstrap.
 */
export async function installGdPrinciples(projectDir: string): Promise<void> {
  const srcPath = path.join(getDataDir(), GAMEDESIGN_MODULE_ID, GD_PRINCIPLES_FILE);
  const destDir = systemDir(projectDir);
  const destPath = path.join(destDir, GD_PRINCIPLES_FILE);

  const content = await readTextFile(srcPath);
  if (!content) {
    logWarn('installGdPrinciples', 'gd-principles.md not found in data/gamedesign/, skipping');
    return;
  }

  await writeTextFile(destPath, content);
  logInfo('installGdPrinciples', 'installed .unikit/system/gd-principles.md');
}

// --- Game-design shared READ-contract installation ---

/**
 * Install the shared design/flow READ-contract system asset into
 * `.unikit/system/gamedesign/design-read.md`. Modeled on
 * {@link installGdPrinciples}: a flat copy with NO engine-var substitution
 * (engine-agnostic). Source lives under `data/<gamedesign>/design-read.md`. NOT
 * hash-tracked — every init/update rewrites it. Code-side skills (`unikit-plan`
 * via `references/design-context.md`, and `unikit-explore`) load it on demand to
 * read design. Lands under the `gamedesign` system subdir (the shared-contract
 * home), NOT flat next to `gd-principles.md` — see {@link systemGamedesignDir}.
 */
export async function installDesignRead(projectDir: string): Promise<void> {
  const srcPath = path.join(getDataDir(), GAMEDESIGN_MODULE_ID, GD_DESIGN_READ_FILE);
  const destDir = systemGamedesignDir(projectDir);
  const destPath = path.join(destDir, GD_DESIGN_READ_FILE);

  const content = await readTextFile(srcPath);
  if (!content) {
    logWarn('installDesignRead', 'design-read.md not found in data/gamedesign/, skipping');
    return;
  }

  await writeTextFile(destPath, content);
  logInfo('installDesignRead', 'installed .unikit/system/gamedesign/design-read.md');
}

// --- Module registry snapshot installation ---

/**
 * Serialize MODULE_REGISTRY to YAML. Hand-rendered (the structure is flat and
 * stable), so this carries no YAML dependency. Kept private — the file name is
 * the contract, the format is an implementation detail.
 */
function renderModulesYml(): string {
  const lines: string[] = [
    '# Module registry snapshot — generated by unikit-ai from MODULE_REGISTRY.',
    '# Flat-rewritten on every init/update; do not edit by hand.',
    'modules:',
  ];
  for (const module of listModules()) {
    lines.push(`  ${module.id}:`);
    lines.push(`    id: ${module.id}`);
    lines.push(`    tiers: [${module.tiers.join(', ')}]`);
    lines.push(`    enginePartitioned: ${module.enginePartitioned}`);
    lines.push(`    skillPrefix: ${module.skillPrefix}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Write `<systemDir>/modules.yml` from MODULE_REGISTRY. Like cli-contract /
 * dev-principles, this is a flat rewrite (NOT hash-tracked) — every init/update
 * regenerates it. Forward-compat SSOT: PR#1 has no consumers yet (generic
 * module-aware skills arrive in PR#3).
 */
export async function installModulesYml(projectDir: string): Promise<void> {
  const destPath = path.join(systemDir(projectDir), MODULES_YML_FILE);
  await writeTextFile(destPath, renderModulesYml());
  logInfo('installModulesYml', `installed .unikit/system/${MODULES_YML_FILE}`);
}
