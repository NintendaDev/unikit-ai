// Refresh of the installed extensions: a version check against each source and a re-commit when
// the version moved (or `force` is set). The previous decisions of a record are carried over; the
// items still undecided are offered through a chooser the command passes in — core never asks.
//
// Lives apart from `extension-ops.ts` so that file stays under the size ceiling and so the
// refresh can use `applyExtensionSelectionChange` without an import cycle
// (refresh → select-ops → ops).

import { getExtensionDir, loadExtensionManifest, resolveExtension } from './extensions.js';
import type { UniKitConfig } from './config.js';
import { commitResolvedExtension, disposeResolvedExtension } from './extension-ops.js';
import { applyExtensionSelectionChange } from './extension-select-ops.js';
import {
  applyDecisions, decideSelection, ExtensionSelectionCancelled, itemLabel, listExtensionItems,
  pendingItems, priorSelectionOf,
  type ExtensionItem, type ExtensionSelection, type NewItemsChooser,
} from './extension-selection.js';
import { EXTENSION_KIND_TITLES, EXTENSION_SELECTION_LOG_COMPONENT } from './constants.js';
import { logInfo } from '../utils/log.js';

/** Items of one extension that are still undecided after a refresh, as "Skills: name" labels. */
export interface PendingExtensionItems {
  extension: string;
  items: string[];
}

export interface RefreshOptions {
  force?: boolean;
  /** Asked for the decisions on undecided items; without it they are left undecided. */
  chooseNewItems?: NewItemsChooser;
}

export interface RefreshResult {
  updated: string[];
  failed: string[];
  pending: PendingExtensionItems[];
  /**
   * The user closed the prompt: the extensions after the one asked about were not processed.
   * Returned, not thrown, so the caller still saves the config for the ones already committed.
   */
  cancelled: boolean;
}

const NO_DECISIONS: ReadonlyMap<string, boolean> = new Map();

/** "Skills: name" label per item, the form `PendingExtensionItems.items` carries. */
export function pendingLabels(items: readonly ExtensionItem[]): string[] {
  return items.map(item => `${EXTENSION_KIND_TITLES[item.kind]}: ${itemLabel(item)}`);
}

export async function refreshExtensions(
  projectDir: string,
  config: UniKitConfig,
  options: RefreshOptions = {},
): Promise<RefreshResult> {
  // A copy: committing and applying a change rewrite `config.extensions` inside the loop.
  const snapshot = [...(config.extensions ?? [])];
  const updated: string[] = [];
  const failed: string[] = [];
  const pending: PendingExtensionItems[] = [];
  const force = options.force ?? false;
  let cancelled = false;

  const choose = async (
    request: Parameters<NewItemsChooser>[0],
  ): Promise<ReadonlyMap<string, boolean>> => (
    options.chooseNewItems ? options.chooseNewItems(request) : NO_DECISIONS
  );

  for (const ext of snapshot) {
    let resolved: Awaited<ReturnType<typeof resolveExtension>> | null = null;

    try {
      resolved = await resolveExtension(ext.source);
      const extensionDir = getExtensionDir(projectDir, ext.name);
      const previousManifest = await loadExtensionManifest(extensionDir);
      const prior = priorSelectionOf(ext, previousManifest);

      if (!force && resolved.manifest.version === ext.version) {
        // Same version: no commit. Offer what an earlier run left undecided.
        if (previousManifest !== null && prior !== null) {
          const items = listExtensionItems(previousManifest);
          const open = pendingItems(items, prior);
          if (open.length > 0) {
            const decisions = await choose({
              extension: ext.name, version: ext.version, sourceDir: extensionDir, items: open,
            });
            let final: ExtensionSelection = prior;
            if (decisions.size > 0) {
              final = applyDecisions(items, prior, decisions);
              await applyExtensionSelectionChange(projectDir, config, ext.name, final);
              updated.push(ext.name);
            }
            const left = pendingItems(items, final);
            logInfo(EXTENSION_SELECTION_LOG_COMPONENT, `${ext.name}: ${open.length} undecided item(s) offered, ${left.length} left`);
            if (left.length > 0) pending.push({ extension: ext.name, items: pendingLabels(left) });
          }
        }
        continue;
      }

      const items = listExtensionItems(resolved.manifest);
      let selection: ExtensionSelection;
      if (prior === null) {
        selection = decideSelection({ items, prior: null, skip: new Set<string>(), installNew: false, skipNew: false });
      } else {
        const open = pendingItems(items, prior);
        const decisions = open.length > 0
          ? await choose({
            extension: resolved.manifest.name,
            version: resolved.manifest.version,
            sourceDir: resolved.localPath,
            items: open,
          })
          : NO_DECISIONS;
        selection = applyDecisions(items, prior, decisions);
      }

      await commitResolvedExtension(projectDir, config, resolved, selection);
      updated.push(ext.name);

      const left = pendingItems(items, selection);
      logInfo(EXTENSION_SELECTION_LOG_COMPONENT, `${ext.name}: ${left.length} undecided item(s) left`);
      if (left.length > 0) pending.push({ extension: ext.name, items: pendingLabels(left) });
    } catch (error) {
      // The user closing the menu stops the whole refresh; any other failure is that extension's.
      if (error instanceof ExtensionSelectionCancelled) {
        cancelled = true;
        break;
      }

      console.warn(`Warning: Could not refresh extension "${ext.name}": ${error}`);
      failed.push(ext.name);
    } finally {
      if (resolved) await disposeResolvedExtension(resolved);
    }
  }

  return { updated, failed, pending, cancelled };
}
