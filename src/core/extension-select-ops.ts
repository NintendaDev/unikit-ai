// Changing the selection of an installed extension from its copy in `.unikit/extensions/<name>/`,
// without the source: what turned off comes out of every agent, what turned on goes in, the
// replacements are recomputed and a base skill whose replacement turned off is restored at once.
//
// Mutates the record in `config.extensions` and the agents' files; it does not save the config
// and does not run the injection pass — the command does both, config last.

import type { UniKitConfig } from './config.js';
import { findExtensionRecord, getExtensionDir, loadExtensionManifest } from './extensions.js';
import {
  assertNoReplacementConflicts, installExtensionAssetsForAllAgents,
  removeExtensionAssetsForAllAgents, restoreBaseSkills,
} from './extension-ops.js';
import {
  allEnabled, deriveReplacedSkills, filterManifest, itemLabel, listExtensionItems,
  manifestSubset, normalizeToItems, priorSelectionOf, type ExtensionSelection,
} from './extension-selection.js';
import { diffSelection } from './extension-selection-query.js';
import { findDanglingPreloads, formatDanglingPreload } from './extension-selection-describe.js';
import { EXTENSION_LOG_COMPONENT, EXTENSION_SELECTION_LOG_COMPONENT } from './constants.js';
import { logInfo, logWarn } from '../utils/log.js';

export interface SelectionChange {
  /** Labels of the items that were installed. */
  enabled: string[];
  /** Labels of the items that were taken out. */
  disabled: string[];
  /** Base skills put back because their replacement turned off. */
  restoredBase: string[];
}

/**
 * Applies `next` to the installed extension `extensionName`. Throws before any change when the
 * extension or its copy is missing or the new replacements would conflict with another extension.
 */
export async function applyExtensionSelectionChange(
  projectDir: string,
  config: UniKitConfig,
  extensionName: string,
  next: ExtensionSelection,
): Promise<SelectionChange> {
  const record = findExtensionRecord(config.extensions ?? [], extensionName);
  if (!record) throw new Error(`Extension "${extensionName}" is not installed`);

  const extensionDir = getExtensionDir(projectDir, extensionName);
  const manifest = await loadExtensionManifest(extensionDir);
  if (!manifest) throw new Error(`Extension "${extensionName}": manifest not found in ${extensionDir}`);

  const items = listExtensionItems(manifest);
  const before = priorSelectionOf(record, manifest) ?? allEnabled(items);
  const after = normalizeToItems(next, items);
  const { enable, disable } = diffSelection(items, before, after);

  // Conflicts first: nothing is written when a new replacement is already taken.
  assertNoReplacementConflicts(
    (config.extensions ?? []).filter(e => e.name !== extensionName),
    filterManifest(manifest, after),
  );

  if (disable.length > 0) {
    await removeExtensionAssetsForAllAgents(projectDir, config, manifestSubset(manifest, disable));
  }
  if (enable.length > 0) {
    await installExtensionAssetsForAllAgents(projectDir, config, manifestSubset(manifest, enable), extensionDir);
  }

  const previousReplaced = Object.keys(record.replacedSkills ?? {});
  const replaced = deriveReplacedSkills(manifest, after);
  record.selection = after;
  if (replaced !== undefined) record.replacedSkills = replaced;
  else delete record.replacedSkills;

  const restoredBase = previousReplaced.filter(base => !(replaced !== undefined && Object.hasOwn(replaced, base)));
  if (restoredBase.length > 0) {
    logInfo(EXTENSION_LOG_COMPONENT, `restoring base skill(s) dropped from replacements: ${restoredBase.join(', ')}`);
    await restoreBaseSkills(projectDir, config, restoredBase);
  }

  for (const dangling of await findDanglingPreloads(extensionDir, manifest, after)) {
    logWarn(EXTENSION_LOG_COMPONENT, formatDanglingPreload(extensionName, dangling));
  }

  logInfo(
    EXTENSION_SELECTION_LOG_COMPONENT,
    `${extensionName}: enable ${enable.length}, disable ${disable.length}, restore ${restoredBase.length}`,
  );

  return { enabled: enable.map(itemLabel), disabled: disable.map(itemLabel), restoredBase };
}
