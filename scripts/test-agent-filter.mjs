// Unit tests for `applyAgentFilter` + `readSourceForAgent`.
// Consumed from scripts/test-agent-filter.sh. Import the compiled build
// because tests run after `ensure_build` in the parent harness.

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST = path.resolve(__dirname, '..', 'dist', 'core', 'agent-filter.js');

const { applyAgentFilter, readSourceForAgent } = await import(pathToFileURL(DIST).href);

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

function assertContains(name, haystack, needle) {
    if (haystack.includes(needle)) {
        pass(name);
    } else {
        fail(name, `expected substring ${JSON.stringify(needle)} in:\n  ${JSON.stringify(haystack)}`);
    }
}

function assertNotContains(name, haystack, needle) {
    if (!haystack.includes(needle)) {
        pass(name);
    } else {
        fail(name, `substring ${JSON.stringify(needle)} should NOT appear in:\n  ${JSON.stringify(haystack)}`);
    }
}

function assertThrows(name, fn, messageFragment) {
    try {
        fn();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!messageFragment || msg.includes(messageFragment)) {
            pass(name);
        } else {
            fail(name, `error thrown but message missing ${JSON.stringify(messageFragment)}: ${msg}`);
        }
        return;
    }
    fail(name, 'expected Error, got success');
}

// ── Case 1: include-only keeps the block for listed agent, drops it for others
{
    const src = [
        'before',
        '<!-- unikit:agents codex -->',
        'X',
        '<!-- unikit:end -->',
        'after',
    ].join('\n');

    const forCodex = applyAgentFilter(src, 'codex');
    assertContains('include-only/codex-has-X', forCodex, 'X');
    assertNotContains('include-only/codex-no-start-marker', forCodex, '<!-- unikit:agents');
    assertNotContains('include-only/codex-no-end-marker', forCodex, '<!-- unikit:end');

    const forClaude = applyAgentFilter(src, 'claude');
    assertNotContains('include-only/claude-no-X', forClaude, 'X');
    assertNotContains('include-only/claude-no-start-marker', forClaude, '<!-- unikit:agents');
    assertNotContains('include-only/claude-no-end-marker', forClaude, '<!-- unikit:end');
    assertContains('include-only/claude-keeps-before', forClaude, 'before');
    assertContains('include-only/claude-keeps-after', forClaude, 'after');
}

// ── Case 2: exclude-only drops the block for listed agent, keeps for others
{
    const src = [
        'before',
        '<!-- unikit:agents !codex -->',
        'X',
        '<!-- unikit:end -->',
        'after',
    ].join('\n');

    const forCodex = applyAgentFilter(src, 'codex');
    assertNotContains('exclude-only/codex-no-X', forCodex, 'X');

    const forClaude = applyAgentFilter(src, 'claude');
    assertContains('exclude-only/claude-has-X', forClaude, 'X');
}

// ── Case 3: multi-token exclude drops for any listed, keeps for non-listed
{
    const src = [
        '<!-- unikit:agents !codex,!cursor -->',
        'content',
        '<!-- unikit:end -->',
    ].join('\n');

    assertNotContains('multi-exclude/codex-cut', applyAgentFilter(src, 'codex'), 'content');
    assertNotContains('multi-exclude/cursor-cut', applyAgentFilter(src, 'cursor'), 'content');
    for (const agent of ['claude', 'gemini']) {
        assertContains(`multi-exclude/${agent}-kept`, applyAgentFilter(src, agent), 'content');
    }
}

// ── Case 4: passthrough — content without markers is unchanged
{
    const src = '# Title\n\nBody paragraph.\n\n- item 1\n- item 2\n';
    assertEq('passthrough/unchanged', applyAgentFilter(src, 'codex'), src);
}

