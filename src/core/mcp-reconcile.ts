// --- MCP settings-file reconciliation ---
//
// Everything that WRITES a server into an agent's settings file lives here.
// `mcp.ts` keeps discovery, rule collection, the docs/verified summary lines and
// the frontmatter helpers; it had 443 of its 500 allowed lines used up (the
// per-file ceiling is enforced by `test-skills.sh` Part 7i over `src/core/*.ts`)
// and the reconciliation rules that follow — key normalisation, the `env`
// exception, orphan removal, the version-placeholder detector — do not fit in
// what was left. Splitting is the same move `mcp-schema.ts`, `mcp-platform.ts`
// and `mcp-rules.ts` already made, and the dependency runs the same way: this
// module imports types from `mcp.ts`, never the reverse.
//
// The unit of work is the PROJECT, not the agent. `init` used to call
// `configureMcp` from inside its per-agent install loop while the `update` side
// has no such loop at all, which would have given one operation two contours and
// two sets of failure modes. `reconcileMcpSettings` owns the loop; both callers
// hand it the agent list they already have.

import path from 'path';
import { getAgentConfig } from './agents.js';
import { MCP_VERSION_PLACEHOLDER } from './constants.js';
import type { UniKitConfig } from './config.js';
import { getExtensionDir, loadExtensionManifest } from './extensions.js';
import { ensureDir, writeTextFile } from '../utils/fs.js';
import { logInfo, logWarn } from '../utils/log.js';
import type { DiscoveredServers } from './mcp.js';
import { resolvePlatformConfig } from './mcp-platform.js';
import { getMcpWriter } from './mcp-writers/index.js';

/**
 * The settings-file keys that belong to extensions and are therefore off limits
 * to the normalisation scan.
 *
 * Read from each extension's MANIFEST on disk, not from `.unikit.json`:
 * `ExtensionRecord` carries `{ name, source, version, replacedSkills }` and has
 * no server list at all — `mcpServers` lives in `ExtensionManifest`. A missing
 * or malformed manifest contributes nothing rather than failing the pass, on the
 * standing house rule that a defect in one extension never aborts the run.
 */
async function collectReservedKeys(projectDir: string, config: UniKitConfig | null): Promise<Set<string>> {
  const reserved = new Set<string>();
  for (const ext of config?.extensions ?? []) {
    const manifest = await loadExtensionManifest(getExtensionDir(projectDir, ext.name));
    for (const server of manifest?.mcpServers ?? []) {
      reserved.add(server.key);
    }
  }
  return reserved;
}

/**
 * Write the selected servers into ONE agent's settings file.
 *
 * Three rules, and the middle one is the reason this function is not a plain
 * `upsert` loop any more:
 *
 *  - **absent** → write the entry in full. The usual case on a fresh project.
 *  - **present** → leave `command` / `args` exactly as they are. Whoever wrote
 *    that entry — the vendor's editor plugin, or the user — knows things we do
 *    not: a pinned version, a local build, an API key. Overwriting it is how the
 *    duplicate-registration bug this release fixes came about in the first place.
 *  - **present under a different spelling** (case or surrounding whitespace) →
 *    `remove` + `upsert` under our `code`. Leaving it is not an option: grants
 *    are literal, so `mcp__UnityMCP__*` confers nothing on tools published under
 *    `mcp__unityMCP__*`.
 *
 * In both "present" branches the `env` overlay is applied — the single field we
 * impose on an entry we did not write (see {@link McpWriter.mergeEnv}).
 *
 * A server whose code CHANGED since the last write is a fourth case, and the
 * only one that removes anything: the entry standing under the stored code is an
 * orphan — nothing is listening on it, while its grants stay live in every
 * skill's frontmatter. See {@link storedCodes}.
 *
 * @param enabledFileIds the selection, by file id — the keys of
 *                       `config.mcp.servers`, or the wizard's answer on `init`.
 * @param reserved       settings keys owned by extensions; never normalised.
 * @param storedCodes    `key → code` as PERSISTED before this run recomputed it.
 *                       Read from the on-disk config, never from the freshly
 *                       built map: the two differ exactly for the servers whose
 *                       registration has to be moved, and comparing the new map
 *                       against itself makes every swap a silent no-op.
 * @returns the file ids actually written (a server with no config for this
 *          platform is skipped with a warning, not an abort).
 */
