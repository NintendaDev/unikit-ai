// Unit tests for the Kimi Code adapter: the registry entry, the subagent-type swap in skill
// text, the subagent-file adapter, the transformer hooks and the MCP writer.
// Consumed from scripts/test-skills.sh (Part 7f3). Imports the compiled build because
// tests run after `ensure_build` in the parent harness. Writes nothing into the repository
// (temporary files live under os.tmpdir()). Real sources — skills/ and subagents/ — are
// scanned WITHOUT hard-coded counts: a fixed number breaks on every legitimate edit, so the
// assertions are "the scanned set is not empty" and "no violations".

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

const { swapGeneralPurposeSubagentType: swap } = await import(dist('core/transformers/kimi-skill-text.js'));
const { toKimiAgentFile } = await import(dist('core/transformers/kimi-agent-file.js'));
const { getTransformer, getAgentOnboarding } = await import(dist('core/transformer.js'));
const { AGENT_REGISTRY } = await import(dist('core/agents.js'));
const { applyAgentFilter, readSourceForAgent } = await import(dist('core/agent-filter.js'));
const { getMcpWriter } = await import(dist('core/mcp-writers/index.js'));
const { warnOnKeptEnvEntry } = await import(dist('core/mcp-env.js'));
const { injectToolsIntoAgentFrontmatter } = await import(dist('core/mcp.js'));

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

