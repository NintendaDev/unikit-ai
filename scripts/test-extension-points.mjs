// Unit tests for extension points: the registry and name checks (R) and the pure marker primitives
// (M). Consumed from scripts/test-skills.sh (Part 7f6). Imports the compiled build because tests run
// after `ensure_build` in the parent harness. Writes nothing into the repository.

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

const points = await import(dist('core/extension-points.js'));
const markers = await import(dist('core/extension-markers.js'));
const hashing = await import(dist('core/installer/hashing.js'));
const { hashFile } = await import(dist('utils/fs.js'));
const schema = await import(dist('core/extension-injections-schema.js'));
const { validateManifest } = await import(dist('core/extensions.js'));

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

// ── H: the installed hash does not see extension blocks ─────────────────────

await group('H', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'unikit-ext-hash-'));
    try {
        const skillsDir = '.claude/skills';
        const skillDir = path.join(tmp, skillsDir, 'unikit-x');
        const skillFile = path.join(skillDir, 'SKILL.md');
        await fs.mkdir(path.join(skillDir, 'references'), { recursive: true });
        const base = `---\nname: unikit-x\ndescription: x\n---\n\n# X\n\n${ANCHOR}\n\nBody\n`;
        await fs.writeFile(skillFile, base);
        await fs.writeFile(path.join(skillDir, 'references', 'a.md'), 'reference\n');

        const paths = hashing.resolveSkillPaths(tmp, skillsDir, 'claude', 'unikit-x', path.join(tmp, 'source'));
        const hashNow = () => hashing.hashInstalledSkill(paths);
        const h0 = await hashNow();
        assertTrue('H1 a skill directory hashes', typeof h0 === 'string' && h0.length === 64);

        // H2 — a legacy append block.
        const legacyKey = markers.legacyBlockKey('ext-a', 'unikit-x', 'append');
        await fs.writeFile(skillFile, `${base.trimEnd()}\n\n${markers.renderBlockRegion(legacyKey, 'appended')}\n`);
        assertEq('H2 a legacy append block does not move the hash', await hashNow(), h0);

        // H3 — a point block, then back.
        const withBlock = markers.insertAtAnchor(base, 'bootstrap', [markers.renderBlockRegion(markers.pointBlockKey('ext-a', 'unikit-x', 'bootstrap', 'one'), 'a line')]);
        await fs.writeFile(skillFile, withBlock);
        assertEq('H3 a point block does not move the hash', await hashNow(), h0);
        await fs.writeFile(skillFile, base);
        assertEq('H3 taking it out does not either', await hashNow(), h0);

        // H4 — prepend before and after the frontmatter.
        const prependKey = markers.legacyBlockKey('ext-a', 'unikit-x', 'prepend');
        const prependRegion = markers.renderBlockRegion(prependKey, 'first');
        await fs.writeFile(skillFile, `${prependRegion}\n${base}`);
        assertEq('H4 a prepend before the frontmatter does not move the hash', await hashNow(), h0);
        await fs.writeFile(skillFile, markers.insertAfterFrontmatter(base, prependRegion));
        assertEq('H4 a prepend after the frontmatter does not move the hash', await hashNow(), h0);

        // H5 — the extension reference directory is invisible, other files are not.
        await fs.writeFile(skillFile, base);
        await fs.mkdir(path.join(skillDir, 'references', 'ext', '=scope+pkg'), { recursive: true });
        await fs.writeFile(path.join(skillDir, 'references', 'ext', '=scope+pkg', 'spec.md'), 'delivered\n');
        assertEq('H5 a file under references/ext does not move the hash', await hashNow(), h0);
        await fs.writeFile(path.join(skillDir, 'references', 'other.md'), 'user file\n');
        assertTrue('H5 another reference file does', (await hashNow()) !== h0);
        await fs.rm(path.join(skillDir, 'references', 'other.md'));

        // H6 — the base text counts, the block text does not.
        await fs.writeFile(skillFile, base.replace('Body', 'Edited body'));
        assertTrue('H6 an edit of the base text moves the hash', (await hashNow()) !== h0);
        const blockKey = markers.pointBlockKey('ext-a', 'unikit-x', 'bootstrap', 'one');
        await fs.writeFile(skillFile, markers.insertAtAnchor(base, 'bootstrap', [markers.renderBlockRegion(blockKey, 'text one')]));
        const hBlock = await hashNow();
        await fs.writeFile(skillFile, markers.insertAtAnchor(base, 'bootstrap', [markers.renderBlockRegion(blockKey, 'a quite different text two')]));
        assertEq('H6 an edit inside a block does not move the hash', await hashNow(), hBlock);

        // H7 — subagent files.
        const agentFile = path.join(tmp, 'agent.md');
        const agentBase = '---\nname: a\n---\n\nBody\n';
        await fs.writeFile(agentFile, agentBase);
        const plainHash = await hashing.hashInstalledSubagent(agentFile);
        assertEq('H7 a file without markers hashes as raw bytes', plainHash, await hashFile(agentFile));
        await fs.writeFile(agentFile, `${agentBase}\n${markers.renderBlockRegion(markers.legacyBlockKey('ext-a', 'a', 'append'), 'tail')}\n`);
        assertEq('H7 a subagent with a block hashes as without', await hashing.hashInstalledSubagent(agentFile), plainHash);

        // H8 — the word in prose is not a marker.
        const prose = `${agentBase}\nunikit-ext: is a word here\n`;
        await fs.writeFile(agentFile, prose);
        assertEq('H8 prose with the word hashes as raw bytes', await hashing.hashInstalledSubagent(agentFile), await hashFile(agentFile));
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
});

