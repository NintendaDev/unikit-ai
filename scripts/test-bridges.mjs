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
    assertEq('BR-S2', 'the engine-level documentation fields are gone from EngineConfig',
        ['docSources' in engines.getEngineConfig('unity'), 'docContext7' in engines.getEngineConfig('unity')], [false, false]);

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
        unselected: [],
    });

    const text = renderBridgesManifest(input(['mcp-a', 'mcp-b']));
    const lines = text.split('\n');
    assertEq('BR-3', 'the first line says the file is generated', lines[0].startsWith('<!-- Generated by unikit-ai'), true);
    assertEq('BR-3', 'the default order is a numbered table of the bridges in the order given',
        text.includes('\ndefault order:\n\n| # | bridge | kind |\n|---|---|---|\n| 1 | mcp-a | mcp |\n| 2 | mcp-b | mcp |\n'), true);
    assertEq('BR-3', 'one block per bridge, in order', lines.filter(line => line.startsWith('## ')), ['## mcp-a', '## mcp-b']);
    assertEq('BR-3', 'a block opens with a field table', text.includes('## mcp-a\n\n| field | value |\n|---|---|\n| kind | mcp |\n'), true);
    assertEq('BR-3', 'a bridge with a tree names its INDEX, one without says none',
        [text.includes('| rules | .unikit/system/engine-bridges/mcp-a/INDEX.md |\n'), text.includes('| rules | none |\n')], [true, true]);
    assertEq('BR-3', 'setup is a table that says who performs each line',
        text.includes('Setup:\n\n| who | what to do |\n|---|---|\n| human | install b |\n| agent, confirm first | configure b |\n'), true);
    assertEq('BR-3', 'the notes of a bridge are named after it', text.includes('| notes | .unikit/bridge-notes/mcp-a.md |\n'), true);
    assertEq('BR-3', 'the docs sources are a JSON block under their label', text.includes('docs sources:\n```json\n['), true);
    assertEq('BR-3', 'the same input renders the same text', renderBridgesManifest(input(['mcp-a', 'mcp-b'])), text);
    assertEq('BR-3', 'no undefined or null leaks into the text', /undefined|\bnull\b/.test(text), false);
    assertEq('BR-3', 'a text ends in exactly one newline', text.endsWith('\n') && !text.endsWith('\n\n'), true);
    assertEq('BR-3', 'the user order is described, not stored', text.includes('user order: the list under engine_bridges.order in .unikit/config.yaml'), true);
    assertEq('BR-3', 'a pipe in a value cannot end its cell',
        renderBridgesManifest({ ...input(['mcp-a']), bridges: [{ fileId: 'mcp-a', hasRulesTree: false, entry: entry('mcp-a', { setup: [{ by: 'human', run: 'a | b' }] }) }] }).includes('| human | a \\| b |\n'), true);
    assertEq('BR-3', 'three bridges are numbered 1 to 3',
        renderBridgesManifest({ ...input(['mcp-a']), bridges: ['x', 'y', 'z'].map(id => ({ fileId: id, hasRulesTree: false, entry: entry(id) })) }).includes('| 3 | z | mcp |\n'), true);

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
        assertEq('BR-3b', 'BRIDGES.md carries the default order of the package as a numbered table', manifest.includes('\n| 1 | unity-biome-mcp | mcp |\n| 2 | coplay-unity-mcp | mcp |\n'), true);
        const stampUnderHeading = (rel) => {
            const lines = fs.readFileSync(path.join(layer, rel), 'utf8').split('\n');
            return /^#{1,6} /.test(lines[0]) && lines.slice(1, 6).join('\n') === '\n| field | value |\n|---|---|\n| bridge | coplay-unity-mcp |\n';
        };
        assertEq('BR-3b', 'every delivered markdown file starts with its title and carries the stamp table of its own bridge under it',
            ['coplay-unity-mcp/INDEX.md', 'coplay-unity-mcp/verification.md'].map(stampUnderHeading), [true, true]);
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

    assertEq('BR-9', 'unikit-devcontext is read as unikit-execute and the new name stays as it is',
        [renames.renamedTo('unikit-devcontext'), renames.renamedTo('unikit-execute')],
        ['unikit-execute', undefined]);
    assertEq('BR-9', 'a list that holds both names of that skill keeps one, in place',
        renames.renameSkillNames(['unikit', 'unikit-devcontext', 'unikit-execute']),
        ['unikit', 'unikit-execute']);
    const execManifest = {
        replaces: { 'skills/exec': 'unikit-devcontext' },
        injections: [{ target: 'unikit-devcontext', targetType: 'skill', file: 'a.md' }],
    };
    const execRun = captureWarnings(() => renames.renameManifestSkillNames(execManifest, 'br9-exec'));
    assertEq('BR-9', 'a manifest of the old name is read under the new one',
        [execRun.result.replaces, execRun.result.injections.map(injection => injection.target)],
        [{ 'skills/exec': 'unikit-execute' }, ['unikit-execute']]);
    assertEq('BR-9', 'the old name is announced once for that manifest', execRun.lines.length, 1);

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
    for (const anchor of ['A bridge that was not read makes the union incomplete', 'unknown is not no', '`catalog list` row', 'this bridge is not read']) {
        scanned++;
        if (!step.includes(anchor)) violations.push(`Step 4.6: "${anchor}" is missing`);
    }
    for (const gone of ['CATALOG', '/unikit-bridge-docs']) {
        scanned++;
        if (step.includes(gone)) violations.push(`Step 4.6: still names "${gone}"`);
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
    scanned++;
    if (!modeConfig.includes('Runs only when Phase A found the key `engine_bridges.order` **absent**')) violations.push('mode-config.md: the bridge-order phase of the actualization mode is missing');
    scanned++;
    if (!read('skills/unikit/references/mode-bridge-order.md').includes('**Decide and write.**')) violations.push('mode-bridge-order.md: the reusable block is missing');

    report('BR-11', 'the order key is a literal in the template, the actualization mode keeps its empty state and asks the order when it adds the key', scanned, violations);
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

// ── UT: the Unity CLI tree keeps what the measurements of the test calls added (2026-10-27) ──
//
// A test run through this bridge ends in ways that look alike in a table and are not: a play mode part started
// in the background under a success flag, a synchronous run lost to a timeout whose result is kept nowhere, a
// default output that keeps one summary line. The tree says so in capability words (no command names). The word
// `tests` is not one of the 12 areas of a Check row (ED-14, RT-7), so the two rows are filed under `transport`.

const UNITY_CLI_TREE = 'engine-bridges/unity/rules/unity-cli';
const UT_TESTS_ROW_PHRASES = ['half result', 'started in the background', 'kept nowhere'];
const UT_CHECK_ROWS = [
    { id: 'transport-2', area: 'transport', phrases: ['in the background', 'keeps no result'] },
    { id: 'transport-3', area: 'transport', phrases: ['summary line', 'a part started in the background'] },
];

await group('UT-1', async () => {
    const file = `${UNITY_CLI_TREE}/verification.md`;
    const violations = [];
    const rows = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').filter((line) => line.startsWith('| tests |'));
    if (rows.length !== 1) violations.push(`${file}: ${rows.length} rows start with "| tests |", expected exactly one`);
    else {
        for (const phrase of UT_TESTS_ROW_PHRASES) {
            if (!rows[0].includes(phrase)) violations.push(`${file}: the tests row lost "${phrase}"`);
        }
    }
    report('UT-1', 'the tests row of the Unity CLI calibration says that a part in the background is a half result and that a timed-out synchronous answer is kept nowhere', 1, violations);
});

await group('UT-2', async () => {
    const file = `${UNITY_CLI_TREE}/INDEX.md`;
    const violations = [];
    const rows = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').map(tableCells).filter((cells) => cells !== null);
    for (const wanted of UT_CHECK_ROWS) {
        const row = rows.find((cells) => cells[0] === wanted.id);
        if (row === undefined) { violations.push(`${file}: no Check row ${wanted.id}`); continue; }
        if (row[1] !== wanted.area) violations.push(`${file}: ${wanted.id} is filed under "${row[1]}", expected "${wanted.area}"`);
        for (const phrase of wanted.phrases) {
            if (!(row[2] ?? '').includes(phrase)) violations.push(`${file}: ${wanted.id} lost "${phrase}"`);
        }
    }
    report('UT-2', 'the Unity CLI Check table keeps the rows for a timed-out test call and for reading a test answer whole', UT_CHECK_ROWS.length, violations);
});

// ── BR-2b: the cli kind stays inside the points of the adapter ───────────────
//
// The readiness criterion of the cli adapter is mechanical (ADR-0004): it changes the five points
// of the adapter and nothing else. A source file that mentions the kind as a literal is either one
// of those points or a leak.

// The files that name the kind `cli` as a literal: the schema parsers and the adapter. Exactly these (second half below).
const CLI_KIND_POINTS = [
    'src/core/bridges/schema-fields.ts',
    'src/core/bridges/adapter-cli.ts',
    'src/core/mcp.ts',
    'src/core/mcp-schema.ts',
];
// `'cli'` with another meaning: the delivery column of the system-file registry ("written by the CLI").
const CLI_LITERAL_OTHER_MEANING = ['src/core/constants-template.ts'];

function sourceFiles(dir) {
    return filesBelow(path.join(ROOT, dir)).filter((file) => file.endsWith('.ts'));
}

await group('BR-2b', async () => {
    const violations = [];
    const files = sourceFiles('src');
    for (const file of files) {
        if (!fs.readFileSync(path.join(ROOT, file), 'utf8').includes("'cli'")) continue;
        if (CLI_KIND_POINTS.includes(file) || CLI_LITERAL_OTHER_MEANING.includes(file)) continue;
        violations.push(`cli kind leaked outside the adapter points: ${file}`);
    }
    report('BR-2b', "the literal 'cli' appears only in the adapter points", files.length, violations);
});

// ── BR-2d: a malformed cli entry is dropped or trimmed with a warning, never silently ──

await group('BR-2d', async () => {
    const { parseMcpServerEntry } = await dist('core/mcp-schema.js');
    const before = passed;
    const cliBlock = (patch = {}) => ({
        binary: 'tool',
        projectFlag: '--project-path',
        forms: { call: 'tool command --project-path "<project-root>" <command>' },
        ...patch,
    });
    const base = { key: 'c', code: 'c', displayName: 'C', is_engine: true, kind: 'cli', cli: cliBlock() };
    const parsed = (patch) => captureWarnings(() => parseMcpServerEntry({ ...base, ...patch }, '.', 'c.json'));

    const good = parsed({});
    assertEq('BR-2d', 'a cli entry without a config is accepted, with no warning and no config', [good.result?.kind, good.result?.config, good.lines.length], ['cli', undefined, 0]);
    assertEq('BR-2d', 'the shells default to Bash', good.result?.cli.shells, ['Bash']);

    const noBlock = parsed({ cli: undefined });
    assertEq('BR-2d', 'kind cli without a cli block drops the entry and says so', [noBlock.result, noBlock.lines.length > 0], [null, true]);

    const foreignForm = parsed({ cli: cliBlock({ forms: { call: 'tool command --project-path "<p>" <command>', groups: 'other groups --project-path "<p>"' } }) });
    assertEq('BR-2d', 'a form that does not begin with the binary is dropped, the entry survives',
        [foreignForm.result?.cli.forms.groups, foreignForm.result?.cli.forms.call !== undefined, foreignForm.lines.length], [undefined, true, 1]);
    assertEq('BR-2d', 'a call form that does not begin with the binary drops the entry',
        parsed({ cli: cliBlock({ forms: { call: 'other command --project-path "<p>"' } }) }).result, null);

    const noFlag = parsed({ cli: cliBlock({ forms: { call: 'tool command --project-path "<p>"', status: 'tool status', version: 'tool --version' } }) });
    assertEq('BR-2d', 'a form without the project flag is dropped, except the version probe',
        [noFlag.result?.cli.forms.status, noFlag.result?.cli.forms.version], [undefined, 'tool --version']);

    assertEq('BR-2d', 'a binary with a path separator drops the entry', parsed({ cli: cliBlock({ binary: 'bin/tool' }) }).result, null);
    assertEq('BR-2d', 'a project flag that is not an option drops the entry', parsed({ cli: cliBlock({ projectFlag: 'project-path' }) }).result, null);

    const shells = parsed({ cli: cliBlock({ shells: ['Bash', 'Zsh', 'PowerShell', 'Bash'] }) });
    assertEq('BR-2d', 'shells keep the known names once, and announce the unknown one', [shells.result?.cli.shells, shells.lines.length], [['Bash', 'PowerShell'], 1]);

    const probe = parsed({ cli: cliBlock({ probes: { package: { file: '../up.json', path: ['a'] } } }) });
    assertEq('BR-2d', 'a package probe outside the project is dropped, the entry survives', [probe.result?.cli.probes, probe.lines.length], [undefined, 1]);
    const goodProbe = parsed({ cli: cliBlock({ probes: { package: { file: 'Packages/lock.json', path: ['dependencies', 'p', 'version'], fallback: { file: 'Packages/manifest.json', path: ['dependencies', 'p'] } } } }) });
    assertEq('BR-2d', 'a package probe with a fallback is kept whole', goodProbe.result?.cli.probes.package.fallback, { file: 'Packages/manifest.json', path: ['dependencies', 'p'] });

    const withConfig = parsed({ config: { command: 'x' } });
    assertEq('BR-2d', 'a config on a cli entry is ignored with a warning', [withConfig.result?.config, withConfig.lines.length], [undefined, 1]);

    const mcpWithCli = captureWarnings(() => parseMcpServerEntry({ key: 'm', code: 'm', displayName: 'M', is_engine: true, config: { command: 'x' }, cli: cliBlock() }, '.', 'm.json'));
    assertEq('BR-2d', 'a cli block on an mcp entry is ignored with a warning', [mcpWithCli.result?.cli, mcpWithCli.lines.length], [undefined, 1]);
    assertEq('BR-2d', 'an unknown kind drops the entry and says so', [parsed({ kind: 'bogus' }).result, parsed({ kind: 'bogus' }).lines.length > 0], [null, true]);

    const pattern = (versionPattern) => captureWarnings(() => parseMcpServerEntry({ ...base, detect: { binary: 'tool', versionPattern } }, '.', 'c.json'));
    assertEq('BR-2d', 'a version pattern with one capture group is kept', pattern('^v(\\d+)').result?.detect.versionPattern, '^v(\\d+)');
    assertEq('BR-2d', 'a version pattern with two groups, with none, or one that does not compile is dropped',
        [pattern('^(a)(b)').result?.detect.versionPattern, pattern('^abc').result?.detect.versionPattern, pattern('^(abc').result?.detect.versionPattern], [undefined, undefined, undefined]);

    report('BR-2d', 'negative cases of the cli entry ran', passed - before, []);
});

// ── BR-2c: the Unity CLI card keeps the forms that were measured, not the ones that were documented ──
//
// Three forms of the beta.14 documentation failed on a live editor (a tsv listing with --quiet answers
// with nothing and exit 0, the package probe by `pipeline list` takes no project path, the skill of
// the package left the package), and the card holds the measured replacements. These checks keep a
// later edit from walking back to the documented shape.

const UNITY_CLI_CARD = 'engine-bridges/unity/unity-cli.json';
const MIN_CARD_CHECKS = 17;

await group('BR-2c', async () => {
    const { parseMcpServerEntry } = await dist('core/mcp-schema.js');
    const semver = (await import('semver')).default;
    const violations = [];
    let scanned = 0;
    const check = (ok, message) => { scanned++; if (!ok) violations.push(message); };

    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, UNITY_CLI_CARD), 'utf8'));
    const { result: entry, lines } = captureWarnings(() => parseMcpServerEntry(raw, path.dirname(path.join(ROOT, UNITY_CLI_CARD)), 'unity-cli.json'));
    check(entry !== null && lines.length === 0, `the card parses without a warning (${lines.join(' | ')})`);
    if (entry === null || !entry.cli) {
        report('BR-2c', 'the Unity CLI card keeps the measured forms', scanned, violations);
        return;
    }
    const { cli, requires, detect } = entry;
    const forms = Object.entries(cli.forms);

    check(entry.kind === 'cli' && entry.isEngine === true && entry.order === 1, 'the card is the first engine bridge of kind cli');
    check(forms.every(([, form]) => form.startsWith(`${cli.binary} `)), 'every form begins with the binary');
    check(forms.filter(([key]) => key !== 'version').every(([, form]) => form.includes('--project-path')), 'every form but the version probe carries --project-path');
    check(cli.shells.every(shell => shell === 'Bash' || shell === 'PowerShell'), 'the shells are Bash and PowerShell only');
    check(semver.valid(requires?.cli) !== null && semver.valid(requires?.package) !== null, 'the floors of the CLI and the package are full versions');
    check(String(requires?.package).includes('-exp.'), 'the package floor keeps its prerelease part');
    check(detect?.binary === cli.binary, 'the detected binary is the called binary');

    const verbs = Object.values(raw['allowed-tools']?.skills ?? {}).flat();
    check(verbs.every(verb => !verb.includes('*')), 'the grants are verbs, not masks');
    check(!verbs.some(verb => verb.startsWith('pipeline')), 'no grant for the pipeline verbs (install changes the project, list reads every open project of the machine)');
    check(forms.every(([, form]) => !form.includes('memory/code') && form === form.trim()), 'no form points into the rules memory or carries trailing space');

    check(forms.filter(([, form]) => form.includes('--format tsv')).every(([, form]) => !form.includes('--quiet')), 'no tsv form carries --quiet (the rows vanish, exit 0)');
    check(cli.forms.groups?.includes('--detail groups') === true && cli.forms.group !== undefined && !cli.forms.group.includes('--detail'), 'groups lists with --detail groups, group lists without --detail');
    check(cli.forms.compile?.includes('--timeout') === true && !cli.forms.compile.includes('--strict'), 'compile takes --timeout and not --strict');
    check(cli.forms.ready?.includes('--until-ready') === true, 'ready waits with --until-ready');
    check(cli.probes?.package !== undefined && !path.isAbsolute(cli.probes.package.file) && !cli.forms.status?.includes('pipeline list'), 'the package version is read from a project file, not asked of a command');
    check(typeof cli.forms.list === 'string' && cli.forms.list.startsWith('unity list '), 'the planner has a whole-catalog listing form');
    check(cli.forms.tags !== undefined && cli.forms.tags.endsWith('--tags') && cli.forms.tag !== undefined && cli.forms.tag.endsWith('--tag <tag>'), 'tags lists with --tags, and tag takes the tag last');
    check(!cli.forms.tags?.includes('--detail') && !cli.forms.tag?.includes('--detail'), 'neither the tags form nor the tag form asks for a detail level');
    check((cli.notes ?? []).some(note => note.includes('answers with an empty result')), 'a note says that a tag or a group that is not in the listing answers empty, without an error');
    // 2026-10-27, measured on a live editor: a call that names no --format answers one summary line, and the
    // text of a refusal or of a failed test is only in the ndjson answer; right after a compile the status
    // forms can answer STATUS_BLOCKED_BY_DIALOG for the reload dialog of the editor itself.
    check(cli.forms.call?.includes('--format ndjson') === true, 'the call form asks for ndjson (the default table keeps one summary line)');
    check((cli.notes ?? []).some(note => note.includes('names no --format')), 'a note says why the call form carries --format ndjson');
    check((cli.notes ?? []).some(note => note.includes('STATUS_BLOCKED_BY_DIALOG') && note.includes('ready form')), 'a note says that STATUS_BLOCKED_BY_DIALOG after a compile is answered by the ready form again');
    check(scanned >= MIN_CARD_CHECKS, `only ${scanned} checks ran, expected at least ${MIN_CARD_CHECKS}`);

    report('BR-2c', 'the Unity CLI card keeps the measured forms', scanned, violations);
});