// ── Case 5: empty-line collapse after cut — no more than `\n\n`
{
    const src = [
        'line A',
        '',
        '<!-- unikit:agents codex -->',
        'secret',
        '<!-- unikit:end -->',
        '',
        'line B',
    ].join('\n');

    const out = applyAgentFilter(src, 'claude');
    if (/\n{3,}/.test(out)) {
        fail('collapse/no-triple-newline', `output still has 3+ newlines: ${JSON.stringify(out)}`);
    } else {
        pass('collapse/no-triple-newline');
    }
    assertContains('collapse/keeps-surrounding-A', out, 'line A');
    assertContains('collapse/keeps-surrounding-B', out, 'line B');
}

// ── Case 6: frontmatter-safe — markers inside frontmatter are NOT processed
{
    const src = [
        '---',
        'name: foo',
        'description: >-',
        '  <!-- unikit:agents codex -->',
        '  <!-- unikit:end -->',
        '---',
        'body',
    ].join('\n');

    // No body markers → the whole content must come back verbatim regardless of agent.
    assertEq('frontmatter-safe/codex', applyAgentFilter(src, 'codex'), src);
    assertEq('frontmatter-safe/claude', applyAgentFilter(src, 'claude'), src);
}

// ── Case 7: inline-marker — start + end on the same line as text → Error
{
    const src = 'foo <!-- unikit:agents codex -->X<!-- unikit:end --> bar\n';
    assertThrows(
        'inline-marker/rejects',
        () => applyAgentFilter(src, 'codex'),
        'Inline',
    );
}

// ── Case 8: unknown agent token → Error
{
    const src = '<!-- unikit:agents foo -->\nX\n<!-- unikit:end -->\n';
    assertThrows(
        'unknown-agent/rejects',
        () => applyAgentFilter(src, 'codex'),
        'Unknown agent',
    );
}

// ── Case 9: mixed include + exclude tokens → Error
{
    const src = '<!-- unikit:agents codex,!cursor -->\nX\n<!-- unikit:end -->\n';
    assertThrows(
        'mixed/rejects',
        () => applyAgentFilter(src, 'codex'),
        'Mixed include/exclude',
    );
}

// ── Case 10: unclosed block → Error
{
    const src = '<!-- unikit:agents codex -->\nX\nno end marker\n';
    assertThrows(
        'unclosed/rejects',
        () => applyAgentFilter(src, 'codex'),
        'Unclosed',
    );
}

// ── Case 11: nested (two openings before an end) → Error
{
    const src = [
        '<!-- unikit:agents codex -->',
        '<!-- unikit:agents claude -->',
        'X',
        '<!-- unikit:end -->',
        '<!-- unikit:end -->',
    ].join('\n');
    assertThrows(
        'nested/rejects',
        () => applyAgentFilter(src, 'codex'),
        'Nested',
    );
}

// ── Case 12 (extra): applyAgentFilter rejects unknown agentId
{
    assertThrows(
        'unknown-agentid/rejects',
        () => applyAgentFilter('no markers\n', 'not-a-real-agent'),
        'Unknown agent',
    );
}

// ── Case 13 (extra): readSourceForAgent returns null for missing file, filters otherwise
{
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-filter-'));
    try {
        const missing = await readSourceForAgent(path.join(tmp, 'does-not-exist.md'), 'codex');
        assertEq('readSourceForAgent/missing-returns-null', missing, null);

        const filePath = path.join(tmp, 'sample.md');
        const src = [
            '<!-- unikit:agents codex -->',
            'only-for-codex',
            '<!-- unikit:end -->',
            'always',
        ].join('\n');
        await fs.writeFile(filePath, src, 'utf-8');

        const forCodex = await readSourceForAgent(filePath, 'codex');
        assertContains('readSourceForAgent/codex-has-block', forCodex, 'only-for-codex');

        const forClaude = await readSourceForAgent(filePath, 'claude');
        assertNotContains('readSourceForAgent/claude-cut-block', forClaude, 'only-for-codex');
        assertContains('readSourceForAgent/claude-keeps-tail', forClaude, 'always');
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
}

console.log(`\nagent-filter: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
