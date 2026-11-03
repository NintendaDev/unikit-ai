// Guards for the order file of the engine bridges: BO-* (`.unikit/bridges.yaml`: parse, render, the decision
// table, the installer on the real catalog, the call sites).
// Consumed from scripts/test-skills.sh (Part 7e6). Imports the compiled build because tests run after
// `ensure_build` in the parent harness. Writes nothing into the repository: every project is a temporary directory.
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

const MIN_PARSE_CASES = 14;
const MIN_DECISION_CASES = 13;
const MAX_INSTALLER_LINES = 150;
const PAST = new Date(2020, 0, 1);

const CLI = 'unity-cli';
const BIO = 'unity-biome-mcp';
const COP = 'coplay-unity-mcp';

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

function tempProject(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ── BO-1: parsing ────────────────────────────────────────────────────────────

await group('BO-1', async () => {
    const { parseBridgeOrder } = await dist('core/bridges/order-file.js');
    const cases = [
        ['block list', 'order:\n  - a\n  - b\n', ['a', 'b']],
        ['flow list', 'order: [a, b]\n', ['a', 'b']],
        ['quoted block items', 'order:\n  - "a"\n  - \'b\'\n', ['a', 'b']],
        ['quoted flow items', 'order: ["a", \'b\']\n', ['a', 'b']],
        ['comments on their own lines and blank lines', '# head\norder:\n  # note\n  - a\n\n  - b\n', ['a', 'b']],
        ['comment after a block item', 'order:\n  - a # first\n  - b\n', ['a', 'b']],
        ['comment after a flow list', 'order: [a, b] # note\n', ['a', 'b']],
        ['CRLF', 'order:\r\n  - a\r\n  - b\r\n', ['a', 'b']],
        ['BOM', '﻿order:\n  - a\n', ['a']],
        ['a repeated id keeps its first place', 'order: [a, b, a]\n', ['a', 'b']],
        ['empty flow list', 'order: []\n', []],
        ['key with no items', 'order:\n', []],
        ['items at the left edge', 'order:\n- a\n- b\n', ['a', 'b']],
        ['ids with dashes, dots and underscores', 'order:\n  - unity-cli\n  - x.y_z\n', ['unity-cli', 'x.y_z']],
        ['empty text', '', null],
        ['not an order file', 'hello\n', null],
        ['key without a colon', 'order\n  - a\n', null],
        ['a line that is not an item', 'order:\n  a\n', null],
        ['an id with a space', 'order:\n  - a b\n', null],
        ['an id that is a path', 'order:\n  - /x\n', null],
        ['a key after a flow list', 'order: [a]\nother: [b]\n', null],
        ['something before the key', 'other: x\norder:\n  - a\n', null],
        ['a second key after the block list', 'order:\n  - a\nother: 1\n', null],
        ['an indented key', ' order:\n  - a\n', null],
        ['a scalar instead of a list', 'order: a\n', null],
        ['an invalid id in a flow list', 'order: [a b]\n', null],
    ];
    for (const [what, text, expected] of cases) assertEq('BO-1', what, parseBridgeOrder(text), expected);
    report('BO-1', `the parse table has at least ${MIN_PARSE_CASES} rows`, cases.length, cases.length < MIN_PARSE_CASES ? [`only ${cases.length} rows`] : []);
});

// ── BO-2: rendering ──────────────────────────────────────────────────────────

await group('BO-2', async () => {
    const { parseBridgeOrder, renderBridgeOrder } = await dist('core/bridges/order-file.js');
    const { BRIDGE_ORDER_HEADER } = await dist('core/constants-bridges.js');

    assertEq('BO-2', 'the header is four comment lines', BRIDGE_ORDER_HEADER.filter((line) => line.startsWith('# ')).length, 4);
    assertEq('BO-2', 'the header has exactly four lines', BRIDGE_ORDER_HEADER.length, 4);
    assertEq('BO-2', 'a list is the header, the key and one item per line',
        renderBridgeOrder(['a', 'b']), `${BRIDGE_ORDER_HEADER.join('\n')}\norder:\n  - a\n  - b\n`);
    assertEq('BO-2', 'an empty list is written as a flow list', renderBridgeOrder([]).includes('\norder: []\n'), true);

    const lists = [[], ['a'], ['a', 'b'], ['x-1', 'y.z']];
    for (const list of lists) {
        const text = renderBridgeOrder(list);
        assertEq('BO-2', `round trip of ${JSON.stringify(list)}`, parseBridgeOrder(text), list);
        assertEq('BO-2', `${JSON.stringify(list)} ends with one newline and holds no CR`, [text.endsWith('\n') && !text.endsWith('\n\n'), text.includes('\r')], [true, false]);
    }
});

// ── BO-3: the decision table ─────────────────────────────────────────────────

await group('BO-3', async () => {
    const { decideBridgeOrder } = await dist('core/bridges/order-file.js');
    const absent = { state: 'absent' };
    const list = (order) => ({ state: 'list', order });
    const cases = [
        ['1 no bridges, no file', [], [], absent, { action: 'none', order: [], basis: 'no-bridges' }],
        ['2 no bridges, a file: it goes', [], [BIO], list([BIO]), { action: 'delete', order: [], basis: 'no-bridges' }],
        ['3 first run: created in package order', [CLI, BIO], [], absent, { action: 'write', order: [CLI, BIO], basis: 'created' }],
        ['4 untouched file, nothing changed: kept', [CLI, BIO], [CLI, BIO], list([CLI, BIO]), { action: 'keep', order: [CLI, BIO], basis: 'package' }],
        ['5 untouched file, a bridge added: package order', [CLI, BIO, COP], [CLI, BIO], list([CLI, BIO]), { action: 'write', order: [CLI, BIO, COP], basis: 'package' }],
        ['6 untouched file, a bridge added by weight', [CLI, BIO], [BIO], list([BIO]), { action: 'write', order: [CLI, BIO], basis: 'package' }],
        ['7 edited file, a bridge added: at the end', [CLI, BIO, COP], [CLI, BIO], list([BIO, CLI]), { action: 'write', order: [BIO, CLI, COP], basis: 'yours' }],
        ['8 edited file, nothing changed: kept', [CLI, BIO], [CLI, BIO], list([BIO, CLI]), { action: 'keep', order: [BIO, CLI], basis: 'yours' }],
        ['9 edited file, a bridge dropped', [BIO, COP], [CLI, BIO, COP], list([COP, CLI, BIO]), { action: 'write', order: [COP, BIO], basis: 'yours' }],
        ['10 an emptied file counts as edited', [CLI, BIO], [CLI, BIO], list([]), { action: 'write', order: [CLI, BIO], basis: 'yours' }],
        ['11 a file of other bridges counts as edited', [CLI], [], list([BIO]), { action: 'write', order: [CLI], basis: 'yours' }],
        ['12 unreadable file: left alone', [CLI, BIO], [CLI, BIO], { state: 'unreadable' }, { action: 'keep', order: [], basis: 'unreadable' }],
        ['13 untouched file, a bridge dropped', [CLI], [CLI, BIO], list([CLI, BIO]), { action: 'write', order: [CLI], basis: 'package' }],
    ];
    for (const [what, autoNow, autoPrev, file, expected] of cases) {
        assertEq('BO-3', what, decideBridgeOrder({ autoNow, autoPrev, file }), expected);
    }
    report('BO-3', `the decision table has ${MIN_DECISION_CASES} cases`, cases.length, cases.length < MIN_DECISION_CASES ? [`only ${cases.length} cases`] : []);
});

// ── BO-4: the installer on the real catalog ──────────────────────────────────

await group('BO-4', async () => {
    const { discoverMcpServers } = await dist('core/mcp.js');
    const { syncBridgeOrder } = await dist('core/installer/bridge-order.js');
    const { parseBridgeOrder } = await dist('core/bridges/order-file.js');
    const { bridgeOrderPath } = await dist('core/constants-bridges.js');

    const discovered = await discoverMcpServers('unity');
    report('BO-4', 'the real unity catalog holds the three bridges the cases use', [CLI, BIO, COP].filter((id) => discovered.has(id)).length,
        [CLI, BIO, COP].filter((id) => !discovered.has(id)).map((id) => `the catalog has no ${id}`));

    const project = tempProject('bo-4-');
    try {
        const file = bridgeOrderPath(project);
        const read = () => (fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null);
        const order = () => (read() === null ? null : parseBridgeOrder(read()));

        await syncBridgeOrder(project, discovered, null, [BIO, CLI]);
        assertEq('BO-4', 'a) a first run creates the file in package order', order(), [CLI, BIO]);

        const created = read();
        fs.utimesSync(file, PAST, PAST);
        const unchanged = await syncBridgeOrder(project, discovered, [BIO, CLI], [BIO, CLI]);
        assertEq('BO-4', 'b) a second run with the same input keeps the bytes', read(), created);
        assertEq('BO-4', 'b) ...and does not touch the file', fs.statSync(file).mtimeMs, PAST.getTime());
        assertEq('BO-4', 'b) ...because the decision is keep', unchanged.action, 'keep');

        fs.writeFileSync(file, `order:\n  - ${BIO}\n  - ${CLI}\n`);
        await syncBridgeOrder(project, discovered, [BIO, CLI], [BIO, CLI, COP]);
        assertEq('BO-4', 'c) an edited order keeps its order and gets the new bridge at the end', order(), [BIO, CLI, COP]);

        await syncBridgeOrder(project, discovered, [BIO, CLI, COP], [BIO, COP]);
        assertEq('BO-4', 'd) a dropped bridge leaves an edited order', order(), [BIO, COP]);

        fs.writeFileSync(file, `order: [${CLI}, ${BIO}]\n`);
        const flow = read();
        await syncBridgeOrder(project, discovered, [CLI, BIO], [CLI, BIO]);
        assertEq('BO-4', 'e) an untouched flow-style file is not rewritten', read(), flow);

        await syncBridgeOrder(project, discovered, [CLI, BIO], []);
        assertEq('BO-4', 'f) no bridge selected removes the file', fs.existsSync(file), false);

        const none = await syncBridgeOrder(project, discovered, [], []);
        assertEq('BO-4', 'h) no bridge and no file creates nothing', [none.action, fs.existsSync(file)], ['none', false]);

        fs.writeFileSync(file, 'garbage');
        const garbage = await syncBridgeOrder(project, discovered, [CLI, BIO], [CLI, BIO]);
        assertEq('BO-4', 'g) an unreadable file is left as it is', read(), 'garbage');
        assertEq('BO-4', 'g) ...and reported as unreadable', garbage.basis, 'unreadable');
    } finally {
        fs.rmSync(project, { recursive: true, force: true });
    }
});

// ── BO-5: the call sites and the hash ────────────────────────────────────────

await group('BO-5', async () => {
    const violations = [];
    let scanned = 0;
    for (const rel of ['src/cli/commands/init.ts', 'src/cli/commands/update.ts']) {
        scanned++;
        const text = readRepo(rel);
        const install = text.search(/await installEngineBridges\(/);
        const sync = text.search(/await syncBridgeOrder\(/);
        if (install < 0 || sync < 0) violations.push(`${rel}: installEngineBridges( at ${install}, syncBridgeOrder( at ${sync}; both calls must be there`);
        else if (sync < install) violations.push(`${rel}: syncBridgeOrder( comes before installEngineBridges(`);
    }
    scanned++;
    if (!/await syncBridgeOrder\(projectDir, discoveredServers, previousBridges,/.test(readRepo('src/cli/commands/update.ts'))) {
        violations.push('update.ts: syncBridgeOrder must take `previousBridges`, the set read before BRIDGES.md was rewritten');
    }
    scanned++;
    const readPrevious = readRepo('src/cli/commands/update.ts').search(/await readPreviousBridgeSet\(/);
    if (readPrevious < 0 || readPrevious > readRepo('src/cli/commands/update.ts').search(/await installEngineBridges\(/)) {
        violations.push('update.ts: readPreviousBridgeSet must be read before installEngineBridges rewrites BRIDGES.md');
    }
    scanned++;
    const hashing = readRepo('src/core/installer/hashing.ts');
    for (const name of ['BRIDGE_ORDER', 'bridgeOrderPath', 'syncBridgeOrder']) {
        if (hashing.includes(name)) violations.push(`hashing.ts mentions ${name}: the order file must stay out of every hash (NFR-1)`);
    }
    scanned++;
    const lines = readRepo('src/core/installer/bridge-order.ts').split('\n').length;
    if (lines > MAX_INSTALLER_LINES) violations.push(`bridge-order.ts has ${lines} lines, more than ${MAX_INSTALLER_LINES}`);
    report('BO-5', 'the order file follows installEngineBridges, reads the previous set first and stays out of the hash', scanned, violations);
});

// (groups of later tasks are appended above this line, each under its own banner)

console.log(`\nBridge order guards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
