// Guards for the engine-bridge layer: BR-* (catalog seams, selection, hashing, BRIDGES.md, migrations).
// Consumed from scripts/test-skills.sh (Part 7e5). Imports the compiled build because tests run
// after `ensure_build` in the parent harness. Writes nothing into the repository: every project is a
// temporary directory.
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

const BRIDGES_DIR_ENV_VAR = 'UNIKIT_BRIDGES_DIR';
const PACKAGE_BRIDGES_DIR_NAME = 'engine-bridges';
const SEAM_TMP_PREFIX = 'br-s1-';
const MIN_BRIDGE_FILES = 6;
const MIN_BRIDGES_WITH_SOURCES = 4;

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

// ── BR-S: dev seams of the catalog ───────────────────────────────────────────

await group('BR-S', async () => {
    const fsModule = await dist('utils/fs.js');
    const engines = await dist('core/engines.js');
    const before = passed;

    const saved = process.env[BRIDGES_DIR_ENV_VAR];
    try {
        delete process.env[BRIDGES_DIR_ENV_VAR];
        const packaged = fsModule.getBridgesDir();
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), SEAM_TMP_PREFIX));
        try {
            process.env[BRIDGES_DIR_ENV_VAR] = tmp;
            assertEq('BR-S1', 'the override wins', fsModule.getBridgesDir(), tmp);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
        delete process.env[BRIDGES_DIR_ENV_VAR];
        assertEq('BR-S1', 'the package default returns once the override is gone', fsModule.getBridgesDir(), packaged);
        assertEq('BR-S1', 'the package default is the engine-bridges folder', path.basename(packaged), PACKAGE_BRIDGES_DIR_NAME);
        assertEq('BR-S1', 'the package default exists', fs.existsSync(packaged), true);
    } finally {
        if (saved === undefined) delete process.env[BRIDGES_DIR_ENV_VAR];
        else process.env[BRIDGES_DIR_ENV_VAR] = saved;
    }

    assertEq('BR-S2', 'unity names its bridges folder', engines.getEngineConfig('unity').bridgesDir, 'unity');
    assertEq('BR-S2', 'godot-net shares the godot folder', engines.getEngineConfig('godot-net').bridgesDir, 'godot');
    assertEq('BR-S2', 'mcpDir is gone from EngineConfig', 'mcpDir' in engines.getEngineConfig('unity'), false);

    report('BR-S', 'seam checks ran', passed - before, []);
});

// ── BR-1: every file of the bridge catalog is a bridge ───────────────────────

await group('BR-1', async () => {
    const { parseMcpServerEntry } = await dist('core/mcp-schema.js');
    const bridgesRoot = path.join(ROOT, PACKAGE_BRIDGES_DIR_NAME);
    const violations = [];
    let files = 0;
    let parsed = 0;

    for (const engineDir of fs.readdirSync(bridgesRoot)) {
        const dirPath = path.join(bridgesRoot, engineDir);
        if (!fs.statSync(dirPath).isDirectory()) continue;
        for (const file of fs.readdirSync(dirPath)) {
            if (!file.endsWith('.json')) continue;
            files++;
            const rel = `${PACKAGE_BRIDGES_DIR_NAME}/${engineDir}/${file}`;
            const entry = parseMcpServerEntry(JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8')), dirPath, file);
            if (entry === null) {
                violations.push(`${rel}: the parser refused the file`);
                continue;
            }
            parsed++;
            if (entry.isEngine !== true) violations.push(`${rel}: is_engine is not true`);
        }
    }

    // Counted against the directory listing, not a literal: the catalog grows with every bridge added.
    if (parsed !== files) violations.push(`parsed ${parsed} of ${files} files`);
    if (parsed < MIN_BRIDGE_FILES) violations.push(`only ${parsed} bridge file(s), expected at least ${MIN_BRIDGE_FILES}`);
    report('BR-1', 'every engine-bridges/*/*.json parses and declares is_engine', files, violations);
});

// ── BR-C: the config shape and the selection helpers ─────────────────────────

function tempProject(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeRawConfig(dir, config) {
    fs.writeFileSync(path.join(dir, '.unikit.json'), `${JSON.stringify(config, null, 2)}\n`);
}

function readRawConfig(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, '.unikit.json'), 'utf8'));
}

// A catalog entry as the selection helpers see it: only the fields they read.
function catalogEntry(fileId, code, kind, order) {
    const entry = { key: fileId, code, kind, isEngine: true, displayName: fileId, originDir: 'unity' };
    if (order !== undefined) entry.order = order;
    return [fileId, entry];
}

await group('BR-C', async () => {
    const config = await dist('core/config.js');
    const selection = await dist('core/bridges/selection.js');
    const before = passed;

    const dir = tempProject('br-c-');
    try {
        writeRawConfig(dir, {
            version: '3.0.0', engine: 'unity', rulesRegistry: null,
            mcp: { servers: { context7: 'context7' } },
            engineBridges: { selected: { 'unity-biome-mcp': 'unity-biome-mcp' } },
            agents: [],
        });
        const loaded = await config.loadConfig(dir);
        assertEq('BR-C1', 'both maps are read', [loaded.mcp.servers, loaded.engineBridges.selected],
            [{ context7: 'context7' }, { 'unity-biome-mcp': 'unity-biome-mcp' }]);
        await config.saveConfig(dir, loaded);
        const reloaded = await config.loadConfig(dir);
        assertEq('BR-C1', 'a load-save round does not lose the bridge map', reloaded.engineBridges.selected, { 'unity-biome-mcp': 'unity-biome-mcp' });
        assertEq('BR-C1', 'the saved key order puts engineBridges right behind mcp',
            Object.keys(readRawConfig(dir)).slice(0, 5), ['version', 'engine', 'rulesRegistry', 'mcp', 'engineBridges']);

        writeRawConfig(dir, {
            version: '2.5.0', engine: 'unity', engineMcpKey: 'UnityMCP', rulesRegistry: null,
            mcp: { servers: { 'unity-biome-mcp': 'UnityMCP' } }, agents: [],
        });
        const legacy = await config.loadConfig(dir);
        assertEq('BR-C2', 'a 2.x file loads with an empty bridge map', legacy.engineBridges.selected, {});
        assertEq('BR-C2', 'the scalar is not carried into the loaded config', 'engineMcpKey' in legacy, false);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }

    const discovered = new Map([
        catalogEntry('mcp-late', 'late', 'mcp', 2),
        catalogEntry('mcp-first', 'first', 'mcp', 1),
        catalogEntry('cli-zero', 'cli', 'cli', 0),
    ]);
    assertEq('BR-C3', 'the first MCP bridge in the package order gives the code', selection.resolveMcpBridgeCode(discovered, ['mcp-late', 'mcp-first', 'cli-zero']), 'first');
    assertEq('BR-C3', 'an empty selection gives null', selection.resolveMcpBridgeCode(discovered, []), null);
    assertEq('BR-C3', 'a selection of the CLI bridge alone gives null', selection.resolveMcpBridgeCode(discovered, ['cli-zero']), null);
    assertEq('BR-C3', 'the order the ids are listed in is not an input', selection.resolveMcpBridgeCode(discovered, ['mcp-first', 'mcp-late']), selection.resolveMcpBridgeCode(discovered, ['mcp-late', 'mcp-first']));

    const mixed = new Map([
        catalogEntry('b-tie', 'b', 'mcp', 1),
        catalogEntry('a-tie', 'a', 'mcp', 1),
        catalogEntry('no-order', 'n', 'mcp'),
        catalogEntry('second', 's', 'mcp', 2),
    ]);
    assertEq('BR-C4', 'order ascending, no order last, ties by file id',
        selection.orderBridges(mixed, ['no-order', 'second', 'b-tie', 'a-tie', 'gone']).map(bridge => bridge.fileId),
        ['a-tie', 'b-tie', 'second', 'no-order']);
    assertEq('BR-C4', 'selectionOf copies both maps',
        selection.selectionOf({ mcp: { servers: { a: 'x' } }, engineBridges: { selected: { b: 'y' } } }), { mcp: { a: 'x' }, bridges: { b: 'y' } });

    report('BR-C', 'config and selection checks ran', passed - before, []);
});