// ── V: the manifest model and its validation ────────────────────────────────

const manifestWith = (injections) => ({ name: 'ext-a', version: '1.0.0', injections });
const pointEntry = (over = {}) => ({ id: 'spec-line', target: 'unikit-plan', point: 'bootstrap', file: 'inj/a.md', ...over });
const check = (injections) => validateManifest(manifestWith(injections));
const errorOf = (injections) => {
    const result = check(injections);
    return result.valid ? null : result.error;
};

await group('V', async () => {
    // V1 — a valid point entry, normalised.
    {
        const result = check([pointEntry({ references: ['references/a.md'] })]);
        assertTrue('V1 a point entry is valid', result.valid === true, JSON.stringify(result));
        const entry = result.valid ? result.manifest.injections[0] : null;
        assertEq('V1 the point is kept', entry?.point, 'bootstrap');
        assertEq('V1 targetType defaults to skill', entry?.targetType, 'skill');
        assertEq('V1 references are kept', JSON.stringify(entry?.references), '["references/a.md"]');
        const bare = check([pointEntry()]);
        assertEq('V1 missing references become an empty array', JSON.stringify(bare.valid ? bare.manifest.injections[0].references : null), '[]');
    }

    // V2 — position and point are exclusive and one of them is required.
    {
        assertTrue('V2 both position and point are rejected', (errorOf([pointEntry({ position: 'append' })]) ?? '').includes('exactly one'));
        assertTrue('V2 neither is rejected', (errorOf([{ target: 'unikit-plan', file: 'inj/a.md' }]) ?? '').includes('exactly one'));
    }

    // V3 — the id.
    {
        const noId = pointEntry();
        delete noId.id;
        assertTrue('V3 a missing id names injections[0].id', (errorOf([noId]) ?? '').includes('injections[0].id'));
        for (const id of ['Spec', 'a b', 'a:b']) {
            assertTrue(`V3 id "${id}" is rejected`, (errorOf([pointEntry({ id })]) ?? '').startsWith('injections[0].id'));
        }
    }

    // V4 — the point name.
    for (const point of ['Bootstrap', '1a', 'x-agent']) {
        assertTrue(`V4 point "${point}" is rejected`, (errorOf([pointEntry({ point })]) ?? '').startsWith('injections[0].point'));
    }

    // V5 — ids are unique inside one manifest.
    assertTrue(
        'V5 two entries with one id are rejected',
        (errorOf([pointEntry(), pointEntry({ point: 'other', file: 'inj/b.md' })]) ?? '').includes('duplicates'),
    );

    // V6 — `file` stays inside the extension directory.
    for (const file of ['../x.md', '/etc/x', 'C:\\x.md', 'a/../../x']) {
        assertTrue(`V6 file "${file}" is rejected`, (errorOf([pointEntry({ file })]) ?? '').includes('inside the extension directory'));
    }
    for (const file of ['./inj/x.md', 'inj/x.md']) {
        assertTrue(`V6 file "${file}" is valid`, check([pointEntry({ file })]).valid === true);
    }

    // V7 — references.
    {
        assertTrue('V7 references must be an array', (errorOf([pointEntry({ references: 'a.md' })]) ?? '').includes('references must be an array'));
        assertTrue('V7 a number is rejected', (errorOf([pointEntry({ references: [1] })]) ?? '').includes('references[0] must be a string'));
        assertTrue('V7 a basename listed twice is rejected', (errorOf([pointEntry({ references: ['a/x.md', 'b/x.md'] })]) ?? '').includes('twice'));
        assertTrue(
            'V7 one basename on two paths is rejected',
            (errorOf([pointEntry({ references: ['a/x.md'] }), pointEntry({ id: 'second', references: ['b/x.md'] })]) ?? '').includes('conflicts'),
        );
        assertTrue('V7 a name with a space is rejected', (errorOf([pointEntry({ references: ['a/my file.md'] })]) ?? '').includes('valid reference file name'));
        assertTrue(
            'V7 one file in two entries is valid',
            check([pointEntry({ references: ['a/x.md'] }), pointEntry({ id: 'second', references: ['a/x.md'] })]).valid === true,
        );
    }

    // V8 — references need a point.
    assertTrue(
        'V8 references on a position entry are rejected',
        (errorOf([{ target: 'unikit-plan', file: 'inj/a.md', position: 'append', references: ['a.md'] }]) ?? '').includes('requires "point"'),
    );

    // V9 — the original form keeps working.
    {
        const result = check([
            { target: 'unikit-plan', file: 'a.md', position: 'append' },
            { target: 'unikit-plan', file: 'b.md', position: 'prepend', targetType: 'subagent' },
        ]);
        assertTrue('V9 legacy entries are valid', result.valid === true, JSON.stringify(result));
        assertEq('V9 targetType defaults to skill', result.valid ? result.manifest.injections[0].targetType : null, 'skill');
        assertEq('V9 an explicit subagent is kept', result.valid ? result.manifest.injections[1].targetType : null, 'subagent');
        assertTrue(
            'V9 an unknown position keeps the old text',
            (errorOf([{ target: 'unikit-plan', file: 'a.md', position: 'middle' }]) ?? '').includes('must be "append" or "prepend"'),
        );
    }

    // V10 — the files a manifest names.
    {
        const parsed = schema.parseInjections([
            pointEntry({ references: ['r/a.md', 'r/b.md'] }),
            pointEntry({ id: 'second', file: 'inj/a.md', references: ['r/a.md'] }),
            { target: 'unikit-plan', file: 'legacy.md', position: 'append' },
        ]);
        assertTrue('V10 the manifest parses', parsed.ok === true);
        const files = parsed.ok ? schema.collectPointInjectionFiles(parsed.injections) : [];
        assertEq('V10 point files are listed once each', JSON.stringify(files), '["inj/a.md","r/a.md","r/b.md"]');
        const legacy = schema.parseInjections([{ target: 'unikit-plan', file: 'legacy.md', position: 'append' }]);
        assertEq('V10 legacy entries name no point files', JSON.stringify(legacy.ok ? schema.collectPointInjectionFiles(legacy.injections) : null), '[]');
    }

    // V11 — containment.
    assertEq('V11 a child is inside', schema.isInsideDirectory('/a/b', '/a/b/c'), true);
    assertEq('V11 a sibling is outside', schema.isInsideDirectory('/a/b', '/a/x'), false);
    assertEq('V11 the directory itself is not inside', schema.isInsideDirectory('/a/b', '/a/b'), false);
});

