// The note for a `{{name}}` in the text of an extension that this build of unikit-ai does not
// substitute. The token stays in the installed text exactly as written and the install goes on — an
// extension written for a newer unikit-ai still installs on an older one. The note (file and names) is
// printed at INFO level, i.e. under `--verbose` only: the framework cannot tell such a name from a
// runtime slot of the extension's own templates, so a warning would be noise for every extension that
// ships templates.
//
// The scan reads the SOURCES of the extension's enabled items once per project pass (see
// `applyExtensionInjections`), not the three render pipelines once per agent: no repeats for eight
// agents, no dependence on an agent's transformer, and nothing of a replaced base skill is judged.
// Pure helpers plus file reads; it imports nothing from `cli/`.

import path from 'path';
import { listFilesRecursive, readTextFile } from '../utils/fs.js';
import {
  EXTENSION_UNKNOWN_VARS_MAX_FILES,
  EXTENSION_UNKNOWN_VARS_MORE,
  EXTENSION_UNKNOWN_VARS_REASON,
  TEMPLATE_VAR_NAMES,
  TEMPLATE_VAR_NAME_SHAPE,
} from './constants-template.js';
import { isInsideDirectory } from './extension-injections-schema.js';
import type { ExtensionManifest } from './extensions.js';
import { isMarkdownFile } from './installer/shared.js';

/** One file of an extension that writes names this build does not know. */
export interface UnknownVarFinding {
  /** Path from the extension directory, with `/`. */
  file: string;
  /** Sorted, once each, without the braces. */
  names: string[];
}

export interface UnknownVarScan {
  /** Source files read (those that exist). */
  scanned: number;
  findings: UnknownVarFinding[];
}

const KNOWN_NAMES: ReadonlySet<string> = new Set(TEMPLATE_VAR_NAMES);

// Only a lower-case name of words joined by underscores is a candidate. `{{ext_reference:…}}` and
// `{{agent_skill_call:…}}` carry a colon and `{{PROJECT_CONTEXT}}` is upper-case: all three have
// other owners and are not named here.
const CANDIDATE_TOKEN = new RegExp(`\\{\\{(${TEMPLATE_VAR_NAME_SHAPE})\\}\\}`, 'g');

const CRLF = /\r\n/g;

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

/** Names written as `{{name}}` in a text that `processTemplate` would not substitute; sorted, once each. */
export function unknownTemplateVarNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.replace(CRLF, '\n').matchAll(CANDIDATE_TOKEN)) {
    if (!KNOWN_NAMES.has(match[1])) names.add(match[1]);
  }
  return [...names].sort(compareCodeUnits);
}

/**
 * A manifest path that leaves the extension directory is neither read nor mentioned — the rule the
 * injection pass applies to every file it takes from an extension. `skills` and `subagents` are
 * checked by `validateManifest` for their type only, so the confinement has to be made here.
 */
function insideExtension(extensionDir: string, relative: string): boolean {
  return isInsideDirectory(extensionDir, path.join(extensionDir, relative));
}

/**
 * Every source file of the enabled items of one extension: all `.md` under each skill directory
 * (`SKILL.md` and `references/`, replacement skills included), each subagent file, the `file` of
 * every injection and the `references[]` of the point injections. Paths as written in the manifest;
 * those that leave the extension directory are left out.
 */
async function sourceFilesOf(extensionDir: string, manifest: ExtensionManifest): Promise<string[]> {
  const files = new Set<string>();
  const addFile = (relative: string): void => {
    if (insideExtension(extensionDir, relative)) files.add(toPosix(path.normalize(relative)));
  };
  const skillDirs = [...(manifest.skills ?? []), ...Object.keys(manifest.replaces ?? {})];
  for (const skillDir of skillDirs) {
    if (!insideExtension(extensionDir, skillDir)) continue;
    for (const file of await listFilesRecursive(path.join(extensionDir, skillDir))) {
      if (isMarkdownFile(file)) files.add(toPosix(path.relative(extensionDir, file)));
    }
  }
  for (const subagent of manifest.subagents ?? []) addFile(subagent);
  for (const injection of manifest.injections ?? []) {
    addFile(injection.file);
    for (const reference of injection.references ?? []) addFile(reference);
  }
  return [...files].sort(compareCodeUnits);
}

/**
 * Scan the enabled items of an extension (the manifest already narrowed by the user's selection)
 * for names this build does not know. A source file that is missing is skipped without a word —
 * other checks own that failure.
 */
export async function findUnknownVarsInExtension(extensionDir: string, manifest: ExtensionManifest): Promise<UnknownVarScan> {
  const findings: UnknownVarFinding[] = [];
  let scanned = 0;
  for (const file of await sourceFilesOf(extensionDir, manifest)) {
    const text = await readTextFile(path.join(extensionDir, file));
    if (text === null) continue;
    scanned++;
    const names = unknownTemplateVarNames(text);
    if (names.length > 0) findings.push({ file, names });
  }
  return { scanned, findings };
}

/**
 * The note lines for one extension: one per file, then one line for the files beyond
 * `EXTENSION_UNKNOWN_VARS_MAX_FILES`. Names and paths only — never the content of a file.
 */
export function formatUnknownVars(extension: string, findings: UnknownVarFinding[]): string[] {
  const lines = findings
    .slice(0, EXTENSION_UNKNOWN_VARS_MAX_FILES)
    .map(({ file, names }) => `extension "${extension}": ${file} uses ${names.map(name => `{{${name}}}`).join(', ')} — ${EXTENSION_UNKNOWN_VARS_REASON}`);
  const rest = findings.length - EXTENSION_UNKNOWN_VARS_MAX_FILES;
  if (rest > 0) lines.push(`extension "${extension}": ${EXTENSION_UNKNOWN_VARS_MORE.replace('%d', String(rest))}`);
  return lines;
}
