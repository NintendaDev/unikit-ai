// --- CLI: unikit genres <subcommand> ---
// 3 subcommands: list, show, install.
//
// Genre profiles are a BUNDLED, read-only catalog (no registry, no network, no
// engine partition). The accessor lives in `core/genres.ts`; selective delivery
// to `.unikit/system/gamedesign/genres/` lives in `installer/system-assets.ts`.
// Exit codes are a subset of the rules CLI: 0 success · 1 not found · 3 invalid
// args. There is no exit 2 (no network) and no exit-8 migration gate (genres
// write under `.unikit/system/`, not the memory layout).

import chalk from 'chalk';
import { loadConfig, saveConfig, getInstalledGenres } from '../../core/config.js';
import { listGenreProfiles, resolveGenre, type GenreProfile } from '../../core/genres.js';
import { installGenreProfiles } from '../../core/installer/system-assets.js';
import { logInfo, logWarn } from '../../utils/log.js';

const EXIT = {
  SUCCESS: 0,
  NOT_FOUND: 1,
  INVALID_ARGS: 3,
} as const;

function exitWithCode(code: number): never {
  process.exit(code);
}

// =====================================================================
// list — the bundled catalog (+ installed marker)
// =====================================================================
//
// Reads the bundled profiles directly; loads `.unikit.json` ONLY to mark which
// are installed (a missing config is NOT an error here — the catalog is bundled).
// Always exit 0.

