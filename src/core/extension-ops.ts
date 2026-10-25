import path from 'path';
import {
  copyDirectory, removeDirectory, fileExists, readJsonFile,
} from '../utils/fs.js';
import type { UniKitConfig, ExtensionRecord, AgentInstallation } from './config.js';
import { getAgentConfig } from './agents.js';
import {
  type ResolvedExtension, type ExtensionManifest,
  commitExtensionInstall, removeExtensionFiles, getExtensionDir,
  loadExtensionManifest, buildExtensionRecord, checkReplacementConflicts,
  findExtensionRecord,
} from './extensions.js';
import {
  listExtensionItems, filterManifest, priorSelectionOf, decideSelection, normalizeToItems,
  type ExtensionSelection,
} from './extension-selection.js';
import { findDanglingPreloads, formatDanglingPreload } from './extension-selection-describe.js';
import { EXTENSION_LOG_COMPONENT } from './constants.js';
import { installSkillWithTransformer } from './installer/skills.js';
import {
  installExtensionSkills, removeExtensionSkills,
  installExtensionSubagents, removeExtensionSubagents,
} from './installer/extensions.js';
import { injectMcpRules } from './installer/mcp-injection.js';
import { resolveMcpBridgeCodeForConfig } from './bridges/selection.js';
import { stripAllInjections } from './injections.js';
import { collectPointInjectionFiles } from './extension-injections-schema.js';
import type { ExtensionInjectionInput } from './extension-injections.js';
import { logInfo, logWarn } from '../utils/log.js';
import {
  configureExtensionMcpServers, removeExtensionMcpServers, validateMcpTemplate,
  discoverMcpServers, collectMcpRules,
} from './mcp.js';

// --- Replaced skills ---

export function collectReplacedSkills(extensions: ExtensionRecord[]): Set<string> {
  const replaced = new Set<string>();

  for (const ext of extensions) {
    if (ext.replacedSkills) {
      for (const baseName of Object.keys(ext.replacedSkills)) {
        replaced.add(baseName);
      }
    }
  }

  return replaced;
}

export function assertNoReplacementConflicts(
  existingExtensions: ExtensionRecord[],
  newManifest: ExtensionManifest,
): void {
  const conflicts = checkReplacementConflicts(existingExtensions, newManifest);
  if (conflicts.length > 0) {
    throw new Error(`Replacement conflicts:\n${conflicts.join('\n')}`);
  }
}

// --- Install extension assets for all agents ---

/**
 * Put the grants of the project's selection back into every installed skill and subagent. Both maps
 * count: the bridges' grants live in the same frontmatter as the universal servers'. `Object.keys(...)`,
 * not `.length`: on a `Record<string, string>` the index signature makes `servers.length` a valid
 * `string` EXPRESSION to tsc while being `undefined` at runtime — the guard would silently stop
 * re-injecting MCP grants into extension skills, with no error anywhere.
 */
async function reinjectSelectionGrants(projectDir: string, config: UniKitConfig): Promise<void> {
  const selectedIds = [...Object.keys(config.mcp?.servers ?? {}), ...Object.keys(config.engineBridges?.selected ?? {})];
  if (selectedIds.length === 0) return;

  const discoveredServers = await discoverMcpServers(config.engine);
  await injectMcpRules(projectDir, config.agents, collectMcpRules(discoveredServers, selectedIds));
}

