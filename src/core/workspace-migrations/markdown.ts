// Markdown primitives shared by the content-merging migrations.
//
// This module exists so that ONE RULE — a line inside a fenced block is NEVER
// rewritten — lives in one place. Heading demotion, checkbox counting, section
// lifting and section extraction all read the same scan, so none of them can
// drift from the others. All three artifact steps read it: `plan-artifact.ts`
// (TASKS.md + PLAN-BRIEF.md -> PLAN.md), `research-artifact.ts` (RESULT +
// BRIEF + SOURCE -> RESEARCH.md) and `plan-timestamps.ts` (the header backfill).
//
// The header-block primitives (`headerEnd`, `findField`, `fieldValue`,
// `insertPoint`) live here for the same reason and were extracted for a
// measured one: the research merge and the timestamp backfill each carried a
// private copy, `headerEnd` and the insertion point byte-identical and
// `findField` differing only in which side of the call the colon sat on. Two
// steps that write into the same header must agree on where the header ENDS,
// and agreement between copies is a thing you notice only once it is gone.
//
// The boundary is a LAYER, not a size: nothing here touches the disk. Walking
// directories belongs to `workspace-folders.ts`, and putting it here would
// give this file two subjects instead of one.

/** One source line plus whether it sits inside a fenced code block. */
export interface ScannedLine {
  text: string;
  fenced: boolean;
}

/**
 * Split a markdown body into lines, marking the ones inside fenced blocks.
 *
 * The single place the rule "a line inside a fence is NEVER rewritten" is
 * written down — heading demotion, checkbox counting and section lifting all
 * read the same scan, so none of them can drift from the other two. A fence
 * opens on a run of three or more backticks or tildes (any indent) and closes
 * only on a marker of the SAME character that is no shorter, which is what
 * lets a fenced block contain a shorter run of backticks.
 */
export function scanLines(body: string): ScannedLine[] {
  const scanned: ScannedLine[] = [];
  let fence: { char: string; length: number } | null = null;

  for (const text of body.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(text);
    if (fence === null) {
      if (marker) {
        fence = { char: marker[1][0], length: marker[1].length };
        // The opening fence line itself is "inside" — it is not a heading and
        // must never be touched either.
        scanned.push({ text, fenced: true });
        continue;
      }
      scanned.push({ text, fenced: false });
      continue;
    }
    if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length) {
      fence = null;
    }
    scanned.push({ text, fenced: true });
  }

  return scanned;
}

/** A `Key: value` header line — the shape both manifest headers are built of. */
const HEADER_FIELD_LINE = /^[A-Za-z][^:]*:/;

/**
 * Index of the first line PAST the manifest's header block.
 *
 * The block ends at the first unfenced `##` heading, or at the first blank line
 * that FOLLOWS a header field, whichever comes first. The second half is the
 * load-bearing one and it is not decoration: a manifest with no `##` heading at
 * all — a fast plan is often exactly that — would otherwise make the whole
 * document its own header, and a new field would be inserted next to the last
 * colon-shaped line in the BODY. Worse, the read-back check that is supposed to
 * catch a misplaced write computes the boundary the same way, so it would
 * confirm the field as present and the write would succeed silently.
 *
 * A blank line before any field has been seen does NOT close the block: the
 * blank line conventionally separating an H1 from the fields under it is
 * punctuation, not a boundary.
 */
