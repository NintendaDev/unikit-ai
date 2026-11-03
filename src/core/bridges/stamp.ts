// --- The provenance stamp of a delivered rules file ---
//
// Every markdown file of a bridge's rules tree is delivered with a stamp. It records **where this copy
// came from**, and nothing else: a small `field | value` table with one row, `bridge | <bridge id>`, and a
// comment that says to fix the source rather than the copy. It deliberately says nothing about the bridge:
// no tool names, no counters, no list of what is missing — those are the three genres the rules architecture
// bans, and a header that ships into every project is the easiest place for them to creep back in.
//
// The stamp sits right under the first heading of the file, so the title stays the first thing a reader
// sees; a file with no heading gets the stamp on top. The stamp is also the reference point for the notes
// header: skills compare the bridge named here with the one in `.unikit/bridge-notes/<bridge>.md` to tell a
// finding about this bridge from a finding inherited from another one.
//
// It carries the bridge id alone. A `version:` line and a `delivered:` date used to sit in the stamp; the date
// was the one field that changed on every run — each `update` produced a diff on every file of the tree
// consisting of one date, and nothing read it. What the short stamp buys is worth stating: a delivered file is
// byte-identical between runs for as long as the tree and the bridge are unchanged, so an unexpected diff is
// a signal rather than noise to scroll past.

import { BRIDGE_STAMP_FIELD } from '../constants-bridges.js';

const HEADING_PATTERN = /^#{1,6}[ \t]/;
const FENCE_PATTERN = /^[ \t]*(```|~~~)/;
const STAMP_TABLE_HEADER = '| field | value |';
const STAMP_TABLE_RULE = '|---|---|';
const STAMP_COMMENT_LINES = [
  '<!-- Delivered by unikit-ai from the rules tree of an engine bridge selected for this project. -->',
  "<!-- Fix it at the source (the package's `engine-bridges/<engine>/rules/<bridge>/`), not here: -->",
  '<!-- every init / update rewrites this folder. -->',
];

function stampLines(fileId: string): string[] {
  return [STAMP_TABLE_HEADER, STAMP_TABLE_RULE, `| ${BRIDGE_STAMP_FIELD} | ${fileId} |`, '', ...STAMP_COMMENT_LINES];
}

/** The index of the first heading line outside a fenced block, or -1 when the text has none. */
function firstHeadingAt(lines: string[]): number {
  let fenced = false;
  for (let index = 0; index < lines.length; index++) {
    if (FENCE_PATTERN.test(lines[index])) {
      fenced = !fenced;
    } else if (!fenced && HEADING_PATTERN.test(lines[index])) {
      return index;
    }
  }
  return -1;
}

/**
 * `content` with the stamp of `fileId` put under its first heading (on top when there is none). The text is
 * trimmed first and ends in exactly one newline, like every delivered file.
 */
export function stampDeliveredMarkdown(fileId: string, content: string): string {
  const lines = content.trim().split('\n');
  const stamp = stampLines(fileId);
  const headingAt = firstHeadingAt(lines);
  if (headingAt < 0) return `${[...stamp, '', ...lines].join('\n')}\n`;

  // The blank lines that already follow the heading are replaced by the one that follows the stamp.
  const rest = lines.slice(headingAt + 1);
  while (rest.length > 0 && rest[0].trim() === '') rest.shift();
  const stamped = [...lines.slice(0, headingAt + 1), '', ...stamp, ...(rest.length > 0 ? ['', ...rest] : [])];
  return `${stamped.join('\n')}\n`;
}
