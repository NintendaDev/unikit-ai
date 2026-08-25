// Plan-artifact migration — the two-file plan folder becomes one manifest.
//
// Three things make this step unlike every workspace step written so far, and
// all three are the reason it lives in its own module:
//
//   1. It is the first migration that MERGES CONTENT rather than relocating a
//      path. Everything until now was `movePath` behind a `fileExists` guard.
//      Here a whole file body is demoted one heading level and appended under
//      `## Technical Context` of another file.
//   2. `apply` can be entered at `detect === false` (the runner ORs the version
//      half with `detect` — see `migrations/runner.ts`), so every branch below
//      re-checks the SHAPE of the folder itself and returns without writing
//      when there is nothing to do.
//   3. Deletion of the brief happens ONLY after the manifest write has been
//      read back and verified. Reverse those two and an interrupted process is
//      the one way to lose the brief's content for good.
//
// Selectivity: a plan folder with zero open tasks is COMPLETED and is never
// migrated — not on the first `update`, not on the hundredth. A project
// therefore lives permanently with a mixed `plans/` directory, which is a
// deliberate trade (the migration radius narrows from "the whole archive" to
// "plans still in flight"). The gate is expressed ONCE (`isCompletedPlan`) and
// called from both `detect` and `apply`: a gate that disagreed between the two
// would report pending work that `apply` refuses to do, and the project would
// answer exit 8 to `rules sync` forever.