export async function genresListCommand(options: { json?: boolean } = {}): Promise<void> {
  const profiles = listGenreProfiles();

  const config = await loadConfig(process.cwd());
  const installedIds = config ? new Set(getInstalledGenres(config).map(e => e.id)) : new Set<string>();

  // The SAME projection feeds human + JSON (json-parity: every human column is a
  // JSON field; JSON may additionally carry platform_default).
  const rows = profiles.map(p => ({
    id: p.id,
    name: p.name,
    confidence: p.confidence,
    default_flow_mode: p.default_flow_mode,
    platform_default: p.platform_default ?? null,
    installed: installedIds.has(p.id),
  }));

  if (options.json) {
    console.log(JSON.stringify({ genres: rows }, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log(chalk.yellow('No genre profiles bundled.'));
    return;
  }

  const idWidth = Math.max(2, ...rows.map(r => r.id.length));
  const nameWidth = Math.max(4, ...rows.map(r => r.name.length));
  const confWidth = Math.max(10, ...rows.map(r => r.confidence.length));
  const flowWidth = Math.max(4, ...rows.map(r => r.default_flow_mode.length));

  console.log(chalk.bold(`\nGenre profiles (${rows.length}):\n`));
  const header = `  ${'ID'.padEnd(idWidth)}  ${'Confidence'.padEnd(confWidth)}  ${'Flow'.padEnd(flowWidth)}  Installed  Name`;
  console.log(chalk.dim(header));
  console.log(chalk.dim(`  ${'─'.repeat(idWidth)}  ${'─'.repeat(confWidth)}  ${'─'.repeat(flowWidth)}  ─────────  ${'─'.repeat(Math.min(20, nameWidth))}`));
  for (const r of rows) {
    const id = chalk.bold(r.id.padEnd(idWidth));
    const conf = r.confidence.padEnd(confWidth);
    const flow = chalk.dim(r.default_flow_mode.padEnd(flowWidth));
    const inst = r.installed ? chalk.green('✓'.padEnd(9)) : chalk.dim('-'.padEnd(9));
    console.log(`  ${id}  ${conf}  ${flow}  ${inst}  ${r.name}`);
  }

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.confidence] = (counts[r.confidence] ?? 0) + 1;
  const dist = ['high', 'medium', 'low'].filter(c => counts[c]).map(c => `${counts[c]} ${c}`).join(', ');
  console.log(chalk.dim(`\nTotal: ${rows.length} profiles (${dist})`));
}

// =====================================================================
// show — a single profile by id OR alias
// =====================================================================
//
// The argument is resolved through `resolveGenre` (exact id OR alias). Empty
// argument → exit 3 (invalid args); unresolvable → exit 1 (not found). Human and
// JSON render from the SAME profile object (json-parity — never reconstruct the
// human branch from derived constants).

function printProfileHuman(p: GenreProfile): void {
  console.log(chalk.bold(`\n${p.name} (${p.id})  ·  ${p.confidence}  ·  flow: ${p.default_flow_mode}`));
  if (p.platform_default) console.log(chalk.dim(`Platform: ${p.platform_default}`));
  console.log(chalk.dim(`Aliases:  ${p.aliases.join(', ')}`));
  console.log(chalk.dim(`Schema/version: ${p.schema_version}/${p.version}`));
  console.log('');
  console.log(p.summary);
  console.log('');
  console.log(chalk.bold('Default packs: ') + p.default_packs.join(', '));
  const seedLine = (label: string, items: { slug: string; why?: string }[]): void => {
    if (items.length === 0) return;
    console.log(chalk.bold(`${label}:`));
    for (const it of items) console.log(`  • ${it.slug}${it.why ? chalk.dim(` — ${it.why}`) : ''}`);
  };
  seedLine('Seed systems', p.seed_systems);
  if (p.seed_content_types.length > 0) {
    console.log(chalk.bold('Seed content types:'));
    for (const c of p.seed_content_types) {
      console.log(`  • ${c.slug} (${c.scale}, → ${c.belongs_to})${c.why ? chalk.dim(` — ${c.why}`) : ''}`);
    }
  }
  seedLine('Seed entities', p.seed_entities);
  if (p.seed_resources.length > 0) {
    console.log(chalk.bold('Seed resources:'));
    for (const r of p.seed_resources) {
      console.log(`  • ${r.slug} (${r.kind})${r.why ? chalk.dim(` — ${r.why}`) : ''}`);
    }
  }
  console.log(chalk.bold('Critical sections (review): ') + p.critical_sections.join(', '));
  console.log(chalk.bold('Review emphasis:'));
  for (const e of p.review_emphasis) console.log(`  • ${e}`);
}

export async function genresShowCommand(idOrAlias: string, options: { json?: boolean } = {}): Promise<void> {
  if (!idOrAlias || idOrAlias.trim().length === 0) {
    console.error(chalk.red('Usage: unikit-ai genres show <id|alias> [--json]'));
    exitWithCode(EXIT.INVALID_ARGS);
  }

  const profile = resolveGenre(idOrAlias);
  if (!profile) {
    console.error(chalk.red(`Genre profile "${idOrAlias}" not found. Run \`unikit-ai genres list\` to see the catalog.`));
    exitWithCode(EXIT.NOT_FOUND);
  }

  if (options.json) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  printProfileHuman(profile);
}

// =====================================================================
// install — variadic: copy profile(s) + record state, idempotent
// =====================================================================
//
// Each id|alias resolves through `resolveGenre` and state is keyed by the
// canonical `id`. No args → exit 3 (invalid args). No `.unikit.json` → exit 1.
// Already-installed → `↻` skip (re-copied under `--force`). Exit 1 only when no
// requested id resolved (every one unknown).

export async function genresInstallCommand(ids: string[], options: { force?: boolean } = {}): Promise<void> {
  if (ids.length === 0) {
    console.error(chalk.red('Usage: unikit-ai genres install <id|alias...> [--force]'));
    exitWithCode(EXIT.INVALID_ARGS);
  }

  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);
  if (!config) {
    console.error(chalk.red('Not a UniKit project. Run `unikit-ai init` first.'));
    exitWithCode(EXIT.NOT_FOUND);
  }

  const installed = getInstalledGenres(config);
  let installedCount = 0;
  let alreadyCount = 0;
  let failedCount = 0;
  let stateChanged = false;

  for (const arg of ids) {
    const profile = resolveGenre(arg);
    if (!profile) {
      logWarn('genres:install', `unknown genre: ${arg}`);
      console.log(chalk.red(`✗ unknown genre: ${arg}`));
      failedCount++;
      continue;
    }

    const existing = installed.find(e => e.id === profile.id);
    if (existing && !options.force) {
      console.log(chalk.dim(`↻ already installed ${profile.id}`));
      alreadyCount++;
      continue;
    }

    if (!existing) {
      installed.push({ id: profile.id, version: profile.version });
      stateChanged = true;
    } else {
      // --force on an already-installed profile: refresh the recorded version,
      // the flat re-copy below re-delivers the file.
      existing.version = profile.version;
      stateChanged = true;
    }
    console.log(chalk.green(`✓ installed ${profile.id} v${profile.version}`));
    installedCount++;
  }

  if (stateChanged) {
    await saveConfig(projectDir, config);
  }

  // Deliver/refresh every state profile to disk (flat copy + orphan-delete).
  await installGenreProfiles(projectDir, config);

  console.log(chalk.bold(`Genres: ${installedCount} installed, ${alreadyCount} already-installed, ${failedCount} failed`));
  logInfo('genres:install', `installed=${installedCount} already=${alreadyCount} failed=${failedCount}`);

  // Exit 1 only when nothing resolved (every requested id unknown).
  if (installedCount === 0 && alreadyCount === 0) {
    exitWithCode(EXIT.NOT_FOUND);
  }
}