// ── BR-W3: the real Unity catalog sorts the CLI first, and a fresh install still checks an MCP bridge ──

await group('BR-W3', async () => {
    const wizard = await dist('cli/wizard/prompts.js');
    const { discoverMcpServers } = await dist('core/mcp.js');
    const discovered = await discoverMcpServers('unity');
    const bridges = [...discovered].filter(([, entry]) => entry.isEngine)
        .map(([fileId, entry]) => ({ fileId, displayName: entry.displayName, isEngine: true, kind: entry.kind, order: entry.order }));

    assertEq('BR-W3', 'the catalog of unity lists the universal servers and the three bridges',
        [...discovered.keys()].sort(), ['context7', 'coplay-unity-mcp', 'github', 'unity-biome-mcp', 'unity-cli']);
    assertEq('BR-W3', 'the bridges sort in the package order: the CLI, then Biome, then Coplay',
        wizard.sortMcpChoices(bridges).map(bridge => bridge.fileId), ['unity-cli', 'unity-biome-mcp', 'coplay-unity-mcp']);
    assertEq('BR-W3', 'a fresh install without detection checks the first MCP bridge, not the CLI',
        [...wizard.defaultBridgeIds(bridges)], ['unity-biome-mcp']);
});

// ── BR-5b / BR-5c / BR-5d: the grants of a command-line bridge, and the removal that owns them ──

