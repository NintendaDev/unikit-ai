import path from 'path';
import {
  copyDirectory, removeDirectory, fileExists, readJsonFile,
} from '../utils/fs.js';
import type { UniKitConfig, ExtensionRecord } from './config.js';
import { getAgentConfig } from './agents.js';
import {
  type ResolvedExtension, type ExtensionManifest,
  commitExtensionInstall, removeExtensionFiles, getExtensionDir,
  loadExtensionManifest, buildExtensionRecord, checkReplacementConflicts,
  resolveExtension,
} from './extensions.js';
import {
  installSkillWithTransformer, installExtensionSkills, removeExtensionSkills,
  installExtensionSubagents, removeExtensionSubagents, injectMcpRules,
} from './installer.js';
import { applyAllInjections, stripAllInjections } from './injections.js';
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

export async function installExtensionAssetsForAllAgents(
  projectDir: string,
  config: UniKitConfig,
  manifest: ExtensionManifest,
  extensionDir: string,
): Promise<void> {
  for (const agent of config.agents) {
    // Install extension skills
    if (manifest.skills && manifest.skills.length > 0) {
      await installExtensionSkills(
        projectDir, agent, extensionDir, manifest.skills,
        config.engine, config.engineMcpKey,
      );
    }

    // Install replacement skills (under base skill name, not extension path name)
    if (manifest.replaces) {
      const agentConfig = getAgentConfig(agent.id);

      for (const [skillPath, baseName] of Object.entries(manifest.replaces)) {
        const sourceDir = path.join(extensionDir, skillPath);
        try {
          await installSkillWithTransformer(
            sourceDir, baseName, projectDir, agent.skillsDir,
            agent.id, agentConfig, config.engine, config.engineMcpKey,
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
        await installExtensionSubagents(
          projectDir, agent, extensionDir, manifest.subagents,
          config.engine, config.engineMcpKey,
        );
      }
    }

    // Apply injections
    if (manifest.injections && manifest.injections.length > 0) {
      await applyAllInjections(projectDir, agent, manifest.name, manifest.injections, extensionDir);
    }

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
  if (config.mcp?.servers?.length) {
    const discoveredServers = await discoverMcpServers(config.engine);
    const mcpAllowedTools = collectMcpRules(discoveredServers, config.mcp.servers);
    await injectMcpRules(projectDir, config.agents, mcpAllowedTools);
  }
}

// --- Remove extension assets for all agents ---

export async function removeExtensionAssetsForAllAgents(
  projectDir: string,
  config: UniKitConfig,
  manifest: ExtensionManifest,
): Promise<void> {
  // Derive skill names from manifest
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

export async function commitResolvedExtension(
  projectDir: string,
  config: UniKitConfig,
  resolved: ResolvedExtension,
): Promise<ExtensionRecord> {
  const manifest = resolved.manifest;
  const existingExtensions = config.extensions ?? [];

  // Check conflicts
  assertNoReplacementConflicts(
    existingExtensions.filter(e => e.name !== manifest.name),
    manifest,
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

  // Backup existing extension if upgrading
  const existingDir = getExtensionDir(projectDir, manifest.name);
  const backupDir = existingDir + '.backup';
  const hasExisting = await fileExists(existingDir);

  if (hasExisting) {
    await copyDirectory(existingDir, backupDir);
  }

  try {
    // Remove previous assets from agents
    const previousManifest = hasExisting
      ? await loadExtensionManifest(getExtensionDir(projectDir, manifest.name))
      : null;

    if (previousManifest) {
      await removeExtensionAssetsForAllAgents(projectDir, config, previousManifest);
    }

    // Remove previous config state
    removePreviousExtensionState(config, manifest.name);

    // Commit extension files to storage
    await commitExtensionInstall(projectDir, resolved);

    // Install assets for all agents
    const extensionDir = getExtensionDir(projectDir, manifest.name);
    await installExtensionAssetsForAllAgents(
      projectDir, config, manifest, extensionDir,
    );

    // Update config
    const record = buildExtensionRecord(resolved);
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

  if (manifest) {
    await removeExtensionAssetsForAllAgents(projectDir, config, manifest);
  }

  removePreviousExtensionState(config, extensionName);
  await removeExtensionFiles(projectDir, extensionName);
}

// --- Refresh extensions (version check + re-commit) ---

export async function refreshExtensions(
  projectDir: string,
  config: UniKitConfig,
  options?: { force?: boolean },
): Promise<{ updated: string[]; failed: string[] }> {
  const extensions = config.extensions ?? [];
  const updated: string[] = [];
  const failed: string[] = [];
  const force = options?.force ?? false;

  for (const ext of extensions) {
    try {
      const resolved = await resolveExtension(ext.source);

      if (!force && resolved.manifest.version === ext.version) {
        // Clean up temp dir for git sources
        if (resolved.source.type === 'git' || resolved.source.type === 'github') {
          await removeDirectory(resolved.localPath);
        }
        continue;
      }

      await commitResolvedExtension(projectDir, config, resolved);
      updated.push(ext.name);
    } catch (error) {
      console.warn(`Warning: Could not refresh extension "${ext.name}": ${error}`);
      failed.push(ext.name);
    }
  }

  return { updated, failed };
}

// --- Restore base skills after extension removal ---

export async function restoreBaseSkills(
  projectDir: string,
  config: UniKitConfig,
  skillNames: string[],
): Promise<void> {
  // Re-import dynamically to avoid circular dependency issues
  const { installSkills } = await import('./installer.js');

  for (const agent of config.agents) {
    const skillsToRestore = skillNames.filter(s => agent.installedSkills.includes(s));
    if (skillsToRestore.length === 0) continue;

    await installSkills({
      projectDir,
      skillsDir: agent.skillsDir,
      skills: skillsToRestore,
      agentId: agent.id,
      engineId: config.engine,
      engineMcpKey: config.engineMcpKey,
    });
  }

  // Re-inject MCP tool permissions into restored skills
  if (config.mcp?.servers?.length) {
    const discoveredServers = await discoverMcpServers(config.engine);
    const mcpAllowedTools = collectMcpRules(discoveredServers, config.mcp.servers);
    await injectMcpRules(projectDir, config.agents, mcpAllowedTools);
  }

  // Re-apply content injections from remaining installed extensions
  const remainingExtensions = config.extensions ?? [];
  for (const ext of remainingExtensions) {
    const extDir = getExtensionDir(projectDir, ext.name);
    const extManifest = await loadExtensionManifest(extDir);
    if (!extManifest?.injections?.length) continue;

    for (const agent of config.agents) {
      await applyAllInjections(projectDir, agent, ext.name, extManifest.injections, extDir);
    }
  }
}
