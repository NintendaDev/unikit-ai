import {
  EXTENSION_BLOCK_MARKER_PREFIX,
  EXTENSION_POINT_ANCHOR_CLOSE,
  EXTENSION_POINT_ANCHOR_OPEN,
  EXTENSION_POINT_KEY_SEGMENTS,
} from './constants.js';

// Everything the installer does to the TEXT of an extension block, with no I/O: the marker format,
// finding the one anchor, inserting under it, taking a block out byte-exactly, and the normalisation
// the installed-file hash goes through. Pure on purpose — the edge cases (no trailing newline, CRLF,
// two blocks under one anchor) are checked by a unit test, not by installing a project.
//
// Three shapes of block exist and one removal procedure handles all of them:
//   * point block   — `'\n' + region` right after the anchor line's text (or after the frontmatter);
//   * legacy append — `trimEnd() + '\n\n' + region + '\n'` at the end of the file;
//   * legacy prepend— `region + '\n'` at the very start of the file (before the frontmatter).
// A region is `start marker + '\n' + text + '\n' + end marker`.

const MARKER_OPEN = `<!-- ${EXTENSION_BLOCK_MARKER_PREFIX}:`;
const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/;

export interface BlockRegion {
  /** Index of the first character of the start marker. */
  start: number;
  /** Index just past the last character of the end marker. */
  end: number;
  key: string;
  /** Number of `:`-separated key fields: 4 for a point block, 3 for a legacy one. */
  segments: number;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Marker format ---

/** `ext:target:point:id` */
export function pointBlockKey(extName: string, target: string, point: string, id: string): string {
  return `${extName}:${target}:${point}:${id}`;
}

/** `ext:target:position` */
export function legacyBlockKey(extName: string, target: string, position: string): string {
  return `${extName}:${target}:${position}`;
}

export function blockStartMarker(key: string): string {
  return `${MARKER_OPEN}${key}:start -->`;
}

export function blockEndMarker(key: string): string {
  return `${MARKER_OPEN}${key}:end -->`;
}

export function renderBlockRegion(key: string, text: string): string {
  return `${blockStartMarker(key)}\n${text}\n${blockEndMarker(key)}`;
}

/** True when the text holds an opening of a block marker — what a block text must never contain. */
export function containsBlockMarker(text: string): boolean {
  return text.includes(MARKER_OPEN);
}

// --- Finding and removing blocks ---

/** Every well-formed start/end pair, in file order. A start with no end is skipped, never removed. */
export function findBlockRegions(content: string): BlockRegion[] {
  const regions: BlockRegion[] = [];
  if (!content.includes(MARKER_OPEN)) return regions;

  const startPattern = new RegExp(`${escapeRegExp(MARKER_OPEN)}([^\\n]*?):start -->`, 'g');
  let match: RegExpExecArray | null;
  while ((match = startPattern.exec(content)) !== null) {
    const key = match[1];
    const endMarker = blockEndMarker(key);
    const endAt = content.indexOf(endMarker, match.index + match[0].length);
    if (endAt === -1) continue;

    const end = endAt + endMarker.length;
    regions.push({ start: match.index, end, key, segments: key.split(':').length });
    startPattern.lastIndex = end;
  }
  return regions;
}

/**
 * Cut the given regions out, right to left so the indexes stay valid. For each region the first
 * matching rule wins; each rule removes exactly what one insertion form added.
 */
export function removeBlockRegions(content: string, regions: BlockRegion[]): string {
  let result = content;
  const ordered = [...regions].sort((a, b) => b.start - a.start);

  for (const region of ordered) {
    const from = region.start;
    const to = region.end;

    if (from > 1 && result[from - 1] === '\n' && result[from - 2] === '\n' && result[to] === '\n') {
      // Legacy append: the blank line before the region and the newline after it.
      result = result.slice(0, from - 1) + result.slice(to + 1);
    } else if (from > 0 && result[from - 1] === '\n') {
      // Point block: the unit is '\n' + region.
      result = result.slice(0, from - 1) + result.slice(to);
    } else if (from === 0 && result[to] === '\n') {
      // Legacy prepend: region + '\n' at the start of the file.
      result = result.slice(to + 1);
    } else {
      result = result.slice(0, from) + result.slice(to);
    }
  }
  return result;
}

/** Take every point block (4-field key) out of the file; legacy blocks stay. */
export function removePointBlocks(content: string): { content: string; removed: number } {
  const regions = findBlockRegions(content).filter(r => r.segments === EXTENSION_POINT_KEY_SEGMENTS);
  if (regions.length === 0) return { content, removed: 0 };
  return { content: removeBlockRegions(content, regions), removed: regions.length };
}

/** Take the first block with exactly this key out of the file (legacy `append`/`prepend` blocks). */
export function removeBlockByKey(content: string, key: string): { content: string; removed: number } {
  const region = findBlockRegions(content).find(r => r.key === key);
  if (!region) return { content, removed: 0 };
  return { content: removeBlockRegions(content, [region]), removed: 1 };
}

// --- Anchors and insertion ---

function anchorRegex(point: string): RegExp {
  const anchor = EXTENSION_POINT_ANCHOR_OPEN + point + EXTENSION_POINT_ANCHOR_CLOSE;
  return new RegExp(`^[ \\t]*${escapeRegExp(anchor)}[ \\t]*\\r?$`, 'gm');
}

/** How many lines of the file are the anchor of this point. */
export function countAnchors(content: string, point: string): number {
  return [...content.matchAll(anchorRegex(point))].length;
}

/**
 * Put the regions under the anchor of `point`, in the given order, each as `'\n' + region` right
 * after the anchor line's text. `null` when the file does not carry the anchor exactly once; the
 * content unchanged when there is nothing to insert.
 */
export function insertAtAnchor(content: string, point: string, regions: string[]): string | null {
  if (regions.length === 0) return content;

  const matches = [...content.matchAll(anchorRegex(point))];
  if (matches.length !== 1) return null;

  const match = matches[0];
  const at = (match.index ?? 0) + match[0].replace(/\r$/, '').length;
  return content.slice(0, at) + regions.map(region => '\n' + region).join('') + content.slice(at);
}

/**
 * Legacy `prepend`: the region right after the closing boundary of the frontmatter, or at the very
 * start of a file that has none.
 */
export function insertAfterFrontmatter(content: string, region: string): string {
  const match = FRONTMATTER_PATTERN.exec(content);
  if (!match) return region + '\n' + content;

  const at = match[0].length;
  return content.slice(0, at) + '\n' + region + content.slice(at);
}

// --- Hash normalisation ---

/**
 * The installed text as the source hash sees it: without any extension block, and with the tail
 * brought back to a single newline. A file with no marker is returned as it is, so the hashes of
 * projects that never installed an extension do not move.
 */
export function stripBlocksForHash(content: string): string {
  if (!content.includes(MARKER_OPEN)) return content;

  const regions = findBlockRegions(content);
  if (regions.length === 0) return content;

  const stripped = removeBlockRegions(content, regions);
  return stripped.replace(/\s+$/, '') + '\n';
}
