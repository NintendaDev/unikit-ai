// Unit tests for the Kimi Code adapter: the registry entry, the subagent-file adapter, the
// transformer hooks and the MCP writer. (Subagent types in skill text come from the agent
// profile — see test-agent-profile.mjs — not from this adapter.)
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

const { toKimiAgentFile } = await import(dist('core/transformers/kimi-agent-file.js'));
const { getTransformer, getAgentOnboarding } = await import(dist('core/transformer.js'));
const { AGENT_REGISTRY } = await import(dist('core/agents.js'));
const { applyAgentFilter, readSourceForAgent } = await import(dist('core/agent-filter.js'));
const { getMcpWriter } = await import(dist('core/mcp-writers/index.js'));
const { warnOnKeptEnvEntry } = await import(dist('core/mcp-env.js'));
const { injectToolsIntoAgentFrontmatter } = await import(dist('core/mcp.js'));
const { renderSubagent } = await import(dist('core/installer/shared.js'));

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
        'R1 AGENT_REGISTRY.kimi is the REQ-001 entry + the subagent profile',
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
            subagentProfile: { readerType: 'explore', workerType: 'coder', modelDefault: '' },
        }),
    );

    const src ='a\n<!-- unikit:agents claude -->\nC\n<!-- unikit:end -->\n<!-- unikit:agents !claude -->\nN\n<!-- unikit:end -->\n<!-- unikit:agents codex -->\nX\n<!-- unikit:end -->\nz\n';
    assertEq('R2 agent filter for kimi keeps !claude, drops claude and codex', applyAgentFilter(src, 'kimi'), 'a\nN\nz\n');

    const kimi = AGENT_REGISTRY.kimi;
    const touchesAgentsDir = [kimi.configDir, kimi.skillsDir, kimi.subagentsDir, kimi.settingsFile].some((p) => p.startsWith('.agents'));
    assertTrue('R3a no Kimi path lives in the shared .agents/ (ADR-0001)', !touchesAgentsDir);
    assertTrue('R3b Kimi configDir differs from Antigravity configDir', kimi.configDir !== AGENT_REGISTRY.antigravity.configDir);
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

// The intro line of the read list, written out on purpose: this table is the oracle, so a reworded
// constant in src/core/constants-transform.ts turns the byte-for-byte checks below red.
const KIMI_PREAMBLE = 'Before you start, Read each file below and follow it as part of your instructions. If a file cannot be read, stop and report that instead of working without it.';

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
    '---',
    '${base_prompt}',
    '',
    KIMI_PREAMBLE,
    '',
    '- .kimi-code/skills/demo-skill/SKILL.md',
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