// ── BR-W: the wizard's bridge helpers ────────────────────────────────────────

await group('BR-W', async () => {
    const wizard = await dist('cli/wizard/prompts.js');
    const before = passed;

    const entries = [
        { fileId: 'zz-no-order', displayName: 'Z', isEngine: true },
        { fileId: 'coplay-unity-mcp', displayName: 'C', isEngine: true, order: 2 },
        { fileId: 'unity-biome-mcp', displayName: 'B', isEngine: true, order: 1 },
    ];
    assertEq('BR-W1', 'a fresh install checks the first MCP bridge of the package order', [...wizard.defaultBridgeIds(entries)], ['unity-biome-mcp']);
    assertEq('BR-W1', 'a catalog of CLI bridges alone checks nothing by default',
        [...wizard.defaultBridgeIds([{ fileId: 'cli-a', displayName: 'A', isEngine: true, kind: 'cli', order: 1 }])], []);

    const defaults = wizard.defaultBridgeIds(entries);
    assertEq('BR-W2', 'null (fresh install) follows the defaults', [wizard.isBridgePreselected('unity-biome-mcp', null, defaults), wizard.isBridgePreselected('coplay-unity-mcp', null, defaults)], [true, false]);
    assertEq('BR-W2', 'an array (re-init) mirrors the previous choice', [wizard.isBridgePreselected('coplay-unity-mcp', ['coplay-unity-mcp'], defaults), wizard.isBridgePreselected('unity-biome-mcp', ['coplay-unity-mcp'], defaults)], [true, false]);
    assertEq('BR-W2', 'an empty array is not a fresh install', wizard.isBridgePreselected('unity-biome-mcp', [], defaults), false);

    report('BR-W', 'wizard helper checks ran', passed - before, []);
});

// ── BR-4: the source hash takes the SET of bridges, not their order ──────────

await group('BR-4', async () => {
    const hashing = await dist('core/installer/hashing.js');
    const before = passed;

    const skillDir = tempProject('br-4-');
    try {
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: unikit-sample\n---\nbody\n');
        const hashOf = (selection) => hashing.computeSourceHashWithTemplate(skillDir, 'unity', 'unikit-sample', 'claude', selection);

        const base = await hashOf({ mcp: { context7: 'context7' }, bridges: { a: 'x', b: 'y' } });
        assertEq('BR-4a', 'the key order of the bridge map is not an input', await hashOf({ mcp: { context7: 'context7' }, bridges: { b: 'y', a: 'x' } }), base);
        assertEq('BR-4b', 'adding a bridge changes the hash', (await hashOf({ mcp: { context7: 'context7' }, bridges: { a: 'x', b: 'y', c: 'z' } })) !== base, true);
        assertEq('BR-4b', 'a new code under the same key changes the hash', (await hashOf({ mcp: { context7: 'context7' }, bridges: { a: 'x2', b: 'y' } })) !== base, true);
        assertEq('BR-4c', 'moving a pair from the MCP map to the bridge map changes the hash',
            (await hashOf({ mcp: { context7: 'context7', a: 'x' }, bridges: { b: 'y' } })) !== base, true);
        assertEq('BR-4d', 'an empty selection is stable between calls', await hashOf({ mcp: {}, bridges: {} }), await hashOf({ mcp: {}, bridges: {} }));
    } finally {
        fs.rmSync(skillDir, { recursive: true, force: true });
    }

    report('BR-4', 'hash checks ran', passed - before, []);
});

// ── BR-7a: the 3.0.0 config split, in process ────────────────────────────────

