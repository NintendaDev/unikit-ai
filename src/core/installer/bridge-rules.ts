// --- The rule of a bridge follows the bridge ---
//
// A selected bridge gets the stack rule of the registry with the same id (when the registry has one and
// the project does not), with its `references/`; a dropped bridge loses it again — but only a rule that
// came from the registry and was never edited, because everything else is the user's. Exit-free and
// print-free: the callers (`init`, `update`) print the report and own the one `saveConfig`.
//
// The state of the rules is mutated in place. `update` hands over its live `config.rules.installed` as
// the previous state; `init` resets that state (the files stay on disk), so it hands over the one of the
// config it replaces, and a record of a rule that is still wanted is carried over rather than lost.

import path from 'path';
import { getModuleTier } from '../config.js';
import type { InstalledRuleEntry, RulesInstallation, UniKitConfig } from '../config.js';
import { CODE_MODULE_ID, REFERENCES_DIR_NAME, moduleTierDir } from '../constants.js';
import {
  BRIDGE_ORDER_ID_PATTERN, BRIDGE_RULE_KEPT_REASONS, BRIDGE_RULE_TIER, BRIDGE_RULES_LOG_COMPONENT,
} from '../constants-bridges.js';
import { getModule } from '../modules.js';
import type { ChainedRegistry } from '../registry/index.js';
import { resolveModuleCatalog } from './module-catalog.js';
import { installOneRule } from './rules-bootstrap.js';
import { generateRulesIndex, loadRequiredByMap, normalizeRuleId } from './rules-index.js';
import { computeContentHash } from './shared.js';
import { fileExists, listFiles, readTextFile, removeFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

export type BridgeRuleStatus = 'installed' | 'present' | 'removed' | 'kept' | 'not-in-registry' | 'failed';

export interface BridgeRuleLine {
  id: string;
  status: BridgeRuleStatus;
  reason?: string;
}

export interface BridgeRulesReport {
  lines: BridgeRuleLine[];
  stateChanged: boolean;
}

export interface BridgeRulesInput {
  projectDir: string;
  /** Mutated: entries are pushed and spliced. `init` saves it afterwards; `update` saves it at the end of the command. */
  config: UniKitConfig;
  registry: ChainedRegistry;
  engineId: string;
  /** `null` = no record of a previous set. */
  previousBridgeIds: string[] | null;
  currentBridgeIds: string[];
  /** The rule state as it was BEFORE this run: `update` passes `config.rules.installed` itself, `init` passes `existingConfig?.rules.installed ?? null`. */
  previousRules: RulesInstallation | null;
  /** `disk` = rebuild the index of the code module from the files on disk (`init`, whose state is reset); `none` = the caller does (`update`, Phase 3 of the sync). */
  regenerateIndex: 'disk' | 'none';
}

const REGISTRY_UNREACHABLE = 'registry unreachable';
const NOT_A_BRIDGE_ID = 'not a valid bridge id';
const RULE_FILE_EXTENSION = '.md';
const REFERENCES_HEADER_MARK = '**References**';
/** A reference file named in the header of a rule: a bare file name, never a path. */
const REFERENCE_FILE_PATTERN = /references\/([^`\s,)/\\]+\.md)/g;

/** The reference files a rule lists in its `**References**` header, or `null` when it has no such header. */
export function parseRuleReferenceFiles(ruleText: string): string[] | null {
  const header = ruleText.split(/\r?\n/).find(line => line.includes(REFERENCES_HEADER_MARK));
  if (header === undefined) return null;
  return [...new Set([...header.matchAll(REFERENCE_FILE_PATTERN)].map(match => match[1]))];
}

/** True only for a rule that came from the registry and is byte-identical to what was installed. */
export function isInstalledRegistryRuleUnchanged(entry: InstalledRuleEntry | undefined, diskText: string | null): boolean {
  return entry?.source === 'registry'
    && entry.installed_hash !== undefined
    && diskText !== null
    && computeContentHash(diskText) === entry.installed_hash;
}

function findStackEntry(rules: RulesInstallation | null, id: string): InstalledRuleEntry | undefined {
  const entries = rules?.modules[CODE_MODULE_ID]?.[BRIDGE_RULE_TIER] ?? [];
  return entries.find(entry => normalizeRuleId(entry.name) === normalizeRuleId(id));
}

function dropEntry(config: UniKitConfig, id: string): boolean {
  const list = getModuleTier(config, CODE_MODULE_ID, BRIDGE_RULE_TIER);
  const index = list.findIndex(entry => normalizeRuleId(entry.name) === normalizeRuleId(id));
  if (index < 0) return false;
  list.splice(index, 1);
  return true;
}

const stackDir = (projectDir: string): string => moduleTierDir(projectDir, CODE_MODULE_ID, BRIDGE_RULE_TIER);
const ruleFile = (projectDir: string, id: string): string => path.join(stackDir(projectDir), `${id}${RULE_FILE_EXTENSION}`);

/** The reference files that other installed rules list: a file two rules share stays when one of them goes. */
async function referencesOfOtherRules(projectDir: string, exceptId: string): Promise<Set<string>> {
  const shared = new Set<string>();
  for (const name of await listFiles(stackDir(projectDir))) {
    if (!name.endsWith(RULE_FILE_EXTENSION) || name === `${exceptId}${RULE_FILE_EXTENSION}`) continue;
    for (const ref of parseRuleReferenceFiles(await readTextFile(path.join(stackDir(projectDir), name)) ?? '') ?? []) shared.add(ref);
  }
  return shared;
}

/** A rule with no `**References**` header: the files of its folder that carry the id as a prefix, as `installOneRule` names them. */
async function prefixedReferences(projectDir: string, id: string): Promise<string[]> {
  const prefix = id.toLowerCase();
  const names = await listFiles(path.join(stackDir(projectDir), REFERENCES_DIR_NAME));
  return names.filter(name => name.toLowerCase().startsWith(`${prefix}-`) || name.toLowerCase() === `${prefix}${RULE_FILE_EXTENSION}`);
}

async function removeBridgeRule(input: BridgeRulesInput, id: string, report: BridgeRulesReport): Promise<void> {
  const { projectDir, config, previousRules } = input;
  const file = ruleFile(projectDir, id);
  if (!(await fileExists(file))) {
    if (dropEntry(config, id)) report.stateChanged = true;
    return;
  }
  const text = await readTextFile(file);
  const entry = findStackEntry(previousRules, id);
  if (!isInstalledRegistryRuleUnchanged(entry, text)) {
    const reason = entry === undefined ? BRIDGE_RULE_KEPT_REASONS.untracked
      : entry.source !== 'registry' ? BRIDGE_RULE_KEPT_REASONS.local : BRIDGE_RULE_KEPT_REASONS.modified;
    report.lines.push({ id, status: 'kept', reason });
    logInfo(BRIDGE_RULES_LOG_COMPONENT, `kept ${id}: ${reason}`);
    return;
  }
  const listed = parseRuleReferenceFiles(text ?? '') ?? await prefixedReferences(projectDir, id);
  const sharedWithOthers = await referencesOfOtherRules(projectDir, id);
  let removedReferences = 0;
  for (const ref of listed.filter(name => !sharedWithOthers.has(name))) {
    const refPath = path.join(stackDir(projectDir), REFERENCES_DIR_NAME, ref);
    if (await fileExists(refPath)) { await removeFile(refPath); removedReferences++; }
  }
  await removeFile(file);
  dropEntry(config, id);
  report.lines.push({ id, status: 'removed' });
  report.stateChanged = true;
  logInfo(BRIDGE_RULES_LOG_COMPONENT, `removed ${id} and its ${removedReferences} reference file(s)`);
}

/** The id of a wanted rule is on disk already (never overwritten) or has to come from the registry. */
async function classifyWanted(input: BridgeRulesInput, id: string, report: BridgeRulesReport): Promise<boolean> {
  const { projectDir, config, previousRules } = input;
  const inConfig = findStackEntry(config.rules.installed, id);
  if (await fileExists(ruleFile(projectDir, id))) {
    const previous = findStackEntry(previousRules, id);
    if (!inConfig && previous) {
      getModuleTier(config, CODE_MODULE_ID, BRIDGE_RULE_TIER).push({ ...previous });
      report.stateChanged = true;
    }
    report.lines.push({ id, status: 'present' });
    return false;
  }
  if (inConfig) dropEntry(config, id);
  return true;
}

async function installWantedRules(input: BridgeRulesInput, ids: string[], report: BridgeRulesReport): Promise<void> {
  const codeModule = getModule(CODE_MODULE_ID);
  if (!codeModule || ids.length === 0) return;
  const catalog = await resolveModuleCatalog(input.registry, codeModule, input.engineId).catch(() => null);
  if (catalog === null || !catalog.reachable) {
    logWarn(BRIDGE_RULES_LOG_COMPONENT, 'rules registry unreachable: the rules of the bridges are not installed this time');
    for (const id of ids) report.lines.push({ id, status: 'failed', reason: REGISTRY_UNREACHABLE });
    return;
  }
  const stackRules = catalog.engineAvailable ? catalog.rules.filter(row => row.tier === BRIDGE_RULE_TIER) : [];
  for (const id of ids) {
    try {
      if (!stackRules.some(row => normalizeRuleId(row.rule.id) === normalizeRuleId(id))) {
        report.lines.push({ id, status: 'not-in-registry' });
        logInfo(BRIDGE_RULES_LOG_COMPONENT, `${id} has no rule in the registry`);
        continue;
      }
      const line = await installOneRule(input.projectDir, input.config, input.registry, codeModule, stackRules, input.engineId, id, { preferredTier: BRIDGE_RULE_TIER });
      if (line.status === 'installed') {
        report.lines.push({ id, status: 'installed' });
        report.stateChanged = true;
        logInfo(BRIDGE_RULES_LOG_COMPONENT, `installed ${id}`);
      } else {
        report.lines.push({ id, status: 'failed', reason: line.reason ?? line.status });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report.lines.push({ id, status: 'failed', reason });
      logWarn(BRIDGE_RULES_LOG_COMPONENT, `could not install ${id}: ${reason}`);
    }
  }
}

/**
 * Bring the stack rules of the bridges in step with the selection: remove the rule of a dropped bridge (only an
 * unchanged registry rule), keep a rule that is on disk, install the rule of a selected bridge that has none.
 * Without bridges (selected or dropped) the registry is not asked at all.
 */
export async function syncBridgeRules(input: BridgeRulesInput): Promise<BridgeRulesReport> {
  const report: BridgeRulesReport = { lines: [], stateChanged: false };
  const codeModule = getModule(CODE_MODULE_ID);
  if (!codeModule) return report;
  const dropped = input.previousBridgeIds === null ? [] : input.previousBridgeIds.filter(id => !input.currentBridgeIds.includes(id));
  if (input.currentBridgeIds.length === 0 && dropped.length === 0) return report;

  const usable = (id: string): boolean => {
    if (BRIDGE_ORDER_ID_PATTERN.test(id)) return true;
    report.lines.push({ id, status: 'failed', reason: NOT_A_BRIDGE_ID });
    return false;
  };
  for (const id of dropped.filter(usable)) {
    try {
      await removeBridgeRule(input, id, report);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report.lines.push({ id, status: 'failed', reason });
      logWarn(BRIDGE_RULES_LOG_COMPONENT, `could not remove the rule of ${id}: ${reason}`);
    }
  }
  const wanted: string[] = [];
  for (const id of input.currentBridgeIds.filter(usable)) {
    try {
      if (await classifyWanted(input, id, report)) wanted.push(id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report.lines.push({ id, status: 'failed', reason });
      logWarn(BRIDGE_RULES_LOG_COMPONENT, `could not read the rule of ${id}: ${reason}`);
    }
  }
  await installWantedRules(input, wanted, report);

  if (input.regenerateIndex === 'disk' && (report.stateChanged || report.lines.some(line => line.status === 'installed' || line.status === 'removed'))) {
    try {
      await generateRulesIndex(input.projectDir, codeModule, {}, await loadRequiredByMap(), {});
    } catch (error) {
      logWarn(BRIDGE_RULES_LOG_COMPONENT, `could not rebuild RULES_INDEX.md: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return report;
}
