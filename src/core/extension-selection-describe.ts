// What the selection menu and the summaries show about an item, and the one check that reads
// extension files for the selection: a selected subagent that preloads a skill the extension
// left out.
//
// Reads the disk, writes nothing. Text from foreign files is cleaned of control characters and
// cut before it reaches a terminal; MCP entries show `command` + `args` or `url` and never `env`
// or `headers`.

import path from 'path';
import { readTextFile, readJsonFile } from '../utils/fs.js';
import { logInfo } from '../utils/log.js';
import {
  SKILL_FILE, SUBAGENT_SKILLS_FIELD, EXTENSION_MENU_TEXT_MAX_LENGTH, EXTENSION_MENU_ELLIPSIS,
  EXTENSION_SELECTION_LOG_COMPONENT,
} from './constants.js';
import { isInsideDirectory } from './extension-injections-schema.js';
import { validateMcpTemplate } from './mcp.js';
import {
  itemId, itemLabel, isEnabled, listExtensionItems, disabledOwnTargets,
  type ExtensionItem, type ExtensionItemKind, type ExtensionSelection,
} from './extension-selection.js';
import type { ExtensionManifest } from './extensions.js';

export interface ExtensionItemView {
  id: string;
  kind: ExtensionItemKind;
  key: string;
  /** `sanitizeDisplayText(itemLabel(item))`. */
  label: string;
  description?: string;
  /** Why the item cannot be installed (MCP templates only). */
  unusable?: string;
}

export interface DanglingPreload {
  subagent: string;
  skills: string[];
}

const FRONTMATTER_FENCE = '---';
const DESCRIPTION_FIELD = 'description:';
const SKILLS_FIELD_PREFIX = `${SUBAGENT_SKILLS_FIELD}:`;
const BLOCK_SCALAR_INDICATOR = /^[>|](?:[+-]?\d?|\d[+-]?)$/;
const BLOCK_LIST_ITEM = /^\s*-\s*(.+?)\s*$/;
// Built from a string: a control-character class written as a literal trips `no-control-regex`.
const CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');
const WHITESPACE_RUN = /\s+/g;
const BOM = '﻿';

// --- Text ---

/**
 * Makes text from a foreign file safe to print: control characters (ESC included) become
 * spaces, whitespace runs collapse, the ends are trimmed. With `maxLength` a longer text is cut
 * to `maxLength - 1` characters plus an ellipsis; without it the text is never cut.
 */
export function sanitizeDisplayText(raw: string, maxLength?: number): string {
  const clean = raw.replace(CONTROL_CHARACTERS, ' ').replace(WHITESPACE_RUN, ' ').trim();
  if (maxLength === undefined || clean.length <= maxLength) return clean;

  return clean.slice(0, maxLength - 1) + EXTENSION_MENU_ELLIPSIS;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  if (trimmed.length >= 2 && (first === '"' || first === "'") && trimmed.endsWith(first)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

/** Lines between the first `---` and the next one; `null` without a frontmatter block. */
function frontmatterLines(content: string): string[] | null {
  const lines = content.replace(/\r\n/g, '\n').replace(BOM, '').split('\n');
  if (lines[0]?.trim() !== FRONTMATTER_FENCE) return null;

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === FRONTMATTER_FENCE);

  return end === -1 ? null : lines.slice(1, end);
}

/** Lines after `start` that are indented or empty — the body of a block scalar or list. */
function indentedBlock(lines: readonly string[], start: number): string[] {
  const block: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() !== '' && !/^\s/.test(line)) break;
    block.push(line);
  }

  return block;
}

/** The `description:` of a frontmatter block: plain, quoted, or a folded/literal block scalar. */
export function readFrontmatterDescription(content: string): string | null {
  const lines = frontmatterLines(content);
  if (lines === null) return null;

  const index = lines.findIndex(line => line.startsWith(DESCRIPTION_FIELD));
  if (index === -1) return null;

  const value = lines[index]!.slice(DESCRIPTION_FIELD.length).trim();
  const isBlock = value === '' || BLOCK_SCALAR_INDICATOR.test(value);
  const text = isBlock
    ? indentedBlock(lines, index + 1).map(line => line.trim()).filter(line => line !== '').join(' ')
    : stripQuotes(value);

  return text === '' ? null : text;
}

/**
 * The skills a subagent file preloads: `skills: [a, b]` or a `- a` list under `skills:`. Any
 * other form (a scalar) reads as none.
 *
 * Deliberately parallel to `extractSkillsField` in `transformers/kimi-agent-file.ts`; when the
 * format of the `skills:` field changes, change both.
 */
