// --- The order file of the engine bridges (`.unikit/bridges.yaml`) ---
//
// Pure: the format and the "did the user edit it" decision, no disk, no log, no throw. The installer
// wrapper (`installer/bridge-order.ts`) does the reading and writing. The accepted YAML is the subset
// the file itself uses — a key `order:` over a block or flow list, comments — because the installer
// has no YAML library and anything it does not understand must stay untouched, never be rewritten.

import { BRIDGE_ORDER_HEADER, BRIDGE_ID_PATTERN, BRIDGE_ORDER_KEY } from '../constants-bridges.js';

/** What the installer found on disk: nothing, a file it cannot read, or a parsed list. */
export type OrderFileState =
  | { state: 'absent' }
  | { state: 'unreadable' }
  | { state: 'list'; order: string[] };

/** Why a decision came out as it did: `package` — the file followed the package order; `yours` — the user's edit is kept. */
export type OrderBasis = 'created' | 'package' | 'yours' | 'unreadable' | 'no-bridges';

export interface OrderDecision {
  action: 'write' | 'keep' | 'delete' | 'none';
  /** The list to write (`write`), the list already in the file (`keep`); empty for `delete`, `none` and an unreadable file. */
  order: string[];
  basis: OrderBasis;
}

const BOM = '﻿';
const LINE_BREAK = /\r?\n/;
const TRAILING_COMMENT = /\s+#.*$/;
const KEY_LINE = new RegExp(`^${BRIDGE_ORDER_KEY}:\\s*(.*)$`);
const BLOCK_ITEM = /^\s*-\s+(.+)$/;

function unquote(value: string): string {
  const first = value[0];
  const quoted = value.length >= 2 && (first === '"' || first === "'") && value[value.length - 1] === first;
  return quoted ? value.slice(1, -1) : value;
}

function parseFlowList(rest: string): string[] | null {
  const items = rest.slice(1, -1).split(',').map(item => unquote(item.trim())).filter(item => item !== '');
  return items.every(id => BRIDGE_ID_PATTERN.test(id)) ? items : null;
}

/** The ids of an order file in file order (the first of a repeated id wins), or `null` when the text is not a list this module reads. */
export function parseBridgeOrder(text: string): string[] | null {
  const lines = (text.startsWith(BOM) ? text.slice(BOM.length) : text).split(LINE_BREAK);
  let order: string[] | null = null;
  let flowDone = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const body = line.replace(TRAILING_COMMENT, '');
    if (order === null) {
      const match = line.startsWith(`${BRIDGE_ORDER_KEY}:`) ? KEY_LINE.exec(body.trim()) : null;
      if (!match) return null;
      const rest = match[1].trim();
      if (rest === '') { order = []; continue; }
      if (!(rest.startsWith('[') && rest.endsWith(']'))) return null;
      const items = parseFlowList(rest);
      if (items === null) return null;
      order = items;
      flowDone = true;
      continue;
    }
    if (flowDone) return null;
    const item = BLOCK_ITEM.exec(body);
    if (!item) return null;
    const id = unquote(item[1].trim());
    if (!BRIDGE_ID_PATTERN.test(id)) return null;
    order.push(id);
  }
  return order === null ? null : [...new Set(order)];
}

/** The text of an order file: the header, then the list; LF only, one newline at the end. */
export function renderBridgeOrder(order: readonly string[]): string {
  const list = order.length === 0 ? [`${BRIDGE_ORDER_KEY}: []`] : [`${BRIDGE_ORDER_KEY}:`, ...order.map(id => `  - ${id}`)];
  return [...BRIDGE_ORDER_HEADER, ...list].join('\n') + '\n';
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * What to do with the file. `autoNow` / `autoPrev` are the package order (weights) of the current and of the
 * previous set of bridges; a list that is not `autoPrev` is one the user edited, and is kept as the user left it.
 */
export function decideBridgeOrder(input: {
  autoNow: readonly string[];
  autoPrev: readonly string[];
  file: OrderFileState;
}): OrderDecision {
  const { autoNow, autoPrev, file } = input;
  if (autoNow.length === 0) {
    return file.state === 'absent'
      ? { action: 'none', order: [], basis: 'no-bridges' }
      : { action: 'delete', order: [], basis: 'no-bridges' };
  }
  if (file.state === 'absent') return { action: 'write', order: [...autoNow], basis: 'created' };
  if (file.state === 'unreadable') return { action: 'keep', order: [], basis: 'unreadable' };

  const basis: OrderBasis = sameList(file.order, autoPrev) ? 'package' : 'yours';
  let result: string[];
  if (basis === 'package') {
    result = [...autoNow];
  } else {
    const kept = file.order.filter(id => autoNow.includes(id));
    const appended = autoNow.filter(id => !kept.includes(id));
    result = [...kept, ...appended];
  }
  return { action: sameList(result, file.order) ? 'keep' : 'write', order: result, basis };
}