export async function configureMcp(
  projectDir: string,
  discoveredServers: DiscoveredServers,
  enabledFileIds: string[],
  agentId: string = 'claude',
  reserved: Set<string> = new Set(),
  storedCodes: Record<string, string> = {},
): Promise<string[]> {
  const agent = getAgentConfig(agentId);

  if (!agent.supportsMcp || !agent.settingsFile) {
    return [];
  }

  const writer = getMcpWriter(agentId);
  const configuredFileIds: string[] = [];
  const settingsPath = path.join(projectDir, agent.settingsFile);
  const settingsDir = path.dirname(settingsPath);

  await ensureDir(settingsDir);

  const settings = await writer.readExisting(settingsPath);
  // The before-image, serialized through the same writer so the comparison at
  // the end is between two outputs of one formatter and never trips on
  // whitespace the file happened to carry.
  const before = writer.serialize(settings);
  const placeholderCandidates: string[] = [];

  for (const fileId of enabledFileIds) {
    const server = discoveredServers.get(fileId);
    if (!server) continue;

    const resolvedConfig = resolvePlatformConfig(server);
    if (!resolvedConfig) {
      logWarn(
        'configureMcp',
        `server ${server.code}: no config for platform ${process.platform} and no fallback config, skipping`,
      );
      continue;
    }

    // The SWAP, before anything else touches this entry. A code that differs
    // from the one persisted last run means UniKit registered this server under
    // a name it no longer uses — the entry sitting there is an orphan, and it is
    // invisible to every other branch here (`findKey` looks for the CURRENT
    // code, so it never sees it). Left in place it keeps a dead server declared
    // while the grants it conferred stay live in the installed frontmatter.
    //
    // This is also the whole upgrade path off the pre-1.2.0 schema: the
    // `mcp-servers-map` migration deliberately preserved the OLD code, so the
    // divergence shows up here on the first run and heals itself. No separate
    // migration for `.mcp.json` is needed.
    const storedCode = storedCodes[fileId];
    if (storedCode && storedCode !== server.code) {
      logInfo('mcp', `swap detected for ${fileId}: ${storedCode} -> ${server.code}`);
      if (writer.remove(settings, storedCode)) {
        logInfo('mcp', `removed orphan entry ${storedCode} from ${settingsPath}`);
      }
    } else {
      logInfo('mcp', `no code change for ${fileId}`);
    }

    // The rule holds for `context7` as much as for an engine server: a user may
    // have put their own API key on that entry.
    const existingKey = writer.findKey(settings, server.code, reserved);

    if (existingKey === null) {
      writer.upsert(settings, server.code, resolvedConfig);
      logInfo('mcp', `server ${server.code}: created`);
    } else if (existingKey === server.code) {
      logInfo('mcp', `server ${server.code}: kept`);
    } else {
      writer.remove(settings, existingKey);
      writer.upsert(settings, server.code, resolvedConfig);
      logInfo('mcp', `server ${server.code}: normalized from ${existingKey}`);
    }

    // A server whose shipped config carries the version placeholder can leave one
    // in the settings file; collected here so the check at the end can name the
    // server instead of reporting an anonymous token.
    if (JSON.stringify(resolvedConfig).includes(MCP_VERSION_PLACEHOLDER)) {
      placeholderCandidates.push(server.code);
    }

    const env = resolvedConfig['env'];
    if (env && typeof env === 'object' && !Array.isArray(env)) {
      const envRecord = env as Record<string, unknown>;
      writer.mergeEnv(settings, server.code, envRecord);
      // Keys only — a value here can be an API key.
      logInfo('mcp', `server ${server.code}: env overlaid (${Object.keys(envRecord).join(', ')})`);
    }

    configuredFileIds.push(fileId);
  }

  if (configuredFileIds.length > 0) {
    // Idempotence is checked on the SERIALIZED result, not on a flag set along
    // the way. `update` runs this pass on every invocation, and a pass that
    // rewrites an identical settings file each time churns the mtime of a file
    // users have open in an editor and makes "the last run changed my config"
    // impossible to read off the disk. Comparing the output to what is already
    // there is the only check that cannot drift from what is actually written.
    const serialized = writer.serialize(settings);

    // The version-placeholder detector. It reads the SETTINGS FILE, not the
    // package config, which is what makes it useful: a user who pinned the
    // version by hand — or whose Unity editor wrote the pin for them — has no
    // placeholder left on disk and hears nothing, while an entry still carrying
    // it gets a loud line every run until it is filled in. Living inside this
    // pass rather than in `init` is deliberate: `init` runs once, and the pin is
    // exactly the thing that goes stale afterwards.
    if (serialized.includes(MCP_VERSION_PLACEHOLDER)) {
      for (const code of placeholderCandidates) {
        logWarn(
          'mcp',
          `server ${code}: version placeholder not filled — open Unity or set the version manually `
          + '(the server version must match the version of the Unity package)',
        );
      }
    } else if (placeholderCandidates.length > 0) {
      logInfo('mcp', `version pin filled for: ${placeholderCandidates.join(', ')}`);
    }

    if (serialized === before) {
      logInfo('mcp', `${agentId}: settings unchanged, not rewritten`);
    } else {
      await writeTextFile(settingsPath, serialized);
      console.log(`[mcp] ${agentId} -> ${settingsPath} (${configuredFileIds.length} servers)`);
    }
  }

  return configuredFileIds;
}

