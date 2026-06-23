// Genre-profile catalog — read-only seed profiles for the gamedesign module.
//
// A "genre profile" is a bundled, read-only descriptor that seeds GDD authoring
// for a game of a given genre: default flow-mode, behavioural-domain packs, and
// *suggested* systems / content-types / entities / resources, plus the
// review-only `critical_sections` / `review_emphasis` advisory weights. Profiles
// live as JSON under `data/gamedesign/genres/<id>.json` (zero-dep: the codebase
// carries no YAML parser, and the CLI must parse them for `genres show`).
//
// This module is the pure data accessor — a mirror of `modules.ts` in spirit,
// but with one deliberate difference: `modules.ts` is in-memory constants with
// no I/O, whereas these accessors read the bundled JSON catalog from disk. The
// reads are **synchronous** (`fs.readFileSync` / `fs.readdirSync` + `JSON.parse`)
// — a conscious departure from the project's async I/O convention
// (`config.ts` / `installer/system-assets.ts` use async `readJsonFile` /
// `listFiles`), justified for a small bundled-catalog CLI accessor whose sync
// signatures keep the CLI handlers and `resolveGenre` call sites simple.
//
// Genre is GENRE-BLIND to `unikit-gd-verify`: profiles are read only by
// `unikit-gd-spec` (seed interview) and `unikit-gd-review` (completeness lens).
// They are never edited — design divergence always lands in `GD-IDS.yaml`.

import fs from 'fs-extra';
import path from 'path';
import { getDataDir } from '../utils/fs.js';
import { GAMEDESIGN_MODULE_ID, GAMEDESIGN_GENRES_DIR_NAME } from './constants.js';

/** Pre-fill aggressiveness of a profile's seeds in the spec interview. */
export type GenreConfidence = 'high' | 'medium' | 'low';

/** Default flow wiring mode a profile suggests (mirrors `flows[].mode`). */
export type GenreFlowMode = 'linear' | 'conditional' | 'emergent';

/** Default content scale a seeded content-type suggests (mirrors `content_types[].scale`). */
export type GenreContentScale = 'bulk' | 'curated';

/** Resource kind a seeded resource suggests (mirrors the RES facet). */
export type GenreResourceKind = 'soft' | 'hard' | 'event';

/** A suggested system seed (subtracted/added in the spec interview). */
export interface GenreSeedSystem {
  slug: string;
  category: string;
  tier: string;
  why?: string;
}

/** A suggested content-type seed (routed to `unikit-gd-content` add-CT). */
export interface GenreSeedContentType {
  slug: string;
  belongs_to: string;
  scale: GenreContentScale;
  why?: string;
}

/** A suggested entity seed. */
export interface GenreSeedEntity {
  slug: string;
  why?: string;
}

/** A suggested resource (RES) seed. */
export interface GenreSeedResource {
  slug: string;
  kind: GenreResourceKind;
  why?: string;
}

/**
 * A bundled, read-only genre profile. The shape is the JSON contract every
 * `data/gamedesign/genres/<id>.json` must satisfy (validated structurally by the
 * `scripts/test-genres-*.sh` schema guard — required fields + enum values, NOT
 * cross-ref existence of referenced packs/content-types, which are legitimate
 * forward-refs to not-yet-built P1 packs / narrative CTs).
 */
export interface GenreProfile {
  /** Profile JSON schema version (for future migrations; pinned at 1). */
  schema_version: number;
  /** Profile content revision (a recorded provenance fact; refresh is unconditional). */
  version: number;
  /** Canonical id and `<id>.json` basename. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Alternate names/spellings `resolveGenre` matches (exact, case-insensitive). */
  aliases: string[];
  /**
   * One-line human match signal ("for which games") — lets `unikit-gd-spec`
   * semantically best-fit a descriptive `genre:` hint to a profile even when the
   * hint name does not match the catalog id/aliases.
   */
  summary: string;
  /** Seed pre-fill aggressiveness in the spec interview. */
  confidence: GenreConfidence;
  /** Suggested default flow wiring mode. */
  default_flow_mode: GenreFlowMode;
  /** Suggested behavioural-domain packs (forward-refs allowed). */
  default_packs: string[];
  /** Suggested system seeds. */
  seed_systems: GenreSeedSystem[];
  /** Suggested content-type seeds. */
  seed_content_types: GenreSeedContentType[];
  /** Suggested entity seeds. */
  seed_entities: GenreSeedEntity[];
  /** Suggested resource (RES) seeds. */
  seed_resources: GenreSeedResource[];
  /** Sections a complete GDD of this genre should carry (read ONLY by review). */
  critical_sections: string[];
  /** Advisory review re-weight hints (soft lens priority; review-only). */
  review_emphasis: string[];
  /** Default target platform hint (optional). */
  platform_default?: string;
}

/** Absolute path of the bundled profile catalog `data/gamedesign/genres`. */
function genresDataDir(): string {
  return path.join(getDataDir(), GAMEDESIGN_MODULE_ID, GAMEDESIGN_GENRES_DIR_NAME);
}

/**
 * Load one bundled profile by canonical id (the `<id>.json` basename). Returns
 * `undefined` when the file is absent or unparseable — callers (the CLI) map
 * that to exit 1. Synchronous by design (see module header).
 */
export function loadGenreProfile(id: string): GenreProfile | undefined {
  const filePath = path.join(genresDataDir(), `${id}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as GenreProfile;
  } catch {
    return undefined;
  }
}

/**
 * All bundled profiles, sorted by id. A profile file that fails to parse is
 * skipped (the structural test guard is the authoritative validator). Returns
 * `[]` when the catalog dir is absent.
 */
export function listGenreProfiles(): GenreProfile[] {
  let names: string[];
  try {
    names = fs.readdirSync(genresDataDir());
  } catch {
    return [];
  }
  return names
    .filter(name => name.endsWith('.json'))
    .map(name => loadGenreProfile(name.slice(0, -'.json'.length)))
    .filter((p): p is GenreProfile => p !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Resolve a profile from an exact id OR alias (case-insensitive), or
 * `undefined`. This is the **CLI** input resolver — `genres show <id|alias>` and
 * `genres install <id|alias...>` normalize their arguments through it so a user
 * may pass either form. Matching is exact (not fuzzy): the semantic "descriptive
 * genre hint → best-fit profile" reduction is the job of `unikit-gd-spec` (the
 * LLM reading `genres list` output), NOT this function.
 */
export function resolveGenre(text: string): GenreProfile | undefined {
  const needle = text.trim().toLowerCase();
  if (!needle) return undefined;
  for (const profile of listGenreProfiles()) {
    if (profile.id.toLowerCase() === needle) return profile;
    if (profile.aliases.some(alias => alias.toLowerCase() === needle)) return profile;
  }
  return undefined;
}
