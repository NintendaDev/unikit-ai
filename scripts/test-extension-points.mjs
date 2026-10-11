// Unit tests for extension points: the registry and name checks (R) and the pure marker primitives
// (M). Consumed from scripts/test-skills.sh (Part 7f6). Imports the compiled build because tests run
// after `ensure_build` in the parent harness. Writes nothing into the repository.

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

const points = await import(dist('core/extension-points.js'));
const markers = await import(dist('core/extension-markers.js'));

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

// An exception inside a group must not take the whole run down silently.
async function group(name, fn) {
    try {
        await fn();
    } catch (error) {
        fail(name, `threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
}

// ── R: the registry and the name checks ─────────────────────────────────────

await group('R', async () => {
    const registry = await points.loadExtensionPointRegistry();
    const keys = Object.keys(registry.skills);
    console.log(`  R: ${keys.length} registry target(s) scanned`);

    assertTrue('R1 the registry is not empty', keys.length > 0, 'registry has no skill targets');
    assertEq('R1 the registry lists 34 skills', keys.length, 34);
    assertTrue(
        'R1 every skill offers exactly the point "bootstrap"',
        keys.every(key => JSON.stringify(registry.skills[key]) === '["bootstrap"]'),
        keys.filter(key => JSON.stringify(registry.skills[key]) !== '["bootstrap"]').join(', '),
    );
    assertTrue(
        'R1 the two skills without an extension point are not listed',
        !('unikit-skills-context' in registry.skills) && !('unikit-help' in registry.skills),
    );

    const missing = [];
    for (const key of keys) {
        try {
            await fs.access(path.join(ROOT, 'skills', key, 'SKILL.md'));
        } catch {
            missing.push(key);
        }
    }
    assertEq('R2 every registry key is a skill directory with a SKILL.md', missing.join(', '), '');

    assertEq('R3 the subagents section is empty', Object.keys(registry.subagents).length, 0);

    for (const name of ['bootstrap', 'before-tasks', 'a1']) {
        assertEq(`R4 point "${name}" is valid`, points.validatePointName(name), null);
    }
    for (const name of ['', 'Bootstrap', '1a', 'a_b', 'a b', 'foo-agent', 'a'.repeat(65)]) {
        assertTrue(`R4 point "${name.length > 20 ? name.length + ' chars' : name}" is rejected`, typeof points.validatePointName(name) === 'string'
            && points.validatePointName(name).startsWith('point'));
    }
    for (const id of ['spec-line', 'a1']) {
        assertEq(`R4 id "${id}" is valid`, points.validateInjectionId(id), null);
    }
    for (const id of ['', 'Spec', '-a', 'a:b', 'a b']) {
        assertTrue(`R4 id "${id}" is rejected`, typeof points.validateInjectionId(id) === 'string'
            && points.validateInjectionId(id).startsWith('id'));
    }

    assertEq('R5 slug of @scope/pkg', points.extensionSlug('@scope/pkg'), '=scope+pkg');
    assertEq('R5 slug of a/b', points.extensionSlug('a/b'), 'a+b');
    assertEq('R5 slug of a.b', points.extensionSlug('a.b'), 'a.b');
    assertTrue('R5 @a/b and a/b differ', points.extensionSlug('@a/b') !== points.extensionSlug('a/b'));
    const names = ['a', 'a.b', 'a-b', 'a_b', 'a/b', '@a', '@a/b', '@a/b.c', 'b/a', '@b/a', 'a@b', 'ab'];
    const slugs = new Set(names.map(points.extensionSlug));
    assertEq('R5 twelve distinct names give twelve distinct slugs', slugs.size, names.length);
    assertTrue(
        'R5 a slug holds no path separator',
        names.every(name => !/[\\/]/.test(points.extensionSlug(name))),
    );

    const manual = { skills: { 'unikit-plan': ['bootstrap'] }, subagents: {} };
    assertEq('R6 a known skill offers bootstrap', JSON.stringify(points.registeredPoints(manual, 'skill', 'unikit-plan')), '["bootstrap"]');
    assertEq('R6 an unknown skill offers nothing', JSON.stringify(points.registeredPoints(manual, 'skill', 'nope')), '[]');
    assertEq('R6 a subagent target offers nothing', JSON.stringify(points.registeredPoints(manual, 'subagent', 'unikit-plan')), '[]');
    assertEq('R6 a prototype key is not a target', JSON.stringify(points.registeredPoints(manual, 'skill', 'constructor')), '[]');
});

// ── M: the marker primitives ────────────────────────────────────────────────

const ANCHOR = '<!-- unikit:extension-point:bootstrap -->';
const key = (id) => markers.pointBlockKey('ext-a', 'unikit-plan', 'bootstrap', id);
const region = (id, text = `line ${id}`) => markers.renderBlockRegion(key(id), text);

await group('M', async () => {
    // M1 — a block goes right under the anchor in the middle of a file and comes out byte-exact.
    {
        const base = `# Title\n\n${ANCHOR}\n\nNext step\n`;
        const inserted = markers.insertAtAnchor(base, 'bootstrap', [region('one')]);
        assertEq('M1 the block sits right under the anchor', inserted, `# Title\n\n${ANCHOR}\n${region('one')}\n\nNext step\n`);
        const back = markers.removePointBlocks(inserted);
        assertEq('M1 removal returns the source byte for byte', back.content, base);
        assertEq('M1 removal counts one block', back.removed, 1);
    }

    // M2 — the anchor on the last line, with and without a trailing newline.
    for (const [label, base] of [['without', `# T\n${ANCHOR}`], ['with', `# T\n${ANCHOR}\n`]]) {
        const inserted = markers.insertAtAnchor(base, 'bootstrap', [region('one')]);
        assertTrue(`M2 ${label} a trailing newline: inserted`, typeof inserted === 'string' && inserted.includes(region('one')));
        assertEq(`M2 ${label} a trailing newline: byte-exact removal`, markers.removePointBlocks(inserted).content, base);
    }

    // M3 — two blocks under one anchor, in the given order.
    {
        const base = `A\n${ANCHOR}\nB\n`;
        const inserted = markers.insertAtAnchor(base, 'bootstrap', [region('one'), region('two')]);
        assertEq('M3 the blocks keep the given order', inserted, `A\n${ANCHOR}\n${region('one')}\n${region('two')}\nB\n`);
        assertEq('M3 removing both returns the source', markers.removePointBlocks(inserted).content, base);
        const first = markers.removeBlockByKey(inserted, key('one'));
        assertEq('M3 removing one by key leaves the other in place', first.content, `A\n${ANCHOR}\n${region('two')}\nB\n`);
        assertEq('M3 removing the second one returns the source', markers.removeBlockByKey(first.content, key('two')).content, base);
    }

    // M4 — an indented anchor, and CRLF line ends.
    {
        const indented = `1. step\n   ${ANCHOR}\n2. next\n`;
        const a = markers.insertAtAnchor(indented, 'bootstrap', [region('one')]);
        assertEq('M4 an indented anchor round-trips', markers.removePointBlocks(a).content, indented);
        const crlf = `# T\r\n${ANCHOR}\r\nrest\r\n`;
        const b = markers.insertAtAnchor(crlf, 'bootstrap', [region('one')]);
        assertTrue('M4 a CRLF anchor takes a block', typeof b === 'string' && b.includes(region('one')));
        assertEq('M4 a CRLF anchor round-trips', markers.removePointBlocks(b).content, crlf);
    }

    // M5 — counting anchors and refusing to guess.
    {
        const none = 'no anchor here\n';
        const one = `x\n${ANCHOR}\n`;
        const two = `${ANCHOR}\nx\n${ANCHOR}\n`;
        assertEq('M5 no anchor counts 0', markers.countAnchors(none, 'bootstrap'), 0);
        assertEq('M5 one anchor counts 1', markers.countAnchors(one, 'bootstrap'), 1);
        assertEq('M5 two anchors count 2', markers.countAnchors(two, 'bootstrap'), 2);
        assertEq('M5 no anchor: insertion refused', markers.insertAtAnchor(none, 'bootstrap', [region('one')]), null);
        assertEq('M5 two anchors: insertion refused', markers.insertAtAnchor(two, 'bootstrap', [region('one')]), null);
        assertEq('M5 nothing to insert returns the content', markers.insertAtAnchor(one, 'bootstrap', []), one);
        assertEq('M5 a mention inside a sentence is not an anchor', markers.countAnchors(`see ${ANCHOR} here\n`, 'bootstrap'), 0);
    }

    // M6 — point removal leaves legacy blocks and look-alikes alone.
    {
        const legacyKey = markers.legacyBlockKey('ext-a', 'unikit-plan', 'append');
        const legacy = markers.renderBlockRegion(legacyKey, 'old text');
        const text = `A\n${ANCHOR}\n${region('one')}\nB\n\n${legacy}\nunikit-ext:ext-a:x:y:z:start\n`;
        const result = markers.removePointBlocks(text);
        assertEq('M6 only the point block is counted', result.removed, 1);
        assertTrue('M6 the legacy block stays', result.content.includes(legacy));
        assertTrue('M6 the look-alike line stays', result.content.includes('unikit-ext:ext-a:x:y:z:start'));
        assertTrue('M6 the point block is gone', !result.content.includes(region('one')));
    }

    // M7 — the legacy append shape, one block and two.
    {
        const k1 = markers.legacyBlockKey('ext-a', 'unikit-plan', 'append');
        const k2 = markers.legacyBlockKey('ext-b', 'unikit-plan', 'append');
        const r1 = markers.renderBlockRegion(k1, 'first');
        const r2 = markers.renderBlockRegion(k2, 'second');
        const one = `A\n\n${r1}\n`;
        assertEq('M7 one legacy append comes out', markers.removeBlockByKey(one, k1).content, 'A\n');
        const two = `A\n\n${r1}\n\n${r2}\n`;
        assertEq('M7 two legacy blocks: first then second', markers.removeBlockByKey(markers.removeBlockByKey(two, k1).content, k2).content, 'A\n');
        assertEq('M7 two legacy blocks: second then first', markers.removeBlockByKey(markers.removeBlockByKey(two, k2).content, k1).content, 'A\n');
        assertEq('M7 the hash view of two legacy blocks', markers.stripBlocksForHash(two), 'A\n');
    }

    // M8 — the legacy prepend shape (a region before the frontmatter).
    {
        const k = markers.legacyBlockKey('ext-a', 'unikit-plan', 'prepend');
        const r = markers.renderBlockRegion(k, 'before everything');
        const base = '---\nname: x\n---\n\n# T\n';
        assertEq('M8 a legacy prepend comes out', markers.removeBlockByKey(`${r}\n${base}`, k).content, base);
    }

    // M9 — prepend after the frontmatter.
    {
        const k = markers.legacyBlockKey('ext-a', 'unikit-plan', 'prepend');
        const r = markers.renderBlockRegion(k, 'after frontmatter');
        const base = '---\nname: x\n---\n\n# T\n';
        const inserted = markers.insertAfterFrontmatter(base, r);
        assertEq('M9 the block sits between the boundary and the blank line', inserted, `---\nname: x\n---\n${r}\n\n# T\n`);
        assertEq('M9 removal returns the source', markers.removeBlockByKey(inserted, k).content, base);
        assertEq('M9 a file with no frontmatter gets the block first', markers.insertAfterFrontmatter('# T\n', r), `${r}\n# T\n`);
    }

    // M10 — the hash view.
    {
        const plain = 'no markers\n';
        assertTrue('M10 a file without markers is returned as it is', markers.stripBlocksForHash(plain) === plain);
        const base = `A\n${ANCHOR}\nB\n`;
        const withBlock = markers.insertAtAnchor(base, 'bootstrap', [region('one')]);
        assertEq('M10 a file with a block hashes as its source', markers.stripBlocksForHash(withBlock), base);
        const k = markers.legacyBlockKey('ext-a', 'unikit-plan', 'append');
        const mixed = `${withBlock.replace(/\n$/, '')}\n\n${markers.renderBlockRegion(k, 'tail')}\n`;
        assertEq('M10 mixed shapes hash as the source', markers.stripBlocksForHash(mixed), base);
        const once = markers.stripBlocksForHash(mixed);
        assertEq('M10 the normalisation is idempotent', markers.stripBlocksForHash(once), once);
    }

    // M11 — a pair with no end is not touched.
    {
        const broken = `A\n${markers.blockStartMarker(key('one'))}\nno end\n`;
        assertEq('M11 a start without an end is not a region', markers.findBlockRegions(broken).length, 0);
        assertEq('M11 point removal leaves it as it is', markers.removePointBlocks(broken).content, broken);
        assertEq('M11 the hash view leaves it as it is', markers.stripBlocksForHash(broken), broken);
    }

    // M12 — what a block text must never contain.
    {
        assertTrue('M12 a marker is detected', markers.containsBlockMarker('x <!-- unikit-ext:a:b:c:d:start --> y'));
        assertTrue('M12 the bare word is not a marker', !markers.containsBlockMarker('the unikit-ext word'));
        assertTrue('M12 an anchor is not a marker', !markers.containsBlockMarker(ANCHOR));
    }
});

console.log(`\nextension-points: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
