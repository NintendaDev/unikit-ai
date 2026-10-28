// Guards for the rule of a bridge that arrives and leaves with the bridge: BRL-* (the parse of the reference
// list, the install, the file that is never overwritten, the record carried over by init, the removal of an
// unchanged registry rule only, the failure of the registry, the call sites).
// Consumed from scripts/test-skills.sh (Part 7e7). Imports the compiled build because tests run after
// `ensure_build` in the parent harness. Writes nothing into the repository: every project is a temporary
// directory, and the registry is a fixture, so nothing here touches the network.
//
// Every guard counts what it looked at; a guard that looked at nothing fails ("scanned nothing"),
// because a scan that finds nothing is indistinguishable from a scan that is broken.

import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

// ── Constants ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => import(pathToFileURL(path.join(ROOT, 'dist', rel)).href);
const readRepo = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const FIXTURE = path.join(ROOT, 'scripts', 'test-fixtures', 'bridge-rules');
const OFFLINE_OFFICIAL = path.join(ROOT, 'scripts', 'test-fixtures', 'offline-official');
process.env.UNIKIT_OFFICIAL_REGISTRY_URL ??= OFFLINE_OFFICIAL;

const BIO = 'unity-biome-mcp';
const CLI = 'unity-cli';
const COP = 'coplay-unity-mcp';
const BIO_REFERENCES = ['unity-biome-mcp-notes.md', 'unity-biome-mcp-batch.md'];
const PAST = new Date(2020, 0, 1);
const MAX_MODULE_LINES = 500;

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function fail(guard, detail) {
    failed++;
    console.error(`FAIL [${guard}] ${detail}`);
}

function pass(guard, what, count) {
    passed++;
    console.log(`PASS [${guard}] ${what}${count === undefined ? '' : ` (${count})`}`);
}

// Reports one guard: nothing scanned is a failure, every violation is a failure, otherwise a pass.
function report(guard, what, scanned, violations) {
    if (scanned === 0) {
        fail(guard, `${what}: scanned nothing`);
        return;
    }
    for (const violation of violations) fail(guard, violation);
    if (violations.length === 0) pass(guard, what, scanned);
}

function assertEq(guard, what, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) pass(guard, what);
    else fail(guard, `${what}\n  expected: ${e}\n  actual:   ${a}`);
}

