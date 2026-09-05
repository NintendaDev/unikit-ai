// The `## Active Summary` half of the research merge.
//
// Split from `research-artifact.ts` on the boundary the step itself has: that
// module walks folders, normalizes headers and renames files; this one assembles
// one section and never touches the manifest's own bookkeeping.
//
// THE MIGRATION DOES NOT READ, SPLIT OR DELETE `RESEARCH_BRIEF.md`. An earlier
// revision took the brief apart into this section plus `CONTRACTS.md` and a
// dependency graph, and then removed it. That mapping matched section headings
// by exact string, while the skill that WROTE those briefs required their
// headings to be translated whenever `language.artifacts` was not English — so
// in a non-English project not one section matched, nothing was carried across,
// and the brief was deleted anyway. The brief is now left exactly where it is:
// the migration renames the two files it can rename without interpreting them,
// and a document nobody can safely parse is not a document to delete.
//
// What every folder still owes is the section itself. It is the hashed object
// and the registry generator's input, so a folder that reaches disk without one
// fails Integrity check 7 on the first `/unikit-explore` save, reports
// `drift unknown` forever, and appears as a nameless row in the `/unikit-plan`
// question — three failures far away from this one cause. It is therefore
// seeded from the manifest's own title, the one thing every folder has.

import {
  RESEARCH_ACTIVE_SUMMARY_END, RESEARCH_ACTIVE_SUMMARY_HEADING,
  RESEARCH_ACTIVE_SUMMARY_START, RESEARCH_MIGRATED_SUMMARY_MARKER,
} from '../constants.js';
import { scanLines } from './markdown.js';

/** Headings whose presence must not push `## Active Summary` below them. */
const NAVIGATION_HEADINGS = ['## Table of Contents', '## Artifact Index'];

/**
 * The Active Summary body: `Topic:` carrying the manifest's title, and nothing
 * else.
 *
 * `Topic:` is the load-bearing line — the registry generator reads a research's
 * `Summary` from it, so a folder that reaches disk without one becomes a
 * nameless row in the `/unikit-plan` question. Every other field is left for a
 * human to write: an invented field in a machine input is indistinguishable
 * from a checked one, which is the same rule that forbids `N/A` placeholders
 * downstream.
 */
export function buildActiveSummary(title: string): string {
  return `Topic: ${title}`.trimEnd();
}

/**
 * Wrap an assembled Active Summary body in its heading, markers and banner.
 *
 * The banner sits ABOVE the heading and therefore OUTSIDE the hashed region:
 * removing it later must never read as drift.
 */
export function summaryBlock(inner: string, banner: string): string {
  return `${RESEARCH_MIGRATED_SUMMARY_MARKER}\n${banner}\n\n`
    + `${RESEARCH_ACTIVE_SUMMARY_HEADING}\n${RESEARCH_ACTIVE_SUMMARY_START}\n`
    + `${inner}\n${RESEARCH_ACTIVE_SUMMARY_END}\n`;
}

/** Insert `block` before the first non-navigation `##` heading, else append it. */
export function insertSummary(body: string, block: string): string {
  const lines = body.split('\n');
  const scanned = scanLines(body);

  for (let i = 0; i < scanned.length; i += 1) {
    const text = scanned[i].text.replace(/\r$/, '').trimEnd();
    if (scanned[i].fenced || !/^##\s/.test(text)) continue;
    if (NAVIGATION_HEADINGS.includes(text)) continue;
    const before = lines.slice(0, i).join('\n').replace(/\s*$/, '');
    return `${before}\n\n${block}\n${lines.slice(i).join('\n')}`;
  }

  return `${body.replace(/\s*$/, '')}\n\n${block}`;
}
