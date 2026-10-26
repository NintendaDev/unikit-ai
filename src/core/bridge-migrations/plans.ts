// Plan migration of 3.0.0 — the two structural lines of a plan manifest and the findings table.
//
// A plan lives in the user's repository, in git, and it carries 2.x forms in three places: the heading
// of the findings section (`## MCP Findings` → `## Engine Bridge Findings`), the value of the setting
// (`- Editor tasks: mcp` → `engine-bridge`), and the findings table itself, which gains a last column
// naming the bridge the misleading call went through. Every plan is rewritten — unfinished, finished and
// archived — and nothing else in it: not a task, not a byte of the prose. The step does not commit; the
// diff stays in the working tree and the release notes say so.
//
// The bridge of an old row is not known. An unfinished plan gets the project's one bridge when the
// selection holds exactly one (the config step runs earlier in this chain); a finished or archived
// plan, and a project with several bridges, gets `—` — a value the trap skill resolves by asking, never
// by guessing.
//
// The edit is made line by line, by APPENDING to the end of a table row: a cell of the `evidence`
// column may hold a `|` inside backticks, so no cell is ever parsed. Fenced code is never touched.

import path from 'path';
import { readJsonFile, readTextFile, writeTextFile } from '../../utils/fs.js';
import { logInfo, logWarn } from '../../utils/log.js';
import { CODE_MODULE_ID, CONFIG_FILE, workspaceDir } from '../constants.js';
import { WORKSPACE_ARTIFACT_FILES } from '../constants-artifacts.js';
import {
  BRIDGE_COLUMN_HEADER, BRIDGE_COLUMN_UNKNOWN, BRIDGE_MIGRATE_LOG_TAG, EDITOR_TASKS_BRIDGE_VALUE,
  FINDINGS_HEADING, LEGACY_EDITOR_TASKS_LINE, LEGACY_FINDINGS_HEADING, MIGRATION_SINCE_ENGINE_BRIDGES,
  SETTINGS_HEADING,
} from '../constants-bridges.js';
import type { Migration } from '../migrations/types.js';
import { scanLines } from '../workspace-migrations/markdown.js';
import { openTaskCount } from '../workspace-migrations/plan-artifact.js';
import { planFile } from '../workspace-migrations/plan-timestamps.js';
import { archivedPlanFolders, detectableFolders, planFolders } from '../workspace-migrations/workspace-folders.js';

export interface PlansMigrationContext {
  projectDir: string;
}

interface PlanRewrite {
  file: string;
  label: string;
  next: string;
  bridgeValue: string;
}

const SECTION_PREFIX = '## ';
const TABLE_ROW_PREFIX = '|';
const LEGACY_EDITOR_TASKS_ANYWHERE = new RegExp(LEGACY_EDITOR_TASKS_LINE.source, 'm');

/** The line without its trailing carriage return, and that carriage return (empty on an LF file). */
function splitEol(line: string): { body: string; eol: string } {
  return line.endsWith('\r') ? { body: line.slice(0, -1), eol: '\r' } : { body: line, eol: '' };
}

/** True when a header row already has a cell named `bridge` — compared as `trim().toLowerCase()`. */
function hasBridgeColumn(headerRow: string): boolean {
  return headerRow.split('|').some(cell => cell.trim().toLowerCase() === BRIDGE_COLUMN_HEADER);
}

/** The separator row with one more cell, in the style of its own: `|---|` gets `---|`, `| --- |` gets ` --- |`. */
function widenSeparator(separator: string): string {
  return separator.includes(' ') ? `${separator} --- |` : `${separator}---|`;
}

/**
 * The 3.0.0 form of one plan manifest, or `null` when it is already in that form.
 *
 * Pure. Fence-aware (`scanLines`): a heading, a setting or a table row inside a fenced block is an example
 * and is never rewritten. Only the first table of the findings section is widened, and only when it has no
 * `bridge` column yet — which is also what makes a second pass a no-op.
 */