// An exception inside a group must not take the whole run down silently.
async function group(name, fn) {
    try {
        await fn();
    } catch (error) {
        fail(name, `threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const { syncBridgeRules, parseRuleReferenceFiles, isInstalledRegistryRuleUnchanged } = await dist('core/installer/bridge-rules.js');
const { createRegistry } = await dist('core/registry/index.js');
const { emptyRulesInstallation } = await dist('core/config.js');
const { computeContentHash } = await dist('core/installer/shared.js');

const tempProject = () => fs.mkdtempSync(path.join(os.tmpdir(), 'brl-'));
const newConfig = () => ({ rules: { installed: emptyRulesInstallation() }, engineBridges: { selected: {} }, rulesRegistry: FIXTURE, engine: 'unity' });
const fixtureRegistry = () => createRegistry(FIXTURE, 'unity', null);
const stackDir = (project) => path.join(project, '.unikit', 'memory', 'code', 'stack');
const ruleFile = (project, id) => path.join(stackDir(project), `${id}.md`);
const refFile = (project, name) => path.join(stackDir(project), 'references', name);
const indexFile = (project) => path.join(project, '.unikit', 'memory', 'code', 'RULES_INDEX.md');
const entriesOf = (config) => config.rules.installed.modules.code.stack;
const statuses = (result) => result.lines.map((line) => `${line.id}:${line.status}`).sort();

/** One run with the defaults of `update`: the live state is the previous state. */
function run(project, config, options) {
    return syncBridgeRules({
        projectDir: project, config, registry: fixtureRegistry(), engineId: 'unity',
        previousBridgeIds: null, currentBridgeIds: [], previousRules: null, regenerateIndex: 'disk', ...options,
    });
}

/** A project with the rules of both bridges installed the way `update` leaves it. */
async function installedProject() {
    const project = tempProject();
    const config = newConfig();
    await run(project, config, { currentBridgeIds: [BIO, CLI] });
    return { project, config };
}

const cleanup = [];
const keep = (project) => { cleanup.push(project); return project; };

// ── BRL-1: reading the list of reference files from the header of a rule ─────

await group('BRL-1', async () => {
    const realRule = path.join(ROOT, 'rules-registry', 'code', 'unity', 'stack', `${BIO}.md`);
    const realManifest = path.join(ROOT, 'rules-registry', 'manifest.json');
    if (!fs.existsSync(realRule) || !fs.existsSync(realManifest)) {
        fail('BRL-1', 'the bundled registry snapshot is missing (run scripts/download-rules.sh)');
    } else {
        const listed = parseRuleReferenceFiles(fs.readFileSync(realRule, 'utf-8'));
        const manifest = JSON.parse(fs.readFileSync(realManifest, 'utf-8')).modules.code.engines.unity.stack.find((rule) => rule.id === BIO);
        assertEq('BRL-1', 'the header of the real Biome rule lists the references of the manifest, in any order', [...(listed ?? [])].sort(), [...manifest.references].sort());
        assertEq('BRL-1', 'the real Biome rule lists fifteen files', listed?.length, 15);
    }
    const fixtureRule = fs.readFileSync(path.join(FIXTURE, 'code', 'unity', 'stack', `${BIO}.md`), 'utf-8');
    assertEq('BRL-1', 'the fixture rule lists its two references', parseRuleReferenceFiles(fixtureRule), BIO_REFERENCES);
    assertEq('BRL-1', 'a text with no References header gives null', parseRuleReferenceFiles('# A rule\n\nNo header here.\n'), null);
    assertEq('BRL-1', 'a file named twice counts once',
        parseRuleReferenceFiles('> **References**: `references/a.md` (x), `references/a.md` (y), `references/b.md`\n'), ['a.md', 'b.md']);
    assertEq('BRL-1', 'a path that leaves the folder is not a reference file',
        parseRuleReferenceFiles('> **References**: `references/../../evil.md` (x), `references/sub/deep.md` (y)\n'), []);
    assertEq('BRL-1', 'only the header line is read, not the body',
        parseRuleReferenceFiles('> **References**: `references/a.md`\n\nSee also `references/b.md`.\n'), ['a.md']);

    const unchanged = (entry, text) => isInstalledRegistryRuleUnchanged(entry, text);
    const hash = computeContentHash('body');
    assertEq('BRL-1', 'an unchanged registry rule is recognised', unchanged({ name: 'x', source: 'registry', installed_hash: hash }, 'body'), true);
    assertEq('BRL-1', 'an edited registry rule is not', unchanged({ name: 'x', source: 'registry', installed_hash: hash }, 'body!'), false);
    assertEq('BRL-1', 'a local rule is not', unchanged({ name: 'x', source: 'local', installed_hash: hash }, 'body'), false);
    assertEq('BRL-1', 'a registry rule with no recorded hash is not', unchanged({ name: 'x', source: 'registry' }, 'body'), false);
    assertEq('BRL-1', 'a rule with no record is not', unchanged(undefined, 'body'), false);
    assertEq('BRL-1', 'a rule that cannot be read is not', unchanged({ name: 'x', source: 'registry', installed_hash: hash }, null), false);
});

// ── BRL-2: the rule arrives with the bridge and is never installed twice ─────

await group('BRL-2', async () => {
    const project = keep(tempProject());
    const config = newConfig();
    const first = await run(project, config, { currentBridgeIds: [BIO, CLI] });
    assertEq('BRL-2', 'both rules are installed', statuses(first), [`${BIO}:installed`, `${CLI}:installed`]);
    assertEq('BRL-2', 'both rule files are on disk', [fs.existsSync(ruleFile(project, BIO)), fs.existsSync(ruleFile(project, CLI))], [true, true]);
    assertEq('BRL-2', 'the Biome rule brought its two reference files', BIO_REFERENCES.map((name) => fs.existsSync(refFile(project, name))), [true, true]);
    assertEq('BRL-2', 'the state holds two registry entries', entriesOf(config).map((entry) => [entry.name, entry.source]).sort(), [[BIO, 'registry'], [CLI, 'registry']]);
    assertEq('BRL-2', 'each entry carries the hash of the file on disk',
        entriesOf(config).every((entry) => entry.installed_hash === computeContentHash(fs.readFileSync(ruleFile(project, entry.name), 'utf-8'))), true);
    assertEq('BRL-2', 'the state changed', first.stateChanged, true);
    const index = fs.existsSync(indexFile(project)) ? fs.readFileSync(indexFile(project), 'utf-8') : '';
    assertEq('BRL-2', 'RULES_INDEX.md was written and names both rules', [index.includes(BIO), index.includes(CLI)], [true, true]);

    for (const file of [ruleFile(project, BIO), ruleFile(project, CLI), ...BIO_REFERENCES.map((name) => refFile(project, name))]) fs.utimesSync(file, PAST, PAST);
    const second = await run(project, config, { previousBridgeIds: [BIO, CLI], currentBridgeIds: [BIO, CLI], previousRules: config.rules.installed });
    assertEq('BRL-2', 'a second run finds both rules present', statuses(second), [`${BIO}:present`, `${CLI}:present`]);
    assertEq('BRL-2', 'a second run writes no file',
        [ruleFile(project, BIO), ruleFile(project, CLI), ...BIO_REFERENCES.map((name) => refFile(project, name))].map((file) => fs.statSync(file).mtimeMs === PAST.getTime()), [true, true, true, true]);
    assertEq('BRL-2', 'a second run changes no state', [second.stateChanged, entriesOf(config).length], [false, 2]);
});

// ── BRL-3: no rule in the registry, and a rule that is already there ─────────

await group('BRL-3', async () => {
    const bare = keep(tempProject());
    const bareConfig = newConfig();
    const missing = await run(bare, bareConfig, { currentBridgeIds: [COP] });
    assertEq('BRL-3', 'a bridge with no rule in the registry is reported as such', statuses(missing), [`${COP}:not-in-registry`]);
    assertEq('BRL-3', 'nothing was created for it', [fs.existsSync(stackDir(bare)), entriesOf(bareConfig).length], [false, 0]);

    const own = keep(tempProject());
    const ownConfig = newConfig();
    fs.mkdirSync(stackDir(own), { recursive: true });
    fs.writeFileSync(ruleFile(own, CLI), 'my own rule of the CLI\n');
    const present = await run(own, ownConfig, { currentBridgeIds: [CLI] });
    assertEq('BRL-3', 'a rule of the same name that is already there is present', statuses(present), [`${CLI}:present`]);
    assertEq('BRL-3', 'it is not overwritten, byte for byte', fs.readFileSync(ruleFile(own, CLI), 'utf-8'), 'my own rule of the CLI\n');
    assertEq('BRL-3', 'and no record is invented for it', entriesOf(ownConfig).length, 0);
});

// ── BRL-4: the rule leaves with the bridge, and only an unchanged registry rule does ──

await group('BRL-4', async () => {
    const dropBio = (project, config) => run(project, config, { previousBridgeIds: [BIO, CLI], currentBridgeIds: [CLI], previousRules: config.rules.installed });

    const { project, config } = await installedProject(); keep(project);
    const removed = await dropBio(project, config);
    assertEq('BRL-4', 'the dropped bridge loses its rule', statuses(removed), [`${BIO}:removed`, `${CLI}:present`]);
    assertEq('BRL-4', 'its file and both references are gone', [fs.existsSync(ruleFile(project, BIO)), ...BIO_REFERENCES.map((name) => fs.existsSync(refFile(project, name)))], [false, false, false]);
    assertEq('BRL-4', 'its record is gone and the other rule keeps its own', entriesOf(config).map((entry) => entry.name), [CLI]);
    assertEq('BRL-4', 'the rule of the bridge that stays is untouched', fs.existsSync(ruleFile(project, CLI)), true);
    const index = fs.readFileSync(indexFile(project), 'utf-8');
    assertEq('BRL-4', 'the index no longer names the removed rule', [index.includes(BIO), index.includes(CLI)], [false, true]);

    const edited = await installedProject(); keep(edited.project);
    fs.appendFileSync(ruleFile(edited.project, BIO), '\nA line the user added.\n');
    const keptEdited = await dropBio(edited.project, edited.config);
    assertEq('BRL-4', 'a rule edited after the install stays, with the reason', keptEdited.lines.find((line) => line.id === BIO), { id: BIO, status: 'kept', reason: 'it was edited after it was installed' });
    assertEq('BRL-4', '...file, references and record included', [fs.existsSync(ruleFile(edited.project, BIO)), fs.existsSync(refFile(edited.project, BIO_REFERENCES[0])), entriesOf(edited.config).some((entry) => entry.name === BIO)], [true, true, true]);

    const local = await installedProject(); keep(local.project);
    entriesOf(local.config).find((entry) => entry.name === BIO).source = 'local';
    const keptLocal = await dropBio(local.project, local.config);
    assertEq('BRL-4', 'a rule recorded as the user\'s own stays, with the reason', keptLocal.lines.find((line) => line.id === BIO), { id: BIO, status: 'kept', reason: 'it is your own rule' });
    assertEq('BRL-4', '...and its file is still there', fs.existsSync(ruleFile(local.project, BIO)), true);

    const untracked = await installedProject(); keep(untracked.project);
    untracked.config.rules.installed.modules.code.stack = entriesOf(untracked.config).filter((entry) => entry.name !== BIO);
    const keptUntracked = await dropBio(untracked.project, untracked.config);
    assertEq('BRL-4', 'a rule the project holds no record of stays, with the reason', keptUntracked.lines.find((line) => line.id === BIO),
        { id: BIO, status: 'kept', reason: 'the project holds no record of where it came from' });

    const shared = await installedProject(); keep(shared.project);
    // The rule of the bridge that stays lists a reference file of the dropped one: that file must outlive it.
    fs.writeFileSync(ruleFile(shared.project, CLI), `> **References**: \`references/${BIO_REFERENCES[1]}\`\n`);
    await dropBio(shared.project, shared.config);
    assertEq('BRL-4', 'a reference file that another rule lists stays, the other one goes',
        [fs.existsSync(refFile(shared.project, BIO_REFERENCES[1])), fs.existsSync(refFile(shared.project, BIO_REFERENCES[0]))], [true, false]);

    const prefixed = await installedProject(); keep(prefixed.project);
    const plain = 'A rule with no references header.\n';
    fs.writeFileSync(ruleFile(prefixed.project, BIO), plain);
    entriesOf(prefixed.config).find((entry) => entry.name === BIO).installed_hash = computeContentHash(plain);
    fs.writeFileSync(refFile(prefixed.project, 'unity-biome-mcp-extra.md'), 'extra\n');
    fs.writeFileSync(refFile(prefixed.project, 'unrelated-file.md'), 'not ours\n');
    await dropBio(prefixed.project, prefixed.config);
    assertEq('BRL-4', 'with no header the files that carry the id as a prefix go',
        [fs.existsSync(refFile(prefixed.project, 'unity-biome-mcp-extra.md')), fs.existsSync(refFile(prefixed.project, BIO_REFERENCES[0]))], [false, false]);
    assertEq('BRL-4', '...and a file with another name stays', fs.existsSync(refFile(prefixed.project, 'unrelated-file.md')), true);

    const sibling = await installedProject(); keep(sibling.project);
    const plainRule = 'A rule with no references header.\n';
    fs.writeFileSync(ruleFile(sibling.project, BIO), plainRule);
    entriesOf(sibling.config).find((entry) => entry.name === BIO).installed_hash = computeContentHash(plainRule);
    fs.writeFileSync(ruleFile(sibling.project, `${BIO}-extras`), 'A sibling rule, also with no references header.\n');
    fs.writeFileSync(refFile(sibling.project, `${BIO}-extras-guide.md`), 'reference of the sibling\n');
    await dropBio(sibling.project, sibling.config);
    assertEq('BRL-4', 'with no header a file of a sibling rule whose id extends the dropped one stays, the dropped rule\'s own go',
        [fs.existsSync(refFile(sibling.project, `${BIO}-extras-guide.md`)), BIO_REFERENCES.some((name) => fs.existsSync(refFile(sibling.project, name)))], [true, false]);

    const gone = await installedProject(); keep(gone.project);
    fs.rmSync(ruleFile(gone.project, BIO));
    const noFile = await dropBio(gone.project, gone.config);
    assertEq('BRL-4', 'a dropped bridge whose file is already gone only loses its record',
        [noFile.lines.some((line) => line.id === BIO), entriesOf(gone.config).some((entry) => entry.name === BIO)], [false, false]);
});