function assertEq(name, actual, expected) {
    if (actual === expected) {
        pass(name);
    } else {
        fail(name, `\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}

function assertTrue(name, condition, detail = '') {
    if (condition) {
        pass(name);
    } else {
        fail(name, detail || 'condition is false');
    }
}

function assertContains(name, haystack, needle) {
    assertTrue(name, haystack.includes(needle), `expected substring ${JSON.stringify(needle)} in:\n  ${JSON.stringify(haystack)}`);
}

function assertNotContains(name, haystack, needle) {
    assertTrue(name, !haystack.includes(needle), `substring ${JSON.stringify(needle)} should NOT appear in:\n  ${JSON.stringify(haystack)}`);
}

const assertJsonEq = (name, actual, expected) => assertEq(name, JSON.stringify(actual), JSON.stringify(expected));

// An exception inside a group must not take the whole run down silently.
async function group(name, fn) {
    try {
        await fn();
    } catch (error) {
        fail(name, `threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
}

function captureWarn(fn) {
    const lines = [];
    const original = console.warn;
    console.warn = (...args) => { lines.push(args.join(' ')); };
    try { fn(); } finally { console.warn = original; }
    return lines;
}

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/;
const frontmatterOf = (text) => (FRONTMATTER_RE.exec(text) ?? [''])[0];
const bodyOf = (text) => text.slice(frontmatterOf(text).length);
const DISPATCH_LINE_RE = /^\s+-\s+Agent\(/m;

async function walk(dir) {
    const out = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walk(full));
        else out.push(full);
    }
    return out;
}

// ── R: the registry entry (Task 7) ──────────────────────────────────────────

await group('R', async () => {
    assertEq(
        'R1 AGENT_REGISTRY.kimi is the REQ-001 entry',
        JSON.stringify(AGENT_REGISTRY.kimi),
        JSON.stringify({
            id: 'kimi',
            displayName: 'Kimi Code',
            configDir: '.kimi-code',
            skillsDir: '.kimi-code/skills',
            subagentsDir: '.kimi-code/agents',
            settingsFile: '.kimi-code/mcp.json',
            supportsMcp: true,
            supportsSubagents: true,
            skillsCliAgent: 'kimi-code-cli',
            isStable: false,
        }),
    );

    const src = 'a\n<!-- unikit:agents claude -->\nC\n<!-- unikit:end -->\n<!-- unikit:agents !claude -->\nN\n<!-- unikit:end -->\n<!-- unikit:agents codex -->\nX\n<!-- unikit:end -->\nz\n';
    assertEq('R2 agent filter for kimi keeps !claude, drops claude and codex', applyAgentFilter(src, 'kimi'), 'a\nN\nz\n');

    const kimi = AGENT_REGISTRY.kimi;
    const touchesAgentsDir = [kimi.configDir, kimi.skillsDir, kimi.subagentsDir, kimi.settingsFile].some((p) => p.startsWith('.agents'));
    assertTrue('R3a no Kimi path lives in the shared .agents/ (ADR-0001)', !touchesAgentsDir);
    assertTrue('R3b Kimi configDir differs from Antigravity configDir', kimi.configDir !== AGENT_REGISTRY.antigravity.configDir);
});

// ── S: subagent type swap in skill text (Task 2) ────────────────────────────

await group('S-table', async () => {
    const S1 = [
        ['S1a', 'subagent_type: "general-purpose",', 'subagent_type: "coder",'],
        ['S1b', 'Agent(subagent_type: general-purpose, model: sonnet, prompt: "x")', 'Agent(subagent_type: coder, model: sonnet, prompt: "x")'],
        ['S1c', 'expands to an `Agent(subagent_type: "general-purpose", ...)` invocation', 'expands to an `Agent(subagent_type: "coder", ...)` invocation'],
        ['S1d', '`general-purpose` and not `Explore`', '`coder` and not `Explore`'],
    ];
    for (const [id, input, expected] of S1) {
        assertEq(`${id} swaps the type`, swap(input), expected);
        assertEq(`${id} is idempotent`, swap(swap(input)), swap(input));
    }

    const untouched = [
        ['S2a the bare English word', 'a general-purpose helper'],
        ['S2b1 a longer identifier (suffix X)', 'subagent_type: general-purposeX'],
        ['S2b2 a longer identifier (hyphen suffix)', 'subagent_type: general-purpose-agent'],
        ['S2c Explore is not changed (DEC-009)', 'subagent_type: "Explore"'],
    ];
    for (const [id, input] of untouched) {
        assertEq(id, swap(input), input);
    }
    assertEq('S2d single quotes', swap("subagent_type: 'general-purpose'"), "subagent_type: 'coder'");
    assertEq('S3b empty string', swap(''), '');
});

await group('S4', async () => {
    const SPELLING = /subagent_type:\s*["']?general-purpose(?![\w-])|`general-purpose`/;
    const files = (await walk(path.join(ROOT, 'skills'))).filter((f) => f.endsWith('.md')).sort();
    let before = 0;
    const violations = [];

    for (const file of files) {
        const isSkillBody = path.basename(file) === 'SKILL.md' && path.dirname(path.dirname(file)) === path.join(ROOT, 'skills');
        // A SKILL.md reaches the transformer AFTER the agent filter; a reference is copied raw.
        const text = isSkillBody ? await readSourceForAgent(file, 'kimi') : await fs.readFile(file, 'utf8');
        if (text === null) continue;
        before += text.split('\n').filter((line) => SPELLING.test(line)).length;
        const after = swap(text);
        if (after.split('\n').some((line) => SPELLING.test(line))) {
            violations.push(path.relative(ROOT, file));
        }
    }

    assertTrue('S4a real skills carry something to rewrite (the scan is not empty)', before > 0, `matching lines before the swap: ${before}`);
    assertTrue('S4b no handled spelling survives the swap in any real skill file', violations.length === 0, `left in: ${violations.join(', ')}`);
});

await group('S5', async () => {
    const sample = 'subagent_type: "general-purpose" and `general-purpose`';
    for (const id of ['claude', 'codex', 'cursor', 'qwen', 'opencode', 'antigravity']) {
        assertEq(`S5 ${id} leaves general-purpose alone`, getTransformer(id).transform('x', sample).content, sample);
    }
});

// ── A: the subagent-file adapter (Task 3) ───────────────────────────────────

const COORD = [
    '---',
    'name: demo-coordinator',
    'description: "Demo. Use via `claude --agent demo-coordinator`."',
    'tools:',
    '  - Agent(demo-worker, demo-sidecar)',
    '  - Read',
    '  - Bash',
    'model: inherit',
    'maxTurns: 40',
    'skills:',
    '  - demo-skill',
    '---',
    '',
    'You are the demo coordinator.',
    '',
    'CRITICAL: run via `claude --agent demo-coordinator`.',
    '',
    'Agent(demo-worker): "Execute Phase 1"',
    '',
].join('\n');

const COORD_EXPECTED = [
    '---',
    'name: demo-coordinator',
    'description: "Demo. Use via `kimi --agent demo-coordinator`."',
    'tools:',
    '  - Agent',
    '  - Read',
    '  - Bash',
    'subagents:',
    '  - demo-worker',
    '  - demo-sidecar',
    'model: inherit',
    'maxTurns: 40',
    'skills:',
    '  - demo-skill',
    '---',
    '${base_prompt}',
    '',
    'You are the demo coordinator.',
    '',
    'CRITICAL: run via `kimi --agent demo-coordinator`.',
    '',
    'Agent(demo-worker): "Execute Phase 1"',
    '',
].join('\n');

const WORKER = [
    '---',
    'name: demo-worker',
    'description: "Demo worker."',
    'tools:',
    '  - Read',
    '  - Bash',
    'model: inherit',
    '---',
    '',
    'You are the demo worker.',
    '',
].join('\n');

await group('A-table', async () => {
    assertEq('A1 coordinator is rewritten as specified, byte for byte', toKimiAgentFile(COORD), COORD_EXPECTED);
    assertEq('A2 a file without Agent(...) is returned unchanged', toKimiAgentFile(WORKER), WORKER);

    const empty = toKimiAgentFile('---\nname: c\ntools:\n  - Agent()\n  - Read\n---\n\nbody\n');
    assertContains('A3a empty Agent() becomes plain Agent', empty, '\n  - Agent\n');
    assertNotContains('A3b no subagents: field for an empty list', empty, 'subagents:');
    assertContains('A3c the coordinator still gets ${base_prompt}', empty, '${base_prompt}');

    const once = toKimiAgentFile(COORD);
    assertEq('A4a idempotent', toKimiAgentFile(once), once);
    assertEq('A4b ${base_prompt} appears once', once.split('${base_prompt}').length - 1, 1);
    assertEq('A4c subagents: appears once', (once.match(/^subagents:/gm) ?? []).length, 1);

    const noFront = 'plain text\nrun via `claude --agent x`\n';
    assertEq('A5 text without frontmatter is returned unchanged', toKimiAgentFile(noFront), noFront);

    const noLeadingBlank = toKimiAgentFile('---\nname: c\ntools:\n  - Agent(a)\n---\nbody\n');
    assertTrue(
        'A1b a body that starts right after the frontmatter still gets a blank line after ${base_prompt}',
        noLeadingBlank.endsWith('---\n${base_prompt}\n\nbody\n'),
        JSON.stringify(noLeadingBlank),
    );
});

await group('A6-A7', async () => {
    const dir = path.join(ROOT, 'subagents');
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md')).sort();
    const withDispatch = [];
    const withBasePrompt = [];

    for (const file of files) {
        const src = await fs.readFile(path.join(dir, file), 'utf8');
        const out = toKimiAgentFile(src);
        const name = file.replace(/\.md$/, '');
        const hasDispatch = DISPATCH_LINE_RE.test(frontmatterOf(src));
        const firstBodyLine = bodyOf(out).split('\n').find((line) => line.trim() !== '');
        const isCoordinatorOut = firstBodyLine === '${base_prompt}';
        if (hasDispatch) withDispatch.push(name);
        if (isCoordinatorOut) withBasePrompt.push(name);

        assertTrue(`A6 ${name}: no Agent(...) entry left in tools:`, !DISPATCH_LINE_RE.test(frontmatterOf(out)));
        assertTrue(`A6 ${name}: no claude --agent left`, !out.includes('claude --agent'));
        assertEq(`A6 ${name}: idempotent`, toKimiAgentFile(out), out);

        if (hasDispatch) {
            const wanted = (/^\s+-\s+Agent\(([^)]*)\)/m.exec(frontmatterOf(src))?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
            const block = /^subagents:\n((?:\s+-\s+.*\n)+)/m.exec(frontmatterOf(out))?.[1] ?? '';
            const got = block.split('\n').map((l) => l.replace(/^\s+-\s+/, '').trim()).filter(Boolean);
            assertJsonEq(`A6 ${name}: subagents: lists exactly the names of the source entry`, got, wanted);
        } else {
            assertEq(`A6 ${name}: a non-coordinator is changed only by the launch rewrite (none here)`, out, src.split('claude --agent').join('kimi --agent'));
        }

        const bodyDispatch = (text) => (bodyOf(text).match(/^Agent\(/gm) ?? []).length;
        assertEq(`A7 ${name}: illustrative Agent( lines in the body are untouched`, bodyDispatch(out), bodyDispatch(src));
    }

    assertTrue('A6 the set of files with a dispatch entry is not empty', withDispatch.length > 0);
    assertJsonEq('A6 files with a dispatch entry == files that got ${base_prompt}', withBasePrompt, withDispatch);
    assertTrue(
        'A6 both named coordinators are in the set (DEC-016)',
        withDispatch.includes('unikit-implement-coordinator') && withDispatch.includes('unikit-plan-coordinator'),
        `set: ${withDispatch.join(', ')}`,
    );
});

await group('A8', async () => {
    const src = await fs.readFile(path.join(ROOT, 'subagents', 'unikit-implement-coordinator.md'), 'utf8');
    const out = toKimiAgentFile(src);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kimi-a8-'));
    try {
        const tmp = path.join(dir, 'unikit-implement-coordinator.md');
        await fs.writeFile(tmp, out, 'utf8');

        assertEq('A8a first MCP injection reports a change', await injectToolsIntoAgentFrontmatter(tmp, ['mcp__demo__*']), true);
        const head = frontmatterOf(await fs.readFile(tmp, 'utf8'));
        assertContains('A8b the grant landed in tools:', head, '  - mcp__demo__*\n');
        assertContains('A8c the plain Agent entry survived', head, '  - Agent\n');
        assertEq('A8d subagents: still appears once', (head.match(/^subagents:/gm) ?? []).length, 1);
        const wanted = (/^\s+-\s+Agent\(([^)]*)\)/m.exec(frontmatterOf(src))?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        assertTrue('A8e every subagent name is still listed', wanted.length > 0 && wanted.every((n) => head.includes(`  - ${n}\n`)), `wanted: ${wanted.join(', ')}`);
        assertTrue('A8f the grant sits inside the tools: block, before subagents:', head.indexOf('mcp__demo__*') < head.indexOf('subagents:'));
        assertEq('A8g a second injection reports no change', await injectToolsIntoAgentFrontmatter(tmp, ['mcp__demo__*']), false);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

// ── T: transformer API and hooks (Task 4) ───────────────────────────────────

await group('T', async () => {
    const t = getTransformer('kimi');
    assertJsonEq(
        'T1a transform of an empty skill keeps the shape (hashing and removal call it this way)',
        t.transform('unikit-plan', ''),
        { targetDir: 'unikit-plan', targetName: 'SKILL.md', content: '', flat: false },
    );
    assertEq('T1b transformReference is defined', typeof t.transformReference, 'function');
    assertEq('T1c transformSubagent is defined', typeof t.transformSubagent, 'function');

    const onboarding = getAgentOnboarding('kimi');
    assertTrue('T1d the welcome message has at least 3 lines', Array.isArray(onboarding.welcomeMessage) && onboarding.welcomeMessage.length >= 3);
    assertTrue('T1e the welcome message tells the user to trust the folder (REQ-005)', onboarding.welcomeMessage.some((line) => /trust/i.test(line)));
    assertTrue('T1f the invocation hint names /unikit-plan', typeof onboarding.invocationHint === 'string' && onboarding.invocationHint.includes('/unikit-plan'));

    for (const id of ['claude', 'codex', 'cursor', 'qwen', 'opencode', 'antigravity']) {
        assertEq(`T2 ${id} has no transformSubagent`, getTransformer(id).transformSubagent, undefined);
    }
});

// ── W: the MCP writer (Task 1) ──────────────────────────────────────────────

const URL_VALUE = 'https://x.test/mcp';
const entry = (extra = {}) => ({ type: 'http', url: URL_VALUE, ...extra });
const put = (config) => {
    const w = getMcpWriter('kimi');
    const s = {};
    w.upsert(s, 'github', config);
    return { w, s, e: s.mcpServers.github };
};

await group('W', async () => {
    {
        const { e } = put(entry({ headers: { Authorization: 'Bearer {{env:GITHUB_PAT}}' } }));
        assertJsonEq('W1 Authorization Bearer {{env:X}} becomes bearerTokenEnvVar, type and headers are gone', e, { url: URL_VALUE, bearerTokenEnvVar: 'GITHUB_PAT' });
    }
    {
        const { e } = put(entry({ headers: { 'X-Api-Version': '1', Authorization: 'Bearer {{env:T}}' } }));
        assertJsonEq('W2a other static headers stay', e.headers, { 'X-Api-Version': '1' });
        assertEq('W2b the bearer variable is still extracted', e.bearerTokenEnvVar, 'T');
    }
    {
        let e;
        const warnings = captureWarn(() => { ({ e } = put(entry({ headers: { 'X-Key': '{{env:K}}' } }))); });
        assertTrue('W3a a whole-value env header is dropped', e.headers === undefined && e.bearerTokenEnvVar === undefined, JSON.stringify(e));
        assertTrue('W3b ... with a warning naming the header and the reason', warnings.some((w) => w.includes('X-Key') && w.includes('whole-value')), warnings.join(' | '));
        assertTrue('W3c ... and never the variable name next to the header value', warnings.every((w) => !w.includes('{{env:K}}')));
    }
    {
        let e;
        const warnings = captureWarn(() => { ({ e } = put(entry({ headers: { 'X-A': 'pre-{{env:K}}' } }))); });
        assertTrue('W4a a mixed text-and-reference header is dropped', e.headers === undefined, JSON.stringify(e));
        assertTrue('W4b ... with a warning that says it mixes text', warnings.some((w) => w.includes('mixes text')), warnings.join(' | '));
    }
    {
        const stdio = { command: 'npx', args: ['-y', 'pkg'], env: { A: '1' }, _comment: 'hint' };
        const { e } = put(stdio);
        assertJsonEq('W5 a stdio entry passes through unchanged (including _comment)', e, stdio);
    }
    {
        const { w, s } = put(entry({ headers: { Authorization: 'Bearer {{env:GITHUB_PAT}}' } }));
        const first = w.serialize(s);
        w.upsert(s, 'github', entry({ headers: { Authorization: 'Bearer {{env:GITHUB_PAT}}' } }));
        assertEq('W6a upserting the same entry twice serializes identically', w.serialize(s), first);

        const settings = { theme: 'dark', mcpServers: { other: { command: 'x' } } };
        w.upsert(settings, 'github', entry());
        assertTrue('W6b neighbouring keys survive', settings.theme === 'dark' && settings.mcpServers.other?.command === 'x' && settings.mcpServers.github !== undefined);
        assertEq('W6c findKey tolerates a case difference', w.findKey(settings, 'GitHub', new Set()), 'github');
        assertEq('W6d remove reports the removal', w.remove(settings, 'github'), true);
        assertTrue('W6e ... and only that entry went', settings.mcpServers.github === undefined && settings.mcpServers.other !== undefined);
    }
    {
        const catalog = { url: URL_VALUE, headers: { Authorization: 'Bearer {{env:GITHUB_PAT}}' } };
        const { e } = put(entry({ headers: { Authorization: 'Bearer {{env:GITHUB_PAT}}' } }));
        const quiet = captureWarn(() => warnOnKeptEnvEntry('kimi', 'github', e, catalog));
        assertEq('W7a a Kimi entry written by us passes the kept-entry check silently', quiet.length, 0);

        const loud = captureWarn(() => warnOnKeptEnvEntry('kimi', 'github', { url: 'u', headers: { Authorization: 'Bearer ghp_SECRET' } }, catalog));
        assertEq('W7b a hand-written token entry warns exactly once', loud.length, 1);
        assertTrue('W7c ... saying it does not match the catalog', loud[0]?.includes('does not match the catalog') ?? false, loud.join(' | '));
        assertTrue('W7d ... without echoing the secret', loud.every((w) => !w.includes('ghp_SECRET')));
    }
    {
        assertTrue('W8a the Kimi writer is its own instance', getMcpWriter('kimi') !== getMcpWriter('claude'));
        assertEq('W8b ... of KimiMcpWriter', getMcpWriter('kimi').constructor.name, 'KimiMcpWriter');
        const w = getMcpWriter('kimi');
        const s = { mcpServers: { github: { command: 'x' } } };
        w.mergeEnv(s, 'github', { A: '1' });
        assertJsonEq('W8c mergeEnv adds env under the JSON field name and touches nothing else', s.mcpServers.github, { command: 'x', env: { A: '1' } });
    }
});

console.log(`\nkimi-transform: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