export function headerEnd(body: string): number {
  const scanned = scanLines(body);
  let sawField = false;

  for (let i = 0; i < scanned.length; i += 1) {
    const { text, fenced } = scanned[i];
    if (fenced) continue;
    const line = text.replace(/\r$/, '');
    if (/^##\s/.test(line)) return i;
    if (line.trim() === '') {
      if (sawField) return i;
      continue;
    }
    if (HEADER_FIELD_LINE.test(line)) sawField = true;
  }

  return scanned.length;
}

/**
 * Line index of the header line opening with `field`, or `-1`.
 *
 * `field` carries its own colon (`'Created:'`), which is what makes a constant
 * usable verbatim as both the probe and the text written back — the two used to
 * be spelled differently in the two steps, and a colon added on one side only
 * matches `CreatedX:` as readily as `Created:`.
 */
export function findField(lines: string[], end: number, field: string): number {
  for (let i = 0; i < end && i < lines.length; i += 1) {
    if (lines[i].replace(/\r$/, '').startsWith(field)) return i;
  }
  return -1;
}

/** The value carried by a `Key: value` line, given the key. */
export function fieldValue(line: string, field: string): string {
  return line.replace(/\r$/, '').slice(field.length).trim();
}

/**
 * Where a newly created header field goes: after the last existing one, else
 * after the H1, else at the very top.
 *
 * The fragile branch is the middle one — a manifest that is nothing but an H1
 * is the shape most likely to receive the insert in the wrong place, which is
 * why the golden-guard fixture (`# fast plan`) exercises exactly it through a
 * real `update`.
 */
export function insertPoint(lines: string[], end: number): number {
  for (let i = Math.min(end, lines.length) - 1; i >= 0; i -= 1) {
    if (HEADER_FIELD_LINE.test(lines[i].replace(/\r$/, ''))) return i + 1;
  }
  for (let i = 0; i < end && i < lines.length; i += 1) {
    if (/^#\s/.test(lines[i])) return i + 1;
  }
  return 0;
}

/** Titles of the `##`-level headings a body carries, outside fenced blocks. */
export function topLevelHeadings(body: string): string[] {
  return scanLines(body)
    .filter(({ fenced }) => !fenced)
    .map(({ text }) => text.replace(/\r$/, '').trimEnd())
    .filter(text => /^##\s/.test(text));
}

/**
 * Demote every unfenced heading in `body` by one level.
 *
 * A `##` section becomes `###` and a `###` subsection becomes `####`. Six
 * hashes are the markdown ceiling and stay put; fenced content is never
 * touched, so a comment starting with a hash in a bash or yaml sample keeps it.
 * Trailing blank lines are collapsed.
 *
 * This is the body of {@link plan-artifact.foldBrief} WITHOUT its leading-H1
 * step — that step is specific to folding a titled document into a section, and
 * the research merge demotes bodies that carry no title of their own.
 */
export function demoteHeadings(body: string): string {
  const demoted: string[] = [];
  for (const { text, fenced } of scanLines(body)) {
    demoted.push(fenced ? text : text.replace(/^(#{1,5})(\s)/, '#$1$2'));
  }
  while (demoted.length > 0 && demoted[demoted.length - 1].trim() === '') demoted.pop();

  return demoted.join('\n');
}

/**
 * The body of the section opened by the exact line `heading`, or `null`.
 *
 * The section runs to the next UNFENCED heading of the same or a higher level,
 * so `sectionBody(body, '## CONSTRAINTS')` keeps its `###` subsections and stops
 * at the next `##`. A heading-shaped line inside a fence closes nothing.
 *
 * `heading` is compared as a WHOLE LINE, never as a substring: one section's
 * body may quote another section's title, and a substring test would then eat
 * the boundary (the same argument as `plan-artifact.ts` makes when it compares
 * lifted headings rather than searching for them).
 *
 * Blank lines are trimmed off both ends of the result — the blank line that
 * conventionally follows a heading is punctuation, not content. Indentation
 * inside a line and the order of the lines are preserved exactly.
 */
export function sectionBody(body: string, heading: string): string | null {
  const wanted = heading.replace(/\r$/, '').trimEnd();
  const level = /^(#{1,6})\s/.exec(wanted)?.[1].length ?? 0;
  if (level === 0) return null;

  const scanned = scanLines(body);
  let start = -1;

  for (let i = 0; i < scanned.length; i += 1) {
    const { text, fenced } = scanned[i];
    if (fenced) continue;
    if (text.replace(/\r$/, '').trimEnd() === wanted) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;

  const collected: string[] = [];
  for (let i = start; i < scanned.length; i += 1) {
    const { text, fenced } = scanned[i];
    if (!fenced) {
      const opened = /^(#{1,6})\s/.exec(text.replace(/\r$/, '').trimEnd());
      if (opened && opened[1].length <= level) break;
    }
    collected.push(text);
  }

  while (collected.length > 0 && collected[0].trim() === '') collected.shift();
  while (collected.length > 0 && collected[collected.length - 1].trim() === '') collected.pop();

  return collected.join('\n');
}