// ── BRL-5: init resets the state of the rules; the record of a wanted rule is carried over ──

await group('BRL-5', async () => {
    const before = await installedProject(); keep(before.project);
    const stateBefore = JSON.parse(JSON.stringify(before.config.rules.installed));
    fs.writeFileSync(ruleFile(before.project, CLI), 'edited after the install\n');

    const fresh = newConfig();
    const carried = await run(before.project, fresh, { previousBridgeIds: [BIO, CLI], currentBridgeIds: [BIO, CLI], previousRules: stateBefore });
    assertEq('BRL-5', 'both rules are present', statuses(carried), [`${BIO}:present`, `${CLI}:present`]);
    assertEq('BRL-5', 'the records are carried into the fresh state',
        entriesOf(fresh).map((entry) => [entry.name, entry.source, entry.installed_hash]).sort(),
        stateBefore.modules.code.stack.map((entry) => [entry.name, entry.source, entry.installed_hash]).sort());
    assertEq('BRL-5', 'a file edited before the run is not overwritten', fs.readFileSync(ruleFile(before.project, CLI), 'utf-8'), 'edited after the install\n');
    assertEq('BRL-5', 'the state changed, so the index is rebuilt from the disk', fs.readFileSync(indexFile(before.project), 'utf-8').includes(CLI), true);

    const dropped = await installedProject(); keep(dropped.project);
    const previous = JSON.parse(JSON.stringify(dropped.config.rules.installed));
    const resetConfig = newConfig();
    const removed = await run(dropped.project, resetConfig, { previousBridgeIds: [BIO, CLI], currentBridgeIds: [CLI], previousRules: previous });
    assertEq('BRL-5', 'a dropped bridge is judged by the record of the previous state, not by the fresh one', statuses(removed), [`${BIO}:removed`, `${CLI}:present`]);
    assertEq('BRL-5', '...its files are gone', [fs.existsSync(ruleFile(dropped.project, BIO)), fs.existsSync(refFile(dropped.project, BIO_REFERENCES[0]))], [false, false]);
    const index = fs.readFileSync(indexFile(dropped.project), 'utf-8');
    assertEq('BRL-5', 'the index is rebuilt without the removed rule', [index.includes(BIO), index.includes(CLI)], [false, true]);
});

