// Unit test: loadConfig tolerates an unknown agent id in .unikit.json.
// Run directly from scripts/test-skills.sh (Part 7f2), like test-agent-filter.mjs.
// Imports the compiled build because tests run after ensure_build in the parent.
//
// Spawns a child that calls the compiled loadConfig so the assertions cover the
// REAL process exit code (0 = the CLI does not crash) and the REAL stderr WARN,
// not just an in-process spy — the plan requires "exit 0" + "WARN on stderr"
// after dropping Gemini CLI from the agent registry.

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST = path.resolve(__dirname, '..', 'dist', 'core', 'config.js');

let passed = 0;
let failed = 0;

function fail(name, detail) {
    failed++;
    console.error(`FAIL [${name}] ${detail}`);
}

function pass(name) {
    passed++;
    console.log(`PASS [${name}]`);
}

function assert(name, cond, detail) {
    if (cond) pass(name);
    else fail(name, detail);
}

// A .unikit.json carrying a now-unknown `gemini` agent beside a known `claude`.
// Post-removal, `gemini` is no longer in AGENT_REGISTRY; loadConfig must filter
// it out (with a warning) instead of throwing through getAgentConfig.
const ghostConfig = {
    version: '1.1.0',
    engine: 'unity',
    engineMcpKey: null,
    rulesRegistry: null,
    mcp: { servers: [] },
    agents: [
        { id: 'gemini', skillsDir: '.gemini/skills', subagentsDir: '.gemini/agents', installedSkills: [], installedSubagents: [] },
        { id: 'claude', skillsDir: '.claude/skills', subagentsDir: '.claude/agents', installedSkills: ['unikit'], installedSubagents: [] },
    ],
    rules: { installed: { version: '1.1.0', modules: {} } },
};

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'config-tolerance-'));
try {
    await fs.writeFile(path.join(tmp, '.unikit.json'), JSON.stringify(ghostConfig, null, 2), 'utf-8');

    // Child prints the resolved agent ids to stdout; the tolerance WARN lands on
    // stderr via console.warn. A throw inside loadConfig would exit non-zero.
    const childSource = [
        `import { loadConfig } from ${JSON.stringify(pathToFileURL(DIST).href)};`,
        `const c = await loadConfig(${JSON.stringify(tmp)});`,
        `process.stdout.write(JSON.stringify((c?.agents ?? []).map(a => a.id)));`,
    ].join('\n');

    const res = spawnSync(process.execPath, ['--input-type=module', '-e', childSource], { encoding: 'utf-8' });

    // 1. Does not crash the CLI — the real child process exits 0.
    assert('tolerance/exit-0', res.status === 0, `child exited ${res.status}; stderr: ${res.stderr}`);

    let ids = [];
    try {
        ids = JSON.parse((res.stdout || '').trim() || '[]');
    } catch {
        // leave ids empty → the both-sides asserts below fail with stdout context
    }

    // 2. Unknown agent dropped.
    assert('tolerance/gemini-dropped', !ids.includes('gemini'), `agents still include gemini: ${res.stdout}`);

    // 3. Known agent preserved (both sides of the filter — the drop must not eat neighbors).
    assert('tolerance/claude-preserved', ids.includes('claude'), `known agent claude missing: ${res.stdout}`);

    // 4. WARN emitted on the real stderr stream, naming the dropped agent.
    assert('tolerance/warn-on-stderr', res.stderr.includes("unknown agent 'gemini'"),
        `no WARN for gemini on stderr; got: ${res.stderr}`);
} finally {
    await fs.rm(tmp, { recursive: true, force: true });
}

console.log(`\nconfig-tolerance: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
