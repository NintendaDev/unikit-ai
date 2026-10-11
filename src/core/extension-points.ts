import path from 'path';
import { getDataDir, readJsonFile } from '../utils/fs.js';
import { logInfo, logWarn } from '../utils/log.js';
import {
  EXTENSION_INJECTION_ID_MAX_LENGTH,
  EXTENSION_INJECTION_ID_PATTERN,
  EXTENSION_POINT_FORBIDDEN_SUFFIX,
  EXTENSION_POINT_NAME_MAX_LENGTH,
  EXTENSION_POINT_NAME_PATTERN,
  EXTENSION_POINTS_FILE,
  EXTENSION_SLUG_AT,
  EXTENSION_SLUG_SLASH,
} from './constants.js';

// The registry of extension points: which anchors the installed base skills carry, and the checks
// every name that travels through a manifest goes through. A leaf of the import graph on purpose —
// `extensions.ts` imports it, so it must not import `agents.ts` or `installer/*`.

const LOG_COMPONENT = 'extension-points';

export interface ExtensionPointRegistry {
  skills: Record<string, string[]>;
  subagents: Record<string, string[]>;
}

/** What `loadExtensionPointRegistry` returns when the file is missing or unusable. */
function emptyRegistry(): ExtensionPointRegistry {
  return { skills: {}, subagents: {} };
}

/** Keep the targets whose value is an array of valid point names; warn about the rest. */
function readSection(section: unknown, sectionName: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (typeof section !== 'object' || section === null || Array.isArray(section)) return result;

  for (const [target, value] of Object.entries(section as Record<string, unknown>)) {
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
      logWarn(LOG_COMPONENT, `registry entry "${sectionName}.${target}" is not an array of point names — skipped`);
      continue;
    }
    const points: string[] = [];
    for (const name of value as string[]) {
      const problem = validatePointName(name);
      if (problem) {
        logWarn(LOG_COMPONENT, `registry entry "${sectionName}.${target}": ${problem} — skipped`);
        continue;
      }
      points.push(name);
    }
    result[target] = points;
  }
  return result;
}

/**
 * Read `data/extension-points.json`. Never throws: a missing or broken file is an empty registry
 * plus one warning, which later surfaces as the `unknown-point` skip of every `point` entry.
 * Not cached — the pass calls it once.
 */
export async function loadExtensionPointRegistry(): Promise<ExtensionPointRegistry> {
  const raw = await readJsonFile<unknown>(path.join(getDataDir(), EXTENSION_POINTS_FILE));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    logWarn(LOG_COMPONENT, `registry data/${EXTENSION_POINTS_FILE} is missing or invalid — no extension points are available`);
    return emptyRegistry();
  }

  const record = raw as Record<string, unknown>;
  const registry: ExtensionPointRegistry = {
    skills: readSection(record.skills, 'skills'),
    subagents: readSection(record.subagents, 'subagents'),
  };

  const targets = Object.keys(registry.skills).length;
  const points = Object.values(registry.skills).reduce((sum, list) => sum + list.length, 0);
  logInfo(LOG_COMPONENT, `registry loaded: ${targets} skill target(s), ${points} point(s)`);
  return registry;
}

/** The points a target offers; `[]` for an unknown target. */
export function registeredPoints(
  registry: ExtensionPointRegistry,
  targetType: 'skill' | 'subagent',
  target: string,
): string[] {
  const section = targetType === 'skill' ? registry.skills : registry.subagents;
  return Object.hasOwn(section, target) ? section[target] : [];
}

/** `null` when `name` is a valid point name, otherwise the problem (always starts with "point"). */
export function validatePointName(name: unknown): string | null {
  if (typeof name !== 'string' || name.length === 0) return 'point must be a non-empty string';
  if (name.length > EXTENSION_POINT_NAME_MAX_LENGTH) {
    return `point "${name}" is longer than ${EXTENSION_POINT_NAME_MAX_LENGTH} characters`;
  }
  if (!EXTENSION_POINT_NAME_PATTERN.test(name)) {
    return `point "${name}" must be lower-case words joined by hyphens (${EXTENSION_POINT_NAME_PATTERN})`;
  }
  if (name.endsWith(EXTENSION_POINT_FORBIDDEN_SUFFIX)) {
    return `point "${name}" must not end with "${EXTENSION_POINT_FORBIDDEN_SUFFIX}"`;
  }
  return null;
}

/** `null` when `id` is a valid injection id, otherwise the problem (always starts with "id"). */
export function validateInjectionId(id: unknown): string | null {
  if (typeof id !== 'string' || id.length === 0) return 'id must be a non-empty string';
  if (id.length > EXTENSION_INJECTION_ID_MAX_LENGTH) {
    return `id "${id}" is longer than ${EXTENSION_INJECTION_ID_MAX_LENGTH} characters`;
  }
  if (!EXTENSION_INJECTION_ID_PATTERN.test(id)) {
    return `id "${id}" must be lower-case letters, digits and hyphens (${EXTENSION_INJECTION_ID_PATTERN})`;
  }
  return null;
}

/**
 * An extension name as one path segment: `@` and `/` are replaced by characters the name alphabet
 * does not contain, so two different names never share a slug. `@scope/pkg` → `=scope+pkg`.
 */
export function extensionSlug(extensionName: string): string {
  return extensionName.replaceAll('@', EXTENSION_SLUG_AT).replaceAll('/', EXTENSION_SLUG_SLASH);
}
