// Workspace- and plan-artifact names — the inventory of what a project working
// directory is made of.
//
// Split out of `constants.ts` for one mechanical reason: that file is the
// declared single point of the no-hardcode rule and it had reached the Part 7i
// ceiling (`scripts/test-skills.sh`, `SIZE_LIMIT=500` over `src/core/*.ts`).
// Moving the whole artifact inventory here keeps BOTH halves readable, and
// `constants.ts` re-exports it so no call site anywhere changes its import path.
//
// TRAP, and the reason it is written down: this file is NOT covered by the
// golden-guard #1 Part C exclusion. Part C excludes by FILE NAME with
// `grep -vE 'constants\.ts|modules\.ts'`, and `constants-artifacts.ts` does not
// match that regex — `-artifacts` sits between `constants` and `.ts`. Three
// literals are therefore FORBIDDEN here: the module id `code`, the file name
// `modules.yml`, and the path segment `memory/code`. Use `CODE_MODULE_ID`,
// `MODULES_YML_FILE` and `memoryDir()` instead — or add this file's name to the
// exclusion together with the reason. The first constant carrying the bare
// module id dropped in here would turn Part C red with a message that names
// none of this.
//
// (Written with backticks and no straight quotes on purpose: Part C's first
// check greps for the QUOTED file name and — unlike its second and third — does
// not drop comment lines, so spelling it out would trip the very guard this
// paragraph is warning about.)

import path from 'path';

// --- Workspace artifacts (module-scoped project working files) ---
//
// Single source of truth for the flat→module relocation: pre-modular projects
// keep these directly under `.unikit/`; the workspace migration moves each one
// under `.unikit/<code-module>/`. The same inventory backs (a) the migration
// (`workspace-migrations`), (b) the skill-layer path references that now carry
// the `code/` segment, and (c) the golden-guard #3 regex that forbids the bare
// form from reappearing in tracked content.

/**
 * Plans directory inside a module workspace. Declared here rather than in the
 * plan-artifact block below because {@link WORKSPACE_ARTIFACT_DIRS} consumes it
 * at module-evaluation time — a `const` referenced before its own declaration
 * is a temporal-dead-zone error, not a hoisted read.
 */
export const PLANS_DIR_NAME = 'plans';

/**
 * Researches directory inside a module workspace. Declared here, next to
 * {@link PLANS_DIR_NAME} and NOT in the research-artifact block below, for
 * exactly the reason spelled out above it: {@link WORKSPACE_ARTIFACT_DIRS} and
 * {@link WORKSPACE_ARTIFACT_RENAMES} consume it at module-evaluation time, and a
 * `const` referenced before its own declaration is a temporal-dead-zone error,
 * not a hoisted read. Moving it "where it belongs" turns every command into a
 * `ReferenceError` thrown on import.
 */
export const RESEARCHES_DIR_NAME = 'researches';

/**
 * Generated registry of researches, inside the researches directory.
 *
 * Hoisted out of the research-artifact block below for the SAME reason as
 * {@link RESEARCHES_DIR_NAME}, and it is worth saying so twice: it is the second
 * half of the {@link WORKSPACE_ARTIFACT_RENAMES} destination, so it too is read
 * at module-evaluation time. Declared in the block where it belongs by subject,
 * it would throw a `ReferenceError` on import of this module — the failure looks
 * like a broken package, not like a misplaced line.
 */
export const RESEARCHES_INDEX_FILE = 'INDEX.md';

/** Directory artifacts that relocate 1:1 (same basename under the module dir). */
export const WORKSPACE_ARTIFACT_DIRS = [PLANS_DIR_NAME, 'patches', RESEARCHES_DIR_NAME] as const;

/** File artifacts that relocate 1:1 (same basename under the module dir). */
export const WORKSPACE_ARTIFACT_FILES = ['PLAN.md', 'FIX_PLAN.md'] as const;

/**
 * Artifacts that relocate AND change name. The legacy top-level researches
 * index (`RESEARCHES_INDEX.md`) becomes the per-directory `researches/INDEX.md`,
 * matching the convention that an index lives inside the directory it indexes.
 */
export const WORKSPACE_ARTIFACT_RENAMES: readonly { from: string; to: string }[] = [
  { from: 'RESEARCHES_INDEX.md', to: path.join(RESEARCHES_DIR_NAME, RESEARCHES_INDEX_FILE) },
];

// --- Plan artifacts (files INSIDE a plan folder) ---
//
// Deliberately NOT part of WORKSPACE_ARTIFACT_* above: that inventory means
// "artifact at the top of the workspace" and is consumed by golden-guard #3.
// These names live one level deeper — inside every `plans/<folder>/` — and are
// reachable only by walking that directory (see
// `workspace-migrations/plan-artifact.ts`). The directory name itself is
// `PLANS_DIR_NAME`, declared above next to its first consumer.

/** The single manifest a plan folder carries after the merge. */
export const PLAN_MANIFEST_FILE = 'PLAN.md';

/** Pre-merge checklist file, renamed to {@link PLAN_MANIFEST_FILE}. */
export const LEGACY_PLAN_TASKS_FILE = 'TASKS.md';