await group('BR-5b', async () => {
    const { getBridgeAdapter } = await dist('core/bridges/adapter.js');
    const { collectManagedGrantPrefixes } = await dist('core/bridges/grants.js');
    const { discoverMcpServers, collectMcpRules } = await dist('core/mcp.js');
    const adapter = getBridgeAdapter('cli');
    const cliEntry = (shells) => ({ key: 't', code: 't', kind: 'cli', isEngine: true, displayName: 'T', cli: { binary: 'tool', projectFlag: '--project-path', shells, forms: { call: 'tool command --project-path x' } } });

    assertEq('BR-5b', 'a command-line bridge is not registered in the settings file', adapter.registersInSettings, false);
    assertEq('BR-5b', 'a verb becomes a narrow pattern per shell, with no mask on the verb itself',
        adapter.grantEntries(cliEntry(['Bash']), ['command', 'self-update --check']), ['Bash(tool command *)', 'Bash(tool self-update --check *)']);
    assertEq('BR-5b', 'two shells give two patterns per verb, one shell after the other',
        adapter.grantEntries(cliEntry(['Bash', 'PowerShell']), ['command', 'self-update --check']),
        ['Bash(tool command *)', 'PowerShell(tool command *)', 'Bash(tool self-update --check *)', 'PowerShell(tool self-update --check *)']);
    assertEq('BR-5b', 'the managed prefixes are the heads of the patterns, one per shell',
        adapter.managedGrantPrefixes(cliEntry(['Bash', 'PowerShell'])), ['Bash(tool ', 'PowerShell(tool ']);
    const wildcard = captureWarnings(() => adapter.grantEntries(cliEntry(['Bash']), ['*', 'status']));
    assertEq('BR-5b', 'a wildcard is not a verb: nothing is written for it, and it is announced', [wildcard.result, wildcard.lines.length], [['Bash(tool status *)'], 1]);

    const discovered = await discoverMcpServers('unity');
    const prefixes = collectManagedGrantPrefixes(discovered);
    assertEq('BR-5b', 'the managed prefixes of the Unity catalog hold the MCP prefix and both shells of the CLI, and nothing hand-written',
        [prefixes.includes('mcp__'), prefixes.includes('Bash(unity '), prefixes.includes('PowerShell(unity '), prefixes.includes('Bash(git ')], [true, true, true, false]);

    const rules = collectMcpRules(discovered, ['unity-cli', 'unity-biome-mcp']);
    assertEq('BR-5b', 'the CLI grants reach the executors and the planner, the MCP grants sit beside them',
        [rules.skills['unikit-implement'].includes('Bash(unity command *)'), rules.skills['unikit-implement'].includes('PowerShell(unity recompile *)'),
            rules.skills['unikit-implement'].some(entry => entry.startsWith('mcp__unity-biome-mcp__')), rules.skills['unikit-plan'].includes('Bash(unity list *)')],
        [true, true, true, true]);
});