/** The extension's own files for one agent: its skills, the replacements of base skills, its subagents. */
async function installExtensionFilesForAgent(
  projectDir: string,
  agent: AgentInstallation,
  manifest: ExtensionManifest,
  extensionDir: string,
  engineId: string,
  mcpBridgeCode: string | null | undefined,
): Promise<void> {
  // Install extension skills
  if (manifest.skills && manifest.skills.length > 0) {
    await installExtensionSkills(projectDir, agent, extensionDir, manifest.skills, engineId, mcpBridgeCode);
  }

  // Install replacement skills (under base skill name, not extension path name)
  if (manifest.replaces) {
    const agentConfig = getAgentConfig(agent.id);

    for (const [skillPath, baseName] of Object.entries(manifest.replaces)) {
      const sourceDir = path.join(extensionDir, skillPath);
      try {
        await installSkillWithTransformer(
          sourceDir, baseName, projectDir, agent.skillsDir,
          agent.id, agentConfig, engineId, mcpBridgeCode,
        );
      } catch (error) {
        console.warn(`Warning: Could not install replacement skill "${baseName}": ${error}`);
      }
    }
  }

  // Install extension subagents
  if (manifest.subagents && manifest.subagents.length > 0) {
    const agentConfig = getAgentConfig(agent.id);
    if (agentConfig.supportsSubagents) {
      await installExtensionSubagents(projectDir, agent, extensionDir, manifest.subagents, engineId, mcpBridgeCode);
    }
  }
}

/**
 * Put the files of the recorded extensions back for the given agents — what `init` needs after it has
 * reinstalled the base skills over a replacement. MCP servers and grants are not touched here.
 */
export async function reinstallExtensionAssets(
  input: ExtensionInjectionInput,
): Promise<{ reinstalled: string[]; missing: string[] }> {
  const reinstalled: string[] = [];
  const missing: string[] = [];

  for (const ext of input.extensions) {
    const extDir = getExtensionDir(input.projectDir, ext.name);
    const manifest = await loadExtensionManifest(extDir);
    if (!manifest) {
      missing.push(ext.name);
      logWarn('extension-ops', `extension "${ext.name}": manifest not found — its assets were not reinstalled`);
      continue;
    }

    // Only what the user left on: a skill or subagent switched off in the selection stays out.
    const selected = filterManifest(manifest, ext.selection);
    for (const agent of input.agents) {
      await installExtensionFilesForAgent(input.projectDir, agent, selected, extDir, input.engine, input.mcpBridgeCode);
    }
    reinstalled.push(ext.name);
  }

  return { reinstalled, missing };
}

export async function installExtensionAssetsForAllAgents(
  projectDir: string,
  config: UniKitConfig,
  manifest: ExtensionManifest,
  extensionDir: string,
): Promise<void> {
  // Block and reference injections are NOT applied here: the caller runs the project-level pass
  // (`applyExtensionInjections`) once the set of extensions and base skills is final.
  // The bridge code is read from the catalog once, before the loop.
  const mcpBridgeCode = await resolveMcpBridgeCodeForConfig(config);
  for (const agent of config.agents) {
    await installExtensionFilesForAgent(
      projectDir, agent, manifest, extensionDir, config.engine, mcpBridgeCode,
    );

    // Configure MCP servers
    if (manifest.mcpServers && manifest.mcpServers.length > 0) {
      const servers: Array<{ key: string; config: Record<string, unknown> }> = [];

      for (const srv of manifest.mcpServers) {
        const templatePath = path.join(extensionDir, srv.template);
        const template = await readJsonFile<Record<string, unknown>>(templatePath);

        if (!template) {
          console.warn(`Warning: MCP template not found: ${templatePath}`);
          continue;
        }

        const error = validateMcpTemplate(template, srv.key);
        if (error) {
          console.warn(`Warning: ${error}`);
          continue;
        }

        servers.push({ key: srv.key, config: template });
      }

      if (servers.length > 0) {
        await configureExtensionMcpServers(projectDir, agent.id, servers);
      }
    }
  }

  // Re-inject MCP tool permissions into all installed skills/subagents
  // (replacement skills and extension skills need MCP tools in frontmatter)
  await reinjectSelectionGrants(projectDir, config);
}

// --- Remove extension assets for all agents ---

/**
 * Takes out of every agent what `manifest` names. The manifest must already be narrowed to what
 * was installed: `filterManifest` over the record's selection for a removal, `manifestSubset`
 * for a difference. The extension's injections come off by `manifest.injections`, which a subset
 * does not carry — so applying a difference never erases them.
 */
