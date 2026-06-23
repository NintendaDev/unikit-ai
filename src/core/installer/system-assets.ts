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
  fileExists, readTextFile, writeTextFile, listFiles, removeFile,
} from '../../utils/fs.js';
import { getInstalledGenres, type AgentInstallation, type UniKitConfig } from '../config.js';
import { getAgentConfig } from '../agents.js';
import { getEngineConfig } from '../engines.js';
import { getTransformer } from '../transformer.js';
import { processTemplate } from '../template.js';
import { logInfo, logWarn } from '../../utils/log.js';
import {
  REFERENCES_DIR_NAME, ENGINE_RULES_FILE, CLI_CONTRACT_FILE, DEV_PRINCIPLES_FILE,
  GD_PRINCIPLES_FILE, GATE_RESULT_CONTRACT_FILE, GAMEDESIGN_MODULE_ID,
  GAMEDESIGN_GENRES_DIR_NAME, MODULES_YML_FILE,
  systemDir, systemGamedesignDir, systemGamedesignGenresDir,
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

// --- Game-design system assets installation (core + shards + shared read-contract) ---

/**
 * Install the game-design system assets into `.unikit/system/gamedesign/`.
 * Copies every top-level `*.md` under `data/<gamedesign>/` — the `gd-principles`
 * **core** + its shards (`gd-authoring`, `gd-lifecycle`, `gd-flow-axis`,
 * `gd-provenance`, `gd-critique`) + the shared `design-read` contract — as flat
 * copies with NO engine-var substitution (engine-agnostic, unlike
 * {@link installDevPrinciples}). Each `unikit-gd-*` skill reads the core plus the
 * shards it needs on Bootstrap; the code-side skills load `design-read.md` on
 * demand. The `templates/` subdir is excluded by design: this is a
 * non-recursive top-level file listing ({@link listFiles}), NOT
 * {@link copyDirectory}, which would copy the 8 GDD templates into the system dir.
 *
 * NOT hash-tracked — every init/update rewrites the folder. Replaces the former
 * `installGdPrinciples` (flat core) + `installDesignRead` pair, and
 * **orphan-deletes** the pre-split flat `.unikit/system/gd-principles.md`: the
 * core moved under the `gamedesign/` subdir, and system assets have no migration
 * chain, so the stale flat copy is removed here on every init/update.
 */
export async function installGamedesignSystemAssets(projectDir: string): Promise<void> {
  const srcDir = path.join(getDataDir(), GAMEDESIGN_MODULE_ID);
  const destDir = systemGamedesignDir(projectDir);

  const names = (await listFiles(srcDir)).filter(name => name.endsWith('.md'));
  if (names.length === 0) {
    logWarn('installGamedesignSystemAssets', 'no *.md found in data/gamedesign/, skipping');
    return;
  }

  for (const name of names) {
    const content = await readTextFile(path.join(srcDir, name));
    if (!content) continue;
    await writeTextFile(path.join(destDir, name), content);
  }
  logInfo('installGamedesignSystemAssets', `installed ${names.length} file(s) into .unikit/system/${GAMEDESIGN_MODULE_ID}/`);

  // Orphan-delete the pre-split flat core (moved under the gamedesign/ subdir).
  const orphan = path.join(systemDir(projectDir), GD_PRINCIPLES_FILE);
  if (await fileExists(orphan)) {
    await removeFile(orphan);
    logInfo('installGamedesignSystemAssets', `removed orphan flat .unikit/system/${GD_PRINCIPLES_FILE}`);
  }
}

// --- Genre profile installation (selective, state-driven) ---

/**
 * Selectively deliver the read-only genre profiles named in
 * `config.genres.installed` into `.unikit/system/gamedesign/genres/`. Unlike
 * {@link installGamedesignSystemAssets} (which folder-copies ALL shards every
 * time), this copies only the profiles the project has installed — a profile
 * is read-only and never edited, so delivery is an unconditional flat rewrite
 * (no engine-var substitution, no version gate). Profiles on disk that are no
 * longer in state are orphan-deleted (mirroring the shard orphan-delete).
 *
 * Called next to {@link installGamedesignSystemAssets} on init (a no-op — fresh
 * state is empty) and update (refreshes installed profiles). The CLI
 * `genres install` writes state then calls this to deliver immediately.
 */
export async function installGenreProfiles(projectDir: string, config: UniKitConfig): Promise<void> {
  const installed = getInstalledGenres(config);
  const srcDir = path.join(getDataDir(), GAMEDESIGN_MODULE_ID, GAMEDESIGN_GENRES_DIR_NAME);
  const destDir = systemGamedesignGenresDir(projectDir);

  const wanted = new Set<string>();
  for (const entry of installed) {
    const content = await readTextFile(path.join(srcDir, `${entry.id}.json`));
    if (!content) {
      logWarn('installGenreProfiles', `bundled genre profile not found: ${entry.id}`);
      continue;
    }
    await writeTextFile(path.join(destDir, `${entry.id}.json`), content);
    wanted.add(entry.id);
    logInfo('installGenreProfiles', `installed genre profile ${entry.id}`);
  }

  // Orphan-delete profiles on disk no longer in state.
  for (const name of (await listFiles(destDir)).filter(n => n.endsWith('.json'))) {
    const id = name.slice(0, -'.json'.length);
    if (!wanted.has(id)) {
      await removeFile(path.join(destDir, name));
      logInfo('installGenreProfiles', `removed orphan genre profile ${name}`);
    }
  }
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
