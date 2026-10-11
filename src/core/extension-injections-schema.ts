import path from 'path';
import { validateInjectionId, validatePointName } from './extension-points.js';
import { EXTENSION_REFERENCE_NAME_PATTERN } from './constants.js';

// The `injections[]` of an extension manifest: the two entry shapes, and the checks that reject
// everything the installer could not apply predictably. Synchronous and free of I/O — whether the
// named files exist is checked by `commitResolvedExtension`, not here. Split out of `extensions.ts`,
// which sits just under the Part 7i ceiling. Imports only the point-name checks and the constants,
// so `extensions.ts` can import it without a cycle.

interface InjectionBase {
  target: string;
  targetType: 'skill' | 'subagent';
  /** Path, relative to the extension directory, of the text to insert. */
  file: string;
}

/** The original form: the text goes to the start or the end of the target file. */
export interface PositionInjection extends InjectionBase {
  position: 'append' | 'prepend';
  point?: undefined;
  id?: undefined;
  references?: undefined;
}

/** The point form: the text goes under a named anchor of a base skill. */
export interface PointInjection extends InjectionBase {
  point: string;
  /** Unique inside the extension; part of the block marker. */
  id: string;
  /** Files delivered next to the target skill's own references, addressed by `{{ext_reference:<name>}}`. */
  references: string[];
  position?: undefined;
}

export type ExtensionInjection = PositionInjection | PointInjection;

export type ParsedInjections =
  | { ok: true; injections: ExtensionInjection[] }
  | { ok: false; error: string };

export function isPointInjection(injection: ExtensionInjection): injection is PointInjection {
  return typeof injection.point === 'string';
}

/** A path that stays inside the extension directory: relative, no `..` after normalisation. */
function relativePathError(value: unknown, label: string): string | null {
  const message = `${label} must be a relative path inside the extension directory`;
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) return message;
  if (path.isAbsolute(value) || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return message;

  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '.' || normalized.split('/').includes('..')) return message;
  return null;
}

function normalizeRelative(value: string): string {
  return path.posix.normalize(value.replaceAll('\\', '/'));
}

/** Per-manifest state of the point branch: ids and reference names seen so far. */
interface PointState {
  ids: Map<string, number>;
  referenceByName: Map<string, { normalized: string; index: number }>;
}

function parsePointEntry(
  entry: Record<string, unknown>,
  index: number,
  targetType: 'skill' | 'subagent',
  state: PointState,
): { ok: true; injection: PointInjection } | { ok: false; error: string } {
  const label = `injections[${index}]`;

  const pointError = validatePointName(entry.point);
  if (pointError) return { ok: false, error: `${label}.${pointError}` };

  if (entry.id === undefined) return { ok: false, error: `${label}.id is required with "point"` };
  const idError = validateInjectionId(entry.id);
  if (idError) return { ok: false, error: `${label}.${idError}` };
  const id = entry.id as string;

  const earlier = state.ids.get(id);
  if (earlier !== undefined) {
    return { ok: false, error: `${label}.id "${id}" duplicates injections[${earlier}].id` };
  }

  const fileError = relativePathError(entry.file, `${label}.file`);
  if (fileError) return { ok: false, error: fileError };

  const rawReferences = entry.references ?? [];
  if (!Array.isArray(rawReferences)) {
    return { ok: false, error: `${label}.references must be an array of strings` };
  }

  const ownNames = new Set<string>();
  const references: string[] = [];
  for (let k = 0; k < rawReferences.length; k++) {
    const ref: unknown = rawReferences[k];
    const refLabel = `${label}.references[${k}]`;
    if (typeof ref !== 'string') return { ok: false, error: `${refLabel} must be a string` };

    const refError = relativePathError(ref, refLabel);
    if (refError) return { ok: false, error: refError };

    const normalized = normalizeRelative(ref);
    const name = path.posix.basename(normalized);
    if (!EXTENSION_REFERENCE_NAME_PATTERN.test(name)) {
      return { ok: false, error: `${refLabel} "${name}" is not a valid reference file name (${EXTENSION_REFERENCE_NAME_PATTERN})` };
    }
    if (ownNames.has(name)) {
      return { ok: false, error: `${label}.references lists "${name}" twice` };
    }
    ownNames.add(name);

    const other = state.referenceByName.get(name);
    if (other && other.normalized !== normalized) {
      return { ok: false, error: `${label}.references "${name}" conflicts with injections[${other.index}].references` };
    }
    references.push(ref);
  }

  // Commit state only after the whole entry passed.
  state.ids.set(id, index);
  for (const ref of references) {
    const normalized = normalizeRelative(ref);
    const name = path.posix.basename(normalized);
    if (!state.referenceByName.has(name)) state.referenceByName.set(name, { normalized, index });
  }

  return {
    ok: true,
    injection: {
      ...(entry as unknown as PointInjection),
      targetType,
      references,
    },
  };
}

/**
 * Validate and normalise `injections[]`. The first problem found is returned; the first four
 * messages are the ones the manifest validator has always printed. A `position` entry is kept as
 * written (plus the default `targetType`); a `point` entry always carries a `references` array.
 */
export function parseInjections(raw: unknown): ParsedInjections {
  if (!Array.isArray(raw)) return { ok: false, error: '"injections" must be an array' };

  const injections: ExtensionInjection[] = [];
  const state: PointState = { ids: new Map(), referenceByName: new Map() };

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i] as Record<string, unknown> | null;
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: `injections[${i}] must be an object` };
    }
    if (typeof entry.target !== 'string') {
      return { ok: false, error: `injections[${i}].target must be a string` };
    }
    if (typeof entry.file !== 'string') {
      return { ok: false, error: `injections[${i}].file must be a string` };
    }
    const targetType = entry.targetType ?? 'skill';
    if (targetType !== 'skill' && targetType !== 'subagent') {
      return { ok: false, error: `injections[${i}].targetType must be "skill" or "subagent"` };
    }

    const hasPosition = entry.position !== undefined;
    const hasPoint = entry.point !== undefined;
    if (hasPosition === hasPoint) {
      return { ok: false, error: `injections[${i}] must set exactly one of "position" and "point"` };
    }

    if (hasPosition) {
      if (entry.position !== 'append' && entry.position !== 'prepend') {
        return { ok: false, error: `injections[${i}].position must be "append" or "prepend"` };
      }
      if (entry.references !== undefined) {
        return { ok: false, error: `injections[${i}].references requires "point"` };
      }
      injections.push({ ...(entry as unknown as PositionInjection), targetType });
      continue;
    }

    const parsed = parsePointEntry(entry, i, targetType, state);
    if (!parsed.ok) return parsed;
    injections.push(parsed.injection);
  }

  return { ok: true, injections };
}

/** Every file a point entry names (`file` and `references[]`), once each, as written in the manifest. */
export function collectPointInjectionFiles(injections: ExtensionInjection[]): string[] {
  const seen = new Set<string>();
  for (const injection of injections) {
    if (!isPointInjection(injection)) continue;
    seen.add(injection.file);
    for (const ref of injection.references) seen.add(ref);
  }
  return [...seen];
}

/** True when `candidate` is strictly inside `rootDir` (not the directory itself). */
export function isInsideDirectory(rootDir: string, candidate: string): boolean {
  const rel = path.relative(path.resolve(rootDir), path.resolve(candidate));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