await group('BR-7a', async () => {
    const { runProjectMemoryMigrations } = await dist('core/memory-migrations/index.js');
    const before = passed;

    const run = async (config) => {
        const dir = tempProject('br-7a-');
        try {
            writeRawConfig(dir, config);
            await runProjectMemoryMigrations(dir, config.version);
            return readRawConfig(dir);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
    const rules = { installed: { version: '1.0.0', modules: { code: { core: [], stack: [] } } } };

    for (const version of ['2.5.0', '2.2.0']) {
        const result = await run({
            version, engine: 'unity', engineMcpKey: 'unity-biome-mcp',
            mcp: { servers: { 'unity-biome-mcp': 'unity-biome-mcp', context7: 'context7' } }, agents: [], rules,
        });
        assertEq('BR-7a', `${version}: the engine server is split from the universal one, the scalar is gone`,
            [result.engineBridges, result.mcp.servers, 'engineMcpKey' in result],
            [{ selected: { 'unity-biome-mcp': 'unity-biome-mcp' } }, { context7: 'context7' }, false]);
    }

    const empty = await run({ version: '2.5.0', engine: 'unity', engineMcpKey: null, mcp: { servers: {} }, agents: [], rules });
    assertEq('BR-7a', 'an empty selection still ends in the 3.0.0 shape', [empty.engineBridges, 'engineMcpKey' in empty], [{ selected: {} }, false]);

    const removed = await run({ version: '2.5.0', engine: 'unity', engineMcpKey: 'OldCode', mcp: { servers: { 'removed-vendor': 'OldCode' } }, agents: [], rules });
    assertEq('BR-7a', 'a server whose file is gone is recognised by the old scalar', removed.engineBridges, { selected: { 'removed-vendor': 'OldCode' } });

    report('BR-7a', 'config split checks ran', passed - before, []);
});

// ── BR-2: the entry fields every bridge shares, and the pointers to documentation ──

// Runs `fn` with console.warn captured; returns what it printed. The parsers warn instead of throwing.
function captureWarnings(fn) {
    const original = console.warn;
    const lines = [];
    console.warn = (...args) => { lines.push(args.join(' ')); };
    try {
        return { result: fn(), lines };
    } finally {
        console.warn = original;
    }
}

// Same, for an async body.
async function captureWarningsAsync(fn) {
    const original = console.warn;
    const lines = [];
    console.warn = (...args) => { lines.push(args.join(' ')); };
    try {
        return { result: await fn(), lines };
    } finally {
        console.warn = original;
    }
}

await group('BR-2', async () => {
    const { parseMcpServerEntry } = await dist('core/mcp-schema.js');
    const bridgesRoot = path.join(ROOT, PACKAGE_BRIDGES_DIR_NAME);
    const violations = [];
    const orderByDir = new Map();
    let files = 0;
    let withSources = 0;

    for (const engineDir of fs.readdirSync(bridgesRoot)) {
        const dirPath = path.join(bridgesRoot, engineDir);
        if (!fs.statSync(dirPath).isDirectory()) continue;
        for (const file of fs.readdirSync(dirPath)) {
            if (!file.endsWith('.json')) continue;
            files++;
            const rel = `${PACKAGE_BRIDGES_DIR_NAME}/${engineDir}/${file}`;
            const { result: entry, lines } = captureWarnings(() => parseMcpServerEntry(JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8')), dirPath, file));
            if (lines.length > 0) violations.push(`${rel}: the parser warned: ${lines.join(' | ')}`);
            if (entry === null) continue;

            if (typeof entry.order !== 'number') violations.push(`${rel}: a bridge has no numeric order`);
            const seen = orderByDir.get(engineDir) ?? new Map();
            if (typeof entry.order === 'number' && seen.has(entry.order)) violations.push(`${rel}: order ${entry.order} is also ${seen.get(entry.order)}`);
            if (typeof entry.order === 'number') seen.set(entry.order, file);
            orderByDir.set(engineDir, seen);

            const sources = entry.docs?.sources ?? [];
            if (sources.length > 0) withSources++;
            const ids = new Set();
            const intos = new Set();
            for (const source of sources) {
                if (ids.has(source.id)) violations.push(`${rel}: docs source id "${source.id}" repeats`);
                if (intos.has(source.into)) violations.push(`${rel}: docs source into "${source.into}" repeats`);
                ids.add(source.id);
                intos.add(source.into);
                if (source.kind === 'git' && !source.repo.startsWith('https://')) violations.push(`${rel}: git source "${source.id}" is not https`);
            }
        }
    }
    if (withSources < MIN_BRIDGES_WITH_SOURCES) violations.push(`only ${withSources} bridge(s) carry docs.sources, expected at least ${MIN_BRIDGES_WITH_SOURCES}`);
    report('BR-2', 'every bridge parses without a warning, has a unique numeric order and clean docs.sources', files, violations);

    // The negative half: a malformed optional value is dropped with a warning, the entry survives.
    const base = { key: 'x', code: 'x', displayName: 'X', is_engine: true, config: { command: 'x' }, docs: { repo: 'https://example.test/x' } };
    const parsed = (patch) => captureWarnings(() => parseMcpServerEntry({ ...base, ...patch }, '.', 'x.json'));

    const badSource = parsed({ docs: { ...base.docs, sources: [
        { kind: 'git', repo: 'https://example.test/x', into: 'a' },
        { kind: 'git', id: 'dup', repo: 'https://example.test/x', into: 'b' },
        { kind: 'git', id: 'dup', repo: 'https://example.test/x', into: 'c' },
        { kind: 'git', id: 'outside', repo: 'https://example.test/x', into: '../up' },
        { kind: 'git', id: 'plain-http', repo: 'http://example.test/x', into: 'd' },
    ] } });
    assertEq('BR-2', 'a docs source without an id, a repeated id, an into outside the folder and a non-https repo are dropped',
        badSource.result.docs.sources.map(source => source.id), ['dup']);
    assertEq('BR-2', 'each dropped source is announced', badSource.lines.length, 4);

    const badSetup = parsed({ setup: [{ by: 'robot', run: 'x' }, { by: 'human', run: 'install it' }] });
    assertEq('BR-2', 'a setup line with an unknown actor is dropped, the good one stays', badSetup.result.setup, [{ by: 'human', run: 'install it' }]);
    assertEq('BR-2', 'a dropped setup line is announced once', badSetup.lines.length, 1);

    const requires = parsed({ requires: { cli: '1.0.0-beta.14', package: '0.9', engineVersion: '6000.0', extra: 'ignored' } }).result.requires;
    assertEq('BR-2', 'requires keeps a prerelease, a short version and an engine version', requires, { engineVersion: '6000.0', cli: '1.0.0-beta.14', package: '0.9' });
    assertEq('BR-2', 'a requires value that is not a version is dropped', parsed({ requires: { cli: 'newest' } }).result.requires, undefined);
    assertEq('BR-2', 'detect keeps a bare binary name and drops a path', parsed({ detect: { binary: 'tool', projectVersionFile: 'a/../b' } }).result.detect, { binary: 'tool' });
    assertEq('BR-2', 'a kind that is neither mcp nor cli drops the entry', parsed({ kind: 'robot' }).result, null);
    assertEq('BR-2', 'a missing kind is mcp', parsed({}).result.kind, 'mcp');
});

// ── BR-3: the BRIDGES.md renderer ────────────────────────────────────────────

await group('BR-3', async () => {
    const { renderBridgesManifest } = await dist('core/bridges/manifest.js');
    const before = passed;

    const entry = (code, extra = {}) => ({ key: code, code, isEngine: true, kind: 'mcp', displayName: code, originDir: 'unity', ...extra });
    const input = (order) => ({
        engineId: 'unity',
        bridges: order.map(id => ({
            fileId: id,
            hasRulesTree: id === 'mcp-a',
            entry: id === 'mcp-a'
                ? entry('mcp-a', { docs: { context7: '/x/a', repo: 'https://example.test/a', sources: [{ kind: 'git', id: 's', repo: 'https://example.test/a', into: 's' }] } })
                : entry('mcp-b', { setup: [{ by: 'human', run: 'install b' }, { by: 'agent-confirmed', run: 'configure b' }] }),
        })),
        engineDocSources: [{ kind: 'git', id: 'eng', repo: 'https://example.test/e', into: 'eng' }],
        engineContext7: ['/x/engine'],
    });

    const text = renderBridgesManifest(input(['mcp-a', 'mcp-b']));
    const lines = text.split('\n');
    assertEq('BR-3', 'the first line says the file is generated', lines[0].startsWith('<!-- Generated by unikit-ai'), true);
    assertEq('BR-3', 'the default order is the bridges in the order given', text.includes('\ndefault order: mcp-a > mcp-b\n'), true);
    assertEq('BR-3', 'one block per bridge, in order', lines.filter(line => line.startsWith('## ')), ['## mcp-a', '## mcp-b', '## Engine-level documentation']);
    assertEq('BR-3', 'a bridge with a tree names its INDEX, one without says none',
        [text.includes('- rules: .unikit/system/engine-bridges/mcp-a/INDEX.md\n'), text.includes('- rules: none\n')], [true, true]);
    assertEq('BR-3', 'setup lines carry who performs them', [text.includes('- setup (human): install b'), text.includes('- setup (agent, confirm first): configure b')], [true, true]);
    assertEq('BR-3', 'the notes of a bridge are named after it', text.includes('- notes: .unikit/bridge-notes/mcp-a.md\n'), true);
    assertEq('BR-3', 'the docs sources are a JSON block', text.includes('- docs sources:\n```json\n['), true);
    assertEq('BR-3', 'the same input renders the same text', renderBridgesManifest(input(['mcp-a', 'mcp-b'])), text);
    assertEq('BR-3', 'no undefined or null leaks into the text', /undefined|\bnull\b/.test(text), false);
    assertEq('BR-3', 'a text ends in exactly one newline', text.endsWith('\n') && !text.endsWith('\n\n'), true);
    assertEq('BR-3', 'the user order is described, not stored', text.includes('user order: the list under engine_bridges.order in .unikit/config.yaml'), true);

    report('BR-3', 'renderer checks ran', passed - before, []);
});

// ── BR-5a: the adapter seam ──────────────────────────────────────────────────

await group('BR-5a', async () => {
    const { getBridgeAdapter } = await dist('core/bridges/adapter.js');
    const before = passed;

    const adapter = getBridgeAdapter('mcp');
    assertEq('BR-5a', 'an MCP bridge grants mcp__<code>__<tool>', adapter.grantEntries({ code: 'x' }, ['*', 't']), ['mcp__x__*', 'mcp__x__t']);
    assertEq('BR-5a', 'an MCP bridge is registered in the settings file', adapter.registersInSettings, true);
    assertEq('BR-5a', 'an unregistered kind throws', (() => { try { getBridgeAdapter('nope'); return false; } catch { return true; } })(), true);

    report('BR-5a', 'adapter checks ran', passed - before, []);
});

// ── BR-3b: the installer of BRIDGES.md and the per-bridge trees ──────────────

function treeSnapshot(dir) {
    const out = [];
    const walk = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) walk(full);
            else out.push(`${path.relative(dir, full)}:${fs.readFileSync(full, 'utf8').length}:${fs.statSync(full).mtimeMs}`);
        }
    };
    if (fs.existsSync(dir)) walk(dir);
    return out.sort();
}

await group('BR-3b', async () => {
    const { installEngineBridges, readPreviousBridgeSet } = await dist('core/installer/engine-bridges.js');
    const { discoverMcpServers } = await dist('core/mcp.js');
    const before = passed;

    const discovered = await discoverMcpServers('unity');
    const project = tempProject('br-3b-');
    const layer = path.join(project, '.unikit', 'system', 'engine-bridges');
    try {
        assertEq('BR-3b', 'there is no record of a previous set before the first install', await readPreviousBridgeSet(project), null);

        await installEngineBridges(project, 'unity', discovered, ['unity-biome-mcp', 'coplay-unity-mcp']);
        assertEq('BR-3b', 'two bridges deliver two trees and BRIDGES.md',
            ['unity-biome-mcp/INDEX.md', 'coplay-unity-mcp/INDEX.md', 'BRIDGES.md'].map(rel => fs.existsSync(path.join(layer, rel))), [true, true, true]);
        const manifest = fs.readFileSync(path.join(layer, 'BRIDGES.md'), 'utf8');
        assertEq('BR-3b', 'BRIDGES.md carries the default order of the package', manifest.includes('\ndefault order: unity-biome-mcp > coplay-unity-mcp\n'), true);
        assertEq('BR-3b', 'every delivered markdown file carries the stamp of its own bridge',
            fs.readFileSync(path.join(layer, 'coplay-unity-mcp', 'INDEX.md'), 'utf8').includes('\nbridge: coplay-unity-mcp\n'), true);
        assertEq('BR-3b', 'the previous set is read back from BRIDGES.md', await readPreviousBridgeSet(project), ['unity-biome-mcp', 'coplay-unity-mcp']);

        const snapshot = treeSnapshot(layer);
        await installEngineBridges(project, 'unity', discovered, ['unity-biome-mcp', 'coplay-unity-mcp']);
        assertEq('BR-3b', 'a second identical install changes nothing in the layer', treeSnapshot(layer).map(s => s.replace(/:[0-9.]+$/, '')), snapshot.map(s => s.replace(/:[0-9.]+$/, '')));

        await installEngineBridges(project, 'unity', discovered, ['coplay-unity-mcp']);
        assertEq('BR-3b', 'dropping a bridge removes its whole tree and its block', [fs.existsSync(path.join(layer, 'unity-biome-mcp')), fs.readFileSync(path.join(layer, 'BRIDGES.md'), 'utf8').includes('## unity-biome-mcp')], [false, false]);

        fs.mkdirSync(path.join(project, '.unikit', 'system', 'engine-mcp'), { recursive: true });
        fs.writeFileSync(path.join(project, '.unikit', 'system', 'engine-mcp', 'x.md'), 'old');
        await installEngineBridges(project, 'unity', discovered, ['coplay-unity-mcp']);
        assertEq('BR-3b', 'the 2.x engine-mcp folder is swept', fs.existsSync(path.join(project, '.unikit', 'system', 'engine-mcp')), false);

        await installEngineBridges(project, 'unity', discovered, []);
        assertEq('BR-3b', 'an empty selection leaves no layer at all', fs.existsSync(layer), false);
    } finally {
        fs.rmSync(project, { recursive: true, force: true });
    }

    report('BR-3b', 'installer checks ran', passed - before, []);
});

// ── BR-6: notes follow the set of bridges ────────────────────────────────────

await group('BR-6', async () => {
    const { swapBridgeNotes } = await dist('core/installer/bridge-notes.js');
    const before = passed;

    const project = tempProject('br-6-');
    const notes = path.join(project, '.unikit', 'bridge-notes');
    const active = (id) => path.join(notes, `${id}.md`);
    const archived = (id, index) => path.join(notes, 'archive', index ? `${id}.${index}.md` : `${id}.md`);
    const put = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
    const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
    const known = new Set(['a', 'b', 'c']);
    try {
        put(active('a'), 'A');
        await swapBridgeNotes(project, ['a'], ['b'], known);
        assertEq('BR-6', 'a bridge that left has its log parked under its own id', [read(active('a')), read(archived('a'))], [null, 'A']);

        put(active('b'), 'B');
        await swapBridgeNotes(project, ['b'], ['a'], known);
        assertEq('BR-6', 'a bridge that came back gets its own log restored', [read(active('a')), read(archived('b'))], ['A', 'B']);

        put(archived('a'), 'ORPHAN');
        put(active('a'), 'A2');
        const collision = await captureWarningsAsync(() => swapBridgeNotes(project, ['a'], ['b'], known));
        assertEq('BR-6', 'a taken archive slot is never overwritten', [read(archived('a')), read(archived('a', 1))], ['ORPHAN', 'A2']);
        assertEq('BR-6', 'the collision is announced', collision.lines.some(line => line.includes('archive name taken')), true);

        put(active('a'), 'A3'); put(active('b'), 'B3'); put(archived('c'), 'C');
        await captureWarningsAsync(() => swapBridgeNotes(project, ['a', 'b'], ['b', 'c'], known)); // a taken slot again: expected noise
        assertEq('BR-6', 'a set that changes in part moves only the difference', [read(active('b')), read(active('a')), read(active('c'))], ['B3', null, 'C']);

        put(active('a'), 'A4'); put(path.join(notes, 'mine.md'), 'USER');
        await captureWarningsAsync(() => swapBridgeNotes(project, null, ['b'], known)); // a taken slot again: expected noise
        assertEq('BR-6', 'with no record of the previous set only a known bridge is parked', [read(active('a')), read(path.join(notes, 'mine.md'))], [null, 'USER']);

        const snapshot = treeSnapshot(notes);
        await swapBridgeNotes(project, ['b'], ['b'], known);
        assertEq('BR-6', 'the same set touches nothing', treeSnapshot(notes), snapshot);
    } finally {
        fs.rmSync(project, { recursive: true, force: true });
    }

    report('BR-6', 'notes swap checks ran', passed - before, []);
});

// ── BR-7b: the 3.0.0 notes relocation, in process ────────────────────────────

await group('BR-7b', async () => {
    const { runProjectMemoryMigrations } = await dist('core/memory-migrations/index.js');
    const before = passed;

    const project = tempProject('br-7b-');
    const unikit = path.join(project, '.unikit');
    try {
        writeRawConfig(project, {
            version: '2.5.0', engine: 'unity', engineMcpKey: 'unity-biome-mcp',
            mcp: { servers: { 'unity-biome-mcp': 'unity-biome-mcp' } }, agents: [],
            rules: { installed: { version: '1.0.0', modules: { code: { core: [], stack: [] } } } },
        });
        fs.mkdirSync(path.join(unikit, 'memory', 'code', 'core'), { recursive: true });
        fs.mkdirSync(path.join(unikit, 'memory', 'code', 'stack'), { recursive: true });
        fs.mkdirSync(path.join(unikit, 'code'), { recursive: true });
        fs.writeFileSync(path.join(unikit, 'MCP-RECHECK-NOTES.md'), '# F\n\nserver:  unity-biome-mcp\n\n## Findings\n\nkeep\n');
        fs.writeFileSync(path.join(unikit, 'MCP-RECHECK-NOTES.archive.coplay-unity-mcp.1.md'), 'server: coplay-unity-mcp\n');
        await runProjectMemoryMigrations(project, '2.5.0');

        assertEq('BR-7b', 'the active log moved and its header key changed with the spacing kept',
            fs.readFileSync(path.join(unikit, 'bridge-notes', 'unity-biome-mcp.md'), 'utf8'), '# F\n\nbridge:  unity-biome-mcp\n\n## Findings\n\nkeep\n');
        assertEq('BR-7b', 'an indexed archive moved under archive/ with its index', fs.existsSync(path.join(unikit, 'bridge-notes', 'archive', 'coplay-unity-mcp.1.md')), true);
        assertEq('BR-7b', 'nothing of the old layout is left', fs.readdirSync(unikit).filter(name => name.startsWith('MCP-RECHECK-NOTES')), []);

        fs.writeFileSync(path.join(unikit, 'MCP-RECHECK-NOTES.md'), '# No owner here\n');
        const skipped = await captureWarningsAsync(() => runProjectMemoryMigrations(project, '2.5.0'));
        assertEq('BR-7b', 'a log with no owner line stays where it is', fs.existsSync(path.join(unikit, 'MCP-RECHECK-NOTES.md')), true);
        assertEq('BR-7b', 'and it is named in one warning', skipped.lines.filter(line => line.includes('no "server:" line')).length, 1);
    } finally {
        fs.rmSync(project, { recursive: true, force: true });
    }

    report('BR-7b', 'notes migration checks ran', passed - before, []);
});

// ── BR-9: the table of renamed skills ────────────────────────────────────────

await group('BR-9', async () => {
    const renames = await dist('core/skill-renames.js');
    const before = passed;

    assertEq('BR-9', 'the two skills of 3.0.0 are in the table',
        [renames.renamedTo('unikit-mcp-trap'), renames.renamedTo('unikit-mcp-audit'), renames.renamedTo('unikit-plan')],
        ['unikit-bridge-trap', 'unikit-bridge-audit', undefined]);
    assertEq('BR-9', 'names are renamed in place, in order, without duplicates',
        renames.renameSkillNames(['unikit', 'unikit-mcp-audit', 'unikit-bridge-audit', 'unikit-mcp-trap']),
        ['unikit', 'unikit-bridge-audit', 'unikit-bridge-trap']);
    assertEq('BR-9', 'a record keyed by skill name follows the table',
        renames.renameRecordKeys({ 'unikit-mcp-trap': 'skills/trap', 'unikit-commit': 'skills/c' }),
        { 'unikit-bridge-trap': 'skills/trap', 'unikit-commit': 'skills/c' });

    const manifest = {
        replaces: { 'skills/trap': 'unikit-mcp-trap', 'skills/c': 'unikit-commit' },
        injections: [
            { target: 'unikit-mcp-audit', targetType: 'skill', file: 'a.md' },
            { target: 'unikit-mcp-audit', targetType: 'subagent', file: 'b.md' },
        ],
    };
    const { result, lines } = captureWarnings(() => renames.renameManifestSkillNames(manifest, 'br9-label'));
    assertEq('BR-9', 'a manifest names the renamed skills under their new names, subagent targets untouched',
        [result.replaces, result.injections.map(injection => injection.target)],
        [{ 'skills/trap': 'unikit-bridge-trap', 'skills/c': 'unikit-commit' }, ['unikit-bridge-audit', 'unikit-mcp-audit']]);
    assertEq('BR-9', 'each renamed name is announced, once', lines.length, 2);
    assertEq('BR-9', 'reading the same manifest again does not announce it again',
        captureWarnings(() => renames.renameManifestSkillNames(manifest, 'br9-label')).lines.length, 0);

    report('BR-9', 'skill rename checks ran', passed - before, []);
});

// ── BR-7c: the plan rewrite, without a disk ──────────────────────────────────

await group('BR-7c', async () => {
    const { rewritePlanText } = await dist('core/bridge-migrations/plans.js');
    const before = passed;

    const plan = [
        '# Plan', '', '## Settings', '- Testing: yes', '- Editor tasks: mcp', '',
        '## MCP Findings', '',
        '| id | area | confirm that | observed | evidence | from |',
        '|---|---|---|---|---|---|',
        '| F1 | rollback | the snapshot has files | 2026-08-18 | `x(a|b)` → `files=0` | task 2.3 |',
        '', '## Tasks', '- [ ] one', '',
    ].join('\n');
    const expected = [
        '# Plan', '', '## Settings', '- Testing: yes', '- Editor tasks: engine-bridge', '',
        '## Engine Bridge Findings', '',
        '| id | area | confirm that | observed | evidence | from | bridge |',
        '|---|---|---|---|---|---|---|',
        '| F1 | rollback | the snapshot has files | 2026-08-18 | `x(a|b)` → `files=0` | task 2.3 | unity-biome-mcp |',
        '', '## Tasks', '- [ ] one', '',
    ].join('\n');
    const rewritten = rewritePlanText(plan, 'unity-biome-mcp');
    assertEq('BR-7c', 'heading, setting and table are rewritten, a pipe inside backticks is not a cell', rewritten, expected);
    assertEq('BR-7c', 'a second pass writes nothing', rewritten === null ? null : rewritePlanText(rewritten, 'unity-biome-mcp'), null);

    const fenced = ['## Settings', '```', '- Editor tasks: mcp', '## MCP Findings', '```', ''].join('\n');
    assertEq('BR-7c', 'a fenced example is never rewritten', rewritePlanText(fenced, '—'), null);
    assertEq('BR-7c', 'other values of the setting and a plan with no findings are left alone',
        rewritePlanText('## Settings\n- Editor tasks: manual\n\n## Tasks\n- [ ] a\n', '—'), null);

    const crlf = plan.split('\n').join('\r\n');
    const crlfOut = rewritePlanText(crlf, '—');
    assertEq('BR-7c', 'CRLF is kept on every line', crlfOut !== null && crlfOut.split('\n').every(line => line === '' || line.endsWith('\r')), true);

    const spaced = ['## MCP Findings', '| id | from |', '| --- | --- |', '| F1 | t |', ''].join('\n');
    assertEq('BR-7c', 'a spaced separator is widened in its own style',
        rewritePlanText(spaced, '—'), ['## Engine Bridge Findings', '| id | from | bridge |', '| --- | --- | --- |', '| F1 | t | — |', ''].join('\n'));

    const already = ['## Engine Bridge Findings', '| id | bridge |', '|---|---|', '| F1 | x |', ''].join('\n');
    assertEq('BR-7c', 'a table that already has the column is not widened again', rewritePlanText(already, '—'), null);

    report('BR-7c', 'plan rewrite checks ran', passed - before, []);
});

// ── BR-10a / BR-12a: the new forms in the texts that own them ────────────────

await group('BR-10a', async () => {
    const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const violations = [];
    let scanned = 0;

    const taskFormat = read('skills/unikit-plan/references/TASK-FORMAT.md');
    scanned++;
    if (!taskFormat.includes('| id | area | confirm that | observed | evidence | from | bridge |')) violations.push('TASK-FORMAT.md: the template has no seven-column header');
    if (!taskFormat.includes('**The 2.x form.**')) violations.push('TASK-FORMAT.md: the 2.x form is not described');

    for (const writer of [
        'skills/unikit-implement/SKILL.md', 'skills/unikit-fix/SKILL.md', 'skills/unikit-verify/SKILL.md',
        'subagents/unikit-implement-worker.md', 'subagents/unikit-implement-coordinator.md',
    ]) {
        scanned++;
        const text = read(writer);
        if (!text.includes('Engine Bridge Findings')) violations.push(`${writer}: does not name the section`);
        if (!/`bridge`/.test(text) && !text.includes('(`bridge` is')) violations.push(`${writer}: does not mention the bridge column`);
    }
    report('BR-10a', 'the format owner and the five writers carry the bridge column', scanned, violations);
});

// Task 20: the probe by the agent's settings file is gone from the readers, the console check is a reference.
await group('BR-10a', async () => {
    const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const violations = [];
    let scanned = 0;

    for (const rel of [
        'skills/unikit-implement/SKILL.md', 'skills/unikit-plan/SKILL.md',
        'skills/unikit-plan/references/mode-fast.md', 'skills/unikit-plan/references/mode-full.md',
    ]) {
        scanned++;
        if (read(rel).includes('settings_file')) violations.push(`${rel}: still probes the settings file of the agent`);
    }

    scanned++;
    const implement = read('skills/unikit-implement/SKILL.md');
    if (!implement.includes('{{skills_dir}}/{{self_name}}/references/console-check.md')) violations.push('unikit-implement: Step 3.6 does not name references/console-check.md in the full form');
    if (!implement.includes('`engine-bridge` if `.unikit/system/engine-bridges/BRIDGES.md` lists at least one bridge, otherwise `manual`')) violations.push('unikit-implement: the default of Editor tasks is not read from BRIDGES.md');
    scanned++;
    if (!fs.existsSync(path.join(ROOT, 'skills/unikit-implement/references/console-check.md'))) violations.push('references/console-check.md does not exist');

    scanned++;
    if (!read('subagents/unikit-implement-worker.md').includes('- `bridges:` — the ids of the engine bridges')) violations.push('the worker does not return the bridges field');
    scanned++;
    if (!read('subagents/unikit-implement-coordinator.md').includes('Bridges used:')) violations.push('the coordinator does not report the bridges used');

    report('BR-10a', 'the executors read BRIDGES.md instead of probing a settings file and name their bridges', scanned, violations);
});

await group('BR-12a', async () => {
    const violations = [];
    let scanned = 0;
    for (const skill of ['unikit-bridge-trap', 'unikit-bridge-audit']) {
        scanned++;
        const text = fs.readFileSync(path.join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8');
        const description = /description:\s*>-\n([\s\S]*?)\n[a-z-]+:/.exec(text)?.[1].replace(/\n\s*/g, ' ') ?? '';
        if (description.length === 0 || description.length > 1024) violations.push(`${skill}: description is ${description.length} characters`);
        if (/\b(Unity|Godot|Unreal)\b/.test(text)) violations.push(`${skill}: names an engine`);
        if (text.includes('.unikit/MCP-RECHECK-NOTES')) violations.push(`${skill}: still names the 2.x notes file`);
        if (/^server:|`server:`/m.test(text)) violations.push(`${skill}: still writes the 2.x header key`);
    }
    report('BR-12a', 'the two renamed skills carry no 2.x layout and stay engine-neutral', scanned, violations);
});

// ── BR-10b: the route ladder lives below the boundary of the layer A file, and only there ──

const LAZY_BOUNDARY_MARKER = '<!-- === LAZY-READ BOUNDARY === -->';
const LADDER_ANCHORS = [
    'The route ladder',
    'A dedicated route, bridge by bridge',
    'Engine code, bridge by bridge',
    'A marker and its delta come from one bridge',
    'A domain reload closes every bridge',
    'A bridge that does not answer stops itself, not the editor',
    'A copy older than the installed versions is **still used**',
];

await group('BR-10b', async () => {
    const text = fs.readFileSync(path.join(ROOT, 'data', 'dev-principles.md'), 'utf8');
    const boundary = text.indexOf(LAZY_BOUNDARY_MARKER);
    const violations = [];
    if (boundary < 0) {
        fail('BR-10b', 'the lazy-read boundary marker is gone');
        return;
    }
    const above = text.slice(0, boundary);
    const below = text.slice(boundary);
    for (const anchor of LADDER_ANCHORS) {
        if (!below.includes(anchor)) violations.push(`below the boundary: "${anchor}" is missing`);
        if (above.includes(anchor)) violations.push(`above the boundary: "${anchor}" is read on every Bootstrap`);
    }
    for (const forbidden of ['engine MCP', 'Engine MCP', 'engine-MCP', 'engine_mcp_tool', 'engine-mcp']) {
        if (text.includes(forbidden)) violations.push(`the 2.x wording "${forbidden}" is still there`);
    }
    report('BR-10b', 'the route ladder and the cross-bridge rules sit below the boundary, with no 2.x wording', LADDER_ANCHORS.length, violations);
});

// ── BR-10c: the gate contract over several bridges ───────────────────────────

const GATE_NAMES = ['compilation', 'console', 'structure', 'references', 'tests', 'behaviour', 'visual'];
const GATE_ANCHORS = [
    'every bridge that was available',
    'Do not substitute a cheaper **class of evidence**',
    'Trying the same gate through the next bridge is not a substitution',
];

await group('BR-10c', async () => {
    const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const verify = read('skills/unikit-verify/SKILL.md');
    const gates = read('skills/unikit-verify/references/bridge-gates.md');
    const violations = [];
    let scanned = 0;

    scanned++;
    if (!verify.includes('{{skills_dir}}/{{self_name}}/references/bridge-gates.md')) violations.push('SKILL.md: does not name references/bridge-gates.md in the full form');
    if (!verify.includes('GATE LIFTED')) violations.push('SKILL.md: the verdict GATE LIFTED is gone');
    if (!verify.includes('a verdict this skill produces')) violations.push('SKILL.md: does not say the verdict is produced by this skill');
    if (verify.includes('Do not substitute another tool')) violations.push('SKILL.md: still forbids the next bridge as a substitution');

    for (const anchor of GATE_ANCHORS) {
        scanned++;
        if (!gates.includes(anchor)) violations.push(`bridge-gates.md: "${anchor}" is missing`);
    }
    for (const name of GATE_NAMES) {
        scanned++;
        if (!gates.includes(name)) violations.push(`bridge-gates.md: the gate name "${name}" is missing`);
    }
    report('BR-10c', 'the gate contract runs over the bridges and keeps GATE LIFTED a verdict of verify', scanned, violations);
});

// ── BR-10d: the planner reads the union of the catalogs and never concludes from an incomplete one ──

await group('BR-10d', async () => {
    const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const plan = read('skills/unikit-plan/SKILL.md');
    const step = plan.slice(plan.indexOf('### Step 4.6'), plan.indexOf('### Step 5:'));
    const violations = [];
    let scanned = 0;

    scanned++;
    if (step.length === 0 || !plan.includes('### Step 4.6')) violations.push('SKILL.md: Step 4.6 is not found');
    for (const anchor of ['A bridge that was not read makes the union incomplete', 'unknown is not no', '/unikit-bridge-docs', 'catalog list:']) {
        scanned++;
        if (!step.includes(anchor)) violations.push(`Step 4.6: "${anchor}" is missing`);
    }
    for (const forbidden of ['Bash(unity list', 'settings_file']) {
        scanned++;
        if (plan.includes(forbidden)) violations.push(`SKILL.md: still carries "${forbidden}"`);
    }
    for (const mode of ['mode-fast.md', 'mode-full.md']) {
        scanned++;
        const text = read(`skills/unikit-plan/references/${mode}`);
        if (!text.includes('Look for a configured engine bridge')) violations.push(`${mode}: the Editor mode step does not read BRIDGES.md`);
    }
    report('BR-10d', 'the planner reads the union of the bridge catalogs and treats an unread bridge as unknown', scanned, violations);
});

// ── BR-11: the bridge order key in the config template, and the exception that keeps it ──

const TEMPLATE_BANNER = `# ${'='.repeat(77)}`;

await group('BR-11', async () => {
    const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const template = read('skills/unikit/references/config-template.yaml');
    const modeConfig = read('skills/unikit/references/mode-config.md');
    const violations = [];
    let scanned = 0;

    scanned++;
    const at = template.indexOf('# Engine Bridge Settings');
    if (at < 0) violations.push('config-template.yaml: no Engine Bridge Settings block');
    else if (template.slice(at - TEMPLATE_BANNER.length - 1, at) !== `${TEMPLATE_BANNER}\n`) violations.push('config-template.yaml: the block has no banner in the style of the others');
    scanned++;
    if (!/^engine_bridges:\n {2}order: \[\]$/m.test(template)) violations.push('config-template.yaml: no `engine_bridges:` with an empty `order: []`');
    scanned++;
    if (template.includes('{{')  && /engine_bridges:[\s\S]{0,40}\{\{/.test(template)) violations.push('config-template.yaml: the order value is a placeholder, it must be a literal');
    scanned++;
    if (!modeConfig.includes('**Exception — `engine_bridges.order`.**')) violations.push('mode-config.md: the empty-order exception of bucket 3 is missing');

    report('BR-11', 'the order key is a literal in the template and the actualization mode keeps its empty state', scanned, violations);
});

// ── BR-13: the settings file of an agent is still a template variable, although no base text asks for it ──

await group('BR-13', async () => {
    const { AGENT_REGISTRY } = await dist('core/agents.js');
    const { buildTemplateVars, processTemplate } = await dist('core/template.js');
    const violations = [];
    let scanned = 0;
    for (const agent of Object.values(AGENT_REGISTRY)) {
        if (typeof agent.settingsFile !== 'string') continue;
        scanned++;
        const rendered = processTemplate('{{settings_file}}', buildTemplateVars(agent));
        if (rendered !== agent.settingsFile) violations.push(`${agent.id}: {{settings_file}} renders to "${rendered}", expected "${agent.settingsFile}"`);
    }
    report('BR-13', 'every agent with a settings file renders it into extension text', scanned, violations);
});

// ── GV: one gate vocabulary across every engine rules tree ───────────────────
//
// The vocabulary is GATE_NAMES above (the one constant of the tests). `/unikit-verify` walks "one gate
// over the bridges", which only works when a gate of one bridge can be matched with the same gate of
// another, so every `verification.md` of every tree names its gates from that list and in its order.

const GATE_REACHABLE = ['yes', 'partly', 'no', 'unmeasured'];
const GATE_TABLE_HEADING = '## Gate calibration';
const GATE_TABLE_HEADER = ['gate', 'reachable', 'what proves it'];
const GATE_UNDECLARED_PHRASE = 'is not pre-declared here';
const GATE_NAMES_LINE_PREFIX = 'Every `verification.md` uses the same seven names:';
const OLD_GATE_PHRASES = ['structural gate', 'runtime gate', 'playtest', 'compile gate'];
const MIN_GATE_TREES = 6;
const MIN_RULES_TREE_FILES = 12;

// Every file below `dir`, as paths relative to ROOT with forward slashes.
function filesBelow(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...filesBelow(full));
        else out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
    return out;
}

// The rules files of the catalog: engine-bridges/<engine>/rules/**.
function rulesTreeFiles() {
    const bridgesRoot = path.join(ROOT, PACKAGE_BRIDGES_DIR_NAME);
    const files = [];
    for (const engine of fs.readdirSync(bridgesRoot, { withFileTypes: true })) {
        const rules = path.join(bridgesRoot, engine.name, 'rules');
        if (engine.isDirectory() && fs.existsSync(rules)) files.push(...filesBelow(rules));
    }
    return files;
}

// Cells of one table row; null for a line that is not a row.
function tableCells(line) {
    if (!line.startsWith('|')) return null;
    return line.replace(/^\||\|\s*$/g, '').split('|').map((cell) => cell.trim());
}

// The calibration table of one file: its rows with their line numbers, and the text after the table.
function parseGateTable(text) {
    const lines = text.split('\n');
    const start = lines.findIndex((line) => line.trim() === GATE_TABLE_HEADING);
    if (start < 0) return { rows: [], header: null, tail: '' };
    const rows = [];
    let header = null;
    let end = start + 1;
    for (let i = start + 1; i < lines.length; i++) {
        const cells = tableCells(lines[i]);
        if (cells === null) {
            if (rows.length > 0 || header !== null) { end = i; break; }
            continue;
        }
        end = i + 1;
        if (header === null) header = cells;
        else if (!/^-+$/.test(cells[0].replace(/:/g, ''))) rows.push({ line: i + 1, name: cells[0], reachable: cells[1] ?? '', proof: cells[2] ?? '' });
    }
    return { rows, header, tail: lines.slice(end).join('\n') };
}

const gateTrees = () => rulesTreeFiles().filter((file) => file.endsWith('/verification.md'));

await group('GV-1', async () => {
    const violations = [];
    const trees = gateTrees();
    for (const file of trees) {
        const { rows, header, tail } = parseGateTable(fs.readFileSync(path.join(ROOT, file), 'utf8'));
        if (header === null) { violations.push(`${file}: no "${GATE_TABLE_HEADING}" table`); continue; }
        if (header.join('|') !== GATE_TABLE_HEADER.join('|')) violations.push(`${file}: the table header is "${header.join(' | ')}", expected "${GATE_TABLE_HEADER.join(' | ')}"`);
        if (rows.length === 0) violations.push(`${file}: the calibration table has no rows`);
        const seen = new Set();
        for (const row of rows) {
            if (!GATE_NAMES.includes(row.name)) violations.push(`${file}:${row.line}: gate "${row.name}" is not in the vocabulary (${GATE_NAMES.join(' · ')})`);
            if (seen.has(row.name)) violations.push(`${file}:${row.line}: gate "${row.name}" appears twice`);
            seen.add(row.name);
            if (!GATE_REACHABLE.includes(row.reachable)) violations.push(`${file}:${row.line}: reachable "${row.reachable}" is not one of ${GATE_REACHABLE.join(' · ')}`);
        }
        if (!tail.includes(GATE_UNDECLARED_PHRASE)) violations.push(`${file}: the closing paragraph lost "${GATE_UNDECLARED_PHRASE}"`);
    }
    if (trees.length < MIN_GATE_TREES) violations.push(`only ${trees.length} verification.md files found, expected at least ${MIN_GATE_TREES}`);
    report('GV-1', 'every verification.md names its gates from the shared vocabulary, once each, with a known reachability', trees.length, violations);
});

await group('GV-2', async () => {
    const violations = [];
    const trees = gateTrees();
    for (const file of trees) {
        const { rows } = parseGateTable(fs.readFileSync(path.join(ROOT, file), 'utf8'));
        let previous = -1;
        for (const row of rows) {
            const at = GATE_NAMES.indexOf(row.name);
            if (at < 0) continue;
            if (at < previous) violations.push(`${file}:${row.line}: gate "${row.name}" comes after "${GATE_NAMES[previous]}", the vocabulary order is ${GATE_NAMES.join(' · ')}`);
            previous = Math.max(previous, at);
        }
    }
    report('GV-2', 'the rows of every verification.md follow the order of the vocabulary', trees.length, violations);
});

await group('GV-3', async () => {
    const violations = [];
    const files = rulesTreeFiles();
    for (const file of files) {
        const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
        lines.forEach((line, index) => {
            const lower = line.toLowerCase();
            for (const phrase of OLD_GATE_PHRASES) {
                if (lower.includes(phrase)) violations.push(`${file}:${index + 1}: the retired gate wording "${phrase}" (use ${GATE_NAMES.join(' · ')})`);
            }
        });
    }
    if (files.length < MIN_RULES_TREE_FILES) violations.push(`only ${files.length} files under engine-bridges/*/rules found, expected at least ${MIN_RULES_TREE_FILES}`);
    report('GV-3', 'no rules tree uses the retired gate names', files.length, violations);
});

await group('GV-4', async () => {
    const file = 'skills/unikit-verify/references/bridge-gates.md';
    const violations = [];
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const line = text.split('\n').find((candidate) => candidate.startsWith(GATE_NAMES_LINE_PREFIX));
    if (line === undefined) violations.push(`${file}: no line starting "${GATE_NAMES_LINE_PREFIX}"`);
    else {
        const listed = /`([^`]+)`/.exec(line.slice(GATE_NAMES_LINE_PREFIX.length));
        const names = listed === null ? [] : listed[1].split('·').map((name) => name.trim());
        if (names.join(' · ') !== GATE_NAMES.join(' · ')) violations.push(`${file}: lists "${names.join(' · ')}", the vocabulary is "${GATE_NAMES.join(' · ')}"`);
    }
    report('GV-4', 'bridge-gates.md lists the same seven gate names, in the same order, as the vocabulary', 1, violations);
});

// (groups of later tasks are appended above this line, each under its own banner)

console.log(`\nEngine bridge guards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