/** Pre-merge technical brief, folded into the manifest's Technical Context. */
export const LEGACY_PLAN_BRIEF_FILE = 'PLAN-BRIEF.md';

/**
 * Manifest header fields carrying an artifact's own timestamps (REQ-14).
 *
 * Deliberately NOT prefixed `PLAN_`, and declared here in the plan block rather
 * than twice: the plan manifest and the research manifest carry the SAME two
 * fields, and the research merge used to spell them as bare literals while the
 * plan backfill spelled them as constants. One value with two spellings in two
 * files is the shape every drift in this repository has taken; the prefix went
 * because it would have been a lie the moment the second reader arrived.
 */
export const MANIFEST_CREATED_FIELD = 'Created:';
export const MANIFEST_UPDATED_FIELD = 'Updated:';

/** The manifest heading the brief body is folded under. */
export const PLAN_TECHNICAL_CONTEXT_HEADING = '## Technical Context';

/** The horizontal rule that closes the manifest body before its Technical Context. */
export const PLAN_CONTEXT_SEPARATOR = '---';

/**
 * Cross-axis sections that live at `##` level in the manifest and must never be
 * demoted. `/unikit-verify` step 3.8 resolves `## Design` by its heading and
 * SKIPS THE CHECK SILENTLY when it is absent, so a demoted `### Design` does not
 * fail — it stops the design ACs being checked and stops `implemented_version`
 * being stamped, while the report reads "no ## Design section".
 */
export const PLAN_LIFTED_HEADINGS = [
  '## Design', '## Flow Context', '## Content Context',
] as const;

// --- Research artifacts (files INSIDE a research folder) ---
//
// Same standing as the plan block above and for the same reason: these names
// live one level deeper than the WORKSPACE_ARTIFACT_* inventory — inside every
// `researches/<folder>/` — and are reachable only by walking that directory
// (see `workspace-migrations/research-artifact.ts`). The directory name itself
// (`RESEARCHES_DIR_NAME`) and the registry file name (`RESEARCHES_INDEX_FILE`)
// are declared ABOVE, next to their first consumers, and deliberately not here.

/** The single manifest a research folder carries after the merge. */
export const RESEARCH_MANIFEST_FILE = 'RESEARCH.md';

/** Pre-merge full research, renamed to {@link RESEARCH_MANIFEST_FILE}. */
export const LEGACY_RESEARCH_RESULT_FILE = 'RESEARCH_RESULT.md';

/** Pre-merge structured brief, folded into the manifest's Active Summary. */
export const LEGACY_RESEARCH_BRIEF_FILE = 'RESEARCH_BRIEF.md';

/** Dialogue log — a separate file by REQ-11; only its basename changes. */
export const LEGACY_RESEARCH_SOURCE_FILE = 'RESEARCH_SOURCE.md';
export const RESEARCH_SOURCE_FILE = 'SOURCE.md';

/** Adaptive artifacts the fold half writes the brief's heavy sections into. */
export const RESEARCH_CONTRACTS_FILE = 'CONTRACTS.md';
export const RESEARCH_DEPENDENCY_GRAPH_FILE = 'DEPENDENCY-GRAPH.md';

/**
 * Header fields the research manifest carries beyond the shared timestamps.
 *
 * `Date:` is the legacy name the merge renames to {@link MANIFEST_CREATED_FIELD};
 * `Status:` (completeness) and `Lifecycle:` (currency) are two SEPARATE axes and
 * the merge must never conflate them — renaming `Status:` would silently kill
 * the `/unikit-plan` registry filter, which answers "no researches" rather than
 * an error when the field it greps for is gone (REQ-5, D-6).
 */
export const RESEARCH_DATE_FIELD = 'Date:';
export const RESEARCH_STATUS_FIELD = 'Status:';
export const RESEARCH_LIFECYCLE_FIELD = 'Lifecycle:';

/** The value {@link RESEARCH_LIFECYCLE_FIELD} is seeded with on migration. */
export const RESEARCH_LIFECYCLE_ACTIVE = 'active';

/**
 * Marker above a migrated `## Active Summary`, introducing its banner.
 *
 * Sits OUTSIDE the hashed region together with the banner it introduces, so
 * removing either later never reads as drift. It is a unikit marker like the
 * four below and belongs beside them: as an inline literal it was the only one
 * a rename could not reach, while `test-migrations.sh` greps it by hand.
 */
export const RESEARCH_MIGRATED_SUMMARY_MARKER = '<!-- unikit:migrated-summary -->';

/** The hashed region of the manifest. Bytes BETWEEN the two markers are the object. */
export const RESEARCH_ACTIVE_SUMMARY_HEADING = '## Active Summary';
export const RESEARCH_ACTIVE_SUMMARY_START = '<!-- unikit:active-summary:start -->';
export const RESEARCH_ACTIVE_SUMMARY_END = '<!-- unikit:active-summary:end -->';

/** Append-only session log inside the manifest. */
export const RESEARCH_SESSIONS_HEADING = '## Sessions';
export const RESEARCH_SESSIONS_START = '<!-- unikit:sessions:start -->';
export const RESEARCH_SESSIONS_END = '<!-- unikit:sessions:end -->';