import path from 'path';
import { fileExists, movePath, readTextFile, removeFile, writeTextFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';
import {
  LEGACY_PLAN_BRIEF_FILE, LEGACY_PLAN_TASKS_FILE,
  MIGRATION_SINCE_PLAN_MANIFEST, PLAN_CONTEXT_SEPARATOR,
  PLAN_LIFTED_HEADINGS, PLAN_MANIFEST_FILE, PLAN_TECHNICAL_CONTEXT_HEADING,
} from '../constants.js';
import type { Migration } from '../migrations/types.js';
import type { WorkspaceMigrationContext } from './context.js';
import { demoteHeadings, scanLines, topLevelHeadings } from './markdown.js';
import { detectableFolders, planFolders } from './workspace-folders.js';

const LOG_TAG = 'plan:migrate';

/** True when `heading` is one of the sections that must stay at `##` level. */
function isLiftedHeading(heading: string): boolean {
  return (PLAN_LIFTED_HEADINGS as readonly string[]).includes(heading);
}

/**
 * Number of OPEN checklist entries in a plan body — the selectivity signal.
 *
 * Anchored on a leading `- [ ]`, deliberately: a phase status line reads
 * `**Status:** [ ] Not started` and must NOT count, or every completed plan
 * would look like it still had work in it. The same line shape `mode-list.md`
 * counts when it reports plan progress.
 */
export function openTaskCount(body: string): number {
  let open = 0;
  for (const { text, fenced } of scanLines(body)) {
    if (fenced) continue;
    if (/^-\s\[\s\]\s/.test(text)) open += 1;
  }
  return open;
}

/** True when `manifest` already carries the Technical Context heading. */
function hasTechnicalContext(manifest: string): boolean {
  // Compared as a whole line, not with `includes`: the heading named in prose
  // ("folded under `## Technical Context`") is a mention, not a section.
  return manifest.split('\n')
    .some(line => line.replace(/\r$/, '').trimEnd() === PLAN_TECHNICAL_CONTEXT_HEADING);
}

/**
 * Turn a `PLAN-BRIEF.md` body into the body of `## Technical Context`.
 *
 * Drops the brief's leading H1 — the manifest supplies the document title — and
 * hands the rest to {@link demoteHeadings}, so a `##` section becomes `###` and
 * a `###` subsection becomes `####`, exactly the shape the merged template
 * declares. The H1 step is the only part specific to folding a titled document
 * into a section, which is why it is the only part that stayed here.
 *
 * Leading blank lines are consumed whether or not an H1 follows them, verbatim
 * as before the extraction: a blank line cannot open a fence, so re-scanning the
 * remainder yields the same fence states the whole-body scan did.
 *
 * Exported for the migration guards in `scripts/test-migrations.sh`.
 */
export function foldBrief(briefBody: string): string {
  const lines = briefBody.split('\n');
  const scanned = scanLines(briefBody);
  let start = 0;

  while (start < scanned.length && scanned[start].text.trim() === '') start += 1;
  if (start < scanned.length && !scanned[start].fenced && /^#\s/.test(scanned[start].text)) {
    start += 1;
    while (start < scanned.length && scanned[start].text.trim() === '') start += 1;
  }

  return demoteHeadings(lines.slice(start).join('\n'));
}

/**
 * Split the three cross-axis design sections off the brief body.
 *
 * `lifted` carries them VERBATIM — they are re-inserted above the separator
 * line, so they keep their `##` level and never travel through
 * {@link foldBrief}. `rest` is everything else, which does get demoted.
 *
 * Deduplication: a section whose heading the manifest already carries at `##`
 * level is dropped rather than lifted. The old `/unikit-plan` instruction was
 * self-contradictory about which of the two files the block belonged in, so a
 * borderline plan can carry it twice — and two `## Design` sections in one
 * manifest would leave `/unikit-verify` choosing which one is the snapshot.
 * The manifest's own copy wins; the caller logs what it dropped.
 *
 * Exported for the migration guards in `scripts/test-migrations.sh`.
 */
export function liftDesignSections(
  briefBody: string,
  manifestBody: string,
): { lifted: string; rest: string } {
  const scanned = scanLines(briefBody);
  const alreadyInManifest = new Set(topLevelHeadings(manifestBody));

  const lifted: string[] = [];
  const rest: string[] = [];
  let capturing: 'lift' | 'drop' | null = null;

  for (const { text, fenced } of scanned) {
    const heading = text.replace(/\r$/, '').trimEnd();
    if (!fenced && /^##\s/.test(heading)) {
      if (isLiftedHeading(heading)) {
        capturing = alreadyInManifest.has(heading) ? 'drop' : 'lift';
      } else {
        capturing = null;
      }
    }
    if (capturing === 'lift') lifted.push(text);
    else if (capturing === null) rest.push(text);
    // `capturing === 'drop'` — the duplicate section goes nowhere.
  }

  return { lifted: lifted.join('\n').replace(/\s*$/, ''), rest: rest.join('\n') };
}

/**
 * True when the folder's checklist has zero open tasks — a completed plan.
 *
 * The ONE expression of the selectivity gate. `detect` and `apply` both call
 * it; were they to disagree, a completed folder would be reported as pending
 * forever and `rules sync` would answer exit 8 with no way to clear it. The
 * checklist is read from `TASKS.md` while it exists and from `PLAN.md` once the
 * rename half has run, so a folder caught mid-migration is judged on the same
 * content either way.
 */
async function isCompletedPlan(folder: string): Promise<boolean> {
  const tasks = path.join(folder, LEGACY_PLAN_TASKS_FILE);
  const manifest = path.join(folder, PLAN_MANIFEST_FILE);

  const gateSrc = (await fileExists(tasks)) ? tasks
    : (await fileExists(manifest)) ? manifest : null;
  if (gateSrc === null) return false;

  const body = await readTextFile(gateSrc);
  if (body === null) return false;
  return openTaskCount(body) === 0;
}

/** Merge one plan folder: rename half, then fold half, then verify-then-delete. */
async function mergeOnePlan(folder: string): Promise<void> {
  const base = path.basename(folder);
  const manifest = path.join(folder, PLAN_MANIFEST_FILE);
  const tasks = path.join(folder, LEGACY_PLAN_TASKS_FILE);
  const brief = path.join(folder, LEGACY_PLAN_BRIEF_FILE);

  // (0) selectivity — a completed plan is left exactly as it is, forever.
  if (await isCompletedPlan(folder)) {
    logInfo(LOG_TAG, `${base}: skipped — no open tasks (completed plan left untouched)`);
    return;
  }

  // (1) rename half
  if (await fileExists(tasks)) {
    if (await fileExists(manifest)) {
      logWarn(LOG_TAG, `skip ${base}: both ${LEGACY_PLAN_TASKS_FILE} and ${PLAN_MANIFEST_FILE} exist`);
      return;
    }
    await movePath(tasks, manifest);
    logInfo(LOG_TAG, `${base}: ${LEGACY_PLAN_TASKS_FILE} -> ${PLAN_MANIFEST_FILE}`);
  }

  // (2) fold half
  if (!(await fileExists(brief))) return;
  const manifestBody = await readTextFile(manifest);
  if (manifestBody === null) {
    logWarn(LOG_TAG, `skip ${base}: ${LEGACY_PLAN_BRIEF_FILE} present but no manifest to fold it into`);
    return;
  }
  if (hasTechnicalContext(manifestBody)) {
    logWarn(LOG_TAG, `skip ${base}: manifest already carries ${PLAN_TECHNICAL_CONTEXT_HEADING} `
      + `— fold ${LEGACY_PLAN_BRIEF_FILE} by hand`);
    return;
  }
  const briefBody = await readTextFile(brief);
  if (briefBody === null) {
    logWarn(LOG_TAG, `skip ${base}: ${LEGACY_PLAN_BRIEF_FILE} could not be read — left in place`);
    return;
  }

  // The three cross-axis sections are re-inserted ABOVE the separator so they
  // keep their `##` level — see PLAN_LIFTED_HEADINGS for what depends on that.
  // (This is NOT a PL-4 requirement: that guard is a pair invariant over the
  // TEMPLATE — `## MCP Findings` immediately above `## Technical Context`, at
  // most one `## Open Questions` after it — and says nothing about migrated
  // project files.)
  const { lifted, rest } = liftDesignSections(briefBody, manifestBody);
  const liftedHeadings = new Set(topLevelHeadings(lifted));
  for (const heading of topLevelHeadings(briefBody)) {
    // Compared as headings, never as a substring of `lifted`: one lifted
    // section's BODY may quote another section's title, and a substring test
    // would then swallow the only notice that content was dropped.
    if (isLiftedHeading(heading) && !liftedHeadings.has(heading)) {
      logWarn(LOG_TAG, `${base}: dropped duplicate "${heading}" from ${LEGACY_PLAN_BRIEF_FILE} `
        + '— the manifest already carries it');
    }
  }

  const merged = `${manifestBody.replace(/\s*$/, '')}\n\n`
    + (lifted ? `${lifted}\n\n` : '')
    + `${PLAN_CONTEXT_SEPARATOR}\n\n${PLAN_TECHNICAL_CONTEXT_HEADING}\n\n${foldBrief(rest)}\n`;
  await writeTextFile(manifest, merged);

  // (3) verify-then-delete — never the other way round.
  const readback = await readTextFile(manifest);
  if (readback === null || !hasTechnicalContext(readback)) {
    logWarn(LOG_TAG, `skip ${base}: manifest write could not be verified `
      + `— ${LEGACY_PLAN_BRIEF_FILE} left in place`);
    return;
  }
  await removeFile(brief);
  logInfo(LOG_TAG, `${base}: ${LEGACY_PLAN_BRIEF_FILE} folded into ${PLAN_TECHNICAL_CONTEXT_HEADING}`);
}

/**
 * Fold `TASKS.md` + `PLAN-BRIEF.md` into a single `PLAN.md` manifest inside
 * every plan folder that still has open tasks.
 */
const planManifestMergeMigration: Migration<WorkspaceMigrationContext> = {
  id: 'plan-1-to-2-manifest-merge',
  since: MIGRATION_SINCE_PLAN_MANIFEST,

  // Mirrored branch-for-branch against `mergeOnePlan`: every folder shape that
  // `apply` walks past with a `logWarn` answers `false` here. A shape reported
  // as pending that `apply` then refuses to touch is the one way to leave a
  // project permanently pending, and `rules sync` refuses a pending project
  // with exit 8 that no `update` can clear.
  async detect({ projectDir }) {
    for (const folder of await detectableFolders(projectDir)) {
      const manifest = path.join(folder, PLAN_MANIFEST_FILE);
      const hasTasks = await fileExists(path.join(folder, LEGACY_PLAN_TASKS_FILE));
      const hasBrief = await fileExists(path.join(folder, LEGACY_PLAN_BRIEF_FILE));
      const hasManifest = await fileExists(manifest);

      // A completed plan is not work — `continue`, never `return`: the
      // remaining folders have not been looked at yet.
      if (await isCompletedPlan(folder)) continue;

      // Rename half: work exists only while the destination does not. Both
      // present is the `logWarn` skip, and it swallows the fold half with it —
      // `apply` returns from that branch without folding anything, so a brief
      // sitting next to the pair must NOT be reported as pending either.
      if (hasTasks) {
        if (!hasManifest) return true;
        continue;
      }
      // Fold half: somewhere to fold into, and not yet folded.
      if (hasBrief && hasManifest && !hasTechnicalContext(await readTextFile(manifest) ?? '')) {
        return true;
      }
    }
    return false;
  },

  async apply({ projectDir }) {
    for (const folder of await planFolders(projectDir)) {
      // One unwritable folder must not strand the rest — and must not abort the
      // whole chain. `readTextFile` answers null on failure, but `movePath`,
      // `writeTextFile` and `removeFile` throw, `runMigrationChain` does not
      // catch, and `update`/`init` await the chain directly: a single read-only
      // or editor-locked PLAN.md would otherwise end the run with a raw EPERM,
      // leave every later plan folder unmigrated and skip the version stamp.
      try {
        await mergeOnePlan(folder);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logWarn(LOG_TAG, `skip ${path.basename(folder)}: ${reason}`);
      }
    }
  },
};

export const PROJECT_PLAN_ARTIFACT_MIGRATIONS: readonly Migration<WorkspaceMigrationContext>[] = [
  planManifestMergeMigration,
];