await group('BR-5c', async () => {
    const { injectToolsIntoSkillFrontmatter } = await dist('core/mcp.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'br-5c-'));
    try {
        const file = path.join(dir, 'SKILL.md');
        fs.writeFileSync(file, ['---', 'name: demo', 'allowed-tools:', '  - Read', '  - Bash(git *)', '  - Bash(unity command *)', '  - Bash(unity recompile *)', '  - mcp__old__*', '---', 'body', ''].join('\n'));
        const managed = ['mcp__', 'Bash(unity '];

        assertEq('BR-5c', 'the first sync reports a rewrite', await injectToolsIntoSkillFrontmatter(file, ['Bash(unity command *)'], managed), true);
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        assertEq('BR-5c', 'a managed entry that is no longer granted is removed, hand-written ones and the order stay',
            lines.slice(lines.indexOf('allowed-tools:') + 1, lines.indexOf('---', 1)), ['  - Read', '  - Bash(git *)', '  - Bash(unity command *)']);
        const settled = fs.readFileSync(file, 'utf8');
        assertEq('BR-5c', 'a second sync writes nothing', [await injectToolsIntoSkillFrontmatter(file, ['Bash(unity command *)'], managed), fs.readFileSync(file, 'utf8') === settled], [false, true]);

        assertEq('BR-5c', 'without the CLI prefix named, an entry of the CLI is left alone',
            [await injectToolsIntoSkillFrontmatter(file, [], ['mcp__']), fs.readFileSync(file, 'utf8').includes('Bash(unity command *)')], [false, true]);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

await group('BR-5d', async () => {
    // The removal treats every entry that starts with a managed prefix as the installer's own, so a
    // hand-written one in a source skill or subagent would be removed at the next narrowing.
    const violations = [];
    let scanned = 0;
    const sources = [
        ...filesBelow(path.join(ROOT, 'skills')).filter((file) => file.endsWith('/SKILL.md')),
        ...filesBelow(path.join(ROOT, 'subagents')).filter((file) => file.endsWith('.md')),
    ];
    for (const file of sources) {
        scanned++;
        const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
        for (const head of ['Bash(unity', 'PowerShell(unity']) {
            if (text.includes(head)) violations.push(`${file}: a hand-written "${head}" entry would be treated as installer-owned`);
        }
    }
    report('BR-5d', 'no source skill or subagent carries a hand-written command-line grant', scanned, violations);
});

// ── BR-D: detection of a bridge, the pre-selection it drives, and the preparation lines ──
//
// Detection reads PATH and a file of the project and runs nothing. The platform is a parameter of the
// context, so the Windows lookup (PATHEXT, `Path`) is checked on any host; the POSIX lookup needs a PATH
// delimiter that a Windows path does not contain, so it runs only on a host that is not Windows.

await group('BR-D', async () => {
    const detect = await dist('core/bridges/detect.js');
    const summary = await dist('core/bridges/summary.js');
    const wizard = await dist('cli/wizard/prompts.js');
    const { discoverMcpServers } = await dist('core/mcp.js');
    const before = passed;
    const dirs = [];
    const tmp = (prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); dirs.push(dir); return dir; };
    try {
        const bin = tmp('br-d-bin-');
        const marker = path.join(bin, 'was-executed.txt');
        fs.writeFileSync(path.join(bin, 'unity.exe'), `echo run > "${marker}"\n`);
        const winCtx = (envPath, extra = {}) => ({ projectDir: bin, env: { Path: envPath, PATHEXT: '.COM;.EXE;.BAT', ...extra }, platform: 'win32' });

        // PATHEXT is upper case and the file system is not case-sensitive on Windows: compare the path as the lookup spells it.
        assertEq('BR-D1', 'on Windows the binary is found through PATHEXT, in a variable spelled Path',
            (await detect.findBinaryOnPath('unity', winCtx(`${path.join(bin, 'nowhere')};${bin}`)))?.toLowerCase(), path.join(bin, 'unity.exe').toLowerCase());
        assertEq('BR-D1', 'a PATH without the binary finds nothing', await detect.findBinaryOnPath('unity', winCtx(path.join(bin, 'nowhere'))), null);
        assertEq('BR-D1', 'a folder named like the binary is not the binary',
            (fs.mkdirSync(path.join(bin, 'other.exe')), await detect.findBinaryOnPath('other', winCtx(bin))), null);
        assertEq('BR-D1', 'finding the binary does not execute it', fs.existsSync(marker), false);
        if (process.platform !== 'win32') {
            fs.writeFileSync(path.join(bin, 'unity'), '#!/bin/sh\n');
            assertEq('BR-D1', 'on POSIX the bare name is found in a colon-separated PATH',
                await detect.findBinaryOnPath('unity', { projectDir: bin, env: { PATH: `/nonexistent:${bin}` }, platform: 'linux' }), path.join(bin, 'unity'));
        }

        for (const [found, floor, expected] of [
            ['6000.0.23', '6000.3', false], ['6000.3.0', '6000.3', true], ['6000.3.1f1', '6000.3', true],
            ['6000.10', '6000.3', true], ['2021.3.45', '6000.3', false], ['6000', '6000.0', true], ['6000.0.77', '6000.0', true],
        ]) {
            assertEq('BR-D2', `${found} against the floor ${floor}`, detect.versionAtLeast(found, floor), expected);
        }

        const discovered = await discoverMcpServers('unity');
        const card = discovered.get('unity-cli');
        const projectWith = (versionLine) => {
            const dir = tmp('br-d-project-');
            if (versionLine !== null) {
                fs.mkdirSync(path.join(dir, 'ProjectSettings'));
                fs.writeFileSync(path.join(dir, 'ProjectSettings', 'ProjectVersion.txt'), `${versionLine}\nm_EditorVersionWithRevision: 6000.3.2f1 (abcdef)\n`);
            }
            return dir;
        };
        const versionOf = (dir) => detect.readProjectEngineVersion(card, { projectDir: dir, env: {}, platform: 'win32' });
        assertEq('BR-D3', 'the version is the first capture group of the card pattern, without the build suffix', await versionOf(projectWith('m_EditorVersion: 6000.3.2f1')), '6000.3.2');
        assertEq('BR-D3', 'a project without the version file has no version', await versionOf(projectWith(null)), null);
        assertEq('BR-D3', 'an entry without a pattern has no version', await detect.readProjectEngineVersion({ ...card, detect: { binary: 'unity' } }, { projectDir: bin, env: {}, platform: 'win32' }), null);

        const onPath = path.join(bin);
        const ctxFor = (dir, hasBinary) => ({ projectDir: dir, env: { Path: hasBinary ? onPath : path.join(bin, 'nowhere'), PATHEXT: '.EXE' }, platform: 'win32' });
        const high = projectWith('m_EditorVersion: 6000.3.22f1');
        const floorEdge = projectWith('m_EditorVersion: 6000.0.77f1');
        const low = projectWith('m_EditorVersion: 2022.3.45f1');
        assertEq('BR-D4', 'the binary found and the version at the floor: detected',
            [await detect.detectBridge(card, ctxFor(high, true)), await detect.detectBridge(card, ctxFor(floorEdge, true))], [true, true]);
        assertEq('BR-D4', 'the binary found but the version below the floor: not detected', await detect.detectBridge(card, ctxFor(low, true)), false);
        assertEq('BR-D4', 'the version fine but no binary: not detected', await detect.detectBridge(card, ctxFor(high, false)), false);
        assertEq('BR-D4', 'neither: not detected', await detect.detectBridge(card, ctxFor(low, false)), false);
        assertEq('BR-D4', 'no version file at all: not detected, nothing thrown', await detect.detectBridge(card, ctxFor(projectWith(null), true)), false);
        assertEq('BR-D4', 'an MCP bridge, which declares no detection, is never detected', await detect.detectBridge(discovered.get('unity-biome-mcp'), ctxFor(high, true)), false);

        const choices = [...discovered].filter(([, entry]) => entry.isEngine)
            .map(([fileId, entry]) => ({ fileId, displayName: entry.displayName, isEngine: true, kind: entry.kind, order: entry.order }));
        assertEq('BR-D5', 'a detected CLI is checked in addition to the first MCP bridge',
            [...wizard.defaultBridgeIds(choices, new Set(['unity-cli']))].sort(), ['unity-biome-mcp', 'unity-cli']);
        assertEq('BR-D5', 'nothing detected: only the first MCP bridge', [...wizard.defaultBridgeIds(choices, new Set())], ['unity-biome-mcp']);

        const both = summary.getBridgeSetupLines(discovered, ['unity-biome-mcp', 'unity-cli'], high);
        assertEq('BR-D6', 'the CLI block opens with its floors', both[0].startsWith('Unity CLI') && both[0].includes('requires: CLI >= 1.0.0-beta.14; package >= 0.9.1-exp.1; engine >= 6000.0'), true);
        assertEq('BR-D6', 'the three setup lines follow, with who performs each',
            both.slice(1, 4).map(line => /^\s*(\[[a-z ]+\])/.exec(line)?.[1]), ['[you]', '[asks first]', '[you]']);
        assertEq('BR-D6', 'the project slot is filled with the root only when it is an engine project',
            [both[2].includes('<project-root>'), both[2].includes(high)], [false, true]);
        assertEq('BR-D6', 'a folder that is not an engine project gets the placeholder for the user to fill',
            summary.getBridgeSetupLines(discovered, ['unity-cli'], bin)[2].includes('<your engine project root>'), true);
        assertEq('BR-D6', 'two bridges end with the package order and where to set one\'s own',
            both.at(-1), 'Order: unity-cli > unity-biome-mcp (package default). Set your own with /unikit or in .unikit/config.yaml (engine_bridges.order).');
        assertEq('BR-D6', 'one bridge prints no order line', summary.getBridgeSetupLines(discovered, ['unity-cli'], high).some(line => line.startsWith('Order:')), false);
        assertEq('BR-D6', 'nothing selected prints nothing', summary.getBridgeSetupLines(discovered, [], high), []);
    } finally {
        for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    }
    report('BR-D', 'detection, pre-selection and preparation-line checks ran', passed - before, []);
});

// ── BR-3c / BR-3d: the block of a command-line bridge, and the section of the bridges not selected ──

await group('BR-3c', async () => {
    const { renderBridgesManifest } = await dist('core/bridges/manifest.js');
    const { discoverMcpServers } = await dist('core/mcp.js');
    const discovered = await discoverMcpServers('unity');
    const ids = ['unity-cli', 'unity-biome-mcp', 'coplay-unity-mcp'];
    const render = (settingsFiles = ['.mcp.json', '.cursor/mcp.json']) => renderBridgesManifest({
        engineId: 'unity',
        bridges: ids.map(fileId => ({ fileId, entry: discovered.get(fileId), hasRulesTree: true })),
        unselected: [],
        settingsFiles,
    });
    const text = render();
    const lines = text.split('\n');
    const card = discovered.get('unity-cli');
    // The lines of one block: from the line after its `## <id>` heading to the next `## ` heading.
    const blockOf = (id) => {
        const rest = lines.slice(lines.indexOf(`## ${id}`) + 1);
        const end = rest.findIndex(line => line.startsWith('## '));
        return rest.slice(0, end < 0 ? rest.length : end);
    };
    // The rows of the `field | value` table of a block, its header and its rule skipped.
    const fieldRows = (block) => {
        const rows = [];
        for (let i = block.indexOf('| field | value |') + 2; i < block.length && block[i].startsWith('| '); i++) rows.push(block[i]);
        return rows;
    };
    const rowOf = (rows, field) => rows.find(row => row.startsWith(`| ${field} | `)) ?? '';
    const block = blockOf('unity-cli');
    const rows = fieldRows(block);
    const biome = fieldRows(blockOf('unity-biome-mcp'));
    const coplay = fieldRows(blockOf('coplay-unity-mcp'));

    assertEq('BR-3c', 'the default order table puts the CLI first and numbers the bridges',
        text.includes('\n| 1 | unity-cli | cli |\n| 2 | unity-biome-mcp | mcp |\n| 3 | coplay-unity-mcp | mcp |\n'), true);
    assertEq('BR-3c', 'the blocks come in the package order', lines.filter(line => line.startsWith('## ')), ['## unity-cli', '## unity-biome-mcp', '## coplay-unity-mcp']);
    assertEq('BR-3c', 'the fields of the block, in the order the readers rely on', rows.map(row => row.slice(2, row.indexOf(' |'))),
        ['kind', 'call', 'catalog groups', 'catalog group', 'catalog tags', 'catalog tag', 'catalog search', 'catalog list', 'schema of one command', 'compile', 'status', 'ready',
            'probe version', 'probe package', 'floor', 'available when', 'rules', 'verification', 'notes', 'docs', 'context7']);
    assertEq('BR-3c', 'the block points to the rules tree and the gate calibration of the bridge',
        [rows.includes('| rules | .unikit/system/engine-bridges/unity-cli/INDEX.md |'), rows.includes('| verification | .unikit/system/engine-bridges/unity-cli/verification.md |')], [true, true]);
    assertEq('BR-3c', 'the call form is printed as the card has it', rowOf(rows, 'call'), `| call | \`${card.cli.forms.call}\` |`);
    assertEq('BR-3c', 'every form that addresses a project carries --project-path',
        rows.filter(row => /^\| (call|catalog [a-z]+|schema of one command|compile|status|ready) \|/.test(row)).every(row => row.includes('--project-path')), true);
    assertEq('BR-3c', 'the floor names the CLI, the package and the engine',
        rows.includes('| floor | CLI >= 1.0.0-beta.14; package >= 0.9.1-exp.1; engine >= 6000.0 |'), true);
    const packageProbe = rowOf(rows, 'probe package');
    assertEq('BR-3c', 'the package probe reads Packages/packages-lock.json and falls back to Packages/manifest.json',
        [packageProbe.includes('read `Packages/packages-lock.json`'), packageProbe.includes('read `Packages/manifest.json`'), /\bunity\s/.test(packageProbe)], [true, true, false]);
    assertEq('BR-3c', 'availability names the floor when the version can be probed',
        rows.includes('| available when | the status form answers without an error and the version probe is at or above the floor |'), true);
    const afterNotes = block.slice(block.indexOf('Notes:') + 1);
    assertEq('BR-3c', 'every note of the card is printed under Notes:', afterNotes.slice(0, afterNotes.indexOf('')).length, card.cli.notes.length);
    assertEq('BR-3c', 'the preparation is a table that says who performs each line',
        [block.includes('| who | what to do |'), block.some(line => line.startsWith('| agent, confirm first | '))], [true, true]);
    assertEq('BR-3c', 'the same input renders the same text', render(), text);
    assertEq('BR-3c', 'an MCP block has no package probe, no floor and no catalog forms',
        [...biome, ...coplay].some(row => /^\| (probe package|floor|catalog (list|tags|tag|groups|group|search)) \|/.test(row)), false);
    assertEq('BR-3c', 'the tags and the tag forms are the card forms, the tag form takes the tag last',
        [rowOf(rows, 'catalog tags').endsWith('--tags` |'), rowOf(rows, 'catalog tag').endsWith('--tag <tag>` |')], [true, true]);
    assertEq('BR-3c', 'the Biome block reads its version from the settings files, the Coplay block has no version probe',
        [rowOf(biome, 'probe version').includes('(`.mcp.json`, `.cursor/mcp.json`)'), rowOf(biome, 'probe version').includes('@v(\\d[^#\\s]*)'), rowOf(coplay, 'probe version')], [true, true, '']);
});

await group('BR-3d', async () => {
    const { renderBridgesManifest } = await dist('core/bridges/manifest.js');
    const { installEngineBridges, readPreviousBridgeSet } = await dist('core/installer/engine-bridges.js');
    const { discoverMcpServers } = await dist('core/mcp.js');
    const discovered = await discoverMcpServers('unity');
    const project = tempProject('br-3d-');
    const manifestOf = () => fs.readFileSync(path.join(project, '.unikit', 'system', 'engine-bridges', 'BRIDGES.md'), 'utf8');
    try {
        await installEngineBridges(project, 'unity', discovered, ['unity-biome-mcp']);
        const text = manifestOf();
        assertEq('BR-3d', 'with only Biome selected the CLI is listed as not selected, with its probe',
            text.includes('## Not selected\n\n| bridge | name | probe |\n|---|---|---|\n| unity-cli | Unity CLI (Unity 6000.0+, needs the com.unity.pipeline package) | `unity --version` |\n'), true);
        assertEq('BR-3d', 'a bridge without a probe (Coplay) is not listed', text.includes('| coplay-unity-mcp |'), false);
        assertEq('BR-3d', 'the section is not read as a bridge', await readPreviousBridgeSet(project), ['unity-biome-mcp']);

        await installEngineBridges(project, 'unity', discovered, ['unity-biome-mcp', 'coplay-unity-mcp', 'unity-cli']);
        assertEq('BR-3d', 'with every bridge selected there is no such section', manifestOf().includes('## Not selected'), false);
        assertEq('BR-3d', 'the previous set holds all three, in file order', await readPreviousBridgeSet(project), ['unity-cli', 'unity-biome-mcp', 'coplay-unity-mcp']);

        await installEngineBridges(project, 'unity', discovered, ['unity-cli']);
        assertEq('BR-3d', 'the two MCP bridges, which cannot be probed, make no section when the CLI is selected', manifestOf().includes('## Not selected'), false);
    } finally {
        fs.rmSync(project, { recursive: true, force: true });
    }
    assertEq('BR-3d', 'an unselected bridge list without probes renders no section',
        renderBridgesManifest({ engineId: 'unity', bridges: [], unselected: [{ fileId: 'unity-biome-mcp', entry: discovered.get('unity-biome-mcp') }] }).includes('## Not selected'), false);
});

// ── BR-2b, second half: nothing is missing from the list either ──────────────
//
// The first half (above) says no other file mentions the kind. This half says every file that the
// readiness criterion names really does, so the list cannot rot into a superset nobody checks.

await group('BR-2b', async () => {
    const mentioning = new Set(sourceFiles('src').filter((file) => fs.readFileSync(path.join(ROOT, file), 'utf8').includes("'cli'")));
    const violations = CLI_KIND_POINTS.filter((file) => !mentioning.has(file)).map((file) => `${file} is listed as an adapter point but no longer names the kind`);
    report('BR-2b', 'every listed adapter point still names the cli kind', CLI_KIND_POINTS.length, violations);
});

// ── BR-2b, third half: the installer and the commands do not branch on the kind of a bridge ──
//
// The adapter exists so that nothing around it has to ask. A comparison with a kind, or a read of the
// `cli` block, in the installer or in a command is the abstraction leaking. Exceptions are listed here
// by file, with the reason; there are none.

const KIND_BRANCH_EXCEPTIONS = new Map([]);
const KIND_BRANCH_PATTERNS = [/\bkind\s*[!=]==?\s*['"](?:mcp|cli)['"]/, /\.cli\b/];

await group('BR-2b', async () => {
    const violations = [];
    const files = [...sourceFiles('src/core/installer'), ...sourceFiles('src/cli/commands')];
    for (const file of files) {
        if (KIND_BRANCH_EXCEPTIONS.has(file)) continue;
        fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line, index) => {
            for (const pattern of KIND_BRANCH_PATTERNS) {
                if (pattern.test(line)) violations.push(`${file}:${index + 1}: branches on the kind of a bridge outside the adapter points: ${line.trim()}`);
            }
        });
    }
    report('BR-2b', 'the installer and the commands never branch on the kind of a bridge', files.length, violations);
});

// ── BR-2e: no text a skill, a subagent, a data file or a rules tree carries calls a command-line bridge by its binary ──
//
// The routes of a command-line bridge live on its card and in BRIDGES.md, written at install time.
// A skill that spells the binary has a route table in disguise: it goes stale with the next beta and
// names a tool the project may not have chosen. The binary may appear in a text only as part of
// another word, a path or a hyphenated name.

await group('BR-2e', async () => {
    const violations = [];
    const bridgesRoot = path.join(ROOT, PACKAGE_BRIDGES_DIR_NAME);
    const binaries = new Set();
    for (const file of filesBelow(bridgesRoot).filter((rel) => rel.endsWith('.json') && !rel.includes('/rules/'))) {
        const card = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
        if (card.kind === 'cli' && typeof card.cli?.binary === 'string') binaries.add(card.cli.binary);
    }

    const roots = ['skills', 'subagents', 'data'];
    const texts = [
        ...roots.flatMap((root) => filesBelow(path.join(ROOT, root))),
        ...rulesTreeFiles(),
    ].filter((file) => file.endsWith('.md'));
    for (const binary of binaries) {
        const escaped = binary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const bare = new RegExp(`(^|[^A-Za-z0-9_./#-])${escaped}([^A-Za-z0-9_./-]|$)`);
        for (const file of texts) {
            fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line, index) => {
                if (bare.test(line)) violations.push(`${file}:${index + 1}: names the binary "${binary}" of a command-line bridge: ${line.trim().slice(0, 100)}`);
            });
        }
    }
    if (binaries.size < 1) violations.push('no bridge of kind cli found in the catalog: the guard has no object');
    report('BR-2e', 'no skill, subagent, data file or rules tree names the binary of a command-line bridge', texts.length, violations);
});

// ── BD / UREF: the bridge-documentation button and the user references skill ──

const BRIDGE_DOCS_SKILL = 'skills/unikit-bridge-docs';
const REFERENCES_SKILL = 'skills/unikit-references';
const SKILL_BYTE_CEILINGS = { [BRIDGE_DOCS_SKILL]: 12000, [REFERENCES_SKILL]: 9000 };
const BOOTSTRAP_ANCHOR = '<!-- unikit:extension-point:bootstrap -->';
const MAX_DESCRIPTION_BYTES = 1024;
const BRIDGE_DOCS_REFERENCES = ['status.md', 'menu.md', 'sources.md', 'stamp-and-report.md'];

const readRepo = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// The frontmatter of a SKILL.md: its name, the folded description and the list of allowed tools.
function skillFrontmatter(rel) {
    const text = readRepo(rel);
    const end = text.indexOf('\n---', 4);
    const head = text.slice(4, end);
    const description = /^description: >-\n((?:  .*\n?)+)/m.exec(head)?.[1].replace(/\n  /g, ' ').trim() ?? '';
    const tools = /^allowed-tools:\n((?:  - .*\n?)+)/m.exec(head)?.[1].split('\n').filter(Boolean).map((line) => line.slice(4)) ?? [];
    return { name: /^name: (.*)$/m.exec(head)?.[1], description, tools, text };
}

const cliBinaries = () => {
    const out = [];
    for (const file of filesBelow(path.join(ROOT, PACKAGE_BRIDGES_DIR_NAME)).filter((rel) => rel.endsWith('.json') && !rel.includes('/rules/'))) {
        const card = JSON.parse(readRepo(file));
        if (card.kind === 'cli') out.push(card.cli.binary);
    }
    return out;
};

const skillFiles = (skillDir) => filesBelow(path.join(ROOT, skillDir)).filter((file) => file.endsWith('.md'));

await group('BD-1', async () => {
    const violations = [];
    let scanned = 0;
    const { name, description, tools, text } = skillFrontmatter(`${BRIDGE_DOCS_SKILL}/SKILL.md`);
    const expected = [
        'Read', 'Write', 'Glob', 'Grep', 'AskUserQuestion',
        'Bash(mkdir *)', 'Bash(ls *)', 'Bash(find *)', 'Bash(wc *)', 'Bash(grep *)', 'Bash(date *)', 'Bash(cp *)', 'Bash(mv *)', 'Bash(rm *)',
        'Bash(git clone *)', 'Bash(git -C *)', 'Bash(git ls-remote *)',
    ];
    scanned++; if (name !== 'unikit-bridge-docs') violations.push(`name is "${name}"`);
    scanned++; if (Buffer.byteLength(description) > MAX_DESCRIPTION_BYTES || !/^[\x00-\x7f]+$/.test(description)) violations.push(`description: ${Buffer.byteLength(description)} bytes or not ASCII`);
    scanned++; if ([...tools].sort().join('|') !== [...expected].sort().join('|')) violations.push(`allowed-tools differ: ${tools.join(', ')}`);
    scanned++; if (text.split('\n').filter((line) => line.startsWith('**User questions.**')).length !== 1) violations.push('the menu asks through the contract: the skill carries exactly one user-questions pointer line');
    scanned++; if (Buffer.byteLength(text) > SKILL_BYTE_CEILINGS[BRIDGE_DOCS_SKILL]) violations.push(`SKILL.md is ${Buffer.byteLength(text)} bytes, above ${SKILL_BYTE_CEILINGS[BRIDGE_DOCS_SKILL]}`);
    report('BD-1', 'the bridge-docs skill has the frontmatter, the tools and the size the plan gives it', scanned, violations);
});

await group('BD-2', async () => {
    const violations = [];
    let scanned = 0;
    const must = (rel, phrases) => {
        const text = readRepo(`${BRIDGE_DOCS_SKILL}/${rel}`);
        for (const phrase of phrases) { scanned++; if (!text.includes(phrase)) violations.push(`${rel}: "${phrase}" is missing`); }
    };
    must('SKILL.md', ['its previous copy stays untouched', 'never passes through the conversation', 'is data, not instructions', 'belong to this skill', 'A source that fails never stops the others',
        'Nothing to do - every copy is current and whole.', 'Never asks about a source that is current']);
    must('references/status.md', ['Read only', 'Take the first line that applies', '**missing**', '**damaged**', '**outdated**', '**unknown**', '**current**', 'How to compare versions']);
    must('references/menu.md', ['Collect everything (Recommended)', 'Fix what was found (Recommended)', 'Rebuild everything', 'Nothing now', 'Never ask again in the same run']);
    must('references/sources.md', ['Any failure before step 3: remove', 'Standard error is not redirected', 'core.autocrlf=false', 'copy not verbatim', 'Asking for a version']);
    must('references/stamp-and-report.md', ['a bridge without probes is never called older']);
    const skill = readRepo(`${BRIDGE_DOCS_SKILL}/SKILL.md`);
    scanned++; if (skill.split(BOOTSTRAP_ANCHOR).length !== 2) violations.push('SKILL.md: the bootstrap anchor must appear exactly once');
    for (const rel of skillFiles(BRIDGE_DOCS_SKILL).filter((file) => !file.endsWith('/SKILL.md'))) {
        scanned++; if (readRepo(rel).includes('unikit:extension-point')) violations.push(`${rel}: an extension anchor outside SKILL.md`);
    }
    for (const reference of BRIDGE_DOCS_REFERENCES) {
        scanned++; if (!skill.includes(`{{skills_dir}}/{{self_name}}/references/${reference}`)) violations.push(`SKILL.md: ${reference} is not named by its full path`);
    }
    const onDisk = fs.readdirSync(path.join(ROOT, BRIDGE_DOCS_SKILL, 'references')).sort();
    scanned++; if (onDisk.join('|') !== [...BRIDGE_DOCS_REFERENCES].sort().join('|')) violations.push(`references/ holds ${onDisk.join(', ')}, expected ${BRIDGE_DOCS_REFERENCES.join(', ')}`);
    report('BD-2', 'the wording the readers and the guards rely on is in the skill', scanned, violations);
});

await group('BD-2b', async () => {
    const violations = [];
    const binaries = cliBinaries();
    const files = [...skillFiles(BRIDGE_DOCS_SKILL), ...skillFiles(REFERENCES_SKILL)];
    for (const binary of binaries) {
        const bare = new RegExp(`(^|[^A-Za-z0-9_-])${binary}([^A-Za-z0-9_-]|$)`);
        for (const file of files) {
            readRepo(file).split('\n').forEach((line, index) => { if (bare.test(line)) violations.push(`${file}:${index + 1}: names the binary "${binary}"`); });
        }
    }
    if (binaries.length < 1) violations.push('no cli bridge in the catalog');
    report('BD-2b', 'the skills that read the bridge documentation name no binary', files.length, violations);
});

await group('BD-3', async () => {
    const { renderBridgesManifest } = await dist('core/bridges/manifest.js');
    const { orderBridges } = await dist('core/bridges/selection.js');
    const { discoverMcpServers } = await dist('core/mcp.js');
    const discovered = await discoverMcpServers('unity');
    const manifest = renderBridgesManifest({
        engineId: 'unity',
        bridges: orderBridges(discovered, ['unity-cli', 'unity-biome-mcp']).map(({ fileId, entry }) => ({ fileId, entry, hasRulesTree: true })),
        unselected: [],
        settingsFiles: ['.mcp.json'],
    });
    const skillText = skillFiles(BRIDGE_DOCS_SKILL).map(readRepo).join('\n');
    const violations = [];
    // What the producer prints (a row of the field table, a label line, the Setup table), and the name the consumer reads it by.
    const row = (field) => `\n| ${field} | `;
    const keys = [
        [row('docs'), '`docs`'], [row('probe version'), '`probe version`'], [row('probe package'), '`probe package`'], [row('floor'), '`floor`'],
        ['docs sources:\n```json', '`docs sources`'], ['Setup:\n\n| who | what to do |', '`setup`'],
    ];
    for (const [printed, named] of keys) {
        if (!manifest.includes(printed)) violations.push(`BRIDGES.md does not print "${printed.trim()}"`);
        if (!skillText.includes(named)) violations.push(`the skill does not read ${named}`);
    }
    // What BRIDGES.md no longer carries must not be read: the catalog part and the engine-level block are gone from both sides.
    const gone = ['catalog groups', 'catalog group', 'Engine-level documentation'];
    for (const phrase of gone) {
        if (skillText.includes(phrase)) violations.push(`the skill still reads "${phrase}"`);
    }
    report('BD-3', 'every key the skill reads is printed in BRIDGES.md, and nothing the file no longer prints is read', keys.length + gone.length, violations);
});

await group('BD-4', async () => {
    const violations = [];
    let scanned = 0;
    const need = (rel, phrases) => {
        const text = readRepo(`${BRIDGE_DOCS_SKILL}/${rel}`);
        for (const phrase of phrases) { scanned++; if (!text.includes(phrase)) violations.push(`${rel}: "${phrase}" is missing`); }
    };
    need('references/stamp-and-report.md', ['collected:', 'versions:', '## Sources', '## Folders', 'FILES.md', 'was -> is',
        '| source | kind | stamp | files | bytes | state | folder |', '| path | bytes | caption |', '<!-- pointer ', '.unikit/references/bridges/<bridge id>/']);
    need('references/status.md', ['| bridge | source | in the copy | now | state |']);
    report('BD-4', 'the formats the readers parse are spelled in the skill', scanned, violations);
});

await group('BD-5', async () => {
    const card = JSON.parse(readRepo('engine-bridges/unity/unity-cli.json'));
    const verbs = card['allowed-tools'].skills['unikit-bridge-docs'] ?? [];
    assertEq('BD-5', 'the button gets exactly the show and version verbs (it lists, probes and reads; it never calls a command or contacts the editor), and the skill exists',
        [[...verbs].sort(), verbs.some((verb) => verb.startsWith('pipeline')), fs.existsSync(path.join(ROOT, BRIDGE_DOCS_SKILL, 'SKILL.md'))],
        [['--version', 'skill show'], false, true]);
});

await group('BD-6', async () => {
    const violations = [];
    let scanned = 0;
    for (const file of filesBelow(path.join(ROOT, PACKAGE_BRIDGES_DIR_NAME)).filter((rel) => rel.endsWith('.json') && !rel.includes('/rules/'))) {
        for (const source of JSON.parse(readRepo(file)).docs?.sources ?? []) {
            scanned++;
            const where = `${file}: source "${source.id}"`;
            if (source.kind === 'command' && !(String(source.show).includes('<file>') && String(source.list).length > 0)) violations.push(`${where}: a command source needs list and show with the slot <file>`);
            if (source.kind === 'package' && (path.isAbsolute(source.root) || source.root.split('/').includes('..'))) violations.push(`${where}: the package root leaves the project`);
            if (source.kind === 'git' && !String(source.repo).startsWith('https://')) violations.push(`${where}: a git source must be https`);
            if (source.kind !== 'git' && JSON.stringify(source).includes('{version}')) violations.push(`${where}: {version} belongs to the ref of a git source`);
        }
    }
    if (scanned < 7) violations.push(`only ${scanned} pointers were looked at, expected at least 7`);
    report('BD-6', 'every documentation pointer of the catalog can be consumed', scanned, violations);
});

await group('BD-7', async () => {
    const violations = [];
    // The names are built from parts so that this file does not name what it forbids.
    const folder = new RegExp('(^|[^A-Za-z0-9])_' + 'engine\\b');
    const snapshot = 'CATALOG' + '.md';
    const roots = ['skills', 'subagents', 'data', 'src', PACKAGE_BRIDGES_DIR_NAME, 'scripts'];
    const files = roots.flatMap((root) => filesBelow(path.join(ROOT, root)))
        .filter((file) => /\.(md|ts|json|yaml|mjs|sh)$/.test(file) && !file.includes('/test-fixtures/') && !file.includes('/node_modules/'));
    for (const file of files) {
        readRepo(file).split('\n').forEach((line, index) => {
            if (folder.test(line)) violations.push(`${file}:${index + 1}: names the engine-level documentation folder`);
            if (line.includes(snapshot)) violations.push(`${file}:${index + 1}: names the catalog snapshot`);
        });
    }
    report('BD-7', 'neither the engine-level documentation nor the catalog snapshot is named in skills, subagents, data, sources, cards or scripts', files.length, violations);
});

await group('UREF-1', async () => {
    const violations = [];
    let scanned = 0;
    const { name, description, tools, text } = skillFrontmatter(`${REFERENCES_SKILL}/SKILL.md`);
    scanned++; if (name !== 'unikit-references') violations.push(`name is "${name}"`);
    scanned++; if (Buffer.byteLength(description) > MAX_DESCRIPTION_BYTES || !/^[\x00-\x7f]+$/.test(description)) violations.push('description too long or not ASCII');
    scanned++; if (!tools.includes('AskUserQuestion') || !tools.includes('Bash(curl *)')) violations.push('allowed-tools lack the question tool or curl');
    const pointers = text.split('\n').filter((line) => line.startsWith('**User questions.**'));
    scanned++; if (pointers.length !== 1 || text.indexOf(pointers[0]) > text.indexOf('\n## ')) violations.push('the user-questions pointer must be one line above the first "## " heading');
    scanned++; if (Buffer.byteLength(text) > SKILL_BYTE_CEILINGS[REFERENCES_SKILL]) violations.push(`SKILL.md is ${Buffer.byteLength(text)} bytes, above ${SKILL_BYTE_CEILINGS[REFERENCES_SKILL]}`);
    report('UREF-1', 'the references skill has the frontmatter, the question pointer and the size the plan gives it', scanned, violations);
});

await group('UREF-2', async () => {
    const violations = [];
    let scanned = 0;
    const skill = readRepo(`${REFERENCES_SKILL}/SKILL.md`);
    const format = readRepo(`${REFERENCES_SKILL}/references/index-format.md`);
    // The description is folded over several lines in the file; the phrase is checked on the unfolded text.
    scanned++; if (!skillFrontmatter(`${REFERENCES_SKILL}/SKILL.md`).description.includes('Nothing is summarised or rewritten')) violations.push('description: "Nothing is summarised or rewritten" is missing');
    for (const phrase of ['never touches `.unikit/references/bridges/`', 'never through a tool that returns a summary', 'Only on the second answer remove']) {
        scanned++; if (!skill.includes(phrase)) violations.push(`SKILL.md: "${phrase}" is missing`);
    }
    scanned++; if (!format.includes('| name | what it is for | kind | origin | updated |')) violations.push('index-format.md: the table header is missing');
    scanned++; if (!skill.includes('{{skills_dir}}/{{self_name}}/references/index-format.md')) violations.push('SKILL.md: index-format.md is not named by its full path');
    report('UREF-2', 'the wording of the references skill is in place', scanned, violations);
});

await group('UREF-4', async () => {
    const skill = readRepo(`${REFERENCES_SKILL}/SKILL.md`);
    const others = skillFiles(REFERENCES_SKILL).filter((file) => !file.endsWith('/SKILL.md')).filter((file) => readRepo(file).includes('unikit:extension-point'));
    assertEq('UREF-4', 'the bootstrap anchor stands once in SKILL.md and nowhere in references/', [skill.split(BOOTSTRAP_ANCHOR).length - 1, others], [1, []]);
});

// ── C7: Context7 reaches the executors that read documentation ───────────────

await group('C7-1', async () => {
    const violations = [];
    let scanned = 0;
    const context7 = JSON.parse(readRepo('mcp/universal/context7.json'));
    const grant = ['resolve-library-id', 'query-docs'];
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const check = (ok, message) => { scanned++; if (!ok) violations.push(message); };
    check(same(context7['allowed-tools'].skills['unikit-verify'], grant), 'unikit-verify gets the two Context7 tools');
    check(same(context7['allowed-tools'].skills['unikit-execute'], grant), 'unikit-execute gets the two Context7 tools');
    check(same(context7['allowed-tools'].agents['unikit-implement-coordinator'], grant), 'the coordinator gets the two Context7 tools');
    check(same(context7['allowed-tools'].agents['unikit-implement-worker'], grant), 'the worker gets the two Context7 tools');
    check(context7['allowed-tools'].agents['unikit-review-sidecar'] === undefined, 'the review sidecar, a reader without network, gets none');
    for (const rel of ['skills/unikit-verify/SKILL.md', 'skills/unikit-execute/SKILL.md', 'subagents/unikit-implement-worker.md', 'subagents/unikit-implement-coordinator.md']) {
        check(fs.existsSync(path.join(ROOT, rel)), `${rel} must exist to accept the grant`);
    }
    report('C7-1', 'Context7 is granted to verify, execute, the worker and the coordinator', scanned, violations);
});

// ── RG: counters that used to be literals now follow the tree ────────────────

await group('RG-1', async () => {
    const violations = [];
    let scanned = 0;
    const skills = fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join(ROOT, 'skills', entry.name, 'SKILL.md')));
    const total = skills.length;
    const designSkills = skills.filter((entry) => entry.name.startsWith('unikit-gd-')).length;
    const readme = readRepo('README.md');
    const started = readRepo('docs/getting-started.md');
    const found = (text, pattern, label) => {
        scanned++;
        const match = pattern.exec(text);
        if (!match) { violations.push(`${label}: no match for ${pattern}`); return null; }
        return match;
    };
    const badge = found(readme, /skills-(\d+)/, 'README badge');
    const all = found(readme, /All (\d+) skills - (\d+) code-pipeline \+ (\d+) game-design/, 'README table');
    const intro = found(started, /(\d+) skills \((\d+) code-pipeline \+ (\d+) game-design\)/, 'getting-started');
    if (badge && Number(badge[1]) !== total) violations.push(`README badge says ${badge[1]}, the tree has ${total}`);
    for (const [label, match] of [['README table', all], ['getting-started', intro]]) {
        if (!match) continue;
        if (Number(match[1]) !== total) violations.push(`${label} says ${match[1]} skills, the tree has ${total}`);
        if (Number(match[2]) + Number(match[3]) !== total) violations.push(`${label}: ${match[2]} + ${match[3]} is not ${total}`);
        if (Number(match[3]) !== designSkills) violations.push(`${label} says ${match[3]} game-design skills, the tree has ${designSkills}`);
    }
    const tree = found(started, /# (\d+) skills \(or fewer/, 'getting-started tree');
    if (tree && Number(tree[1]) !== total) violations.push(`the getting-started tree comment says ${tree[1]}, the tree has ${total}`);
    report('RG-1', 'the skill counters of README and getting-started follow the skills directory', scanned, violations);
});