// ── EP-1…EP-5: the registry and the anchors in the shipped skills agree ──────
// The guard does not know how many points exist: it counts the pairs the registry lists and prints
// the number, so adding a point (a minor version) needs no edit here, and a registry that vanished
// is `0 pairs`, never a green run.

const ANCHOR_MARK = '<!-- unikit:extension-point:';
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anchorLine = (point) => new RegExp(`^[ \\t]*${escapeRe(ANCHOR_MARK + point)} -->[ \\t]*$`);

async function listMarkdown(dir) {
    const out = [];
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await listMarkdown(full));
        else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
}

await group('EP', async () => {
    // EP-1 — the registry itself.
    let registry = null;
    try {
        registry = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'extension-points.json'), 'utf8'));
    } catch (error) {
        fail('EP-1', `data/extension-points.json cannot be read: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }
    const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
    if (!isObject(registry) || !isObject(registry.skills) || !isObject(registry.subagents)) {
        fail('EP-1', 'the registry must be an object with "skills" and "subagents" objects');
        return;
    }
    const pairs = [];
    for (const [target, list] of Object.entries(registry.skills)) {
        if (!Array.isArray(list)) {
            fail('EP-1', `skills.${target} is not an array`);
            continue;
        }
        for (const point of list) pairs.push([target, point]);
    }
    console.log(`  EP-1: ${pairs.length} (target, point) pair(s) in the registry`);
    assertTrue('EP-1 the registry lists at least one pair', pairs.length > 0, '0 pairs — the registry is empty or unreadable');
    assertEq(
        'EP-1 subagent points are not supported yet — the pass reports them as unknown-point',
        Object.keys(registry.subagents).length,
        0,
    );

    // EP-2 — every registry pair has its anchor exactly once.
    {
        let bad = 0;
        for (const [target, point] of pairs) {
            const file = path.join(ROOT, 'skills', target, 'SKILL.md');
            let text;
            try {
                text = await fs.readFile(file, 'utf8');
            } catch {
                fail('EP-2', `skills/${target}/SKILL.md does not exist`);
                bad++;
                continue;
            }
            const count = text.split('\n').filter(line => anchorLine(point).test(line)).length;
            if (count !== 1) {
                fail('EP-2', `skills/${target}/SKILL.md carries the anchor "${point}" ${count} time(s), expected exactly 1`);
                bad++;
            }
        }
        if (bad === 0) pass(`EP-2 ${pairs.length} anchors, one per registry pair`);
    }

    // EP-3 — no anchor anywhere else.
    {
        const files = [...await listMarkdown(path.join(ROOT, 'skills')), ...await listMarkdown(path.join(ROOT, 'subagents'))];
        console.log(`  EP-3: ${files.length} markdown file(s) scanned`);
        assertTrue('EP-3 some files were scanned', files.length > 0, '0 files scanned');
        const known = new Set(pairs.map(([target, point]) => `${target}:${point}`));
        let stray = 0;
        for (const file of files) {
            const rel = path.relative(ROOT, file).replaceAll('\\', '/');
            const lines = (await fs.readFile(file, 'utf8')).split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (!lines[i].includes(ANCHOR_MARK)) continue;
                const whole = /^[ \t]*<!-- unikit:extension-point:([a-z][a-z0-9-]*) -->[ \t]*$/.exec(lines[i]);
                const target = /^skills\/([^/]+)\/SKILL\.md$/.exec(rel)?.[1];
                if (!whole || !target || !known.has(`${target}:${whole[1]}`)) {
                    fail('EP-3', `${rel}:${i + 1} an anchor that is not a registry pair on its own line of a SKILL.md`);
                    stray++;
                }
            }
        }
        if (stray === 0) pass('EP-3 no stray anchors');
    }

    // EP-4 — the names are valid by the one rule.
    {
        const invalid = pairs.filter(([, point]) => points.validatePointName(point) !== null);
        assertEq('EP-4 every point name passes validatePointName', invalid.map(([t, p]) => `${t}:${p}`).join(', '), '');
    }

    // EP-5 — precondition of the hash normalisation: one trailing newline.
    {
        const files = [
            ...(await fs.readdir(path.join(ROOT, 'skills'))).map(name => path.join(ROOT, 'skills', name, 'SKILL.md')),
            ...(await fs.readdir(path.join(ROOT, 'subagents'))).filter(name => name.endsWith('.md')).map(name => path.join(ROOT, 'subagents', name)),
        ];
        let scanned = 0;
        let bad = 0;
        for (const file of files) {
            let text;
            try {
                text = await fs.readFile(file, 'utf8');
            } catch {
                continue;
            }
            scanned++;
            if (!text.endsWith('\n') || text.endsWith('\n\n')) {
                fail('EP-5', `${path.relative(ROOT, file).replaceAll('\\', '/')} must end with exactly one newline`);
                bad++;
            }
        }
        console.log(`  EP-5: ${scanned} file(s) scanned`);
        assertTrue('EP-5 some files were scanned', scanned > 0, '0 files scanned');
        if (bad === 0) pass('EP-5 every skill and subagent file ends with exactly one newline');
    }
});

console.log(`\nextension-points: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
