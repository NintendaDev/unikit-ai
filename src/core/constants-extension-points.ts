// Extension points: the anchor a base skill carries, the markers an extension block is wrapped in,
// the registry file that lists the points, and the texts of the reasons an injection is skipped.
//
// Split out of `constants.ts` for the same mechanical reason as `constants-artifacts.ts`: that file
// sits at the Part 7i ceiling (`SIZE_LIMIT=500` over `src/core/*.ts`). `constants.ts` re-exports this
// module, so call sites keep one import path.
//
// The golden-guard #1 Part C exclusion is by FILE NAME (`constants\.ts|modules\.ts`) and
// `constants-extension-points.ts` does not match it — no module id, tier path or modules registry
// file name may live here, for the reason `constants-artifacts.ts` spells out.

/** The anchor a base skill carries is `OPEN + <point name> + CLOSE`, alone on its line. */
export const EXTENSION_POINT_ANCHOR_OPEN = '<!-- unikit:extension-point:';
export const EXTENSION_POINT_ANCHOR_CLOSE = ' -->';

/** Prefix of the marker that wraps an extension block (the same value the legacy injections used). */
export const EXTENSION_BLOCK_MARKER_PREFIX = 'unikit-ext';

/** A point block key is `ext:target:point:id` (4 fields); a legacy (`position`) block key is `ext:target:position` (3). */
export const EXTENSION_POINT_KEY_SEGMENTS = 4;

/** File name of the point registry under `data/` — the one list of points that exist. */
export const EXTENSION_POINTS_FILE = 'extension-points.json';

/** Sub-directory of a target skill's `references/` that holds the reference files extensions deliver. */
export const EXTENSION_REFERENCES_SUBDIR = 'ext';

/** `{{ext_reference:<name>}}` — resolved to the path of a delivered reference file. */
export const EXTENSION_REFERENCE_PLACEHOLDER = 'ext_reference';

/** Point names: lower-case words joined by hyphens, never an alias-looking `-agent` ending. */
export const EXTENSION_POINT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
export const EXTENSION_POINT_NAME_MAX_LENGTH = 64;
/** A name ending so is caught by the delegation-alias check (Part 2a) in skill text. */
export const EXTENSION_POINT_FORBIDDEN_SUFFIX = '-agent';

/** Injection ids: unique inside one extension, part of the block marker. */
export const EXTENSION_INJECTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
export const EXTENSION_INJECTION_ID_MAX_LENGTH = 64;

/** A reference file name travels inside a placeholder: no spaces, no `}`. */
export const EXTENSION_REFERENCE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Replacements that make an extension name usable as one path segment. `@` and `/` are the two
 * characters of the name alphabet that are not safe there; `=` and `+` are outside that alphabet,
 * so the encoding is injective.
 */
export const EXTENSION_SLUG_AT = '=';
export const EXTENSION_SLUG_SLASH = '+';

/** Why an injection entry was not applied to one target of one agent. */
export type InjectionSkipReason =
  | 'unknown-point'
  | 'anchor-missing'
  | 'anchor-duplicated'
  | 'target-not-installed'
  | 'source-missing'
  | 'reference-unresolved'
  | 'render-failed'
  | 'target-not-found'
  | 'target-disabled'
  | 'path-outside-extension';

/** One short hint per skip reason; printed next to the reason in the injection report. */
export const EXTENSION_SKIP_HINTS: Readonly<Record<InjectionSkipReason, string>> = {
  'unknown-point': 'this UniKit version offers no such point on the target — upgrade unikit-ai',
  'anchor-missing': 'the installed skill has no such anchor — run "unikit-ai update" to refresh installed skills',
  'anchor-duplicated': 'the installed skill carries the anchor more than once — run "unikit-ai update --force"',
  'target-not-installed': 'the target is not installed for this agent',
  'source-missing': 'a file the entry names is missing in the extension directory',
  'reference-unresolved': 'the text uses {{ext_reference:<name>}} for a name that is not in references[]',
  'render-failed': 'the text could not be rendered for this agent',
  'target-not-found': 'the target file is not installed for this agent',
  'target-disabled': 'the target is a skill or subagent of this extension that was left out of its selection',
  'path-outside-extension': 'the path leaves the extension directory',
};
