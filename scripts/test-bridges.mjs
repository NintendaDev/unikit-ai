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

// (groups of later tasks are appended above this line, each under its own banner)

console.log(`\nEngine bridge guards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
