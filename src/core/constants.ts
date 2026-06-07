// Shared constants for the installer modules and the CLI command handlers.
//
// Single source of truth for runtime path segments, file names, rule
// categories, template markers, and the default engine id. Centralizing
// these here removes the duplicated string literals that were previously
// scattered across the installer modules and the CLI commands, and keeps the on-disk
// layout (.unikit/memory/{core,stack}, .unikit/system, RULES_INDEX.md)
// byte-for-byte identical — these constants only collapse TS-level duplicates.

import path from 'path';

// --- Default engine ---

export const DEFAULT_ENGINE_ID = 'unity';

// --- Rule categories ---

export const RULE_CATEGORIES = ['core', 'stack'] as const;

// --- Project-relative directory segments ---

export const UNIKIT_DIR = '.unikit';
export const MEMORY_DIR_NAME = 'memory';
export const SYSTEM_DIR_NAME = 'system';
export const REFERENCES_DIR_NAME = 'references';

// --- File names ---

export const SKILL_FILE = 'SKILL.md';
export const RULES_INDEX_FILE = 'RULES_INDEX.md';
export const RULES_INDEX_TEMPLATE_FILE = 'RULES_INDEX_TEMPLATE.md';
export const RULES_MANIFEST_FILE = 'rules-manifest.json';
export const CLI_CONTRACT_FILE = 'cli-contract.md';
export const DEV_PRINCIPLES_FILE = 'dev-principles.md';
export const ENGINE_RULES_FILE = 'ENGINE_RULES.md';

// --- RULES_INDEX template markers ---

export const CORE_TABLE_MARKER = '<!-- CORE_TABLE -->';
export const STACK_TABLE_MARKER = '<!-- STACK_TABLE -->';

// --- Path helpers ---

/** `<projectDir>/.unikit/memory` — root of installed core/stack rules. */
export function memoryDir(projectDir: string): string {
  return path.join(projectDir, UNIKIT_DIR, MEMORY_DIR_NAME);
}

/** `<projectDir>/.unikit/system` — root of cli-contract / dev-principles. */
export function systemDir(projectDir: string): string {
  return path.join(projectDir, UNIKIT_DIR, SYSTEM_DIR_NAME);
}
