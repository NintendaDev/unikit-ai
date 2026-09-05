// --- Shared writer helpers ---
//
// Lives beside `index.ts` rather than inside it, and the reason is mechanical:
// `index.ts` constructs one instance of every writer at module scope, so a
// writer importing a VALUE from it closes an ESM cycle and the class hits the
// temporal dead zone — `Cannot access 'TomlMcpWriter' before initialization`, at
// import time, on every command. Type-only imports from `index.ts` are fine
// (erased at compile time); runtime helpers belong here.

/**
 * Shared `findKey` body: every writer differs only in which container it looks
 * in, so the matching rule itself is defined once.
 *
 * The scan is deliberately BOUNDED. A key counts as a variant of ours only when
 * it matches `code` after `trim()` + lowercasing AND is absent from `reserved` —
 * the set of keys extensions registered. Extensions write into the same
 * container (`extension-ops.ts`), so an unbounded case-insensitive scan could
 * recognise one of theirs as a misspelling of ours and destroy it through the
 * `remove` + `upsert` normalisation. Anything failing either condition is left
 * alone no matter how similar it looks.
 *
 * @returns the key as it is spelled on disk, or `null` when the server is not
 *          registered under any variant.
 */
export function findKeyInContainer(
  settings: Record<string, unknown>,
  container: string,
  code: string,
  reserved: Set<string>,
): string | null {
  const servers = settings[container];
  if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
    return null;
  }

  const wanted = code.trim().toLowerCase();
  for (const key of Object.keys(servers as Record<string, unknown>)) {
    if (reserved.has(key)) continue;
    if (key.trim().toLowerCase() === wanted) return key;
  }

  return null;
}
