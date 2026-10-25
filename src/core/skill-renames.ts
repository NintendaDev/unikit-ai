// --- Skills renamed by a release ---
//
// A rename is a third case next to "a skill the package no longer ships" (removed) and "a skill the
// package newly ships" (offered, installed only on request): the new name REPLACES the old one for
// every agent that had the old one, with no question, and appears for no agent that did not. Without
// the table a project loses both skills of a rename in CI (the old directory is removed as
// package-removed, the new name is `new-skill-not-installed` without `--install-new`).
//
// A leaf on purpose: pure data and three helpers, importing only the logger. Everything that has to
// follow a rename — the installer, the `init` wizard, the groups, the extension manifests — reads
// THIS table, so the next rename is one more row (plus the lists a skill name lives in: groups, the
// extension-point registry, the help map).

import { logWarn } from '../utils/log.js';

/**
 * Old name → new name. A project that has the old skill gets the new one in its place on the next
 * `update`, without `--install-new`; a project that never had it gets nothing.
 */
export const SKILL_RENAMES: Readonly<Record<string, string>> = {
  'unikit-mcp-trap': 'unikit-bridge-trap',
  'unikit-mcp-audit': 'unikit-bridge-audit',
};

export function renamedTo(name: string): string | undefined {
  return SKILL_RENAMES[name];
}

/** Maps old names to new ones, keeps the order, drops duplicates. */
export function renameSkillNames(names: string[]): string[] {
  return [...new Set(names.map(name => renamedTo(name) ?? name))];
}

/** A record keyed by skill name, with the keys renamed (a later key does not overwrite an earlier one). */
export function renameRecordKeys<V>(record: Record<string, V>): Record<string, V> {
  const renamed: Record<string, V> = {};
  for (const [key, value] of Object.entries(record)) {
    const next = renamedTo(key) ?? key;
    if (!Object.hasOwn(renamed, next)) renamed[next] = value;
  }
  return renamed;
}

/** `label` + old name pairs already announced in this process: a manifest is read many times per run. */
const announced = new Set<string>();

/**
 * The base-skill names an extension manifest mentions — the values of `replaces` and the `target` of
 * the injections aimed at a skill — read as their new names. The manifest on disk is not rewritten:
 * the translation happens at every read, and one warning per name tells the author to update it.
 */
export function renameManifestSkillNames<T extends {
  replaces?: Record<string, string>;
  injections?: { target: string; targetType?: string }[];
}>(manifest: T, label: string): T {
  const translate = (name: string): string => {
    const next = renamedTo(name);
    if (next === undefined) return name;
    const key = `${label}\u0000${name}`;
    if (!announced.has(key)) {
      announced.add(key);
      logWarn('extensions', `extension "${label}" names the renamed skill "${name}": read as "${next}"; update its manifest`);
    }
    return next;
  };

  const replaces = manifest.replaces
    ? Object.fromEntries(Object.entries(manifest.replaces).map(([skillPath, baseName]) => [skillPath, translate(baseName)]))
    : undefined;
  const injections = manifest.injections
    ? manifest.injections.map(injection => (injection.targetType === 'skill' ? { ...injection, target: translate(injection.target) } : injection))
    : undefined;

  return {
    ...manifest,
    ...(replaces ? { replaces } : {}),
    ...(injections ? { injections } : {}),
  };
}