/**
 * Reconcile every selected agent's MCP settings file with the current selection.
 *
 * The one entry point both `init` and `update` use. `init` passes the wizard's
 * answer; `update` passes the keys of `config.mcp.servers` — neither owns the
 * loop, so a rule added here (the `env` overlay, orphan removal, the placeholder
 * detector) reaches both paths by construction rather than by remembering to
 * wire it twice.
 *
 * The scan is confined to the PROJECT settings file of each agent —
 * `readExisting` opens exactly `projectDir/<agent.settingsFile>`. Global configs
 * (`~/.claude.json` and friends) are outside this contract. For one server out
 * of six that may be incomplete: fennara is documented as writing into the
 * global config, and how Claude Code merges a global and a project entry when
 * their codes agree — or disagree — is untested (`.ai-factory/RESEARCH.md` §G).
 * It changes nothing in this scope and blocks nothing; it is recorded so
 * "we normalised the only variant there was" is not mistaken for proven.
 *
 * ORDER TRAP — the same one `swapMcpRecheckNotes` already carries: the caller
 * must read `storedCodes` off the config that is still on disk, run this pass,
 * and only THEN persist the new map. Persist first and `stored === current` for
 * every entry, no swap fires, and the orphan survives. On the `update` path the
 * before-state is the local snapshot taken before the codes were recomputed —
 * NOT `config.mcp.servers`, which by then already holds the new values.
 *
 * @param agentIds    the agents installed for this project.
 * @param config      the project config, read for its extension list only — the
 *                    keys those extensions registered are excluded from the
 *                    normalisation scan. `null` is accepted (a fresh `init` has
 *                    not written one yet) and means "no extensions".
 * @param storedCodes `key → code` as persisted BEFORE this run; empty means
 *                    "nothing was registered yet", so nothing can be orphaned.
 */
export async function reconcileMcpSettings(
  projectDir: string,
  discoveredServers: DiscoveredServers,
  enabledFileIds: string[],
  agentIds: string[],
  config: UniKitConfig | null = null,
  storedCodes: Record<string, string> = {},
): Promise<void> {
  const reserved = await collectReservedKeys(projectDir, config);
  if (reserved.size > 0) {
    logInfo('mcp', `reserved extension keys: ${[...reserved].join(', ')}`);
  }

  for (const agentId of agentIds) {
    await configureMcp(projectDir, discoveredServers, enabledFileIds, agentId, reserved, storedCodes);
  }
}