export async function removeExtensionAssetsForAllAgents(
  projectDir: string,
  config: UniKitConfig,
  manifest: ExtensionManifest,
): Promise<void> {
  // Skill names: the directory name of each skill path and the base skills it replaced
  const skillNames = [
    ...(manifest.skills ?? []).map(p => path.basename(p)),
    ...Object.values(manifest.replaces ?? {}),
  ];

  // Derive subagent names from manifest
  const subagentNames = (manifest.subagents ?? []).map(p => path.basename(p).replace(/\.md$/, ''));

  for (const agent of config.agents) {
    // Remove extension skills (derived from manifest)
    if (skillNames.length > 0) {
      await removeExtensionSkills(projectDir, agent, skillNames);
    }

    // Remove extension subagents (derived from manifest)
    if (subagentNames.length > 0) {
      await removeExtensionSubagents(projectDir, agent, subagentNames);
    }

    // Strip injections
    if (manifest.injections && manifest.injections.length > 0) {
      await stripAllInjections(projectDir, agent, manifest.name, manifest.injections);
    }

    // Remove MCP servers
    if (manifest.mcpServers && manifest.mcpServers.length > 0) {
      const keys = manifest.mcpServers.map(s => s.key);
      await removeExtensionMcpServers(projectDir, agent.id, keys);
    }
  }
}

// --- Remove previous extension state from config ---

export function removePreviousExtensionState(
  config: UniKitConfig,
  extensionName: string,
): void {
  config.extensions = (config.extensions ?? []).filter(e => e.name !== extensionName);
}

// --- Commit resolved extension (full flow) ---

/**
 * Installs a resolved extension for every agent and returns its record.
 *
 * `selection` is the caller's decision on the items (already narrowed by the CLI). Without it the
 * previous state of the record is kept: a first install turns everything on, an installed
 * extension keeps its earlier decisions and its new items stay undecided (not installed).
 * Conflicts of `replaces` are checked on the enabled replacements only.
 */
export async function commitResolvedExtension(
  projectDir: string,
  config: UniKitConfig,
  resolved: ResolvedExtension,
  selection?: ExtensionSelection,
): Promise<ExtensionRecord> {
  const manifest = resolved.manifest;
  const existingExtensions = config.extensions ?? [];

  // What was installed before, read before anything is changed (reads the disk only).
  const previousRecord = findExtensionRecord(existingExtensions, manifest.name);
  const existingDir = getExtensionDir(projectDir, manifest.name);
  const hasExisting = await fileExists(existingDir);
  const previousManifest = hasExisting ? await loadExtensionManifest(existingDir) : null;

  const items = listExtensionItems(manifest);
  const chosen = selection !== undefined
    ? normalizeToItems(selection, items)
    : decideSelection({
      items,
      prior: priorSelectionOf(previousRecord, previousManifest),
      skip: new Set<string>(),
      installNew: false,
      skipNew: false,
    });
  const enabledManifest = filterManifest(manifest, chosen);

  // Check conflicts (a replacement the selection leaves off is not a conflict)
  assertNoReplacementConflicts(
    existingExtensions.filter(e => e.name !== manifest.name),
    enabledManifest,
  );

  // Validate command module files exist (before any disk mutation)
  if (manifest.commands) {
    for (const cmd of manifest.commands) {
      const modulePath = path.join(resolved.localPath, cmd.module);
      if (!(await fileExists(modulePath))) {
        throw new Error(
          `Extension "${manifest.name}" command "${cmd.name}" references missing module: ${cmd.module}`,
        );
      }
    }
  }

  // Files named by point injections — the extension is rejected before any disk mutation.
  for (const relPath of collectPointInjectionFiles(manifest.injections ?? [])) {
    if (!(await fileExists(path.join(resolved.localPath, relPath)))) {
      throw new Error(`Extension "${manifest.name}" injection references a missing file: ${relPath}`);
    }
  }

  // Backup existing extension if upgrading
  const backupDir = existingDir + '.backup';

  if (hasExisting) {
    await copyDirectory(existingDir, backupDir);
  }

  try {
    // Remove previous assets from agents: what was installed, not the whole previous manifest
    if (previousManifest) {
      await removeExtensionAssetsForAllAgents(
        projectDir, config, filterManifest(previousManifest, previousRecord?.selection),
      );
    }

    // Remove previous config state
    removePreviousExtensionState(config, manifest.name);

    // Commit extension files to storage
    await commitExtensionInstall(projectDir, resolved);

    // Install assets for all agents: only the enabled items
    const extensionDir = getExtensionDir(projectDir, manifest.name);
    await installExtensionAssetsForAllAgents(
      projectDir, config, enabledManifest, extensionDir,
    );

    // Build the record (it joins `config.extensions` last, after everything that can throw)
    const record = buildExtensionRecord(resolved, chosen);

    // A base skill whose replacement is gone (switched off, or dropped from the new version)
    // comes back now, not at the next `update`.
    const kept = new Set(Object.keys(record.replacedSkills ?? {}));
    const dropped = Object.keys(previousRecord?.replacedSkills ?? {}).filter(base => !kept.has(base));
    if (dropped.length > 0) {
      logInfo(EXTENSION_LOG_COMPONENT, `restoring base skill(s) dropped from replacements: ${dropped.join(', ')}`);
      await restoreBaseSkills(projectDir, config, dropped);
    }

    // A selected subagent that preloads a skill left out of the selection: a warning, not a block.
    for (const dangling of await findDanglingPreloads(extensionDir, manifest, chosen)) {
      logWarn(EXTENSION_LOG_COMPONENT, formatDanglingPreload(manifest.name, dangling));
    }

    config.extensions = [...(config.extensions ?? []), record];

    // Cleanup backup
    if (hasExisting) {
      await removeDirectory(backupDir);
    }

    return record;
  } catch (error) {
    // Rollback: restore backup if exists
    if (hasExisting) {
      await removeDirectory(existingDir);
      await copyDirectory(backupDir, existingDir);
      await removeDirectory(backupDir);
    }

    throw error;
  }
}