export function readPreloadedSkills(content: string): string[] {
  const lines = frontmatterLines(content);
  if (lines === null) return [];

  const index = lines.findIndex(line => line.startsWith(SKILLS_FIELD_PREFIX));
  if (index === -1) return [];

  const value = lines[index]!.slice(SKILLS_FIELD_PREFIX.length).trim();
  let names: string[];
  if (value.startsWith('[') && value.endsWith(']')) {
    names = value.slice(1, -1).split(',').map(stripQuotes);
  } else if (value === '') {
    names = indentedBlock(lines, index + 1)
      .map(line => BLOCK_LIST_ITEM.exec(line)?.[1])
      .filter((name): name is string => name !== undefined)
      .map(stripQuotes);
  } else {
    names = [];
  }

  return names.filter(name => name !== '');
}

// --- Item views ---

async function describeSkillOrSubagent(extensionDir: string, item: ExtensionItem): Promise<string | undefined> {
  const file = item.kind === 'skills'
    ? path.join(extensionDir, item.key, SKILL_FILE)
    : path.join(extensionDir, item.key);
  if (!isInsideDirectory(extensionDir, file)) return undefined;

  const content = await readTextFile(file);
  const description = content === null ? null : readFrontmatterDescription(content);

  return description === null ? undefined : sanitizeDisplayText(description, EXTENSION_MENU_TEXT_MAX_LENGTH);
}

async function describeMcpServer(
  extensionDir: string,
  item: ExtensionItem,
): Promise<Pick<ExtensionItemView, 'description' | 'unusable'>> {
  const template = item.template ?? '';
  const file = path.join(extensionDir, template);
  const missing = { unusable: sanitizeDisplayText(`template not found: ${template}`) };
  if (!isInsideDirectory(extensionDir, file)) return missing;

  const parsed = await readJsonFile<unknown>(file);
  if (parsed === null) return missing;

  const problem = validateMcpTemplate(parsed, item.key);
  if (problem !== null) return { unusable: sanitizeDisplayText(problem) };

  // `validateMcpTemplate` has established that `parsed` is an object with `command` or `url`.
  const record = parsed as Record<string, unknown>;
  const command = typeof record['command'] === 'string' ? record['command'] : '';
  const args = Array.isArray(record['args'])
    ? record['args'].filter((arg): arg is string => typeof arg === 'string')
    : [];
  const text = command !== ''
    ? [command, ...args].join(' ')
    : typeof record['url'] === 'string' ? record['url'] : '';

  return text === '' ? {} : { description: sanitizeDisplayText(text, EXTENSION_MENU_TEXT_MAX_LENGTH) };
}

/** One view per item with its label, a short description and, for MCP, why it cannot be used. */
export async function describeExtensionItems(
  extensionDir: string,
  items: readonly ExtensionItem[],
): Promise<ExtensionItemView[]> {
  logInfo(EXTENSION_SELECTION_LOG_COMPONENT, `describe: ${items.length} item(s) in ${extensionDir}`);

  const views: ExtensionItemView[] = [];
  for (const item of items) {
    const view: ExtensionItemView = {
      id: itemId(item),
      kind: item.kind,
      key: item.key,
      label: sanitizeDisplayText(itemLabel(item)),
    };

    if (item.kind === 'mcpServers') {
      Object.assign(view, await describeMcpServer(extensionDir, item));
    } else {
      const description = await describeSkillOrSubagent(extensionDir, item);
      if (description !== undefined) view.description = description;
    }
    views.push(view);
  }

  return views;
}

// --- Dangling preloads ---

/**
 * Enabled subagents of the extension that preload a skill the extension itself ships but the
 * selection leaves out. Sorted by subagent name; a warning, never a block (the caller prints it).
 */
export async function findDanglingPreloads(
  extensionDir: string,
  manifest: ExtensionManifest,
  selection: ExtensionSelection | undefined,
): Promise<DanglingPreload[]> {
  const disabled = disabledOwnTargets(manifest, selection).skills;
  if (disabled.size === 0) return [];

  const found: DanglingPreload[] = [];
  for (const item of listExtensionItems(manifest)) {
    if (item.kind !== 'subagents' || !isEnabled(selection, item)) continue;

    const file = path.join(extensionDir, item.key);
    if (!isInsideDirectory(extensionDir, file)) continue;

    const content = await readTextFile(file);
    if (content === null) continue;

    const skills = readPreloadedSkills(content).filter(name => disabled.has(name));
    if (skills.length > 0) found.push({ subagent: item.name, skills });
  }

  return found.sort((a, b) => a.subagent.localeCompare(b.subagent));
}

export function formatDanglingPreload(extensionName: string, entry: DanglingPreload): string {
  const skills = entry.skills.map(skill => `"${skill}"`).join(', ');

  return `${extensionName}: subagent "${entry.subagent}" preloads skill ${skills}, left out of the selection`;
}
