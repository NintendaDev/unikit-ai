// --- The order file of the engine bridges, kept by the installer ---
//
// `.unikit/bridges.yaml` follows the selection on every init and update, with no skill in between: a
// file nobody edited is recomputed from the package weights, an edited one keeps its order (a dropped
// bridge leaves it, a new one goes at the end), an unreadable one is left alone, and without bridges
// the file goes. The file is read by agents (D3) and by this module — never by a hash (NFR-1).

import { UNIKIT_DIR } from '../constants.js';
import { BRIDGE_ORDER_FILE, BRIDGE_ORDER_SEPARATOR, bridgeOrderPath } from '../constants-bridges.js';
import { decideBridgeOrder, parseBridgeOrder, renderBridgeOrder, type OrderDecision, type OrderFileState } from '../bridges/order-file.js';
import { orderBridges } from '../bridges/selection.js';
import type { DiscoveredServers } from '../mcp.js';
import { fileExists, readTextFile, removeFile, writeTextFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';

const LOG_COMPONENT = 'bridge-order';

/** The file as people see it in a message: `.unikit/bridges.yaml`. */
const DISPLAY_NAME = `${UNIKIT_DIR}/${BRIDGE_ORDER_FILE}`;

const BASIS_TEXT = { package: 'package order', yours: 'yours, kept' } as const;

const NO_BRIDGE_TEXT = 'no bridge is selected';
const ADDED_AT_END_TEXT = 'added at the end';
const UNREADABLE_TEXT = `could not read ${DISPLAY_NAME} (an "order:" list is expected); left as it is, agents use the package order from BRIDGES.md`;

function describeBasis(decision: OrderDecision, before: string[]): string {
  if (decision.basis !== 'yours') return BASIS_TEXT.package;
  const added = decision.order.filter(id => !before.includes(id));
  return added.length === 0 ? BASIS_TEXT.yours : `${BASIS_TEXT.yours}; ${ADDED_AT_END_TEXT}: ${added.join(', ')}`;
}

function logDecision(decision: OrderDecision, before: string[]): void {
  const list = decision.order.join(BRIDGE_ORDER_SEPARATOR);
  const basis = describeBasis(decision, before);
  switch (decision.action) {
    case 'write':
      logInfo(LOG_COMPONENT, `${decision.basis === 'created' ? 'created' : 'updated'} ${DISPLAY_NAME}: ${list} (${basis})`);
      break;
    case 'keep':
      if (decision.basis === 'unreadable') logWarn(LOG_COMPONENT, UNREADABLE_TEXT);
      else logInfo(LOG_COMPONENT, `unchanged ${DISPLAY_NAME}: ${list} (${basis})`);
      break;
    case 'delete':
      logInfo(LOG_COMPONENT, `removed ${DISPLAY_NAME}: ${NO_BRIDGE_TEXT}`);
      break;
    case 'none':
      break;
  }
}

/**
 * Bring `.unikit/bridges.yaml` in step with the selection.
 *
 * @param previousIds the bridges of the previous run, or `null` when nothing records them (a first run)
 * @param currentIds the bridges selected now
 * @returns what was decided; `action: 'keep'` means the file was not written
 */
export async function syncBridgeOrder(
  projectDir: string,
  discovered: DiscoveredServers,
  previousIds: string[] | null,
  currentIds: string[],
): Promise<OrderDecision> {
  const filePath = bridgeOrderPath(projectDir);
  const autoNow = orderBridges(discovered, currentIds).map(bridge => bridge.fileId);
  const autoPrev = previousIds === null ? [] : orderBridges(discovered, previousIds).map(bridge => bridge.fileId);

  const exists = await fileExists(filePath);
  const text = exists ? await readTextFile(filePath) : null;
  const parsed = text === null ? null : parseBridgeOrder(text);
  const file: OrderFileState = !exists ? { state: 'absent' } : parsed === null ? { state: 'unreadable' } : { state: 'list', order: parsed };

  const decision = decideBridgeOrder({ autoNow, autoPrev, file });
  if (decision.action === 'write') await writeTextFile(filePath, renderBridgeOrder(decision.order));
  else if (decision.action === 'delete') await removeFile(filePath);
  logDecision(decision, parsed ?? []);
  return decision;
}