// --- Remove extension (full flow) ---

export async function removeExtension(
  projectDir: string,
  config: UniKitConfig,
  extensionName: string,
): Promise<void> {
  const manifest = await loadExtensionManifest(getExtensionDir(projectDir, extensionName));
  const record = findExtensionRecord(config.extensions ?? [], extensionName);

  if (manifest) {
    // Only what the selection left on was installed: nothing else is taken out.
    await removeExtensionAssetsForAllAgents(projectDir, config, filterManifest(manifest, record?.selection));
  }

  removePreviousExtensionState(config, extensionName);
  await removeExtensionFiles(projectDir, extensionName);
}

/**
 * Removes the temporary clone of a git or GitHub source. A local source's `localPath` is the
 * user's own directory and is never deleted. Safe to call after `commitResolvedExtension`, which
 * already removed the clone: removing an absent path is not an error.
 */
export async function disposeResolvedExtension(resolved: ResolvedExtension): Promise<void> {
  if (resolved.source.type === 'git' || resolved.source.type === 'github') {
    await removeDirectory(resolved.localPath);
  }
}

// --- Restore base skills after extension removal ---

export async function restoreBaseSkills(
  projectDir: string,
  config: UniKitConfig,
  skillNames: string[],
): Promise<void> {
  // Re-import dynamically to avoid circular dependency issues
  const { installSkills } = await import('./installer/skills.js');
  const mcpBridgeCode = await resolveMcpBridgeCodeForConfig(config);

  for (const agent of config.agents) {
    const skillsToRestore = skillNames.filter(s => agent.installedSkills.includes(s));
    if (skillsToRestore.length === 0) continue;

    await installSkills({
      projectDir,
      skillsDir: agent.skillsDir,
      skills: skillsToRestore,
      agentId: agent.id,
      engineId: config.engine,
      mcpBridgeCode,
    });
  }

  // Re-inject MCP tool permissions into restored skills
  await reinjectSelectionGrants(projectDir, config);

  // Injections are re-rendered by the caller through applyExtensionInjections — one pass over every extension.
}