await group('RG-2', async () => {
    const registry = JSON.parse(readRepo('data/extension-points.json'));
    const withoutAnchor = ['unikit-help', 'unikit-skills-context'];
    const total = fs.readdirSync(path.join(ROOT, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && fs.existsSync(path.join(ROOT, 'skills', entry.name, 'SKILL.md'))).length;
    assertEq('RG-2', 'every skill has an extension anchor except the two that deliberately have none',
        [Object.keys(registry.skills).length + withoutAnchor.length, withoutAnchor.some((name) => registry.skills[name] !== undefined)], [total, false]);
});

// ── BR-10e: the value of the `Editor tasks` setting is spelled the 3.0.0 way by everyone who writes or reads it ──
//
// The planner writes `engine-bridge`; the executors and verify read it (and read the 2.x `mcp` as the same
// value, by saying so once). A reader that lists `mcp` as THE value would send a 3.0.0 plan down the
// "unknown setting" path, and nothing else in the suite would notice.

await group('BR-10e', async () => {
    const owners = [
        'skills/unikit-implement/SKILL.md', 'skills/unikit-verify/SKILL.md', 'skills/unikit-plan/SKILL.md',
        'skills/unikit-plan/references/mode-fast.md', 'skills/unikit-plan/references/mode-full.md',
        'skills/unikit-plan/references/ultra-stateful.md', 'skills/unikit-plan/references/TASK-FORMAT.md',
    ];
    const violations = [];
    for (const rel of owners) {
        const text = readRepo(rel);
        if (!/Editor tasks:\s*`?<?engine-bridge/.test(text)) violations.push(`${rel}: does not spell the value engine-bridge`);
        if (/Editor tasks:\s*`?<?mcp\b/.test(text)) violations.push(`${rel}: still lists mcp as the value of Editor tasks`);
    }
    report('BR-10e', 'every text that writes or reads the Editor tasks setting spells the 3.0.0 value', owners.length, violations);
});

// ── BR-14: the version of an MCP bridge is read from the settings files of the project ──

await group('BR-14', async () => {
    const { parseMcpServerEntry } = await dist('core/mcp-schema.js');
    const { mcpSettingsFiles } = await dist('core/agents.js');
    const { renderBridgesManifest } = await dist('core/bridges/manifest.js');
    const before = passed;
    const base = { key: 'm', code: 'm-code', displayName: 'M', is_engine: true, config: { command: 'x' } };
    const parsed = (patch, extra = base) => captureWarnings(() => parseMcpServerEntry({ ...extra, ...patch }, '.', 'm.json'));

    const good = parsed({ versionProbe: { in: 'args', pattern: '@v(\\d+)' } });
    assertEq('BR-14', 'a version probe with one capture group is kept, with no warning',
        [good.result?.versionProbe, good.lines.length], [{ in: 'args', pattern: '@v(\\d+)' }, 0]);
    for (const [label, versionProbe] of [
        ['a pattern with no group', { in: 'args', pattern: '@v\\d+' }],
        ['a pattern with two groups', { in: 'args', pattern: '(a)(b)' }],
        ['a pattern that does not compile', { in: 'args', pattern: '(' }],
        ['a field that is not args', { in: 'env', pattern: '(a)' }],
        ['a value that is not an object', 'args'],
    ]) {
        const bad = parsed({ versionProbe });
        assertEq('BR-14', `${label} is dropped with one warning, the entry survives`,
            [bad.result?.versionProbe, bad.lines.length, bad.result === null], [undefined, 1, false]);
    }
    const cliEntry = { key: 'c', code: 'c', displayName: 'C', is_engine: true, kind: 'cli', cli: { binary: 'tool', projectFlag: '--project-path', forms: { call: 'tool command --project-path "<p>"' } } };
    const onCli = parsed({ versionProbe: { in: 'args', pattern: '(a)' } }, cliEntry);
    assertEq('BR-14', 'a version probe on a command-line bridge is ignored with a warning', [onCli.result?.versionProbe, onCli.lines.length], [undefined, 1]);

    assertEq('BR-14', 'the settings files are those of the agents with MCP, each once, in the order of the agents; an unknown id is skipped',
        mcpSettingsFiles(['claude', 'universal', 'cursor', 'codex', 'nope']), ['.mcp.json', '.cursor/mcp.json', '.codex/config.toml']);
    assertEq('BR-14', 'no agent, no settings file', mcpSettingsFiles([]), []);

    const entry = parsed({ versionProbe: { in: 'args', pattern: '@v(\\d[^#\\s]*)' } }).result;
    const rendered = (settingsFiles) => renderBridgesManifest({
        engineId: 'unity', bridges: [{ fileId: 'm', entry: { ...entry, originDir: 'unity' }, hasRulesTree: false }], unselected: [], settingsFiles,
    });
    const versionRow = (text) => text.split('\n').find(line => line.startsWith('| probe version | ')) ?? '';
    const row = versionRow(rendered(['.mcp.json', '.cursor/mcp.json']));
    assertEq('BR-14', 'an MCP block with a version probe reads the version from the settings files of the project',
        [row.includes('the entry `m-code`'), row.includes('(`.mcp.json`, `.cursor/mcp.json`)'), row.includes('@v(\\d[^#\\s]*)'), row.includes('{{ VERSION }}')], [true, true, true, true]);
    assertEq('BR-14', 'without settings files the row says none', versionRow(rendered([])).includes('(none)'), true);
    assertEq('BR-14', 'an MCP block without a version probe has no such row',
        versionRow(renderBridgesManifest({ engineId: 'unity', bridges: [{ fileId: 'm', entry: { ...parsed({}).result, originDir: 'unity' }, hasRulesTree: false }], unselected: [], settingsFiles: ['.mcp.json'] })), '');

    const biomeCard = JSON.parse(readRepo('engine-bridges/unity/unity-biome-mcp.json'));
    const probePattern = new RegExp(biomeCard.versionProbe.pattern);
    assertEq('BR-14', 'the Biome pattern finds the pinned version and skips the placeholder',
        [probePattern.exec('git+https://github.com/german-krasnikov/unity-biome-mcp.git@v2.1.0#subdirectory=server')?.[1], probePattern.exec('git+https://x.git@v{{ VERSION }}#subdirectory=server')], ['2.1.0', null]);
    const withToken = [];
    for (const file of filesBelow(path.join(ROOT, PACKAGE_BRIDGES_DIR_NAME)).filter((rel) => rel.endsWith('.json') && !rel.includes('/rules/'))) {
        const card = JSON.parse(readRepo(file));
        for (const source of card.docs?.sources ?? []) {
            if (String(source.ref ?? '').includes('{version}')) withToken.push([source.kind, Boolean(card.versionProbe || card.cli?.forms?.version)]);
        }
    }
    assertEq('BR-14', 'a {version} token stands only in the ref of a git source of a bridge that can tell its version',
        [withToken.length > 0, withToken.every(([kind, canTell]) => kind === 'git' && canTell)], [true, true]);
    assertEq('BR-14', 'the Biome docs are taken by the version tag and leave out the generated quality reports',
        [biomeCard.docs.sources.every(source => source.ref === 'v{version}'), biomeCard.docs.sources.find(source => source.id === 'docs').exclude.includes('quality/**')], [true, true]);

    report('BR-14', 'version probe checks ran', passed - before, []);
});

// ── BR-15: the stamp of a delivered rules file ───────────────────────────────

await group('BR-15', async () => {
    const { stampDeliveredMarkdown } = await dist('core/bridges/stamp.js');
    const before = passed;
    const table = '| field | value |\n|---|---|\n| bridge | b |\n';
    const comments = (text) => (text.match(/^<!-- .* -->$/gm) ?? []).length;

    const withTitle = stampDeliveredMarkdown('b', '# Title\n\nbody line\n');
    assertEq('BR-15', 'the stamp table sits right under the first heading, the title stays first',
        [withTitle.startsWith(`# Title\n\n${table}\n<!--`), withTitle.endsWith('\nbody line\n'), comments(withTitle)], [true, true, 3]);
    assertEq('BR-15', 'the comment says where to fix the file', withTitle.includes('not here'), true);

    const level2 = stampDeliveredMarkdown('b', '## Gate calibration\n\n| gate | reachable |\n|---|---|\n| a | yes |\n');
    assertEq('BR-15', 'a file that starts with a level-2 heading is stamped under it, with one blank line before its own table',
        [level2.startsWith(`## Gate calibration\n\n${table}\n<!--`), level2.includes('-->\n\n| gate | reachable |\n'), /\n\n\n/.test(level2)], [true, true, false]);

    const noHeading = stampDeliveredMarkdown('b', 'only a sentence');
    assertEq('BR-15', 'a file with no heading gets the stamp on top', [noHeading.startsWith(table), noHeading.endsWith('\n\nonly a sentence\n')], [true, true]);

    const fenced = stampDeliveredMarkdown('b', '```bash\n# not a heading\n```\n\n# Real\n\nbody');
    assertEq('BR-15', 'a hash line inside a fenced block is not the heading', fenced.startsWith('```bash\n# not a heading\n```\n\n# Real\n\n| field | value |'), true);

    const headingOnly = stampDeliveredMarkdown('b', '# Title');
    assertEq('BR-15', 'a heading alone: the stamp follows and the text ends in one newline',
        [headingOnly.startsWith(`# Title\n\n${table}`), headingOnly.endsWith('-->\n') && !headingOnly.endsWith('\n\n')], [true, true]);

    assertEq('BR-15', 'surrounding whitespace is trimmed and the result is stable',
        [stampDeliveredMarkdown('b', '\n\n# T\n\nx\n\n\n') === stampDeliveredMarkdown('b', '# T\n\nx'), stampDeliveredMarkdown('b', '# T\n\nx') === stampDeliveredMarkdown('b', '# T\n\nx')], [true, true]);
    assertEq('BR-15', 'the bridge id is the only thing that differs between two bridges',
        stampDeliveredMarkdown('a-b', '# T\n\nx').replace('a-b', 'c-d'), stampDeliveredMarkdown('c-d', '# T\n\nx'));

    report('BR-15', 'stamp checks ran', passed - before, []);
});

// ── SP: the search procedure of the executors (D2, D3, D6, D8) and what they report ──

const DEV_PRINCIPLES = 'data/dev-principles.md';
const sectionOf = (text, from, to) => {
    const start = text.indexOf(from);
    const end = text.indexOf(to, start + from.length);
    return start < 0 ? '' : text.slice(start, end < 0 ? text.length : end);
};

await group('SP-1', async () => {
    const d6 = sectionOf(readRepo(DEV_PRINCIPLES), '### D6. ', '### D7. ');
    const violations = [];
    const phrases = [
        'from the narrow to the wide', 'the `catalog search` row', 'the `catalog tags` row', 'the `catalog tag` row', 'the `catalog groups` row', 'the `catalog group` row',
        'a value that is not in the list answers with an empty result and no error', 'The whole catalog is never read.',
        'INFO [bridge-search]', 'WARN [bridge-search]', 'Ask the bridge for the schema', 'always, whatever the documentation says', 'take the next bridge by D3',
    ];
    for (const phrase of phrases) if (!d6.includes(phrase)) violations.push(`D6: "${phrase}" is missing`);
    const order = ['the `catalog search` row', 'the `catalog tags` row', 'the `catalog groups` row'].map((phrase) => d6.indexOf(phrase));
    if (!(order[0] >= 0 && order[0] < order[1] && order[1] < order[2])) violations.push('D6: the steps are not in the order word, tags, groups');
    report('SP-1', 'D6 searches the live catalog from the narrow to the wide, takes tag and group values from the listing and asks for the schema always', phrases.length + 1, violations);
});

await group('SP-2', async () => {
    const text = readRepo(DEV_PRINCIPLES);
    const d8 = text.slice(text.indexOf('### D8. '));
    const violations = [];
    const phrases = ['`FILES.md`', 'The version check', 'Docs: <bridge> - current', 'none collected', 'A copy older than the installed versions is **still used**',
        'The section about the command you chose', 'its `context7` row', 'Only a reader granted that server reaches for it', 'Reference: trigger <1|2>'];
    for (const phrase of phrases) if (!d8.includes(phrase)) violations.push(`D8: "${phrase}" is missing`);
    const gone = ['INFO [reference]', 'table of contents', 'CATALOG', 'hint, never a guarantee', '`ready:`', '_' + 'engine'];
    for (const phrase of gone) if (text.includes(phrase)) violations.push(`dev-principles.md still has "${phrase}"`);
    report('SP-2', 'D8 checks the version once per session and reads the section about the chosen command; the catalog table of contents is gone from the file', phrases.length + gone.length, violations);
});

await group('SP-3', async () => {
    const violations = [];
    let scanned = 0;
    const has = (rel, phrase, expected = true) => {
        scanned++;
        if (readRepo(rel).includes(phrase) !== expected) violations.push(`${rel}: "${phrase}" ${expected ? 'is missing' : 'must not be there'}`);
    };
    has('subagents/unikit-implement-worker.md', '- `search:` — the `INFO [bridge-search]` selection lines');
    has('subagents/unikit-implement-coordinator.md', 'Bridge search:');
    has('skills/unikit-implement/SKILL.md', 'D6 step 2');
    has('skills/unikit-fix/SKILL.md', 'D6 step 2');
    for (const rel of ['skills/unikit-implement/SKILL.md', 'skills/unikit-fix/SKILL.md', 'skills/unikit-verify/SKILL.md']) has(rel, 'from the narrow to the wide', false);
    report('SP-3', 'the executors point at D6 for the chosen command, the worker and the coordinator report the selection lines, nobody restates the search order', scanned, violations);
});

await group('SP-4', async () => {
    const { renderBridgesManifest } = await dist('core/bridges/manifest.js');
    const { orderBridges } = await dist('core/bridges/selection.js');
    const { discoverMcpServers } = await dist('core/mcp.js');
    const discovered = await discoverMcpServers('unity');
    const manifest = renderBridgesManifest({
        engineId: 'unity',
        bridges: orderBridges(discovered, ['unity-cli', 'unity-biome-mcp']).map(({ fileId, entry }) => ({ fileId, entry, hasRulesTree: true })),
        unselected: [],
        settingsFiles: ['.mcp.json'],
    });
    const printed = new Set([...manifest.matchAll(/^\| ([a-z][a-z0-9 ]*) \| /gm)].map((match) => match[1]));
    const named = [...readRepo(DEV_PRINCIPLES).matchAll(/`([a-z][a-z0-9 ]*)` rows?\b/g)].map((match) => match[1]);
    const violations = [...new Set(named)].filter((label) => !printed.has(label)).map((label) => `dev-principles.md names the row "${label}", BRIDGES.md prints no such row`);
    if (named.length < 8) violations.push(`only ${named.length} row names were found in dev-principles.md, expected at least 8`);
    report('SP-4', 'every row of BRIDGES.md that dev-principles.md names is printed', named.length, violations);
});

// (groups of later tasks are appended above this line, each under its own banner)

console.log(`\nEngine bridge guards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