export function rewritePlanText(text: string, bridgeValue: string): string | null {
  const scanned = scanLines(text);
  const lines = scanned.map(entry => entry.text);
  let changed = false;

  let section = '';
  let inFindings = false;
  let tableState: 'before' | 'in' | 'done' = 'before';
  let widenThisTable = false;
  let headerSeen = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (scanned[index].fenced) continue;
    const { body, eol } = splitEol(lines[index]);

    if (body.startsWith(SECTION_PREFIX)) {
      section = body.trimEnd();
      if (section === LEGACY_FINDINGS_HEADING) {
        lines[index] = `${FINDINGS_HEADING}${eol}`;
        changed = true;
        section = FINDINGS_HEADING;
      }
      inFindings = section === FINDINGS_HEADING;
      tableState = 'before';
      headerSeen = false;
      continue;
    }

    if (section === SETTINGS_HEADING && LEGACY_EDITOR_TASKS_LINE.test(body)) {
      lines[index] = `${EDITOR_TASKS_BRIDGE_VALUE}${eol}`;
      changed = true;
      continue;
    }

    if (!inFindings || tableState === 'done') continue;

    const isRow = body.startsWith(TABLE_ROW_PREFIX);
    if (!isRow) {
      if (tableState === 'in') tableState = 'done';
      continue;
    }
    if (tableState === 'before') {
      tableState = 'in';
      widenThisTable = !hasBridgeColumn(body);
    }
    if (!widenThisTable) continue;

    // A row that does not end in `|` is not a row this edit understands: left as it is.
    const trimmed = body.trimEnd();
    if (!trimmed.endsWith('|')) continue;
    if (!headerSeen) {
      lines[index] = `${trimmed} ${BRIDGE_COLUMN_HEADER} |${eol}`;
      headerSeen = true;
    } else if (/^\|[\s:|-]+$/.test(trimmed)) {
      lines[index] = `${widenSeparator(trimmed)}${eol}`;
    } else {
      lines[index] = `${trimmed} ${bridgeValue} |${eol}`;
    }
    changed = true;
  }

  return changed ? lines.join('\n') : null;
}

/** Whether a manifest is worth a full pass: it names an old form, or a findings section whose table may need a column. */
function mayNeedRewrite(text: string): boolean {
  return text.includes(LEGACY_FINDINGS_HEADING) || text.includes(FINDINGS_HEADING) || LEGACY_EDITOR_TASKS_ANYWHERE.test(text);
}

/** The id of the project's one engine bridge, or the unknown mark when there is none or there are several. */
async function onlyBridgeOf(projectDir: string): Promise<string> {
  const raw = await readJsonFile<Record<string, unknown>>(path.join(projectDir, CONFIG_FILE));
  const bridges = raw?.engineBridges as { selected?: Record<string, unknown> } | undefined;
  const ids = bridges?.selected && typeof bridges.selected === 'object' ? Object.keys(bridges.selected) : [];
  return ids.length === 1 ? ids[0] : BRIDGE_COLUMN_UNKNOWN;
}

/**
 * ONE list for `detect` and `apply`: a rewrite is planned only when the manifest actually changes, so `detect`
 * never reports work `apply` has nothing to do for (a step stuck at "pending" is an exit 8 on every `rules`
 * command, forever).
 */
async function plannedRewrites(projectDir: string): Promise<PlanRewrite[]> {
  const candidates: { file: string; label: string; archived: boolean }[] = [];
  const seen = new Set<string>();
  const add = (file: string | null, label: string, archived: boolean): void => {
    if (file === null || seen.has(file)) return;
    seen.add(file);
    candidates.push({ file, label, archived });
  };

  for (const folder of [...await planFolders(projectDir), ...await detectableFolders(projectDir)]) {
    add(await planFile(folder), path.basename(folder), false);
  }
  for (const folder of await archivedPlanFolders(projectDir)) {
    add(await planFile(folder), `archive/${path.basename(folder)}`, true);
  }
  for (const name of WORKSPACE_ARTIFACT_FILES) {
    add(path.join(workspaceDir(projectDir, CODE_MODULE_ID), name), name, false);
  }

  const current = await onlyBridgeOf(projectDir);
  const rewrites: PlanRewrite[] = [];
  for (const candidate of candidates) {
    const text = await readTextFile(candidate.file);
    if (text === null || !mayNeedRewrite(text)) continue;

    const bridgeValue = candidate.archived || openTaskCount(text) === 0 ? BRIDGE_COLUMN_UNKNOWN : current;
    const next = rewritePlanText(text, bridgeValue);
    if (next !== null) rewrites.push({ file: candidate.file, label: candidate.label, next, bridgeValue });
  }
  return rewrites;
}

const planBridgeRename: Migration<PlansMigrationContext> = {
  id: 'plan-bridge-rename',
  since: MIGRATION_SINCE_ENGINE_BRIDGES,

  async detect({ projectDir }) {
    return (await plannedRewrites(projectDir)).length > 0;
  },

  async apply({ projectDir }) {
    // Each file in its own try: one locked plan must not leave the project without its version stamp. A plan
    // that could not be written stays in the old form, `detect` finds it again, and `rules` says exit 8 until
    // `update` has been run once more.
    for (const rewrite of await plannedRewrites(projectDir)) {
      try {
        await writeTextFile(rewrite.file, rewrite.next);
        logInfo(BRIDGE_MIGRATE_LOG_TAG, `${rewrite.label}: ${FINDINGS_HEADING} (bridge ${rewrite.bridgeValue}), ${EDITOR_TASKS_BRIDGE_VALUE}`);
      } catch (error) {
        logWarn(BRIDGE_MIGRATE_LOG_TAG, `skip ${rewrite.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  },
};

export const PROJECT_PLANS_MIGRATIONS: readonly Migration<PlansMigrationContext>[] = [planBridgeRename];
