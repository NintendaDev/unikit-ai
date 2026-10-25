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

// (groups of later tasks are appended above this line, each under its own banner)

console.log(`\nEngine bridge guards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
