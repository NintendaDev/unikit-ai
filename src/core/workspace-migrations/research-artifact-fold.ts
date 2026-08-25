// The fold half of the research merge: what becomes of `RESEARCH_BRIEF.md`.
//
// Split from `research-artifact.ts` on the boundary the step itself has: that
// module walks folders, normalizes headers and owns the verify-then-delete
// order; this one takes a brief apart and never touches the manifest's own
// bookkeeping. Keeping them in one file would put the module over the 500-line
// project ceiling (Part 7i) and would put two subjects under one header.
//
// REQ-7 is the rule the split of the brief follows: the light half becomes the
// `## Active Summary` section (the hashed object), the heavy half — signatures,
// patterns, file lists, DI bindings — becomes `CONTRACTS.md`, and the dependency
// graph joins the artifact that already carries one.

import path from 'path';
import { readTextFile, writeTextFile } from '../../utils/fs.js';
import {
  RESEARCH_ACTIVE_SUMMARY_END, RESEARCH_ACTIVE_SUMMARY_HEADING,
  RESEARCH_ACTIVE_SUMMARY_START, RESEARCH_CONTRACTS_FILE,
  RESEARCH_DEPENDENCY_GRAPH_FILE, RESEARCH_MIGRATED_SUMMARY_MARKER,
  LEGACY_RESEARCH_BRIEF_FILE,
} from '../constants.js';
import { scanLines, sectionBody } from './markdown.js';

/** Headings whose presence must not push `## Active Summary` below them. */
const NAVIGATION_HEADINGS = ['## Table of Contents', '## Artifact Index'];

/** Brief section → the field line its body is filed under in the Active Summary. */
const SUMMARY_FIELDS: readonly { section: string; field: string }[] = [
  { section: '## CONSTRAINTS', field: 'Constraints:' },
  { section: '## OUT OF SCOPE', field: 'Scope (out):' },
];

/** Brief section → its heading in `CONTRACTS.md` (REQ-7, the heavy half). */
const CONTRACT_SECTIONS: readonly { section: string; heading: string }[] = [
  { section: '## INTERFACES', heading: '## Interfaces' },
  { section: '## KEY PATTERNS', heading: '## Key Patterns' },
  { section: '## FILES', heading: '## Files' },
  { section: '## DI BINDINGS', heading: '## DI Bindings' },
];

/** The section a dependency graph is folded under when the artifact already exists. */
const DEPENDENCY_GRAPH_SOURCE_HEADING = `## From ${LEGACY_RESEARCH_BRIEF_FILE}`;

/** The body of a brief section, or `null` when absent, empty or exactly `N/A`. */
function usableSection(briefBody: string, heading: string): string | null {
  const body = sectionBody(briefBody, heading);
  if (body === null) return null;
  const trimmed = body.trim();
  return trimmed === '' || trimmed === 'N/A' ? null : body;
}

/**
 * Assemble the Active Summary body — the region the drift hash is taken over.
 *
 * `Topic:` is UNCONDITIONAL and it is the load-bearing line: the registry
 * generator reads a research's `Summary` from it, so a folder that reaches disk
 * without one becomes a nameless row in the `/unikit-plan` question. When the
 * brief has no usable `## CONTEXT` — and when there is no brief at all — the
 * line carries the manifest's own title, the one thing every folder has.
 *
 * Every other field is written only when the brief actually carried it: an
 * empty field in a machine input is indistinguishable from "we did not check",
 * which is the same rule that forbids `N/A` placeholders downstream.
 */
export function buildActiveSummary(briefBody: string | null, title: string): string {
  const context = briefBody === null ? null : usableSection(briefBody, '## CONTEXT');
  const parts: string[] = context === null ? [`Topic: ${title}`.trimEnd()] : [`Topic:\n${context}`];

  if (briefBody !== null) {
    for (const { section, field } of SUMMARY_FIELDS) {
      const body = usableSection(briefBody, section);
      if (body !== null) parts.push(`${field}\n${body}`);
    }
  }

  return parts.join('\n\n');
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

/**
 * Write the brief's heavy sections into `CONTRACTS.md`.
 *
 * Returns the number of sections written, or `0` when the brief carried none —
 * in which case NO file is created. An adaptive artifact exists because there
 * was something concrete to put in it; an empty template with `N/A` headings is
 * exactly the disease this refactor treats (D-2).
 */
export async function writeContracts(folder: string, briefBody: string): Promise<number> {
  const blocks: string[] = [];
  for (const { section, heading } of CONTRACT_SECTIONS) {
    const body = usableSection(briefBody, section);
    if (body !== null) blocks.push(`${heading}\n\n${body}`);
  }
  if (blocks.length === 0) return 0;

  await writeTextFile(path.join(folder, RESEARCH_CONTRACTS_FILE), `${blocks.join('\n\n')}\n`);
  return blocks.length;
}

/**
 * Fold the brief's dependency graph into `DEPENDENCY-GRAPH.md`.
 *
 * Appends under its own source heading when the artifact already exists — the
 * research may have written one of its own, and overwriting it would lose the
 * half that was reasoned about rather than lifted. Returns `false` when the
 * brief carried no graph.
 *
 * The append is GATED ON ITS OWN HEADING, and that guard is the one thing here
 * that is not obvious. This function runs BEFORE the manifest write, and the
 * manifest write is the one that can throw: `apply` catches per folder and the
 * run completes, so the next `update` re-enters this branch with the artifact
 * already on disk. Ungated, the brief's graph would be filed a second time
 * under a second copy of the heading — an append is idempotent only against a
 * caller that runs once, and the whole chain is built on the opposite
 * assumption ("`apply` can be entered at `detect === false`, so re-check the
 * SHAPE of the state"). Returning `true` on the skip is deliberate: the caller
 * asks whether the graph IS folded, not whether this call did the folding.
 */
export async function foldDependencyGraph(folder: string, briefBody: string): Promise<boolean> {
  const body = usableSection(briefBody, '## DEPENDENCY GRAPH');
  if (body === null) return false;

  const target = path.join(folder, RESEARCH_DEPENDENCY_GRAPH_FILE);
  const existing = await readTextFile(target);
  if (existing !== null && existing.includes(DEPENDENCY_GRAPH_SOURCE_HEADING)) return true;

  const block = `${DEPENDENCY_GRAPH_SOURCE_HEADING}\n\n${body}\n`;
  await writeTextFile(target, existing === null ? block : `${existing.replace(/\s*$/, '')}\n\n${block}`);
  return true;
}