// ── BRL-6: the registry may fail; nothing selected asks nothing ──────────────

await group('BRL-6', async () => {
    let calls = 0;
    const unreachable = { fetchModuleManifest: async () => { calls++; return null; } };
    const project = keep(tempProject());
    const config = newConfig();
    const failedRun = await syncBridgeRules({
        projectDir: project, config, registry: unreachable, engineId: 'unity',
        previousBridgeIds: null, currentBridgeIds: [BIO, CLI], previousRules: null, regenerateIndex: 'disk',
    });
    assertEq('BRL-6', 'an unreachable registry fails every wanted rule with one reason and throws nothing',
        failedRun.lines.map((line) => [line.id, line.status, line.reason]).sort(), [[BIO, 'failed', 'registry unreachable'], [CLI, 'failed', 'registry unreachable']]);
    assertEq('BRL-6', '...and leaves no partial record or file', [entriesOf(config).length, fs.existsSync(stackDir(project))], [0, false]);

    const throwing = { fetchModuleManifest: async () => { throw new Error('transport exploded'); } };
    const exploded = await syncBridgeRules({
        projectDir: project, config: newConfig(), registry: throwing, engineId: 'unity',
        previousBridgeIds: null, currentBridgeIds: [BIO], previousRules: null, regenerateIndex: 'disk',
    });
    assertEq('BRL-6', 'a registry that throws is reported as unreachable, never rethrown',
        exploded.lines.map((line) => [line.id, line.status, line.reason]), [[BIO, 'failed', 'registry unreachable']]);

    calls = 0;
    const idle = await syncBridgeRules({
        projectDir: project, config: newConfig(), registry: unreachable, engineId: 'unity',
        previousBridgeIds: null, currentBridgeIds: [], previousRules: null, regenerateIndex: 'disk',
    });
    assertEq('BRL-6', 'with no bridge at all the report is empty and the registry is not asked', [idle.lines.length, calls], [0, 0]);

    const { project: wiped, config: wipedConfig } = await installedProject(); keep(wiped);
    fs.rmSync(ruleFile(wiped, BIO));
    const again = await run(wiped, wipedConfig, { previousBridgeIds: [BIO, CLI], currentBridgeIds: [BIO, CLI], previousRules: wipedConfig.rules.installed });
    assertEq('BRL-6', 'a rule the user deleted comes back while its bridge is selected', [statuses(again), fs.existsSync(ruleFile(wiped, BIO))], [[`${BIO}:installed`, `${CLI}:present`], true]);
    assertEq('BRL-6', '...with one record, not two', entriesOf(wipedConfig).filter((entry) => entry.name === BIO).length, 1);

    const hostile = keep(tempProject());
    const hostileRun = await run(hostile, newConfig(), { currentBridgeIds: ['../escape'] });
    assertEq('BRL-6', 'an id that is not a bridge id is refused, not turned into a path',
        hostileRun.lines.map((line) => [line.status, line.reason]), [['failed', 'not a valid bridge id']]);
});