// Test-side parsing, deliberately not shared with the adapter: the names a source file lists under
// `skills:` (block form), the read list the adapter wrote, and the first non-blank body lines.
const sourceSkillNames = (text) => {
    const block = /^skills:\n((?:\s+-\s+.*\n)+)/m.exec(frontmatterOf(text));
    return block ? block[1].split('\n').map((l) => l.replace(/^\s+-\s+/, '').trim()).filter(Boolean) : [];
};
const hasSkillsField = (text) => /^skills:/m.test(frontmatterOf(text));
const readListOf = (text) => {
    const lines = bodyOf(text).split('\n');
    const at = lines.indexOf(KIMI_PREAMBLE);
    if (at === -1 || lines[at + 1] !== '') return null;
    const list = [];
    for (let i = at + 2; i < lines.length && lines[i].startsWith('- '); i++) list.push(lines[i].slice(2));
    return list;
};
const leadingBodyLines = (text, n) => bodyOf(text).split('\n').filter((l) => l.trim() !== '').slice(0, n);
const skillPathsFor = (names, dir = '.kimi-code/skills') => names.map((n) => `${dir}/${n}/SKILL.md`);

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
    const withSkills = [];

    for (const file of files) {
        const src = await fs.readFile(path.join(dir, file), 'utf8');
        const out = toKimiAgentFile(src);
        const name = file.replace(/\.md$/, '');
        const hasDispatch = DISPATCH_LINE_RE.test(frontmatterOf(src));
        const skillNames = sourceSkillNames(src);
        const firstBodyLine = bodyOf(out).split('\n').find((line) => line.trim() !== '');
        const isCoordinatorOut = firstBodyLine === '${base_prompt}';
        if (hasDispatch) withDispatch.push(name);
        if (isCoordinatorOut) withBasePrompt.push(name);
        if (skillNames.length > 0) withSkills.push(name);

        assertTrue(`A6 ${name}: no Agent(...) entry left in tools:`, !DISPATCH_LINE_RE.test(frontmatterOf(out)));
        assertTrue(`A6 ${name}: no claude --agent left`, !out.includes('claude --agent'));
        assertEq(`A6 ${name}: idempotent`, toKimiAgentFile(out), out);

        if (hasDispatch) {
            const wanted = (/^\s+-\s+Agent\(([^)]*)\)/m.exec(frontmatterOf(src))?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
            const block = /^subagents:\n((?:\s+-\s+.*\n)+)/m.exec(frontmatterOf(out))?.[1] ?? '';
            const got = block.split('\n').map((l) => l.replace(/^\s+-\s+/, '').trim()).filter(Boolean);
            assertJsonEq(`A6 ${name}: subagents: lists exactly the names of the source entry`, got, wanted);
        } else if (skillNames.length === 0) {
            assertEq(`A6 ${name}: a non-coordinator without skills: is changed only by the launch rewrite (none here)`, out, src.split('claude --agent').join('kimi --agent'));
        }

        if (skillNames.length > 0) {
            assertTrue(`A6 ${name}: the skills: field is gone from the frontmatter`, !hasSkillsField(out));
            assertJsonEq(`A6 ${name}: the read list names exactly the source skills, in order`, readListOf(out), skillPathsFor(skillNames));
            assertJsonEq(
                `A6 ${name}: the list is the first thing in the body (behind \${base_prompt} for a coordinator)`,
                leadingBodyLines(out, hasDispatch ? 2 : 1),
                hasDispatch ? ['${base_prompt}', KIMI_PREAMBLE] : [KIMI_PREAMBLE],
            );
            const sourceTail = bodyOf(src).replace(/^\n+/, '').split('claude --agent').join('kimi --agent');
            assertTrue(`A6 ${name}: the original body text follows the list unchanged`, bodyOf(out).endsWith(sourceTail));
        }

        const bodyDispatch = (text) => (bodyOf(text).match(/^Agent\(/gm) ?? []).length;
        assertEq(`A7 ${name}: illustrative Agent( lines in the body are untouched`, bodyDispatch(out), bodyDispatch(src));
    }

    assertTrue('A6 the set of files with a dispatch entry is not empty', withDispatch.length > 0);
    assertTrue('A6 the set of files with a skills: field is not empty', withSkills.length > 0);
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

// ── A9: the skills: field becomes a read list (Kimi ignores the field) ──────

const withFrontmatter = (extra, body = '\n\nYou are a demo agent.\n') => `---\nname: demo\ntools:\n  - Read\n${extra}---${body}`;

await group('A9', async () => {
    const block = withFrontmatter('skills:\n  - s-one\n  - s-two\n');
    const outBlock = toKimiAgentFile(block);
    assertEq(
        'A9a block form: the field goes and the list opens the body, byte for byte',
        outBlock,
        `---\nname: demo\ntools:\n  - Read\n---\n\n${KIMI_PREAMBLE}\n\n- .kimi-code/skills/s-one/SKILL.md\n- .kimi-code/skills/s-two/SKILL.md\n\nYou are a demo agent.\n`,
    );

    const inline = toKimiAgentFile(withFrontmatter('skills: [s-one, "s-two"]\n'));
    assertEq('A9b inline form (with a quoted name) gives the same result as the block form', inline, outBlock);

    assertEq('A9c a file without skills: is returned unchanged', toKimiAgentFile(WORKER), WORKER);

    assertEq('A9d idempotent: the block form', toKimiAgentFile(outBlock), outBlock);
    assertEq('A9d idempotent: the inline form', toKimiAgentFile(inline), inline);
    const coordOnce = toKimiAgentFile(COORD);
    assertEq('A9d idempotent: a coordinator with skills:', toKimiAgentFile(coordOnce), coordOnce);

    assertJsonEq('A9e coordinator: ${base_prompt} first, the list right behind it', leadingBodyLines(coordOnce, 2), ['${base_prompt}', KIMI_PREAMBLE]);
    assertJsonEq('A9e worker: the list is the first thing in the body', leadingBodyLines(outBlock, 1), [KIMI_PREAMBLE]);

    // A coordinator an older adapter already turned (base prompt written, `skills:` still there)
    // must get the list BEHIND the placeholder — the placement follows the body, not the pass.
    const legacy = '---\nname: c\ntools:\n  - Agent\nsubagents:\n  - w\nskills:\n  - s-one\n---\n${base_prompt}\n\nBody\n';
    assertEq(
        'A9f a body that already opens with ${base_prompt} keeps it first',
        toKimiAgentFile(legacy),
        `---\nname: c\ntools:\n  - Agent\nsubagents:\n  - w\n---\n\${base_prompt}\n\n${KIMI_PREAMBLE}\n\n- .kimi-code/skills/s-one/SKILL.md\n\nBody\n`,
    );

    assertJsonEq('A9g a custom skillsDir is used as given', readListOf(toKimiAgentFile(block, 'custom/dir')), skillPathsFor(['s-one', 's-two'], 'custom/dir'));
    assertJsonEq('A9g ... trailing slashes do not double up', readListOf(toKimiAgentFile(block, 'custom/dir//')), skillPathsFor(['s-one', 's-two'], 'custom/dir'));

    assertTrue('A9h the intro line carries no {{ and no base_prompt', !KIMI_PREAMBLE.includes('{{') && !KIMI_PREAMBLE.includes('base_prompt'));
    assertTrue('A9h ... and neither does the whole list block', !outBlock.includes('{{') && !outBlock.includes('base_prompt'));

    const ext = toKimiAgentFile(withFrontmatter('model: inherit\nskills:\n  - s-one\n'));
    assertNotContains('A9i an extension agent file (no Agent(...)) gets no ${base_prompt}', ext, '${base_prompt}');
    assertNotContains('A9i ... and no subagents: field', ext, 'subagents:');
    assertContains('A9i ... but its list, with the next frontmatter key kept in place', ext, 'model: inherit\n---\n');
    assertJsonEq('A9i ... and exactly its one path', readListOf(ext), skillPathsFor(['s-one']));

    const calls = [];
    toKimiAgentFile(block, undefined, (paths) => calls.push(paths.length));
    toKimiAgentFile(WORKER, undefined, (paths) => calls.push(paths.length));
    toKimiAgentFile(withFrontmatter('skills:\n'), undefined, (paths) => calls.push(paths.length));
    toKimiAgentFile(withFrontmatter('skills: just-one\n'), undefined, (paths) => calls.push(paths.length));
    assertJsonEq('A9j the report fires once per recognised field (2 paths, none for no field, 0 for an empty field, none for a scalar)', calls, [2, 0]);

    const emptyField = toKimiAgentFile(withFrontmatter('skills:\n'));
    assertEq('A9k an empty skills: field is removed and no list is written', emptyField, `---\nname: demo\ntools:\n  - Read\n---\n\nYou are a demo agent.\n`);
    const scalar = withFrontmatter('skills: just-one\n');
    assertEq('A9k a scalar value is not ours to interpret: returned unchanged', toKimiAgentFile(scalar), scalar);
});

// ── A10: the same source, rendered for two agents ───────────────────────────

await group('A10', async () => {
    const source = path.join(ROOT, 'subagents', 'unikit-implement-worker.md');
    const names = sourceSkillNames(await fs.readFile(source, 'utf8'));
    assertTrue('A10 the worker source lists skills (the property below is not vacuous)', names.length > 0);

    const forClaude = await renderSubagent(source, 'claude', 'unikit-implement-worker', 'unity', null);
    const forKimi = await renderSubagent(source, 'kimi', 'unikit-implement-worker', 'unity', null);
    assertTrue('A10 both renders produced text', typeof forClaude === 'string' && typeof forKimi === 'string');

    assertTrue('A10 claude: the skills: field stays (Claude Code preloads it)', hasSkillsField(forClaude));
    assertJsonEq('A10 claude: the field lists the source skills', sourceSkillNames(forClaude), names);
    assertNotContains('A10 claude: no Kimi path in the file', forClaude, '.kimi-code');

    assertTrue('A10 kimi: no skills: field', !hasSkillsField(forKimi));
    assertJsonEq('A10 kimi: the read list names the source skills', readListOf(forKimi), skillPathsFor(names));
});

// ── T: transformer API and hooks (Task 4) ───────────────────────────────────

await group('T', async () => {
    const t = getTransformer('kimi');
    assertJsonEq(
        'T1a transform of an empty skill keeps the shape (hashing and removal call it this way)',
        t.transform('unikit-plan', ''),
        { targetDir: 'unikit-plan', targetName: 'SKILL.md', content: '', flat: false },
    );
    assertEq('T1b transformReference is not defined for Kimi: references stay verbatim', typeof t.transformReference, 'undefined');
    assertEq('T1c transformSubagent is defined', typeof t.transformSubagent, 'function');

    const onboarding = getAgentOnboarding('kimi');
    assertTrue('T1d the welcome message has at least 3 lines', Array.isArray(onboarding.welcomeMessage) && onboarding.welcomeMessage.length >= 3);
    assertTrue('T1e the welcome message tells the user to trust the folder (REQ-005)', onboarding.welcomeMessage.some((line) => /trust/i.test(line)));
    assertTrue('T1f the invocation hint names /unikit-plan', typeof onboarding.invocationHint === 'string' && onboarding.invocationHint.includes('/unikit-plan'));

    const verbatim = 'subagent_type: "general-purpose"';
    assertEq('T1g transform rewrites nothing in skill text (types come from the profile)', t.transform('x', verbatim).content, verbatim);

    for (const id of ['claude', 'codex', 'cursor', 'qwen', 'opencode', 'antigravity', 'universal']) {
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
