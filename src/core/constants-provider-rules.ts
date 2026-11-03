import path from 'path';
import { CODE_MODULE_ID, moduleTierDir } from './constants.js';

export const PROVIDER_RULE_LOG = 'provider-rules';
export const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const PROVIDER_RULE_TIER = 'stack';
export const PROVIDER_RULE_EXTENSION = '.md';
export const PROVIDER_CANDIDATE_SEPARATOR = '\u0000';
export const PROVIDER_REFERENCE_PATTERN = /^[^/\\]+\.md$/;

export function providerRulePath(projectDir: string, id: string): string {
  return path.join(moduleTierDir(projectDir, CODE_MODULE_ID, PROVIDER_RULE_TIER), `${id}${PROVIDER_RULE_EXTENSION}`);
}