// ── BRL-7: the call sites ────────────────────────────────────────────────────

await group('BRL-7', async () => {
    const violations = [];
    let scanned = 0;
    const update = readRepo('src/cli/commands/update.ts');
    const init = readRepo('src/cli/commands/init.ts');
    const at = (text, pattern) => text.search(pattern);

    scanned++;
    const sync = at(update, /await syncBridgeRules\(/);
    if (sync < 0) violations.push('update.ts does not call syncBridgeRules');
    else if (sync > at(update, /await installEngineBridges\(/)) violations.push('update.ts: syncBridgeRules( must come before installEngineBridges( (the previous set is read from the BRIDGES.md that call rewrites)');
    scanned++;
    if (sync > at(update, /await syncAllModules\(/)) violations.push('update.ts: syncBridgeRules( must come before syncAllModules( (Phase 3 of the sync rebuilds the index)');
    scanned++;
    if (!/previousRules: config\.rules\.installed,\s*regenerateIndex: 'none'/.test(update)) violations.push("update.ts: previousRules is the live state and the index is left to the sync (regenerateIndex: 'none')");

    scanned++;
    const initSync = at(init, /await syncBridgeRules\(/);
    if (initSync < 0) violations.push('init.ts does not call syncBridgeRules');
    else {
        if (initSync < at(init, /await swapBridgeNotes\(/)) violations.push('init.ts: syncBridgeRules( must come after swapBridgeNotes(');
        if (initSync > at(init, /await saveConfig\(projectDir, config\)/)) violations.push('init.ts: syncBridgeRules( must come before the one saveConfig(');
    }
    scanned++;
    if (!/previousRules: existingConfig\?\.rules\.installed \?\? null,\s*regenerateIndex: 'disk'/.test(init)) violations.push("init.ts: the previous state comes from existingConfig and the index is rebuilt from the disk (regenerateIndex: 'disk')");

    scanned++;
    const lines = readRepo('src/core/installer/bridge-rules.ts').split('\n').length;
    if (lines > MAX_MODULE_LINES) violations.push(`bridge-rules.ts has ${lines} lines, more than ${MAX_MODULE_LINES}`);
    report('BRL-7', 'the rule of a bridge is synced before BRIDGES.md is rewritten, with the state each command has', scanned, violations);
});

for (const dir of cleanup) fs.rmSync(dir, { recursive: true, force: true });

console.log(`\nBridge rule guards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
